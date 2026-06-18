<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { EmptyState } from '@ai-insight/shared-ui';
import { listSources, createSource, updateSource, deleteSource, testSource, runCollect } from '../api/sources';

const loading = ref(false);
const sources = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showForm = ref(false);
const editing = ref<any | null>(null);
const testResult = ref<string | null>(null);
const toast = ref<string | null>(null);

// 表单
const form = ref({
  code: '',
  name: '',
  type: 'RSS',
  config: {} as Record<string, unknown>,
  enabled: true,
});

const TYPE_CONFIG_TEMPLATES: Record<string, any> = {
  RSS: { feedUrl: '', maxItems: 50, stripHtml: true },
  SEARCH_API: { mode: 'list', endpoint: '', resultPath: '', fieldMap: { title: 'title', url: 'url' }, maxResults: 50 },
  SEARCH_CRAWL: { listUrl: '', itemSelector: '', fieldSelectors: { title: 'a', url: 'a' }, maxResults: 50 },
  WEB_SCRAPER: { bodyExtractor: 'readability', maxBytes: 1048576 },
};

const apiKeyFields = computed(() => {
  if (form.value.type === 'SEARCH_API') {
    const cfg = form.value.config as any;
    return Object.keys(cfg).filter(k => k.toLowerCase().includes('apikey') || k.toLowerCase().includes('api_key'));
  }
  return [];
});

async function fetch() {
  loading.value = true;
  try {
    const res = await listSources({ page: page.value, pageSize: pageSize.value, type: undefined, enabled: undefined });
    sources.value = res.data.items ?? [];
    total.value = res.data.total ?? 0;
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '加载失败');
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editing.value = null;
  form.value = { code: '', name: '', type: 'RSS', config: { ...TYPE_CONFIG_TEMPLATES.RSS }, enabled: true };
  showForm.value = true;
}

function openEdit(src: any) {
  editing.value = src;
  form.value = {
    code: src.code,
    name: src.name,
    type: src.type,
    config: { ...(src.config || {}) },
    enabled: src.enabled,
  };
  showForm.value = true;
}

function onTypeChange() {
  const t = form.value.type;
  if (!form.value.config || Object.keys(form.value.config).length === 0) {
    form.value.config = { ...TYPE_CONFIG_TEMPLATES[t] };
  }
}

async function save() {
  try {
    if (editing.value) {
      await updateSource(editing.value.id, form.value);
      showToast('已更新');
    } else {
      await createSource(form.value);
      showToast('已创建');
    }
    showForm.value = false;
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '保存失败');
  }
}

async function doDelete(src: any) {
  if (!confirm(`确定删除 ${src.name}？`)) return;
  try {
    await deleteSource(src.id);
    showToast('已删除');
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '删除失败');
  }
}

async function doTest(src: any) {
  testResult.value = '测试中…';
  try {
    const res = await testSource(src.id);
    testResult.value = `返回 ${res.data.count} 条，前 ${res.data.items.length} 条示例`;
  } catch (err: any) {
    testResult.value = `测试失败: ${err?.response?.data?.message ?? err.message}`;
  }
  setTimeout(() => { testResult.value = null; }, 5000);
}

