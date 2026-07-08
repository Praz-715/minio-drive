<script setup lang="ts">
definePageMeta({ layout: 'drive' })
const route = useRoute()
const q = computed(() => String(route.query.q || ''))
</script>

<template>
  <DriveBrowser :key="q" mode="search" :q="q" />
</template>
