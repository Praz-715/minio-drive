<script setup lang="ts">
const props = defineProps<{ item: any | null }>()
const emit = defineEmits<{ close: [] }>()

const toast = useToast()
const signals = useDriveSignals()

const shares = ref<any[]>([])
const loadingShares = ref(false)
const link = ref<any>(null) // { token, url, expiresAt, hasPassword, downloads, expired }
const linkLoading = ref(false)

// ---- link publik: state (WAJIB di atas watch immediate — hindari TDZ) ----
const EXPIRY_OPTS = [
  { label: '1 hari', days: 1 },
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
  { label: 'Selamanya', days: null as number | null },
]
const form = reactive({ expiryDays: 7 as number | null, password: '', permission: 'viewer' as 'viewer' | 'editor' })
function resetForm() {
  form.expiryDays = 7
  form.password = ''
  form.permission = 'viewer'
}

watch(
  () => props.item,
  async (o) => {
    shares.value = []
    link.value = null
    resetForm()
    if (!o) return
    loadingShares.value = true
    try {
      shares.value = await $fetch(`/api/drive/files/${o.id}/shares`)
    } catch {}
    loadingShares.value = false
    // link publik berlaku untuk file MAUPUN folder
    try {
      const res: any = await $fetch(`/api/drive/files/${o.id}/link`)
      link.value = res.link
    } catch {}
  },
  { immediate: true },
)

