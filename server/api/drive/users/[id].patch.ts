import { and, eq } from 'drizzle-orm'
import { account, user } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireDriveAdmin(event)
  const iamSuper = isSuperAdminRole((session.user as any).role)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const db = useDriveDb()

  const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'User tidak ditemukan' })
  // akun super admin hanya boleh diubah oleh super admin
  if (target.role === 'super_admin' && !iamSuper) {
    throw createError({ statusCode: 403, message: 'Hanya super admin yang bisa mengubah akun super admin' })
  }

  const patch: Record<string, any> = { updatedAt: new Date() }

  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw createError({ statusCode: 400, message: 'Nama tidak boleh kosong' })
    patch.name = name
  }

  if (body?.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw createError({ statusCode: 400, message: 'Email tidak valid' })
    patch.email = email
  }

  if (body?.role !== undefined) {
    let role: 'user' | 'admin' | 'super_admin'
    if (body.role === 'super_admin') {
      if (!iamSuper) throw createError({ statusCode: 403, message: 'Hanya super admin yang bisa memberi role super admin' })
      role = 'super_admin'
    } else if (body.role === 'admin') {
      role = 'admin'
    } else {
      role = 'user'
    }
    // super admin TIDAK boleh menurunkan role akun sendiri dari super_admin
    // (anti lock-out: jaga selalu ada minimal 1 super admin di sistem)
    if (id === session.user.id && iamSuper && role !== 'super_admin') {
      throw createError({ statusCode: 400, message: 'Super admin tidak bisa menurunkan role akun sendiri' })
    }
    // admin/user: jangan menurunkan role akun sendiri di bawah admin
    if (id === session.user.id && !isAdminRole(role)) {
      throw createError({ statusCode: 400, message: 'Tidak bisa menurunkan role akun sendiri' })
    }
    patch.role = role
  }

  let quotaChanged = false
  if (body?.quotaGiB !== undefined) {
    const quotaGiB = Number(body.quotaGiB)
    if (!(quotaGiB > 0)) throw createError({ statusCode: 400, message: 'Quota harus lebih dari 0' })
    patch.storageQuota = Math.round(quotaGiB * 1024 ** 3)
    quotaChanged = true
  }

  await db.update(user).set(patch).where(eq(user.id, id))

  // reset password (opsional)
  if (body?.password) {
    const password = String(body.password)
    if (password.length < 8) throw createError({ statusCode: 400, message: 'Password minimal 8 karakter' })
    const ctx = await useServerAuth().$context
    const hash = await ctx.password.hash(password)
    await db
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, id), eq(account.providerId, 'credential')))
  }

  // sinkronkan hard-quota MinIO (buat bucket sekalian kalau belum ada)
  let bucketWarning = ''
  if (quotaChanged) {
    try {
      const bucket = target.bucket || (await ensureUserBucket(id))
      await setBucketQuota(bucket, patch.storageQuota)
    } catch (e: any) {
      bucketWarning = `Data tersimpan, tapi quota bucket gagal diupdate: ${e?.message || e}`
    }
  }

  return { ok: true, bucketWarning }
})
