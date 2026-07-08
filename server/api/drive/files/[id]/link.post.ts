import { eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/**
 * Buat / ganti link publik file (owner only). Satu link aktif per file:
 * yang lama diganti. Body: { expiryDays?: number|null, password?: string }.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  const { file } = await requireFileAccess(session.user.id, id, 'owner')
  if (file.isFolder || !file.objectKey) {
    throw createError({ statusCode: 400, message: 'Link publik hanya untuk file, bukan folder' })
  }

  const body = await readBody(event)
  const rawDays = body?.expiryDays
  const expiryDays = rawDays == null || rawDays === '' ? null : Number(rawDays)
  if (expiryDays != null && (!Number.isFinite(expiryDays) || expiryDays < 0)) {
    throw createError({ statusCode: 400, message: 'Masa berlaku tidak valid' })
  }
  const password = typeof body?.password === 'string' ? body.password.trim() : ''

  const db = useDriveDb()
  // satu link per file — buang yang lama dulu
  await db.delete(shareLinks).where(eq(shareLinks.fileId, id))

  const token = genToken(10)
  const expiresAt = expiryDays && expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400_000) : null
  const passwordHash = password ? await hashLinkPassword(password) : null

  await db.insert(shareLinks).values({
    fileId: id,
    token,
    permission: 'viewer',
    password: passwordHash,
    expiresAt,
    createdById: session.user.id,
  })

  const origin = getRequestURL(event).origin
  return {
    token,
    url: `${origin}/s/${token}`,
    expiresAt,
    hasPassword: !!passwordHash,
    downloads: 0,
    expired: false,
  }
})
