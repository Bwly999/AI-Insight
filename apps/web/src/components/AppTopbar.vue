<script setup lang="ts">
/**
 * AppTopbar — 情报台顶栏。
 * 玻璃拟态半透明底 + 发光品牌标 + 运行状态(信号青发光) + 主题切换。
 */
import type { Ref } from "vue";
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
      <div class="brand-mark">洞</div>
      <span class="brand-name">AI-Insight</span>
      <span class="brand-tag mono">SIGNAL OBSERVATORY</span>
    </div>

    <span class="crumb-sep">/</span>
    <span class="crumb">会话</span>
    <span class="crumb-sep">/</span>
    <span class="crumb crumb-cur">{{ currentConv?.title ?? "新洞察" }}</span>

    <div class="status-wrap" v-if="status !== 'idle'">
      <span v-if="status === 'running'" class="run-pill running">
        <span class="dot pulse"></span>RUNNING<span class="mono dim">· {{ elapsed }}</span>
      </span>
      <span v-else-if="status === 'awaiting_input'" class="run-pill awaiting">
        <span class="dot pulse"></span>等待回复<span class="mono dim">· {{ elapsed }}</span>
      </span>
      <span v-else-if="status === 'completed'" class="run-pill done">
        <span class="dot"></span>COMPLETED
      </span>
      <span v-else-if="status === 'failed'" class="run-pill failed">
        <span class="dot"></span>FAILED
      </span>
    </div>

    <div class="right">
      <button class="ghost-btn abort" v-if="status === 'running' || status === 'awaiting_input'" @click="emit('abort')">
        <span class="dot" style="background: var(--rose)"></span>中止运行
      </button>

      <button class="theme-toggle icon-btn" @click="toggle" :title="theme === 'dark' ? '切换到浅色' : '切换到深色'">
        <!-- 太阳（深色时显示，点击转浅） -->
        <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <!-- 月亮（浅色时显示，点击转深） -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <div class="u-ava" title="WL">WL</div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  background: var(--glass);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid var(--glass-border);
  z-index: 20;
}
.brand { display: flex; align-items: center; gap: 9px; }
.brand-mark {
  width: 28px; height: 28px; border-radius: var(--r-sm);
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  display: flex; align-items: center; justify-content: center;
  color: #04111a; font-weight: 700; font-size: 14px;
  box-shadow: 0 0 14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.brand-name { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; color: var(--ink); }
.brand-tag { font-size: 9px; color: var(--brand); letter-spacing: 0.18em; padding: 2px 6px; border: 1px solid var(--brand-line); border-radius: var(--r-xs); }
.crumb-sep { color: var(--ink-4); }
.crumb { font-size: 13px; color: var(--ink-2); }
.crumb-cur { color: var(--ink); font-weight: 500; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.status-wrap { display: flex; align-items: center; gap: 8px; margin-left: 4px; }
.run-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 4px 11px 4px 9px; border-radius: var(--r-pill);
  font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
}
.run-pill .dim { color: inherit; opacity: 0.6; font-weight: 500; }
.run-pill.running {
  background: var(--brand-soft); color: var(--brand); border: 1px solid var(--brand-line);
  box-shadow: 0 0 14px -4px var(--brand-glow);
}
.run-pill.running .dot { background: var(--brand); box-shadow: 0 0 8px var(--brand-glow); }
.run-pill.awaiting {
  background: var(--amber-soft); color: var(--amber); border: 1px solid var(--amber-line);
  box-shadow: 0 0 14px -4px var(--amber);
}
.run-pill.awaiting .dot { background: var(--amber); box-shadow: 0 0 8px var(--amber); }
.run-pill.done { background: var(--green-soft); color: var(--green); border: 1px solid var(--green-line); }
.run-pill.done .dot { background: var(--green); }
.run-pill.failed { background: var(--rose-soft); color: var(--rose); border: 1px solid var(--rose); }
.run-pill.failed .dot { background: var(--rose); }

.right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.abort { color: var(--rose); border-color: var(--rose); }
.abort:hover { background: var(--rose-soft); }
.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }
.u-ava {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--surface-3); display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--ink-2); border: 1px solid var(--line);
}
</style>
