/**
 * Deteksi & jalankan pemasangan PWA.
 *
 * Event `beforeinstallprompt` cuma nyala sekali & SANGAT dini (di kunjungan
 * kedua bisa sebelum bundle Nuxt jalan). Kalau listener dipasang telat (spt di
 * plugin), event-nya kelewatan → tombol install tak pernah muncul. Karena itu
 * event ditangkap sedini mungkin oleh skrip inline di <head> (nuxt.config),
 * disimpan ke `window.__pwaInstall`. Composable ini tinggal baca hasilnya.
 */
export function useInstall() {
  const canInstall = ref(false)

  function onCan() { canInstall.value = true }
  function onDone() { canInstall.value = false }

  onMounted(() => {
    // event mungkin sudah tertangkap sebelum komponen ini mount
    if ((window as any).__pwaInstall) canInstall.value = true
    window.addEventListener('pwa:can-install', onCan)
    window.addEventListener('pwa:installed', onDone)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pwa:can-install', onCan)
    window.removeEventListener('pwa:installed', onDone)
  })

  async function promptInstall() {
    const e = (window as any).__pwaInstall
    if (!e) return
    e.prompt()
    try {
      const choice = await e.userChoice
      if (choice?.outcome === 'accepted') (window as any).__pwaInstall = null
    } finally {
      canInstall.value = false
    }
  }

  return { canInstall, promptInstall }
}
