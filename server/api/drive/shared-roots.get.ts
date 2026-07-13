import { desc, eq } from 'drizzle-orm'
import { fileShares, files, teamBucketMembers, teamBuckets, user } from '../../db/schema'

/**
 * Isi "Drive Bersama": bucket bersama tempat saya jadi anggota (kind team) +
 * item yang di-share langsung ke saya (kind share). Untuk sidebar & halaman.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const db = useDriveDb()
  const isAdmin = isAdminRole((session.user as any).role)

  // bucket bersama: admin lihat semua, user lihat yang di-assign
  let teams: any[]
  if (isAdmin) {
    teams = await db.select().from(teamBuckets).orderBy(desc(teamBuckets.createdAt))
  } else {
    const rows = await db
      .select({ tb: teamBuckets })
      .from(teamBucketMembers)
      .innerJoin(teamBuckets, eq(teamBucketMembers.bucketId, teamBuckets.id))
      .where(eq(teamBucketMembers.userId, me))
      .orderBy(desc(teamBuckets.createdAt))
    teams = rows.map((r) => r.tb)
  }

  const shareRows = await db
    .select({ share: fileShares, file: files, ownerName: user.name })
    .from(fileShares)
    .innerJoin(files, eq(fileShares.fileId, files.id))
    .innerJoin(user, eq(files.ownerId, user.id))
    .where(eq(fileShares.sharedWithId, me))
    .orderBy(desc(fileShares.createdAt))

  return {
    teams: teams.map((t) => ({ id: t.id, name: t.name, kind: 'team' })),
    shares: shareRows
      .filter((r) => !r.file.deletedAt)
      .map((r) => ({
        ...toItem(r.file, { id: r.file.ownerId, name: r.ownerName }),
        permission: r.share.permission,
        kind: 'share',
      })),
  }
})
