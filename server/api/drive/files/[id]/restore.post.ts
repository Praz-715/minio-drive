import { and, eq, inArray } from 'drizzle-orm'
import { files } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()

  const { file } = await requireFileAccess(session.user.id, id, 'owner')
  if (!file.deletedAt) throw createError({ statusCode: 400, message: 'File tidak ada di sampah' })

  // kalau folder induknya ikut terhapus, pulihkan ke root biar tidak "yatim"
  let parentId = file.parentId
  if (parentId) {
    const [p] = await db.select().from(files).where(eq(files.id, parentId)).limit(1)
    if (!p || p.deletedAt) parentId = null
  }

  const now = new Date()

  // folder → pulihkan seluruh subtree yang dibuang dalam batch YANG SAMA
  // (deletedAt == timestamp folder). Item yang di-trash terpisah tetap di sampah.
  if (file.isFolder) {
    const T = file.deletedAt
    const ids: string[] = [id]
    let frontier = [id]
    for (let depth = 0; depth < 64 && frontier.length; depth++) {
      const kids = await db.select({ id: files.id, isFolder: files.isFolder }).from(files).where(inArray(files.parentId, frontier))
      if (!kids.length) break
      ids.push(...kids.map((k) => k.id))
      frontier = kids.filter((k) => k.isFolder).map((k) => k.id)
    }
    await db
      .update(files)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(inArray(files.id, ids), eq(files.deletedAt, T)))
  }

  // top item: pastikan aktif + reparent (juga meng-handle kasus file tunggal)
  await db.update(files).set({ deletedAt: null, parentId, updatedAt: now }).where(eq(files.id, id))
  return { ok: true }
})
