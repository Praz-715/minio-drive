<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :disabled="disabled"
    class="relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors cursor-pointer
      disabled:opacity-40 disabled:pointer-events-none"
    :class="model ? 'bg-glow' : 'bg-ink-600'"
    @click="model = !model"
  >
    <span
      class="inline-block size-3.5 rounded-full bg-ink-950 transition-transform"
      :class="model ? 'translate-x-[22px]' : 'translate-x-[3px]'"
    />
  </button>
</template>
