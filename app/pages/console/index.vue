<script setup lang="ts">
definePageMeta({ title: 'Dashboard', layout: 'console' })

const { user, fetch: refreshSession } = useUserSession()
const isAdmin = computed(() => Boolean((user.value as any)?.admin))
const toast = useToast()

const { data: info, status, error, refresh: refreshInfo } = useFetch('/api/admin/info', { server: false })
const { data: metrics, refresh: refreshMetrics } = useFetch('/api/admin/metrics', { server: false })
const { data: buckets } = useFetch('/api/buckets', { server: false })

const loading = computed(() => status.value === 'pending' || status.value === 'idle')

async function syncAll() {
  await Promise.all([refreshInfo(), refreshMetrics()])
  toast.ok('Metrics disinkronkan')
}

const rechecking = ref(false)
async function recheckAdmin() {
  rechecking.value = true
  try {
    const res: any = await $fetch('/api/auth/recheck', { method: 'POST' })
    await refreshSession()
    if (res.admin) toast.ok('Akses admin aktif — menu administrasi dibuka')
    else toast.error(`Bukan admin: ${res.reason || 'tidak ada hak admin'}`)
  } catch (e: any) {
    toast.error(apiError(e))
  } finally {
    rechecking.value = false
  }
}

// ---- capacity donut ----
const usedPct = computed(() => {
  const total = info.value?.totalSpace || 0
  if (!total) return 0
  return Math.min(100, (info.value!.usage / total) * 100)
})
const freePct = computed(() => 100 - usedPct.value)
const CIRC = 2 * Math.PI * 52 // r=52
const dash = computed(() => `${(Math.max(usedPct.value, 0.5) / 100) * CIRC} ${CIRC}`)

