<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const route = useRoute()
const token = String(route.params.token)

// metadata publik (selalu 200 — pakai flag found/expired/isFolder)
const { data: meta } = await useFetch<any>(`/api/s/${token}`)

const MAX_TEXT = 1024 * 1024
const password = ref('')
const unlocked = ref(false)
const accessError = ref('')
const loadingAccess = ref(false)
const downloading = ref(false)

// ---- klaim otomatis ke akun (kalau pengunjung sudah login) ----
const loggedIn = ref(false)
const sessionChecked = ref(false)
const claimed = ref<{ fileId: string; isFolder: boolean; already: boolean } | null>(null)
let claimTried = false
async function maybeClaim() {
  if (claimTried || !loggedIn.value) return
  claimTried = true
  try {
    const res: any = await $fetch(`/api/s/${token}/claim`, {
      method: 'POST',
      body: { password: password.value || undefined },
    })
    if (res?.claimed) claimed.value = { fileId: res.fileId, isFolder: res.isFolder, already: !!res.already }
  } catch {
    // gagal klaim tidak boleh mengganggu tampilan publik
  }
}

// ---- akses (tukar token → presigned URL); fileId dipakai untuk link folder ----
async function fetchAccess(download = false, fileId?: string) {
  const res: any = await $fetch(`/api/s/${token}/access`, {
    method: 'POST',
    body: { password: password.value || undefined, download, fileId },
  })
  return res.url as string
}

// =================== MODE FILE (link ke satu file) ===================
const kind = computed(() => (meta.value?.name ? previewKind(meta.value.name) : null))
const url = ref('')
const textContent = ref('')

async function unlock() {
  if (!meta.value?.found || meta.value.expired) return
  loadingAccess.value = true
  accessError.value = ''
  try {
    url.value = await fetchAccess(false)
    unlocked.value = true
    maybeClaim()
    if (kind.value === 'text' && (meta.value.size || 0) <= MAX_TEXT) {
      const r = await fetch(url.value)
      if (r.ok) textContent.value = await r.text()
    }
  } catch (e: any) {
    accessError.value = apiError(e)
  } finally {
    loadingAccess.value = false
  }
}

async function downloadFile() {
  downloading.value = true
  accessError.value = ''
  try {
    const u = await fetchAccess(true)
    triggerDownload(u, meta.value?.name || 'download')
    if (meta.value) meta.value.downloads = (meta.value.downloads || 0) + 1
  } catch (e: any) {
    accessError.value = apiError(e)
  } finally {
    downloading.value = false
  }
}

// =================== MODE FOLDER (link ke folder) ===================
const rootFolder = ref<{ id: string; name: string } | null>(null)
const crumbs = ref<{ id: string; name: string }[]>([])
const items = ref<any[]>([])
// auto-browse jalan di onMounted (client) → mulai dengan "memuat…" biar tak kedip "kosong"
const willAutoBrowseFolder =
  meta.value?.found && !meta.value?.expired && meta.value?.isFolder && !meta.value?.hasPassword
const listLoading = ref(!!willAutoBrowseFolder)
const listError = ref('')

async function browse(folderId = '') {
  listLoading.value = true
  listError.value = ''
  try {
    const res: any = await $fetch(`/api/s/${token}/browse`, {
      method: 'POST',
      body: { password: password.value || undefined, folder: folderId || undefined },
    })
    rootFolder.value = res.root
    crumbs.value = res.crumbs
    items.value = res.items
    unlocked.value = true
    accessError.value = ''
    maybeClaim()
  } catch (e: any) {
    // sebelum unlock → error tampil di gerbang password; sesudahnya → di area list
    if (!unlocked.value) accessError.value = apiError(e)
    else listError.value = apiError(e)
  } finally {
    listLoading.value = false
  }
}

// preview satu file di dalam folder (overlay)
const pv = ref<any>(null)
const pvUrl = ref('')
const pvText = ref('')
const pvLoading = ref(false)
const pvError = ref('')
const pvKind = computed(() => (pv.value ? previewKind(pv.value.name) : null))

async function openItem(o: any) {
  if (o.isFolder) return browse(o.id)
  pv.value = o
  pvUrl.value = ''
  pvText.value = ''
  pvError.value = ''
  pvLoading.value = true
  try {
    pvUrl.value = await fetchAccess(false, o.id)
    if (pvKind.value === 'text' && (o.size || 0) <= MAX_TEXT) {
      const r = await fetch(pvUrl.value)
      if (r.ok) pvText.value = await r.text()
    }
  } catch (e: any) {
    pvError.value = apiError(e)
  } finally {
    pvLoading.value = false
  }
}
function closePv() {
  pv.value = null
  pvUrl.value = ''
  pvText.value = ''
}

