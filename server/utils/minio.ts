import { Client } from 'minio'
import type { H3Event } from 'h3'
import type { MinioCreds } from './creds'

/**
 * Endpoint MinIO dari config, dinormalisasi & divalidasi. Kalau nilainya tanpa
 * skema (mis. "s3.contoh.com") dianggap https:// — supaya salah tulis di .env
 * tidak bikin `new URL()` lempar error yang membingungkan.
 */
export function minioEndpointUrl(): URL {
  const raw = String(useRuntimeConfig().minioEndpoint || '').trim()
  if (!raw) {
    throw createError({ statusCode: 500, message: 'NUXT_MINIO_ENDPOINT belum di-set di .env' })
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(withScheme)
  } catch {
    throw createError({
      statusCode: 500,
      message: `NUXT_MINIO_ENDPOINT tidak valid: "${raw}" (contoh benar: https://s3.contoh.com atau http://localhost:9000)`,
    })
  }
}

export function minioClientFor(creds: MinioCreds): Client {
  const url = minioEndpointUrl()
  return new Client({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    useSSL: url.protocol === 'https:',
    accessKey: creds.accessKey,
    secretKey: creds.secretKey,
  })
}

export async function getMinio(event: H3Event): Promise<Client> {
  const creds = await requireCreds(event)
  return minioClientFor(creds)
}

/** Ubah error S3 (minio-js) jadi H3 error yang enak dibaca UI */
export function s3Error(e: any) {
  const code = e?.code || 'S3Error'
  const map: Record<string, number> = {
    AccessDenied: 403,
    NoSuchBucket: 404,
    NoSuchKey: 404,
    InvalidAccessKeyId: 401,
    SignatureDoesNotMatch: 401,
    BucketNotEmpty: 409,
    BucketAlreadyOwnedByYou: 409,
    BucketAlreadyExists: 409,
  }
  return createError({
    statusCode: map[code] || 500,
    message: e?.message ? `${code}: ${e.message}` : code,
  })
}
