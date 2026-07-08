/**
 * Bungkus $fetch global supaya SETIAP request API menggerakkan
 * <NuxtLoadingIndicator> (bar tipis di paling atas). Ref-count biar bar cuma
 * kelar saat semua request selesai. Client-only.
 */
export default defineNuxtPlugin(() => {
  const { start, finish } = useLoadingIndicator()
  const orig = globalThis.$fetch
  if (!orig) return

  let active = 0
  const inc = () => {
    if (active === 0) start()
    active++
  }
  const dec = () => {
    active = Math.max(0, active - 1)
    if (active === 0) finish()
  }

  const wrapped: any = (request: any, options?: any) => {
    inc()
    return orig(request, options).finally(dec)
  }
  // pertahankan util bawaan ofetch
  wrapped.raw = (request: any, options?: any) => {
    inc()
    return orig.raw(request, options).finally(dec)
  }
  wrapped.create = orig.create.bind(orig)

  globalThis.$fetch = wrapped
})
