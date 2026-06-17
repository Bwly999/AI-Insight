<script setup lang="ts">
/**
 * 印章标签 —— 朱红描边、旋转、等宽字。
 * 见 doc/design-doc/15-UIUX设计.md §15.1.3（印章效果）。
 * 用途：头版 TOP STORY / 管理端状态标签（已发送/失败）。
 */
withDefaults(
  defineProps<{
    label: string;
    /** 颜色：默认朱红；管理端状态可用 forest/mustard/cobalt */
    color?: string;
    rotate?: number;
  }>(),
  { color: 'var(--vermillion)', rotate: -6 },
);
</script>

<template>
  <span
    class="stamp"
    :style="{
      borderColor: color,
      color,
      transform: `rotate(${rotate}deg)`,
    }"
  >
    {{ label }}
  </span>
</template>
