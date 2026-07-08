import { eq } from 'drizzle-orm'
import type { Client } from 'minio'
import { user } from '../db/schema'
import type { MinioCreds } from './creds'

/**
 * Akses MinIO untuk backend Drive memakai SATU service account dari .env
 * (bukan kredensial per-sesi seperti console). Semua otorisasi end-user
 * dilakukan di level aplikasi.
 */

export function driveCreds(): MinioCreds {
  const config = useRuntimeConfig()
  if (!config.driveMinioAccessKey || !config.driveMinioSecretKey) {
    throw createError({
      statusCode: 500,
      message: 'NUXT_DRIVE_MINIO_ACCESS_KEY / SECRET_KEY belum di-set di .env',
    })
  }
  return { accessKey: config.driveMinioAccessKey, secretKey: config.driveMinioSecretKey }
}

export function driveMinio(): Client {
  return minioClientFor(driveCreds())
}

export function driveMc(args: string[]) {
  return mcWithCreds(driveCreds(), args)
}

/** Set hard-quota bucket via mc (MiB integer biar formatnya selalu valid). */
export async function setBucketQuota(bucket: string, bytes: number) {
  const mib = Math.max(1, Math.round(bytes / 1024 ** 2))
  await driveMc(['quota', 'set', `srv/${bucket}`, '--size', `${mib}MiB`])
}

/** Buat bucket MinIO baru + pasang hard quota (untuk bucket bersama). */
export async function createBucketWithQuota(bucket: string, bytes: number) {
  const client = driveMinio()
  if (!(await client.bucketExists(bucket))) {
    await client.makeBucket(bucket)
  }
  await setBucketQuota(bucket, bytes)
}

/**
 * Pastikan user punya bucket pribadi (drive-{id}); buat + pasang quota kalau belum.
 * Mengembalikan nama bucket.
 */
export async function ensureUserBucket(userId: string): Promise<string> {
  const db = useDriveDb()
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!u) throw createError({ statusCode: 404, message: 'User tidak ditemukan' })
  if (u.bucket) return u.bucket

  const bucket = `drive-${userId.toLowerCase()}`
  const client = driveMinio()
  if (!(await client.bucketExists(bucket))) {
    await client.makeBucket(bucket)
  }
  await setBucketQuota(bucket, u.storageQuota)
  await db.update(user).set({ bucket, updatedAt: new Date() }).where(eq(user.id, userId))
  return bucket
}
