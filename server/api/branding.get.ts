/**
 * Branding aplikasi (PUBLIK, metadata ringan) — dipakai login & link publik juga.
 * Logo TIDAK dikirim di sini (dilayani terpisah lewat /api/branding/logo yang
 * di-cache browser). Cuma appName + hasLogo + versi (buat cache-busting).
 */
export default defineEventHandler(async () => {
  const b = await getBranding()
  return brandingMeta(b)
})
