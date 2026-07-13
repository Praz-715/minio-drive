import { eq } from 'drizzle-orm'
import { files, shareLinks, user } from '../../db/schema'

/**
 * Metadata link publik — TANPA sesi. Tidak membocorkan bucket/objectKey/URL.
 * Selalu 200; pakai flag `found`/`expired` biar halaman gampang handle.
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const db = useDriveDb()

  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
  if (!link) return { found: false }

  const [file] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!file || file.deletedAt) return { found: false }

  // link mati kalau pemilik file dinonaktifkan
  const [owner] = await db.select({ deletedAt: user.deletedAt }).from(user).where(eq(user.id, file.ownerId)).limit(1)
  if (!owner || owner.deletedAt) return { found: false }

  if (isExpired(link.expiresAt)) return { found: true, expired: true, name: file.name, isFolder: file.isFolder }

  // folder: cukup nama + flag (isi dijelajah lewat /browse). file: metadata preview.
  if (file.isFolder) {
    return { found: true, expired: false, isFolder: true, name: file.name, hasPassword: !!link.password }
  }

  return {
    found: true,
    expired: false,
    isFolder: false,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    hasPassword: !!link.password,
    downloads: link.downloads,
  }
})
