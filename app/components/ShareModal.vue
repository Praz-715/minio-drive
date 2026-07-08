<script setup lang="ts">
const props = defineProps<{ bucket: string; objectKey: string | null; publicAccess?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const { data: meta } = useFetch('/api/meta', { server: false })

const PRESETS = [
  { label: '1 jam', s: 3600 },
  { label: '6 jam', s: 6 * 3600 },
  { label: '1 hari', s: 24 * 3600 },
  { label: '7 hari', s: 7 * 24 * 3600 },
]
const MAX_S = 7 * 24 * 3600

const expiry = ref(24 * 3600)
const customN = ref(3)
const customUnit = ref(3600) // detik per unit
const useCustom = ref(false)

const effectiveExpiry = computed(() => {
  const s = useCustom.value ? Math.floor(customN.value * customUnit.value) : expiry.value
  return Math.min(Math.max(s || 3600, 60), MAX_S)
})

const url = ref('')
const loading = ref(false)

watch(
  [() => props.objectKey, effectiveExpiry],
  async ([key]) => {
    url.value = ''
    if (!key) return
    loading.value = true
    try {
      const res: any = await $fetch(`/api/buckets/${encodeURIComponent(props.bucket)}/presign`, {
        query: { key, inline: 1, expiry: effectiveExpiry.value },
      })
      url.value = res.url
    } catch (e: any) {
      toast.error(apiError(e))
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const expiresAt = computed(() => fmtDate(new Date(Date.now() + effectiveExpiry.value * 1000)))

const publicUrl = computed(() => {
  if (!props.publicAccess || !meta.value?.endpoint || !props.objectKey) return ''
  const path = props.objectKey.split('/').map(encodeURIComponent).join('/')
  return `${meta.value.endpoint}/${props.bucket}/${path}`
})

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.ok('Link disalin ke clipboard')
}

const fileLabel = computed(() => props.objectKey?.split('/').pop() || '')
</script>

<template>
  <Modal :open="!!objectKey" :title="`Bagikan · ${fileLabel}`" wide @close="emit('close')">
    <div class="space-y-5">
      <div>
        <p class="label">Masa Berlaku Link</p>
        <div class="flex flex-wrap items-center gap-2 mt-1">
          <button
            v-for="p in PRESETS"
            :key="p.s"
            class="btn h-8 px-3 text-xs border"
            :class="!useCustom && expiry === p.s
              ? 'border-glow/60 bg-glow/10 text-glow'
              : 'border-ink-600 text-ink-300 hover:border-ink-400'"
            @click="useCustom = false; expiry = p.s"
          >
            {{ p.label }}
          </button>
          <button
            class="btn h-8 px-3 text-xs border"
            :class="useCustom ? 'border-glow/60 bg-glow/10 text-glow' : 'border-ink-600 text-ink-300 hover:border-ink-400'"
            @click="useCustom = true"
          >
            custom
          </button>
          <template v-if="useCustom">
            <input v-model.number="customN" type="number" min="1" class="input h-8 w-20" />
            <select v-model.number="customUnit" class="input h-8 w-28 cursor-pointer">
              <option :value="60">menit</option>
              <option :value="3600">jam</option>
              <option :value="86400">hari</option>
            </select>
          </template>
        </div>
        <p class="mt-2 font-mono text-[11px] text-ink-500">
          maksimal 7 hari (batas protokol S3) · kedaluwarsa: <span class="text-ink-300">{{ expiresAt }}</span>
        </p>
      </div>

      <div>
        <p class="label">Presigned URL <span class="normal-case tracking-normal">(bisa dibuka siapa pun sampai kedaluwarsa)</span></p>
        <div class="flex gap-2 mt-1">
          <input :value="loading ? 'membuat link…' : url" readonly class="input text-[11px]" />
          <button class="btn-primary shrink-0 h-10" :disabled="!url" @click="copy(url)">Copy</button>
        </div>
      </div>

      <div v-if="publicUrl">
        <p class="label">URL Publik Permanen <span class="normal-case tracking-normal">(bucket ini public — tanpa kedaluwarsa)</span></p>
        <div class="flex gap-2 mt-1">
          <input :value="publicUrl" readonly class="input text-[11px]" />
          <button class="btn-ghost shrink-0 h-10" @click="copy(publicUrl)">Copy</button>
        </div>
      </div>
    </div>
  </Modal>
</template>
