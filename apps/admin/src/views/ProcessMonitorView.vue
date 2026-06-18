<script setup lang="ts">
import { ref } from 'vue';
import { triggerProcess, getProcessStatus } from '../api/process';

const status = ref<any>(null);
const toast = ref<string | null>(null);

async function run() {
  try {
    const res = await triggerProcess();
    showToast(`已触发处理 job: ${res.data.jobId}`);
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '触发失败');
  }
}

async function refresh() {
  try {
    const res = await getProcessStatus();
    status.value = res.data;
  } catch {}
}

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 3000);
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="metric-num text-2xl">处理监控 · PROCESSING</h2>
      <p class="mono-data opacity-50 text-sm mt-1">AI 处理管线状态和控制</p>
    </div>

    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">{{ toast }}</div>

    <div class="grid grid-cols-4 gap-3">
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">等待中</p>
        <p class="metric-num text-2xl">{{ status?.pending ?? 0 }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">运行中</p>
        <p class="metric-num text-2xl" style="color: var(--cobalt)">{{ status?.running ?? 0 }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">失败</p>
        <p class="metric-num text-2xl" style="color: var(--vermillion)">{{ status?.failed ?? 0 }}</p>
      </div>
      <div class="admin-card p-4">
        <p class="mono-data text-xs opacity-50">Token 用量</p>
        <p class="metric-num text-2xl">{{ status?.tokenUsage ?? 0 }}</p>
      </div>
    </div>

    <div class="flex gap-3">
      <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="run">触发处理</button>
      <button class="px-4 py-2 text-sm" style="background: var(--paper-2)" @click="refresh">刷新状态</button>
    </div>
  </div>
</template>
