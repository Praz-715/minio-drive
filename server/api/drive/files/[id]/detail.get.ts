import { eq } from 'drizzle-orm'
import { fileShares, files, shareLinks, teamBuckets, user } from '../../../../db/schema'

/**
 * Detail lengkap sebuah FILE: tipe, lokasi (breadcrumb), ukuran, dibuat/diubah,
 * pemilik, dan siapa saja yang punya akses (share langsung + status link publik).
 * Butuh akses (viewer+). Daftar "dibagikan ke" hanya ditampilkan ke pemilik.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()

  const { file, access } = await fileAccess(me, id)
  if (!file) throw createError({ statusCode: 404, message: 'File tidak ditemukan' })
  if (!access) throw createError({ statusCode: 403, message: 'Kamu tidak punya akses ke file ini' })

  // lokasi = rantai folder induk yang bisa diakses (tanpa file itu sendiri)
  const crumbs = await buildCrumbs(me, file)
  const location = crumbs.slice(0, -1)

  // pemilik
  const [ownerRow] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, file.ownerId))
    .limit(1)

  // nama bucket bersama (kalau item tim)
  let teamName: string | null = null
  if (file.teamBucketId) {
    const [tb] = await db
      .select({ name: teamBuckets.name })
      .from(teamBuckets)
      .where(eq(teamBuckets.id, file.teamBucketId))
      .limit(1)
    teamName = tb?.name || null
  }

  // dibagikan ke siapa — hanya relevan/terlihat untuk pemilik item pribadi
  const iAmOwner = access === 'owner'
  const canSeeShares = iAmOwner && !file.teamBucketId
  let shares: { name: string; email: string; permission: string }[] = []
  let hasLink = false
  if (canSeeShares) {
    shares = await db
      .select({ name: user.name, email: user.email, permission: fileShares.permission })
      .from(fileShares)
      .innerJoin(user, eq(fileShares.sharedWithId, user.id))
      .where(eq(fileShares.fileId, id))
    const [lnk] = await db.select({ id: shareLinks.id }).from(shareLinks).where(eq(shareLinks.fileId, id)).limit(1)
    hasLink = !!lnk
  }

  return {
    id: file.id,
    name: file.name,
    isFolder: file.isFolder,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    owner: { name: ownerRow?.name || '', email: ownerRow?.email || '' },
    access,
    teamName,
    location, // [{ id, name }] folder induk (root → terdekat)
    canSeeShares,
    shares, // [{ name, email, permission }]
    hasLink,
  }
})
