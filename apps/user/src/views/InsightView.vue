<script setup lang="ts">
import { ref } from 'vue';
import { createInsightSession } from '../api/insight';

const intent = ref('');
const running = ref(false);
const events = ref<string[]>([]);
const sessionId = ref<number | null>(null);
const reportMarkdown = ref<string | null>(null);
const usedTokens = ref(0);
const maxTokens = ref(60000);

async function startInsight() {
  if (!intent.value.trim() || running.value) return;

  running.value = true;
  events.value = [];
  reportMarkdown.value = null;

  try {
    const response = await fetch('/api/insight/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: intent.value,
        skillSet: ['lens-deep-insight'],
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7);
          // next line is data
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'session') {
              sessionId.value = data.sessionId;
            } else if (data.type === 'step' && data.content) {
              events.value.push(`[${data.role}] ${data.content}`);
            } else if (data.type === 'tool_call') {
              events.value.push(`🔧 调用工具: ${data.toolName}`);
            } else if (data.type === 'tool_result') {
              events.value.push(`✅ 工具返回: ${JSON.stringify(data.toolResult).slice(0, 100)}...`);
            } else if (data.type === 'final') {
              reportMarkdown.value = data.content || data.reportMarkdown;
              usedTokens.value = data.usedTokens ?? 0;
            } else if (data.type === 'error') {
              events.value.push(`❌ 错误: ${data.content}`);
            }
          } catch {
            // parse error, skip
          }
        }
      }
    }
  } catch (err: any) {
    events.value.push(`❌ 请求失败: ${err.message}`);
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-12 px-4">
    <h1 class="text-3xl font-serif italic font-semibold mb-2">主动洞察</h1>
    <p class="text-sm opacity-60 mb-8">输入你的研究问题，AI 分析师将调用多个数据源进行综合分析</p>

    <!-- Input -->
    <div class="flex gap-3 mb-8">
      <textarea
        v-model="intent"
        class="flex-1 px-4 py-3 text-sm rounded-sm"
        style="background: var(--paper-2); border: 1px solid var(--rule); min-height: 80px"
        placeholder="例：分析本周 AI 编程工具动态"
        :disabled="running"
      />
      <button
        class="px-6 py-3 text-sm self-end"
        :style="{ background: running ? 'var(--paper-2)' : 'var(--vermillion)', color: running ? '' : '#fff' }"
        :disabled="running"
        @click="startInsight"
      >
        {{ running ? '分析中…' : '开始洞察' }}
      </button>
    </div>

    <!-- Progress bar -->
    <div v-if="running" class="w-full h-1 mb-6 rounded-sm" style="background: var(--paper-2)">
      <div class="h-full rounded-sm animate-pulse" style="width: 60%; background: var(--cobalt)" />
    </div>

    <!-- Events -->
    <div v-if="events.length > 0" class="space-y-2 mb-8">
      <div v-for="(evt, i) in events" :key="i" class="text-sm py-1 px-3 rounded-sm" style="background: var(--paper-2)">
        {{ evt }}
      </div>
    </div>

    <!-- Report -->
    <div v-if="reportMarkdown" class="admin-card p-6">
      <h2 class="metric-num text-xl mb-4">洞察报告</h2>
      <div class="text-sm leading-relaxed whitespace-pre-wrap" v-html="reportMarkdown.replace(/\n/g, '<br/>')" />
      <div class="mt-4 pt-4 mono-data text-xs opacity-50" style="border-top: 1px solid var(--rule)">
        消耗 tokens: {{ Math.round(usedTokens / 1000) }}k
      </div>
    </div>
  </div>
</template>
