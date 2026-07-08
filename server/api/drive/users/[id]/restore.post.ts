import { eq } from 'drizzle-orm'
import { user } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()

  const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'User tidak ditemukan' })
  if (!target.deletedAt) throw createError({ statusCode: 400, message: 'User masih aktif' })

  await db.update(user).set({ deletedAt: null, updatedAt: new Date() }).where(eq(user.id, id))
  return { ok: true }
})
