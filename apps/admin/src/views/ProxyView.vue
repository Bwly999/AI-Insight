<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getProxy, updateProxy, testProxy } from '../api/proxy';

const form = ref({
  enabled: false,
  host: '',
  port: 8080,
  auth: { scheme: 'none' as string, token: '' },
});
const testResult = ref<string | null>(null);
const toast = ref<string | null>(null);
const loading = ref(false);

async function fetch() {
  try {
    const res = await getProxy();
    if (res.data && res.data.enabled !== undefined) {
      form.value = {
        enabled: res.data.enabled ?? false,
        host: res.data.host ?? '',
        port: res.data.port ?? 8080,
        auth: res.data.auth ?? { scheme: 'none', token: '' },
      };
    }
  } catch {
    // ignore
  }
}

async function save() {
  loading.value = true;
  try {
    await updateProxy(form.value);
    showToast('代理配置已更新并生效');
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '保存失败');
  } finally {
    loading.value = false;
  }
}

async function test() {
  testResult.value = '测试中…';
  try {
    const res = await testProxy();
    testResult.value = res.data.ok ? '连通成功' : `连通失败: ${res.data.detail}`;
  } catch (err: any) {
    testResult.value = `测试失败: ${err.message}`;
  }
  setTimeout(() => { testResult.value = null; }, 5000);
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
      <h2 class="metric-num text-2xl">HTTP 代理 · PROXY</h2>
      <p class="mono-data opacity-50 text-sm mt-1">配置采集器出网的代理（支持 HTTP Proxy）</p>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">
      {{ toast }}
    </div>

    <!-- Test result -->
    <div v-if="testResult" class="admin-card p-3 text-sm mono-data" :style="testResult.includes('成功') ? 'border-color: var(--forest)' : 'border-color: var(--vermillion)'">
      {{ testResult }}
    </div>

    <div class="admin-card p-6 space-y-4">
      <div class="flex items-center gap-3">
        <label class="mono-data text-sm">启用代理</label>
        <input v-model="form.enabled" type="checkbox" />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div class="col-span-2">
          <label class="mono-data text-xs block mb-1">主机</label>
          <input v-model="form.host" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="proxy.example.com" :disabled="!form.enabled" />
        </div>
        <div>
          <label class="mono-data text-xs block mb-1">端口</label>
          <input v-model.number="form.port" type="number" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" :disabled="!form.enabled" />
        </div>
      </div>

      <div>
        <label class="mono-data text-xs block mb-1">认证方式</label>
        <select v-model="form.auth.scheme" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" :disabled="!form.enabled">
          <option value="none">无认证</option>
          <option value="basic">Basic</option>
          <option value="bearer">Bearer</option>
        </select>
      </div>

      <div v-if="form.auth.scheme !== 'none'">
        <label class="mono-data text-xs block mb-1">Token</label>
        <input v-model="form.auth.token" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="base64 或 bearer token" />
      </div>

      <div class="flex gap-3 pt-2">
        <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="save" :disabled="loading">
          {{ loading ? '保存中…' : '保存并生效' }}
        </button>
        <button class="px-4 py-2 text-sm" style="background: var(--paper-2)" @click="test">连通性测试</button>
      </div>
    </div>
  </div>
</template>
