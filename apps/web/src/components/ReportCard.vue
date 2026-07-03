<script setup lang="ts">
/**
 * ReportCard — 对话内的报告预览卡（点击触发弹窗，不跳路由）。
 * 版式参考 prototype C方案（Console 情报台）：眉栏 + 衬线标题 + 三宫格统计 + 操作行，
 * 配色改用项目翠绿 token，light/dark 双主题自洽。
 */
import { computed } from "vue";
import { ArrowRight, Download, FileText } from "@lucide/vue";
import type { Report, ReportSummary } from "@ai-insight/shared-types";

const props = defineProps<{ report: Report | ReportSummary }>();
const emit = defineEmits<{ open: [id: string]; download: [id: string] }>();

// 由 markdown 派生的卡片统计（Report 类型本身不带 stat 字段）
const chapterCount = computed(() => (props.report.markdown.match(/^#{1,3}\s/gm) || []).length);
const wordCount = computed(() => props.report.markdown.length);
// 紧凑展示：>=1000 折成 5.2k
const wordLabel = computed(() => {
  const n = wordCount.value;
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
});
// 阅读时长估：约 500 字/分钟
const readMin = computed(() => Math.max(1, Math.round(wordCount.value / 500)));
const timeLabel = computed(() => {
  const d = new Date(props.report.createdAt);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, " ");
});

function open() {
  emit("open", props.report.id);
}
// 卡片本身可获焦、键盘可达；按钮获焦时交给按钮自身处理
function onKey(e: KeyboardEvent) {
  if (e.currentTarget !== e.target) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    open();
  }
}
</script>

<template>
  <div
    class="report-card"
    role="button"
    tabindex="0"
    @click="open"
    @keydown="onKey">
    <!-- 眉栏：报告标识 + 状态（editorial masthead 风：kicker + double-rule） -->
    <div class="rc-eyebrow">
      <span class="rc-label"><FileText :size="12" :stroke-width="2.2" /> 分析报告</span>
      <span class="rc-meta">
        <span class="rc-draft">草稿</span>
        <span class="rc-time">{{ timeLabel }}</span>
      </span>
    </div>

    <!-- 标题 + 导语（editorial 预览：Fraunces 标题，standfirst 衬线导语） -->
    <div class="rc-body">
      <h3 class="rc-title">{{ report.title }}</h3>
      <p v-if="report.standfirst" class="rc-lede">{{ report.standfirst }}</p>
    </div>

    <!-- 三宫格统计（仪器风：mono 数据 + 翠绿数值强调） -->
    <div class="rc-stats">
      <div class="rc-stat">
        <span class="rc-stat-num">{{ chapterCount }}</span>
        <span class="rc-stat-label">章节</span>
      </div>
      <div class="rc-stat">
        <span class="rc-stat-num">{{ wordLabel }}</span>
        <span class="rc-stat-label">字数</span>
      </div>
      <div class="rc-stat">
        <span class="rc-stat-num">{{ readMin }}<span class="rc-unit">min</span></span>
        <span class="rc-stat-label">阅读</span>
      </div>
    </div>

    <!-- 操作行 -->
    <div class="rc-actions">
      <span class="rc-open-hint">点击查阅完整报告 <ArrowRight :size="12" :stroke-width="2.2" /></span>
      <button
        class="rc-dl"
        type="button"
        title="下载 HTML 报告"
        @click.stop="emit('download', report.id)">
        <Download :size="12" :stroke-width="2.2" /> 下载
      </button>
    </div>
  </div>
</template>

<style scoped>
.report-card {
  margin: 16px 0;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: border-color var(--t-mid), box-shadow var(--t-mid), transform var(--t-mid);
}
.report-card:hover {
  border-color: var(--accent-line);
  box-shadow: var(--shadow-md);
}
.report-card:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring);
}

/* 眉栏：editorial masthead——kicker 在左、元信息在右，底 double-rule */
.rc-eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--accent-line);
}
.rc-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-text);
  font-family: var(--mono);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.rc-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.rc-draft {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--amber-soft);
  color: var(--amber);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.04em;
  border: 1px solid var(--amber-line);
}
.rc-time {
  font-family: var(--mono);
  font-size: var(--fs-xs);
  color: var(--text-3);
  letter-spacing: 0.02em;
}

/* 标题 + 导语 */
.rc-body { padding: 18px 20px 14px; }
.rc-title {
  margin: 0 0 7px;
  font-family: var(--frau);
  font-size: var(--fs-xl);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.012em;
  color: var(--text);
}
.rc-lede {
  margin: 0;
  font-family: var(--frau);
  font-style: italic;
  font-size: var(--fs-md);
  line-height: 1.55;
  color: var(--text-2);
}

/* 三宫格统计：数值用 Fraunces（editorial 数字感），label 用 mono uppercase */
.rc-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 13px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}
.rc-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
}
.rc-stat + .rc-stat { border-left: 1px solid var(--border); }
.rc-stat-num {
  font-family: var(--frau);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  color: var(--accent-text);
}
.rc-unit {
  margin-left: 2px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.rc-stat-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-3);
  text-transform: uppercase;
}

/* 操作行 */
.rc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  border-top: 1px solid var(--border);
}
.rc-open-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent-text);
  font-size: var(--fs-xs);
  font-weight: 600;
}
.rc-dl {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-2);
  font-family: var(--sans);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: var(--t-fast);
}
.rc-dl:hover {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent-text);
}
.rc-dl:focus-visible { outline: none; box-shadow: var(--ring); }
</style>

