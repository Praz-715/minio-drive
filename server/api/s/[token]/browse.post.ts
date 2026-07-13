import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { files, shareLinks, user } from '../../../db/schema'

const MAX_DEPTH = 32

/**
 * Jelajahi isi folder yang dibagikan lewat link publik. TANPA sesi.
 * Body: { password?, folder? } — `folder` = id subfolder yang mau dibuka
 * (kosong = root folder yang dibagikan). Server memverifikasi `folder`
 * benar-benar berada di dalam folder yang dibagikan (anti tebak-id).
 * Hanya mengembalikan metadata yang aman (tanpa objectKey/bucket/email pemilik).
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const body = await readBody(event)
  const password = typeof body?.password === 'string' ? body.password : ''
  const wantFolder = String(body?.folder || '')

  const db = useDriveDb()
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'Link tidak ditemukan' })
  if (isExpired(link.expiresAt)) throw createError({ statusCode: 410, message: 'Link sudah kedaluwarsa' })

  const [root] = await db.select().from(files).where(eq(files.id, link.fileId)).limit(1)
  if (!root || root.deletedAt || !root.isFolder) {
    throw createError({ statusCode: 404, message: 'Folder tidak tersedia' })
  }

  // link mati kalau pemilik folder dinonaktifkan
  const [owner] = await db.select({ deletedAt: user.deletedAt }).from(user).where(eq(user.id, root.ownerId)).limit(1)
  if (!owner || owner.deletedAt) throw createError({ statusCode: 404, message: 'Folder tidak tersedia' })

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

  // folder yang mau dibuka: root, atau subfolder yang terbukti ada di dalam root
  let target = root
  if (wantFolder && wantFolder !== root.id) {
    if (!(await isWithinFolder(wantFolder, root.id))) {
      throw createError({ statusCode: 403, message: 'Folder ini di luar folder yang dibagikan' })
    }
    const [f] = await db.select().from(files).where(eq(files.id, wantFolder)).limit(1)
    if (!f || f.deletedAt || !f.isFolder) throw createError({ statusCode: 404, message: 'Folder tidak ditemukan' })
    target = f
  }

  // isi folder (file + subfolder aktif), folder dulu lalu nama
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.parentId, target.id), isNull(files.deletedAt)))
    .orderBy(desc(files.isFolder), asc(files.name))

  // breadcrumb DIBATASI di root — jangan bocorkan folder leluhur di atasnya
  const crumbs: { id: string; name: string }[] = []
  let cur: any = target
  for (let i = 0; i < MAX_DEPTH; i++) {
    crumbs.unshift({ id: cur.id, name: cur.name })
    if (cur.id === root.id || !cur.parentId) break
    const [p] = await db.select().from(files).where(eq(files.id, cur.parentId)).limit(1)
    if (!p) break
    cur = p
  }

  return {
    root: { id: root.id, name: root.name },
    folder: { id: target.id, name: target.name },
    crumbs,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      isFolder: r.isFolder,
      size: r.size,
      mimeType: r.mimeType,
      updatedAt: r.updatedAt,
    })),
  }
})
