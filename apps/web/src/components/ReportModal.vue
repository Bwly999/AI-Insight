<script setup lang="ts">
/**
 * ReportModal — 报告弹窗（替代 ReportView 全屏页）。
 * 遮罩模糊 + 880px 卡片；标题并入 editorial paper 作为 report-masthead 报头
 * （与下载 HTML 同款单一来源版式，固定浅色）；右上角浮动下载 / 关闭按钮。
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Download, X } from "@lucide/vue";
import type { Report, ReportSummary, Citation } from "@ai-insight/shared-types";
import { editorialColors, stripReportHeader } from "@ai-insight/shared-ui";
import { getReport } from "@ai-insight/api-client";
import { mdToHtml, mdInline } from "../utils/markdown";
import { downloadReportHtml } from "../utils/download";

const props = defineProps<{ report: Report | ReportSummary | null }>();
const emit = defineEmits<{ close: [] }>();

// editorial 色板（@ai-insight/shared-ui 单一来源）——局部持有以便 CSS v-bind 稳定捕获。
const colors = editorialColors;

// 完整报告（含 citations）：SSE/list 传入的 report 无 citations，按需从 API 取
const fullReport = ref<Report | null>(null);
watch(
  () => props.report?.id,
  async (id) => {
    fullReport.value = null;
    if (!id) return;
    try {
      fullReport.value = await getReport(id);
    } catch {
      /* 降级：用 props.report（无 citations，[n] 回退为纯 ①） */
    }
  },
  { immediate: true },
);

// 优先用 fullReport（有 citations），否则回退 props.report
const eff = computed(() => fullReport.value ?? props.report);

const open = computed(() => !!props.report);
const bodyHtml = computed(() =>
  eff.value ? mdToHtml(stripReportHeader(eff.value.markdown, eff.value.title, eff.value.standfirst), eff.value.citations) : "",
);
const titleHtml = computed(() => (eff.value ? mdInline(eff.value.title) : ""));
const standfirstHtml = computed(() => (eff.value?.standfirst ? mdInline(eff.value.standfirst) : ""));

// 🔗 引用弹窗：点击 .cite-link 读 data-cites，从 report.citations 查对应条目展示摘要
const citePopup = ref<Citation[] | null>(null);
function onBodyClick(e: MouseEvent) {
  const link = (e.target as HTMLElement).closest(".cite-link") as HTMLElement | null;
  if (!link) return;
  e.preventDefault();
  const nums = (link.getAttribute("data-cites") ?? "").split(",").map(Number).filter(Boolean);
  const all = eff.value?.citations ?? [];
  citePopup.value = nums.map((n) => all.find((c) => c.citeNo === n)).filter(Boolean) as Citation[];
}

/** 下载文件名：报告标题 + ".html"（净化文件名非法字符）。 */
const downloadName = computed(() => {
  const t = eff.value?.title ?? "report";
  return `${t.replace(/[\\/:*?"<>|]/g, "").trim() || "report"}.html`;
});

/** 下载：经鉴权 fetch 取 on-demand 渲染的 standalone HTML 落盘（与卡片下载共用 helper）。 */
async function onDownload() {
  if (!eff.value) return;
  await downloadReportHtml(eff.value.id, downloadName.value);
}

/** 报头发布日期（YYYY-MM-DD），与下载 HTML 的 pub-date 一致。 */
const pubDate = computed(() => (eff.value?.createdAt ?? new Date().toISOString()).slice(0, 10));

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) emit("close");
}
watch(open, (v) => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = v ? "hidden" : "";
  }
});
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => {
  document.removeEventListener("keydown", onKey);
  if (typeof document !== "undefined") document.body.style.overflow = "";
});
</script>

