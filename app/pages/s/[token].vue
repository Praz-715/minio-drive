<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const route = useRoute()
const token = String(route.params.token)

// metadata publik (selalu 200 — pakai flag found/expired)
const { data: meta } = await useFetch<any>(`/api/s/${token}`)

const kind = computed(() => (meta.value?.name ? previewKind(meta.value.name) : null))

const MAX_TEXT = 1024 * 1024
const password = ref('')
const url = ref('')
const textContent = ref('')
const unlocked = ref(false)
const loadingAccess = ref(false)
const accessError = ref('')
const downloading = ref(false)

async function fetchAccess(download = false) {
  const res: any = await $fetch(`/api/s/${token}/access`, {
    method: 'POST',
    body: { password: password.value || undefined, download },
  })
  return res.url as string
}

async function unlock() {
  if (!meta.value?.found || meta.value.expired) return
  loadingAccess.value = true
  accessError.value = ''
  try {
    url.value = await fetchAccess(false)
    unlocked.value = true
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

async function download() {
  downloading.value = true
  accessError.value = ''
  try {
    const u = await fetchAccess(true)
    const a = document.createElement('a')
    a.href = u
    a.download = meta.value?.name || 'download'
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (meta.value) meta.value.downloads = (meta.value.downloads || 0) + 1
  } catch (e: any) {
    accessError.value = apiError(e)
  } finally {
    downloading.value = false
  }
}

onMounted(() => {
  if (meta.value?.found && !meta.value.expired && !meta.value.hasPassword) unlock()
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

    <main class="flex-1 grid place-items-center p-4 sm:p-6">
      <!-- tidak ditemukan / dicabut -->
      <div v-if="!meta?.found" class="card p-8 sm:p-10 max-w-md w-full text-center rise">
        <p class="text-5xl mb-3">🔍</p>
        <h1 class="text-xl font-extrabold tracking-tight">Link tidak ditemukan</h1>
        <p class="text-ink-400 text-sm mt-2">Tautan ini salah, sudah dicabut, atau filenya sudah dihapus.</p>
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

      <!-- file valid -->
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
          <button v-if="unlocked" class="btn-primary shrink-0" :disabled="downloading" @click="download">
            {{ downloading ? '…' : '↓ Download' }}
          </button>
        </div>

        <!-- body -->
        <div class="p-5">
          <!-- gerbang password -->
          <div v-if="meta.hasPassword && !unlocked" class="max-w-sm mx-auto text-center py-8">
            <p class="text-4xl mb-3">🔒</p>
            <h2 class="font-bold">File ini dilindungi password</h2>
            <p class="text-ink-400 text-sm mt-1">Masukkan password untuk membukanya.</p>
            <form class="flex gap-2 mt-4" @submit.prevent="unlock">
              <input
                v-model="password"
                type="password"
                class="input"
                placeholder="password"
                autocomplete="off"
                autofocus
              />
              <button type="submit" class="btn-primary shrink-0" :disabled="loadingAccess || !password">Buka</button>
            </form>
            <p v-if="accessError" class="font-mono text-xs text-danger mt-3">{{ accessError }}</p>
          </div>

          <!-- preview -->
          <div v-else class="min-h-48 grid place-items-center">
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
                <button class="btn-primary mt-4" :disabled="downloading" @click="download">↓ Download file</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </main>

    <footer class="shrink-0 py-4 text-center">
      <p class="font-mono text-[11px] text-ink-500">
        Dibagikan lewat <NuxtLink to="/" class="text-glow hover:underline">Yasa Drive</NuxtLink>
      </p>
    </footer>
  </div>
</template>
