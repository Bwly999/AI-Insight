<script setup lang="ts">
/**
 * CitationGraph — 引用关系图谱（右栏签名组件）。
 * 中心结论节点（柠绿菱形 + glow + 呼吸脉冲）+ 环形来源节点（编号 + 柠绿描边）。
 * 边按关系类型上色：采纳（柠绿实线 + 流动粒子）/ 相交（蓝虚线）/ 对立（红波浪线）。
 *
 * 数据从 sources 派生：每个 RunItem 一个节点 + 一个中心结论节点。
 * 关系暂用启发式推导：
 *   - 所有来源 → 结论：采纳（adopt）
 *   - 同 sourceType 的来源两两：相交（cross）
 *   - 不同 sourceType 但 title 含对立关键词：对立（oppose）—— 简化，可后端补真实关系
 */
import { computed } from "vue";
import type { RunItem } from "@ai-insight/shared-types";

const props = withDefaults(
  defineProps<{
    sources: RunItem[];
    /** 结论节点标签（中心节点）；默认 "结论"。 */
    conclusionLabel?: string;
  }>(),
  { conclusionLabel: "结论" },
);

const W = 280;
const H = 140;
const CX = W / 2;
const CY = H / 2;
const CONCLUSION_R = 9;

interface GNode {
  id: number;
  x: number;
  y: number;
  r: number;
  label: string;
  conclusion?: boolean;
}
interface GEdge {
  a: number;
  b: number;
  type: "adopt" | "cross" | "oppose";
}

// 环形布局来源节点（最多取 6 个，避免过密）
const MAX_NODES = 6;
const nodes = computed<GNode[]>(() => {
  const srcs = props.sources.slice(0, MAX_NODES);
  const n = srcs.length;
  if (!n) return [{ id: 0, x: CX, y: CY, r: CONCLUSION_R, label: "★", conclusion: true }];
  // 环形半径根据数量调整
  const radius = n <= 3 ? 38 : n <= 5 ? 48 : 52;
  const list: GNode[] = [{ id: 0, x: CX, y: CY, r: CONCLUSION_R, label: "★", conclusion: true }];
  srcs.forEach((s, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2; // 从正上方开始
    list.push({
      id: i + 1,
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius,
      r: 11,
      label: String(i + 1),
    });
  });
  return list;
});

const edges = computed<GEdge[]>(() => {
  const srcs = props.sources.slice(0, MAX_NODES);
  const list: GEdge[] = [];
  // 采纳：所有来源 → 结论
  srcs.forEach((_, i) => list.push({ a: i + 1, b: 0, type: "adopt" }));
  // 相交：同 sourceType 的相邻来源
  for (let i = 0; i < srcs.length - 1; i++) {
    if (srcs[i].sourceType === srcs[i + 1].sourceType) {
      list.push({ a: i + 1, b: i + 2, type: "cross" });
    }
  }
  // 对立：暂无可靠启发式，留空（后端补真实关系后填充）
  return list;
});

const colorOf = { adopt: "var(--accent)", cross: "var(--src-search)", oppose: "var(--rose)" };
const dashOf = { adopt: "", cross: "4 3", oppose: "5 3" };
const widthOf = { adopt: 1.8, cross: 1.4, oppose: 1.6 };

function nodeById(id: number): GNode | undefined {
  return nodes.value.find((n) => n.id === id);
}

// 对立边的波浪 path（二次贝塞尔偏移中点）
function opposePath(a: GNode, b: GNode): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 14;
  const oy = (dx / len) * 14;
  return `M${a.x},${a.y} Q${mx + ox},${my + oy} ${b.x},${b.y}`;
}

const relationCount = computed(() => edges.value.length);
</script>

