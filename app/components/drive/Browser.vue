<script setup lang="ts">
const props = defineProps<{
  mode: 'browse' | 'recent' | 'starred' | 'trash' | 'search'
  parent?: string
  team?: string
  owner?: string // super admin: jelajah root Drive pribadi user lain
  q?: string
}>()

const toast = useToast()
const ctx = useDriveCtx()
const signals = useDriveSignals()
const upload = useUpload()
const session = authClient.useSession()
const myId = computed(() => session.value?.data?.user?.id)

// ---------- data ----------
const apiUrl = computed(() => {
  if (props.mode === 'browse') {
    if (props.parent) return `/api/drive/browse?parent=${encodeURIComponent(props.parent)}`
    if (props.team) return `/api/drive/browse?team=${encodeURIComponent(props.team)}`
    if (props.owner) return `/api/drive/browse?owner=${encodeURIComponent(props.owner)}`
    return '/api/drive/browse'
  }
  return `/api/drive/special?view=${props.mode}&q=${encodeURIComponent(props.q || '')}`
})
const { data, refresh, status } = useFetch(apiUrl, { server: false })

const items = computed<any[]>(() => (data.value as any)?.items || [])
const folder = computed(() => (props.mode === 'browse' ? (data.value as any)?.folder : null))
const teamRoot = computed(() => (props.mode === 'browse' ? (data.value as any)?.team : null))
const ownerRoot = computed(() => (props.mode === 'browse' ? (data.value as any)?.ownerRoot : null))
const crumbs = computed(() => (props.mode === 'browse' ? (data.value as any)?.crumbs || [] : []))
const access = computed(() => (props.mode === 'browse' ? (data.value as any)?.access || null : null))
const canWrite = computed(() => props.mode === 'browse' && ['owner', 'editor'].includes(access.value))
const isPersonalRoot = computed(() => props.mode === 'browse' && !props.parent && !props.team && !props.owner)

const TITLES: Record<string, string> = {
  recent: 'Terbaru',
  starred: 'Berbintang',
  trash: 'Sampah',
  search: 'Hasil Pencarian',
}
const title = computed(() => {
  if (props.mode !== 'browse') return TITLES[props.mode]
  if (folder.value) return folder.value.name
  if (teamRoot.value) return teamRoot.value.name
  if (ownerRoot.value) return `Drive: ${ownerRoot.value.name}`
  return 'Drive Saya'
})

// beritahu layout: lokasi aktif & boleh upload atau tidak.
// mode owner (super lihat drive user lain) = read-only dari sisi UI → no upload.
watch(
  [data, () => props.parent, () => props.team, () => props.owner],
  () => {
    ctx.value = {
      parent: props.parent || '',
      canUpload: !props.owner && (isPersonalRoot.value || canWrite.value),
      label: title.value || '',
    }
  },
  { immediate: true },
)
onUnmounted(() => (ctx.value = { parent: '', canUpload: false, label: '' }))

// upload di lokasi mana pun selesai → refresh listing di sini
watch(() => signals.value.uploadRefresh, () => refresh())

// ---------- view mode ----------
const view = ref<'list' | 'grid'>('list')
onMounted(() => {
  const saved = localStorage.getItem('drive-view')
  if (saved === 'grid' || saved === 'list') view.value = saved
})
watch(view, (v) => localStorage.setItem('drive-view', v))

// ---------- thumbnail ----------
const thumbs = ref<Record<string, string>>({})
watch(
  [view, items],
  async () => {
    if (view.value !== 'grid') return
    const ids = items.value
      .filter((o) => !o.isFolder && previewKind(o.name) === 'image' && !thumbs.value[o.id])
      .map((o) => o.id)
    if (!ids.length) return
    try {
      const res: any = await $fetch('/api/drive/urls-batch', { method: 'POST', body: { ids } })
      thumbs.value = { ...thumbs.value, ...res.urls }
    } catch {}
  },
  { immediate: true },
)

// ---------- upload (via antrean global) ----------
const fileInput = ref<HTMLInputElement>()
watch(() => signals.value.upload, () => {
  if (ctx.value.canUpload) fileInput.value?.click()
})
function onUpload(e: Event) {
  const list = (e.target as HTMLInputElement).files
  if (list?.length) upload.enqueue(list, { parent: props.parent || '', team: props.team || '' })
  if (fileInput.value) fileInput.value.value = ''
}

