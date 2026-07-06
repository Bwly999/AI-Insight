<script setup lang="ts">
/**
 * CitationGrowth — 引用增长折线图（右栏签名组件）。
 * 近 N 轮的引用数序列 → SVG polyline + gradient fill + 端点 dot（glow + 脉冲）。
 * 单调上升时显示"持续增长 ↗"。
 *
 * 数据来源：父组件传入 points: number[]（历史引用数，老→新）。
 * 真实数据需后端补 run 历史；暂用 items.length 派生或 mock。
 */
import { computed } from "vue";
import { TrendingUp } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    /** 近 N 轮引用数序列（老→新）。空数组则显示占位。 */
    points?: number[];
    /** 当前引用总数（大数字展示）。 */
    total?: number;
    /** 与上一轮的差值（delta chip）。 */
    delta?: number | null;
  }>(),
  { points: () => [], total: 0, delta: null },
);

// SVG viewBox 尺寸（preserveAspectRatio=none 自适应宽度）
const W = 280;
const H = 56;
const PAD_Y = 5;

// 把 points 映射成 polyline 坐标
const coords = computed(() => {
  const pts = props.points.length ? props.points : [0];
  const n = pts.length;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const step = n > 1 ? W / (n - 1) : 0;
  return pts.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / range) * (H - PAD_Y * 2) - PAD_Y;
    return [x, y] as const;
  });
});

const linePoints = computed(() => coords.value.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" "));
const areaPoints = computed(() => {
  const pts = coords.value;
  if (!pts.length) return "";
  return `0,${H} ${pts.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ")} ${W},${H}`;
});
const lastCoord = computed(() => coords.value[coords.value.length - 1]);

const isRising = computed(() => {
  const pts = props.points;
  if (pts.length < 2) return false;
  return pts[pts.length - 1] > pts[0];
});
const showDelta = computed(() => props.delta != null && props.delta > 0);
</script>

<template>
  <div class="r-growth">
    <div class="rg-top">
      <div>
        <div class="rg-label">引用总数</div>
        <div class="rg-num">
          {{ total }}
          <span v-if="showDelta" class="delta">↑ +{{ delta }}</span>
        </div>
      </div>
    </div>

    <svg v-if="points.length" class="rg-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient :id="`growFill-${total}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".25" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon :fill="`url(#growFill-${total})`" :points="areaPoints" />
      <polyline
        fill="none"
        stroke="var(--accent)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :points="linePoints" />
      <!-- 端点 dot：柠绿 + glow（最新值的信号锚点） -->
      <circle
        v-if="lastCoord"
        :cx="lastCoord[0]"
        :cy="lastCoord[1]"
        r="3"
        fill="var(--accent)"
        stroke="var(--bg)"
        stroke-width="1.5"
        style="filter: drop-shadow(0 0 4px var(--accent));" />
    </svg>

    <div class="rg-foot">
      <span>近 {{ points.length || 0 }} 次轮次</span>
      <span v-if="isRising" class="up">
        <TrendingUp :size="11" :stroke-width="2.2" />
        持续增长
      </span>
      <span v-else-if="points.length" class="flat">最新 {{ points[points.length - 1] }}</span>
    </div>
  </div>
</template>

<style scoped>
.r-growth {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.rg-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.rg-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-4);
  letter-spacing: 0.04em;
}
.rg-num {
  font-family: var(--sans);
  font-size: 30px;
  font-weight: 700;
  color: var(--accent-text);
  line-height: 1;
  letter-spacing: -0.02em;
  font-feature-settings: "zero";
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
}
.rg-num .delta {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-text);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
}
.rg-svg {
  width: 100%;
  height: 56px;
  display: block;
}
.rg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
}
.rg-foot .up {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--accent-text);
}
.rg-foot .flat {
  color: var(--text-4);
}
</style>
