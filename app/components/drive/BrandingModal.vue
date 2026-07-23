<script setup lang="ts">
// Edit Nama & Logo aplikasi — KHUSUS super admin. Dua mode: Default (bawaan
// "Y" + FILES) atau Kustom (nama + logo sendiri). Berlaku global: login,
// drive, dan link publik.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const branding = useBranding()

const mode = ref<'default' | 'custom'>('default')
const form = reactive<{ appName: string; logo: string | null }>({ appName: '', logo: null })
const saving = ref(false)
const logoInput = ref<HTMLInputElement>()

const loadingEdit = ref(false)
watch(
  () => props.open,
  async (o) => {
    if (!o) return
    // ambil branding penuh (data URI logo) sekali saat modal dibuka
    loadingEdit.value = true
    try {
      const cur = await $fetch<{ appName: string | null; logo: string | null }>('/api/branding/edit')
      mode.value = cur.appName || cur.logo ? 'custom' : 'default'
      form.appName = cur.appName || ''
      form.logo = cur.logo || null
    } catch {
      mode.value = branding.value.appName || branding.value.hasLogo ? 'custom' : 'default'
      form.appName = branding.value.appName || ''
      form.logo = null
    } finally {
      loadingEdit.value = false
    }
  },
  { immediate: true },
)

// preview mengikuti mode + form (bukan branding global)
const previewLogo = computed(() => (mode.value === 'custom' ? form.logo : null))
const previewName = computed(() => (mode.value === 'custom' ? form.appName.trim() : ''))

function pickLogo() {
  logoInput.value?.click()
}
function onLogo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    if (!/^image\//.test(file.type)) {
      toast.error('File harus berupa gambar (png/jpg/svg/webp)')
    } else if (file.size > 300 * 1024) {
      toast.error('Logo maksimal 300KB — kompres dulu ya')
    } else {
      const reader = new FileReader()
      reader.onload = () => (form.logo = reader.result as string)
      reader.onerror = () => toast.error('Gagal membaca file')
      reader.readAsDataURL(file)
    }
  }
  if (logoInput.value) logoInput.value.value = ''
}

async function save() {
  saving.value = true
  try {
    const payload =
      mode.value === 'default' ? { appName: '', logo: null } : { appName: form.appName, logo: form.logo }
    const res: any = await $fetch('/api/branding', { method: 'POST', body: payload })
    // update seluruh app seketika (metadata; logo dilayani via endpoint gambar)
    branding.value = { appName: res.appName, hasLogo: res.hasLogo, logoVersion: res.logoVersion }
    toast.ok('Nama & logo diperbarui')
    emit('close')
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="open" title="Nama & Logo Aplikasi" @close="emit('close')">
    <div class="space-y-5">
      <!-- pilih mode -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="rounded-lg border p-3 text-left transition-colors cursor-pointer"
          :class="mode === 'default' ? 'border-glow bg-glow/10' : 'border-ink-700 hover:border-ink-500'"
          @click="mode = 'default'"
        >
          <p class="text-sm font-semibold">Bawaan</p>
          <p class="text-[11px] text-ink-400 mt-0.5">Logo F + FILES</p>
        </button>
        <button
          type="button"
          class="rounded-lg border p-3 text-left transition-colors cursor-pointer"
          :class="mode === 'custom' ? 'border-glow bg-glow/10' : 'border-ink-700 hover:border-ink-500'"
          @click="mode = 'custom'"
        >
          <p class="text-sm font-semibold">Kustom</p>
          <p class="text-[11px] text-ink-400 mt-0.5">Nama & logo sendiri</p>
        </button>
      </div>

      <!-- preview -->
      <div class="rounded-lg border border-ink-700 bg-ink-900/50 px-4 py-4">
        <p class="label mb-2.5">Pratinjau</p>
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="size-10 rounded-xl bg-glow/15 border border-glow/40 grid place-items-center overflow-hidden shrink-0">
            <img v-if="previewLogo" :src="previewLogo" alt="logo" class="size-full object-contain p-0.5" />
            <span v-else class="text-glow font-black">F</span>
          </span>
          <span class="font-extrabold tracking-tight text-lg truncate">
            <template v-if="previewName">{{ previewName }}</template>
            <template v-else><span class="text-glow">FILES</span></template>
          </span>
        </div>
      </div>

      <!-- form kustom -->
      <div v-if="mode === 'custom'" class="space-y-4">
        <div>
          <label class="label">Nama aplikasi</label>
          <input
            v-model="form.appName"
            class="input"
            maxlength="40"
            placeholder="mis. BPKD Files"
            spellcheck="false"
          />
          <p class="mt-1 font-mono text-[11px] text-ink-500">Kosongkan kalau mau tetap "FILES".</p>
        </div>

        <div>
          <label class="label">Logo</label>
          <div class="flex items-center gap-3">
            <span class="size-12 rounded-xl bg-ink-900 border border-ink-600 grid place-items-center overflow-hidden shrink-0">
              <img v-if="form.logo" :src="form.logo" alt="logo" class="size-full object-contain p-0.5" />
              <span v-else class="text-ink-500 font-mono text-[10px]">kosong</span>
            </span>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-ghost h-9" @click="pickLogo">Pilih Gambar</button>
              <button v-if="form.logo" type="button" class="btn-ghost h-9 text-danger" @click="form.logo = null">Hapus Logo</button>
            </div>
            <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="onLogo" />
          </div>
          <p class="mt-1.5 font-mono text-[11px] text-ink-500">PNG/JPG/SVG/WEBP, maks 300KB. Kosong = pakai logo "Y".</p>
        </div>
      </div>

      <p v-else class="font-mono text-[11px] text-ink-500">
        Menyimpan akan mengembalikan nama & logo ke bawaan aplikasi.
      </p>

      <div class="flex justify-end gap-2 border-t border-ink-800 pt-4">
        <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">Batal</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Menyimpan…' : 'Simpan' }}
        </button>
      </div>
    </div>
  </Modal>
</template>