<template>
  <div class="r-relations">
    <div class="rr-head">
      <span class="rr-label">引用关系图谱</span>
      <span class="rr-count">{{ sources.length }} 节点 · {{ relationCount }} 关系</span>
    </div>

    <svg class="rr-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- 先画边（在节点下层） -->
      <g v-for="(e, idx) in edges" :key="`e-${idx}`">
        <template v-if="nodeById(e.a) && nodeById(e.b)">
          <!-- 对立边用波浪 path -->
          <path
            v-if="e.type === 'oppose'"
            :d="opposePath(nodeById(e.a)!, nodeById(e.b)!)"
            fill="none"
            :stroke="colorOf[e.type]"
            :stroke-width="widthOf[e.type]"
            :stroke-dasharray="dashOf[e.type]"
            opacity=".75" />
          <!-- 其他边用直线 -->
          <line
            v-else
            :x1="nodeById(e.a)!.x"
            :y1="nodeById(e.a)!.y"
            :x2="nodeById(e.b)!.x"
            :y2="nodeById(e.b)!.y"
            :stroke="colorOf[e.type]"
            :stroke-width="widthOf[e.type]"
            :stroke-dasharray="dashOf[e.type] || undefined"
            opacity=".7" />
          <!-- 采纳边上的流动粒子（animateMotion；reduced-motion 由全局 CSS 降级） -->
          <circle v-if="e.type === 'adopt'" :r="1.8" :fill="colorOf[e.type]" opacity=".9">
            <animateMotion
              :dur="`${2 + (idx % 3) * 0.5}s`"
              repeatCount="indefinite"
              :path="`M${nodeById(e.a)!.x},${nodeById(e.a)!.y} L${nodeById(e.b)!.x},${nodeById(e.b)!.y}`" />
            <animate
              attributeName="opacity"
              values="0;1;0"
              :dur="`${2 + (idx % 3) * 0.5}s`"
              repeatCount="indefinite" />
          </circle>
        </template>
      </g>

      <!-- 再画节点 -->
      <g v-for="n in nodes" :key="`n-${n.id}`">
        <template v-if="n.conclusion">
          <!-- 结论节点：柠绿光晕圈 + 实心圆（呼吸脉冲）+ 星标 -->
          <circle :cx="n.x" :cy="n.y" :r="n.r + 5" fill="var(--accent-soft)" />
          <circle :cx="n.x" :cy="n.y" :r="n.r" fill="var(--accent)" style="filter: drop-shadow(0 0 6px var(--accent));">
            <animate attributeName="r" :values="`${n.r};${n.r + 2};${n.r}`" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <text
            :x="n.x"
            :y="n.y + 3"
            text-anchor="middle"
            font-family="JetBrains Mono, monospace"
            font-size="9"
            font-weight="700"
            fill="var(--on-accent)">★</text>
        </template>
        <template v-else>
          <!-- 来源节点：柠绿描边圆 + 编号 -->
          <circle :cx="n.x" :cy="n.y" :r="n.r" fill="var(--surface)" stroke="var(--accent-line)" stroke-width="1.5" />
          <text
            :x="n.x"
            :y="n.y + 4"
            text-anchor="middle"
            font-family="JetBrains Mono, monospace"
            font-size="11"
            font-weight="700"
            fill="var(--accent-text)">{{ n.label }}</text>
        </template>
      </g>
    </svg>

    <div class="rr-legend">
      <span class="rr-lg"><i :style="{ background: colorOf.adopt }"></i>采纳（支持结论）</span>
      <span class="rr-lg"><i :style="{ background: colorOf.cross }"></i>相交（相关互补）</span>
      <span class="rr-lg"><i :style="{ background: colorOf.oppose }"></i>对立（矛盾）</span>
    </div>
  </div>
</template>

<style scoped>
.r-relations {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.rr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.rr-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-4);
  letter-spacing: 0.04em;
}
.rr-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--accent-text);
}
.rr-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.rr-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.rr-lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-2);
}
.rr-lg i {
  display: inline-block;
  width: 14px;
  height: 2px;
  border-radius: 1px;
}
</style>
