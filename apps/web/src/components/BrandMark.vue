<script setup lang="ts">
/**
 * BrandMark — AI-Insight 品牌几何 mark。
 *
 * 语义：「对焦镜头」——研究员工作台的核心隐喻。
 * 外环 = 镜筒；内嵌一个由对角线刻度构成的「A」（AI 的 A，也是 aperture 光圈）。
 * 纯几何，无字母方块、无 emoji；扁平，跟随 currentColor。
 *
 * unslop-ignore: 品牌签名 mark 是翠绿稀缺强调最合理的位置。
 */
withDefaults(defineProps<{ size?: number }>(), { size: 18 });
</script>

<template>
  <svg
    class="brand-mark"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true">
    <!-- 镜筒外环 -->
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.4" />
    <!-- 光圈刻度（4 个方位短线，仪器感） -->
    <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <path d="M12 1.5v2.2" />
      <path d="M12 20.3v2.2" />
      <path d="M1.5 12h2.2" />
      <path d="M20.3 12h2.2" />
    </g>
    <!-- 内嵌 A / 光圈叶片：由中心向上发散的三条对角线 -->
    <path
      d="M12 6.5 L16.5 17.2 M12 6.5 L7.5 17.2 M9.2 14h5.6"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none" />
  </svg>
</template>

<style scoped>
.brand-mark {
  display: block;
  flex: none;
  /* 微妙的内部高光，强化「精加工金属件」质感，非发光装饰 */
  filter: drop-shadow(0 0.5px 0 rgba(255, 255, 255, 0.18));
}
</style>
