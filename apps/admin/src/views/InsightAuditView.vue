<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { listSessions } from '../api/insight';

const router = useRouter();
const sessions = ref<any[]>([]);
const loading = ref(false);

const stats = ref({
  total: 0,
  success: 0,
  failed: 0,
  aborted: 0,
  avgTokens: 0,
  avgSteps: 0,
});

async function fetch() {
  loading.value = true;
  try {
    const res = await listSessions({ page: 1, pageSize: 100 });
    sessions.value = res.data.items ?? [];

    const s = sessions.value;
    const success = s.filter(x => x.status === 'SUCCESS').length;
    const failed = s.filter(x => x.status === 'FAILED').length;
    const aborted = s.filter(x => x.status === 'ABORTED').length;
    const avgTokens = s.length > 0 ? Math.round(s.reduce((a: number, b: any) => a + (b.usedTokens || 0), 0) / s.length) : 0;
    const avgSteps = s.length > 0 ? Math.round(s.reduce((a: number, b: any) => a + (b.usedSteps || 0), 0) / s.length) : 0;

    stats.value = { total: s.length, success, failed, aborted, avgTokens, avgSteps };
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function viewTrace(id: number) {
  router.push(`/insight/sessions/${id}/trace`);
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-6">
    <h2 class="metric-num text-2xl">审计面板 · AUDIT</h2>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">总会话</p>
        <p class="metric-num text-2xl">{{ stats.total }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">成功率</p>
        <p class="metric-num text-2xl" style="color: var(--forest)">
          {{ stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0 }}%
        </p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">成功</p>
        <p class="metric-num text-2xl" style="color: var(--forest)">{{ stats.success }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">失败</p>
        <p class="metric-num text-2xl" style="color: var(--vermillion)">{{ stats.failed }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">中断</p>
        <p class="metric-num text-2xl" style="color: var(--mustard)">{{ stats.aborted }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">平均 token</p>
        <p class="metric-num text-2xl">{{ Math.round(stats.avgTokens / 1000) }}k</p>
      </div>
    </div>

    <!-- Recent Sessions -->
    <div>
      <h3 class="metric-num text-lg mb-3">近期会话</h3>
      <div class="space-y-2">
        <div v-for="s in sessions" :key="s.id" class="admin-card p-3 flex items-center gap-3 text-sm cursor-pointer hover:opacity-90" @click="viewTrace(s.id)">
          <span class="dot" :class="s.status === 'SUCCESS' ? 'dot--success' : s.status === 'FAILED' ? 'dot--error' : 'dot--warning'" />
          <span class="mono-data flex-1 truncate">{{ s.intent.slice(0, 60) }}</span>
          <span class="mono-data w-16 text-right">{{ s.status }}</span>
          <span class="mono-data w-20 text-right">{{ s.usedSteps ?? 0 }} 步</span>
          <span class="mono-data w-20 text-right">{{ Math.round((s.usedTokens ?? 0) / 1000) }}k</span>
        </div>
      </div>
    </div>
  </div>
</template>