<template>
  <div v-if="report" class="modal-veil open" @click.self="emit('close')">
    <div class="modal">
      <!-- 右上浮动操作（下载 / 关闭）：脱离 editorial 排版，悬浮于 paper 之上 -->
      <div class="head-actions">
        <button
          class="icon-btn"
          type="button"
          title="下载 HTML"
          aria-label="下载 HTML"
          @click="onDownload">
          <Download :size="16" :stroke-width="2" />
        </button>
        <button class="icon-btn" title="关闭" aria-label="关闭" @click="emit('close')"><X :size="16" :stroke-width="2" /></button>
      </div>

      <div class="modal-body scroll">
        <article class="editorial-paper">
          <!-- 报头（与下载 HTML 的 report-masthead 同款单一来源版式） -->
          <header class="report-masthead">
            <div class="masthead-meta">
              <span class="kicker">AI-Insight · 洞察报告</span>
              <span class="pub-date">{{ pubDate }}</span>
            </div>
            <div class="double-rule masthead-rule"></div>
            <!-- eslint-disable-next-line vue/no-v-html -- mdInline 先 esc() 再应用 inline 规则，安全 -->
            <h1 class="report-title" v-html="titleHtml"></h1>
          </header>
          <!-- eslint-disable-next-line vue/no-v-html -- mdInline 先 esc() 再应用 inline 规则，安全 -->
          <p v-if="standfirstHtml" class="editorial-standfirst drop-cap" v-html="standfirstHtml"></p>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="editorial-body" v-html="bodyHtml" @click="onBodyClick"></div>
        </article>
      </div>
    </div>

    <!-- 🔗 引用摘要弹窗 -->
    <div v-if="citePopup" class="cite-overlay" @click.self="citePopup = null">
      <div class="cite-modal">
        <button class="cite-modal-close" @click="citePopup = null">×</button>
        <div v-for="c in citePopup" :key="c.citeNo" class="cite-modal-item">
          <a :href="c.url" target="_blank" rel="noopener noreferrer" class="cite-modal-title">{{ c.title }}</a>
          <p v-if="c.summary" class="cite-modal-summary">{{ c.summary }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-veil {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 28px;
}
.modal {
  position: relative; /* 锚定右上角浮动操作层 */
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  width: min(880px, 100%); max-height: 88vh; overflow: hidden;
  box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
}
/* 右上角浮动操作（下载 / 关闭）：脱离 editorial 排版，悬浮于 paper 之上 */
.head-actions {
  position: absolute; top: 12px; right: 14px; z-index: 5;
  display: flex; align-items: center; gap: 6px;
}
.head-actions .icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(26, 22, 18, 0.15); background: rgba(244, 239, 230, 0.85);
  color: var(--ink-2); text-decoration: none; transition: var(--t-fast);
  font-size: 14px; line-height: 1; backdrop-filter: blur(4px);
}
.head-actions .icon-btn:hover {
  border-color: var(--vermillion); color: var(--vermillion);
  background: var(--paper);
}

.modal-body { flex: 1; overflow-y: auto; padding: 0; background: var(--surface-2); }

/* —— editorial 正文区（固定浅色，与下载 HTML 一致）—— */
.editorial-paper {
  /* 色板取自 @ai-insight/shared-ui 单一来源，确保与下载 HTML 同色 */
  --paper: v-bind('colors.paper');
  --paper-2: v-bind('colors.paper2');
  --ink: v-bind('colors.ink');
  --ink-2: v-bind('colors.ink2');
  --ink-3: v-bind('colors.ink3');
  --rule: v-bind('colors.rule');
  --vermillion: v-bind('colors.vermillion');
  --mustard: v-bind('colors.mustard');
  --forest: v-bind('colors.forest');
  --cobalt: v-bind('colors.cobalt');
  --rose: v-bind('colors.rose');

  background: var(--paper);
  color: var(--ink);
  margin: 0;
  padding: 40px 48px 56px;
  font-family: "Inter Tight", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.7;
  border-radius: 0;
}

/* —— 报头 report-masthead（与下载 HTML 同款单一来源版式，editorial-ssr.ts 对齐）—— */
.report-masthead {
  border-bottom: 3px solid var(--rule); /* double-rule 由 .double-rule 提供 */
  padding-bottom: 20px; margin-bottom: 28px;
}
.masthead-meta {
  display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap;
}
.kicker {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  text-transform: uppercase; letter-spacing: 0.16em;
  font-size: 11px; color: var(--vermillion); font-weight: 600;
}
.pub-date {
  margin-left: auto; font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px; color: var(--ink-3);
}
.double-rule { border-top: 3px double var(--rule); }
.masthead-rule { margin-bottom: 6px; }
.report-title {
  font-family: "Fraunces", Georgia, serif; font-weight: 900;
  font-size: 36px; line-height: 1.08; letter-spacing: -0.015em;
  color: var(--ink); margin: 6px 0 0;
}
.editorial-standfirst {
  font-family: "Fraunces", Georgia, serif;
  font-size: 18px;
  font-style: italic;
  color: var(--ink-2);
  margin: 0 0 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(26, 22, 18, 0.12);
}
</style>

<style>
/* 非 scoped：editorial-body 内为 v-html 注入内容，需全局规则覆盖。
   样式与 packages/shared-ui tokens.ts 的 editorialComponentCss 同款（单一来源的等价副本）。 */
