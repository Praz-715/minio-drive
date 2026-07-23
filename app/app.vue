<template>
  <div>
    <NuxtLoadingIndicator color="var(--glow)" :height="3" :throttle="120" :duration="1800" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toasts />
    <!-- inject tautan manifest PWA (@vite-pwa/nuxt) -->
    <VitePwaManifest />
  </div>
</template>
