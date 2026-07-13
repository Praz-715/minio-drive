import { eq } from 'drizzle-orm'
import { session as sessionTable, user } from '../../../db/schema'

/** Soft delete: flag deletedAt + putus semua sesi. Bucket & isinya TIDAK disentuh. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveAdmin(event)
  const id = getRouterParam(event, 'id')!
  if (id === session.user.id) {
    throw createError({ statusCode: 400, message: 'Tidak bisa menghapus akun sendiri' })
  }

  const db = useDriveDb()
  const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'User tidak ditemukan' })
  if (target.deletedAt) throw createError({ statusCode: 400, message: 'User sudah nonaktif' })
  // akun super admin hanya boleh dinonaktifkan oleh super admin
  if (target.role === 'super_admin' && !isSuperAdminRole((session.user as any).role)) {
    throw createError({ statusCode: 403, message: 'Hanya super admin yang bisa menonaktifkan akun super admin' })
  }

  await db.update(user).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(user.id, id))
  await db.delete(sessionTable).where(eq(sessionTable.userId, id)) // logout paksa semua perangkat

  return { ok: true }
})
