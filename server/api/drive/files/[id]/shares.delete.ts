import { and, eq } from 'drizzle-orm'
import { fileShares } from '../../../../db/schema'

/** Cabut akses seorang user (owner only). Body: { userId }. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const userId = String(body?.userId || '')
  if (!userId) throw createError({ statusCode: 400, message: 'userId wajib diisi' })

  await requireFileAccess(session.user.id, id, 'owner')
  await useDriveDb()
    .delete(fileShares)
    .where(and(eq(fileShares.fileId, id), eq(fileShares.sharedWithId, userId)))
  return { ok: true }
})
