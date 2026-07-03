<script setup lang="ts">
/**
 * EvidencePanel — 右栏数据源面板（Workbench 风格）。
 * 仅收录数据源条目（带序号 ①②③，对应正文 cite 标记）；工具调用记录已移至正文 RunStream。
 */
import { ref, watch } from "vue";
import { ArrowUpRight, Loader, Inbox } from "@lucide/vue";
import type { ToolCallState } from "./types";
import { listRunItems } from "@ai-insight/api-client";
import type { RunItem } from "@ai-insight/shared-types";

const props = defineProps<{
  /** 兼容旧调用（已不再使用工具卡，仅保留签名避免破坏父组件传参） */
  toolCalls?: ToolCallState[];
  runId: string | null;
  runStatus: string;
}>();

const items = ref<RunItem[]>([]);
const loadingItems = ref(false);
let loadedRunId: string | null = null;

// 运行完成时拉取本轮来源条目
watch(
  () => [props.runId, props.runStatus] as const,
  ([id, status]) => {
    if (!id || id === "ux-run") return;
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

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
</script>

<template>
  <aside class="col-right">
    <div class="r-head">
      <div class="r-eb">数据源</div>
      <div class="r-title">引用来源</div>
      <div class="r-count">{{ items.length }} 条 · 来自 3 类来源</div>
    </div>
    <div class="r-note">本栏仅收录<b>数据源条目</b>。工具调用记录见正文。</div>

    <div class="r-list scroll">
      <template v-if="items.length">
        <div v-for="it in items" :key="it.id" class="source">
          <div class="s-src"><span class="dot" :style="{ background: sourceDot(it.sourceType) }"></span>{{ it.sourceType.toUpperCase() }} · {{ it.sourceName }}</div>
          <!-- 拉伸链接：标题为锚点，::after 覆盖整张卡，点击任意位置在新标签页打开原网页 -->
          <a class="s-title" :href="it.url" target="_blank" rel="noopener noreferrer">{{ it.title }}</a>
          <div v-if="it.summary" class="s-sum">{{ it.summary }}</div>
          <div class="s-foot">
            <span>{{ it.publishedAt ? it.publishedAt.slice(0, 10) : it.fetchedAt.slice(0, 10) }}</span>
            <span class="s-domain">{{ domainOf(it.url) }} <ArrowUpRight :size="11" :stroke-width="2.2" /></span>
          </div>
        </div>
      </template>

      <div v-else-if="loadingItems" class="empty" style="height: 120px">
        <div class="empty-glyph spin"><Loader :size="36" :stroke-width="1.6" /></div>
        <p>加载来源条目…</p>
      </div>
      <div v-else class="empty" style="height: 200px">
        <div class="empty-glyph"><Inbox :size="36" :stroke-width="1.4" /></div>
        <p>本轮引用的来源将在此展示</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.col-right {
  background: var(--surface); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.r-head { padding: 18px 20px 12px; border-bottom: 1px solid var(--border); }
.r-eb { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 3px; letter-spacing: 0.04em; }
.r-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
.r-count { font-size: 11.5px; color: var(--text-3); margin-top: 4px; }
.r-note {
  margin: 11px 16px 0; padding: 8px 11px;
  font-size: 11.5px; color: var(--text-3); line-height: 1.5;
  background: var(--surface-2); border-radius: 7px; border-left: 2px solid var(--text-4);
}
.r-note b { color: var(--text-2); }
.r-list { flex: 1; overflow-y: auto; padding: 10px 16px 18px; }

.source {
  position: relative;
  background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
  padding: 11px 12px; margin-bottom: 9px; transition: var(--t-fast);
}
.source:hover { border-color: var(--accent); }
.s-src {
  font-size: 10.5px; font-weight: 600; color: var(--text-3);
  display: flex; align-items: center; gap: 6px; letter-spacing: 0.02em;
}
.s-src .dot { box-shadow: none; }
.s-title {
  display: block; font-size: 13.5px; font-weight: 600; margin: 4px 0 3px;
  line-height: 1.35; color: var(--text); text-decoration: none; cursor: pointer;
  /* 拉伸链接：伪元素铺满最近 .source，使整卡可点 */
}
.s-title::after { content: ""; position: absolute; inset: 0; }
.source:hover .s-title { color: var(--accent); }
.s-sum {
  font-size: 12px; color: var(--text-2); line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.s-foot { margin-top: 7px; font-size: 10.5px; color: var(--text-3); display: flex; gap: 12px; }
.s-domain {
  position: relative; z-index: 1; font-weight: 600;
  color: var(--accent); cursor: pointer;
}
.source:hover .s-domain { text-decoration: underline; }

.empty-glyph { display: flex; color: var(--text-4); opacity: 0.5; margin-bottom: 8px; }
.empty-glyph.spin { animation: spin 1.4s linear infinite; }
</style>