// ---- share ke user ----
const email = ref('')
const permission = ref<'viewer' | 'editor'>('viewer')
const busy = ref(false)
async function addShare() {
  busy.value = true
  try {
    const res: any = await $fetch(`/api/drive/files/${props.item.id}/shares`, {
      method: 'POST',
      body: { email: email.value, permission: permission.value },
    })
    toast.ok(`Dibagikan ke ${res.name}`)
    email.value = ''
    shares.value = await $fetch(`/api/drive/files/${props.item.id}/shares`)
    signals.value.sharedRefresh++
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
async function revoke(s: any) {
  try {
    await $fetch(`/api/drive/files/${props.item.id}/shares`, { method: 'DELETE', body: { userId: s.userId } })
    shares.value = shares.value.filter((x) => x.userId !== s.userId)
    toast.ok(`Akses ${s.name} dicabut`)
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

// ---- link publik: aksi ----
async function createLink() {
  linkLoading.value = true
  try {
    const res: any = await $fetch(`/api/drive/files/${props.item.id}/link`, {
      method: 'POST',
      body: { expiryDays: form.expiryDays, password: form.password || undefined, permission: form.permission },
    })
    link.value = res
    toast.ok('Link publik dibuat')
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    linkLoading.value = false
  }
}
async function revokeLink() {
  linkLoading.value = true
  try {
    await $fetch(`/api/drive/files/${props.item.id}/link`, { method: 'DELETE' })
    link.value = null
    resetForm()
    toast.ok('Link publik dicabut')
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    linkLoading.value = false
  }
}
async function copyPublic() {
  await navigator.clipboard.writeText(link.value.url)
  toast.ok('Link disalin')
}
</script>

<template>
  <Modal :open="!!item" :title="`Bagikan · ${item?.name}`" wide @close="emit('close')">
    <div class="space-y-6">
      <!-- ke user lain -->
      <div>
        <p class="label">Bagikan ke User</p>
        <form class="flex flex-wrap gap-2 mt-1" @submit.prevent="addShare">
          <input v-model="email" type="email" class="input h-10 flex-1 min-w-40" placeholder="email user" spellcheck="false" />
          <select v-model="permission" class="input h-10 w-32 cursor-pointer">
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>
          <button type="submit" class="btn-primary h-10 shrink-0" :disabled="busy || !email">Bagikan</button>
        </form>
        <p class="mt-1.5 font-mono text-[11px] text-ink-500">
          viewer = lihat & download · editor = bisa upload/ubah di dalamnya
        </p>

        <div v-if="shares.length" class="mt-3 space-y-2">
          <div v-for="s in shares" :key="s.userId" class="flex items-center gap-3 rounded-lg border border-ink-700 px-3 py-2">
            <img v-if="s.image" :src="s.image" alt="" class="size-7 rounded-full object-cover border border-ink-600" />
            <div v-else class="size-7 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-[10px] font-bold text-ink-300">
              {{ s.name[0]?.toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold truncate">{{ s.name }}</p>
              <p class="font-mono text-[10px] text-ink-400 truncate">{{ s.email }}</p>
            </div>
            <span class="badge-dim">{{ s.permission }}</span>
            <button class="text-ink-500 hover:text-danger text-xs font-mono cursor-pointer" @click="revoke(s)">cabut</button>
          </div>
        </div>
        <p v-else-if="!loadingShares" class="mt-3 font-mono text-[11px] text-ink-500">belum dibagikan ke siapa pun</p>
      </div>

      <!-- link publik (file & folder) -->
      <div class="border-t border-ink-800 pt-5">
        <p class="label">
          Link Publik
          <span class="normal-case tracking-normal">
            ({{ item?.isFolder ? 'siapa pun dengan link bisa menjelajah & download isinya' : 'siapa pun dengan link bisa buka & download' }})
          </span>
        </p>

        <!-- belum ada link → form buat -->
        <template v-if="!link">
          <div class="flex flex-wrap items-end gap-2 mt-1">
            <div>
              <label class="label mb-1">Masa berlaku</label>
              <select v-model="form.expiryDays" class="input h-10 w-32 cursor-pointer">
                <option v-for="o in EXPIRY_OPTS" :key="String(o.days)" :value="o.days">{{ o.label }}</option>
              </select>
            </div>
            <div v-if="!item?.teamBucketId">
              <label class="label mb-1">Akses</label>
              <select v-model="form.permission" class="input h-10 w-28 cursor-pointer">
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
              </select>
            </div>
            <div class="flex-1 min-w-36">
              <label class="label mb-1">Password <span class="normal-case tracking-normal">(opsional)</span></label>
              <input v-model="form.password" type="text" class="input h-10" placeholder="kosongkan = tanpa password" spellcheck="false" autocomplete="off" />
            </div>
            <button class="btn-primary h-10 shrink-0" :disabled="linkLoading" @click="createLink">Buat Link</button>
          </div>
          <p v-if="form.permission === 'editor'" class="mt-1.5 font-mono text-[11px] text-ink-500">
            editor = yang buka link lalu login/daftar bisa ikut mengedit · pengunjung anonim tetap lihat saja
          </p>
        </template>

        <!-- sudah ada link -->
        <template v-else>
          <div class="flex gap-2 mt-1">
            <input :value="link.url" readonly class="input text-[12px]" @focus="($event.target as HTMLInputElement).select()" />
            <button class="btn-primary shrink-0 h-10" @click="copyPublic">Copy</button>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-mono text-[11px] text-ink-400">
            <span :class="link.permission === 'editor' ? 'text-ok' : ''">akses: {{ link.permission === 'editor' ? 'editor' : 'viewer' }}</span>
            <span :class="link.expired && 'text-danger'">
              {{ link.expired ? '⚠ kedaluwarsa' : link.expiresAt ? `kedaluwarsa ${fmtDate(link.expiresAt)}` : 'tidak kedaluwarsa' }}
            </span>
            <span>{{ link.hasPassword ? '🔒 dilindungi password' : 'tanpa password' }}</span>
            <span>{{ link.downloads }}× diunduh</span>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn-ghost h-8 text-xs" :disabled="linkLoading" @click="link = null">Buat ulang</button>
            <button class="btn-danger h-8 text-xs" :disabled="linkLoading" @click="revokeLink">Cabut link</button>
          </div>
        </template>
      </div>
    </div>
  </Modal>
</template>
