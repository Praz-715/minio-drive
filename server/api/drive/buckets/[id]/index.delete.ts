import { eq, inArray } from 'drizzle-orm'
import { files, teamBuckets } from '../../../../db/schema'

/** Hapus bucket bersama: buang objek MinIO, baris files, bucket, lalu record. */
export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()

  const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, id)).limit(1)
  if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })

  const rows = await db.select().from(files).where(eq(files.teamBucketId, id))
  const client = driveMinio()
  for (const f of rows) {
    if (!f.isFolder && f.objectKey) await client.removeObject(tb.bucket, f.objectKey).catch(() => {})
  }
  if (rows.length) await db.delete(files).where(inArray(files.id, rows.map((r) => r.id)))
  await client.removeBucket(tb.bucket).catch(() => {})
  await db.delete(teamBuckets).where(eq(teamBuckets.id, id)) // members ikut cascade

  return { ok: true }
})
