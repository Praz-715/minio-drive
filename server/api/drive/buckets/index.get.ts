import { desc, eq, sql } from 'drizzle-orm'
import { files, teamBucketMembers, teamBuckets, user } from '../../../db/schema'

/**
 * Bucket bersama (admin & super_admin) + bucket pribadi per user
 * (HANYA super_admin — data sensitif: menampilkan storage tiap orang).
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveAdmin(event)
  const superAdmin = isSuperAdminRole((session.user as any).role)
  const db = useDriveDb()

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

  // bucket pribadi = daftar user (yang sudah punya bucket) — super admin saja
  let personal: any[] = []
  if (superAdmin) {
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
    personal = users
      .filter((u) => u.bucket)
      .map((u) => ({
        ownerId: u.id,
        ownerName: u.name,
        ownerEmail: u.email,
        bucket: u.bucket,
        quota: u.quota,
        used: u.used,
        deletedAt: u.deletedAt,
      }))
  }

  return { isSuperAdmin: superAdmin, personal, teams: result }
})
