<script setup lang="ts">
const toasts = useToasts()
const { dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed right-5 z-[100] flex flex-col gap-2 w-[min(20rem,calc(100vw-2.5rem))] bottom-[max(1.25rem,env(safe-area-inset-bottom))]">
      <TransitionGroup
        enter-active-class="transition duration-300"
        enter-from-class="opacity-0 translate-x-6"
        leave-active-class="transition duration-200"
        leave-to-class="opacity-0 translate-x-6"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="card px-4 py-3 flex items-start gap-3 shadow-xl cursor-pointer"
          :class="{
            'border-ok/40': t.type === 'ok',
            'border-danger/40': t.type === 'error',
          }"
          @click="dismiss(t.id)"
        >
          <span
            class="mt-1 size-2 rounded-full shrink-0"
            :class="{
              'bg-ok': t.type === 'ok',
              'bg-danger': t.type === 'error',
              'bg-glow': t.type === 'info',
            }"
          />
          <p class="text-sm text-ink-100 break-words min-w-0">{{ t.text }}</p>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
