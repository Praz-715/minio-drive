import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'

/**
 * Auth end-user Yasa Drive (better-auth), terpisah total dari auth console
 * MinIO (nuxt-auth-utils). Endpoint di /api/drive-auth/*.
 * Email di ADMIN_EMAILS (comma-separated) otomatis dapat role admin saat daftar.
 */

let _auth: ReturnType<typeof betterAuth> | null = null

export function useServerAuth() {
  if (_auth) return _auth

  const baseUrl = process.env.BETTER_AUTH_URL
  const isProd = process.env.NODE_ENV === 'production'

  // Origin tepercaya untuk cek CSRF better-auth.
  // - Produksi: HANYA BETTER_AUTH_URL (ketat).
  // - Dev: tambahkan localhost port umum supaya `nuxt dev` (3000/3001) tidak
  //   kena 403 walau BETTER_AUTH_URL disetel ke port lain.
  const trustedOrigins = [
    ...(baseUrl ? [baseUrl] : []),
    ...(isProd ? [] : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']),
  ]

  _auth = betterAuth({
    appName: 'Yasa Drive',
    basePath: '/api/drive-auth',
    database: drizzleAdapter(useDriveDb(), { provider: 'pg', schema }),
    // CSRF/cookie hardening: origin dipercaya = URL app; cookie secure di produksi
    ...(trustedOrigins.length ? { trustedOrigins } : {}),
    advanced: {
      useSecureCookies: isProd,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
        storageQuota: { type: 'number', defaultValue: 5 * 1024 ** 3, input: false },
        storageUsed: { type: 'number', defaultValue: 0, input: false },
      },
    },
    databaseHooks: {
      // Role TIDAK diatur dari env. User baru selalu 'user'; role dikelola
      // sepenuhnya di DB lewat UI Kelola User (super admin). Bootstrap super
      // admin pertama ditangani server/plugins/seed-roles.ts.
      session: {
        create: {
          // user yang di-soft-delete tidak boleh login lagi
          before: async (session) => {
            const db = useDriveDb()
            const [u] = await db
              .select({ deletedAt: schema.user.deletedAt })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1)
            if (u?.deletedAt) {
              throw new APIError('FORBIDDEN', { message: 'Akun ini sudah dinonaktifkan' })
            }
          },
        },
      },
    },
  })
  return _auth
}

/** Helper untuk API Drive: ambil sesi dari request, 401 kalau tidak ada. */
export async function requireDriveSession(event: any) {
  const session = await useServerAuth().api.getSession({ headers: event.headers })
  if (!session) throw createError({ statusCode: 401, message: 'Silakan login dulu' })
  return session
}

/** Punya hak admin (admin ATAU super_admin). */
export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin'
}
/** Super admin (akses penuh, termasuk semua bucket pribadi). */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin'
}

/** Endpoint admin Drive (admin & super_admin). */
export async function requireDriveAdmin(event: any) {
  const session = await requireDriveSession(event)
  if (!isAdminRole((session.user as any).role)) {
    throw createError({ statusCode: 403, message: 'Khusus admin' })
  }
  return session
}

/** Endpoint khusus super admin. */
export async function requireDriveSuperAdmin(event: any) {
  const session = await requireDriveSession(event)
  if (!isSuperAdminRole((session.user as any).role)) {
    throw createError({ statusCode: 403, message: 'Khusus super admin' })
  }
  return session
}
