<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { fetch: refreshSession } = useUserSession()
const toast = useToast()

const accessKey = ref('')
const secretKey = ref('')
const loading = ref(false)

async function submit() {
  if (!accessKey.value || !secretKey.value) return
  loading.value = true
  try {
    const res: any = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { accessKey: accessKey.value, secretKey: secretKey.value },
    })
    if (!res.admin && res.adminReason && !/access denied/i.test(res.adminReason)) {
      toast.info(`Login sebagai user biasa — cek admin gagal: ${res.adminReason}`)
    }
    await refreshSession()
    await navigateTo('/console')
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen grid-texture flex items-center justify-center p-6 relative overflow-hidden">
    <button
      class="btn-ghost absolute top-5 right-5 h-8 px-3 text-xs z-10"
      title="Ganti tema"
      @click="toggleTheme()"
    >
      <span class="dark:hidden">☾</span>
      <span class="hidden dark:inline">☀</span>
    </button>
    <!-- glow accent -->
    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-glow/8 blur-[120px] rounded-full pointer-events-none" />

    <div class="w-full max-w-sm relative">
      <div class="mb-8 rise" style="animation-delay: 0ms">
        <div class="flex items-center gap-3 mb-2">
          <div class="size-10 rounded-xl bg-glow/15 border border-glow/40 grid place-items-center glow-mark">
            <span class="text-glow font-black">Y</span>
          </div>
          <div>
            <h1 class="text-2xl font-extrabold tracking-tight leading-none">YASA</h1>
            <p class="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400 mt-1">object storage console</p>
          </div>
        </div>
      </div>

      <form class="card p-6 space-y-4 rise" style="animation-delay: 90ms" @submit.prevent="submit">
        <div>
          <label class="label" for="ak">Access Key</label>
          <input id="ak" v-model="accessKey" class="input" autocomplete="username" spellcheck="false" placeholder="mis. tegwa-admin" />
        </div>
        <div>
          <label class="label" for="sk">Secret Key</label>
          <input id="sk" v-model="secretKey" type="password" class="input" autocomplete="current-password" placeholder="••••••••••••" />
        </div>
        <button class="btn-primary w-full" type="submit" :disabled="loading || !accessKey || !secretKey">
          <span v-if="loading" class="size-3.5 border-2 border-ink-950/40 border-t-ink-950 rounded-full animate-spin" />
          {{ loading ? 'Menghubungkan…' : 'Masuk' }}
        </button>
      </form>

      <p class="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 rise" style="animation-delay: 180ms">
        self-hosted · s3 compatible · yasatech
      </p>
    </div>
  </div>
</template>
