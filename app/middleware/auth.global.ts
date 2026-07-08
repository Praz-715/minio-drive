export default defineNuxtRouteMiddleware(async (to) => {
  // ---- area CONSOLE (/console/*): sesi kredensial MinIO (nuxt-auth-utils) ----
  if (to.path === '/console' || to.path.startsWith('/console/')) {
    const { loggedIn } = useUserSession()
    if (!loggedIn.value && to.path !== '/console/login') return navigateTo('/console/login')
    if (loggedIn.value && to.path === '/console/login') return navigateTo('/console')
    return
  }

  // ---- area DRIVE (/drive/*): sesi better-auth (dicek di client) ----
  if (to.path === '/drive' || to.path.startsWith('/drive/')) {
    if (import.meta.server) return
    const { data } = await authClient.getSession()
    if (!data?.session) return navigateTo('/')
    return
  }

  // halaman login (/) & register: kalau sudah punya sesi, langsung ke Drive
  if ((to.path === '/' || to.path === '/register') && import.meta.client) {
    const { data } = await authClient.getSession()
    if (data?.session) return navigateTo('/drive')
  }
})
