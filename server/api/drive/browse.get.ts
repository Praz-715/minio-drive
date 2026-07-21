import { and, desc, eq, isNull } from 'drizzle-orm'
import { files, teamBuckets, user } from '../../db/schema'

/**
 * Isi sebuah lokasi:
 *  - tanpa param        → root Drive Saya (file pribadi, parent null)
 *  - ?team={id}         → root bucket bersama
 *  - ?parent={folderId} → isi folder (pribadi maupun tim)
 *  - ?owner={userId}    → root Drive pribadi user lain (KHUSUS super admin)
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const q = getQuery(event)
  const parent = String(q.parent || '')
  const team = String(q.team || '')
  const owner = String(q.owner || '')
  const db = useDriveDb()

  let folder: any = null
  let access: DriveAccess = 'owner'
  let crumbs: { id: string; name: string }[] = []
  let teamInfo: any = null
  let ownerRoot: { id: string; name: string } | null = null
  let rows: any[]

  if (parent) {
    const res = await requireFileAccess(me, parent, 'viewer')
    folder = res.file
    access = res.access
    if (!folder.isFolder) throw createError({ statusCode: 400, message: 'Bukan folder' })
    if (folder.deletedAt) throw createError({ statusCode: 404, message: 'Folder ada di sampah' })
    crumbs = await buildCrumbs(me, folder)
    if (folder.teamBucketId) {
      const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, folder.teamBucketId)).limit(1)
      teamInfo = tb ? { id: tb.id, name: tb.name } : null
    }
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.parentId, parent), isNull(files.deletedAt)))
      .orderBy(desc(files.isFolder))
  } else if (team) {
    const t = await teamAccess(me, team)
    if (!t) throw createError({ statusCode: 403, message: 'Bukan anggota bucket bersama ini' })
    access = t
    const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, team)).limit(1)
    if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })
    teamInfo = { id: tb.id, name: tb.name }
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.teamBucketId, team), isNull(files.parentId), isNull(files.deletedAt)))
      .orderBy(desc(files.isFolder))
  } else if (owner) {
    // super admin melihat root Drive pribadi user lain (god-mode)
    if (!isSuperAdminRole((session.user as any).role)) {
      throw createError({ statusCode: 403, message: 'Khusus super admin' })
    }
    const [ou] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, owner)).limit(1)
    if (!ou) throw createError({ statusCode: 404, message: 'User tidak ditemukan' })
    ownerRoot = { id: ou.id, name: ou.name }
    access = 'owner'
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.ownerId, owner), isNull(files.parentId), isNull(files.teamBucketId), isNull(files.deletedAt)))
      .orderBy(desc(files.isFolder))
  } else {
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.ownerId, me), isNull(files.parentId), isNull(files.teamBucketId), isNull(files.deletedAt)))
      .orderBy(desc(files.isFolder))
  }

  sortByFolderThenName(rows) // natural sort: 1, 2, …, 10 (bukan 1, 10, 2)

  const owners = await ownerMap(rows.map((r) => r.ownerId))
  return {
    folder: folder ? { id: folder.id, name: folder.name, ownerId: folder.ownerId, teamBucketId: folder.teamBucketId } : null,
    team: teamInfo,
    ownerRoot,
    access,
    crumbs,
    items: rows.map((r) => toItem(r, owners[r.ownerId])),
  }
})
