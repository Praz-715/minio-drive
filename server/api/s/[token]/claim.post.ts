import { and, eq } from 'drizzle-orm'
import { fileShares, files, shareLinks, user } from '../../../db/schema'

/**
 * "Klaim" akses lewat link publik. Kalau pengunjung SUDAH login (punya sesi Drive),
 * item yang dibagikan otomatis ditambahkan ke "Dibagikan ke saya" mereka (baris
 * fileShares, idempoten) — jadi mereka bisa membukanya dari Drive sendiri tanpa
 * menyimpan link mentah. Pengunjung anonim → tidak melakukan apa-apa.
 *
 * Batasan model: hanya untuk item PRIBADI. Item di bucket bersama (tim) aksesnya
 * lewat keanggotaan tim, bukan fileShares — jadi tidak di-klaim.
 */
export default defineEventHandler(async (event) => {
  // sesi opsional — kalau tidak login, diam-diam lewati (bukan error)
  const session = await useServerAuth()
    .api.getSession({ headers: event.headers })
    .catch(() => null)
  const me = (session?.user as any)?.id as string | undefined
  if (!me) return { claimed: false, reason: 'anon' }

  const token = getRouterParam(event, 'token')!
  const body = await readBody(event).catch(() => ({}))
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

  // link berpassword: klaim hanya kalau password benar (samakan dengan gerbang di UI)
  if (link.password) {
    if (tooManyLinkAttempts(token)) {
      throw createError({ statusCode: 429, message: 'Terlalu banyak percobaan — coba lagi beberapa menit lagi' })
    }
    if (!password || !(await verifyLinkPassword(password, link.password))) {
      recordLinkFail(token)
      throw createError({ statusCode: 401, message: 'Password salah' })
    }
  }

  // pemilik sendiri → tidak perlu share ke diri sendiri
  if (root.ownerId === me) return { claimed: false, reason: 'owner', fileId: root.id, isFolder: root.isFolder }
  // item tim → akses lewat keanggotaan, bukan fileShares
  if (root.teamBucketId) return { claimed: false, reason: 'team' }

  // idempoten + upgrade-only: kalau belum ada → buat; kalau sudah ada tapi link
  // editor sedangkan share lama viewer → naikkan jadi editor. TIDAK pernah turun.
  const [existing] = await db
    .select({ id: fileShares.id, permission: fileShares.permission })
    .from(fileShares)
    .where(and(eq(fileShares.fileId, root.id), eq(fileShares.sharedWithId, me)))
    .limit(1)

  let upgraded = false
  if (!existing) {
    try {
      await db.insert(fileShares).values({
        fileId: root.id,
        sharedWithId: me,
        sharedById: link.createdById,
        permission: link.permission, // viewer / editor sesuai link
      })
    } catch {
      // kemungkinan balapan (unique index fileId+sharedWith) — anggap sudah ada
    }
  } else if (link.permission === 'editor' && existing.permission === 'viewer') {
    await db.update(fileShares).set({ permission: 'editor' }).where(eq(fileShares.id, existing.id))
    upgraded = true
  }

  return {
    claimed: true,
    already: !!existing && !upgraded,
    permission: link.permission,
    fileId: root.id,
    isFolder: root.isFolder,
    name: root.name,
  }
})
