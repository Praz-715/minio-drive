import { and, eq, isNull } from 'drizzle-orm'
import { fileShares, user } from '../../../../db/schema'

/** Bagikan file/folder ke user lain via email (owner only). Upsert permission. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const email = String(body?.email || '').trim().toLowerCase()
  const permission = body?.permission === 'editor' ? 'editor' : 'viewer'
  if (!email) throw createError({ statusCode: 400, message: 'Email wajib diisi' })

  await requireFileAccess(me, id, 'owner')

  const db = useDriveDb()
  const [target] = await db
    .select()
    .from(user)
    .where(and(eq(user.email, email), isNull(user.deletedAt)))
    .limit(1)
  if (!target) throw createError({ statusCode: 404, message: `User ${email} tidak ditemukan / nonaktif` })
  if (target.id === me) throw createError({ statusCode: 400, message: 'Tidak perlu share ke diri sendiri' })

  const [existing] = await db
    .select()
    .from(fileShares)
    .where(and(eq(fileShares.fileId, id), eq(fileShares.sharedWithId, target.id)))
    .limit(1)

  if (existing) {
    await db.update(fileShares).set({ permission }).where(eq(fileShares.id, existing.id))
  } else {
    await db.insert(fileShares).values({ fileId: id, sharedWithId: target.id, sharedById: me, permission })
  }
  return { ok: true, name: target.name }
})
