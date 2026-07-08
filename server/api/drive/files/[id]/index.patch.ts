import { eq } from 'drizzle-orm'
import { files } from '../../../../db/schema'

/** Rename (owner/editor), move & star (owner). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const db = useDriveDb()

  const patch: Record<string, any> = { updatedAt: new Date() }

  if (body?.name !== undefined) {
    await requireFileAccess(me, id, 'editor')
    const name = String(body.name).trim().replace(/[/\\]/g, '-')
    if (!name) throw createError({ statusCode: 400, message: 'Nama tidak boleh kosong' })
    patch.name = name
  }

  if (body?.starred !== undefined) {
    await requireFileAccess(me, id, 'owner')
    patch.starred = Boolean(body.starred)
  }

  // Pindah TIDAK boleh lewat PATCH: butuh handle objek MinIO lintas-bucket +
  // teamBucketId + kuota. Semua pindah wajib lewat POST /files/[id]/move.
  if (body?.parentId !== undefined) {
    throw createError({ statusCode: 400, message: 'Gunakan endpoint /move untuk memindahkan item' })
  }

  await db.update(files).set(patch).where(eq(files.id, id))
  return { ok: true }
})
