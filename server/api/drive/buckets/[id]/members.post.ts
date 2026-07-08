import { and, eq, isNull } from 'drizzle-orm'
import { teamBucketMembers, teamBuckets, user } from '../../../../db/schema'

/** Assign user ke bucket bersama via email (upsert permission). */
export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const permission = body?.permission === 'viewer' ? 'viewer' : 'editor'
  if (!email) throw createError({ statusCode: 400, message: 'Email wajib diisi' })

  const db = useDriveDb()
  const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, id)).limit(1)
  if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })

  const [target] = await db
    .select()
    .from(user)
    .where(and(eq(user.email, email), isNull(user.deletedAt)))
    .limit(1)
  if (!target) throw createError({ statusCode: 404, message: `User ${email} tidak ditemukan / nonaktif` })

  const [existing] = await db
    .select()
    .from(teamBucketMembers)
    .where(and(eq(teamBucketMembers.bucketId, id), eq(teamBucketMembers.userId, target.id)))
    .limit(1)
  if (existing) {
    await db.update(teamBucketMembers).set({ permission }).where(eq(teamBucketMembers.id, existing.id))
  } else {
    await db.insert(teamBucketMembers).values({ bucketId: id, userId: target.id, permission })
  }
  return { ok: true, name: target.name }
})
