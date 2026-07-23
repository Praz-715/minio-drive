<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const ctx = useDriveCtx()
const signals = useDriveSignals()

const { data: me, refresh: refreshMe } = useFetch('/api/drive/me', { server: false })
const { data: sharedRoots, refresh: refreshShared } = useFetch('/api/drive/shared-roots', { server: false })

const isAdmin = computed(() => isAdminRole(me.value?.role))
const isSuperAdmin = computed(() => isSuperAdminRole(me.value?.role))
const sharedTeams = computed(() => (sharedRoots.value as any)?.teams || [])
const sharedItems = computed(() => (sharedRoots.value as any)?.shares || [])
const usagePct = computed(() =>
  me.value?.storageQuota ? Math.min(100, (me.value.storageUsed / me.value.storageQuota) * 100) : 0,
)

watch(() => signals.value.sharedRefresh, () => refreshShared())
watch(() => signals.value.usageRefresh, () => refreshMe())

const sidebarOpen = ref(false)
const newMenuOpen = ref(false)
const profileOpen = ref(false)
const fabOpen = ref(false) // speed-dial FAB (mobile)
watch(() => route.fullPath, () => {
  sidebarOpen.value = false
  newMenuOpen.value = false
  profileOpen.value = false
  fabOpen.value = false
})

function triggerUpload() {
  if (!ctx.value.canUpload) {
    toast.info('Buka Files Saya atau folder yang bisa kamu tulis dulu')
    return
  }
  newMenuOpen.value = false
  fabOpen.value = false
  signals.value.upload++
}
function triggerFolder() {
  if (!ctx.value.canUpload) {
    toast.info('Buka Files Saya atau folder yang bisa kamu tulis dulu')
    return
  }
  newMenuOpen.value = false
  fabOpen.value = false
  signals.value.folder++
}

// ---- search ----
const search = ref(String(route.query.q || ''))
function doSearch() {
  const q = search.value.trim()
  if (q.length >= 2) navigateTo(`/files/search?q=${encodeURIComponent(q)}`)
}

// ---- presence heartbeat (fitur "siapa online" untuk super admin) ----
// Ping ringan tiap 45s SELAMA tab terlihat. Saat tab disembunyikan, denyut
// berhenti (hemat) → user otomatis dianggap offline setelah jendela lewat;
// begitu tab terlihat lagi, langsung kirim denyut biar balik online seketika.
const HEARTBEAT_MS = 45_000
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
function sendHeartbeat() {
  if (document.visibilityState !== 'visible') return
  $fetch('/api/drive/heartbeat', { method: 'POST' }).catch(() => {})
}
function onVisibility() {
  if (document.visibilityState === 'visible') sendHeartbeat()
}
onMounted(() => {
  sendHeartbeat()
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})

// ---- profil ----
const showProfile = ref(false)
const showBranding = ref(false)
const profileForm = reactive({ name: '', currentPassword: '', newPassword: '' })
const savingProfile = ref(false)
const avatarInput = ref<HTMLInputElement>()

function openProfile() {
  profileOpen.value = false
  profileForm.name = me.value?.name || ''
  profileForm.currentPassword = ''
  profileForm.newPassword = ''
  showProfile.value = true
}

async function saveProfile() {
  savingProfile.value = true
  try {
    if (profileForm.name && profileForm.name !== me.value?.name) {
      await authClient.updateUser({ name: profileForm.name })
    }
    if (profileForm.newPassword) {
      if (profileForm.newPassword.length < 8) throw new Error('Password baru minimal 8 karakter')
      const { error } = await authClient.changePassword({
        currentPassword: profileForm.currentPassword,
        newPassword: profileForm.newPassword,
        revokeOtherSessions: true,
      })
      if (error) throw new Error(error.message || 'Password saat ini salah')
    }
    toast.ok('Profil disimpan')
    showProfile.value = false
    await refreshMe()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    savingProfile.value = false
  }
}

