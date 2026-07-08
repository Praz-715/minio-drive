import { desc, eq, sql } from 'drizzle-orm'
import { files, teamBucketMembers, teamBuckets, user } from '../../../db/schema'

/** Semua bucket: pribadi (per user) + bersama, dengan pemilik & pemakaian. */
export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const db = useDriveDb()

  // bucket pribadi = daftar user (yang sudah punya bucket)
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      bucket: user.bucket,
      quota: user.storageQuota,
      used: user.storageUsed,
      deletedAt: user.deletedAt,
    })
    .from(user)

  // bucket bersama + jumlah anggota + jumlah file
  const teams = await db.select().from(teamBuckets).orderBy(desc(teamBuckets.createdAt))
  const result = []
  for (const t of teams) {
    const [{ members }] = await db
      .select({ members: sql<number>`count(*)::int` })
      .from(teamBucketMembers)
      .where(eq(teamBucketMembers.bucketId, t.id))
    const [{ used }] = await db
      .select({ used: sql<number>`coalesce(sum(${files.size}), 0)::bigint` })
      .from(files)
      .where(eq(files.teamBucketId, t.id))
    result.push({
      id: t.id,
      name: t.name,
      bucket: t.bucket,
      quota: t.quota,
      used: Number(used),
      members,
      createdAt: t.createdAt,
    })
  }

  return {
    personal: users
      .filter((u) => u.bucket)
      .map((u) => ({
        ownerId: u.id,
        ownerName: u.name,
        ownerEmail: u.email,
        bucket: u.bucket,
        quota: u.quota,
        used: u.used,
        deletedAt: u.deletedAt,
      })),
    teams: result,
  }
})
