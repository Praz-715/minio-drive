import type { Branding } from '../composables/useBranding'

/**
 * Ambil branding sekali di server; nilainya ikut ter-hydrate ke client lewat
 * useState (payload), jadi login/drive/link publik semua render brand yang benar
 * tanpa flash & tanpa fetch dobel di client.
 */
export default defineNuxtPlugin(async () => {
  if (!import.meta.server) return
  const branding = useBranding()
  try {
    const data = await $fetch<Branding>('/api/branding')
    if (data) branding.value = data
  } catch {
    // biarkan default
  }
})
