<script setup lang="ts">
/**
 * ReportView — 单报告查看页（editorial / markdown 双视图 + 主题切换）。
 * 复用共享 mdToHtml，消除局部重复实现。
 */
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getReport, reportHtmlUrl } from "@ai-insight/api-client";
import EditorialReport from "@ai-insight/shared-ui/EditorialReport.vue";
import type { Report } from "@ai-insight/shared-types";
import { mdToHtml } from "../utils/markdown";
import { useTheme } from "../composables/useTheme";

const props = defineProps<{ id: string }>();
const router = useRouter();
const { theme, toggle } = useTheme();
const report = ref<Report | null>(null);
const view = ref<"editorial" | "markdown">("editorial");
const loading = ref(true);

onMounted(async () => {
  try {
    report.value = await getReport(props.id);
  } finally {
    loading.value = false;
  }
});

const bodyHtml = computed(() => (report.value ? mdToHtml(report.value.markdown) : ""));
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <button class="ghost-btn" @click="router.back()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        返回
      </button>
      <span class="tool-title">{{ report?.title ?? "报告" }}</span>
      <div class="tool-right">
        <button class="rchip" :class="{ on: view === 'editorial' }" @click="view = 'editorial'">Editorial</button>
        <button class="rchip" :class="{ on: view === 'markdown' }" @click="view = 'markdown'">Markdown</button>
        <a v-if="report" class="btn-secondary" :href="reportHtmlUrl(report.id)" target="_blank">下载 HTML</a>
        <button class="icon-btn theme-toggle" @click="toggle" title="切换主题">
          <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="state">加载中…</div>
    <template v-else-if="report">
      <!-- editorial 版式：在 app 内注入 editorial 变量使其在双主题下统一 -->
      <div class="editorial-host" v-if="view === 'editorial'">
        <EditorialReport :title="report.title" :standfirst="report.standfirst" :body-html="bodyHtml" :meta="{ createdAt: report.createdAt }" />
      </div>
      <pre v-else class="md-raw">{{ report.markdown }}</pre>
    </template>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.toolbar {
  position: sticky; top: 0; z-index: 10;
  background: var(--glass); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid var(--glass-border);
  padding: 11px 20px; display: flex; align-items: center; gap: 12px;
}
.tool-title { font-family: var(--frau); font-weight: 600; font-size: 15px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }

.state { padding: 80px; text-align: center; color: var(--ink-3); font-family: var(--mono); }

/* editorial 变量在 app 内覆盖（原变量只在 SSR HTML 注入），使其适配双主题。
   报告区保持纸张/朱红编辑气质，但在深色下用暗纸 + 信号青替代朱红，与情报台呼应。 */
.editorial-host {
  --paper: var(--surface);
  --paper-2: var(--surface-2);
  --ink: var(--ink);
  --ink-2: var(--ink-2);
  --ink-3: var(--ink-3);
  --rule: var(--brand);
  --vermillion: var(--brand);
  --mustard: var(--amber);
  --forest: var(--green);
  --cobalt: var(--src-search);
  --rose: var(--rose);
}
.editorial-host :deep(.editorial-report) {
  font-family: var(--sans);
  background: var(--surface);
  margin: 0;
}
.editorial-host :deep(.report-masthead) { border-bottom-color: var(--brand); }

.md-raw {
  max-width: 760px; margin: 0 auto; padding: 32px 24px;
  white-space: pre-wrap; font-family: var(--mono); font-size: 13px; line-height: 1.7;
  color: var(--ink);
}
</style>
