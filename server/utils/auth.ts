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

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const baseUrl = process.env.BETTER_AUTH_URL

  _auth = betterAuth({
    appName: 'Yasa Drive',
    basePath: '/api/drive-auth',
    database: drizzleAdapter(useDriveDb(), { provider: 'pg', schema }),
    // CSRF/cookie hardening: origin dipercaya = URL app; cookie secure di produksi
    ...(baseUrl ? { trustedOrigins: [baseUrl] } : {}),
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
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
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              role: adminEmails.includes(user.email.toLowerCase()) ? 'admin' : 'user',
            },
          }),
        },
      },
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

/** Khusus endpoint admin Drive. */
export async function requireDriveAdmin(event: any) {
  const session = await requireDriveSession(event)
  if ((session.user as any).role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Khusus admin' })
  }
  return session
}
