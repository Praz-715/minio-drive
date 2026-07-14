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

  // Kumpulkan SELURUH turunan lewat recursive CTE — TANPA batas kedalaman.
  // Penting: files.parentId ON DELETE CASCADE menghapus semua baris turunan di DB,
  // jadi objek MinIO & kuota WAJIB diproses untuk seluruh subtree; kalau cuma
  // sebagian (mis. dibatasi 32 level), baris lebih dalam kehapus tapi objeknya
  // nyangkut selamanya + storageUsed melenceng permanen.
  const res: any = await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id, owner_id, team_bucket_id, object_key, is_folder, size
      FROM files WHERE id = ${id}
      UNION ALL
      SELECT f.id, f.owner_id, f.team_bucket_id, f.object_key, f.is_folder, f.size
      FROM files f JOIN subtree s ON f.parent_id = s.id
    )
    SELECT id, owner_id AS "ownerId", team_bucket_id AS "teamBucketId",
           object_key AS "objectKey", is_folder AS "isFolder", size
    FROM subtree
  `)
  const all: any[] = Array.isArray(res) ? res : res.rows || []

  // hapus objek MinIO + kembalikan kuota (hanya file pribadi yang punya counter DB)
  const client = driveMinio()
  const freed: Record<string, number> = {}
  for (const f of all) {
    if (f.isFolder || !f.objectKey) continue
    const bucket = await bucketForFile(f)
    if (bucket) await client.removeObject(bucket, f.objectKey).catch(() => {})
    // size dari db.execute bisa berupa string (bigint) → koersi ke number
    if (!f.teamBucketId) freed[f.ownerId] = (freed[f.ownerId] || 0) + (Number(f.size) || 0)
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
