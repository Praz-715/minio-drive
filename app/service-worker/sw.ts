/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const OFFLINE_URL = '/offline.html'
const OFFLINE_CACHE = 'files-offline-v1'
const NETWORK_TIMEOUT_MS = 8000

// injectManifest WAJIB mereferensikan __WB_MANIFEST. Kita sengaja TIDAK precache
// aset app (globPatterns kosong) → nol risiko konten basi / kebocoran auth.
// Yang di-cache HANYA halaman offline, manual saat install (lihat bawah).
precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))),
  )
})

self.addEventListener('activate', (event) => {
  // buang cache offline versi lama
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith('files-offline-') && k !== OFFLINE_CACHE).map((k) => caches.delete(k)),
      )
    })(),
  )
})
clientsClaim()

async function offlinePage(): Promise<Response> {
  const cache = await caches.open(OFFLINE_CACHE)
  const cached = await cache.match(OFFLINE_URL)
  return cached || Response.error()
}

// Navigasi (dokumen HTML): coba network dulu, dengan timeout untuk "internet
// lambat". Kalau gagal / timeout → tampilkan halaman offline. Aset statis & /api
// tidak di-intercept (langsung network apa adanya).
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
      try {
        const response = await fetch(request, { signal: controller.signal })
        return response
      } catch {
        return offlinePage()
      } finally {
        clearTimeout(timer)
      }
    },
    { denylist: [/^\/api\//] },
  ),
)

// jaring pengaman: navigasi apa pun yang lolos & gagal → halaman offline
setCatchHandler(async ({ request }) => (request.mode === 'navigate' ? offlinePage() : Response.error()))
