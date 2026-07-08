<script setup lang="ts">
/**
 * EvidencePanel — Workbench V2 右栏（情报台四段式）。
 * r-head（数据源标题）+ CitationGrowth（引用增长图）+ CitationGraph（引用关系图谱）+ r-list（来源列表）。
 *
 * V2 变化：从单段来源列表升级为四段式，新增两个签名可视化组件。
 * 数据流：items（RunItem[]）从后端拉取；增长图暂用单调上升 mock（真实需 run 历史）；
 * 关系图从 items 派生节点（每个来源一个 + 中心结论）。
 *
 * 来源数据双通道：
 *  - 实时：runId 对应的 run 完成后，拉取该 run 的来源条目（本轮来源）。
 *  - 历史：打开历史对话时没有活跃 run，此时由 reportRunIds（该对话历史报告的 runId 集合）
 *    驱动——并行拉取所有历史 run 的来源条目，去重合并后展示，效果与实时一致。
 */
import { computed, ref, watch } from "vue";
import { ArrowUpRight, Loader, Inbox } from "@lucide/vue";
import { listRunItems } from "@ai-insight/api-client";
import type { RunItem } from "@ai-insight/shared-types";
import CitationGrowth from "./CitationGrowth.vue";
import CitationGraph from "./CitationGraph.vue";

const props = defineProps<{
  /** 当前活跃 run 的 id（实时通道）。 */
  runId: string | null;
  /** 当前活跃 run 的状态（实时通道）。 */
  runStatus: string;
  /** 历史报告对应的 runId 集合（历史通道）：打开历史对话时由父组件从 reports[].runId 派生。 */
  reportRunIds?: string[];
}>();

const items = ref<RunItem[]>([]);
const loadingItems = ref(false);
/** 已加载过的 runId 集合——去重，避免对同一 run 重复请求；切换会话时重置。 */
let loadedRunIds = new Set<string>();
/** 上次见过的历史 runId 集合——用于检测会话切换（集合缩水即换对话，需全量重置）。 */
let lastSeenRunIds = new Set<string>();

/**
 * 拉取单个 run 的来源条目（已登记进 loadedRunIds）。
 */
async function fetchRunItems(runId: string): Promise<RunItem[]> {
  loadedRunIds.add(runId);
  const r = await listRunItems(runId);
  return r.items;
}

/** 按 RunItem.id 去重合并多个 run 的来源条目（同一来源被多轮引用只展示一次）。 */
function mergeItems(groups: RunItem[][]): RunItem[] {
  const seen = new Set<string>();
  const merged: RunItem[] = [];
  for (const group of groups) {
    for (const it of group) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
    }
  }
  return merged;
}

// 实时通道：run 完成后拉取本轮来源（与历史通道共存时，本轮结果会并入既有历史来源）
watch(
  () => [props.runId, props.runStatus] as const,
  async ([id, status]) => {
    if (!id || id === "ux-run") return;
    if (status !== "completed") return;
    if (loadedRunIds.has(id)) return;
    loadingItems.value = true;
    try {
      const fresh = await fetchRunItems(id);
      // 并入：保留既有历史来源，追加本轮新条目（按 id 去重）
      items.value = mergeItems([items.value, fresh]);
    } catch {
      // 单 run 失败不清空既有来源
    } finally {
      loadingItems.value = false;
    }
  },
  { immediate: true },
);

// 历史通道：打开历史对话（无活跃 run）时，按历史报告的 runId 聚合拉取全部来源；
// 兼会话切换检测——当 reportRunIds 集合缩水（之前见过的 runId 消失）即判定换了对话，
// 清空缓存与列表后以新对话来源为准重建。
watch(
  () => props.reportRunIds,
  async (ids) => {
    // 有活跃的实时 run 时让实时通道主导，避免覆盖
    if (props.runId && props.runStatus !== "idle") return;
    const currentSet = new Set((ids ?? []).filter((id) => id && id !== "ux-run"));
    // 切换检测：旧集合里有、新集合里没有的 runId → 说明切到了别的会话
    let switched = false;
    for (const id of lastSeenRunIds) {
      if (!currentSet.has(id)) { switched = true; break; }
    }
    if (switched) {
      items.value = [];
      loadedRunIds = new Set();
    }
    lastSeenRunIds = currentSet;
    const want = [...currentSet].filter((id) => !loadedRunIds.has(id));
    if (want.length === 0) return;
    loadingItems.value = true;
    try {
      const groups = await Promise.all(want.map(fetchRunItems));
      // 历史回放：以历史来源为准重建列表（合并去重）
      items.value = mergeItems(switched ? groups : [items.value, ...groups]);
    } catch {
      items.value = [];
    } finally {
      loadingItems.value = false;
    }
  },
  { immediate: true },
);

const sourceDot = (t: string) =>
  t === "search" ? "var(--src-search)" : t === "rss" ? "var(--src-rss)" : "var(--src-crawl)";

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// 增长图数据：暂用当前 items 长度派生一个单调上升序列（mock，真实需 run 历史）。
// 取近 7 轮：从 max(1, n-6) 单调上升到 n。
const growthPoints = computed(() => {
  const n = items.value.length;
  if (!n) return [];
  const start = Math.max(1, n - 6);
  const pts: number[] = [];
  for (let i = start; i <= n; i++) pts.push(i);
  return pts;
});
const growthDelta = computed(() => (growthPoints.value.length >= 2 ? growthPoints.value[growthPoints.value.length - 1] - growthPoints.value[0] : null));

