<script setup lang="ts">
const props = defineProps<{ item: any | null }>()
const emit = defineEmits<{ close: []; share: [item: any]; download: [item: any] }>()

const MAX_TEXT = 1024 * 1024

const kind = computed(() => (props.item ? previewKind(props.item.name) : null))
const url = ref('')
const textContent = ref('')
const loading = ref(false)
const error = ref('')

watch(
  () => props.item,
  async (o) => {
    url.value = ''
    textContent.value = ''
    error.value = ''
    if (!o) return
    loading.value = true
    try {
      const res: any = await $fetch(`/api/drive/files/${o.id}/url`, { query: { inline: 1 } })
      url.value = res.url
      if (kind.value === 'text') {
        if (o.size > MAX_TEXT) {
          error.value = 'File terlalu besar untuk preview teks (maks 1 MB) — silakan download.'
        } else {
          const resp = await fetch(res.url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          textContent.value = await resp.text()
        }
      }
    } catch (e: any) {
      error.value = apiError(e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <Modal :open="!!item" :title="item?.name || 'Preview'" xl @close="emit('close')">
    <div class="space-y-4">
      <div class="min-h-48 grid place-items-center">
        <p v-if="loading" class="font-mono text-xs text-ink-400">memuat preview…</p>
        <p v-else-if="error" class="font-mono text-xs text-danger text-center">{{ error }}</p>
        <template v-else-if="url">
          <img v-if="kind === 'image'" :src="url" :alt="item?.name" class="max-h-[60vh] max-w-full rounded-lg object-contain" />
          <video v-else-if="kind === 'video'" :src="url" controls autoplay class="max-h-[60vh] max-w-full rounded-lg" />
          <audio v-else-if="kind === 'audio'" :src="url" controls class="w-full" />
          <iframe v-else-if="kind === 'pdf'" :src="url" class="w-full h-[65vh] rounded-lg border border-ink-700 bg-white" />
          <pre v-else-if="kind === 'text'" class="w-full max-h-[60vh] overflow-auto bg-ink-900 border border-ink-700 rounded-lg p-4 font-mono text-xs text-ink-200 whitespace-pre-wrap break-words">{{ textContent }}</pre>
          <div v-else class="text-center py-8">
            <p class="text-ink-300">Tipe file ini belum bisa di-preview.</p>
            <p class="font-mono text-[11px] text-ink-500 mt-1">gunakan tombol download di bawah</p>
          </div>
        </template>
      </div>

      <div class="flex items-center justify-between gap-3 flex-wrap border-t border-ink-800 pt-4">
        <p class="font-mono text-[11px] text-ink-400">
          {{ fmtBytes(item?.size) }} · {{ fmtDate(item?.updatedAt) }} · {{ item?.ownerName }}
        </p>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="emit('share', item)">⇗ Bagikan</button>
          <button class="btn-primary" @click="emit('download', item)">↓ Download</button>
        </div>
      </div>
    </div>
  </Modal>
</template>
