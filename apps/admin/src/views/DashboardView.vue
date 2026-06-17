<script setup lang="ts">
/**
 * 仪表盘（Phase 0 占位）。
 * 见 doc/design-doc/15-UIUX设计.md §15.3.6（仪表盘）。
 * Phase 5 落地真实指标（采集/处理/推送状态、队列健康、最近错误）。
 */
import { ref } from 'vue';

const stats = ref([
  { label: '今日采集', value: '0', color: 'var(--mustard)' },
  { label: '待处理', value: '0', color: 'var(--cobalt)' },
  { label: '本期报告', value: '0', color: 'var(--forest)' },
  { label: '推送成功率', value: '—', color: 'var(--vermillion)' },
]);

const queues = ref([
  { name: 'collection', state: 'idle' },
  { name: 'processing', state: 'idle' },
  { name: 'report', state: 'idle' },
  { name: 'delivery', state: 'idle' },
]);
</script>

<template>
  <div class="space-y-8">
    <!-- 关键指标卡 -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="s in stats" :key="s.label" class="admin-card p-5">
        <p class="text-xs uppercase tracking-widest opacity-60 mono-data">{{ s.label }}</p>
        <p class="metric-num text-4xl mt-2" :style="{ color: s.color }">{{ s.value }}</p>
      </div>
    </section>

    <!-- 队列健康 -->
    <section>
      <h2 class="metric-num text-xl mb-3">队列健康</h2>
      <div class="admin-card p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="q in queues" :key="q.name" class="flex items-center gap-2">
          <span class="dot dot--success" />
          <span class="mono-data">{{ q.name }}-queue</span>
          <span class="ml-auto mono-data opacity-50">{{ q.state }}</span>
        </div>
      </div>
    </section>

    <!-- 最近错误（占位） -->
    <section>
      <h2 class="metric-num text-xl mb-3">最近错误</h2>
      <div class="admin-card p-6">
        <p class="mono-data opacity-50 text-center">— 暂无错误（Phase 5 接入日志聚合）—</p>
      </div>
    </section>
  </div>
</template>
