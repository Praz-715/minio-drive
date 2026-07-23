<script setup lang="ts">
definePageMeta({ layout: 'drive' })

// "Files Bersama" = HANYA bucket bersama (team). Item yang di-share langsung
// ada di halaman /files/shared-with-me ("Dibagikan ke saya").
const { data, status } = useFetch('/api/drive/shared-roots', { server: false })
const teams = computed(() => (data.value as any)?.teams || [])
</script>

<template>
  <div class="space-y-6">
    <div class="rise">
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Files Bersama</h1>
      <p class="text-ink-400 text-sm mt-1">Bucket bersama tempat kamu jadi anggota.</p>
    </div>

    <p v-if="status === 'pending' || status === 'idle'" class="font-mono text-xs text-ink-400">memuat…</p>

    <template v-else>
      <div v-if="teams.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <NuxtLink
          v-for="t in teams"
          :key="t.id"
          :to="`/files/team/${t.id}`"
          class="card p-4 rise hover:border-glow/50 transition-colors group"
        >
          <p class="text-2xl mb-2">▦</p>
          <p class="font-semibold group-hover:text-glow transition-colors truncate">{{ t.name }}</p>
          <p class="font-mono text-[10px] text-ink-500 mt-0.5">bucket bersama</p>
        </NuxtLink>
      </div>

      <p v-else class="text-center text-ink-400 py-14">
        Belum ada bucket bersama untukmu.
      </p>
    </template>
  </div>
</template>
