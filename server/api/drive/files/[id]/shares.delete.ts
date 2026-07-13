import { and, eq } from 'drizzle-orm'
import { fileShares } from '../../../../db/schema'

/**
 * Hapus share:
 *  - Owner mencabut akses user lain → body { userId } (butuh akses owner).
 *  - Penerima MELEPASKAN akses-nya sendiri → tanpa userId (atau userId = diri
 *    sendiri); tidak perlu jadi owner, cukup hapus baris share miliknya.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event).catch(() => ({}))
  const userId = String(body?.userId || '')
  const db = useDriveDb()

  // self-leave: lepaskan akses sendiri
  if (!userId || userId === me) {
    await db.delete(fileShares).where(and(eq(fileShares.fileId, id), eq(fileShares.sharedWithId, me)))
    return { ok: true, left: true }
  }

  // owner mencabut akses user lain
  await requireFileAccess(me, id, 'owner')
  await db.delete(fileShares).where(and(eq(fileShares.fileId, id), eq(fileShares.sharedWithId, userId)))
  return { ok: true }
})
