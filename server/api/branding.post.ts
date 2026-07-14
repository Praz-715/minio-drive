import { eq } from 'drizzle-orm'
import { appSettings } from '../db/schema'

// batas ukuran data URI logo (~350KB gambar → ~470KB base64)
const MAX_LOGO = 480 * 1024

/**
 * Set branding aplikasi — KHUSUS super admin.
 * body: { appName?: string, logo?: string(data URI) }
 *  - kosong / bukan gambar → dianggap "default" (null) untuk field itu.
 * Kirim keduanya kosong = kembali ke bawaan.
 */
export default defineEventHandler(async (event) => {
  await requireDriveSuperAdmin(event)
  const body = await readBody(event).catch(() => ({}))

  let appName: string | null = null
  if (typeof body?.appName === 'string' && body.appName.trim()) {
    appName = body.appName.trim().slice(0, 40)
  }

  let logo: string | null = null
  if (typeof body?.logo === 'string' && body.logo.startsWith('data:image/')) {
    if (body.logo.length > MAX_LOGO) {
      throw createError({ statusCode: 413, message: 'Logo terlalu besar (maks ~350KB). Kompres dulu ya.' })
    }
    logo = body.logo
  }

  const db = useDriveDb()
  await db
    .insert(appSettings)
    .values({ id: 'app', appName, logo, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.id, set: { appName, logo, updatedAt: new Date() } })

  invalidateBranding()
  const fresh = await getBranding() // isi cache + ambil updatedAt terbaru
  return { ok: true, ...brandingMeta(fresh) }
})
