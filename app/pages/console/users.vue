<script setup lang="ts">
definePageMeta({ title: 'Users', layout: 'console' })

const toast = useToast()
const { data: users, refresh, status } = useFetch('/api/admin/users', { server: false })
const { data: policies } = useFetch('/api/admin/policies', { server: false })

const busy = ref(false)

// ---- add user ----
const showAdd = ref(false)
const form = reactive({ accessKey: '', secretKey: '', policy: '' })
function genSecret() {
  form.secretKey = randomSecret(28)
}
async function addUser() {
  busy.value = true
  try {
    const res: any = await $fetch('/api/admin/users', { method: 'POST', body: { ...form } })
    res.policyWarning ? toast.info(res.policyWarning) : toast.ok(`User "${form.accessKey}" dibuat`)
    showAdd.value = false
    Object.assign(form, { accessKey: '', secretKey: '', policy: '' })
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- toggle status ----
async function toggleStatus(u: any) {
  const enable = u.status !== 'enabled'
  try {
    await $fetch(`/api/admin/users/${encodeURIComponent(u.accessKey)}/status`, {
      method: 'POST',
      body: { enabled: enable },
    })
    toast.ok(`User ${u.accessKey} ${enable ? 'diaktifkan' : 'dinonaktifkan'}`)
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  }
}

// ---- attach policy ----
const attachTarget = ref<any>(null)
const attachPolicy = ref('')
async function doAttach(detach = false) {
  if (!attachTarget.value || !attachPolicy.value) return
  busy.value = true
  try {
    await $fetch('/api/admin/policies/attach', {
      method: 'POST',
      body: { policy: attachPolicy.value, user: attachTarget.value.accessKey, detach },
    })
    toast.ok(`Policy ${detach ? 'dilepas dari' : 'dipasang ke'} ${attachTarget.value.accessKey}`)
    attachTarget.value = null
    attachPolicy.value = ''
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- delete ----
const confirmDelete = ref<any>(null)
async function deleteUser() {
  busy.value = true
  try {
    await $fetch(`/api/admin/users/${encodeURIComponent(confirmDelete.value.accessKey)}`, { method: 'DELETE' })
    toast.ok(`User "${confirmDelete.value.accessKey}" dihapus`)
    confirmDelete.value = null
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3 rise">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">Users</h1>
        <p class="text-ink-400 text-sm mt-1">Identity & access management — {{ users?.length ?? 0 }} user.</p>
      </div>
      <button class="btn-primary" @click="showAdd = true">+ User Baru</button>
    </div>

    <div class="card overflow-x-auto rise" style="animation-delay: 80ms">
      <table class="tbl">
        <thead>
          <tr>
            <th>Access Key</th>
            <th>Status</th>
            <th>Policy</th>
            <th class="w-56" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="4" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <tr v-else-if="!users?.length">
            <td colspan="4" class="text-center text-ink-400 py-10">Belum ada user selain root.</td>
          </tr>
          <tr v-for="u in users" :key="u.accessKey" class="group">
            <td class="font-mono text-[13px] font-semibold">{{ u.accessKey }}</td>
            <td>
              <span :class="u.status === 'enabled' ? 'badge-ok' : 'badge-off'">{{ u.status }}</span>
            </td>
            <td class="font-mono text-xs text-ink-300">{{ u.policy || '—' }}</td>
            <td>
              <div class="flex justify-end gap-3 font-mono text-xs row-actions [&>button]:py-2.5 [&>button]:-my-2.5 [&>button]:inline-flex [&>button]:items-center">
                <button class="text-ink-400 hover:text-glow cursor-pointer" @click="attachTarget = u; attachPolicy = u.policy || ''">policy</button>
                <button class="text-ink-400 hover:text-glow cursor-pointer" @click="toggleStatus(u)">
                  {{ u.status === 'enabled' ? 'disable' : 'enable' }}
                </button>
                <button class="text-ink-400 hover:text-danger cursor-pointer" @click="confirmDelete = u">hapus</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- add user -->
    <Modal :open="showAdd" title="User Baru" @close="showAdd = false">
      <form class="space-y-4" @submit.prevent="addUser">
        <div>
          <label class="label">Access Key</label>
          <input v-model="form.accessKey" class="input" placeholder="mis. app-user" spellcheck="false" />
        </div>
        <div>
          <label class="label">Secret Key</label>
          <div class="flex gap-2">
            <input v-model="form.secretKey" class="input" placeholder="min. 8 karakter" spellcheck="false" />
            <button type="button" class="btn-ghost shrink-0 h-10" @click="genSecret">Generate</button>
          </div>
        </div>
        <div>
          <label class="label">Policy (opsional)</label>
          <select v-model="form.policy" class="input cursor-pointer">
            <option value="">— tanpa policy —</option>
            <option v-for="p in policies" :key="p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showAdd = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy || !form.accessKey || form.secretKey.length < 8">Buat User</button>
        </div>
      </form>
    </Modal>

    <!-- attach policy -->
    <Modal :open="!!attachTarget" title="Kelola Policy" @close="attachTarget = null">
      <div class="space-y-4">
        <p class="text-sm text-ink-200">
          User: <span class="font-mono text-glow">{{ attachTarget?.accessKey }}</span>
        </p>
        <div>
          <label class="label">Policy</label>
          <select v-model="attachPolicy" class="input cursor-pointer">
            <option value="" disabled>— pilih policy —</option>
            <option v-for="p in policies" :key="p.name" :value="p.name">{{ p.name }}</option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button class="btn-danger" :disabled="busy || !attachPolicy" @click="doAttach(true)">Detach</button>
          <button class="btn-primary" :disabled="busy || !attachPolicy" @click="doAttach(false)">Attach</button>
        </div>
      </div>
    </Modal>

    <!-- delete -->
    <Modal :open="!!confirmDelete" title="Hapus User" @close="confirmDelete = null">
      <p class="text-sm text-ink-200">
        Yakin hapus user <span class="font-mono text-danger">{{ confirmDelete?.accessKey }}</span>?
        Semua access key turunannya ikut terhapus.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deleteUser">Hapus</button>
      </div>
    </Modal>
  </div>
</template>
