import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { files, user } from '../../../../db/schema'

/**
 * ?permanent=0 → pindah ke sampah (soft delete, owner only)
 * ?permanent=1 → hapus permanen (objek MinIO ikut dihapus, rekursif untuk folder)
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const permanent = String(getQuery(event).permanent || '') === '1'
  const db = useDriveDb()

  const { file } = await requireFileAccess(me, id, 'owner')

  if (!permanent) {
    // Soft-delete REKURSIF: stamp deletedAt ke seluruh subtree yang masih aktif,
    // dengan timestamp SAMA (jadi penanda batch untuk restore selektif).
    const now = new Date()
    const ids: string[] = [id]
    let frontier = [id]
    for (let depth = 0; depth < 64 && frontier.length; depth++) {
      const kids = await db
        .select({ id: files.id, isFolder: files.isFolder })
        .from(files)
        .where(and(inArray(files.parentId, frontier), isNull(files.deletedAt)))
      if (!kids.length) break
      ids.push(...kids.map((k) => k.id))
      frontier = kids.filter((k) => k.isFolder).map((k) => k.id)
    }
    await db.update(files).set({ deletedAt: now, updatedAt: now }).where(inArray(files.id, ids))
    return { ok: true, trashed: true }
  }

  // kumpulkan seluruh turunan (BFS)
  const all: any[] = [file]
  let frontier = [file.id]
  for (let depth = 0; depth < 32 && frontier.length; depth++) {
    const children = await db.select().from(files).where(inArray(files.parentId, frontier))
    all.push(...children)
    frontier = children.filter((c) => c.isFolder).map((c) => c.id)
  }

  // hapus objek MinIO + kembalikan kuota (hanya file pribadi yang punya counter DB)
  const client = driveMinio()
  const freed: Record<string, number> = {}
  for (const f of all) {
    if (f.isFolder || !f.objectKey) continue
    const bucket = await bucketForFile(f)
    if (bucket) await client.removeObject(bucket, f.objectKey).catch(() => {})
    if (!f.teamBucketId) freed[f.ownerId] = (freed[f.ownerId] || 0) + f.size
  }

  await db.delete(files).where(inArray(files.id, all.map((f) => f.id)))
  for (const [ownerId, bytes] of Object.entries(freed)) {
    await db
      .update(user)
      .set({ storageUsed: sql`GREATEST(${user.storageUsed} - ${bytes}, 0)`, updatedAt: new Date() })
      .where(eq(user.id, ownerId))
  }

  return { ok: true, deleted: all.length }
})
