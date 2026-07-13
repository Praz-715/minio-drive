<script setup lang="ts">
definePageMeta({ layout: 'drive' })

const route = useRoute()
const session = authClient.useSession()

// khusus super admin (server juga meng-enforce via ?owner= yang super-only)
watch(
  () => session.value?.data,
  (d) => {
    if (d && !isSuperAdminRole((d.user as any).role)) navigateTo('/drive')
  },
  { immediate: true },
)
</script>

<template>
  <DriveBrowser :key="String(route.params.id)" mode="browse" :owner="String(route.params.id)" />
</template>
