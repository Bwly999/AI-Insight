<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { EmptyState } from '@ai-insight/shared-ui';
import { listSessions } from '../api/insight';

const router = useRouter();
const sessions = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref('');

async function fetch() {
  loading.value = true;
  try {
    const res = await listSessions({ page: 1, pageSize: 50, status: statusFilter.value || undefined });
    sessions.value = res.data.items ?? [];
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

function statusClass(s: string) {
  if (s === 'SUCCESS') return 'dot--success';
  if (s === 'FAILED') return 'dot--error';
  if (s === 'ABORTED') return 'dot--warning';
  return 'dot--info';
}

function viewTrace(id: number) {
  router.push(`/insight/sessions/${id}/trace`);
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="metric-num text-2xl">洞察会话 · INSIGHT SESSIONS</h2>
        <p class="mono-data opacity-50 text-sm mt-1">所有用户的 Mode 2 Agent 会话</p>
      </div>
      <div class="flex gap-2">
        <select v-model="statusFilter" class="px-3 py-1.5 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" @change="fetch">
          <option value="">全部</option>
          <option value="RUNNING">运行中</option>
          <option value="SUCCESS">成功</option>
          <option value="FAILED">失败</option>
          <option value="ABORTED">中断</option>
        </select>
        <button class="px-4 py-1.5 text-sm" style="background: var(--paper-2)" @click="fetch">刷新</button>
      </div>
    </div>

    <div v-if="!loading && sessions.length === 0" class="admin-card p-8">
      <EmptyState title="— 暂无洞察会话 —" hint="用户发起 Mode 2 洞察后，会话会出现在这里" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="s in sessions" :key="s.id" class="admin-card p-4 flex items-center gap-4 cursor-pointer hover:opacity-90" @click="viewTrace(s.id)">
        <span class="dot" :class="statusClass(s.status)" />
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate">{{ s.intent }}</p>
          <p class="mono-data text-xs opacity-50">
            #{{ s.id }} · {{ s.status }} · {{ s.usedSteps }}/{{ s.usedToolCalls }} 步/调用 · {{ Math.round(s.usedTokens / 1000) }}k tokens
          </p>
        </div>
        <span class="mono-data text-xs opacity-50">{{ s.startedAt ? new Date(s.startedAt).toLocaleString() : '' }}</span>
      </div>
    </div>
  </div>
</template>
