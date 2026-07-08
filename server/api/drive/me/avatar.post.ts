import { eq } from 'drizzle-orm'
import { user } from '../../../db/schema'

const MAX_AVATAR = 2 * 1024 * 1024

/** Upload foto profil sendiri (semua role). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = session.user.id

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.filename)
  if (!filePart) throw createError({ statusCode: 400, message: 'Tidak ada file' })
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(filePart.type || '')) {
    throw createError({ statusCode: 400, message: 'Format harus PNG/JPG/WebP/AVIF' })
  }
  if (filePart.data.length > MAX_AVATAR) throw createError({ statusCode: 400, message: 'Maksimal 2 MB' })

  const bucket = await ensureUserBucket(id)
  await driveMinio().putObject(bucket, 'avatar', filePart.data, filePart.data.length, {
    'Content-Type': filePart.type || 'image/png',
  })

  const image = `/api/drive/users/${id}/avatar?v=${Date.now()}`
  await useDriveDb().update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, id))
  return { ok: true, image }
})
