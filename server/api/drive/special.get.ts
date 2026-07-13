import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { files, teamBucketMembers, teamBuckets } from '../../db/schema'

/** View khusus: recent | starred | trash | search (semua milik sendiri + share langsung). */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const q = getQuery(event)
  const view = String(q.view || 'recent')
  const db = useDriveDb()

  let rows: any[] = []

  if (view === 'trash') {
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.ownerId, me), isNotNull(files.deletedAt)))
      .orderBy(desc(files.deletedAt))
      .limit(200)
  } else if (view === 'starred') {
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.ownerId, me), eq(files.starred, true), isNull(files.deletedAt)))
      .orderBy(desc(files.updatedAt))
      .limit(200)
  } else if (view === 'recent') {
    rows = await db
      .select()
      .from(files)
      .where(and(eq(files.ownerId, me), eq(files.isFolder, false), isNull(files.deletedAt)))
      .orderBy(desc(files.updatedAt))
      .limit(60)
  } else if (view === 'search') {
    const term = String(q.q || '').trim()
    if (term.length < 2) return { items: [] }

    if (isSuperAdminRole((session.user as any).role)) {
      // super admin: cari di SELURUH file (god-mode)
      const res: any = await db.execute(sql`
        SELECT id, name, is_folder AS "isFolder", size, mime_type AS "mimeType", starred,
               parent_id AS "parentId", owner_id AS "ownerId", deleted_at AS "deletedAt",
               updated_at AS "updatedAt"
        FROM files
        WHERE deleted_at IS NULL AND name ILIKE ${'%' + term + '%'}
        ORDER BY updated_at DESC
        LIMIT 50
      `)
      rows = Array.isArray(res) ? res : res.rows || []
    } else {
      // bucket bersama yang bisa kuakses (admin: semua)
      const isAdmin = isAdminRole((session.user as any).role)
      const teamIds = isAdmin
        ? (await db.select({ id: teamBuckets.id }).from(teamBuckets)).map((r) => r.id)
        : (await db.select({ id: teamBucketMembers.bucketId }).from(teamBucketMembers).where(eq(teamBucketMembers.userId, me))).map((r) => r.id)
      const teamFilter = teamIds.length ? sql`OR team_bucket_id IN ${teamIds}` : sql``

      // seluruh pohon yang bisa kuakses: milikku + share langsung + file bucket bersama + turunannya
      const res: any = await db.execute(sql`
        WITH RECURSIVE accessible AS (
          SELECT id FROM files WHERE owner_id = ${me} ${teamFilter}
          UNION
          SELECT file_id FROM file_shares WHERE shared_with_id = ${me}
          UNION
          SELECT f.id FROM files f JOIN accessible a ON f.parent_id = a.id
        )
        SELECT id, name, is_folder AS "isFolder", size, mime_type AS "mimeType", starred,
               parent_id AS "parentId", owner_id AS "ownerId", deleted_at AS "deletedAt",
               updated_at AS "updatedAt"
        FROM files
        WHERE id IN (SELECT id FROM accessible)
          AND deleted_at IS NULL
          AND name ILIKE ${'%' + term + '%'}
        ORDER BY updated_at DESC
        LIMIT 50
      `)
      rows = Array.isArray(res) ? res : res.rows || []
    }
  } else {
    throw createError({ statusCode: 400, message: 'View tidak dikenal' })
  }

  const owners = await ownerMap(rows.map((r) => r.ownerId))
  return { items: rows.map((r) => toItem(r, owners[r.ownerId])) }
})
