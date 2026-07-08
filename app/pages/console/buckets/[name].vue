<script setup lang="ts">
definePageMeta({ title: 'Object Browser', layout: 'console' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const bucket = computed(() => route.params.name as string)
const prefix = computed(() => String(route.query.p || ''))

const { data, refresh, status } = useFetch(
  () => `/api/buckets/${encodeURIComponent(bucket.value)}/objects`,
  { query: { prefix }, server: false, watch: [prefix] },
)
const { data: stat, refresh: refreshStat } = useFetch(
  () => `/api/buckets/${encodeURIComponent(bucket.value)}/stat`,
  { server: false },
)

async function refreshAll() {
  await Promise.all([refresh(), refreshStat()])
}

const crumbs = computed(() => {
  const parts = prefix.value.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    label: part,
    prefix: parts.slice(0, i + 1).join('/') + '/',
  }))
})

function goPrefix(p: string) {
  router.push({ query: p ? { p } : {} })
}

function folderName(p: string) {
  return p.slice(prefix.value.length).replace(/\/$/, '')
}
function fileName(key: string) {
  return key.slice(prefix.value.length)
}

// ---- filter ----
const filter = ref('')
watch(prefix, () => (filter.value = ''))
const shownPrefixes = computed(() =>
  (data.value?.prefixes || []).filter((p: string) =>
    folderName(p).toLowerCase().includes(filter.value.toLowerCase()),
  ),
)
const shownObjects = computed(() =>
  (data.value?.objects || []).filter((o: any) =>
    fileName(o.name).toLowerCase().includes(filter.value.toLowerCase()),
  ),
)

// ---- view mode (list / grid) ----
const view = ref<'list' | 'grid'>('list')
onMounted(() => {
  const saved = localStorage.getItem('yasa-view')
  if (saved === 'grid' || saved === 'list') view.value = saved
})
watch(view, (v) => localStorage.setItem('yasa-view', v))

// ---- preview & share ----
const previewObject = ref<any>(null)
const shareKey = ref<string | null>(null)
const isPublicRead = computed(() => ['download', 'public'].includes(String(stat.value?.access)))

// ---- thumbnail grid (presigned inline URL, hanya untuk gambar) ----
const thumbs = ref<Record<string, string>>({})
watch(bucket, () => (thumbs.value = {}))
watch(
  [view, data],
  async () => {
    if (view.value !== 'grid' || !data.value) return
    const keys = (data.value.objects || [])
      .filter((o: any) => previewKind(o.name) === 'image' && !thumbs.value[o.name])
      .map((o: any) => o.name)
    if (!keys.length) return
    try {
      const res: any = await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/presign-batch`, {
        method: 'POST',
        body: { keys },
      })
      thumbs.value = { ...thumbs.value, ...res.urls }
    } catch {}
  },
  { immediate: true },
)

// ---- file type chip ----
const TYPE_MAP: [RegExp, string, string][] = [
  [/\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/i, 'IMG', 'text-ok border-ok/30'],
  [/\.(mp4|mkv|webm|mov|avi)$/i, 'VID', 'text-glow border-glow/30'],
  [/\.(mp3|wav|flac|ogg|m4a)$/i, 'AUD', 'text-glow border-glow/30'],
  [/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i, 'ZIP', 'text-glow border-glow/30'],
  [/\.pdf$/i, 'PDF', 'text-danger border-danger/30'],
  [/\.(docx?|xlsx?|pptx?|txt|md|csv)$/i, 'DOC', 'text-ink-200 border-ink-500'],
  [/\.(js|ts|jsx|tsx|vue|json|html|css|py|go|java|sh|yml|yaml|sql|php|rb)$/i, 'SRC', 'text-ok border-ok/30'],
]
function fileType(name: string) {
  for (const [re, label, cls] of TYPE_MAP) if (re.test(name)) return { label, cls }
  return { label: 'FILE', cls: 'text-ink-400 border-ink-600' }
}

async function copyPath() {
  await navigator.clipboard.writeText(`${bucket.value}/${prefix.value}`)
  toast.ok('Path disalin')
}

// ---- access level ----
const ACCESS_LABELS: Record<string, { text: string; cls: string }> = {
  private: { text: 'private', cls: 'badge-dim' },
  download: { text: 'public read', cls: 'badge-ok' },
  upload: { text: 'public write', cls: 'badge-off' },
  public: { text: 'public r/w', cls: 'badge-off' },
  custom: { text: 'custom policy', cls: 'badge-dim' },
}
const accessInfo = computed(() => ACCESS_LABELS[stat.value?.access || 'private'] || ACCESS_LABELS.private!)

const ACCESS_OPTIONS = [
  { value: 'private', label: 'Private', desc: 'hanya user terautentikasi' },
  { value: 'download', label: 'Public Read', desc: 'siapa pun bisa download via URL langsung' },
  { value: 'upload', label: 'Public Write', desc: 'siapa pun bisa upload tanpa login' },
  { value: 'public', label: 'Public Read+Write', desc: 'terbuka penuh — hati-hati' },
]
const showAccess = ref(false)
const accessLevel = ref('private')
watch(
  () => stat.value?.access,
  (v) => {
    if (v && v !== 'custom') accessLevel.value = v
  },
  { immediate: true },
)
const savingAccess = ref(false)
async function saveAccess() {
  savingAccess.value = true
  try {
    await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/access`, {
      method: 'PUT',
      body: { level: accessLevel.value },
    })
    await refreshStat()
    showAccess.value = false
    toast.ok(`Akses bucket diubah ke ${accessLevel.value}`)
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    savingAccess.value = false
  }
}

