<script setup lang="ts">
/**
 * 热度条 —— 10 格像素条，按 heat/10 填充朱红。
 * 见 doc/design-doc/15-UIUX设计.md §15.1.3（热度条）。
 * 两端复用（用户端精选卡 / 管理端 Article 热度）。
 */
defineProps<{
  /** 0-100 */
  heat: number;
  /** 可选：填充色（默认朱红）；管理端可传领域色 */
  color?: string;
}>();
</script>

<template>
  <span
    class="heat-bar"
    :style="color ? { ['--vermillion' as string]: color } : undefined"
    role="meter"
    :aria-valuenow="heat"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`热度 ${heat}`"
  >
    <span
      v-for="i in 10"
      :key="i"
      class="heat-bar__cell"
      :class="{ 'heat-bar__cell--on': i <= Math.round(heat / 10) }"
    />
  </span>
</template>
