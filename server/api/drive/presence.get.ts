import { asc } from 'drizzle-orm'
import { user } from '../../db/schema'

/**
 * Presence semua user — KHUSUS super admin. Mengembalikan { id, online, lastSeenAt }
 * per user; `online` = pernah heartbeat dalam jendela ONLINE_WINDOW_MS terakhir.
 * Payload sengaja ramping (id + status) supaya aman di-poll sering.
 */
const ONLINE_WINDOW_MS = 100_000 // ≈ 2× interval heartbeat (45s) + slack

export default defineEventHandler(async (event) => {
  await requireDriveSuperAdmin(event)
  const db = useDriveDb()
  const rows = await db
    .select({ id: user.id, lastSeenAt: user.lastSeenAt, deletedAt: user.deletedAt })
    .from(user)
    .orderBy(asc(user.name))

  const now = Date.now()
  return rows.map((u) => ({
    id: u.id,
    lastSeenAt: u.lastSeenAt,
    online: !u.deletedAt && !!u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < ONLINE_WINDOW_MS,
  }))
})
