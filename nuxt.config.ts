import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  modules: ['nuxt-auth-utils', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  // login Drive di "/". Tautan lama /login & pendaftaran publik /register
  // diarahkan ke halaman login (registrasi mandiri dinonaktifkan — user dibuat admin).
  routeRules: {
    '/login': { redirect: '/' },
    '/register': { redirect: '/' },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    // override via NUXT_MINIO_ENDPOINT / NUXT_MC_PATH in .env
    minioEndpoint: 'http://192.168.1.111:9000',
    mcPath: '',
    // NUXT_DEMO=1 → semua API dijawab data palsu (desain tanpa server)
    demo: '',
    // service account MinIO untuk backend Drive
    driveMinioAccessKey: '',
    driveMinioSecretKey: '',
  },
  app: {
    head: {
      title: 'Files',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#f4f5f7' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#13161d' },
      ],
      script: [
        {
          // set tema sebelum paint supaya tidak flash
          innerHTML:
            "(function(){try{var t=localStorage.getItem('yasa-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}})()",
        },
        {
          // tangkap beforeinstallprompt SEDINI mungkin (sebelum bundle) → simpan
          // ke window.__pwaInstall; composable useInstall() yang pakai (lihat catatan di sana)
          innerHTML:
            "(function(){window.__pwaInstall=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstall=e;window.dispatchEvent(new Event('pwa:can-install'))});window.addEventListener('appinstalled',function(){window.__pwaInstall=null;window.dispatchEvent(new Event('pwa:installed'))})})()",
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
        },
        // favicon (di-generate dari twemoji 🗃️) — file di /public
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        // manifest di-inject otomatis oleh @vite-pwa/nuxt (/manifest.webmanifest)
      ],
    },
  },

  // ── PWA (installable) ──
  // Aplikasi bisa di-install ke home screen / desktop (standalone + splash + ikon).
  // Service worker SENGAJA tidak precache aset app → NOL risiko konten basi;
  // file & data tetap butuh koneksi (wajar, file ada di MinIO).
  pwa: {
    registerType: 'autoUpdate',
    // SW custom (injectManifest) → online: network apa adanya; offline/lambat:
    // fallback ke /offline.html. TANPA nge-cache halaman app (nol stale/auth leak).
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    injectManifest: {
      globPatterns: [], // jangan precache aset app; offline.html di-cache manual di SW
    },
    manifest: {
      id: '/',
      name: 'Files',
      short_name: 'Files',
      description: 'Penyimpanan & berbagi file self-hosted.',
      lang: 'id',
      dir: 'ltr',
      theme_color: '#13161d',
      background_color: '#13161d',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      categories: ['productivity', 'business', 'utilities'],
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    client: {
      installPrompt: true, // tangkap beforeinstallprompt → tombol Install sendiri
    },
    devOptions: {
      enabled: true, // aktifkan SW di dev (localhost = secure context) buat tes
      suppressWarnings: true,
      type: 'module',
    },
  },
})
