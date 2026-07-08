import { eq } from 'drizzle-orm'
import { fileShares, user } from '../../../../db/schema'

/** Daftar siapa saja yang punya akses ke file ini (owner only). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  await requireFileAccess(session.user.id, id, 'owner')

  const db = useDriveDb()
  const rows = await db
    .select({
      id: fileShares.id,
      permission: fileShares.permission,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(fileShares)
    .innerJoin(user, eq(fileShares.sharedWithId, user.id))
    .where(eq(fileShares.fileId, id))
  return rows
})