// ---- size distribution ----
const distMax = computed(() =>
  Math.max(1, ...(metrics.value?.sizeDistribution || []).map((d: any) => d.count)),
)
const distTotal = computed(() =>
  (metrics.value?.sizeDistribution || []).reduce((a: number, d: any) => a + d.count, 0),
)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3 rise">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p class="text-ink-400 text-sm mt-1">Ringkasan kondisi cluster object storage.</p>
      </div>
      <button v-if="isAdmin" class="btn-ghost" @click="syncAll">⟳ Sync</button>
    </div>

    <div v-if="!isAdmin" class="card p-5 border-glow/30 rise space-y-3">
      <p class="text-sm text-ink-200">
        Kamu login sebagai user biasa — metrics server & menu administrasi hanya tersedia untuk akun admin
        (root atau user dengan policy <span class="font-mono text-glow">consoleAdmin</span>).
        Menu <NuxtLink to="/console/buckets" class="text-glow underline underline-offset-4">Buckets</NuxtLink> tetap bisa dipakai.
      </p>
      <button class="btn-ghost h-8 text-xs" :disabled="rechecking" @click="recheckAdmin">
        {{ rechecking ? 'Mengecek…' : 'Cek ulang akses admin' }}
      </button>
    </div>

    <template v-else>
      <div v-if="error" class="card p-5 border-danger/30">
        <p class="text-sm text-danger font-mono">{{ apiError(error) }}</p>
      </div>

      <!-- stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="card p-4 rise">
          <p class="label mb-2">Buckets</p>
          <p class="text-3xl font-extrabold tracking-tight">
            <span v-if="loading" class="inline-block w-12 h-7 rounded bg-ink-700 animate-pulse" />
            <template v-else>{{ info?.buckets ?? buckets?.length ?? '—' }}</template>
          </p>
        </div>
        <div class="card p-4 rise" style="animation-delay: 40ms">
          <p class="label mb-2">Objects</p>
          <p class="text-3xl font-extrabold tracking-tight">
            <span v-if="loading" class="inline-block w-12 h-7 rounded bg-ink-700 animate-pulse" />
            <template v-else>{{ info?.objects ?? '—' }}</template>
          </p>
        </div>
        <div class="card p-4 rise" style="animation-delay: 80ms">
          <p class="label mb-2">Servers</p>
          <div class="flex items-end gap-4">
            <div>
              <p class="text-3xl font-extrabold tracking-tight">{{ info?.servers?.filter((s: any) => s.state === 'online').length ?? '—' }}</p>
              <p class="font-mono text-[10px] text-ok mt-0.5">● online</p>
            </div>
            <div>
              <p class="text-3xl font-extrabold tracking-tight text-ink-400">{{ info?.servers ? info.servers.filter((s: any) => s.state !== 'online').length : '—' }}</p>
              <p class="font-mono text-[10px] text-danger mt-0.5">● offline</p>
            </div>
          </div>
        </div>
        <div class="card p-4 rise" style="animation-delay: 120ms">
          <p class="label mb-2">Drives</p>
          <div class="flex items-end gap-4">
            <div>
              <p class="text-3xl font-extrabold tracking-tight">{{ info?.drives?.online ?? '—' }}</p>
              <p class="font-mono text-[10px] text-ok mt-0.5">● online</p>
            </div>
            <div>
              <p class="text-3xl font-extrabold tracking-tight text-ink-400">{{ info ? info.drives.total - info.drives.online : '—' }}</p>
              <p class="font-mono text-[10px] text-danger mt-0.5">● offline</p>
            </div>
          </div>
        </div>
      </div>

      <!-- capacity + network -->
      <div class="grid lg:grid-cols-2 gap-3">
        <div class="card p-5 flex flex-col sm:flex-row items-center gap-6 rise text-center sm:text-left" style="animation-delay: 160ms">
          <div class="relative size-32 shrink-0">
            <svg viewBox="0 0 120 120" class="size-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-ink-700)" stroke-width="10" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke="var(--color-glow)" stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="dash"
              />
            </svg>
            <div class="absolute inset-0 grid place-items-center text-center">
              <div>
                <p class="font-extrabold text-lg leading-none">{{ freePct.toFixed(freePct > 99 ? 1 : 0) }}%</p>
                <p class="font-mono text-[9px] uppercase tracking-widest text-ink-400 mt-1">free</p>
              </div>
            </div>
          </div>
          <div>
            <p class="label mb-1">Capacity</p>
            <p class="text-3xl font-extrabold tracking-tight">{{ fmtBytes(info?.usage) }}</p>
            <p class="text-sm text-ink-400 mt-1">terpakai dari <span class="text-ink-200 font-semibold">{{ fmtBytes(info?.totalSpace) }}</span></p>
          </div>
        </div>

        <div class="card p-5 rise" style="animation-delay: 200ms">
          <p class="label mb-4">Network Traffic <span class="normal-case tracking-normal">(sejak start)</span></p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="font-mono text-[11px] text-ink-400 mb-1">GET <span class="text-ok">↑</span></p>
              <p class="text-3xl font-extrabold tracking-tight">{{ fmtBytes(metrics?.traffic?.get) }}</p>
              <p class="font-mono text-[10px] text-ink-500 mt-1">dikirim ke client</p>
            </div>
            <div>
              <p class="font-mono text-[11px] text-ink-400 mb-1">PUT <span class="text-glow">↓</span></p>
              <p class="text-3xl font-extrabold tracking-tight">{{ fmtBytes(metrics?.traffic?.put) }}</p>
              <p class="font-mono text-[10px] text-ink-500 mt-1">diterima dari client</p>
            </div>
          </div>
        </div>
      </div>

      <!-- status tiles -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 rise" style="animation-delay: 240ms">
        <div class="rounded-xl border border-ok/25 bg-ok/8 px-4 py-3 flex items-center justify-between">
          <p class="font-mono text-[11px] uppercase tracking-wider text-ok">Uptime</p>
          <p class="font-mono text-sm text-ink-100">{{ fmtUptime(info?.servers?.[0]?.uptime) }} ✓</p>
        </div>
        <div class="rounded-xl border border-ok/25 bg-ok/8 px-4 py-3 flex items-center justify-between">
          <p class="font-mono text-[11px] uppercase tracking-wider text-ok">Bucket Scans</p>
          <p class="font-mono text-sm text-ink-100">{{ metrics?.scansFinished ?? '—' }} selesai ✓</p>
        </div>
        <div class="rounded-xl border border-ok/25 bg-ok/8 px-4 py-3 flex items-center justify-between">
          <p class="font-mono text-[11px] uppercase tracking-wider text-ok">Mode</p>
          <p class="font-mono text-sm text-ink-100">{{ info?.mode ?? '—' }} ✓</p>
        </div>
      </div>

      <!-- object size distribution -->
      <div class="card rise" style="animation-delay: 280ms">
        <div class="px-5 py-3.5 border-b border-ink-700 flex items-center justify-between">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">Object Size Distribution</h2>
          <p class="font-mono text-[11px] text-ink-500">{{ distTotal }} objek</p>
        </div>
        <div class="p-5 space-y-2.5">
          <p v-if="!distTotal" class="text-sm text-ink-400">Belum ada data — scanner jalan berkala, coba Sync beberapa saat lagi.</p>
          <div
            v-for="d in metrics?.sizeDistribution || []"
            :key="d.label"
            class="flex items-center gap-3 group"
            :title="`${d.label}: ${d.count} objek`"
          >
            <p class="w-28 shrink-0 font-mono text-[11px] text-ink-300 text-right">{{ d.label }}</p>
            <div class="flex-1 h-2.5 rounded-full bg-ink-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-glow transition-all duration-500 group-hover:brightness-110"
                :style="{ width: d.count ? `${Math.max((d.count / distMax) * 100, 2)}%` : '0%' }"
              />
            </div>
            <p class="w-10 shrink-0 font-mono text-[11px] text-ink-200">{{ d.count }}</p>
          </div>
        </div>
      </div>

      <!-- servers table -->
      <div v-if="info?.servers?.length" class="card overflow-hidden rise" style="animation-delay: 320ms">
        <div class="px-5 py-3.5 border-b border-ink-700">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">Servers</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Versi</th>
                <th>Uptime</th>
                <th>Drives</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in info.servers" :key="s.endpoint">
                <td class="font-mono text-xs">{{ s.endpoint }}</td>
                <td>
                  <span :class="s.state === 'online' ? 'badge-ok' : 'badge-off'">{{ s.state }}</span>
                </td>
                <td class="font-mono text-xs text-ink-300">{{ s.version }}</td>
                <td class="font-mono text-xs text-ink-300">{{ fmtUptime(s.uptime) }}</td>
                <td class="font-mono text-xs text-ink-300">
                  {{ (s.drives || []).filter((d: any) => d.state === 'ok').length }}/{{ (s.drives || []).length }} ok
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
