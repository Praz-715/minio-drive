<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; message?: string } }>()
</script>

<template>
  <div class="min-h-screen grid-texture flex items-center justify-center p-6">
    <div class="text-center rise">
      <p class="font-mono text-7xl font-bold text-glow">{{ props.error?.statusCode || 500 }}</p>
      <p class="mt-3 text-ink-300">{{ props.error?.message || 'Terjadi kesalahan' }}</p>
      <button class="btn-primary mt-6" @click="clearError({ redirect: '/' })">Kembali ke Dashboard</button>
    </div>
  </div>
</template>
