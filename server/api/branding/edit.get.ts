/**
 * Branding penuh (termasuk data URI logo) untuk PREFILL modal edit — KHUSUS
 * super admin. Dipanggil sekali saat modal dibuka, bukan di render biasa.
 */
export default defineEventHandler(async (event) => {
  await requireDriveSuperAdmin(event)
  const b = await getBranding()
  return { appName: b.appName, logo: b.logo }
})
