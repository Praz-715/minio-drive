import { eq } from 'drizzle-orm'
import { user } from '../../db/schema'

/**
 * Denyut presence: catat waktu aktif terakhir user. Dipanggil layout Drive
 * secara berkala (saat tab terlihat). Dipakai fitur "siapa online" super admin.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const db = useDriveDb()
  await db.update(user).set({ lastSeenAt: new Date() }).where(eq(user.id, session.user.id))
  return { ok: true }
})
