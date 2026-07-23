import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  // login Drive sekarang di "/" — arahkan tautan lama /login ke sana
  routeRules: {
    '/login': { redirect: '/' },
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
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
})
