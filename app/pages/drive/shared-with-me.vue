<script setup lang="ts">
definePageMeta({ layout: 'drive' })

// "Dibagikan ke saya" = file/folder yang di-share LANGSUNG ke saya oleh user
// lain (lewat tombol Bagikan). Bukan bucket bersama — itu di /drive/shared.
const toast = useToast()
const signals = useDriveSignals()
const { data, status, refresh } = useFetch('/api/drive/shared-roots', { server: false })
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

// ---- lepaskan akses sendiri (hapus dari "Dibagikan ke saya") ----
const confirmLeave = ref<any>(null)
const leaving = ref(false)
async function leaveShare() {
  leaving.value = true
  try {
    // tanpa userId = self-leave (hapus baris share milik saya)
    await $fetch(`/api/drive/files/${confirmLeave.value.id}/shares`, { method: 'DELETE' })
    toast.ok(`"${confirmLeave.value.name}" dilepaskan dari daftar kamu`)
    confirmLeave.value = null
    signals.value.sharedRefresh++ // sidebar ikut refresh
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    leaving.value = false
  }
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
            <tr><th>Nama</th><th class="w-36 hidden sm:table-cell">Pemilik</th><th class="w-24">Ukuran</th><th class="w-28">Akses kamu</th><th class="w-24" /></tr>
          </thead>
          <tbody>
            <tr v-for="s in shares" :key="s.id" class="group">
              <td>
                <button class="flex items-center gap-2.5 min-w-0 w-full text-left cursor-pointer hover:text-glow transition-colors" @click="openShare(s)">
                  <span class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0" :class="fileChip(s.name, s.isFolder).cls">
                    {{ fileChip(s.name, s.isFolder).label }}
                  </span>
                  <span class="min-w-0">
                    <span class="block font-mono text-[13px] truncate">{{ s.name }}{{ s.isFolder ? '/' : '' }}</span>
                    <span class="block sm:hidden font-mono text-[10px] text-ink-500 truncate">oleh {{ s.ownerName }}</span>
                  </span>
                </button>
              </td>
              <td class="text-xs text-ink-300 hidden sm:table-cell truncate">{{ s.ownerName }}</td>
              <td class="font-mono text-xs text-ink-300">{{ s.isFolder ? '—' : fmtBytes(s.size) }}</td>
              <td>
                <span :class="permBadgeClass(s.permission)" :title="s.permission">
                  {{ s.permission === 'editor' ? '✎ ' : '👁 ' }}{{ permLabel(s.permission) }}
                </span>
              </td>
              <td class="text-right">
                <button
                  class="row-actions text-ink-400 hover:text-danger font-mono text-xs cursor-pointer px-1"
                  title="Lepaskan dari daftar kamu"
                  @click="confirmLeave = s"
                >lepaskan</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="text-center text-ink-400 py-14">
        Belum ada yang dibagikan ke kamu.
      </p>
    </template>

    <!-- konfirmasi lepaskan -->
    <Modal :open="!!confirmLeave" title="Lepaskan Akses" @close="confirmLeave = null">
      <p class="text-sm text-ink-200 leading-relaxed">
        Lepaskan <span class="font-mono text-ink-100">{{ confirmLeave?.name }}</span> dari
        <span class="font-semibold">Dibagikan ke saya</span>?
        Item ini akan hilang dari daftarmu. File-nya <span class="text-ink-100 font-semibold">tidak dihapus</span> —
        pemilik ({{ confirmLeave?.ownerName }}) masih bisa membagikannya lagi.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmLeave = null">Batal</button>
        <button class="btn-danger" :disabled="leaving" @click="leaveShare">
          {{ leaving ? 'Melepaskan…' : 'Lepaskan' }}
        </button>
      </div>
    </Modal>

    <DriveFilePreview :item="previewItem" @close="previewItem = null" @share="() => {}" @download="download" />
  </div>
</template>
