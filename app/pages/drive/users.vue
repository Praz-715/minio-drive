<script setup lang="ts">
definePageMeta({ layout: 'drive' })

const toast = useToast()
const session = authClient.useSession()
const myId = computed(() => session.value?.data?.user?.id)
const iamSuper = computed(() => isSuperAdminRole((session.value?.data?.user as any)?.role))

// guard client-side: bukan admin/super_admin → balik (server tetap enforce via requireDriveAdmin)
watch(
  () => session.value?.data,
  (data) => {
    if (data && !isAdminRole((data.user as any).role)) navigateTo('/drive')
  },
  { immediate: true },
)

const { data: users, refresh, status } = useFetch('/api/drive/users', { server: false })
const busy = ref(false)

function gib(bytes?: number | null) {
  return bytes ? +(bytes / 1024 ** 3).toFixed(1) : 0
}

// ---- tambah user ----
const showAdd = ref(false)
const addForm = reactive({ name: '', email: '', password: '', role: 'user', quotaGiB: 5 })
function genPassword() {
  addForm.password = randomSecret(14)
}
async function createUser() {
  busy.value = true
  try {
    const res: any = await $fetch('/api/drive/users', { method: 'POST', body: { ...addForm } })
    res.bucketWarning ? toast.info(res.bucketWarning) : toast.ok(`User "${addForm.name}" dibuat + bucket ${res.bucket}`)
    showAdd.value = false
    Object.assign(addForm, { name: '', email: '', password: '', role: 'user', quotaGiB: 5 })
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- edit user ----
const editing = ref<any>(null)
const editForm = reactive({ name: '', email: '', role: 'user', quotaGiB: 5, password: '' })
function openEdit(u: any) {
  editing.value = u
  Object.assign(editForm, {
    name: u.name,
    email: u.email,
    role: u.role,
    quotaGiB: gib(u.storageQuota),
    password: '',
  })
}
async function saveEdit() {
  busy.value = true
  try {
    const res: any = await $fetch(`/api/drive/users/${editing.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        quotaGiB: editForm.quotaGiB,
        password: editForm.password || undefined,
      },
    })
    res.bucketWarning ? toast.info(res.bucketWarning) : toast.ok('Perubahan disimpan')
    editing.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- avatar ----
const avatarInput = ref<HTMLInputElement>()
const uploadingAvatar = ref(false)
async function onAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !editing.value) return
  const form = new FormData()
  form.append('file', file)
  uploadingAvatar.value = true
  try {
    const res: any = await $fetch(`/api/drive/users/${editing.value.id}/avatar`, { method: 'POST', body: form })
    editing.value.image = res.image
    toast.ok('Foto profil diperbarui')
    await refresh()
  } catch (err: any) {
    toast.error(apiError(err))
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

// ---- nonaktifkan / pulihkan ----
const confirmDelete = ref<any>(null)
async function softDelete() {
  busy.value = true
  try {
    await $fetch(`/api/drive/users/${confirmDelete.value.id}`, { method: 'DELETE' })
    toast.ok(`User "${confirmDelete.value.name}" dinonaktifkan — bucket & datanya tetap ada`)
    confirmDelete.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
async function restore(u: any) {
  try {
    await $fetch(`/api/drive/users/${u.id}/restore`, { method: 'POST' })
    toast.ok(`User "${u.name}" dipulihkan`)
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3 rise">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">Kelola User</h1>
        <p class="text-ink-400 text-sm mt-1">
          {{ users?.filter((u: any) => !u.deletedAt).length ?? 0 }} aktif ·
          {{ users?.filter((u: any) => u.deletedAt).length ?? 0 }} nonaktif
        </p>
      </div>
      <button class="btn-primary" @click="showAdd = true">+ User Baru</button>
    </div>

    <div class="card overflow-x-auto rise" style="animation-delay: 80ms">
      <table class="tbl table-fixed">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th class="hidden sm:table-cell">Quota</th>
            <th class="hidden md:table-cell">Bucket</th>
            <th class="hidden sm:table-cell">Status</th>
            <th class="w-24 sm:w-40" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="6" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <tr
            v-for="u in users"
            :key="u.id"
            class="group"
            :class="u.deletedAt && 'opacity-55'"
          >
            <td>
              <div class="flex items-center gap-3 min-w-0">
                <img v-if="u.image" :src="u.image" alt="" class="size-9 rounded-full object-cover border border-ink-600 shrink-0" />
                <div v-else class="size-9 rounded-full bg-ink-800 border border-ink-600 grid place-items-center font-bold text-xs text-ink-300 shrink-0">
                  {{ u.name[0]?.toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <p class="font-semibold truncate">
                    {{ u.name }}
                    <span v-if="u.id === myId" class="font-mono text-[10px] text-glow">(kamu)</span>
                  </p>
                  <p class="font-mono text-[11px] text-ink-400 truncate">{{ u.email }}</p>
                </div>
              </div>
            </td>
            <td>
              <span :class="isAdminRole(u.role) ? 'badge-ok' : 'badge-dim'">
                <template v-if="u.role === 'super_admin'">★ </template>{{ roleLabel(u.role) }}
              </span>
            </td>
            <td class="font-mono text-xs text-ink-300 hidden sm:table-cell">
              {{ fmtBytes(u.storageUsed) }} / {{ gib(u.storageQuota) }} GiB
            </td>
            <td class="font-mono text-[11px] text-ink-400 hidden md:table-cell">
              {{ u.bucket ? u.bucket.slice(0, 20) + '…' : '—' }}
            </td>
            <td class="hidden sm:table-cell">
              <span :class="u.deletedAt ? 'badge-off' : 'badge-ok'">{{ u.deletedAt ? 'nonaktif' : 'aktif' }}</span>
            </td>
            <td>
              <div class="flex justify-end gap-3 font-mono text-xs row-actions [&>button]:py-2.5 [&>button]:-my-2.5 [&>button]:inline-flex [&>button]:items-center">
                <button
                  v-if="iamSuper || u.role !== 'super_admin'"
                  class="text-ink-400 hover:text-glow cursor-pointer"
                  @click="openEdit(u)"
                >edit</button>
                <button
                  v-if="!u.deletedAt && u.id !== myId && (iamSuper || u.role !== 'super_admin')"
                  class="text-ink-400 hover:text-danger cursor-pointer"
                  @click="confirmDelete = u"
                >nonaktifkan</button>
                <button
                  v-if="u.deletedAt"
                  class="text-ink-400 hover:text-ok cursor-pointer"
                  @click="restore(u)"
                >pulihkan</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- tambah user -->
    <Modal :open="showAdd" title="User Baru" @close="showAdd = false">
      <form class="space-y-4" @submit.prevent="createUser">
        <div>
          <label class="label">Nama</label>
          <input v-model="addForm.name" class="input" placeholder="Nama lengkap" />
        </div>
        <div>
          <label class="label">Email</label>
          <input v-model="addForm.email" type="email" class="input" placeholder="nama@mail.co.id" spellcheck="false" />
        </div>
        <div>
          <label class="label">Password</label>
          <div class="flex gap-2">
            <input v-model="addForm.password" class="input" placeholder="min. 8 karakter" spellcheck="false" />
            <button type="button" class="btn-ghost shrink-0 h-10" @click="genPassword">Generate</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Role</label>
            <select v-model="addForm.role" class="input cursor-pointer">
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option v-if="iamSuper" value="super_admin">super admin</option>
            </select>
          </div>
          <div>
            <label class="label">Quota (GiB)</label>
            <input v-model.number="addForm.quotaGiB" type="number" min="1" step="1" class="input" />
          </div>
        </div>
        <p class="text-[11px] font-mono text-ink-500">
          bucket pribadi otomatis dibuat dengan hard-quota sesuai isian
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showAdd = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy || !addForm.name || !addForm.email || addForm.password.length < 8">
            Buat User
          </button>
        </div>
      </form>
    </Modal>

    <!-- edit user -->
    <Modal :open="!!editing" :title="`Edit · ${editing?.name}`" wide @close="editing = null">
      <form class="space-y-5" @submit.prevent="saveEdit">
        <div class="flex items-center gap-4">
          <img v-if="editing?.image" :src="editing.image" alt="" class="size-16 rounded-full object-cover border border-ink-600" />
          <div v-else class="size-16 rounded-full bg-ink-800 border border-ink-600 grid place-items-center font-bold text-lg text-ink-300">
            {{ editing?.name?.[0]?.toUpperCase() }}
          </div>
          <div>
            <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/avif" class="hidden" @change="onAvatar" />
            <button type="button" class="btn-ghost h-9" :disabled="uploadingAvatar" @click="avatarInput?.click()">
              {{ uploadingAvatar ? 'Mengupload…' : '📷 Ganti Foto' }}
            </button>
            <p class="font-mono text-[10px] text-ink-500 mt-1.5">PNG/JPG/WebP · maks 2 MB</p>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="label">Nama</label>
            <input v-model="editForm.name" class="input" />
          </div>
          <div>
            <label class="label">Email</label>
            <input v-model="editForm.email" type="email" class="input" spellcheck="false" />
          </div>
          <div>
            <label class="label">Role</label>
            <select v-model="editForm.role" class="input cursor-pointer" :disabled="editing?.id === myId">
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option v-if="iamSuper" value="super_admin">super admin</option>
            </select>
          </div>
          <div>
            <label class="label">Quota (GiB)</label>
            <input v-model.number="editForm.quotaGiB" type="number" min="1" step="1" class="input" />
          </div>
        </div>

        <div>
          <label class="label">Reset Password <span class="normal-case tracking-normal">(kosongkan jika tidak diganti)</span></label>
          <input v-model="editForm.password" class="input" placeholder="password baru, min. 8 karakter" spellcheck="false" />
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="editing = null">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy">Simpan Perubahan</button>
        </div>
      </form>
    </Modal>

    <!-- nonaktifkan -->
    <Modal :open="!!confirmDelete" title="Nonaktifkan User" @close="confirmDelete = null">
      <p class="text-sm text-ink-200 leading-relaxed">
        Yakin nonaktifkan <span class="font-mono text-danger">{{ confirmDelete?.email }}</span>?
        User langsung logout dari semua perangkat dan tidak bisa login lagi.
        <span class="text-ink-100 font-semibold">Bucket & seluruh file-nya TIDAK dihapus</span> —
        akun bisa dipulihkan kapan saja.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="softDelete">Nonaktifkan</button>
      </div>
    </Modal>
  </div>
</template>
