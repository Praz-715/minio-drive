export function fmtBytes(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function fmtDate(d?: string | Date | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Waktu relatif ringkas: "baru saja", "5 mnt lalu", "2 jam lalu", "3 hari lalu". */
export function fmtAgo(d?: string | Date | null): string {
  if (!d) return 'belum pernah'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'baru saja'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const day = Math.floor(h / 24)
  if (day < 30) return `${day} hari lalu`
  return fmtDate(date)
}

export function fmtUptime(seconds?: number | null): string {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}h ${h}j`
  if (h > 0) return `${h}j ${m}m`
  return `${m}m`
}

export function randomSecret(len = 24): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (v) => chars[v % chars.length]).join('')
}

export function apiError(e: any): string {
  return e?.data?.message || e?.statusMessage || e?.message || 'Terjadi kesalahan'
}

/** Label izin share/akses yang manusiawi. */
export function permLabel(p?: string | null): string {
  if (p === 'editor') return 'bisa edit'
  if (p === 'viewer') return 'lihat saja'
  return p || '—'
}

/** Kelas badge untuk izin: editor menonjol (hijau), viewer redup. */
export function permBadgeClass(p?: string | null): string {
  return p === 'editor' ? 'badge-ok' : 'badge-dim'
}

const CHIP_MAP: [RegExp, string, string][] = [
  [/\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/i, 'IMG', 'text-ok border-ok/30'],
  [/\.(mp4|mkv|webm|mov|avi)$/i, 'VID', 'text-glow border-glow/30'],
  [/\.(mp3|wav|flac|ogg|m4a)$/i, 'AUD', 'text-glow border-glow/30'],
  [/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i, 'ZIP', 'text-glow border-glow/30'],
  [/\.pdf$/i, 'PDF', 'text-danger border-danger/30'],
  [/\.(docx?|xlsx?|pptx?|txt|md|csv)$/i, 'DOC', 'text-ink-200 border-ink-500'],
  [/\.(js|ts|jsx|tsx|vue|json|html|css|py|go|java|sh|yml|yaml|sql|php|rb)$/i, 'SRC', 'text-ok border-ok/30'],
]

export function fileChip(name: string, isFolder = false): { label: string; cls: string } {
  if (isFolder) return { label: 'DIR', cls: 'text-glow border-glow/30' }
  for (const [re, label, cls] of CHIP_MAP) if (re.test(name)) return { label, cls }
  return { label: 'FILE', cls: 'text-ink-400 border-ink-600' }
}

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text'

export function previewKind(name: string): PreviewKind | null {
  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(name)) return 'image'
  if (/\.(mp4|webm|m4v|mov|ogv)$/i.test(name)) return 'video'
  if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name)) return 'audio'
  if (/\.pdf$/i.test(name)) return 'pdf'
  if (/\.(txt|md|json|jsonl|js|ts|jsx|tsx|vue|css|html|xml|ya?ml|csv|log|sh|py|go|java|sql|php|rb|ini|conf|env|toml)$/i.test(name))
    return 'text'
  return null
}
