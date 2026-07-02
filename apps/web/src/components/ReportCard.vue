<script setup lang="ts">
/**
 * ReportCard — 对话内的报告预览卡（点击触发弹窗，不跳路由）。
 */
import { computed } from "vue";
import type { Report } from "@ai-insight/shared-types";

const props = defineProps<{ report: Report }>();
const emit = defineEmits<{ open: [id: string]; download: [id: string] }>();

// 简单统计：章节数（## 计数）、字数
const chapterCount = computed(() => (props.report.markdown.match(/^#{1,3}\s/gm) || []).length);
const wordCount = computed(() => props.report.markdown.length);
const timeLabel = computed(() => {
  const d = new Date(props.report.createdAt);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, " ");
});
</script>

<template>
  <div class="report-card" @click="emit('open', report.id)">
    <div class="rc-top">
      <span>分析报告 · 草稿</span>
      <span>{{ timeLabel }}</span>
    </div>
    <div class="rc-body">
      <h3>{{ report.title }}</h3>
      <p v-if="report.standfirst" class="rc-lede">{{ report.standfirst }}</p>
    </div>
    <div class="rc-foot">
      <span>{{ chapterCount }} 章节</span>
      <span>{{ wordCount }} 字</span>
      <span class="hint">点击在弹窗内查阅 →</span>
    </div>
  </div>
</template>

<style scoped>
.report-card {
  margin: 14px 0; border: 1px solid var(--border); border-radius: 12px;
  overflow: hidden; background: var(--surface);
  box-shadow: var(--shadow-md); cursor: pointer; transition: var(--t-fast);
}
.report-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.rc-top {
  background: var(--surface-3); color: var(--text-2);
  padding: 6px 15px; display: flex; justify-content: space-between;
  font-size: 11px; font-weight: 600; border-bottom: 1px solid var(--border);
}
.rc-body { padding: 15px 17px; }
.rc-body h3 { font-size: 17px; font-weight: 700; margin: 0 0 3px; letter-spacing: -0.01em; color: var(--text); }
.rc-lede { font-size: 13px; color: var(--text-3); margin: 0; line-height: 1.5; }
.rc-foot {
  padding: 8px 17px; border-top: 1px solid var(--border);
  font-size: 11px; color: var(--text-3); display: flex; gap: 16px;
}
.rc-foot .hint { margin-left: auto; color: var(--accent-text); font-weight: 600; }
</style>
