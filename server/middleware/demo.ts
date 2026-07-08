/**
 * Demo mode (NUXT_DEMO=1): seluruh /api dijawab dengan data palsu supaya UI
 * bisa dikembangkan/didesain tanpa koneksi ke server MinIO. Matikan dengan
 * menghapus NUXT_DEMO dari .env.
 */

const DAY = 24 * 3600 * 1000

function svgThumb(name: string): string {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='hsl(${hue},38%,46%)'/><circle cx='150' cy='150' r='56' fill='hsl(${hue},55%,68%)'/><path d='M0 400 L150 230 L260 330 L330 260 L400 330 L400 400 Z' fill='hsl(${hue},45%,32%)'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const TEXT_SAMPLE = `# Catatan Demo\n\nIni mode demo Yasa Console — server MinIO tidak terhubung.\nSemua data di halaman ini palsu.\n\n- preview teks jalan\n- preview gambar pakai placeholder SVG\n- semua mutasi (create/delete) pura-pura sukses\n`

function obj(name: string, size: number, daysAgo: number) {
  return { name, size, lastModified: new Date(Date.now() - daysAgo * DAY).toISOString(), etag: 'demo' }
}

const TREE: Record<string, { prefixes: string[]; objects: any[] }> = {
  '': {
    prefixes: ['dokumen/', 'foto/', 'arsip/'],
    objects: [
      obj('laporan-q2.pdf', 2.4e6, 1),
      obj('notes.md', 4200, 0),
      obj('config.json', 1800, 3),
      obj('rekap-absensi.csv', 88e3, 2),
      obj('video-profil.mp4', 148e6, 12),
      obj('banner-web.png', 640e3, 5),
      obj('main.ts', 9200, 1),
    ],
  },
  'dokumen/': {
    prefixes: ['dokumen/kontrak/'],
    objects: [
      obj('dokumen/proposal-yasatech.pdf', 1.8e6, 4),
      obj('dokumen/sop-internal.docx', 720e3, 20),
      obj('dokumen/readme.md', 3100, 2),
    ],
  },
  'dokumen/kontrak/': {
    prefixes: [],
    objects: [obj('dokumen/kontrak/kontrak-2026.pdf', 3.1e6, 30)],
  },
  'foto/': {
    prefixes: [],
    objects: [
      obj('foto/kegiatan-01.jpg', 1.2e6, 1),
      obj('foto/kegiatan-02.jpg', 1.4e6, 1),
      obj('foto/tim-yasatech.jpg', 2.1e6, 3),
      obj('foto/kantor-baru.png', 3.4e6, 7),
      obj('foto/produk-a.jpg', 890e3, 9),
      obj('foto/produk-b.jpg', 760e3, 9),
      obj('foto/banner-event.png', 1.9e6, 14),
      obj('foto/dokumentasi-rapat.jpg', 1.1e6, 2),
    ],
  },
  'arsip/': {
    prefixes: [],
    objects: [obj('arsip/backup-2026-06.zip', 4.2e9, 37), obj('arsip/db-dump.sql', 220e6, 8)],
  },
}

const BUCKETS = [
  { name: 'file-sharing', creationDate: new Date(Date.now() - 90 * DAY).toISOString() },
  { name: 'dokumen-kantor', creationDate: new Date(Date.now() - 61 * DAY).toISOString() },
  { name: 'foto-kegiatan', creationDate: new Date(Date.now() - 30 * DAY).toISOString() },
  { name: 'backup-server', creationDate: new Date(Date.now() - 120 * DAY).toISOString() },
]

const USERS = [
  { accessKey: 'console-admin', status: 'enabled', policy: 'consoleAdmin' },
  { accessKey: 'app-user', status: 'enabled', policy: 'app-rw' },
  { accessKey: 'budi', status: 'enabled', policy: 'readwrite' },
  { accessKey: 'siti', status: 'enabled', policy: 'readonly' },
  { accessKey: 'backup-bot', status: 'disabled', policy: 'backup-ro' },
]

const POLICY_DOC = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
      Resource: ['arn:aws:s3:::file-sharing', 'arn:aws:s3:::file-sharing/*'],
    },
  ],
}

function listing(prefix: string) {
  if (TREE[prefix]) return { ...TREE[prefix], truncated: false }
  return { prefixes: [], objects: [], truncated: false }
}

