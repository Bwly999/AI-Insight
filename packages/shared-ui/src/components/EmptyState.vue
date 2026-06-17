<script setup lang="ts">
/**
 * 空状态 —— 斜体衬线大字 + 等宽小字提示。
 * 见 doc/design-doc/15-UIUX设计.md §15.1.4（空状态）。
 */
defineProps<{
  title?: string;
  hint?: string;
}>();
</script>

<template>
  <div class="py-12 text-center">
    <p
      class="font-serif italic text-2xl text-ink-2"
      style="font-family: var(--font-serif)"
    >
      {{ title ?? '— 本期暂无更多内容 —' }}
    </p>
    <p
      v-if="hint"
      class="mt-2 text-xs text-ink-3"
      style="font-family: var(--font-mono)"
    >
      {{ hint }}
    </p>
  </div>
</template>