// 关系图来源：最多 6 个（CitationGraph 内部会截断）
const graphSources = computed(() => items.value.slice(0, 6));

// 来源类型计数（header 显示）
const sourceTypeCount = computed(() => new Set(items.value.map((i) => i.sourceType)).size);
</script>

<template>
  <aside class="col-right scroll">
    <!-- ─── 头部 ─── -->
    <div class="r-head">
      <div class="r-top">
        <div class="r-eb">数据源</div>
        <div class="r-count">{{ items.length }} 条 · {{ sourceTypeCount || 3 }} 类来源</div>
      </div>
      <div class="r-title">引用来源</div>
    </div>

    <!-- ─── 引用增长图 ─── -->
    <CitationGrowth
      :points="growthPoints"
      :total="items.length"
      :delta="growthDelta" />

    <!-- ─── 引用关系图谱 ─── -->
    <CitationGraph :sources="graphSources" />

    <!-- ─── 来源列表 ─── -->
    <!-- 列表区独立滚动：头部 + 两图常驻，证据卡片在此区内滚动。
         min-height:0 是 flexbox 滚动必须项，否则 flex 子项默认 min-height:auto
         会把内容撑高、overflow 被父级 overflow:hidden 裁掉，导致滚不动。 -->
    <div class="r-list scroll">
      <template v-if="items.length">
        <div v-for="(it, i) in items" :key="it.id" class="source">
          <div class="s-top">
            <span class="s-idx">{{ i + 1 }}</span>
            <span class="s-src">
              <span class="dot" :style="{ background: sourceDot(it.sourceType) }"></span>
              {{ it.sourceType.toUpperCase() }} · {{ it.sourceName }}
            </span>
          </div>
          <!-- 拉伸链接：标题为锚点，::after 覆盖整张卡 -->
          <a class="s-title" :href="it.url" target="_blank" rel="noopener noreferrer">{{ it.title }}</a>
          <div v-if="it.summary" class="s-sum">{{ it.summary }}</div>
          <div class="s-foot">
            <span class="s-date">{{ it.publishedAt ? it.publishedAt.slice(0, 10) : it.fetchedAt.slice(0, 10) }}</span>
            <span class="s-domain">{{ domainOf(it.url) }} <ArrowUpRight :size="11" :stroke-width="2.2" /></span>
          </div>
        </div>
      </template>

      <div v-else-if="loadingItems" class="empty-mini">
        <div class="empty-glyph spin"><Loader :size="28" :stroke-width="1.6" /></div>
        <p>加载来源条目…</p>
      </div>
      <div v-else class="empty-mini">
        <div class="empty-glyph"><Inbox :size="28" :stroke-width="1.4" /></div>
        <p>本轮引用的来源将在此展示</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.col-right {
  background: color-mix(in srgb, var(--bg) 50%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── 头部 ─── */
.r-head {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
  flex: none;
}
/* eyebrow 与计数同一行左右分布，收紧头部高度 */
.r-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 2px;
}
.r-eb {
  font-family: var(--mono);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-4);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.r-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.012em;
  line-height: 1.2;
  color: var(--text);
}
.r-count {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

/* ─── 来源列表 ─── */
.r-list {
  flex: 1;
  /* flexbox 滚动两件套：min-height:0 让 flex 子项可收缩、不被内容撑高；
     overflow-y:auto 让卡片溢出时滚动。父级 .col-right overflow:hidden 负责裁切，
     这里负责滚动——卡片再多也能滚动看到，不再被裁断。 */
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 20px;
}

/* 来源卡：序号 + 元信息顶条 + 标题 + 摘要 + 域名行 */
.source {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 13px;
  margin-bottom: 10px;
  transition: var(--t-fast);
}
.source:hover {
  border-color: var(--accent-line);
  box-shadow: var(--shadow-sm);
}
.source:focus-within {
  border-color: var(--accent);
}

.s-top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 6px;
}
/* 序号：与正文 [n] 引用同构——柠绿信号 */
.s-idx {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--accent-text);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  width: 20px;
  height: 20px;
  border-radius: var(--r-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  letter-spacing: 0;
}
.s-src {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.06em;
}
.s-src .dot {
  box-shadow: none;
}

.s-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 4px;
  line-height: 1.4;
  color: var(--text);
  text-decoration: none;
  cursor: pointer;
  /* 拉伸链接：伪元素铺满最近 .source */
}
.s-title::after {
  content: "";
  position: absolute;
  inset: 0;
}
.source:hover .s-title {
  color: var(--accent-text);
}
.s-sum {
  font-size: 11.5px;
  color: var(--text-2);
  line-height: 1.5;
  margin-bottom: 7px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.s-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
  letter-spacing: 0.02em;
}
.s-date {
  font-weight: 500;
}
.s-domain {
  position: relative;
  z-index: 1;
  font-weight: 600;
  color: var(--accent-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.source:hover .s-domain {
  color: var(--accent);
  text-decoration: underline;
}

/* ─── 空/加载态 ─── */
.empty-mini {
  padding: 28px 16px;
  text-align: center;
  color: var(--text-3);
}
.empty-glyph {
  display: flex;
  justify-content: center;
  color: var(--text-4);
  margin-bottom: 8px;
}
.empty-glyph.spin {
  animation: spin 1.4s linear infinite;
}
.empty-mini p {
  font-size: 12px;
  margin: 0;
}
</style>
