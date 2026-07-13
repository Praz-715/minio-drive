import { eq, sql } from 'drizzle-orm'
import { files, shareLinks, user } from '../../../db/schema'

const EXPIRY = 3600 // presigned URL berlaku 1 jam sejak diminta

/**
 * Tukar token (+ password bila ada) jadi presigned URL. TANPA sesi.
 * download=true → disposition attachment + tambah hitungan unduh.
 * Untuk link FOLDER, wajib kirim body.fileId dan server memastikan file itu
 * benar-benar berada di dalam folder yang dibagikan.
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

  const [root] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!root || root.deletedAt) throw createError({ statusCode: 404, message: 'Tidak tersedia' })

  // link mati kalau pemilik (pembagi) dinonaktifkan
  const [owner] = await db.select({ deletedAt: user.deletedAt }).from(user).where(eq(user.id, root.ownerId)).limit(1)
  if (!owner || owner.deletedAt) throw createError({ statusCode: 404, message: 'Tidak tersedia' })

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

  // tentukan file target: link file → root itu sendiri; link folder → body.fileId
  // yang terbukti berada di dalam folder yang dibagikan.
  let file = root
  if (root.isFolder) {
    const fileId = String(body?.fileId || '')
    if (!fileId) throw createError({ statusCode: 400, message: 'fileId wajib untuk link folder' })
    if (!(await isWithinFolder(fileId, root.id))) {
      throw createError({ statusCode: 403, message: 'File ini di luar folder yang dibagikan' })
    }
    const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)
    if (!f || f.deletedAt || f.isFolder) throw createError({ statusCode: 404, message: 'File tidak tersedia' })
    file = f
  }
  const objectKey = file.objectKey
  if (!objectKey) throw createError({ statusCode: 404, message: 'File tidak tersedia' })

  const bucket = await bucketForFile(file)
  if (!bucket) throw createError({ statusCode: 500, message: 'Bucket tidak ditemukan' })

  const url = await driveMinio().presignedGetObject(bucket, objectKey, EXPIRY, {
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
