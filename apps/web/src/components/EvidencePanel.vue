<script setup lang="ts">
/**
 * EvidencePanel — 右栏证据面板（发光热条 + 源信号色）。
 * 两层：① 工具调用卡（命中条数）② 运行完成后展开的真实来源条目（标题/URL/来源色）。
 */
import { ref, watch } from "vue";
import { toolColor, toolLabel, toolArgsPreview, type ToolCallState } from "./types";
import { listRunItems } from "@ai-insight/api-client";
import type { RunItem } from "@ai-insight/shared-types";

const props = defineProps<{
  toolCalls: ToolCallState[];
  runId: string | null;
  runStatus: string;
}>();

const items = ref<RunItem[]>([]);
const loadingItems = ref(false);
let loadedRunId: string | null = null;

// 运行完成（或报告已生成后）时拉取本轮来源条目
watch(
  () => [props.runId, props.runStatus] as const,
  ([id, status]) => {
    if (!id || id === "ux-run") return;
    // 完成态或仍运行但有采集（运行中也能看到已落库的增量）时加载；同一 run 只在完成时全量拉一次
    if (status !== "completed") return;
    if (loadedRunId === id) return;
    loadedRunId = id;
    loadingItems.value = true;
    listRunItems(id)
      .then((r) => (items.value = r.items))
      .catch(() => (items.value = []))
      .finally(() => (loadingItems.value = false));
  },
  { immediate: true },
);

// runId 变化（新 run）时重置
watch(
  () => props.runId,
  (id) => {
    if (loadedRunId !== id) {
      items.value = [];
      loadedRunId = null;
    }
  },
);

const sourceDot = (t: string) =>
  t === "search" ? "var(--src-search)" : t === "rss" ? "var(--src-rss)" : "var(--src-crawl)";
</script>

