<script setup lang="ts">
/**
 * AppTopbar — Workbench 顶栏（扁平 surface）。
 * 品牌 + 运行状态 pill + 主题/导出 icon 按钮。
 */
import { Sun, Moon, Download } from "@lucide/vue";
import type { Conversation } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";

defineProps<{
  currentConv: Conversation | null;
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  elapsed: string;
}>();

const emit = defineEmits<{ abort: [] }>();
const { theme, toggle } = useTheme();
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-logo">A</div>
      <div class="brand-name">AI-<span>Insight</span></div>
      <span class="brand-sub">· Workbench</span>
    </div>

    <div class="spacer"></div>

    <div class="status-pill" v-if="status !== 'idle'">
      <span v-if="status === 'running'" class="status-dot run"></span>
      <span v-else-if="status === 'awaiting_input'" class="status-dot" style="background: var(--amber)"></span>
      <span v-else-if="status === 'completed'" class="status-dot" style="background: var(--green)"></span>
      <span v-else-if="status === 'failed'" class="status-dot" style="background: var(--rose)"></span>
      <template v-if="status === 'running'">正在分析<span class="dim">· {{ elapsed }}</span></template>
      <template v-else-if="status === 'awaiting_input'">等待回复<span class="dim">· {{ elapsed }}</span></template>
      <template v-else-if="status === 'completed'">已完成</template>
      <template v-else-if="status === 'failed'">失败</template>
    </div>

    <button class="ghost-btn abort" v-if="status === 'running' || status === 'awaiting_input'" @click="emit('abort')">
      <span class="dot" style="background: var(--rose)"></span>中止
    </button>

    <button class="icon-btn theme-toggle" @click="toggle($event)" :title="theme === 'dark' ? '切换到浅色 (⌘J)' : '切换到深色 (⌘J)'"><Moon v-if="theme === 'dark'" :size="16" :stroke-width="1.8" /><Sun v-else :size="16" :stroke-width="1.8" /></button>
    <button class="icon-btn" title="导出"><Download :size="16" :stroke-width="1.8" /></button>
  </header>
</template>

<style scoped>
.topbar {
  grid-column: 1 / -1;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--surface-3); border: 1px solid var(--border);
  display: grid; place-items: center;
  color: var(--text); font-weight: 700; font-size: 15px;
}
.brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
.brand-name span { color: var(--accent); }
.brand-sub { font-size: 11px; color: var(--text-3); font-weight: 500; margin-left: 2px; }
.spacer { flex: 1; }

.status-pill {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 12px; border-radius: var(--r-pill);
  background: var(--surface-2); border: 1px solid var(--border);
  font-size: 11.5px; font-weight: 500; color: var(--text-2);
}
.status-pill .dim { color: var(--text-3); font-weight: 500; margin-left: 2px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); position: relative; flex: none; }
.status-dot.run::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid var(--green); opacity: 0.5;
  animation: ping 1.8s ease-out infinite;
}

.abort { color: var(--rose); border-color: var(--rose-line); }
.abort:hover { background: var(--rose-soft); border-color: var(--rose); color: var(--rose); }
.theme-toggle:hover { color: var(--accent); border-color: var(--accent); }
</style>
