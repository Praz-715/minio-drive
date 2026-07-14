<script setup lang="ts">
definePageMeta({ title: 'Policies', layout: 'console' })

const toast = useToast()
const { data: policies, refresh, status } = useFetch('/api/admin/policies', { server: false })

const BUILTIN = new Set(['readonly', 'readwrite', 'writeonly', 'diagnostics', 'consoleAdmin'])
const busy = ref(false)

// ---- view detail ----
const viewing = ref<string | null>(null)
const viewDoc = ref<any>(null)
async function view(name: string) {
  viewing.value = name
  viewDoc.value = null
  try {
    const res: any = await $fetch(`/api/admin/policies/${encodeURIComponent(name)}`)
    viewDoc.value = res.doc || res.raw
  } catch (e: any) {
    toast.error(apiError(e))
    viewing.value = null
  }
}

// ---- create ----
const showCreate = ref(false)
const newName = ref('')
const newDoc = ref(JSON.stringify(
  {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        Resource: ['arn:aws:s3:::NAMA-BUCKET', 'arn:aws:s3:::NAMA-BUCKET/*'],
      },
    ],
  },
  null,
  2,
))
async function createPolicy() {
  busy.value = true
  try {
    await $fetch('/api/admin/policies', { method: 'POST', body: { name: newName.value, policy: newDoc.value } })
    toast.ok(`Policy "${newName.value}" dibuat`)
    showCreate.value = false
    newName.value = ''
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

// ---- delete ----
const confirmDelete = ref<string | null>(null)
async function deletePolicy() {
  busy.value = true
  try {
    await $fetch(`/api/admin/policies/${encodeURIComponent(confirmDelete.value!)}`, { method: 'DELETE' })
    toast.ok(`Policy "${confirmDelete.value}" dihapus`)
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
        <h1 class="text-3xl font-extrabold tracking-tight">Policies</h1>
        <p class="text-ink-400 text-sm mt-1">Aturan akses IAM — {{ policies?.length ?? 0 }} policy.</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">+ Policy Baru</button>
    </div>

    <div class="card overflow-x-auto rise" style="animation-delay: 80ms">
      <table class="tbl">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Tipe</th>
            <th class="w-40" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="3" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <tr v-for="p in policies" :key="p.name" class="group">
            <td>
              <button class="font-mono text-[13px] font-semibold hover:text-glow transition-colors cursor-pointer" @click="view(p.name)">
                {{ p.name }}
              </button>
            </td>
            <td>
              <span :class="BUILTIN.has(p.name) ? 'badge-dim' : 'badge-ok'">
                {{ BUILTIN.has(p.name) ? 'built-in' : 'custom' }}
              </span>
            </td>
            <td>
              <div class="flex justify-end gap-3 font-mono text-xs row-actions [&>button]:py-2.5 [&>button]:-my-2.5 [&>button]:inline-flex [&>button]:items-center">
                <button class="text-ink-400 hover:text-glow cursor-pointer" @click="view(p.name)">lihat</button>
                <button
                  v-if="!BUILTIN.has(p.name)"
                  class="text-ink-400 hover:text-danger cursor-pointer"
                  @click="confirmDelete = p.name"
                >
                  hapus
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- view -->
    <Modal :open="!!viewing" :title="`Policy · ${viewing}`" wide @close="viewing = null">
      <pre v-if="viewDoc" class="bg-ink-900 border border-ink-700 rounded-lg p-4 font-mono text-xs text-ink-200 overflow-x-auto max-h-[50vh]">{{ JSON.stringify(viewDoc, null, 2) }}</pre>
      <p v-else class="text-ink-400 font-mono text-xs">memuat…</p>
    </Modal>

    <!-- create -->
    <Modal :open="showCreate" title="Policy Baru" wide @close="showCreate = false">
      <form class="space-y-4" @submit.prevent="createPolicy">
        <div>
          <label class="label">Nama Policy</label>
          <input v-model="newName" class="input" placeholder="mis. app-rw" spellcheck="false" />
        </div>
        <div>
          <label class="label">Dokumen Policy (JSON)</label>
          <textarea
            v-model="newDoc"
            rows="14"
            spellcheck="false"
            class="input h-auto py-3 font-mono text-xs leading-relaxed resize-y"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showCreate = false">Batal</button>
          <button type="submit" class="btn-primary" :disabled="busy || !newName">Buat Policy</button>
        </div>
      </form>
    </Modal>

    <!-- delete -->
    <Modal :open="!!confirmDelete" title="Hapus Policy" @close="confirmDelete = null">
      <p class="text-sm text-ink-200">
        Yakin hapus policy <span class="font-mono text-danger">{{ confirmDelete }}</span>?
        User yang masih memakainya akan kehilangan akses tersebut.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deletePolicy">Hapus</button>
      </div>
    </Modal>
  </div>
</template>
