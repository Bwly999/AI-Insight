<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getCron, updateCron } from '../api/cron';

const config = ref<{ collect: { expression: string; nextRuns: string[] }; process: { expression: string; nextRuns: string[] } } | null>(null);
const form = ref({ collect: '*/30 * * * *', process: '0 * * * *' });
const toast = ref<string | null>(null);
const loading = ref(false);

async function fetch() {
  try {
    const res = await getCron();
    config.value = res.data;
    form.value = {
      collect: res.data.collect?.expression ?? '*/30 * * * *',
      process: res.data.process?.expression ?? '0 * * * *',
    };
  } catch {
    // ignore
  }
}

async function save() {
  loading.value = true;
  try {
    await updateCron(form.value);
    showToast('cron 配置已更新');
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '保存失败');
  } finally {
    loading.value = false;
  }
}

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 3000);
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-6 max-w-xl">
    <div>
      <h2 class="metric-num text-2xl">全局 Cron · SCHEDULER</h2>
      <p class="mono-data opacity-50 text-sm mt-1">采集和处理管线的全局定时调度</p>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">
      {{ toast }}
    </div>

    <!-- Collect Cron -->
    <div class="admin-card p-6 space-y-4">
      <h3 class="metric-num text-lg">采集 cron · COLLECT</h3>
      <p class="mono-data text-xs opacity-50">遍历所有 enabled 数据源，按源 interval 判断本轮是否触发</p>
      <div>
        <label class="mono-data text-xs block mb-1">cron 表达式</label>
        <input v-model="form.collect" class="w-full px-3 py-2 text-sm font-mono" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="*/30 * * * *" />
      </div>
      <div v-if="config?.collect?.nextRuns?.length" class="mono-data text-xs opacity-50">
        下次运行: {{ config.collect.nextRuns.slice(0, 2).join(', ') }}
      </div>
    </div>

    <!-- Process Cron -->
    <div class="admin-card p-6 space-y-4">
      <h3 class="metric-num text-lg">处理 cron · PROCESS</h3>
      <p class="mono-data text-xs opacity-50">对 raw_items 执行 AI 处理五阶段（Phase 2）</p>
      <div>
        <label class="mono-data text-xs block mb-1">cron 表达式</label>
        <input v-model="form.process" class="w-full px-3 py-2 text-sm font-mono" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="0 * * * *" />
      </div>
      <div v-if="config?.process?.nextRuns?.length" class="mono-data text-xs opacity-50">
        下次运行: {{ config.process.nextRuns.slice(0, 2).join(', ') }}
      </div>
    </div>

    <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="save" :disabled="loading">
      {{ loading ? '保存中…' : '保存配置' }}
    </button>
  </div>
</template>
