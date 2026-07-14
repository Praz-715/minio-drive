<script setup lang="ts">
const { user, clear } = useUserSession()
const route = useRoute()
const { data: meta } = useFetch('/api/meta', { server: false })

const isAdmin = computed(() => Boolean((user.value as any)?.admin))
const accessKey = computed(() => (user.value as any)?.accessKey || '')

const sidebarOpen = ref(false)
watch(() => route.fullPath, () => (sidebarOpen.value = false))

const nav = [
  { to: '/console', label: 'Dashboard', num: '01' },
  { to: '/console/buckets', label: 'Buckets', num: '02' },
]
const adminNav = [
  { to: '/console/users', label: 'Users', num: '03' },
  { to: '/console/policies', label: 'Policies', num: '04' },
  { to: '/console/keys', label: 'Access Keys', num: '05' },
]

function isActive(to: string) {
  if (to === '/console') return route.path === '/console'
  return route.path.startsWith(to)
}

async function logout() {
  await clear()
  navigateTo('/console/login')
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- backdrop drawer (mobile) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-ink-950/60 backdrop-blur-sm lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- sidebar: drawer di mobile/tablet, fixed di laptop -->
    <aside
      class="w-60 shrink-0 border-r border-ink-700 bg-ink-900 lg:bg-ink-900/70 flex flex-col fixed inset-y-0 left-0 z-40
        transform transition-transform duration-200 ease-out lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="px-5 pt-6 pb-5 border-b border-ink-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="size-8 rounded-lg bg-glow/15 border border-glow/40 grid place-items-center">
            <span class="text-glow font-black text-sm">Y</span>
          </div>
          <div>
            <p class="font-extrabold tracking-tight leading-none">YASA</p>
            <p class="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-400 mt-1">storage console</p>
          </div>
        </div>
        <button
          class="lg:hidden size-9 grid place-items-center text-ink-400 hover:text-ink-100 cursor-pointer"
          aria-label="Tutup menu"
          @click="sidebarOpen = false"
        >✕</button>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div>
          <p class="label px-2">Storage</p>
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors"
            :class="isActive(item.to) ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
          >
            <span class="font-mono text-[10px]" :class="isActive(item.to) ? 'text-glow/70' : 'text-ink-500'">{{ item.num }}</span>
            <span class="font-semibold">{{ item.label }}</span>
          </NuxtLink>
        </div>

        <div v-if="isAdmin">
          <p class="label px-2">Administration</p>
          <NuxtLink
            v-for="item in adminNav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors"
            :class="isActive(item.to) ? 'bg-glow/10 text-glow' : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800'"
          >
            <span class="font-mono text-[10px]" :class="isActive(item.to) ? 'text-glow/70' : 'text-ink-500'">{{ item.num }}</span>
            <span class="font-semibold">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="px-4 py-4 border-t border-ink-800 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="size-2 rounded-full bg-ok shrink-0 shadow-[0_0_8px] shadow-ok/70" />
          <div class="min-w-0">
            <p class="font-mono text-xs text-ink-100 truncate">{{ accessKey }}</p>
            <p class="font-mono text-[10px] text-ink-500">{{ isAdmin ? 'admin' : 'user' }}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost flex-1 h-9 lg:h-8 text-xs" title="Ganti tema" @click="toggleTheme()">
            <span class="dark:hidden">☾ Dark</span>
            <span class="hidden dark:inline">☀ Light</span>
          </button>
          <button class="btn-ghost flex-1 h-9 lg:h-8 text-xs" @click="logout">Logout</button>
        </div>
      </div>
    </aside>

    <!-- main -->
    <div class="flex-1 lg:ml-60 min-w-0">
      <header class="h-14 border-b border-ink-800 flex items-center gap-3 px-4 sm:px-6 sticky top-0 bg-ink-950/80 backdrop-blur z-20">
        <button
          class="lg:hidden size-10 -ml-2 grid place-items-center text-ink-300 hover:text-ink-100 cursor-pointer"
          aria-label="Buka menu"
          @click="sidebarOpen = true"
        >
          <span class="text-lg leading-none">☰</span>
        </button>
        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400 truncate">
          {{ route.meta.title || '' }}
        </p>
        <div class="flex-1" />
        <p v-if="meta?.endpoint" class="hidden md:block font-mono text-[11px] text-ink-500 truncate min-w-0 max-w-[40ch]">
          <span class="text-ink-400">endpoint</span> <span class="text-ink-200">{{ meta.endpoint }}</span>
        </p>
      </header>
      <main class="p-4 sm:p-6 max-w-6xl">
        <slot />
      </main>
    </div>
  </div>
</template>