async function download(o: any) {
  try {
    const u = await fetchAccess(true, o.id)
    triggerDownload(u, o.name)
  } catch (e: any) {
    if (pv.value?.id === o.id) pvError.value = apiError(e)
    else listError.value = apiError(e)
  }
}

// =================== bersama ===================
function triggerDownload(u: string, name: string) {
  const a = document.createElement('a')
  a.href = u
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function submitGate() {
  if (meta.value?.isFolder) browse()
  else unlock()
}

onMounted(async () => {
  // deteksi sesi dulu supaya maybeClaim() tahu status login saat browse/unlock sukses
  try {
    const { data } = await authClient.getSession()
    loggedIn.value = !!data?.session
  } catch {}
  sessionChecked.value = true
  if (!meta.value?.found || meta.value.expired) return
  if (meta.value.hasPassword) return // tunggu gerbang password
  if (meta.value.isFolder) browse()
  else unlock()
})

useHead({
  title: () => (meta.value?.found && meta.value?.name ? `${meta.value.name} · Yasa Drive` : 'Yasa Drive'),
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- top bar -->
    <header class="h-14 border-b border-ink-800 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <NuxtLink to="/" class="flex items-center gap-2.5">
        <div class="size-8 rounded-lg bg-glow/15 border border-glow/40 grid place-items-center">
          <span class="text-glow font-black text-sm">Y</span>
        </div>
        <p class="font-extrabold tracking-tight">YASA <span class="text-glow">DRIVE</span></p>
      </NuxtLink>
      <button class="btn-ghost h-9 px-2.5 text-xs" title="Ganti tema" @click="toggleTheme()">
        <span class="dark:hidden">☾</span>
        <span class="hidden dark:inline">☀</span>
      </button>
    </header>

    <!-- banner: item ditambahkan ke akun pengunjung yang login -->
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div v-if="claimed" class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-2.5 bg-glow/10 border-b border-glow/30 text-sm">
        <span class="text-glow font-semibold">✓</span>
        <span class="flex-1 min-w-40">
          {{ claimed.already ? `${claimed.isFolder ? 'Folder' : 'File'} ini sudah ada di Drive kamu.` : `${claimed.isFolder ? 'Folder' : 'File'} ditambahkan ke Drive kamu.` }}
        </span>
        <NuxtLink
          :to="claimed.isFolder ? `/drive/folder/${claimed.fileId}` : '/drive/shared-with-me'"
          class="btn-primary h-9 text-xs shrink-0"
        >Buka di Drive saya</NuxtLink>
      </div>
    </Transition>

    <!-- CTA anonim: login/daftar biar item nempel ke akun (dapat izin sesuai link) -->
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div
        v-if="sessionChecked && !loggedIn && meta?.found && !meta?.expired"
        class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-6 py-2.5 border-b border-ink-800 bg-ink-900/40 text-sm"
      >
        <span class="flex-1 min-w-40 text-ink-300">
          Punya akun? <span class="hidden sm:inline">Login biar {{ meta.isFolder ? 'folder' : 'file' }} ini otomatis nempel di Drive kamu.</span>
        </span>
        <NuxtLink :to="`/?redirect=${encodeURIComponent('/s/' + token)}`" class="btn-primary h-9 text-xs shrink-0">Login</NuxtLink>
        <NuxtLink :to="`/register?redirect=${encodeURIComponent('/s/' + token)}`" class="btn-ghost h-9 text-xs shrink-0">Daftar</NuxtLink>
      </div>
    </Transition>

    <main class="flex-1 grid place-items-center p-4 sm:p-6">
      <!-- tidak ditemukan / dicabut -->
      <div v-if="!meta?.found" class="card p-8 sm:p-10 max-w-md w-full text-center rise">
        <p class="text-5xl mb-3">🔍</p>
        <h1 class="text-xl font-extrabold tracking-tight">Link tidak ditemukan</h1>
        <p class="text-ink-400 text-sm mt-2">Tautan ini salah, sudah dicabut, atau isinya sudah dihapus.</p>
        <NuxtLink to="/" class="btn-ghost mt-6">Ke Yasa Drive</NuxtLink>
      </div>

      <!-- kedaluwarsa -->
      <div v-else-if="meta.expired" class="card p-8 sm:p-10 max-w-md w-full text-center rise">
        <p class="text-5xl mb-3">⌛</p>
        <h1 class="text-xl font-extrabold tracking-tight">Link kedaluwarsa</h1>
        <p class="text-ink-400 text-sm mt-2">
          Tautan untuk <span class="font-mono text-ink-200">{{ meta.name }}</span> sudah lewat masa berlaku.
        </p>
        <NuxtLink to="/" class="btn-ghost mt-6">Ke Yasa Drive</NuxtLink>
      </div>

      <!-- gerbang password (file & folder) -->
      <div v-else-if="meta.hasPassword && !unlocked" class="card p-8 sm:p-10 max-w-sm w-full text-center rise">
        <p class="text-4xl mb-3">🔒</p>
        <h2 class="font-bold">{{ meta.isFolder ? 'Folder ini dilindungi password' : 'File ini dilindungi password' }}</h2>
        <p class="text-ink-400 text-sm mt-1">Masukkan password untuk membukanya.</p>
        <form class="flex gap-2 mt-4" @submit.prevent="submitGate">
          <input v-model="password" type="password" class="input" placeholder="password" autocomplete="off" autofocus />
          <button type="submit" class="btn-primary shrink-0" :disabled="(loadingAccess || listLoading) || !password">Buka</button>
        </form>
        <p v-if="accessError" class="font-mono text-xs text-danger mt-3">{{ accessError }}</p>
      </div>

      <!-- ============ FOLDER (browser read-only) ============ -->
      <div v-else-if="meta.isFolder" class="card w-full max-w-4xl overflow-hidden rise">
        <!-- header + breadcrumb -->
        <div class="px-5 py-4 border-b border-ink-800">
          <div class="flex items-center gap-2.5">
            <span class="text-lg shrink-0">📁</span>
            <p class="font-semibold truncate min-w-0 flex-1">{{ rootFolder?.name || meta.name }}</p>
            <span class="badge-ok ml-1 shrink-0">folder publik</span>
          </div>
          <div v-if="crumbs.length > 1" class="flex items-center gap-1.5 font-mono text-xs text-ink-400 flex-wrap mt-2">
            <template v-for="(c, i) in crumbs" :key="c.id">
              <button v-if="i < crumbs.length - 1" class="hover:text-glow transition-colors cursor-pointer" @click="browse(c.id)">{{ c.name }}</button>
              <span v-else class="text-ink-200">{{ c.name }}</span>
              <span v-if="i < crumbs.length - 1" class="text-ink-600">/</span>
            </template>
          </div>
        </div>

        <!-- isi -->
        <div class="min-h-40">
          <p v-if="listLoading" class="text-center text-ink-400 py-12 font-mono text-xs">memuat…</p>
          <p v-else-if="listError" class="text-center text-danger py-12 font-mono text-xs">{{ listError }}</p>
          <template v-else>
            <div class="divide-y divide-ink-800">
              <div
                v-for="o in items"
                :key="o.id"
                class="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-ink-900/50 transition-colors group"
              >
                <button class="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer hover:text-glow transition-colors" @click="openItem(o)">
                  <span class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0" :class="fileChip(o.name, o.isFolder).cls">
                    {{ fileChip(o.name, o.isFolder).label }}
                  </span>
                  <span class="font-mono text-[13px] truncate">{{ o.name }}{{ o.isFolder ? '/' : '' }}</span>
                </button>
                <span class="font-mono text-[11px] text-ink-400 hidden sm:block shrink-0">
                  {{ o.isFolder ? '—' : fmtBytes(o.size) }}
                </span>
                <button
                  v-if="!o.isFolder"
                  class="text-ink-400 hover:text-glow font-mono text-sm cursor-pointer shrink-0 inline-flex items-center justify-center min-w-9 h-9"
                  title="Download"
                  @click.stop="download(o)"
                >↓</button>
              </div>
            </div>
            <p v-if="!items.length" class="text-center text-ink-400 py-14">Folder ini kosong.</p>
          </template>
        </div>
      </div>

      <!-- ============ FILE ============ -->
      <div v-else class="card w-full max-w-3xl overflow-hidden rise">
        <!-- info file -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-ink-800">
          <span class="inline-flex w-11 justify-center rounded border font-mono text-[11px] px-1.5 py-1 shrink-0" :class="fileChip(meta.name).cls">
            {{ fileChip(meta.name).label }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold truncate">{{ meta.name }}</p>
            <p class="font-mono text-[11px] text-ink-400">{{ fmtBytes(meta.size) }} · {{ meta.downloads }}× diunduh</p>
          </div>
          <button v-if="unlocked" class="btn-primary shrink-0" :disabled="downloading" @click="downloadFile">
            {{ downloading ? '…' : '↓ Download' }}
          </button>
        </div>

        <!-- preview -->
        <div class="p-5">
          <div class="min-h-48 grid place-items-center">
            <p v-if="loadingAccess" class="font-mono text-xs text-ink-400">memuat preview…</p>
            <p v-else-if="accessError" class="font-mono text-xs text-danger text-center">{{ accessError }}</p>
            <template v-else-if="url">
              <img v-if="kind === 'image'" :src="url" :alt="meta.name" class="max-h-[65vh] max-w-full rounded-lg object-contain" />
              <video v-else-if="kind === 'video'" :src="url" controls class="max-h-[65vh] max-w-full rounded-lg" />
              <audio v-else-if="kind === 'audio'" :src="url" controls class="w-full" />
              <iframe v-else-if="kind === 'pdf'" :src="url" class="w-full h-[70vh] rounded-lg border border-ink-700 bg-white" />
              <pre v-else-if="kind === 'text' && textContent" class="w-full max-h-[65vh] overflow-auto bg-ink-900 border border-ink-700 rounded-lg p-4 font-mono text-xs text-ink-200 whitespace-pre-wrap break-words">{{ textContent }}</pre>
              <div v-else class="text-center py-10">
                <p class="text-4xl mb-3">📄</p>
                <p class="text-ink-300">Tipe file ini tidak bisa dipreview.</p>
                <button class="btn-primary mt-4" :disabled="downloading" @click="downloadFile">↓ Download file</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>

    <!-- overlay preview file (mode folder) -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div v-if="pv" class="fixed inset-0 z-50 bg-ink-950/85 backdrop-blur-sm flex flex-col p-4 sm:p-8" @click.self="closePv">
          <div class="flex items-center gap-3 mb-4 max-w-4xl w-full mx-auto">
            <span class="inline-flex w-10 justify-center rounded border font-mono text-[10px] px-1 py-0.5 shrink-0" :class="fileChip(pv.name).cls">
              {{ fileChip(pv.name).label }}
            </span>
            <p class="font-semibold truncate flex-1 text-ink-100">{{ pv.name }}</p>
            <button class="btn-primary h-9 shrink-0" @click="download(pv)">↓ Download</button>
            <button class="btn-ghost h-9 shrink-0" @click="closePv">✕</button>
          </div>
          <div class="flex-1 min-h-0 grid place-items-center overflow-auto max-w-4xl w-full mx-auto" @click.self="closePv">
            <p v-if="pvLoading" class="font-mono text-xs text-ink-400">memuat preview…</p>
            <p v-else-if="pvError" class="font-mono text-xs text-danger text-center">{{ pvError }}</p>
            <template v-else-if="pvUrl">
              <img v-if="pvKind === 'image'" :src="pvUrl" :alt="pv.name" class="max-h-full max-w-full rounded-lg object-contain" />
              <video v-else-if="pvKind === 'video'" :src="pvUrl" controls class="max-h-full max-w-full rounded-lg" />
              <audio v-else-if="pvKind === 'audio'" :src="pvUrl" controls class="w-full max-w-lg" />
              <iframe v-else-if="pvKind === 'pdf'" :src="pvUrl" class="w-full h-full rounded-lg border border-ink-700 bg-white" />
              <pre v-else-if="pvKind === 'text' && pvText" class="w-full max-h-full overflow-auto bg-ink-900 border border-ink-700 rounded-lg p-4 font-mono text-xs text-ink-200 whitespace-pre-wrap break-words">{{ pvText }}</pre>
              <div v-else class="text-center py-10">
                <p class="text-4xl mb-3">📄</p>
                <p class="text-ink-300">Tipe file ini tidak bisa dipreview.</p>
                <button class="btn-primary mt-4" @click="download(pv)">↓ Download file</button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <footer class="shrink-0 py-4 text-center">
      <p class="font-mono text-[11px] text-ink-500">
        Dibagikan lewat <NuxtLink to="/" class="text-glow hover:underline">Yasa Drive</NuxtLink>
      </p>
    </footer>
  </div>
</template>
