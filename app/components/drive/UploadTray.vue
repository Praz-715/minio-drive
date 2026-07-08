<script setup lang="ts">
const { queue, cancel, clearFinished } = useUpload()

const collapsed = ref(false)

const active = computed(() => queue.value.filter((i) => i.status === 'queued' || i.status === 'uploading').length)
const done = computed(() => queue.value.filter((i) => i.status === 'done').length)
const errors = computed(() => queue.value.filter((i) => i.status === 'error').length)
const allFinished = computed(() => queue.value.length > 0 && active.value === 0)

const heading = computed(() => {
  if (active.value) return `Mengupload ${active.value} file…`
  if (errors.value) return `${done.value} selesai · ${errors.value} gagal`
  return `${done.value} file terupload`
})

function pct(i: { size: number; loaded: number; status: string }) {
  if (i.status === 'done') return 100
  if (i.size <= 0) return i.status === 'uploading' ? 50 : 0
  return Math.min(100, Math.round((i.loaded / i.size) * 100))
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-4"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div
      v-if="queue.length"
      class="fixed z-30 card shadow-2xl overflow-hidden
        right-4 lg:right-5 w-[calc(100vw-2rem)] max-w-sm lg:w-80
        bottom-[calc(env(safe-area-inset-bottom)+5rem)] lg:bottom-5"
    >
      <!-- header -->
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800 bg-ink-900/60">
        <span v-if="active" class="text-glow animate-spin text-sm">⟳</span>
        <span v-else-if="errors" class="text-danger text-sm">⚠</span>
        <span v-else class="text-ok text-sm">✓</span>
        <p class="text-sm font-semibold flex-1 truncate">{{ heading }}</p>
        <button
          class="size-7 grid place-items-center text-ink-400 hover:text-ink-100 cursor-pointer text-xs"
          :title="collapsed ? 'Perluas' : 'Ciutkan'"
          @click="collapsed = !collapsed"
        >{{ collapsed ? '▲' : '▼' }}</button>
        <button
          v-if="allFinished"
          class="size-7 grid place-items-center text-ink-400 hover:text-ink-100 cursor-pointer text-xs"
          title="Tutup"
          @click="clearFinished"
        >✕</button>
      </div>

      <!-- daftar -->
      <div v-show="!collapsed" class="max-h-72 overflow-y-auto divide-y divide-ink-800">
        <div v-for="i in queue" :key="i.id" class="px-4 py-2.5">
          <div class="flex items-center gap-2">
            <span class="inline-flex w-9 justify-center rounded border font-mono text-[9px] px-1 py-0.5 shrink-0" :class="fileChip(i.name).cls">
              {{ fileChip(i.name).label }}
            </span>
            <p class="font-mono text-[12px] truncate flex-1">{{ i.name }}</p>
            <span v-if="i.status === 'done'" class="text-ok text-xs shrink-0">✓</span>
            <span v-else-if="i.status === 'error'" class="text-danger text-xs shrink-0" :title="i.error">✕</span>
            <button
              v-else
              class="text-ink-500 hover:text-danger text-xs font-mono cursor-pointer shrink-0"
              title="Batalkan"
              @click="cancel(i.id)"
            >✕</button>
          </div>

          <!-- progress / status -->
          <template v-if="i.status === 'error'">
            <p class="mt-1 font-mono text-[10px] text-danger truncate">{{ i.error }}</p>
          </template>
          <template v-else>
            <div class="mt-1.5 h-1 rounded-full bg-ink-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-200"
                :class="i.status === 'done' ? 'bg-ok' : 'bg-glow'"
                :style="{ width: `${Math.max(pct(i), 3)}%` }"
              />
            </div>
            <p class="mt-1 font-mono text-[10px] text-ink-500">
              <template v-if="i.status === 'done'">{{ fmtBytes(i.size) }}</template>
              <template v-else-if="i.status === 'uploading'">{{ fmtBytes(i.loaded) }} / {{ fmtBytes(i.size) }} · {{ pct(i) }}%</template>
              <template v-else>menunggu…</template>
            </p>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>
