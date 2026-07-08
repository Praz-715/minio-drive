import { eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/** Cabut (hapus) semua link publik file ini (owner only). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  await requireFileAccess(session.user.id, id, 'owner')

  const db = useDriveDb()
  await db.delete(shareLinks).where(eq(shareLinks.fileId, id))
  return { ok: true }
})
