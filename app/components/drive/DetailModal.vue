<script setup lang="ts">
// Detail sebuah FILE (bukan folder): tipe, lokasi, ukuran, dibuat/diubah,
// pemilik, dan siapa saja yang punya akses. Data diambil dari /detail.
const props = defineProps<{ item: any | null }>()
const emit = defineEmits<{ close: [] }>()

const detail = ref<any>(null)
const loading = ref(false)
const error = ref('')

watch(
  () => props.item,
  async (o) => {
    detail.value = null
    error.value = ''
    if (!o) return
    loading.value = true
    try {
      detail.value = await $fetch(`/api/drive/files/${o.id}/detail`)
    } catch (e: any) {
      error.value = apiError(e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const ext = computed(() => {
  const n = props.item?.name || ''
  const i = n.lastIndexOf('.')
  return i > 0 ? n.slice(i + 1).toUpperCase() : ''
})
const typeLabel = computed(() => detail.value?.mimeType || (ext.value ? `File ${ext.value}` : 'File'))
const locationLabel = computed(() => {
  const d = detail.value
  if (!d) return ''
  const parts = (d.location || []).map((c: any) => c.name)
  const root = d.teamName ? d.teamName : 'Files Saya'
  return [root, ...parts].join(' / ')
})
</script>

<template>
  <Modal :open="!!item" :title="`Detail · ${item?.name || ''}`" @close="emit('close')">
    <p v-if="loading" class="font-mono text-xs text-ink-400 py-6 text-center">memuat detail…</p>
    <p v-else-if="error" class="font-mono text-xs text-danger py-6 text-center">{{ error }}</p>

    <div v-else-if="detail" class="space-y-5">
      <!-- ikon + nama -->
      <div class="flex items-center gap-3 min-w-0">
        <span
          class="inline-flex w-10 justify-center rounded border font-mono text-[10px] px-1 py-1 shrink-0"
          :class="fileChip(detail.name).cls"
        >{{ fileChip(detail.name).label }}</span>
        <p class="font-semibold break-words min-w-0">{{ detail.name }}</p>
      </div>

      <!-- metadata -->
      <dl class="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-3 text-sm">
        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Tipe</dt>
        <dd class="text-ink-100 break-all min-w-0">{{ typeLabel }}</dd>

        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Lokasi</dt>
        <dd class="text-ink-100 break-words min-w-0">{{ locationLabel }}</dd>

        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Ukuran</dt>
        <dd class="text-ink-100 font-mono">{{ fmtBytes(detail.size) }}</dd>

        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Dibuat</dt>
        <dd class="text-ink-100">{{ fmtDate(detail.createdAt) }}</dd>

        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Diubah</dt>
        <dd class="text-ink-100">{{ fmtDate(detail.updatedAt) }}</dd>

        <dt class="font-mono text-[11px] uppercase tracking-wider text-ink-400 pt-0.5">Pemilik</dt>
        <dd class="text-ink-100 break-words min-w-0">
          {{ detail.owner.name }}
          <span v-if="detail.owner.email" class="text-ink-400">· {{ detail.owner.email }}</span>
        </dd>
      </dl>

      <!-- akses / dibagikan -->
      <div class="border-t border-ink-800 pt-4">
        <p class="label mb-2">Akses</p>

        <template v-if="detail.canSeeShares">
          <div v-if="detail.shares.length" class="space-y-2">
            <div v-for="s in detail.shares" :key="s.email" class="flex items-center gap-2 min-w-0">
              <div class="size-7 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-[10px] font-bold text-ink-300 shrink-0">
                {{ s.name?.[0]?.toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm truncate">{{ s.name }}</p>
                <p class="font-mono text-[10px] text-ink-400 truncate">{{ s.email }}</p>
              </div>
              <span :class="permBadgeClass(s.permission)" class="shrink-0">{{ permLabel(s.permission) }}</span>
            </div>
          </div>
          <p v-else class="font-mono text-[11px] text-ink-500">Belum dibagikan ke siapa pun.</p>

          <p v-if="detail.hasLink" class="mt-2.5 font-mono text-[11px] text-ok">🔗 Link publik aktif</p>
        </template>

        <template v-else>
          <p v-if="detail.teamName" class="text-sm text-ink-300">
            Ada di bucket bersama <span class="font-semibold text-ink-100">{{ detail.teamName }}</span> — akses lewat keanggotaan tim.
          </p>
          <p v-else class="text-sm text-ink-300 flex items-center gap-2">
            Dibagikan ke kamu <span :class="permBadgeClass(detail.access)">{{ permLabel(detail.access) }}</span>
          </p>
        </template>
      </div>
    </div>
  </Modal>
</template>
