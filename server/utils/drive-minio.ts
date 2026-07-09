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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Set hard-quota bucket via mc (MiB integer biar formatnya selalu valid). */
export async function setBucketQuota(bucket: string, bytes: number) {
  const mib = Math.max(1, Math.round(bytes / 1024 ** 2))
  await driveMc(['quota', 'set', `srv/${bucket}`, '--size', `${mib}MiB`])
}

/**
 * Set quota dengan retry: MinIO kadang belum "register" bucket yang BARU dibuat,
 * jadi `mc quota set` bisa gagal di percobaan pertama (race) lalu sukses setelahnya.
 */
async function setBucketQuotaRetry(bucket: string, bytes: number, tries = 3) {
  let lastErr: any
  for (let i = 1; i <= tries; i++) {
    try {
      await setBucketQuota(bucket, bytes)
      return
    } catch (e) {
      lastErr = e
      if (i < tries) await sleep(400 * i)
    }
  }
  throw lastErr
}

/** Buat bucket MinIO baru + pasang hard quota (untuk bucket bersama). */
export async function createBucketWithQuota(bucket: string, bytes: number) {
  const client = driveMinio()
  if (!(await client.bucketExists(bucket))) {
    await client.makeBucket(bucket)
  }
  await setBucketQuotaRetry(bucket, bytes)
}

/**
 * Pastikan user punya bucket pribadi (drive-{id}); buat + pasang quota kalau belum.
 * Mengembalikan nama bucket.
 *
 * Catatan robustness: bucket dicatat ke DB DULU (sebelum quota) supaya operasi
 * tulis PERTAMA user tidak gagal gara-gara langkah quota yang racy/transient
 * pada bucket yang baru dibuat. Quota di-set dengan retry, dan kalau tetap gagal
 * dibiarkan NON-FATAL (kuota level-DB `storageUsed` tetap menjaga upload pribadi).
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
  await db.update(user).set({ bucket, updatedAt: new Date() }).where(eq(user.id, userId))
  try {
    await setBucketQuotaRetry(bucket, u.storageQuota)
  } catch (e: any) {
    console.warn(`[yasa] gagal set hard-quota "${bucket}" (non-fatal): ${e?.message || e}`)
  }
  return bucket
}
