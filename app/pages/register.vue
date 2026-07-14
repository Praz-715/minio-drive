<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const toast = useToast()
const route = useRoute()
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)

function destAfterAuth(): string {
  const r = String(route.query.redirect || '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/drive'
}
const loginTo = computed(() => {
  const r = String(route.query.redirect || '')
  return r ? `/?redirect=${encodeURIComponent(r)}` : '/'
})

async function submit() {
  if (password.value.length < 8) {
    toast.error('Password minimal 8 karakter')
    return
  }
  loading.value = true
  const { error } = await authClient.signUp.email({
    name: name.value,
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (error) {
    toast.error(error.message || 'Gagal mendaftar')
    return
  }
  toast.ok('Akun dibuat — selamat datang!')
  await navigateTo(destAfterAuth())
}
</script>

<template>
  <div class="min-h-screen grid-texture flex items-center justify-center p-6 relative overflow-hidden">
    <button class="btn-ghost absolute top-5 right-5 h-9 px-3 text-xs z-10" title="Ganti tema" @click="toggleTheme()">
      <span class="dark:hidden">☾</span>
      <span class="hidden dark:inline">☀</span>
    </button>
    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-glow/8 blur-[120px] rounded-full pointer-events-none" />

    <div class="w-full max-w-sm relative">
      <NuxtLink to="/" class="mb-8 rise inline-flex">
        <BrandMark size="md" subtitle="buat akun baru" />
      </NuxtLink>

      <form class="card p-6 space-y-4 rise" style="animation-delay: 90ms" @submit.prevent="submit">
        <div>
          <label class="label" for="name">Nama</label>
          <input id="name" v-model="name" class="input" autocomplete="name" placeholder="Nama lengkap" />
        </div>
        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="email" type="email" class="input" autocomplete="email" placeholder="nama@mail.co.id" />
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <input id="password" v-model="password" type="password" class="input" autocomplete="new-password" placeholder="min. 8 karakter" />
        </div>
        <button class="btn-primary w-full" type="submit" :disabled="loading || !name || !email || !password">
          <span v-if="loading" class="size-3.5 border-2 border-ink-950/40 border-t-ink-950 rounded-full animate-spin" />
          {{ loading ? 'Mendaftar…' : 'Daftar' }}
        </button>
        <p class="text-center text-sm text-ink-400">
          Sudah punya akun?
          <NuxtLink :to="loginTo" class="text-glow font-semibold hover:brightness-110">Masuk</NuxtLink>
        </p>
      </form>
    </div>
  </div>
</template>
