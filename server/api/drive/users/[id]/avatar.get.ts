import { eq } from 'drizzle-orm'
import { user } from '../../../../db/schema'

/** Stream foto profil dari bucket pribadi user (butuh login Drive). */
export default defineEventHandler(async (event) => {
  await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!

  const db = useDriveDb()
  const [u] = await db.select({ bucket: user.bucket }).from(user).where(eq(user.id, id)).limit(1)
  if (!u?.bucket) throw createError({ statusCode: 404, message: 'Avatar tidak ada' })

  try {
    const client = driveMinio()
    const stat = await client.statObject(u.bucket, 'avatar')
    setHeader(event, 'Content-Type', stat.metaData?.['content-type'] || 'image/png')
    setHeader(event, 'Cache-Control', 'private, max-age=3600')
    return sendStream(event, await client.getObject(u.bucket, 'avatar'))
  } catch {
    throw createError({ statusCode: 404, message: 'Avatar tidak ada' })
  }
})
