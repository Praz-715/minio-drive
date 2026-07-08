import { eq } from 'drizzle-orm'
import { user } from '../../../../db/schema'

const MAX_AVATAR = 2 * 1024 * 1024 // 2 MB

/** Upload foto profil → disimpan di bucket pribadi user sebagai objek `avatar`. */
export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.filename)
  if (!filePart) throw createError({ statusCode: 400, message: 'Tidak ada file' })
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(filePart.type || '')) {
    throw createError({ statusCode: 400, message: 'Format harus PNG/JPG/WebP/AVIF' })
  }
  if (filePart.data.length > MAX_AVATAR) {
    throw createError({ statusCode: 400, message: 'Maksimal 2 MB' })
  }

  const bucket = await ensureUserBucket(id)
  await driveMinio().putObject(bucket, 'avatar', filePart.data, filePart.data.length, {
    'Content-Type': filePart.type || 'image/png',
  })

  // simpan URL endpoint streaming (v= untuk cache-bust)
  const image = `/api/drive/users/${id}/avatar?v=${Date.now()}`
  const db = useDriveDb()
  await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, id))

  return { ok: true, image }
})