.editorial-paper .editorial-body h1,
.editorial-paper .editorial-body h2,
.editorial-paper .editorial-body h3 {
  font-family: "Fraunces", Georgia, serif;
  color: var(--ink);
}
.editorial-paper .editorial-body h1 {
  font-size: 30px; line-height: 1.1; margin: 0 0 12px; letter-spacing: -0.01em;
}
.editorial-paper .editorial-body h2 {
  font-size: 22px; margin: 28px 0 10px; padding-bottom: 6px;
  border-bottom: 1px solid rgba(26, 22, 18, 0.15);
}
.editorial-paper .editorial-body h3 { font-size: 17px; margin: 22px 0 8px; }
.editorial-paper .editorial-body p { margin: 10px 0; line-height: 1.7; }
.editorial-paper .editorial-body ul,
.editorial-paper .editorial-body ol { padding-left: 22px; margin: 10px 0; }
.editorial-paper .editorial-body li { margin: 5px 0; }
.editorial-paper .editorial-body a { color: var(--vermillion); }
.editorial-paper .editorial-body hr {
  border: none; border-top: 1px solid rgba(26, 22, 18, 0.2);
  margin: 24px 0;
}
.editorial-paper .editorial-body blockquote {
  margin: 16px 0; padding: 8px 16px; border-left: 3px solid var(--vermillion);
  background: rgba(200, 52, 26, 0.06); color: var(--ink-2); border-radius: 0 6px 6px 0;
}
.editorial-paper .editorial-body code {
  background: rgba(26, 22, 18, 0.08); padding: 1px 5px; border-radius: 4px;
  font-family: "JetBrains Mono", monospace; font-size: 0.92em;
}
.editorial-paper .editorial-body pre {
  background: var(--ink); color: #e6eaf0; padding: 16px; border-radius: 8px; overflow-x: auto;
}
.editorial-paper .editorial-body pre code { background: none; color: inherit; padding: 0; }
.editorial-paper .editorial-body table {
  border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 0.95em;
}
.editorial-paper .editorial-body th,
.editorial-paper .editorial-body td {
  border: 1px solid rgba(26, 22, 18, 0.18); padding: 6px 10px; text-align: left;
}
.editorial-paper .editorial-body th { background: rgba(26, 22, 18, 0.05); font-weight: 600; }
.editorial-paper .editorial-body .cite {
  color: var(--vermillion); font-weight: 600; cursor: pointer; font-size: 0.8em;
}
.editorial-paper .editorial-body .cite-num { color: var(--vermillion); text-decoration: none; cursor: pointer; }
.editorial-paper .editorial-body .cite-num sup { font-weight: 600; font-size: 0.8em; }
.editorial-paper .editorial-body .cite-num:hover sup { text-decoration: underline; }
.editorial-paper .editorial-body .cite-link { color: var(--vermillion); font-weight: 600; cursor: pointer; font-size: 0.8em; }
.editorial-paper .editorial-body .cite-link:hover { text-decoration: underline; }
.editorial-paper .editorial-body .cite-missing { color: var(--ink-3); font-weight: 400; font-size: 0.75em; font-family: var(--mono); }

/* 🔗 引用摘要弹窗 */
.cite-overlay {
  position: fixed; inset: 0; background: rgba(26, 22, 18, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 210;
}
.cite-modal {
  background: var(--surface); border-radius: 10px; max-width: 520px; width: min(520px, 90vw);
  max-height: 70vh; overflow-y: auto; padding: 24px 28px; position: relative;
  box-shadow: var(--shadow-lg);
}
.cite-modal-item { padding: 10px 0; border-bottom: 1px solid var(--border); }
.cite-modal-item:last-child { border-bottom: none; }
.cite-modal-title { font-weight: 600; color: var(--ink); text-decoration: none; display: block; margin-bottom: 4px; font-size: 14px; }
.cite-modal-title:hover { color: var(--accent); }
.cite-modal-summary { font-size: 12.5px; color: var(--text-2); line-height: 1.55; margin: 0; }
.cite-modal-close {
  position: absolute; top: 6px; right: 12px; border: none; background: none;
  font-size: 22px; cursor: pointer; color: var(--text-3); line-height: 1;
}

/* drop-cap 导语首字母大写 */
.editorial-paper .drop-cap::first-letter {
  font-family: "Fraunces", Georgia, serif; font-weight: 900; float: left;
  font-size: 4.2rem; line-height: 0.82; color: var(--vermillion); margin: 0.1rem 0.6rem 0 0;
}
</style>
