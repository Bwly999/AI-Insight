<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { EmptyState } from '@ai-insight/shared-ui';
import { listCollectLogs } from '../api/sources';

const logs = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const statusFilter = ref('');

async function fetch() {
  loading.value = true;
  try {
    const res = await listCollectLogs({ page: page.value, pageSize: 30, status: statusFilter.value || undefined });
    logs.value = res.data.items ?? [];
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function statusClass(s: string) {
  if (s === 'SUCCESS') return 'dot--success';
  if (s === 'FAILED') return 'dot--error';
  return 'dot--warning';
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="metric-num text-2xl">采集日志 · COLLECT LOGS</h2>
        <p class="mono-data opacity-50 text-sm mt-1">查看每次采集的运行记录</p>
      </div>
      <div class="flex gap-2">
        <select v-model="statusFilter" class="px-3 py-1.5 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" @change="fetch">
          <option value="">全部状态</option>
          <option value="SUCCESS">成功</option>
          <option value="FAILED">失败</option>
          <option value="RUNNING">运行中</option>
        </select>
        <button class="px-4 py-1.5 text-sm" style="background: var(--paper-2)" @click="fetch">刷新</button>
      </div>
    </div>

    <div v-if="!loading && logs.length === 0" class="admin-card p-8">
      <EmptyState title="— 暂无采集记录 —" hint="数据源配置后，采集器运行时会生成日志" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="log in logs" :key="log.id" class="admin-card p-3 flex items-center gap-3 text-sm">
        <span class="dot" :class="statusClass(log.status)" />
        <span class="mono-data w-36 truncate">{{ log.sourceCode || log.sourceName || `#${log.sourceId}` }}</span>
        <span class="mono-data w-20 text-center text-xs">{{ log.status }}</span>
        <span class="mono-data w-16 text-right">{{ log.itemsFetched ?? '-' }}/{{ log.itemsNew ?? '-' }}</span>
        <span class="mono-data text-xs opacity-50 flex-1 truncate">{{ log.error || '' }}</span>
        <span class="mono-data text-xs opacity-50 w-40 text-right">{{ log.startedAt ? new Date(log.startedAt).toLocaleString() : '' }}</span>
      </div>
    </div>
  </div>
</template>
