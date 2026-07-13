<script setup lang="ts">
definePageMeta({ layout: 'drive' })

// "Dibagikan ke saya" = file/folder yang di-share LANGSUNG ke saya oleh user
// lain (lewat tombol Bagikan). Bukan bucket bersama — itu di /drive/shared.
const { data, status } = useFetch('/api/drive/shared-roots', { server: false })
const shares = computed(() => (data.value as any)?.shares || [])

const previewItem = ref<any>(null)
function openShare(s: any) {
  if (s.isFolder) navigateTo(`/drive/folder/${s.id}`)
  else previewItem.value = s
}
async function download(o: any) {
  const { url } = await $fetch<{ url: string }>(`/api/drive/files/${o.id}/url`)
  window.open(url, '_blank')
}
</script>

<template>
  <div class="space-y-6">
    <div class="rise">
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Dibagikan ke saya</h1>
      <p class="text-ink-400 text-sm mt-1">File & folder yang dibagikan langsung ke kamu oleh user lain.</p>
    </div>

    <p v-if="status === 'pending' || status === 'idle'" class="font-mono text-xs text-ink-400">memuat…</p>

    <template v-else>
      <div v-if="shares.length" class="card overflow-x-auto">
        <table class="tbl">
          <thead>
            <tr><th>Nama</th><th class="w-36 hidden sm:table-cell">Pemilik</th><th class="w-24">Ukuran</th><th class="w-28">Akses kamu</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in shares" :key="s.id" class="group">
              <td>
                <button class="flex items-center gap-2.5 min-w-0 w-full text-left cursor-pointer hover:text-glow transition-colors" @click="openShare(s)">
                  <span class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0" :class="fileChip(s.name, s.isFolder).cls">
                    {{ fileChip(s.name, s.isFolder).label }}
                  </span>
                  <span class="font-mono text-[13px] truncate">{{ s.name }}{{ s.isFolder ? '/' : '' }}</span>
                </button>
              </td>
              <td class="text-xs text-ink-300 hidden sm:table-cell truncate">{{ s.ownerName }}</td>
              <td class="font-mono text-xs text-ink-300">{{ s.isFolder ? '—' : fmtBytes(s.size) }}</td>
              <td>
                <span :class="permBadgeClass(s.permission)" :title="s.permission">
                  {{ s.permission === 'editor' ? '✎ ' : '👁 ' }}{{ permLabel(s.permission) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-center text-ink-400 py-14">
        Belum ada yang dibagikan ke kamu.
      </p>
    </template>

    <DriveFilePreview :item="previewItem" @close="previewItem = null" @share="() => {}" @download="download" />
  </div>
</template>
