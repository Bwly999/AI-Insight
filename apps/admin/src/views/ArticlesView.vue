<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { EmptyState } from '@ai-insight/shared-ui';
import { listArticles, updateArticle } from '../api/articles';

const articles = ref<any[]>([]);
const loading = ref(false);
const editTarget = ref<any | null>(null);
const editForm = ref({ summary: '', heat: 50, critical: false, tags: [] as string[], trendComment: '' });
const toast = ref<string | null>(null);

async function fetch() {
  loading.value = true;
  try {
    const res = await listArticles({ page: 1, pageSize: 50 });
    articles.value = res.data.items ?? [];
  } catch {} finally { loading.value = false; }
}

function openEdit(a: any) {
  editTarget.value = a;
  editForm.value = {
    summary: a.summary ?? '',
    heat: a.heat ?? 50,
    critical: a.critical ?? false,
    tags: a.tags ?? [],
    trendComment: a.trendComment ?? '',
  };
}

async function save() {
  if (!editTarget.value) return;
  try {
    await updateArticle(editTarget.value.id, editForm.value);
    showToast('已更新');
    editTarget.value = null;
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '保存失败');
  }
}

function showToast(msg: string) {
  toast.value = msg;
  setTimeout(() => { toast.value = null; }, 3000);
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="metric-num text-2xl">Article 池 · ARTICLES</h2>
      <button class="px-4 py-1.5 text-sm" style="background: var(--paper-2)" @click="fetch">刷新</button>
    </div>

    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">{{ toast }}</div>

    <div v-if="!loading && articles.length === 0" class="admin-card p-8">
      <EmptyState title="— 暂无文章 —" hint="采集器运行并触发 AI 处理后，文章会出现在这里" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="a in articles" :key="a.id" class="admin-card p-3 flex items-center gap-3 text-sm cursor-pointer hover:opacity-90" @click="openEdit(a)">
        <span class="mono-data w-8 text-right text-xs opacity-50">{{ a.heat }}</span>
        <div class="flex-1 min-w-0">
          <p class="truncate">{{ a.summary?.slice(0, 100) }}</p>
          <div class="flex gap-1 mt-1">
            <span class="mono-data text-xs px-1.5 py-0.5 rounded-sm" style="background: var(--paper-2)">{{ a.categoryCode }}</span>
            <span v-if="a.critical" class="mono-data text-xs px-1.5 py-0.5 rounded-sm" style="background: var(--vermillion); color: #fff">头条</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editTarget" class="fixed inset-0 z-40 flex items-center justify-center" style="background: rgba(0,0,0,0.6)">
      <div class="admin-card p-6 w-full max-w-lg">
        <h3 class="metric-num text-lg mb-4">编辑 Article #{{ editTarget.id }}</h3>
        <div class="space-y-3">
          <div>
            <label class="mono-data text-xs block mb-1">摘要</label>
            <textarea v-model="editForm.summary" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule); min-height: 80px" />
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="mono-data text-xs block mb-1">热度 ({{ editForm.heat }})</label>
              <input v-model.number="editForm.heat" type="range" min="0" max="100" class="w-full" />
            </div>
            <div class="flex items-end gap-2 pb-2">
              <label class="mono-data text-xs">头条</label>
              <input v-model="editForm.critical" type="checkbox" />
            </div>
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">综合点评</label>
            <textarea v-model="editForm.trendComment" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule); min-height: 60px" />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button class="px-4 py-2 text-sm" style="background: var(--paper-2)" @click="editTarget = null">取消</button>
          <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