function presignUrl(key: string): string {
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(key)) return svgThumb(key)
  return `data:text/plain;charset=utf-8,${encodeURIComponent(TEXT_SAMPLE)}`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.demo) return
  // demo = auth bypass (login apa pun sukses sbg admin) → HARAM di produksi
  if (process.env.NODE_ENV === 'production') {
    console.warn('[yasa] NUXT_DEMO diabaikan karena NODE_ENV=production')
    return
  }

  const path = event.path.split('?')[0] || ''
  const method = event.method
  if (!path.startsWith('/api/') || path.startsWith('/api/_auth')) return

  // ---------- auth ----------
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    await setUserSession(event, {
      user: { accessKey: body?.accessKey || 'demo-admin', admin: true },
      secure: { secretKey: 'demo' },
      loggedInAt: Date.now(),
    })
    return { ok: true, admin: true }
  }
  if (path === '/api/auth/recheck' && method === 'POST') return { admin: true }
  if (path === '/api/meta') return { endpoint: 'demo mode · MinIO offline' }

  // ---------- admin ----------
  if (path === '/api/admin/info') {
    return {
      mode: 'online',
      deploymentID: 'demo-deployment',
      buckets: BUCKETS.length,
      objects: 2314876,
      usage: 340.3 * 1024 ** 3,
      totalSpace: 24 * 1024 ** 4,
      drives: { online: 15, total: 16 },
      servers: [
        { endpoint: '10.0.0.11:9000', state: 'online', uptime: 86400 * 9 + 7200, version: '2025-09-07T16:13:09Z', drives: Array(4).fill({ state: 'ok', totalspace: 6e12, usedspace: 9e10 }) },
        { endpoint: '10.0.0.12:9000', state: 'online', uptime: 86400 * 9, version: '2025-09-07T16:13:09Z', drives: Array(4).fill({ state: 'ok', totalspace: 6e12, usedspace: 8e10 }) },
        { endpoint: '10.0.0.13:9000', state: 'online', uptime: 86400 * 4, version: '2025-09-07T16:13:09Z', drives: [...Array(3).fill({ state: 'ok', totalspace: 6e12, usedspace: 9e10 }), { state: 'offline', totalspace: 6e12, usedspace: 0 }] },
        { endpoint: '10.0.0.14:9000', state: 'offline', uptime: 0, version: '2025-09-07T16:13:09Z', drives: Array(4).fill({ state: 'ok', totalspace: 6e12, usedspace: 7e10 }) },
      ],
    }
  }
  if (path === '/api/admin/metrics') {
    return {
      sizeDistribution: [
        { label: '< 1 KB', count: 4210 },
        { label: '1 KB – 1 MB', count: 1893400 },
        { label: '1 – 10 MB', count: 361200 },
        { label: '10 – 64 MB', count: 48100 },
        { label: '64 – 128 MB', count: 6300 },
        { label: '128 – 512 MB', count: 1520 },
        { label: '> 512 MB', count: 146 },
      ],
      traffic: { get: 1.4 * 1024 ** 4, put: 486 * 1024 ** 3 },
      scansFinished: 1520,
    }
  }
  if (path === '/api/admin/users' && method === 'GET') return USERS
  if (path === '/api/admin/users' && method === 'POST') return { ok: true, accessKey: 'baru', policyWarning: '' }
  if (path.startsWith('/api/admin/users/')) return { ok: true }
  if (path === '/api/admin/policies' && method === 'GET') {
    return ['app-rw', 'backup-ro', 'consoleAdmin', 'diagnostics', 'readonly', 'readwrite', 'writeonly'].map((name) => ({ name }))
  }
  if (path === '/api/admin/policies' && method === 'POST') return { ok: true, name: 'baru' }
  if (path === '/api/admin/policies/attach') return { ok: true }
  if (path.startsWith('/api/admin/policies/') && method === 'GET') {
    return { name: decodeURIComponent(path.split('/').pop()!), doc: POLICY_DOC }
  }
  if (path.startsWith('/api/admin/policies/')) return { ok: true }
  if (path === '/api/admin/accesskeys' && method === 'GET') {
    return [
      { accessKey: 'SVCACCT01DEMO', parentUser: 'app-user', status: 'on', name: 'app-produksi', expiration: null },
      { accessKey: 'SVCACCT02DEMO', parentUser: 'app-user', status: 'on', name: 'staging', expiration: new Date(Date.now() + 30 * DAY).toISOString() },
    ]
  }
  if (path === '/api/admin/accesskeys' && method === 'POST') {
    return { ok: true, accessKey: 'DEMOKEY' + Math.floor(Math.random() * 1e6), secretKey: 'demo-secret-' + Math.floor(Math.random() * 1e9) }
  }
  if (path.startsWith('/api/admin/accesskeys/')) return { ok: true }

  // ---------- buckets & objects ----------
  if (path === '/api/buckets' && method === 'GET') return BUCKETS
  if (path === '/api/buckets' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return { ok: true, name: body?.name || 'demo', quotaWarning: '' }
  }

  const bucketMatch = path.match(/^\/api\/buckets\/([^/]+)(?:\/(.*))?$/)
  if (bucketMatch) {
    const sub = bucketMatch[2] || ''
    const q = getQuery(event)

    if (!sub && method === 'DELETE') return { ok: true }
    if (sub === 'objects' && method === 'GET') return listing(String(q.prefix || ''))
    if (sub === 'objects' && method === 'DELETE') {
      const body = await readBody(event).catch(() => ({}))
      return { ok: true, deleted: body?.keys?.length || 0 }
    }
    if (sub === 'stat') {
      const name = decodeURIComponent(bucketMatch[1]!)
      return {
        name,
        creationDate: BUCKETS.find((b) => b.name === name)?.creationDate || BUCKETS[0]!.creationDate,
        access: name === 'foto-kegiatan' ? 'download' : 'private',
        versioning: name === 'backup-server',
        size: 12.6 * 1024 ** 3,
        objects: 4821,
      }
    }
    if (sub === 'presign') return { url: presignUrl(String(q.key || '')), expiry: Number(q.expiry) || 3600 }
    if (sub === 'presign-batch') {
      const body = await readBody(event).catch(() => ({}))
      const urls: Record<string, string> = {}
      for (const k of body?.keys || []) urls[k] = presignUrl(k)
      return { urls }
    }
    if (sub === 'upload') return { ok: true, uploaded: ['demo-upload.bin'] }
    if (sub === 'folder' || sub === 'versioning' || sub === 'access') return { ok: true }
  }
})
