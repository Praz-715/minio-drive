/**
 * Logo aplikasi sebagai GAMBAR (PUBLIK). Di-cache agresif oleh browser
 * (immutable, 1 tahun) — cache-busting lewat query ?v=<version>. Jadi tidak
 * fetch berulang: browser simpan di cache lokal sampai versinya ganti.
 */
export default defineEventHandler(async (event) => {
  const b = await getBranding()
  if (!b.logo) throw createError({ statusCode: 404, message: 'Tidak ada logo' })

  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(b.logo)
  if (!m) throw createError({ statusCode: 404, message: 'Logo tidak valid' })

  const mime = m[1] || 'application/octet-stream'
  const buf = m[2]
    ? Buffer.from(m[3], 'base64')
    : Buffer.from(decodeURIComponent(m[3]), 'utf8')

  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Content-Length', String(buf.length))
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return buf
})
