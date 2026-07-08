import { eq } from 'drizzle-orm'
import { user } from '../../db/schema'

/** Info akun sendiri + pemakaian storage terkini (buat sidebar). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const db = useDriveDb()
  const [u] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      storageQuota: user.storageQuota,
      storageUsed: user.storageUsed,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  return u
})
