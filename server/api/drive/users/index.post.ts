import { eq } from 'drizzle-orm'
import { user } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireDriveAdmin(event)
  const body = await readBody(event)

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const role = body?.role === 'admin' ? 'admin' : 'user'
  const quotaGiB = Number(body?.quotaGiB) > 0 ? Number(body.quotaGiB) : 5

  if (!name) throw createError({ statusCode: 400, message: 'Nama wajib diisi' })
  if (!/^\S+@\S+\.\S+$/.test(email)) throw createError({ statusCode: 400, message: 'Email tidak valid' })
  if (password.length < 8) throw createError({ statusCode: 400, message: 'Password minimal 8 karakter' })

  // buat user + password hash lewat better-auth (tanpa membuat sesi browser admin berubah)
  let created: any
  try {
    created = await useServerAuth().api.signUpEmail({ body: { name, email, password } })
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e?.body?.message || e?.message || 'Gagal membuat user' })
  }
  const userId: string = created.user.id

  // set role & quota sesuai input admin
  const storageQuota = Math.round(quotaGiB * 1024 ** 3)
  const db = useDriveDb()
  await db.update(user).set({ role, storageQuota, updatedAt: new Date() }).where(eq(user.id, userId))

  // bucket pribadi + hard quota MinIO
  let bucketWarning = ''
  let bucket = ''
  try {
    bucket = await ensureUserBucket(userId)
  } catch (e: any) {
    bucketWarning = `User dibuat, tapi bucket gagal dibuat: ${e?.message || e}`
  }

  return { ok: true, id: userId, bucket, bucketWarning }
})
