<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSessionTrace } from '../api/insight';

const route = useRoute();
const router = useRouter();
const trace = ref<any>(null);
const loading = ref(true);

const sessionId = Number(route.params.id);

async function fetch() {
  loading.value = true;
  try {
    const res = await getSessionTrace(sessionId);
    trace.value = res.data;
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

const budgetPercent = computed(() => {
  if (!trace.value?.session) return 0;
  const s = trace.value.session;
  const max = 60000;
  return Math.min(100, Math.round((s.usedTokens / max) * 100));
});

function statusBadge(s: string) {
  if (s === 'SUCCESS') return { text: '成功', cls: 'dot--success' };
  if (s === 'FAILED') return { text: '失败', cls: 'dot--error' };
  if (s === 'ABORTED') return { text: '中断', cls: 'dot--warning' };
  return { text: '运行中', cls: 'dot--info' };
}

onMounted(fetch);
</script>

<template>
  <div class="space-y-6">
    <button class="mono-data text-sm opacity-60 hover:opacity-100" @click="router.back()">← 返回列表</button>

    <div v-if="loading" class="admin-card p-8 text-center mono-data opacity-50">加载中…</div>

    <template v-if="trace">
      <!-- Session Summary -->
      <div class="admin-card p-6 space-y-3">
        <div class="flex items-center gap-3">
          <h2 class="metric-num text-2xl">会话 #{{ trace.session.id }}</h2>
          <span class="dot" :class="statusBadge(trace.session.status).cls" />
          <span class="mono-data text-sm">{{ statusBadge(trace.session.status).text }}</span>
        </div>
        <p class="text-sm opacity-80">{{ trace.session.intent }}</p>
        <div class="flex gap-6 mono-data text-xs opacity-60">
          <span>{{ trace.session.usedSteps ?? 0 }} 步</span>
          <span>{{ trace.session.usedToolCalls ?? 0 }} 工具调用</span>
          <span>{{ Math.round((trace.session.usedTokens ?? 0) / 1000) }}k tokens</span>
        </div>

        <!-- Budget bar -->
        <div class="w-full h-2 rounded-sm" style="background: var(--paper-2)">
          <div class="h-full rounded-sm transition-all" :style="{ width: budgetPercent + '%', background: 'var(--forest)' }" />
        </div>

        <p v-if="trace.session.error" class="mono-data text-xs" style="color: var(--vermillion)">
          错误: {{ trace.session.error }}
        </p>
      </div>

      <!-- Steps Timeline -->
      <div class="space-y-3">
        <h3 class="metric-num text-lg">思考链 · TRACE</h3>

        <div v-for="step in (trace.steps ?? [])" :key="step.id" class="admin-card p-4 ml-4" style="border-left: 2px solid var(--rule)">
          <div class="flex items-center gap-2 mb-2">
            <span class="mono-data text-xs px-2 py-0.5 rounded-sm" :style="{
              background: step.role === 'ASSISTANT' ? 'var(--cobalt)' : step.role === 'TOOL' ? 'var(--mustard)' : 'var(--paper-2)',
              color: step.role === 'SYSTEM' ? '' : '#fff'
            }">
              #{{ step.stepNo }} {{ step.role }}
            </span>
            <span class="mono-data text-xs opacity-40">{{ step.tokens }}t</span>
          </div>
          <p class="text-sm whitespace-pre-wrap">{{ step.content || '(无内容)' }}</p>
        </div>

        <!-- Tool calls -->
        <div v-if="trace.toolCalls?.length" class="mt-6">
          <h3 class="metric-num text-lg mb-3">工具调用 · TOOL CALLS</h3>
          <div v-for="tc in trace.toolCalls" :key="tc.id" class="admin-card p-3 mb-2 flex items-center gap-3 text-sm">
            <span class="dot" :class="tc.ok ? 'dot--success' : 'dot--error'" />
            <span class="mono-data text-xs font-bold">{{ tc.tool }}</span>
            <span class="mono-data text-xs opacity-50 truncate flex-1">
              {{ tc.args ? JSON.stringify(tc.args).slice(0, 100) : '' }}
            </span>
            <span v-if="tc.durationMs" class="mono-data text-xs opacity-50">{{ tc.durationMs }}ms</span>
          </div>
        </div>

        <!-- Report -->
        <div v-if="trace.session.reportMarkdown" class="admin-card p-6 mt-6">
          <h3 class="metric-num text-lg mb-3">产出报告</h3>
          <div class="text-sm whitespace-pre-wrap" v-html="trace.session.reportMarkdown.replace(/\n/g, '<br/>')" />
        </div>
      </div>
    </template>
  </div>
</template>
