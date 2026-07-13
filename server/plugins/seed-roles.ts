import { and, eq, ne, sql } from 'drizzle-orm'
import { user } from '../db/schema'

/**
 * Seed role dari env saat startup — idempoten & PROMOTE-ONLY (tidak pernah
 * menurunkan role yang sudah ada):
 *   - SUPER_ADMIN_EMAILS → pastikan super_admin
 *   - ADMIN_EMAILS       → pastikan minimal admin (promote dari user)
 *
 * Bikin penetapan role jadi deklaratif: set env, restart, role langsung nempel.
 * Perlu buat bootstrap super admin pertama (yang tidak bisa dibuat lewat UI).
 */
export default defineNitroPlugin(async () => {
  const parse = (v?: string) =>
    (v || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)

  const supers = parse(process.env.SUPER_ADMIN_EMAILS)
  const admins = parse(process.env.ADMIN_EMAILS).filter((e) => !supers.includes(e))
  if (!supers.length && !admins.length) return

  try {
    const db = useDriveDb()
    for (const email of supers) {
      await db
        .update(user)
        .set({ role: 'super_admin', updatedAt: new Date() })
        .where(and(sql`lower(${user.email}) = ${email}`, ne(user.role, 'super_admin')))
    }
    for (const email of admins) {
      // promote HANYA dari user → admin (jangan turunkan admin/super yang sudah ada)
      await db
        .update(user)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(and(sql`lower(${user.email}) = ${email}`, eq(user.role, 'user')))
    }
    console.log(`[yasa] seed-roles: dicek ${supers.length} super admin + ${admins.length} admin`)
  } catch (e: any) {
    console.warn('[yasa] seed-roles gagal (non-fatal):', e?.message || e)
  }
})
