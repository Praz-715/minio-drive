import { eq } from 'drizzle-orm'
import { teamBuckets } from '../../../../db/schema'

/** Ubah nama / quota bucket bersama. */
export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const db = useDriveDb()

  const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, id)).limit(1)
  if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })

  const patch: Record<string, any> = { updatedAt: new Date() }
  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw createError({ statusCode: 400, message: 'Nama tidak boleh kosong' })
    patch.name = name
  }
  let quotaWarning = ''
  if (body?.quotaGiB !== undefined) {
    const quotaGiB = Number(body.quotaGiB)
    if (!(quotaGiB > 0)) throw createError({ statusCode: 400, message: 'Quota harus lebih dari 0' })
    patch.quota = Math.round(quotaGiB * 1024 ** 3)
    try {
      await setBucketQuota(tb.bucket, patch.quota)
    } catch (e: any) {
      quotaWarning = `Data tersimpan, tapi quota MinIO gagal diupdate: ${e?.message || e}`
    }
  }

  await db.update(teamBuckets).set(patch).where(eq(teamBuckets.id, id))
  return { ok: true, quotaWarning }
})
