<script setup lang="ts">
// Terima satu item (`item`) atau banyak (`items`). Tujuan bisa Drive pribadi
// ATAU bucket bersama (tim) — objek dipindah lintas-bucket oleh endpoint /move.
const props = defineProps<{ item?: any | null; items?: any[] | null }>()
const emit = defineEmits<{ close: []; moved: [] }>()

const toast = useToast()

const targets = computed<any[]>(() =>
  props.items && props.items.length ? props.items : props.item ? [props.item] : [],
)
const open = computed(() => targets.value.length > 0)
const excludeIds = computed(() => new Set(targets.value.map((t) => t.id)))
const label = computed(() =>
  targets.value.length === 1 ? targets.value[0]?.name : `${targets.value.length} item`,
)

const teams = ref<any[]>([]) // bucket bersama sbg tujuan
const scope = ref<{ kind: 'personal' | 'team'; id?: string; name: string } | null>(null)
const stack = ref<{ id: string; name: string }[]>([]) // path folder dalam scope
const folders = ref<any[]>([])
const loading = ref(false)
const busy = ref(false)

watch(open, async (o) => {
  if (!o) return
  scope.value = null
  stack.value = []
  folders.value = []
  try {
    const r: any = await $fetch('/api/drive/shared-roots')
    teams.value = r.teams || []
  } catch {
    teams.value = []
  }
})

async function loadFolders() {
  loading.value = true
  try {
    let url = '/api/drive/browse'
    if (stack.value.length) url += `?parent=${encodeURIComponent(stack.value[stack.value.length - 1]!.id)}`
    else if (scope.value?.kind === 'team') url += `?team=${encodeURIComponent(scope.value.id!)}`
    const res: any = await $fetch(url)
    folders.value = (res.items || []).filter((i: any) => i.isFolder && !excludeIds.value.has(i.id))
  } catch (e: any) {
    toast.error(apiError(e))
    folders.value = []
  } finally {
    loading.value = false
  }
}

async function enterScope(s: { kind: 'personal' | 'team'; id?: string; name: string }) {
  scope.value = s
  stack.value = []
  await loadFolders()
}
async function enterFolder(f: any) {
  stack.value.push({ id: f.id, name: f.name })
  await loadFolders()
}
function gotoCrumb(i: number) {
  // i = -1 → root scope
  stack.value = stack.value.slice(0, i + 1)
  loadFolders()
}
function backToRoots() {
  scope.value = null
  stack.value = []
  folders.value = []
}

const destParent = computed(() => (stack.value.length ? stack.value[stack.value.length - 1]!.id : null))
const destTeam = computed(() => (scope.value?.kind === 'team' ? scope.value.id! : null))
const destName = computed(() =>
  stack.value.length ? stack.value[stack.value.length - 1]!.name : scope.value?.name || '',
)
const sameSpot = computed(() =>
  targets.value.every(
    (t) => (t.parentId || null) === (destParent.value || null) && (t.teamBucketId || null) === (destTeam.value || null),
  ),
)

async function moveHere() {
  busy.value = true
  try {
    for (const t of targets.value) {
      await $fetch(`/api/drive/files/${t.id}/move`, {
        method: 'POST',
        body: { parent: destParent.value || '', team: destParent.value ? '' : destTeam.value || '' },
      })
    }
    toast.ok(targets.value.length === 1 ? `"${targets.value[0].name}" dipindahkan` : `${targets.value.length} item dipindahkan`)
    emit('moved')
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Modal :open="open" :title="`Pindahkan · ${label}`" @close="emit('close')">
    <div class="space-y-4">
      <!-- ============ pilih lokasi (root) ============ -->
      <template v-if="!scope">
        <p class="label">Pilih tujuan</p>
        <div class="border border-ink-700 rounded-lg divide-y divide-ink-800 overflow-hidden">
          <button
            class="w-full text-left px-3 py-3 text-sm hover:bg-ink-800 transition-colors cursor-pointer flex items-center gap-2.5"
            @click="enterScope({ kind: 'personal', name: 'Drive Saya' })"
          >
            <span>🗂️</span> <span class="font-semibold">Drive Saya</span>
          </button>
          <button
            v-for="t in teams"
            :key="t.id"
            class="w-full text-left px-3 py-3 text-sm hover:bg-ink-800 transition-colors cursor-pointer flex items-center gap-2.5"
            @click="enterScope({ kind: 'team', id: t.id, name: t.name })"
          >
            <span class="text-glow">▦</span> <span class="font-semibold">{{ t.name }}</span>
            <span class="font-mono text-[10px] text-ink-500 ml-auto">bucket bersama</span>
          </button>
        </div>
        <p class="font-mono text-[11px] text-ink-500">
          Pindah ke bucket bersama = objek benar-benar dipindah ke sana & bisa diakses anggota tim.
        </p>
      </template>

      <!-- ============ browse dalam scope ============ -->
      <template v-else>
        <div class="flex items-center gap-1.5 font-mono text-xs text-ink-400 flex-wrap">
          <button class="hover:text-glow cursor-pointer" @click="backToRoots">Lokasi</button>
          <span class="text-ink-600">/</span>
          <button class="hover:text-glow cursor-pointer" :class="!stack.length && 'text-glow'" @click="gotoCrumb(-1)">
            {{ scope.name }}
          </button>
          <template v-for="(c, i) in stack" :key="c.id">
            <span class="text-ink-600">/</span>
            <button class="hover:text-glow cursor-pointer" :class="i === stack.length - 1 && 'text-glow'" @click="gotoCrumb(i)">{{ c.name }}</button>
          </template>
        </div>

        <div class="border border-ink-700 rounded-lg divide-y divide-ink-800 max-h-64 overflow-y-auto">
          <p v-if="loading" class="px-3 py-4 font-mono text-xs text-ink-400 text-center">memuat…</p>
          <template v-else>
            <button
              v-for="f in folders"
              :key="f.id"
              class="w-full text-left px-3 py-2.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer flex items-center gap-2"
              @click="enterFolder(f)"
            >
              <span class="font-mono text-[10px] text-glow">▸</span> {{ f.name }}/
            </button>
            <p v-if="!folders.length" class="px-3 py-4 font-mono text-xs text-ink-500 text-center">tidak ada sub-folder</p>
          </template>
        </div>
      </template>

      <div class="flex justify-end gap-2">
        <button class="btn-ghost" @click="emit('close')">Batal</button>
        <button class="btn-primary" :disabled="busy || !scope || sameSpot" @click="moveHere">
          {{ busy ? 'Memindahkan…' : `Pindahkan ke ${destName || '…'}` }}
        </button>
      </div>
    </div>
  </Modal>
</template>
