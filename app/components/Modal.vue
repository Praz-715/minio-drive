<script setup lang="ts">
defineProps<{ open: boolean; title: string; wide?: boolean; xl?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[90] bg-ink-950/80 backdrop-blur-sm flex items-start justify-center p-4 pt-[6vh] sm:pt-[12vh] overflow-y-auto"
        @click.self="emit('close')"
      >
        <div class="card w-full shadow-2xl rise" :class="xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-md'">
          <div class="flex items-center justify-between px-5 py-4 border-b border-ink-700">
            <h2 class="font-mono text-[12px] uppercase tracking-[0.2em] text-glow">{{ title }}</h2>
            <button class="text-ink-400 hover:text-white transition-colors cursor-pointer" @click="emit('close')">✕</button>
          </div>
          <div class="p-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
