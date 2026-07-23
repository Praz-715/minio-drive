/**
 * Nonaktifkan PENDAFTARAN PUBLIK.
 *
 * Endpoint sign-up better-auth (/api/drive-auth/sign-up/*) diblokir untuk SEMUA
 * request HTTP dari luar → tidak ada registrasi mandiri. User baru HANYA dibuat
 * admin lewat POST /api/drive/users, yang memanggil `auth.api.signUpEmail`
 * secara INTERNAL (bukan request HTTP) sehingga TIDAK melewati middleware ini.
 *
 * Catatan: sengaja TIDAK pakai better-auth `disableSignUp` karena itu akan ikut
 * memblokir pembuatan user oleh admin (yang jalur internalnya sama).
 */
export default defineEventHandler((event) => {
  const path = (event.path || '').split('?')[0]
  if (event.method === 'POST' && path.startsWith('/api/drive-auth/sign-up')) {
    throw createError({
      statusCode: 403,
      message: 'Pendaftaran publik dinonaktifkan. Hubungi admin untuk dibuatkan akun.',
    })
  }
})
