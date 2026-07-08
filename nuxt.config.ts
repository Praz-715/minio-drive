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
      title: 'Yasa Console — Object Storage',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
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
      ],
    },
  },
})