// ---------- drag & drop ----------
const dragActive = ref(false)
let dragDepth = 0
function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types || []).includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (!ctx.value.canUpload || !hasFiles(e)) return
  dragDepth++
  dragActive.value = true
}
function onDragLeave() {
  if (!ctx.value.canUpload) return
  dragDepth--
  if (dragDepth <= 0) {
    dragDepth = 0
    dragActive.value = false
  }
}
function onDrop(e: DragEvent) {
  dragDepth = 0
  dragActive.value = false
  if (!ctx.value.canUpload) return
  const f = e.dataTransfer?.files
  if (f?.length) {
    upload.enqueue(f, { parent: props.parent || '', team: props.team || '' })
    toast.info(`${f.length} file ditambahkan ke antrean`)
  }
}

// ---------- multi-select ----------
const selected = ref<Set<string>>(new Set())
const selItems = computed(() => items.value.filter((o) => selected.value.has(o.id)))
const allSelected = computed(() => items.value.length > 0 && selected.value.size === items.value.length)
const selAllOwned = computed(() => selItems.value.length > 0 && selItems.value.every((o) => isOwner(o)))
const selHasFiles = computed(() => selItems.value.some((o) => !o.isFolder))
const bulkBusy = ref(false)

// tiap listing berubah, buang seleksi yang stale
watch(data, () => clearSel())

function toggleSel(id: string) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(items.value.map((o) => o.id))
}
function clearSel() {
  selected.value = new Set()
}

async function bulkTrash() {
  bulkBusy.value = true
  try {
    const targets = selItems.value.filter(isOwner)
    for (const o of targets) await $fetch(`/api/drive/files/${o.id}`, { method: 'DELETE' })
    toast.ok(`${targets.length} item dipindah ke sampah`)
    clearSel()
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    bulkBusy.value = false
  }
}
async function bulkDownload() {
  const targets = selItems.value.filter((o) => !o.isFolder)
  for (const o of targets) {
    try {
      const { url } = await $fetch<{ url: string }>(`/api/drive/files/${o.id}/url`)
      const a = document.createElement('a')
      a.href = url
      a.download = o.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      await new Promise((r) => setTimeout(r, 250))
    } catch {}
  }
}
async function bulkRestore() {
  bulkBusy.value = true
  try {
    for (const o of selItems.value) await $fetch(`/api/drive/files/${o.id}/restore`, { method: 'POST' })
    toast.ok(`${selItems.value.length} item dipulihkan`)
    clearSel()
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    bulkBusy.value = false
  }
}
const confirmBulkPermanent = ref(false)
async function bulkPermanent() {
  bulkBusy.value = true
  try {
    for (const o of selItems.value) await $fetch(`/api/drive/files/${o.id}?permanent=1`, { method: 'DELETE' })
    toast.ok('Terhapus permanen')
    confirmBulkPermanent.value = false
    clearSel()
    signals.value.usageRefresh++
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    bulkBusy.value = false
  }
}

// ---------- folder baru ----------
const showFolder = ref(false)
const folderName = ref('')
const creatingFolder = ref(false)
watch(() => signals.value.folder, () => {
  if (ctx.value.canUpload) {
    folderName.value = ''
    showFolder.value = true
  }
})
async function createFolder() {
  if (creatingFolder.value) return // cegah double-submit (Enter di-spam)
  const name = folderName.value.trim()
  if (!name) return
  creatingFolder.value = true
  try {
    await $fetch('/api/drive/folders', {
      method: 'POST',
      body: { name, parent: props.parent || '', team: props.parent ? '' : props.team || '' },
    })
    toast.ok('Folder dibuat')
    showFolder.value = false
    folderName.value = ''
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    creatingFolder.value = false
  }
}

// ---------- aksi per item ----------
const menuFor = ref<any>(null)
const previewItem = ref<any>(null)
const shareItem = ref<any>(null)
const moveTargets = ref<any[] | null>(null)
const renameItem = ref<any>(null)
const renameValue = ref('')
const renaming = ref(false)
const copying = ref(false)

