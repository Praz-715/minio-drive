import { Client } from 'minio'
import type { H3Event } from 'h3'
import type { MinioCreds } from './creds'

export function minioClientFor(creds: MinioCreds): Client {
  const config = useRuntimeConfig()
  const url = new URL(config.minioEndpoint)
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
