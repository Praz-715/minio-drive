import { asc } from 'drizzle-orm'
import { user } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const db = useDriveDb()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      storageQuota: user.storageQuota,
      storageUsed: user.storageUsed,
      bucket: user.bucket,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt))
  return rows
})
