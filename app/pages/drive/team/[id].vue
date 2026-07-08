<script setup lang="ts">
definePageMeta({ layout: 'drive' })
const route = useRoute()
</script>

<template>
  <DriveBrowser :key="String(route.params.id)" mode="browse" :team="String(route.params.id)" />
</template>
