<script setup lang="ts">
/**
 * ReportModal — 报告弹窗（替代 ReportView 全屏页）。
 * 遮罩模糊 + 880px 卡片；正文区采用 editorial 版式（与下载 HTML 一致，固定浅色）；
 * head 含标题 + 下载图标 + ✕（ESC / 点遮罩关闭）。
 */
import { computed, onMounted, onUnmounted, watch } from "vue";
import { Download } from "@lucide/vue";
import { reportHtmlUrl } from "@ai-insight/api-client";
import type { Report } from "@ai-insight/shared-types";
import { editorialColors } from "@ai-insight/shared-ui";
import { mdToHtml } from "../utils/markdown";

const props = defineProps<{ report: Report | null }>();
const emit = defineEmits<{ close: [] }>();

// editorial 色板（@ai-insight/shared-ui 单一来源）——局部持有以便 CSS v-bind 稳定捕获。
const colors = editorialColors;

const open = computed(() => !!props.report);
const bodyHtml = computed(() => (props.report ? mdToHtml(props.report.markdown) : ""));
const htmlUrl = computed(() => (props.report ? reportHtmlUrl(props.report.id) : "#"));

/** 下载文件名：报告标题 + ".html"（净化文件名非法字符）。 */
const downloadName = computed(() => {
  const t = props.report?.title ?? "report";
  return `${t.replace(/[\\/:*?"<>|]/g, "").trim() || "report"}.html`;
});

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
      <div class="modal-head">
        <div>
          <div class="m-eb">分析报告 · 草稿</div>
          <h2>{{ report.title }}</h2>
        </div>
        <div class="head-actions">
          <a
            class="icon-btn"
            :href="htmlUrl"
            :download="downloadName"
            target="_blank"
            rel="noopener"
            title="下载 HTML"
            aria-label="下载 HTML">
            <Download :size="16" :stroke-width="2" />
          </a>
          <button class="icon-btn" title="关闭" aria-label="关闭" @click="emit('close')">✕</button>
        </div>
      </div>

      <div class="modal-body scroll">
        <article class="editorial-paper">
          <p v-if="report.standfirst" class="editorial-standfirst drop-cap">{{ report.standfirst }}</p>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="editorial-body" v-html="bodyHtml"></div>
        </article>
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
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  width: min(880px, 100%); max-height: 88vh; overflow: hidden;
  box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
}
.modal-head {
  padding: 16px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 14px;
}
.modal-head h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--text); }
.m-eb { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 2px; letter-spacing: 0.04em; }
.head-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.head-actions .icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent; background: transparent;
  color: var(--text-2); text-decoration: none; transition: var(--t-fast);
  font-size: 14px; line-height: 1;
}
.head-actions .icon-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--surface-2); }

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
  color: var(--vermillion); font-weight: 600; cursor: default; font-size: 0.8em;
}

/* drop-cap 导语首字母大写 */
.editorial-paper .drop-cap::first-letter {
  font-family: "Fraunces", Georgia, serif; font-weight: 900; float: left;
  font-size: 4.2rem; line-height: 0.82; color: var(--vermillion); margin: 0.1rem 0.6rem 0 0;
}
</style>
