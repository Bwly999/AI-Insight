<script setup lang="ts">
/**
 * AdminRunsView — 全量运行监控（admin）：状态/会话/报告/tokens/耗时。
 */
import { ref, onMounted, onUnmounted } from "vue";
import { listAllRuns } from "@ai-insight/api-client";
import type { InsightRun } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";

const { theme, toggle } = useTheme();
type AdminRun = InsightRun & { conversationTitle?: string; reportTitle?: string };
const runs = ref<AdminRun[]>([]);
const loading = ref(true);
let timer: ReturnType<typeof setInterval> | null = null;

async function reload() {
  try {
    const r = await listAllRuns();
    runs.value = r.items;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void reload();
  timer = setInterval(() => reload(), 5000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function statusColor(s: string): string {
  return s === "completed" ? "ok" : s === "failed" || s === "interrupted" ? "err" : s === "running" ? "run" : "q";
}
function relTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}时前`;
  return iso.slice(0, 10);
}
function dur(startedAt?: string, endedAt?: string): string {
  if (!startedAt || !endedAt) return "—";
  const s = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  return s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m${Math.floor(s % 60)}s`;
}
</script>

<template>
  <div class="page grid-bg">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-INSIGHT · 管理端</div>
            <h1 class="title">运行监控</h1>
          </div>
          <div class="mast-right">
            <span class="live mono">● LIVE</span>
            <button class="icon-btn theme-toggle" @click="toggle" title="切换主题">
              <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </button>
          </div>
        </div>
        <div class="double-rule"></div>
        <nav class="tabs">
          <span class="tab on">运行监控</span>
          <a class="tab" href="#/schedules">定时任务</a>
          <a class="tab" href="#/datasources">数据源</a>
          <a class="tab" href="#/settings">设置</a>
        </nav>
      </header>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="!runs.length" class="empty">尚无运行记录</div>
      <div v-else class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th>状态</th><th>会话</th><th>报告</th><th>lens</th><th>tokens</th><th>耗时</th><th>结束</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in runs" :key="r.id">
              <td><span class="badge" :class="statusColor(r.status)">{{ r.status }}</span></td>
              <td class="cell-main">{{ r.conversationTitle ?? r.conversationId.slice(0, 12) }}</td>
              <td class="muted">{{ r.reportTitle ? r.reportTitle.slice(0, 28) + (r.reportTitle.length > 28 ? '…' : '') : '—' }}</td>
              <td class="mono muted">{{ r.lens ?? 'deep' }}</td>
              <td class="mono">{{ r.tokens ? r.tokens.toLocaleString() : '—' }}</td>
              <td class="mono">{{ dur(r.startedAt, r.endedAt) }}</td>
              <td class="mono muted">{{ relTime(r.endedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 1100px; margin: 0 auto; padding: 40px 24px 64px; }
.masthead { margin-bottom: 24px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: var(--accent); font-weight: 600; }
.title { font-family: var(--frau); font-weight: 600; font-size: 34px; margin: 8px 0 0; color: var(--text); }
.mast-right { display: flex; align-items: center; gap: 12px; }
.live { font-size: 11px; color: var(--accent); letter-spacing: 0.1em; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.double-rule { border-top: 1px solid var(--border); margin-bottom: 14px; }
.tabs { display: flex; gap: 4px; }
.tab { font-size: 13px; color: var(--text-3); padding: 6px 14px; border-radius: var(--r-pill); text-decoration: none; cursor: pointer; }
.tab.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }

.state, .empty { color: var(--text-3); padding: 60px; text-align: center; font-family: var(--mono); }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; padding: 12px 14px; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); border-bottom: 1px solid var(--border); background: var(--surface-2); }
.tbl td { padding: 11px 14px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.cell-main { font-family: var(--frau); font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--text-3); }
.badge { font-family: var(--mono); font-size: 10px; padding: 3px 9px; border-radius: var(--r-pill); text-transform: uppercase; letter-spacing: 0.06em; }
.badge.ok { background: var(--green-soft); color: var(--green); }
.badge.err { background: var(--rose-soft); color: var(--rose); }
.badge.run { background: var(--accent-soft); color: var(--accent); }
.badge.q { background: var(--surface-3); color: var(--text-3); }
.theme-toggle { color: var(--text-2); }
.theme-toggle:hover { color: var(--accent); background: var(--accent-soft); }
</style>
