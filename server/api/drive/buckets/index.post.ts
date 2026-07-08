import { randomUUID } from 'node:crypto'
import { teamBuckets } from '../../../db/schema'

/** Buat bucket bersama baru (MinIO bucket asli + hard quota). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveAdmin(event)
  const body = await readBody(event)

  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, message: 'Nama bucket wajib diisi' })
  const quotaGiB = Number(body?.quotaGiB) > 0 ? Number(body.quotaGiB) : 10
  const quota = Math.round(quotaGiB * 1024 ** 3)

  const bucket = `team-${randomUUID().slice(0, 8)}`
  try {
    await createBucketWithQuota(bucket, quota)
  } catch (e: any) {
    throw createError({ statusCode: 500, message: `Gagal membuat bucket MinIO: ${e?.message || e}` })
  }

  const db = useDriveDb()
  const [row] = await db
    .insert(teamBuckets)
    .values({ name, bucket, quota, createdById: session.user.id })
    .returning()

  return { ok: true, id: row!.id, bucket }
})