<template>
  <aside class="evidence">
    <div class="ev-head">
      <div class="ev-title-row">
        <span class="ev-title">信号证据</span>
        <span class="count mono">{{ toolCalls.length }}</span>
      </div>
      <div class="ev-sub mono">EVIDENCE · 工具命中信号</div>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="dot" style="background: var(--src-search); box-shadow: 0 0 6px var(--src-search)"></span>搜索</span>
      <span class="legend-item"><span class="dot" style="background: var(--src-rss); box-shadow: 0 0 6px var(--src-rss)"></span>RSS</span>
      <span class="legend-item"><span class="dot" style="background: var(--src-crawl); box-shadow: 0 0 6px var(--src-crawl)"></span>爬虫</span>
    </div>

    <div class="ev-scroll scroll">
      <!-- 工具调用卡 -->
      <div v-for="c in toolCalls" :key="'ev-' + c.toolCallId" class="ev-card"
        :style="{ '--tc': toolColor(c.toolName).varName }">
        <div class="ev-top">
          <span class="ev-src">
            <span class="dot" :style="{ background: toolColor(c.toolName).fg, boxShadow: '0 0 8px ' + toolColor(c.toolName).fg }"></span>
            {{ toolLabel(c.toolName) }}
          </span>
          <span class="ev-rel mono">{{ toolArgsPreview(c.args) }}</span>
        </div>
        <div class="ev-title2">命中 <b>{{ c.found ?? '…' }}</b> 条信号</div>
        <div class="ev-heat">
          <div class="ev-heat-track">
            <div class="ev-heat-fill heat-bar" :style="{ width: Math.min(100, (c.found ?? 0) * 5) + '%' }"></div>
          </div>
          <span class="ev-heat-n mono">{{ c.found ?? '—' }}</span>
        </div>
      </div>

      <!-- 来源条目明细 -->
      <div v-if="items.length" class="sources">
        <div class="src-label">来源条目 · {{ items.length }}</div>
        <a v-for="it in items" :key="it.id" :href="it.url" target="_blank" rel="noopener" class="src-item">
          <span class="src-dot" :style="{ background: sourceDot(it.sourceType) }"></span>
          <span class="src-body">
            <span class="src-title">{{ it.title }}</span>
            <span class="src-meta mono">{{ it.sourceName }}<span v-if="it.publishedAt"> · {{ it.publishedAt.slice(0, 10) }}</span></span>
            <span v-if="it.summary" class="src-sum">{{ it.summary }}</span>
          </span>
        </a>
      </div>

      <div v-else-if="loadingItems" class="empty" style="height: 120px">
        <div class="empty-glyph spin">◎</div>
        <p>加载来源条目…</p>
      </div>

      <div v-else-if="!toolCalls.length" class="empty" style="height: 200px">
        <div class="empty-glyph">◎</div>
        <p>工具调用的证据将在此展示</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.evidence { background: var(--surface-2); border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
.ev-head { padding: 14px 16px 12px; border-bottom: 1px solid var(--line); background: var(--surface); }
.ev-title-row { display: flex; align-items: center; gap: 8px; }
.ev-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.count { font-size: 10px; color: var(--brand); background: var(--brand-soft); padding: 1px 7px; border-radius: var(--r-pill); border: 1px solid var(--brand-line); }
.ev-sub { font-size: 9.5px; color: var(--ink-3); margin-top: 4px; letter-spacing: 0.1em; }

.legend { display: flex; gap: 14px; padding: 11px 16px 9px; flex-wrap: wrap; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 10px; color: var(--ink-3); }

.ev-scroll { flex: 1; overflow-y: auto; padding: 4px 12px 16px; }
.ev-card {
  background: var(--surface); border: 1px solid var(--line);
  border-left: 2px solid var(--tc, var(--brand));
  border-radius: var(--r-md); padding: 12px; margin-bottom: 8px; transition: var(--t-fast);
}
.ev-card:hover { border-color: var(--tc, var(--brand)); box-shadow: 0 0 16px -6px color-mix(in srgb, var(--tc, var(--brand)) 60%, transparent); }
.ev-top { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
.ev-src { font-family: var(--mono); font-size: 10.5px; color: var(--tc, var(--brand)); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.ev-rel { margin-left: auto; font-size: 10px; color: var(--ink-3); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-title2 { font-size: 12.5px; line-height: 1.45; color: var(--ink); }
.ev-title2 b { font-family: var(--mono); color: var(--tc, var(--brand)); font-size: 14px; }
.ev-heat { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.ev-heat-track { flex: 1; height: 5px; border-radius: var(--r-pill); background: var(--surface-3); overflow: hidden; }
.ev-heat-fill {
  height: 100%; border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--tc, var(--brand)), color-mix(in srgb, var(--tc, var(--brand)) 60%, white));
  box-shadow: 0 0 8px color-mix(in srgb, var(--tc, var(--brand)) 70%, transparent);
}
.ev-heat-n { font-size: 11px; font-weight: 600; min-width: 18px; text-align: right; color: var(--ink); }

/* 来源条目 */
.sources { margin-top: 6px; }
.src-label { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-3); margin: 6px 4px 8px; }
.src-item {
  display: flex; gap: 9px; padding: 9px 10px; margin-bottom: 6px;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
  text-decoration: none; transition: var(--t-fast);
}
.src-item:hover { border-color: var(--brand-line); background: var(--surface-raised); box-shadow: var(--shadow-sm); }
.src-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; margin-top: 6px; box-shadow: 0 0 6px currentColor; }
.src-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.src-title { font-size: 12.5px; line-height: 1.4; color: var(--ink); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.src-meta { font-size: 9.5px; color: var(--ink-3); }
.src-sum { font-size: 11px; line-height: 1.45; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-top: 2px; }

.empty-glyph { font-family: var(--mono); font-size: 36px; color: var(--ink-4); opacity: 0.5; margin-bottom: 8px; }
.empty-glyph.spin { animation: spin 1.4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
