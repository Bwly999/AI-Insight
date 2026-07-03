<script setup lang="ts">
/**
 * AgentMark — AI-Insight agent 头像 mark（区别于用户）。
 *
 * 语义：三焦点汇聚——「多源信号 → 一个洞察」。三个节点 + 一条汇聚线。
 * 扁平几何，跟随 currentColor，与品牌 BrandMark 同语系（仪器/对焦）。
 *
 * unslop-ignore: agent 身份 mark 是翠绿作为“信号/身份”的合法应用。
 */
withDefaults(defineProps<{ size?: number }>(), { size: 16 });
</script>

<template>
  <svg
    class="agent-mark"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true">
    <!-- 三个源节点（上 / 左下 / 右下） -->
    <circle cx="12" cy="5" r="2" fill="currentColor" />
    <circle cx="5.5" cy="17.5" r="2" fill="currentColor" />
    <circle cx="18.5" cy="17.5" r="2" fill="currentColor" />
    <!-- 汇聚线（源 → 中心） -->
    <path
      d="M12 7 L12 12 M7 16 L10.5 13 M17 16 L13.5 13"
      stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <!-- 中心洞察点 -->
    <circle cx="12" cy="13.5" r="2.4" stroke="currentColor" stroke-width="1.4" fill="none" />
    <circle cx="12" cy="13.5" r="0.9" fill="currentColor" />
  </svg>
</template>

<style scoped>
.agent-mark { display: block; flex: none; }
</style>
