import { and, eq, inArray } from 'drizzle-orm'
import { fileShares, files, teamBucketMembers, teamBuckets, user } from '../db/schema'

export type DriveAccess = 'owner' | 'editor' | 'viewer'
const RANK = { viewer: 1, editor: 2, owner: 3 }
const MAX_DEPTH = 32

async function isAdmin(userId: string): Promise<boolean> {
  const db = useDriveDb()
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
  return isAdminRole(u?.role)
}

async function isSuperAdmin(userId: string): Promise<boolean> {
  const db = useDriveDb()
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
  return isSuperAdminRole(u?.role)
}

/** Izin user pada sebuah bucket bersama. */
export async function teamAccess(userId: string, bucketId: string): Promise<DriveAccess | null> {
  if (await isAdmin(userId)) return 'owner'
  const db = useDriveDb()
  const [m] = await db
    .select()
    .from(teamBucketMembers)
    .where(and(eq(teamBucketMembers.bucketId, bucketId), eq(teamBucketMembers.userId, userId)))
    .limit(1)
  return m ? (m.permission as DriveAccess) : null
}

/**
 * Hak akses atas file/folder. Tiga sumber:
 *  - file bertim (teamBucketId): dari keanggotaan tim; uploader & admin = owner
 *  - file pribadi milik sendiri: owner
 *  - file pribadi di-share (langsung / lewat folder leluhur): viewer/editor
 */
export async function fileAccess(
  userId: string,
  fileId: string,
): Promise<{ file: any | null; access: DriveAccess | null }> {
  const db = useDriveDb()
  const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)
  if (!f) return { file: null, access: null }

  // super admin = akses penuh (owner) ke SEMUA file, termasuk Drive pribadi user lain
  if (await isSuperAdmin(userId)) return { file: f, access: 'owner' }

  if (f.teamBucketId) {
    if (f.ownerId === userId) return { file: f, access: 'owner' }
    const t = await teamAccess(userId, f.teamBucketId)
    return { file: f, access: t }
  }

  if (f.ownerId === userId) return { file: f, access: 'owner' }

  let cur: any = f
  for (let i = 0; i < MAX_DEPTH; i++) {
    const [share] = await db
      .select()
      .from(fileShares)
      .where(and(eq(fileShares.fileId, cur.id), eq(fileShares.sharedWithId, userId)))
      .limit(1)
    if (share) return { file: f, access: share.permission as DriveAccess }
    if (!cur.parentId) break
    const [p] = await db.select().from(files).where(eq(files.id, cur.parentId)).limit(1)
    if (!p) break
    cur = p
  }
  return { file: f, access: null }
}

export async function requireFileAccess(userId: string, fileId: string, min: DriveAccess) {
  const { file, access } = await fileAccess(userId, fileId)
  if (!file) throw createError({ statusCode: 404, message: 'File tidak ditemukan' })
  if (!access || RANK[access] < RANK[min]) {
    throw createError({ statusCode: 403, message: 'Kamu tidak punya akses ke file ini' })
  }
  return { file, access }
}

/**
 * Tentukan lokasi upload/folder-baru dari input:
 *  - parent (folder) → warisi teamBucketId & bucket folder itu, butuh akses editor
 *  - team (root bucket bersama) → butuh keanggotaan editor
 *  - keduanya kosong → root Drive pribadi si user
 * Mengembalikan bucket MinIO tujuan + siapa yang "membayar" kuota.
 */
