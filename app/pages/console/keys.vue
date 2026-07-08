<script setup lang="ts">
definePageMeta({ title: 'Access Keys', layout: 'console' })

const toast = useToast()
const { data: users } = useFetch('/api/admin/users', { server: false })
const { user: session } = useUserSession()

const selectedUser = ref('')
const userOptions = computed(() => {
  const list = (users.value || []).map((u: any) => u.accessKey)
  const me = (session.value as any)?.accessKey
  return me && !list.includes(me) ? [me, ...list] : list
})

const { data: keys, refresh, status, error } = useFetch('/api/admin/accesskeys', {
  query: { user: selectedUser },
  server: false,
  immediate: false,
  watch: [selectedUser],
})
watch(selectedUser, (v) => {
  if (v) refresh()
})

const busy = ref(false)

// ---- create ----
const showCreate = ref(false)
const keyName = ref('')
const created = ref<{ accessKey: string; secretKey: string } | null>(null)
async function createKey() {
  busy.value = true
  try {
    const res: any = await $fetch('/api/admin/accesskeys', {
      method: 'POST',
      body: { user: selectedUser.value, name: keyName.value || undefined },
    })
    created.value = res
    showCreate.value = false
    keyName.value = ''
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.ok('Disalin ke clipboard')
}

// ---- delete ----
const confirmDelete = ref<string | null>(null)
async function deleteKey() {
  busy.value = true
  try {
    await $fetch(`/api/admin/accesskeys/${encodeURIComponent(confirmDelete.value!)}`, { method: 'DELETE' })
    toast.ok('Access key dihapus')
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
        <h1 class="text-3xl font-extrabold tracking-tight">Access Keys</h1>
        <p class="text-ink-400 text-sm mt-1">Service account / kredensial aplikasi per user.</p>
      </div>
      <button class="btn-primary" :disabled="!selectedUser" @click="showCreate = true">+ Key Baru</button>
    </div>

    <div class="card p-4 rise" style="animation-delay: 60ms">
      <label class="label">Pilih User</label>
      <select v-model="selectedUser" class="input cursor-pointer max-w-sm">
        <option value="" disabled>— pilih user pemilik key —</option>
        <option v-for="u in userOptions" :key="u" :value="u">{{ u }}</option>
      </select>
    </div>

    <div v-if="selectedUser" class="card overflow-x-auto rise" style="animation-delay: 120ms">
      <table class="tbl">
        <thead>
          <tr>
            <th>Access Key</th>
            <th>Nama</th>
            <th>Status</th>
            <th>Expiry</th>
            <th class="w-24" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending'">
            <td colspan="5" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <tr v-else-if="error">
            <td colspan="5" class="text-center text-danger py-10 font-mono text-xs">{{ apiError(error) }}</td>
          </tr>
          <tr v-else-if="!keys?.length">
            <td colspan="5" class="text-center text-ink-400 py-10">User ini belum punya access key.</td>
          </tr>
          <tr v-for="k in keys" :key="k.accessKey" class="group">
            <td class="font-mono text-[13px] font-semibold">{{ k.accessKey }}</td>
            <td class="text-xs text-ink-300">{{ k.name || '—' }}</td>
            <td>
              <span :class="String(k.status).includes('on') || k.status === 'enabled' ? 'badge-ok' : 'badge-off'">
                {{ k.status }}
              </span>
            </td>
            <td class="font-mono text-xs text-ink-300">{{ k.expiration ? fmtDate(k.expiration) : 'tidak ada' }}</td>
            <td class="text-right">
              <button
                class="text-ink-500 hover:text-danger transition-colors text-xs font-mono row-actions cursor-pointer"
                @click="confirmDelete = k.accessKey"
              >
                hapus
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- create -->
    <Modal :open="showCreate" title="Access Key Baru" @close="showCreate = false">
      <form class="space-y-4" @submit.prevent="createKey">
        <p class="text-sm text-ink-200">
          Untuk user: <span class="font-mono text-glow">{{ selectedUser }}</span>
        </p>
        <div>
          <label class="label">Nama (opsional)</label>
          <input v-model="keyName" class="input" placeholder="mis. app-produksi" spellcheck="false" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showCreate = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy">Generate</button>
        </div>
      </form>
    </Modal>

    <!-- secret shown once -->
    <Modal :open="!!created" title="Simpan Kredensial Ini" @close="created = null">
      <div class="space-y-4">
        <p class="text-sm text-danger font-semibold">
          ⚠ Secret key hanya ditampilkan SEKALI. Simpan sekarang.
        </p>
        <div>
          <label class="label">Access Key</label>
          <div class="flex gap-2">
            <input :value="created?.accessKey" readonly class="input" />
            <button class="btn-ghost shrink-0 h-10" @click="copy(created!.accessKey)">Copy</button>
          </div>
        </div>
        <div>
          <label class="label">Secret Key</label>
          <div class="flex gap-2">
            <input :value="created?.secretKey" readonly class="input" />
            <button class="btn-ghost shrink-0 h-10" @click="copy(created!.secretKey)">Copy</button>
          </div>
        </div>
        <div class="flex justify-end">
          <button class="btn-primary" @click="created = null">Sudah Kusimpan</button>
        </div>
      </div>
    </Modal>

    <!-- delete -->
    <Modal :open="!!confirmDelete" title="Hapus Access Key" @close="confirmDelete = null">
      <p class="text-sm text-ink-200">
        Yakin hapus key <span class="font-mono text-danger">{{ confirmDelete }}</span>?
        Aplikasi yang memakainya akan langsung kehilangan akses.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deleteKey">Hapus</button>
      </div>
    </Modal>
  </div>
</template>
