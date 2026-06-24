<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getReport, reportHtmlUrl } from "@ai-insight/api-client";
import EditorialReport from "@ai-insight/shared-ui/EditorialReport.vue";
import type { Report } from "@ai-insight/shared-types";

const props = defineProps<{ id: string }>();
const router = useRouter();
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

// 极简 markdown→html（与 server 端一致；此处用于客户端 editorial 预览）
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t: string) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return md.split("\n").map((line) => {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    if (line.startsWith("> ")) return `<blockquote>${inline(line.slice(2))}</blockquote>`;
    if (/^\s*[-*]\s+/.test(line)) return `<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
    if (line.trim() === "") return "";
    return `<p>${inline(line)}</p>`;
  }).join("\n");
}

const bodyHtml = computed(() => (report.value ? mdToHtml(report.value.markdown) : ""));
</script>

<template>
  <div>
    <div style="position:sticky;top:0;z-index:10;background:var(--surface);border-bottom:1px solid var(--line);padding:10px 20px;display:flex;align-items:center;gap:12px">
      <button class="ghost-btn" @click="router.back()">← 返回</button>
      <span style="font-family:var(--frau);font-weight:600;font-size:15px">{{ report?.title ?? '报告' }}</span>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="rchip" :class="{on:view==='editorial'}" @click="view='editorial'">Editorial</button>
        <button class="rchip" :class="{on:view==='markdown'}" @click="view='markdown'">Markdown</button>
        <a v-if="report" class="btn-secondary" :href="reportHtmlUrl(report.id)" target="_blank" style="height:32px">下载 HTML</a>
      </div>
    </div>

    <div v-if="loading" style="padding:60px;text-align:center;color:var(--ink-3)">加载中…</div>
    <template v-else-if="report">
      <!-- editorial 版式（客户端渲染复用 EditorialReport.vue） -->
      <EditorialReport v-if="view==='editorial'"
        :title="report.title" :standfirst="report.standfirst" :body-html="bodyHtml"
        :meta="{ createdAt: report.createdAt }" />
      <!-- markdown 原文 -->
      <pre v-else style="max-width:760px;margin:0 auto;padding:32px 24px;white-space:pre-wrap;font-family:var(--mono);font-size:13px;line-height:1.7">{{ report.markdown }}</pre>
    </template>
  </div>
</template>

<style scoped>
.ghost-btn { height: 32px; padding: 0 12px; border-radius: 9px; display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink-2); border: 1px solid var(--line); background: var(--surface); cursor: pointer; }
.ghost-btn:hover { color: var(--ink); }
.rchip { font-family: var(--mono); font-size: 11.5px; padding: 4px 9px; border-radius: 7px; background: var(--surface); border: 1px solid var(--line); color: var(--ink-2); cursor: pointer; }
.rchip.on { background: var(--ink); border-color: var(--ink); color: #fff; font-weight: 500; }
.btn-secondary { display: inline-flex; align-items: center; padding: 0 12px; border-radius: 9px; font-size: 13px; color: var(--ink-2); border: 1px solid var(--line-2); background: var(--surface); text-decoration: none; }
</style>
