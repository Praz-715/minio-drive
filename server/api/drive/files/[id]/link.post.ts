import { eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/**
 * Buat / ganti link publik file ATAU folder (owner only). Satu link aktif per
 * item: yang lama diganti. Body: { expiryDays?, password?, permission? }.
 * - Anonim (tanpa login): SELALU read-only (browse/preview/download), berapa pun
 *   permission link-nya — mengedit butuh akun.
 * - Sudah login: saat buka link, auto-claim memberi permission link (viewer/editor)
 *   ke akunnya → muncul di "Dibagikan ke saya".
 * permission 'editor' hanya bermakna untuk item PRIBADI (item tim lewat keanggotaan).
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  const { file } = await requireFileAccess(session.user.id, id, 'owner')
  if (file.deletedAt) throw createError({ statusCode: 400, message: 'Item ada di sampah' })
  if (!file.isFolder && !file.objectKey) {
    throw createError({ statusCode: 400, message: 'File belum siap dibagikan' })
  }

  const body = await readBody(event)
  const rawDays = body?.expiryDays
  const expiryDays = rawDays == null || rawDays === '' ? null : Number(rawDays)
  if (expiryDays != null && (!Number.isFinite(expiryDays) || expiryDays < 0)) {
    throw createError({ statusCode: 400, message: 'Masa berlaku tidak valid' })
  }
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  // editor hanya relevan untuk item pribadi (tim: akses lewat keanggotaan)
  const permission = body?.permission === 'editor' && !file.teamBucketId ? 'editor' : 'viewer'

  const db = useDriveDb()
  // satu link per file — buang yang lama dulu
  await db.delete(shareLinks).where(eq(shareLinks.fileId, id))

  const token = genToken(10)
  const expiresAt = expiryDays && expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400_000) : null
  const passwordHash = password ? await hashLinkPassword(password) : null

  await db.insert(shareLinks).values({
    fileId: id,
    token,
    permission,
    password: passwordHash,
    expiresAt,
    createdById: session.user.id,
  })

  const origin = getRequestURL(event).origin
  return {
    token,
    url: `${origin}/s/${token}`,
    permission,
    expiresAt,
    hasPassword: !!passwordHash,
    downloads: 0,
    expired: false,
  }
})
