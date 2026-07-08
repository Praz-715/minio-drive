import { and, eq } from 'drizzle-orm'
import { teamBucketMembers } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const userId = String(body?.userId || '')
  if (!userId) throw createError({ statusCode: 400, message: 'userId wajib diisi' })

  await useDriveDb()
    .delete(teamBucketMembers)
    .where(and(eq(teamBucketMembers.bucketId, id), eq(teamBucketMembers.userId, userId)))
  return { ok: true }
})
