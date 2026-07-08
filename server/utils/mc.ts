import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { H3Event } from 'h3'
import type { MinioCreds } from './creds'

/**
 * Operasi admin MinIO (users, policies, access keys) tidak tersedia di SDK
 * minio-js, jadi kita bungkus CLI `mc` dengan output --json (satu objek JSON
 * per baris). Alias `srv` didefinisikan per proses lewat env MC_HOST_srv
 * sehingga kredensial tidak pernah ditulis ke disk.
 */

let cachedBin: string | null = null

function mcBinary(): string {
  if (cachedBin) return cachedBin
  const config = useRuntimeConfig()
  if (config.mcPath) {
    cachedBin = config.mcPath as string
  } else {
    const local = join(process.cwd(), 'bin', process.platform === 'win32' ? 'mc.exe' : 'mc')
    cachedBin = existsSync(local) ? local : 'mc'
  }
  return cachedBin
}

export function mcWithCreds(creds: MinioCreds, args: string[]): Promise<any[]> {
  const config = useRuntimeConfig()
  const url = new URL(config.minioEndpoint)
  // JANGAN di-percent-encode: mc membaca userinfo MC_HOST secara literal
  // (split di '@' terakhir), encoding justru merusak kredensial ber-simbol
  const hostUrl = `${url.protocol}//${creds.accessKey}:${creds.secretKey}@${url.host}`

  return new Promise((resolve, reject) => {
    execFile(
      mcBinary(),
      [...args, '--json'],
      {
        env: {
          ...process.env,
          MC_HOST_srv: hostUrl,
          // di luar project dir supaya file watcher dev server tidak ke-trigger
          MC_CONFIG_DIR: join(tmpdir(), 'yasa-mc'),
        },
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const text = `${stdout || ''}\n${stderr || ''}`.trim()
        if (err && !text) {
          return reject(createError({ statusCode: 500, message: `mc gagal dijalankan: ${err.message}` }))
        }
        const lines = text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((l) => {
            try {
              return JSON.parse(l)
            } catch {
              return { raw: l }
            }
          })
        const errLine = lines.find((l) => l?.status === 'error')
        if (errLine) {
          // field error bisa berupa string ATAU objek, tergantung command & versi mc
          const msg =
            typeof errLine.error === 'string'
              ? errLine.error
              : errLine.error?.cause?.message || errLine.error?.message || 'mc error'
          return reject(createError({ statusCode: 400, message: msg, data: errLine.error }))
        }
        resolve(lines)
      },
    )
  })
}

export async function mc(event: H3Event, args: string[]): Promise<any[]> {
  const creds = await requireCreds(event)
  return mcWithCreds(creds, args)
}

/** Varian tanpa --json, untuk output non-JSON seperti `admin prometheus metrics`. */
export function mcRawWithCreds(creds: MinioCreds, args: string[]): Promise<string> {
  const config = useRuntimeConfig()
  const url = new URL(config.minioEndpoint)
  const hostUrl = `${url.protocol}//${creds.accessKey}:${creds.secretKey}@${url.host}`

  return new Promise((resolve, reject) => {
    execFile(
      mcBinary(),
      args,
      {
        env: {
          ...process.env,
          MC_HOST_srv: hostUrl,
          MC_CONFIG_DIR: join(tmpdir(), 'yasa-mc'),
        },
        timeout: 30_000,
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          return reject(
            createError({ statusCode: 400, message: (stderr || err.message || 'mc error').trim().slice(0, 300) }),
          )
        }
        resolve(stdout || '')
      },
    )
  })
}

export async function mcRaw(event: H3Event, args: string[]): Promise<string> {
  const creds = await requireCreds(event)
  return mcRawWithCreds(creds, args)
}

/** Parse baris Prometheus text: nama{label="x"} nilai — dijumlah per (nama, label yang diminta). */
export function parseProm(text: string, metric: string, groupLabel?: string): Record<string, number> {
  const out: Record<string, number> = {}
  const re = new RegExp(`^${metric}(?:\\{([^}]*)\\})?\\s+([0-9.eE+-]+)`, 'gm')
  for (const m of text.matchAll(re)) {
    let key = '_'
    if (groupLabel && m[1]) {
      const lm = m[1].match(new RegExp(`${groupLabel}="([^"]*)"`))
      if (!lm) continue
      key = lm[1]!
    }
    out[key] = (out[key] || 0) + Number(m[2])
  }
  return out
}
