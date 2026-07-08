<script setup lang="ts">
definePageMeta({ layout: 'drive' })

const toast = useToast()
const session = authClient.useSession()
watch(
  () => session.value?.data,
  (d) => {
    if (d && (d.user as any).role !== 'admin') navigateTo('/drive')
  },
  { immediate: true },
)

const { data, refresh, status } = useFetch('/api/drive/buckets', { server: false })
const teams = computed(() => (data.value as any)?.teams || [])
const personal = computed(() => (data.value as any)?.personal || [])
const busy = ref(false)
function gib(b?: number | null) {
  return b ? +(b / 1024 ** 3).toFixed(1) : 0
}

// ---- buat bucket bersama ----
const showCreate = ref(false)
const createForm = reactive({ name: '', quotaGiB: 10 })
async function createBucket() {
  busy.value = true
  try {
    await $fetch('/api/drive/buckets', { method: 'POST', body: { ...createForm } })
    toast.ok(`Bucket bersama "${createForm.name}" dibuat`)
    showCreate.value = false
    Object.assign(createForm, { name: '', quotaGiB: 10 })
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- kelola bucket (edit + anggota) ----
const managing = ref<any>(null)
const editForm = reactive({ name: '', quotaGiB: 10 })
const members = ref<any[]>([])
const addEmail = ref('')
const addPerm = ref<'editor' | 'viewer'>('editor')

async function openManage(t: any) {
  managing.value = t
  editForm.name = t.name
  editForm.quotaGiB = gib(t.quota)
  members.value = []
  try {
    members.value = await $fetch(`/api/drive/buckets/${t.id}/members`)
  } catch {}
}
async function saveEdit() {
  busy.value = true
  try {
    const res: any = await $fetch(`/api/drive/buckets/${managing.value.id}`, {
      method: 'PATCH',
      body: { name: editForm.name, quotaGiB: editForm.quotaGiB },
    })
    res.quotaWarning ? toast.info(res.quotaWarning) : toast.ok('Perubahan disimpan')
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
async function addMember() {
  busy.value = true
  try {
    const res: any = await $fetch(`/api/drive/buckets/${managing.value.id}/members`, {
      method: 'POST',
      body: { email: addEmail.value, permission: addPerm.value },
    })
    toast.ok(`${res.name} ditambahkan`)
    addEmail.value = ''
    members.value = await $fetch(`/api/drive/buckets/${managing.value.id}/members`)
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
async function removeMember(m: any) {
  try {
    await $fetch(`/api/drive/buckets/${managing.value.id}/members`, { method: 'DELETE', body: { userId: m.userId } })
    members.value = members.value.filter((x) => x.userId !== m.userId)
    toast.ok(`${m.name} dikeluarkan`)
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

// ---- hapus bucket ----
const confirmDelete = ref<any>(null)
async function deleteBucket() {
  busy.value = true
  try {
    await $fetch(`/api/drive/buckets/${confirmDelete.value.id}`, { method: 'DELETE' })
    toast.ok(`Bucket "${confirmDelete.value.name}" dihapus`)
    confirmDelete.value = null
    managing.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-end justify-between gap-3 rise">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Manajemen Bucket</h1>
        <p class="text-ink-400 text-sm mt-1">{{ teams.length }} bucket bersama · {{ personal.length }} bucket pribadi</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">+ Bucket Bersama</button>
    </div>

    <p v-if="status === 'pending' || status === 'idle'" class="font-mono text-xs text-ink-400">memuat…</p>

    <template v-else>
      <!-- BUCKET BERSAMA -->
      <div>
        <p class="label mb-2">Bucket Bersama</p>
        <div class="card overflow-x-auto rise">
          <table class="tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th class="hidden md:table-cell">Bucket</th>
                <th class="w-40">Terpakai / Quota</th>
                <th class="w-24">Anggota</th>
                <th class="w-32" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!teams.length"><td colspan="5" class="text-center text-ink-400 py-8">Belum ada bucket bersama.</td></tr>
              <tr v-for="t in teams" :key="t.id" class="group">
                <td>
                  <NuxtLink :to="`/drive/team/${t.id}`" class="font-semibold hover:text-glow transition-colors">{{ t.name }}</NuxtLink>
                </td>
                <td class="font-mono text-[11px] text-ink-400 hidden md:table-cell">{{ t.bucket }}</td>
                <td class="font-mono text-xs text-ink-300">{{ fmtBytes(t.used) }} / {{ gib(t.quota) }} GiB</td>
                <td class="font-mono text-xs text-ink-300">{{ t.members }}</td>
                <td>
                  <div class="flex justify-end gap-3 font-mono text-xs row-actions">
                    <button class="text-ink-400 hover:text-glow cursor-pointer" @click="openManage(t)">kelola</button>
                    <button class="text-ink-400 hover:text-danger cursor-pointer" @click="confirmDelete = t">hapus</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- BUCKET PRIBADI -->
      <div>
        <p class="label mb-2">Bucket Pribadi (per user)</p>
        <div class="card overflow-x-auto rise">
          <table class="tbl">
            <thead>
              <tr>
                <th>Pemilik</th>
                <th class="hidden md:table-cell">Bucket</th>
                <th class="w-40">Terpakai / Quota</th>
                <th class="w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in personal" :key="p.bucket">
                <td>
                  <p class="font-semibold truncate">{{ p.ownerName }}</p>
                  <p class="font-mono text-[11px] text-ink-400 truncate">{{ p.ownerEmail }}</p>
                </td>
                <td class="font-mono text-[11px] text-ink-400 hidden md:table-cell">{{ p.bucket }}</td>
                <td class="font-mono text-xs text-ink-300">{{ fmtBytes(p.used) }} / {{ gib(p.quota) }} GiB</td>
                <td><span :class="p.deletedAt ? 'badge-off' : 'badge-ok'">{{ p.deletedAt ? 'nonaktif' : 'aktif' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-2 font-mono text-[11px] text-ink-500">
          Bucket pribadi dibuat otomatis per user & quota diatur di <NuxtLink to="/drive/users" class="text-glow">Kelola User</NuxtLink>.
        </p>
      </div>
    </template>

    <!-- buat bucket -->
    <Modal :open="showCreate" title="Bucket Bersama Baru" @close="showCreate = false">
      <form class="space-y-4" @submit.prevent="createBucket">
        <div>
          <label class="label">Nama</label>
          <input v-model="createForm.name" class="input" placeholder="mis. Tim Marketing" />
        </div>
        <div>
          <label class="label">Quota (GiB)</label>
          <input v-model.number="createForm.quotaGiB" type="number" min="1" class="input" />
        </div>
        <p class="text-[11px] font-mono text-ink-500">bucket MinIO baru dibuat + hard-quota; assign anggota setelahnya</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showCreate = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy || !createForm.name">Buat</button>
        </div>
      </form>
    </Modal>

    <!-- kelola bucket -->
    <Modal :open="!!managing" :title="`Kelola · ${managing?.name}`" wide @close="managing = null">
      <div class="space-y-6">
        <form class="grid sm:grid-cols-[1fr_auto] gap-3 items-end" @submit.prevent="saveEdit">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Nama</label>
              <input v-model="editForm.name" class="input" />
            </div>
            <div>
              <label class="label">Quota (GiB)</label>
              <input v-model.number="editForm.quotaGiB" type="number" min="1" class="input" />
            </div>
          </div>
          <button type="submit" class="btn-primary h-10" :disabled="busy">Simpan</button>
        </form>

        <div class="border-t border-ink-800 pt-5">
          <p class="label">Anggota</p>
          <form class="flex flex-wrap gap-2 mt-1" @submit.prevent="addMember">
            <input v-model="addEmail" type="email" class="input h-10 flex-1 min-w-40" placeholder="email user" spellcheck="false" />
            <select v-model="addPerm" class="input h-10 w-28 cursor-pointer">
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <button type="submit" class="btn-primary h-10 shrink-0" :disabled="busy || !addEmail">Assign</button>
          </form>
          <p class="mt-1.5 font-mono text-[11px] text-ink-500">editor = bisa upload/ubah · viewer = lihat & download</p>

          <div v-if="members.length" class="mt-3 space-y-2">
            <div v-for="m in members" :key="m.userId" class="flex items-center gap-3 rounded-lg border border-ink-700 px-3 py-2">
              <img v-if="m.image" :src="m.image" alt="" class="size-7 rounded-full object-cover border border-ink-600" />
              <div v-else class="size-7 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-[10px] font-bold text-ink-300">{{ m.name[0]?.toUpperCase() }}</div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold truncate">{{ m.name }}</p>
                <p class="font-mono text-[10px] text-ink-400 truncate">{{ m.email }}</p>
              </div>
              <span class="badge-dim">{{ m.permission }}</span>
              <button class="text-ink-500 hover:text-danger text-xs font-mono cursor-pointer" @click="removeMember(m)">keluarkan</button>
            </div>
          </div>
          <p v-else class="mt-3 font-mono text-[11px] text-ink-500">belum ada anggota</p>
        </div>
      </div>
    </Modal>

    <!-- hapus bucket -->
    <Modal :open="!!confirmDelete" title="Hapus Bucket Bersama" @close="confirmDelete = null">
      <p class="text-sm text-ink-200 leading-relaxed">
        Yakin hapus <span class="font-mono text-danger">{{ confirmDelete?.name }}</span>?
        <span class="text-ink-100 font-semibold">Seluruh file di dalamnya ikut terhapus permanen</span> dan bucket MinIO-nya dihapus. Tidak bisa dibatalkan.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deleteBucket">Hapus Permanen</button>
      </div>
    </Modal>
  </div>
</template>