// ---- versioning toggle ----
const togglingVersioning = ref(false)
async function toggleVersioning() {
  if (!stat.value) return
  togglingVersioning.value = true
  try {
    await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/versioning`, {
      method: 'PUT',
      body: { enabled: !stat.value.versioning },
    })
    await refreshStat()
    toast.ok(`Versioning ${stat.value?.versioning ? 'diaktifkan' : 'dimatikan'}`)
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    togglingVersioning.value = false
  }
}

// ---- selection ----
const selected = ref<Set<string>>(new Set())
watch(data, () => selected.value.clear())
function toggle(key: string) {
  selected.value.has(key) ? selected.value.delete(key) : selected.value.add(key)
  selected.value = new Set(selected.value)
}
const allSelected = computed(
  () => shownObjects.value.length > 0 && selected.value.size === shownObjects.value.length,
)
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(shownObjects.value.map((o: any) => o.name))
}

// ---- upload ----
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
async function onUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  const form = new FormData()
  form.append('prefix', prefix.value)
  for (const f of files) form.append('files', f)
  uploading.value = true
  try {
    const res: any = await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/upload`, {
      method: 'POST',
      body: form,
    })
    toast.ok(`${res.uploaded.length} file terupload`)
    await refreshAll()
  } catch (err: any) {
    toast.error(apiError(err))
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// ---- folder ----
const showFolder = ref(false)
const folderNameInput = ref('')
async function createFolder() {
  try {
    await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/folder`, {
      method: 'POST',
      body: { prefix: prefix.value, name: folderNameInput.value },
    })
    toast.ok('Folder dibuat')
    showFolder.value = false
    folderNameInput.value = ''
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

// ---- download / delete ----
async function download(key: string) {
  try {
    const { url } = await $fetch<{ url: string }>(
      `/api/buckets/${encodeURIComponent(bucket.value)}/presign`,
      { query: { key } },
    )
    window.open(url, '_blank')
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

const confirmDelete = ref(false)
const busy = ref(false)
async function deleteSelected() {
  busy.value = true
  try {
    const res: any = await $fetch(`/api/buckets/${encodeURIComponent(bucket.value)}/objects`, {
      method: 'DELETE',
      body: { keys: [...selected.value] },
    })
    toast.ok(`${res.deleted} objek dihapus`)
    confirmDelete.value = false
    await refreshAll()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- header info -->
    <div class="card p-5 rise">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <NuxtLink to="/console/buckets" class="text-ink-400 hover:text-glow transition-colors font-mono text-sm">←</NuxtLink>
            <h1 class="text-2xl font-extrabold tracking-tight truncate">{{ bucket }}</h1>
            <button
              class="cursor-pointer transition-colors"
              :class="accessInfo.cls"
              title="Klik untuk ubah level akses"
              @click="showAccess = true"
            >
              {{ accessInfo.text }}
            </button>
            <button
              class="badge cursor-pointer transition-colors"
              :class="stat?.versioning ? 'badge-ok' : 'badge-dim'"
              :disabled="togglingVersioning"
              :title="'Klik untuk ' + (stat?.versioning ? 'matikan' : 'aktifkan') + ' versioning'"
              @click="toggleVersioning"
            >
              versioning {{ stat?.versioning ? 'on' : 'off' }}
            </button>
          </div>
          <p class="font-mono text-[11px] text-ink-400 mt-2">
            dibuat {{ fmtDate(stat?.creationDate) }}
            <template v-if="stat?.size != null">
              · <span class="text-ink-200">{{ fmtBytes(stat.size) }}</span> · {{ stat.objects }} objek
            </template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-ghost" @click="refreshAll()">⟳ Refresh</button>
          <input ref="fileInput" type="file" multiple class="hidden" @change="onUpload" />
          <button class="btn-primary" :disabled="uploading" @click="fileInput?.click()">
            <span v-if="uploading" class="size-3.5 border-2 border-ink-950/40 border-t-ink-950 rounded-full animate-spin" />
            {{ uploading ? 'Mengupload…' : '↑ Upload' }}
          </button>
        </div>
      </div>
    </div>

    <!-- breadcrumb + tools -->
    <div class="flex items-center gap-3 flex-wrap rise" style="animation-delay: 60ms">
      <div class="flex items-center gap-2 font-mono text-sm flex-wrap card px-3 py-2 w-full lg:w-auto lg:flex-1 min-w-0">
        <button class="text-glow font-semibold cursor-pointer hover:brightness-110" @click="goPrefix('')">{{ bucket }}</button>
        <template v-for="c in crumbs" :key="c.prefix">
          <span class="text-ink-600">/</span>
          <button class="text-ink-200 hover:text-glow transition-colors cursor-pointer" @click="goPrefix(c.prefix)">
            {{ c.label }}
          </button>
        </template>
        <button class="ml-auto text-ink-500 hover:text-glow transition-colors text-xs cursor-pointer" title="Copy path" @click="copyPath">⧉</button>
      </div>
      <input v-model="filter" class="input h-9 flex-1 sm:flex-none sm:w-56 min-w-36" placeholder="filter objek…" spellcheck="false" />
      <div class="flex rounded-lg border border-ink-600 overflow-hidden h-9">
        <button
          class="px-3 text-sm transition-colors cursor-pointer"
          :class="view === 'list' ? 'bg-glow/15 text-glow' : 'text-ink-400 hover:text-white'"
          title="Tampilan list"
          @click="view = 'list'"
        >☰</button>
        <button
          class="px-3 text-sm transition-colors cursor-pointer border-l border-ink-600"
          :class="view === 'grid' ? 'bg-glow/15 text-glow' : 'text-ink-400 hover:text-white'"
          title="Tampilan grid"
          @click="view = 'grid'"
        >⊞</button>
      </div>
      <button class="btn-ghost" @click="showFolder = true">+ Folder</button>
      <button v-if="selected.size" class="btn-danger" @click="confirmDelete = true">
        Hapus {{ selected.size }}
      </button>
    </div>

    <!-- grid view -->
    <div v-if="view === 'grid'" class="rise" style="animation-delay: 120ms">
      <p v-if="status === 'pending' || status === 'idle'" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</p>
      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          <button
            v-if="prefix"
            class="card aspect-square grid place-items-center font-mono text-sm text-ink-300 hover:text-glow hover:border-ink-500 transition-colors cursor-pointer"
            @click="goPrefix(crumbs.length > 1 ? crumbs[crumbs.length - 2]!.prefix : '')"
          >
            ← ..
          </button>
          <button
            v-for="p in shownPrefixes"
            :key="p"
            class="card aspect-square flex flex-col items-center justify-center gap-2 hover:border-glow/40 transition-colors cursor-pointer p-3"
            @click="goPrefix(p)"
          >
            <span class="inline-flex rounded border border-glow/30 text-glow font-mono text-[10px] px-2 py-1">DIR</span>
            <span class="font-mono text-[11px] text-ink-200 truncate max-w-full">{{ folderName(p) }}/</span>
          </button>
          <div
            v-for="o in shownObjects"
            :key="o.name"
            class="card relative overflow-hidden group hover:border-ink-500 transition-colors"
          >
            <input
              type="checkbox"
              :checked="selected.has(o.name)"
              class="absolute top-2 left-2 z-10 accent-glow cursor-pointer transition-opacity"
              :class="selected.has(o.name) ? 'opacity-100' : 'row-actions'"
              @change="toggle(o.name)"
            />
            <button
              class="absolute top-2 right-2 z-10 rounded bg-ink-950/80 border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-ink-300 hover:text-glow row-actions cursor-pointer"
              title="Bagikan"
              @click.stop="shareKey = o.name"
            >⇗</button>
            <button class="block w-full text-left cursor-pointer" @click="previewObject = o">
              <div class="aspect-square bg-ink-900 grid place-items-center overflow-hidden">
                <img
                  v-if="thumbs[o.name]"
                  :src="thumbs[o.name]"
                  :alt="fileName(o.name)"
                  loading="lazy"
                  class="size-full object-cover"
                />
                <span
                  v-else
                  class="inline-flex rounded border font-mono text-[10px] px-2 py-1"
                  :class="fileType(o.name).cls"
                >{{ fileType(o.name).label }}</span>
              </div>
              <div class="p-2.5 border-t border-ink-800">
                <p class="font-mono text-[11px] truncate">{{ fileName(o.name) }}</p>
                <p class="font-mono text-[10px] text-ink-500 mt-0.5">{{ fmtBytes(o.size) }}</p>
              </div>
            </button>
          </div>
        </div>
        <p v-if="!shownPrefixes.length && !shownObjects.length" class="text-center text-ink-400 py-12">
          {{ filter ? 'Tidak ada objek yang cocok dengan filter.' : 'Kosong — upload file pertama.' }}
        </p>
        <p v-if="data?.truncated" class="mt-3 text-[11px] font-mono text-ink-400">
          menampilkan 1000 entri pertama — masuk ke folder untuk lihat lebih detail
        </p>
      </template>
    </div>

    <!-- list view -->
    <div v-else class="card overflow-x-auto rise" style="animation-delay: 120ms">
      <table class="tbl">
        <thead>
          <tr>
            <th class="w-10">
              <input type="checkbox" :checked="allSelected" class="accent-glow cursor-pointer" @change="toggleAll" />
            </th>
            <th>Nama</th>
            <th class="w-28">Ukuran</th>
            <th class="w-44 hidden md:table-cell">Terakhir Diubah</th>
            <th class="w-28" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="5" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <template v-else>
            <tr v-if="prefix">
              <td />
              <td colspan="4">
                <button
                  class="font-mono text-sm text-ink-300 hover:text-glow transition-colors cursor-pointer"
                  @click="goPrefix(crumbs.length > 1 ? crumbs[crumbs.length - 2]!.prefix : '')"
                >
                  ← ..
                </button>
              </td>
            </tr>
            <tr v-for="p in shownPrefixes" :key="p">
              <td />
              <td colspan="4">
                <button class="flex items-center gap-2.5 font-semibold hover:text-glow transition-colors cursor-pointer" @click="goPrefix(p)">
                  <span class="inline-flex w-9 justify-center rounded border border-glow/30 text-glow font-mono text-[9px] px-1 py-0.5">DIR</span>
                  {{ folderName(p) }}/
                </button>
              </td>
            </tr>
            <tr v-for="o in shownObjects" :key="o.name" class="group">
              <td>
                <input
                  type="checkbox"
                  :checked="selected.has(o.name)"
                  class="accent-glow cursor-pointer"
                  @change="toggle(o.name)"
                />
              </td>
              <td>
                <button class="flex items-center gap-2.5 min-w-0 w-full text-left cursor-pointer hover:text-glow transition-colors" @click="previewObject = o">
                  <span
                    class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0"
                    :class="fileType(o.name).cls"
                  >{{ fileType(o.name).label }}</span>
                  <span class="font-mono text-[13px] truncate">{{ fileName(o.name) }}</span>
                </button>
              </td>
              <td class="font-mono text-xs text-ink-300">{{ fmtBytes(o.size) }}</td>
              <td class="font-mono text-xs text-ink-300 hidden md:table-cell">{{ fmtDate(o.lastModified) }}</td>
              <td class="text-right">
                <div class="flex justify-end gap-3 font-mono text-xs row-actions">
                  <button class="text-ink-500 hover:text-glow transition-colors cursor-pointer" @click="shareKey = o.name">
                    share
                  </button>
                  <button class="text-ink-500 hover:text-glow transition-colors cursor-pointer" @click="download(o.name)">
                    download
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!shownPrefixes.length && !shownObjects.length">
              <td colspan="5" class="text-center text-ink-400 py-12">
                {{ filter ? 'Tidak ada objek yang cocok dengan filter.' : 'Kosong — upload file pertama.' }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="data?.truncated" class="px-4 py-2.5 text-[11px] font-mono text-ink-400 border-t border-ink-800">
        menampilkan 1000 entri pertama — masuk ke folder untuk lihat lebih detail
      </p>
    </div>

    <PreviewModal
      :bucket="bucket"
      :object="previewObject"
      @close="previewObject = null"
      @share="(k: string) => (shareKey = k)"
      @download="download"
    />

    <ShareModal
      :bucket="bucket"
      :object-key="shareKey"
      :public-access="isPublicRead"
      @close="shareKey = null"
    />

    <Modal :open="showAccess" title="Level Akses Bucket" @close="showAccess = false">
      <div class="space-y-2">
        <label
          v-for="o in ACCESS_OPTIONS"
          :key="o.value"
          class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors"
          :class="accessLevel === o.value ? 'border-glow/50 bg-glow/5' : 'border-ink-700 hover:border-ink-500'"
        >
          <input v-model="accessLevel" type="radio" :value="o.value" class="mt-1 accent-glow" />
          <span>
            <span class="block text-sm font-semibold">{{ o.label }}</span>
            <span class="block text-[11px] text-ink-400 font-mono mt-0.5">{{ o.desc }}</span>
          </span>
        </label>
        <p v-if="accessLevel !== 'private'" class="text-[11px] text-danger font-mono pt-1">
          ⚠ bucket bisa diakses tanpa login — termasuk dari internet lewat tunnel lu
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button class="btn-ghost" @click="showAccess = false">Batal</button>
          <button class="btn-primary" :disabled="savingAccess" @click="saveAccess">Simpan</button>
        </div>
      </div>
    </Modal>

    <Modal :open="showFolder" title="Folder Baru" @close="showFolder = false">
      <form class="space-y-4" @submit.prevent="createFolder">
        <div>
          <label class="label">Nama Folder</label>
          <input v-model="folderNameInput" class="input" placeholder="mis. dokumen" spellcheck="false" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showFolder = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="!folderNameInput">Buat</button>
        </div>
      </form>
    </Modal>

    <Modal :open="confirmDelete" title="Hapus Objek" @close="confirmDelete = false">
      <p class="text-sm text-ink-200">
        Yakin hapus <span class="text-danger font-mono">{{ selected.size }}</span> objek terpilih? Aksi ini tidak bisa dibatalkan.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = false">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deleteSelected">Hapus Permanen</button>
      </div>
    </Modal>
  </div>
</template>
