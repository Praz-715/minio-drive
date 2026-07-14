import { eq } from 'drizzle-orm'
import { appSettings } from '../db/schema'

export interface BrandingRow {
  appName: string | null
  logo: string | null // data URI
  updatedAt: Date | null
}

// cache in-memory (proses tunggal) — hindari query DB tiap render SSR.
// di-invalidate saat super admin menyimpan branding.
let cache: BrandingRow | null = null

/** Baca branding (dari cache; kalau kosong baca DB sekali). Toleran tabel belum ada. */
export async function getBranding(): Promise<BrandingRow> {
  if (cache) return cache
  try {
    const db = useDriveDb()
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 'app')).limit(1)
    cache = {
      appName: row?.appName ?? null,
      logo: row?.logo ?? null,
      updatedAt: row?.updatedAt ?? null,
    }
  } catch {
    cache = { appName: null, logo: null, updatedAt: null }
  }
  return cache
}

export function invalidateBranding() {
  cache = null
}

/** Metadata ringan untuk client (tanpa data URI logo yang besar). */
export function brandingMeta(b: BrandingRow) {
  return {
    appName: b.appName,
    hasLogo: !!b.logo,
    // versi buat cache-busting URL gambar; ganti hanya saat branding di-update
    logoVersion: b.logo ? String(b.updatedAt ? new Date(b.updatedAt).getTime() : 1) : null,
  }
}
