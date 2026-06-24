<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { listReports } from "@ai-insight/api-client";
import type { Report } from "@ai-insight/shared-types";

const router = useRouter();
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
</script>

<template>
  <div style="max-width:880px;margin:0 auto;padding:40px 24px">
    <header style="border-bottom:3px solid var(--ink);padding-bottom:16px;margin-bottom:28px">
      <div class="label" style="color:var(--brand)">AI-Insight · 档案</div>
      <h1 style="font-family:var(--frau);font-size:32px;margin:6px 0 0">我的报告</h1>
    </header>
    <div v-if="loading" style="color:var(--ink-3);padding:40px;text-align:center">加载中…</div>
    <div v-else-if="!reports.length" class="empty" style="padding:60px;text-align:center;color:var(--ink-3)">
      <div style="font-family:var(--frau);font-size:24px;color:var(--ink-2)">还没有报告</div>
      <p style="margin-top:8px">发起一次洞察，Agent 会为你生成报告。</p>
    </div>
    <div v-else class="space-y-2">
      <button v-for="r in reports" :key="r.id" class="rep-row" @click="router.push(`/reports/${r.id}`)">
        <div style="flex:1;text-align:left">
          <div style="font-family:var(--frau);font-size:18px;font-weight:600;color:var(--ink)">{{ r.title }}</div>
          <div class="mono" style="font-size:11px;color:var(--ink-3);margin-top:4px">{{ r.createdAt.slice(0,10) }}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.rep-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; transition: .15s; }
.rep-row:hover { border-color: var(--brand-line); box-shadow: var(--shadow-md); transform: translateY(-1px); }
</style>
