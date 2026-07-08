import { eq, sql } from 'drizzle-orm'
import { files, shareLinks, user } from '../../../db/schema'

const EXPIRY = 3600 // presigned URL berlaku 1 jam sejak diminta

/**
 * Tukar token (+ password bila ada) jadi presigned URL. TANPA sesi.
 * download=true → disposition attachment + tambah hitungan unduh.
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const body = await readBody(event)
  const download = !!body?.download
  const password = typeof body?.password === 'string' ? body.password : ''

  const db = useDriveDb()
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'Link tidak ditemukan' })
  if (isExpired(link.expiresAt)) throw createError({ statusCode: 410, message: 'Link sudah kedaluwarsa' })

  const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!file || file.deletedAt || file.isFolder || !file.objectKey) {
    throw createError({ statusCode: 404, message: 'File tidak tersedia' })
  }

  // link mati kalau pemilik file dinonaktifkan
  const [owner] = await db.select({ deletedAt: user.deletedAt }).from(user).where(eq(user.id, file.ownerId)).limit(1)
  if (!owner || owner.deletedAt) throw createError({ statusCode: 404, message: 'File tidak tersedia' })

  if (link.password) {
    if (tooManyLinkAttempts(token)) {
      throw createError({ statusCode: 429, message: 'Terlalu banyak percobaan — coba lagi beberapa menit lagi' })
    }
    if (!password) throw createError({ statusCode: 401, message: 'Butuh password' })
    if (!(await verifyLinkPassword(password, link.password))) {
      recordLinkFail(token)
      throw createError({ statusCode: 401, message: 'Password salah' })
    }
  }

  const bucket = await bucketForFile(file)
  if (!bucket) throw createError({ statusCode: 500, message: 'Bucket tidak ditemukan' })

  const url = await driveMinio().presignedGetObject(bucket, file.objectKey, EXPIRY, {
    'response-content-disposition': download ? `attachment; filename="${file.name}"` : 'inline',
    'response-content-type': file.mimeType || 'application/octet-stream',
  })

  if (download) {
    await db
      .update(shareLinks)
      .set({ downloads: sql`${shareLinks.downloads} + 1` })
      .where(eq(shareLinks.id, link.id))
  }

  return { url, name: file.name, mimeType: file.mimeType, size: file.size }
})
