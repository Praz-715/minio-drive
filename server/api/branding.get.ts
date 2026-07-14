import { eq } from 'drizzle-orm'
import { appSettings } from '../db/schema'

/**
 * Branding aplikasi (PUBLIK — dipakai halaman login & link publik juga).
 * Mengembalikan nama & logo kustom, atau null kalau pakai bawaan.
 * Toleran kalau tabel belum ada (belum di-migrate) → balikin default.
 */
export default defineEventHandler(async () => {
  try {
    const db = useDriveDb()
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 'app')).limit(1)
    return { appName: row?.appName || null, logo: row?.logo || null }
  } catch {
    return { appName: null, logo: null }
  }
})