function openItem(o: any) {
  if (props.mode === 'trash') {
    menuFor.value = o
    return
  }
  if (o.isFolder) navigateTo(`/drive/folder/${o.id}`)
  else previewItem.value = o
}
function isOwner(o: any) {
  return o.ownerId === myId.value
}

async function download(o: any) {
  try {
    const { url } = await $fetch<{ url: string }>(`/api/drive/files/${o.id}/url`)
    window.open(url, '_blank')
  } catch (e: any) {
    toast.error(apiError(e))
  }
}
async function toggleStar(o: any) {
  try {
    await $fetch(`/api/drive/files/${o.id}`, { method: 'PATCH', body: { starred: !o.starred } })
    menuFor.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}
function startRename(o: any) {
  menuFor.value = null
  renameItem.value = o
  renameValue.value = o.name
}
async function doRename() {
  if (renaming.value) return
  const name = renameValue.value.trim()
  if (!name) return
  renaming.value = true
  try {
    await $fetch(`/api/drive/files/${renameItem.value.id}`, { method: 'PATCH', body: { name } })
    toast.ok('Nama diubah')
    renameItem.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    renaming.value = false
  }
}
async function copyItem(o: any) {
  if (copying.value) return
  copying.value = true
  try {
    const res: any = await $fetch(`/api/drive/files/${o.id}/copy`, { method: 'POST' })
    toast.ok(`Salinan dibuat: ${res.name}`)
    menuFor.value = null
    signals.value.usageRefresh++
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    copying.value = false
  }
}
async function trash(o: any) {
  try {
    await $fetch(`/api/drive/files/${o.id}`, { method: 'DELETE' })
    toast.ok(`"${o.name}" dipindah ke sampah`)
    menuFor.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}
async function restore(o: any) {
  try {
    await $fetch(`/api/drive/files/${o.id}/restore`, { method: 'POST' })
    toast.ok(`"${o.name}" dipulihkan`)
    menuFor.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}
const confirmPermanent = ref<any>(null)
async function deletePermanent() {
  try {
    await $fetch(`/api/drive/files/${confirmPermanent.value.id}?permanent=1`, { method: 'DELETE' })
    toast.ok('Dihapus permanen')
    confirmPermanent.value = null
    menuFor.value = null
    signals.value.usageRefresh++
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

async function onMoved() {
  moveTargets.value = null
  clearSel()
  signals.value.usageRefresh++ // pindah pribadi↔tim mengubah pemakaian storage
  await refresh()
}
</script>

<template>
  <div
    class="space-y-4 relative"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- overlay drag & drop -->
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
      <div
        v-if="dragActive"
        class="absolute inset-0 z-30 rounded-xl border-2 border-dashed border-glow bg-ink-950/70 backdrop-blur-sm grid place-items-center pointer-events-none"
      >
        <div class="text-center">
          <p class="text-4xl mb-2 text-glow">⬇</p>
          <p class="font-semibold text-glow">Lepas untuk upload ke {{ title }}</p>
        </div>
      </div>
    </Transition>

    <!-- header -->
    <div class="flex flex-wrap items-center gap-3 rise">
      <div class="min-w-0 flex-1">
        <div v-if="mode === 'browse' && crumbs.length" class="flex items-center gap-1.5 font-mono text-xs text-ink-400 flex-wrap mb-1">
          <NuxtLink
            :to="teamRoot ? `/drive/team/${teamRoot.id}` : '/drive'"
            class="hover:text-glow transition-colors"
          >{{ teamRoot ? teamRoot.name : 'Drive Saya' }}</NuxtLink>
          <template v-for="(c, i) in crumbs" :key="c.id">
            <span class="text-ink-600">/</span>
            <NuxtLink v-if="i < crumbs.length - 1" :to="`/drive/folder/${c.id}`" class="hover:text-glow transition-colors">{{ c.name }}</NuxtLink>
            <span v-else class="text-ink-200">{{ c.name }}</span>
          </template>
        </div>
        <span v-else-if="teamRoot" class="inline-flex badge-ok mb-1">bucket bersama</span>
        <span v-else-if="ownerRoot" class="inline-flex badge-ok mb-1">akses super admin · drive user lain</span>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{{ title }}</h1>
        <!-- role kamu di folder yang dibagikan (bukan milik sendiri) -->
        <span
          v-if="mode === 'browse' && (access === 'viewer' || access === 'editor')"
          :class="['inline-flex mt-1', permBadgeClass(access)]"
          :title="access === 'editor' ? 'kamu bisa upload & ubah di sini' : 'kamu hanya bisa lihat & download'"
        >akses kamu: {{ permLabel(access) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-ink-600 overflow-hidden h-9">
          <button class="px-3 text-sm transition-colors cursor-pointer" :class="view === 'list' ? 'bg-glow/15 text-glow' : 'text-ink-400 hover:text-ink-100'" title="Tampilan list" @click="view = 'list'">☰</button>
          <button class="px-3 text-sm transition-colors cursor-pointer border-l border-ink-600" :class="view === 'grid' ? 'bg-glow/15 text-glow' : 'text-ink-400 hover:text-ink-100'" title="Tampilan grid" @click="view = 'grid'">⊞</button>
        </div>
        <button v-if="ctx.canUpload" class="btn-ghost h-9 hidden sm:inline-flex" @click="showFolder = true">+ Folder</button>
      </div>
    </div>

    <input ref="fileInput" type="file" multiple class="hidden" @change="onUpload" />

    <!-- ============ ACTION BAR (multi-select) ============ -->
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-100" leave-to-class="opacity-0 -translate-y-2">
      <div v-if="selected.size" class="sticky top-14 z-10 flex flex-wrap items-center gap-2 card px-3 py-2 shadow-lg">
        <button class="size-7 grid place-items-center text-ink-400 hover:text-ink-100 cursor-pointer" title="Batal pilih" @click="clearSel">✕</button>
        <span class="font-mono text-xs text-ink-200">{{ selected.size }} dipilih</span>
        <div class="flex-1" />
        <template v-if="mode === 'trash'">
          <button class="btn-ghost h-8 text-xs" :disabled="bulkBusy" @click="bulkRestore">↩ Pulihkan</button>
          <button class="btn-danger h-8 text-xs" :disabled="bulkBusy" @click="confirmBulkPermanent = true">🗑 Hapus permanen</button>
        </template>
        <template v-else>
          <button class="btn-ghost h-8 text-xs" :disabled="!selHasFiles || bulkBusy" @click="bulkDownload">↓ Download</button>
          <button class="btn-ghost h-8 text-xs" :disabled="!selAllOwned || bulkBusy" :title="selAllOwned ? '' : 'ada item yang bukan milikmu'" @click="moveTargets = [...selItems]">⇄ Pindahkan</button>
          <button class="btn-danger h-8 text-xs" :disabled="!selAllOwned || bulkBusy" :title="selAllOwned ? '' : 'ada item yang bukan milikmu'" @click="bulkTrash">🗑 Sampah</button>
        </template>
      </div>
    </Transition>

    <!-- ============ GRID ============ -->
    <div v-if="view === 'grid'" class="rise">
      <p v-if="status === 'pending' || status === 'idle'" class="text-center text-ink-400 py-12 font-mono text-xs">memuat…</p>
      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          <div
            v-for="o in items"
            :key="o.id"
            class="card relative overflow-hidden group transition-colors"
            :class="selected.has(o.id) ? 'ring-2 ring-glow border-glow/50' : 'hover:border-ink-500'"
          >
            <!-- checkbox -->
            <label
              class="absolute top-2 left-2 z-10 cursor-pointer"
              :class="selected.has(o.id) ? '' : 'row-actions'"
              @click.stop
            >
              <input type="checkbox" class="size-4 accent-glow cursor-pointer align-middle" :checked="selected.has(o.id)" @change="toggleSel(o.id)" />
            </label>
            <button
              class="absolute top-2 right-2 z-10 rounded bg-ink-950/80 border border-ink-600 px-2 py-0.5 font-mono text-[11px] text-ink-300 hover:text-glow row-actions cursor-pointer"
              @click.stop="menuFor = o"
            >⋯</button>
            <button class="block w-full text-left cursor-pointer" @click="openItem(o)">
              <div class="aspect-square bg-ink-900 grid place-items-center overflow-hidden">
                <img v-if="thumbs[o.id]" :src="thumbs[o.id]" :alt="o.name" loading="lazy" class="size-full object-cover" />
                <span v-else class="inline-flex rounded border font-mono text-[10px] px-2 py-1" :class="fileChip(o.name, o.isFolder).cls">
                  {{ fileChip(o.name, o.isFolder).label }}
                </span>
              </div>
              <div class="p-2.5 border-t border-ink-800">
                <p class="font-mono text-[11px] truncate">
                  <span v-if="o.starred" class="text-glow">★ </span>{{ o.name }}{{ o.isFolder ? '/' : '' }}
                </p>
                <p class="font-mono text-[10px] text-ink-500 mt-0.5">
                  {{ isOwner(o) ? 'kamu' : o.ownerName }} · {{ o.isFolder ? 'folder' : fmtBytes(o.size) }}
                </p>
              </div>
            </button>
          </div>
        </div>
        <p v-if="!items.length" class="text-center text-ink-400 py-14">
          {{ mode === 'trash' ? 'Sampah kosong.' : mode === 'search' ? 'Tidak ada hasil.' : 'Belum ada apa-apa di sini.' }}
        </p>
      </template>
    </div>

    <!-- ============ LIST ============ -->
    <div v-else class="card overflow-x-auto rise">
      <table class="tbl">
        <thead>
          <tr>
            <th class="w-10">
              <input v-if="items.length" type="checkbox" class="size-4 accent-glow cursor-pointer align-middle" :checked="allSelected" @change="toggleAll" />
            </th>
            <th>Nama</th>
            <th class="w-36 hidden sm:table-cell">Pemilik</th>
            <th class="w-24">Ukuran</th>
            <th class="w-40 hidden md:table-cell">{{ mode === 'trash' ? 'Dihapus' : 'Diubah' }}</th>
            <th class="w-12" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="6" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <template v-else>
            <tr v-for="o in items" :key="o.id" class="group" :class="selected.has(o.id) && 'bg-glow/5'">
              <td @click.stop>
                <input type="checkbox" class="size-4 accent-glow cursor-pointer align-middle" :checked="selected.has(o.id)" @change="toggleSel(o.id)" />
              </td>
              <td>
                <button class="flex items-center gap-2.5 min-w-0 w-full text-left cursor-pointer hover:text-glow transition-colors" @click="openItem(o)">
                  <span class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0" :class="fileChip(o.name, o.isFolder).cls">
                    {{ fileChip(o.name, o.isFolder).label }}
                  </span>
                  <span class="font-mono text-[13px] truncate">{{ o.name }}{{ o.isFolder ? '/' : '' }}</span>
                  <span v-if="o.starred" class="text-glow text-xs shrink-0">★</span>
                </button>
              </td>
              <td class="text-xs text-ink-300 hidden sm:table-cell truncate max-w-36">
                {{ isOwner(o) ? 'kamu' : o.ownerName }}
              </td>
              <td class="font-mono text-xs text-ink-300">{{ o.isFolder ? '—' : fmtBytes(o.size) }}</td>
              <td class="font-mono text-xs text-ink-300 hidden md:table-cell">{{ fmtDate(mode === 'trash' ? o.deletedAt : o.updatedAt) }}</td>
              <td class="text-right">
                <button class="row-actions text-ink-400 hover:text-glow font-mono cursor-pointer px-1" @click="menuFor = o">⋯</button>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="6" class="text-center text-ink-400 py-12">
                {{ mode === 'trash' ? 'Sampah kosong.' : mode === 'search' ? 'Tidak ada hasil.' : 'Belum ada apa-apa di sini.' }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ============ modal aksi ============ -->
    <Modal :open="!!menuFor" :title="menuFor?.name || ''" @close="menuFor = null">
      <div class="grid gap-1.5">
        <template v-if="mode !== 'trash'">
          <button v-if="!menuFor?.isFolder" class="btn-ghost justify-start" @click="previewItem = menuFor; menuFor = null">👁 Preview</button>
          <button v-if="menuFor?.isFolder" class="btn-ghost justify-start" @click="navigateTo(`/drive/folder/${menuFor.id}`); menuFor = null">▸ Buka folder</button>
          <button v-if="!menuFor?.isFolder" class="btn-ghost justify-start" @click="download(menuFor); menuFor = null">↓ Download</button>
          <button v-if="isOwner(menuFor)" class="btn-ghost justify-start" @click="shareItem = menuFor; menuFor = null">⇗ Bagikan</button>
          <button v-if="isOwner(menuFor)" class="btn-ghost justify-start" @click="toggleStar(menuFor)">
            {{ menuFor?.starred ? '☆ Hapus bintang' : '★ Beri bintang' }}
          </button>
          <button v-if="!owner && (isOwner(menuFor) || canWrite)" class="btn-ghost justify-start" @click="startRename(menuFor)">✎ Ganti nama</button>
          <button v-if="isOwner(menuFor) || canWrite" class="btn-ghost justify-start" :disabled="copying" @click="copyItem(menuFor)">
            {{ copying ? '⧉ Menyalin…' : '⧉ Buat Salinan' }}
          </button>
          <button v-if="isOwner(menuFor)" class="btn-ghost justify-start" @click="moveTargets = [menuFor]; menuFor = null">⇄ Pindahkan</button>
          <button v-if="isOwner(menuFor)" class="btn-danger justify-start" @click="trash(menuFor)">🗑 Pindah ke sampah</button>
        </template>
        <template v-else>
          <button class="btn-ghost justify-start" @click="restore(menuFor)">↩ Pulihkan</button>
          <button class="btn-danger justify-start" @click="confirmPermanent = menuFor">🗑 Hapus permanen</button>
        </template>
      </div>
    </Modal>

    <!-- folder baru -->
    <Modal :open="showFolder" title="Folder Baru" @close="showFolder = false">
      <form class="space-y-4" @submit.prevent="createFolder">
        <input v-model="folderName" class="input" placeholder="nama folder" spellcheck="false" :disabled="creatingFolder" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" :disabled="creatingFolder" @click="showFolder = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="creatingFolder || !folderName.trim()">
            {{ creatingFolder ? 'Membuat…' : 'Buat' }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- rename -->
    <Modal :open="!!renameItem" title="Ganti Nama" @close="renameItem = null">
      <form class="space-y-4" @submit.prevent="doRename">
        <input v-model="renameValue" class="input" spellcheck="false" :disabled="renaming" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" :disabled="renaming" @click="renameItem = null">Batal</button>
          <button type="submit" class="btn-primary" :disabled="renaming || !renameValue.trim()">
            {{ renaming ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- hapus permanen (satuan) -->
    <Modal :open="!!confirmPermanent" title="Hapus Permanen" @close="confirmPermanent = null">
      <p class="text-sm text-ink-200">
        <span class="font-mono text-danger">{{ confirmPermanent?.name }}</span> akan dihapus selamanya
        {{ confirmPermanent?.isFolder ? 'beserta seluruh isinya' : '' }} — tidak bisa dibatalkan.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmPermanent = null">Batal</button>
        <button class="btn-danger" @click="deletePermanent">Hapus Selamanya</button>
      </div>
    </Modal>

    <!-- hapus permanen (banyak) -->
    <Modal :open="confirmBulkPermanent" title="Hapus Permanen" @close="confirmBulkPermanent = false">
      <p class="text-sm text-ink-200">
        <span class="font-mono text-danger">{{ selected.size }} item</span> akan dihapus selamanya beserta seluruh isinya — tidak bisa dibatalkan.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmBulkPermanent = false">Batal</button>
        <button class="btn-danger" :disabled="bulkBusy" @click="bulkPermanent">Hapus Selamanya</button>
      </div>
    </Modal>

    <DriveFilePreview :item="previewItem" @close="previewItem = null" @share="(o: any) => { shareItem = o; previewItem = null }" @download="download" />
    <DriveShareModal :item="shareItem" @close="shareItem = null" />
    <DriveMoveModal :items="moveTargets" @close="moveTargets = null" @moved="onMoved" />
  </div>
</template>
