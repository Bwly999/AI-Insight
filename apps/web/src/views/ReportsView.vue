<script setup lang="ts">
/**
 * ReportsView — 报告档案列表（统一情报台色板 + 主题切换）。
 */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { listReports } from "@ai-insight/api-client";
import type { Report } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const { theme, toggle } = useTheme();
const reports = ref<Report[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await listReports();
    reports.value = r.items;
  } finally {
    loading.value = false;
  }
});

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const day = Math.floor(diff / 86400000);
  if (day < 1) return "今天";
  if (day < 30) return `${day} 天前`;
  return iso.slice(0, 10);
}
</script>

<template>
  <div class="page grid-bg">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-INSIGHT · 档案</div>
            <h1 class="title">洞察报告档案</h1>
          </div>
          <div class="mast-right">
            <button class="ghost-btn" @click="router.push('/c/new')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              新洞察
            </button>
            <button class="icon-btn theme-toggle" @click="toggle" title="切换主题">
              <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </button>
          </div>
        </div>
        <div class="double-rule"></div>
      </header>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="!reports.length" class="empty">
        <div class="empty-glyph">◎</div>
        <div class="empty-big">还没有报告</div>
        <p>发起一次洞察，Agent 会为你生成报告。</p>
      </div>
      <div v-else class="rep-list">
        <button v-for="(r, i) in reports" :key="r.id" class="rep-row" @click="router.push(`/reports/${r.id}`)">
          <span class="rep-no mono">№{{ String(reports.length - i).padStart(3, "0") }}</span>
          <div class="rep-main">
            <div class="rep-title">{{ r.title }}</div>
            <div class="rep-sub mono">
              <span class="rep-dot"></span>{{ relTime(r.createdAt) }}
              <span v-if="r.standfirst" class="rep-stand">· {{ r.standfirst.slice(0, 48) }}{{ r.standfirst.length > 48 ? '…' : '' }}</span>
            </div>
          </div>
          <svg class="rep-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 880px; margin: 0 auto; padding: 48px 24px 64px; }

.masthead { margin-bottom: 32px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: var(--brand); font-weight: 600; }
.title { font-family: var(--frau); font-weight: 600; font-size: 38px; margin: 8px 0 0; letter-spacing: -0.015em; color: var(--ink); }
.mast-right { display: flex; gap: 8px; }
.double-rule { border-top: 3px double var(--brand); opacity: 0.5; }

.state { color: var(--ink-3); padding: 60px; text-align: center; font-family: var(--mono); }
.empty { padding: 80px 40px; text-align: center; color: var(--ink-3); }
.empty-glyph { font-family: var(--mono); font-size: 48px; color: var(--brand); opacity: 0.5; margin-bottom: 14px; text-shadow: 0 0 24px var(--brand-glow); }
.empty-big { font-family: var(--frau); font-size: 24px; color: var(--ink-2); }
.empty p { margin-top: 8px; }

.rep-list { display: flex; flex-direction: column; gap: 10px; }
.rep-row {
  display: flex; align-items: center; gap: 16px; width: 100%;
  padding: 18px 20px; border-radius: var(--r-md);
  border: 1px solid var(--line); background: var(--surface);
  cursor: pointer; transition: var(--t-mid); text-align: left;
}
.rep-row:hover {
  border-color: var(--brand-line);
  box-shadow: var(--shadow-md), 0 0 20px -8px var(--brand-glow);
  transform: translateY(-1px);
}
.rep-no { font-size: 13px; color: var(--brand); font-weight: 600; min-width: 56px; }
.rep-main { flex: 1; min-width: 0; }
.rep-title { font-family: var(--frau); font-size: 19px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.rep-sub { font-size: 11px; color: var(--ink-3); margin-top: 6px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.rep-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--brand); display: inline-block; }
.rep-stand { opacity: 0.8; }
.rep-chev { color: var(--ink-3); transition: var(--t-fast); }
.rep-row:hover .rep-chev { color: var(--brand); transform: translateX(3px); }
.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }
</style>
