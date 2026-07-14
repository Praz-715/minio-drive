<script setup lang="ts">
definePageMeta({ title: 'Buckets', layout: 'console' })

const toast = useToast()
const { data: buckets, refresh, status } = useFetch('/api/buckets', { server: false })

const showCreate = ref(false)
const busy = ref(false)
const confirmDelete = ref<string | null>(null)

const form = reactive({
  name: '',
  versioning: false,
  objectLocking: false,
  quotaOn: false,
  quota: '10GiB',
  access: 'private',
})

const ACCESS_OPTIONS = [
  { value: 'private', label: 'Private — hanya user terautentikasi' },
  { value: 'download', label: 'Public Read — siapa pun bisa download' },
  { value: 'upload', label: 'Public Write — siapa pun bisa upload' },
  { value: 'public', label: 'Public Read+Write — dua-duanya' },
]

// object locking mensyaratkan versioning aktif
watch(() => form.objectLocking, (on) => {
  if (on) form.versioning = true
})

async function createBucket() {
  busy.value = true
  try {
    const res: any = await $fetch('/api/buckets', {
      method: 'POST',
      body: {
        name: form.name,
        versioning: form.versioning,
        objectLocking: form.objectLocking,
        quota: form.quotaOn ? form.quota : '',
        access: form.access,
      },
    })
    res.quotaWarning ? toast.info(res.quotaWarning) : toast.ok(`Bucket "${form.name}" dibuat`)
    showCreate.value = false
    Object.assign(form, { name: '', versioning: false, objectLocking: false, quotaOn: false, quota: '10GiB', access: 'private' })
    await refresh()
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    busy.value = false
  }
}

async function deleteBucket() {
  if (!confirmDelete.value) return
  busy.value = true
  try {
    await $fetch(`/api/buckets/${encodeURIComponent(confirmDelete.value)}`, { method: 'DELETE' })
    toast.ok(`Bucket "${confirmDelete.value}" dihapus`)
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
        <h1 class="text-3xl font-extrabold tracking-tight">Buckets</h1>
        <p class="text-ink-400 text-sm mt-1">{{ buckets?.length ?? 0 }} bucket di server ini.</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">+ Bucket Baru</button>
    </div>

    <div class="card overflow-x-auto rise" style="animation-delay: 80ms">
      <table class="tbl">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Dibuat</th>
            <th class="w-24" />
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' || status === 'idle'">
            <td colspan="3" class="text-center text-ink-400 py-10 font-mono text-xs">memuat…</td>
          </tr>
          <tr v-else-if="!buckets?.length">
            <td colspan="3" class="text-center text-ink-400 py-10">
              Belum ada bucket — bikin yang pertama.
            </td>
          </tr>
          <tr v-for="b in buckets" :key="b.name" class="group">
            <td>
              <NuxtLink :to="`/console/buckets/${b.name}`" class="flex items-center gap-3 font-semibold hover:text-glow transition-colors">
                <span class="text-glow/70 font-mono text-xs">▣</span>
                {{ b.name }}
              </NuxtLink>
            </td>
            <td class="font-mono text-xs text-ink-300">{{ fmtDate(b.creationDate) }}</td>
            <td class="text-right">
              <button
                class="text-ink-500 hover:text-danger transition-colors text-xs font-mono row-actions cursor-pointer inline-flex items-center py-2.5 -my-2.5"
                @click="confirmDelete = b.name"
              >
                hapus
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal :open="showCreate" title="Create Bucket" wide @close="showCreate = false">
      <form class="grid md:grid-cols-[1fr_240px] gap-6" @submit.prevent="createBucket">
        <div class="space-y-5 min-w-0">
          <div>
            <label class="label">Nama Bucket</label>
            <input v-model="form.name" class="input" placeholder="mis. file-sharing" spellcheck="false" />
            <p class="mt-1.5 text-[11px] text-ink-500 font-mono">3-63 karakter · huruf kecil, angka, titik, strip</p>
          </div>

          <div>
            <label class="label">Access</label>
            <select v-model="form.access" class="input cursor-pointer">
              <option v-for="o in ACCESS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <p v-if="form.access !== 'private'" class="mt-1.5 text-[11px] text-danger font-mono">
              ⚠ objek bisa diakses siapa pun tanpa login — termasuk lewat tunnel publik lu
            </p>
          </div>

          <div>
            <p class="label">Features</p>
            <div class="space-y-3 mt-2">
              <div class="flex items-center justify-between gap-4">
                <p class="text-sm font-semibold">Versioning</p>
                <Toggle v-model="form.versioning" :disabled="form.objectLocking" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <p class="text-sm font-semibold">Object Locking</p>
                <Toggle v-model="form.objectLocking" />
              </div>
              <div class="flex items-center justify-between gap-4">
                <p class="text-sm font-semibold">Quota</p>
                <Toggle v-model="form.quotaOn" />
              </div>
              <div v-if="form.quotaOn">
                <input v-model="form.quota" class="input" placeholder="mis. 10GiB" spellcheck="false" />
                <p class="mt-1.5 text-[11px] text-ink-500 font-mono">format: 500MiB · 10GiB · 1TiB</p>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" @click="showCreate = false">Batal</button>
            <button type="submit" class="btn-primary" :disabled="busy || !form.name">Create Bucket</button>
          </div>
        </div>

        <aside class="rounded-lg bg-ink-900 border border-ink-700 p-4 space-y-3 text-[12px] leading-relaxed text-ink-300 h-fit">
          <p><span class="text-ink-100 font-semibold">Versioning</span> menyimpan banyak versi objek pada key yang sama — proteksi dari overwrite/hapus tak sengaja.</p>
          <p><span class="text-ink-100 font-semibold">Object Locking</span> mencegah objek dihapus (retention/legal hold). Hanya bisa diaktifkan saat bucket dibuat, dan otomatis menyalakan versioning.</p>
          <p><span class="text-ink-100 font-semibold">Quota</span> membatasi total ukuran data dalam bucket.</p>
        </aside>
      </form>
    </Modal>

    <Modal :open="!!confirmDelete" title="Hapus Bucket" @close="confirmDelete = null">
      <p class="text-sm text-ink-200">
        Yakin hapus bucket <span class="font-mono text-glow">{{ confirmDelete }}</span>?
        Hanya bucket kosong yang bisa dihapus.
      </p>
      <div class="flex justify-end gap-2 mt-5">
        <button class="btn-ghost" @click="confirmDelete = null">Batal</button>
        <button class="btn-danger" :disabled="busy" @click="deleteBucket">Hapus</button>
      </div>
    </Modal>
  </div>
</template>
