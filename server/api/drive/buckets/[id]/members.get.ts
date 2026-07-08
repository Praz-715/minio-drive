import { eq } from 'drizzle-orm'
import { teamBucketMembers, user } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()
  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      permission: teamBucketMembers.permission,
    })
    .from(teamBucketMembers)
    .innerJoin(user, eq(teamBucketMembers.userId, user.id))
    .where(eq(teamBucketMembers.bucketId, id))
})