export async function resolveWriteLocation(
  userId: string,
  opts: { parent?: string; team?: string },
): Promise<{ parentId: string | null; teamBucketId: string | null; bucket: string; quotaTarget: 'user' | 'team'; quotaId: string; ownerId: string }> {
  const db = useDriveDb()

  if (opts.parent) {
    const { file, access } = await requireFileAccess(userId, opts.parent, 'editor')
    if (!file.isFolder || file.deletedAt) throw createError({ statusCode: 400, message: 'Folder tujuan tidak valid' })
    if (file.teamBucketId) {
      const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, file.teamBucketId)).limit(1)
      if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })
      // upload/folder ke dalam bucket bersama → dimiliki pengupload (semantik tim)
      return { parentId: file.id, teamBucketId: tb.id, bucket: tb.bucket, quotaTarget: 'team', quotaId: tb.id, ownerId: userId }
    }
    // folder pribadi milik user lain (di-share editor) → item baru mengikuti
    // pemilik folder, biar objek, kuota, dan bucketForFile() konsisten.
    const owner = await ownerMap([file.ownerId])
    const bucket = owner[file.ownerId]?.bucket
    if (!bucket) throw createError({ statusCode: 500, message: 'Bucket pemilik folder tidak ada' })
    return { parentId: file.id, teamBucketId: null, bucket, quotaTarget: 'user', quotaId: file.ownerId, ownerId: file.ownerId }
  }

  if (opts.team) {
    const access = await teamAccess(userId, opts.team)
    if (!access || RANK[access] < RANK.editor) {
      throw createError({ statusCode: 403, message: 'Tidak punya akses tulis ke bucket bersama ini' })
    }
    const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, opts.team)).limit(1)
    if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })
    return { parentId: null, teamBucketId: tb.id, bucket: tb.bucket, quotaTarget: 'team', quotaId: tb.id, ownerId: userId }
  }

  const bucket = await ensureUserBucket(userId)
  return { parentId: null, teamBucketId: null, bucket, quotaTarget: 'user', quotaId: userId, ownerId: userId }
}

/** Bucket MinIO tempat objek sebuah file berada (pribadi atau tim). */
export async function bucketForFile(f: any): Promise<string | null> {
  const db = useDriveDb()
  if (f.teamBucketId) {
    const [tb] = await db.select({ bucket: teamBuckets.bucket }).from(teamBuckets).where(eq(teamBuckets.id, f.teamBucketId)).limit(1)
    return tb?.bucket || null
  }
  const owner = await ownerMap([f.ownerId])
  return owner[f.ownerId]?.bucket || null
}

export async function buildCrumbs(userId: string, folder: any): Promise<{ id: string; name: string }[]> {
  const db = useDriveDb()
  const crumbs: { id: string; name: string }[] = [{ id: folder.id, name: folder.name }]
  let cur = folder
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (!cur.parentId) break
    const [p] = await db.select().from(files).where(eq(files.id, cur.parentId)).limit(1)
    if (!p || p.deletedAt) break
    if (!(await fileAccess(userId, p.id)).access) break
    crumbs.unshift({ id: p.id, name: p.name })
    cur = p
  }
  return crumbs
}

export function toItem(f: any, owner?: { id: string; name: string } | null) {
  return {
    id: f.id,
    name: f.name,
    isFolder: f.isFolder,
    size: f.size,
    mimeType: f.mimeType,
    starred: f.starred,
    parentId: f.parentId,
    teamBucketId: f.teamBucketId ?? null,
    ownerId: f.ownerId,
    ownerName: owner?.name || '',
    deletedAt: f.deletedAt,
    updatedAt: f.updatedAt,
  }
}

/**
 * true kalau `fileId` SAMA DENGAN `ancestorId` atau salah satu turunannya
 * (naik lewat parentId, dibatasi kedalaman). Dipakai link publik folder untuk
 * memastikan file yang diminta pengunjung benar-benar berada di dalam folder
 * yang dibagikan — bukan file acak yang id-nya ditebak.
 */
export async function isWithinFolder(fileId: string, ancestorId: string): Promise<boolean> {
  if (fileId === ancestorId) return true
  const db = useDriveDb()
  let cur = fileId
  for (let i = 0; i < MAX_DEPTH; i++) {
    const [row] = await db.select({ parentId: files.parentId }).from(files).where(eq(files.id, cur)).limit(1)
    if (!row || !row.parentId) return false
    if (row.parentId === ancestorId) return true
    cur = row.parentId
  }
  return false
}

// Urutan Drive: folder dulu, lalu nama secara NATURAL (1, 2, …, 10 — bukan
// leksikografis 1, 10, 2). Postgres tak punya natural-collation bawaan, jadi
// urutkan di JS pakai Intl.Collator. Dipakai listing folder (browse) & /s publik.
const nameCollator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })
export function sortByFolderThenName<T extends { isFolder: boolean; name: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.isFolder === b.isFolder ? nameCollator.compare(a.name, b.name) : a.isFolder ? -1 : 1))
}

export async function ownerMap(ids: string[]): Promise<Record<string, { id: string; name: string; bucket: string | null }>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  if (!uniq.length) return {}
  const db = useDriveDb()
  const rows = await db
    .select({ id: user.id, name: user.name, bucket: user.bucket })
    .from(user)
    .where(inArray(user.id, uniq))
  const map: Record<string, any> = {}
  for (const r of rows) map[r.id] = r
  return map
}
