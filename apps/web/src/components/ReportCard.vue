<script setup lang="ts">
/**
 * ReportCard — 对话内的洞察报告预览卡（暗底 + 信号青 kicker + 发光 CTA）。
 */
import type { Report } from "@ai-insight/shared-types";

defineProps<{ report: Report }>();
const emit = defineEmits<{ open: [id: string]; download: [id: string] }>();
</script>

<template>
  <div class="report reveal">
    <div class="report-glow"></div>
    <div class="report-top">
      <span class="dot" style="background: var(--brand); box-shadow: 0 0 8px var(--brand-glow)"></span>
      <span class="report-kicker">洞察报告 · ARTIFACT</span>
      <span class="label ml-auto">html + markdown</span>
    </div>
    <div class="report-body">
      <h2 class="report-title">{{ report.title }}</h2>
      <p class="report-stand" v-if="report.standfirst">{{ report.standfirst }}</p>
      <div class="report-actions">
        <button class="btn-primary" @click="emit('open', report.id)">
          查看完整报告
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
        <a class="btn-secondary" :href="`/api/reports/${report.id}/html`" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          下载 HTML
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report {
  position: relative; overflow: hidden;
  background: linear-gradient(180deg, var(--surface), var(--surface-2));
  border: 1px solid var(--brand-line);
  border-radius: var(--r-lg); box-shadow: var(--shadow-md);
}
.report-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(440px 170px at 85% -15%, var(--brand-soft), transparent 70%);
}
.report-top { display: flex; align-items: center; gap: 8px; padding: 15px 20px 0; position: relative; }
.report-kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 10px; color: var(--brand); font-weight: 600; }
.report-body { padding: 8px 20px 20px; position: relative; }
.report-title { font-family: var(--frau); font-weight: 600; font-size: var(--fs-2xl); line-height: 1.12; letter-spacing: -0.01em; color: var(--ink); margin: 0; }
.report-stand { font-size: 14px; line-height: 1.65; color: var(--ink-2); margin-top: 8px; }
.report-actions { display: flex; gap: 9px; margin-top: 18px; flex-wrap: wrap; }
</style>
