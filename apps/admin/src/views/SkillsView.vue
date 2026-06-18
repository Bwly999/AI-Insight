<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { EmptyState } from '@ai-insight/shared-ui';
import { listSkills, createSkill, enableSkill, disableSkill } from '../api/skills';

const skills = ref<any[]>([]);
const loading = ref(false);
const showUpload = ref(false);
const toast = ref<string | null>(null);

const form = ref({
  name: '',
  version: '1.0.0',
  frontmatter: '',
  bodyMd: '',
  auditNote: '',
});

async function fetch() {
  loading.value = true;
  try {
    const res = await listSkills();
    skills.value = res.data ?? [];
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

async function doEnable(skill: any) {
  try {
    await enableSkill(skill.name, skill.version);
    showToast('已启用');
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '操作失败');
  }
}

async function doDisable(name: string) {
  try {
    await disableSkill(name);
    showToast('已禁用');
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '操作失败');
  }
}

async function upload() {
  try {
    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = JSON.parse(form.value.frontmatter || '{}');
    } catch {
      showToast('frontmatter 必须是有效 JSON');
      return;
    }

    await createSkill({
      name: form.value.name,
      version: form.value.version,
      frontmatter,
      bodyMd: form.value.bodyMd,
      auditNote: form.value.auditNote,
    });
    showToast('已上传');
    showUpload.value = false;
    await fetch();
  } catch (err: any) {
    showToast(err?.response?.data?.message ?? '上传失败');
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
      <div>
        <h2 class="metric-num text-2xl">Skill 管理 · SKILLS</h2>
        <p class="mono-data opacity-50 text-sm mt-1">管理 Agent 的技能版本</p>
      </div>
      <button class="px-4 py-2 text-sm" style="background: var(--vermillion); color: var(--paper)" @click="showUpload = true">
        + 上传新版
      </button>
    </div>

    <div v-if="toast" class="fixed top-4 right-4 z-50 admin-card px-5 py-3 text-sm" style="border-color: var(--forest)">
      {{ toast }}
    </div>

    <div v-if="!loading && skills.length === 0" class="admin-card p-8">
      <EmptyState title="— 暂无 Skill —" hint="上传第一个 skill 版本" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="s in skills" :key="s.id" class="admin-card p-4 flex items-center gap-4">
        <span class="dot" :class="s.enabled ? 'dot--success' : 'dot--warning'" />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="metric-num text-base">{{ s.name }}</span>
            <span class="mono-data text-xs">@{{ s.version }}</span>
          </div>
          <p class="mono-data text-xs opacity-50">{{ s.auditNote }}</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button v-if="!s.enabled" class="px-3 py-1.5 rounded-sm" style="background: var(--forest); color: var(--paper)" @click="doEnable(s)">
            启用
          </button>
          <button v-else class="px-3 py-1.5 rounded-sm" style="background: var(--paper-2)" @click="doDisable(s.name)">
            禁用
          </button>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUpload" class="fixed inset-0 z-40 flex items-center justify-center" style="background: rgba(0,0,0,0.6)">
      <div class="admin-card p-6 w-full max-w-2xl max-h-[85vh] overflow-auto">
        <h3 class="metric-num text-lg mb-4">上传新版 Skill</h3>
        <div class="space-y-4">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="mono-data text-xs block mb-1">名称</label>
              <input v-model="form.name" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="lens-deep-insight" />
            </div>
            <div class="w-24">
              <label class="mono-data text-xs block mb-1">版本</label>
              <input v-model="form.version" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="1.0.0" />
            </div>
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">Frontmatter (JSON)</label>
            <textarea v-model="form.frontmatter" class="w-full px-3 py-2 text-sm font-mono" style="background: var(--paper); border: 1px solid var(--rule); min-height: 80px" placeholder='{"tools":["collect","finalize"]}' />
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">Body (Markdown)</label>
            <textarea v-model="form.bodyMd" class="w-full px-3 py-2 text-sm font-mono" style="background: var(--paper); border: 1px solid var(--rule); min-height: 120px" placeholder="# skill body..." />
          </div>
          <div>
            <label class="mono-data text-xs block mb-1">改动说明 *</label>
            <textarea v-model="form.auditNote" class="w-full px-3 py-2 text-sm" style="background: var(--paper); border: 1px solid var(--rule)" placeholder="本次改动的理由" />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button class="px-4 py-2 text-sm" style="background: var(--paper-2)" @click="showUpload = false">取消</button>
          <button class="px-4 py-2 text-sm" style="background: var(--forest); color: var(--paper)" @click="upload">上传</button>
        </div>
      </div>
    </div>
  </div>
</template>
