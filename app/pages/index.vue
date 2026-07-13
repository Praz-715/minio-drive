<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const toast = useToast()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)

// tujuan setelah login: ?redirect= (path internal saja) → default /drive.
// dipakai flow "buka link share → login → balik ke link → auto-afiliasi".
function destAfterAuth(): string {
  const r = String(route.query.redirect || '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/drive'
}
const registerTo = computed(() => {
  const r = String(route.query.redirect || '')
  return r ? `/register?redirect=${encodeURIComponent(r)}` : '/register'
})

async function submit() {
  loading.value = true
  const { error } = await authClient.signIn.email({ email: email.value, password: password.value })
  loading.value = false
  if (error) {
    toast.error(error.message || 'Email atau password salah')
    return
  }
  await navigateTo(destAfterAuth())
}

const features = [
  { icon: '🗂️', title: 'Drive pribadi', desc: 'Ruang & kuota sendiri untuk tiap user.' },
  { icon: '👥', title: 'Bucket bersama', desc: 'Satu ruang untuk kerja bareng tim.' },
  { icon: '🔗', title: 'Link publik', desc: 'Bagikan file, atur kedaluwarsa & password.' },
]
</script>

<template>
  <div class="min-h-screen grid-texture relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
    <!-- ganti tema -->
    <button class="btn-ghost absolute top-5 right-5 h-8 px-3 text-xs z-20" title="Ganti tema" @click="toggleTheme()">
      <span class="dark:hidden">☾</span>
      <span class="hidden dark:inline">☀</span>
    </button>

    <!-- glow ambient -->
    <div class="absolute -top-40 -left-24 w-[520px] h-[320px] bg-glow/10 blur-[130px] rounded-full pointer-events-none" />
    <div class="absolute -bottom-44 -right-24 w-[520px] h-[320px] bg-ok/[0.07] blur-[130px] rounded-full pointer-events-none" />

    <div class="w-full max-w-5xl relative grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <!-- ============ HERO ============ -->
      <div class="text-center lg:text-left">
        <div class="rise inline-flex items-center gap-3">
          <div class="size-12 rounded-2xl bg-glow/15 border border-glow/40 grid place-items-center glow-mark">
            <span class="text-glow font-black text-xl">Y</span>
          </div>
          <div class="text-left">
            <h1 class="text-2xl font-extrabold tracking-tight leading-none">YASA <span class="text-glow">DRIVE</span></h1>
            <p class="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400 mt-1.5">self-hosted storage · yasatech</p>
          </div>
        </div>

        <h2
          class="rise mt-8 text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.12] text-balance"
          style="animation-delay: 60ms"
        >
          Drive pribadi dan bucket tim, di server sendiri.
        </h2>
        <p class="rise mt-4 text-ink-300 leading-relaxed max-w-md mx-auto lg:mx-0 hidden sm:block" style="animation-delay: 120ms">
          Simpan, kelola, dan bagikan file tanpa menitipkannya ke pihak ketiga. Semuanya tetap di infrastrukturmu.
        </p>

        <ul class="rise mt-8 space-y-3.5 hidden lg:block" style="animation-delay: 180ms">
          <li v-for="f in features" :key="f.title" class="flex items-start gap-3">
            <span class="text-lg shrink-0 leading-none mt-0.5">{{ f.icon }}</span>
            <div>
              <p class="font-semibold text-sm">{{ f.title }}</p>
              <p class="text-ink-400 text-sm">{{ f.desc }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- ============ FORM ============ -->
      <div class="w-full max-w-sm mx-auto lg:mx-0 lg:justify-self-end">
        <form class="card p-6 sm:p-7 space-y-4 rise" style="animation-delay: 100ms" @submit.prevent="submit">
          <div class="mb-1">
            <h3 class="text-lg font-extrabold tracking-tight">Masuk ke Drive</h3>
            <p class="text-ink-400 text-sm mt-0.5">Pakai email & password akunmu.</p>
          </div>
          <div>
            <label class="label" for="email">Email</label>
            <input id="email" v-model="email" type="email" class="input" autocomplete="email" placeholder="nama@yasatech.co.id" />
          </div>
          <div>
            <label class="label" for="password">Password</label>
            <input id="password" v-model="password" type="password" class="input" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <button class="btn-primary w-full" type="submit" :disabled="loading || !email || !password">
            <span v-if="loading" class="size-3.5 border-2 border-ink-950/40 border-t-ink-950 rounded-full animate-spin" />
            {{ loading ? 'Masuk…' : 'Masuk ke Drive' }}
          </button>
          <p class="text-center text-sm text-ink-400">
            Belum punya akun?
            <NuxtLink :to="registerTo" class="text-glow font-semibold hover:brightness-110">Daftar</NuxtLink>
          </p>
        </form>

        <!-- pintu ke Storage Console -->
        <NuxtLink
          to="/console/login"
          class="rise mt-3 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 px-4 py-3 hover:border-glow/40 transition-colors group"
          style="animation-delay: 200ms"
        >
          <span class="text-lg shrink-0">⚙️</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold group-hover:text-glow transition-colors">Storage Console</p>
            <p class="font-mono text-[10px] text-ink-500 truncate">admin MinIO · login pakai access key</p>
          </div>
          <span class="font-mono text-xs text-ink-400 group-hover:text-glow transition-colors">→</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
