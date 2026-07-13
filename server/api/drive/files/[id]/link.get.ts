import { desc, eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/** Ambil link publik file ini (owner only). null kalau belum ada. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  await requireFileAccess(session.user.id, id, 'owner')

  const db = useDriveDb()
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.fileId, id))
    .orderBy(desc(shareLinks.createdAt))
    .limit(1)

  if (!link) return { link: null }

  const origin = getRequestURL(event).origin
  return {
    link: {
      token: link.token,
      url: `${origin}/s/${link.token}`,
      permission: link.permission,
      expiresAt: link.expiresAt,
      hasPassword: !!link.password,
      downloads: link.downloads,
      expired: isExpired(link.expiresAt),
    },
  }
})
