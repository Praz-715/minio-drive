import { and, eq, sql } from 'drizzle-orm'
import { user } from '../db/schema'

/**
 * Bootstrap owner — RBAC full di DB, TANPA env. Plugin ini HANYA bertindak
 * kalau di DB belum ada satu pun super_admin (mis. instalasi baru / restore DB
 * / tanpa sengaja kehilangan semua super admin). Begitu ada super admin, role
 * dikelola sepenuhnya lewat UI Kelola User dan plugin ini jadi no-op — jadi
 * TIDAK pernah menimpa perubahan yang kamu buat di UI.
 *
 * Ganti dua konstanta di bawah kalau owner-nya beda.
 */
const BOOTSTRAP_SUPER_ADMIN = 'admin@yasatech.co.id'
const BOOTSTRAP_ADMIN = 'teguh.prasetyo@yasatech.co.id'

export default defineNitroPlugin(async () => {
  try {
    const db = useDriveDb()
    const [{ supers }] = await db
      .select({ supers: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.role, 'super_admin'))
    if (supers > 0) return // sudah ada super admin → DB-only, jangan sentuh apa pun

    const [sa] = await db
      .update(user)
      .set({ role: 'super_admin', updatedAt: new Date() })
      .where(sql`lower(${user.email}) = ${BOOTSTRAP_SUPER_ADMIN}`)
      .returning({ id: user.id })
    // owner kedua → admin, hanya promote dari user (jangan turunkan yang lebih tinggi)
    await db
      .update(user)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(and(sql`lower(${user.email}) = ${BOOTSTRAP_ADMIN}`, eq(user.role, 'user')))

    if (sa) console.log(`[yasa] bootstrap: tidak ada super admin → ${BOOTSTRAP_SUPER_ADMIN} di-set super admin`)
    else console.warn(`[yasa] bootstrap: belum ada super admin & akun ${BOOTSTRAP_SUPER_ADMIN} belum terdaftar`)
  } catch (e: any) {
    console.warn('[yasa] bootstrap role gagal (non-fatal):', e?.message || e)
  }
})
