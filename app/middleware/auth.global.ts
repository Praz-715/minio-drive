export default defineNuxtRouteMiddleware(async (to) => {
  // ---- area CONSOLE (/console/*): sesi kredensial MinIO (nuxt-auth-utils) ----
  if (to.path === '/console' || to.path.startsWith('/console/')) {
    const { loggedIn } = useUserSession()
    if (!loggedIn.value && to.path !== '/console/login') return navigateTo('/console/login')
    if (loggedIn.value && to.path === '/console/login') return navigateTo('/console')
    return
  }

  // ---- area DRIVE (/files/*): sesi better-auth (dicek di client) ----
  if (to.path === '/files' || to.path.startsWith('/files/')) {
    if (import.meta.server) return
    const { data } = await authClient.getSession()
    if (!data?.session) return navigateTo('/')
    return
  }

  // halaman login (/): kalau sudah punya sesi, langsung ke Files
  if (to.path === '/' && import.meta.client) {
    const { data } = await authClient.getSession()
    if (data?.session) return navigateTo('/files')
  }
})