async function doTrigger(src?: any) {
  try {
    await runCollect(src?.id);
    showToast(src ? `已触发 ${src.name} 采集` : '已触发全部源采集');
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '触发失败');
  }
}

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 3000);
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="metric-num text-2xl">数据源 · SOURCES</h2>
        <p class="mono-data opacity-50 text-sm mt-1">管理采集器的注册、配置与手动触发</p>
      </div>
      <button class="px-4 py-2 text-sm" style="background: var(--vermillion); color: var(--paper)" @click="openNew">
        + 新建源
      </button>
    </div>

    <!-- Test result toast -->
    <div v-if="testResult" class="admin-card p-3 text-sm mono-data" style="border-color: var(--cobalt)">
      {{ testResult }}
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">
      {{ toast }}
    </div>

    <!-- Source list -->
    <div v-if="!loading && sources.length === 0" class="admin-card p-8">
      <EmptyState title="— 暂无数据源 —" hint="点击「新建源」添加第一个采集器" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="src in sources" :key="src.id" class="admin-card p-4 flex items-center gap-4">
        <span class="dot" :class="src.enabled ? 'dot--success' : 'dot--warning'" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="metric-num text-base">{{ src.name }}</span>
            <span class="mono-data text-xs px-2 py-0.5 rounded-sm" style="background: var(--paper-2); opacity: 0.7">{{ src.type }}</span>
            <span v-if="src.lastCollectStatus === 'SUCCESS'" class="dot dot--success" title="上次采集成功" />
            <span v-else-if="src.lastCollectStatus === 'FAILED'" class="dot dot--error" title="上次采集失败" />
          </div>
          <p class="mono-data text-xs opacity-50 truncate mt-1">{{ src.code }}</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button class="px-3 py-1.5 rounded-sm hover:opacity-80" style="background: var(--paper-2)" @click="doTest(src)">试采</button>
          <button class="px-3 py-1.5 rounded-sm hover:opacity-80" style="background: var(--paper-2)" @click="doTrigger(src)">触发</button>
          <button class="px-3 py-1.5 rounded-sm hover:opacity-80" style="background: var(--paper-2)" @click="openEdit(src)">编辑</button>
          <button class="px-3 py-1.5 rounded-sm hover:opacity-80" style="background: var(--vermillion); color: var(--paper)" @click="doDelete(src)">删除</button>
        </div>
      </div>
    </div>

    <!-- Pagination hint -->
    <p v-if="total > pageSize" class="mono-data text-xs opacity-50 text-center">
      共 {{ total }} 条 · 当前第 {{ page }} 页
    </p>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 z-40 flex items-center justify-center" style="background: rgba(0,0,0,0.6)">
      <div class="admin-card p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
        <h3 class="metric-num text-lg mb-4">{{ editing ? '编辑源' : '新建源' }}</h3>

        <div class="space-y-4">
          <div>
            <label class="mono-data text-xs block mb-1">编码</label>
            <input v-model="form.code" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="rss-solidot" />
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">名称</label>
            <input v-model="form.name" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="Solidot" />
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">类型</label>
            <select v-model="form.type" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" @change="onTypeChange">
              <option value="RSS">RSS</option>
              <option value="SEARCH_API">SEARCH_API</option>
              <option value="SEARCH_CRAWL">SEARCH_CRAWL</option>
              <option value="WEB_SCRAPER">WEB_SCRAPER</option>
            </select>
          </div>

          <!-- Type-specific config -->
          <div>
            <label class="mono-data text-xs block mb-1">配置</label>
            <div v-if="form.type === 'RSS'" class="space-y-2">
              <input v-model="(form.config as any).feedUrl" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="feedUrl" />
              <div class="flex gap-2">
                <input v-model.number="(form.config as any).maxItems" type="number" class="w-24 px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="maxItems" />
                <label class="flex items-center gap-2 text-sm"><input v-model="(form.config as any).stripHtml" type="checkbox" /> stripHtml</label>
              </div>
            </div>
            <div v-else-if="form.type === 'SEARCH_API'" class="space-y-2">
              <select v-model="(form.config as any).mode" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)">
                <option value="list">mode=list（直接拉列表）</option>
                <option value="query">mode=query（需 apiKey）</option>
              </select>
              <input v-model="(form.config as any).endpoint" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="endpoint" />
              <input v-model="(form.config as any).resultPath" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="resultPath (如 data.list[*])" />
              <div v-if="(form.config as any).mode === 'query'">
                <input v-model="(form.config as any).apiKeyRef" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="apiKeyRef" />
                <input v-model="(form.config as any).queryField" class="w-full px-3 py-2 text-sm mt-2" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="queryField (如 query/q)" />
              </div>
            </div>
            <div v-else-if="form.type === 'SEARCH_CRAWL'" class="space-y-2">
              <input v-model="(form.config as any).listUrl" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="listUrl" />
              <input v-model="(form.config as any).itemSelector" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="itemSelector (如 tr.athing)" />
            </div>
            <div v-else-if="form.type === 'WEB_SCRAPER'" class="space-y-2">
              <p class="text-xs opacity-50">WEB_SCRAPER 配置留待 Phase 2</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <label class="mono-data text-xs">启用</label>
            <input v-model="form.enabled" type="checkbox" />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button class="px-4 py-2 text-sm" style="background: var(--paper-2)" @click="showForm = false">取消</button>
          <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="save">{{ editing ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
