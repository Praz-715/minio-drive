<script setup lang="ts">
// Logo + nama aplikasi. Baca branding kustom (useBranding); kalau kosong pakai
// bawaan: kotak "Y" + "YASA DRIVE". Dipakai di login, sidebar drive, & link publik.
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; subtitle?: string }>(), {
  size: 'sm',
})
const branding = useBranding()

const boxCls = {
  sm: 'size-8 rounded-lg text-sm',
  md: 'size-10 rounded-xl text-base glow-mark',
  lg: 'size-12 rounded-2xl text-xl glow-mark',
}[props.size]
const gapCls = props.size === 'sm' ? 'gap-2.5' : 'gap-3'
const nameCls = props.size === 'sm' ? '' : 'text-2xl leading-none'
</script>

<template>
  <span class="flex items-center min-w-0" :class="gapCls">
    <span
      class="bg-glow/15 border border-glow/40 grid place-items-center overflow-hidden shrink-0"
      :class="boxCls"
    >
      <img v-if="branding.logo" :src="branding.logo" alt="logo" class="size-full object-contain p-0.5" />
      <span v-else class="text-glow font-black">Y</span>
    </span>
    <span class="min-w-0">
      <span class="block font-extrabold tracking-tight truncate" :class="nameCls">
        <template v-if="branding.appName">{{ branding.appName }}</template>
        <template v-else>YASA <span class="text-glow">DRIVE</span></template>
      </span>
      <span
        v-if="subtitle"
        class="block font-mono text-[10px] uppercase tracking-[0.3em] text-ink-400 mt-1"
      >{{ subtitle }}</span>
    </span>
  </span>
</template>