async function onAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const form = new FormData()
  form.append('file', file)
  try {
    await $fetch('/api/drive/me/avatar', { method: 'POST', body: form })
    toast.ok('Foto profil diperbarui')
    await refreshMe()
  } catch (err: any) {
    toast.error(apiError(err))
  } finally {
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function logout() {
  await authClient.signOut()
  await navigateTo('/')
}

const nav = computed(() => [
  { to: '/files', label: 'Files Saya', icon: '🗂️', active: route.path === '/files' || route.path.startsWith('/files/folder') },
  { to: '/files/recent', label: 'Terbaru', icon: '🕘', active: route.path === '/files/recent' },
  { to: '/files/starred', label: 'Berbintang', icon: '⭐', active: route.path === '/files/starred' },
  { to: '/files/trash', label: 'Sampah', icon: '🗑️', active: route.path === '/files/trash' },
])
</script>

<template>
  <div class="min-h-screen flex">
    <!-- backdrop drawer (mobile) -->
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
      <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-ink-950/60 backdrop-blur-sm lg:hidden" @click="sidebarOpen = false" />
    </Transition>

    <!-- ============ SIDEBAR ============ -->
    <aside
      class="w-64 shrink-0 border-r border-ink-700 bg-ink-900 lg:bg-ink-900/70 flex flex-col fixed inset-y-0 left-0 z-40
        transform transition-transform duration-200 ease-out lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="px-4 pt-5 pb-4 flex items-center justify-between">
        <NuxtLink to="/files" class="min-w-0">
          <BrandMark size="sm" />
        </NuxtLink>
        <button class="lg:hidden size-9 grid place-items-center text-ink-400 hover:text-ink-100 cursor-pointer" aria-label="Tutup menu" @click="sidebarOpen = false">✕</button>
      </div>

      <!-- + Baru (desktop) -->
      <div class="px-4 pb-3 relative hidden lg:block">
        <button class="btn-primary w-full h-11 text-base" @click="newMenuOpen = !newMenuOpen">+ Baru</button>
        <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-1" leave-active-class="transition duration-100" leave-to-class="opacity-0">
          <div v-if="newMenuOpen" class="absolute left-4 right-4 top-full mt-1 card shadow-xl z-50 overflow-hidden">
            <button class="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer" @click="triggerUpload">↑ Upload file</button>
            <button class="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer border-t border-ink-800" @click="triggerFolder">▸ Folder baru</button>
          </div>
        </Transition>
      </div>

      <nav class="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        <NuxtLink
          v-for="item in nav.slice(0, 1)"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="item.active ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
        >
          <span>{{ item.icon }}</span>{{ item.label }}
        </NuxtLink>

        <!-- Files Bersama = bucket bersama (team) saja -->
        <NuxtLink
          to="/files/shared"
          class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="route.path === '/files/shared' ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
        >
          <span>👥</span>Files Bersama
        </NuxtLink>
        <!-- maksimal ~3 terlihat; sisanya scroll di section ini saja -->
        <div v-if="sharedTeams.length" class="ml-6 border-l border-ink-700 pl-2 space-y-0.5 max-h-[6.5rem] overflow-y-auto sidebar-scroll">
          <NuxtLink
            v-for="t in sharedTeams"
            :key="t.id"
            :to="`/files/team/${t.id}`"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors truncate"
            :class="route.path === `/files/team/${t.id}` ? 'text-glow' : 'text-ink-400 hover:text-ink-100'"
          >
            <span class="font-mono text-[10px] shrink-0">▦</span>
            <span class="truncate flex-1 min-w-0">{{ t.name }}</span>
          </NuxtLink>
        </div>

        <!-- Dibagikan ke saya = file/folder yang di-share langsung -->
        <NuxtLink
          to="/files/shared-with-me"
          class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="route.path === '/files/shared-with-me' ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
        >
          <span>🔗</span>Dibagikan ke saya
        </NuxtLink>
        <!-- maksimal ~3 terlihat; sisanya scroll di section ini saja -->
        <div v-if="sharedItems.length" class="ml-6 border-l border-ink-700 pl-2 space-y-0.5 max-h-[8.25rem] overflow-y-auto sidebar-scroll">
          <NuxtLink
            v-for="s in sharedItems"
            :key="s.id"
            :to="s.isFolder ? `/files/folder/${s.id}` : '/files/shared-with-me'"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
            :class="route.path === `/files/folder/${s.id}` ? 'text-glow' : 'text-ink-400 hover:text-ink-100'"
          >
            <span class="font-mono text-[10px] shrink-0">{{ s.isFolder ? '▸' : '·' }}</span>
            <span class="flex-1 min-w-0 leading-tight">
              <span class="block truncate text-[13px]">{{ s.name }}</span>
              <span class="block truncate text-[10px] text-ink-500">oleh {{ s.ownerName }}</span>
            </span>
            <span
              class="shrink-0 text-[10px] self-center"
              :class="s.permission === 'editor' ? 'text-glow' : 'text-ink-600'"
              :title="s.permission === 'editor' ? 'bisa edit' : 'lihat saja'"
            >{{ s.permission === 'editor' ? '✎' : '👁' }}</span>
          </NuxtLink>
        </div>

        <div class="border-t border-ink-800 my-2" />

        <NuxtLink
          v-for="item in nav.slice(1)"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="item.active ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
        >
          <span>{{ item.icon }}</span>{{ item.label }}
        </NuxtLink>

        <template v-if="isAdmin">
          <div class="border-t border-ink-800 my-2" />
          <NuxtLink
            to="/files/users"
            class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="route.path.startsWith('/files/users') ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
          >
            <span>👤</span>Kelola User
          </NuxtLink>
          <NuxtLink
            to="/files/buckets"
            class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="route.path.startsWith('/files/buckets') ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
          >
            <span>🪣</span>Manajemen Bucket
          </NuxtLink>
        </template>
      </nav>

      <!-- storage bar -->
      <div class="px-4 py-4 border-t border-ink-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div class="h-1.5 rounded-full bg-ink-800 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="usagePct > 90 ? 'bg-danger' : 'bg-glow'"
            :style="{ width: `${Math.max(usagePct, 2)}%` }"
          />
        </div>
        <p class="font-mono text-[11px] text-ink-400 mt-2">
          {{ fmtBytes(me?.storageUsed) }} dari {{ fmtBytes(me?.storageQuota) }}
        </p>
      </div>
    </aside>

    <!-- ============ MAIN ============ -->
    <div class="flex-1 lg:ml-64 min-w-0 flex flex-col min-h-screen">
      <header class="h-14 border-b border-ink-800 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 sticky top-0 bg-ink-950/80 backdrop-blur z-20">
        <button class="lg:hidden size-10 -ml-1 grid place-items-center text-ink-300 hover:text-ink-100 cursor-pointer shrink-0" aria-label="Buka menu" @click="sidebarOpen = true">
          <span class="text-lg leading-none">☰</span>
        </button>

        <form class="flex-1 max-w-xl" @submit.prevent="doSearch">
          <input
            v-model="search"
            class="input h-9 w-full"
            placeholder="Cari file…"
            spellcheck="false"
          />
        </form>

        <div class="flex-1 hidden sm:block" />

        <button class="btn-ghost h-9 px-2.5 text-xs shrink-0" title="Ganti tema" @click="toggleTheme()">
          <span class="dark:hidden">☾</span>
          <span class="hidden dark:inline">☀</span>
        </button>

        <!-- profil dropdown -->
        <div class="relative shrink-0">
          <button class="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 hover:bg-ink-800 transition-colors" @click="profileOpen = !profileOpen">
            <img v-if="me?.image" :src="me.image" alt="" class="size-8 rounded-full object-cover border border-ink-600" />
            <div v-else class="size-8 rounded-full bg-ink-800 border border-ink-600 grid place-items-center font-bold text-xs text-ink-300">
              {{ (me?.name || '?')[0]?.toUpperCase() }}
            </div>
            <span class="text-sm font-semibold hidden md:block max-w-32 truncate">{{ me?.name }}</span>
          </button>
          <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-1" leave-active-class="transition duration-100" leave-to-class="opacity-0">
            <div v-if="profileOpen" class="absolute right-0 top-full mt-1 w-56 card shadow-xl z-50 overflow-hidden">
              <div class="px-4 py-3 border-b border-ink-800">
                <p class="text-sm font-semibold truncate">{{ me?.name }}</p>
                <p class="font-mono text-[11px] text-ink-400 truncate">{{ me?.email }}</p>
              </div>
              <button class="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer" @click="openProfile">✎ Edit Profil</button>
              <button v-if="isSuperAdmin" class="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer" @click="showBranding = true; profileOpen = false">🎨 Edit Nama &amp; Logo</button>
              <button class="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-ink-800 transition-colors cursor-pointer border-t border-ink-800" @click="logout">↪ Logout</button>
            </div>
          </Transition>
        </div>
      </header>

      <main class="flex-1 p-4 sm:p-6 pb-24 lg:pb-6">
        <slot />
      </main>
    </div>

    <!-- antrean upload (progress per file) -->
    <DriveUploadTray />

    <!-- speed-dial FAB (mobile): Upload file / Folder baru -->
    <div v-if="ctx.canUpload && !sidebarOpen" class="lg:hidden">
      <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
        <div v-if="fabOpen" class="fixed inset-0 z-30 bg-ink-950/50 backdrop-blur-[2px]" @click="fabOpen = false" />
      </Transition>

      <div class="fixed z-40 right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col items-end gap-3">
        <!-- aksi (muncul saat terbuka) -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-3 scale-95"
          leave-active-class="transition duration-150 ease-in"
          leave-to-class="opacity-0 translate-y-3 scale-95"
        >
          <div v-if="fabOpen" class="flex flex-col items-end gap-3 origin-bottom-right">
            <button class="flex items-center gap-2.5 cursor-pointer" @click="triggerFolder">
              <span class="rounded-lg bg-ink-850 border border-ink-700 px-3 py-1.5 text-sm font-semibold shadow-lg">Folder baru</span>
              <span class="size-12 rounded-full bg-ink-850 border border-ink-700 grid place-items-center text-lg text-glow shadow-lg">▸</span>
            </button>
            <button class="flex items-center gap-2.5 cursor-pointer" @click="triggerUpload">
              <span class="rounded-lg bg-ink-850 border border-ink-700 px-3 py-1.5 text-sm font-semibold shadow-lg">Upload file</span>
              <span class="size-12 rounded-full bg-ink-850 border border-ink-700 grid place-items-center text-lg text-glow shadow-lg">↑</span>
            </button>
          </div>
        </Transition>

        <!-- tombol utama -->
        <button
          class="size-14 rounded-2xl bg-glow text-ink-950 text-2xl font-black shadow-xl grid place-items-center cursor-pointer active:scale-95 transition-transform"
          :aria-label="fabOpen ? 'Tutup' : 'Buat baru'"
          :aria-expanded="fabOpen"
          @click="fabOpen = !fabOpen"
        >
          <span class="inline-block transition-transform duration-200" :class="fabOpen && 'rotate-45'">+</span>
        </button>
      </div>
    </div>

    <!-- Edit Profil -->
    <Modal :open="showProfile" title="Edit Profil" @close="showProfile = false">
      <form class="space-y-4" @submit.prevent="saveProfile">
        <div class="flex items-center gap-4">
          <img v-if="me?.image" :src="me.image" alt="" class="size-14 rounded-full object-cover border border-ink-600" />
          <div v-else class="size-14 rounded-full bg-ink-800 border border-ink-600 grid place-items-center font-bold text-ink-300">
            {{ (me?.name || '?')[0]?.toUpperCase() }}
          </div>
          <div>
            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif" class="hidden" @change="onAvatar" />
            <button type="button" class="btn-ghost h-9" @click="avatarInput?.click()">📷 Ganti Foto</button>
          </div>
        </div>
        <div>
          <label class="label">Nama</label>
          <input v-model="profileForm.name" class="input" />
        </div>
        <div class="border-t border-ink-800 pt-4 space-y-3">
          <p class="label mb-0">Ganti Password <span class="normal-case tracking-normal">(opsional)</span></p>
          <input v-model="profileForm.currentPassword" type="password" class="input" placeholder="password saat ini" autocomplete="current-password" />
          <input v-model="profileForm.newPassword" type="password" class="input" placeholder="password baru, min. 8 karakter" autocomplete="new-password" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showProfile = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="savingProfile">Simpan</button>
        </div>
      </form>
    </Modal>

    <!-- Edit Nama & Logo (super admin) -->
    <DriveBrandingModal :open="showBranding" @close="showBranding = false" />
  </div>
</template>
