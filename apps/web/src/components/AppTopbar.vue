<script setup lang="ts">
/**
 * AppTopbar — Workbench 顶栏（扁平 surface）。
 * 品牌 + 运行状态 pill + 主题/导出 icon 按钮。
 */
import { Sun, Moon, Download } from "@lucide/vue";
import type { Conversation } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";
import BrandMark from "./BrandMark.vue";

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
      <!-- unslop-ignore: 品牌 mark = 翠绿稀缺强调最合理的位置（产品“面貌”） -->
      <div class="brand-logo"><BrandMark :size="18" /></div>
      <div class="brand-name">AI-<span>Insight</span></div>
      <span class="brand-sub">Workbench</span>
    </div>

    <div class="spacer"></div>

    <div class="status-pill" :class="`s-${status}`" v-if="status !== 'idle'">
      <span class="status-dot">
        <span v-if="status === 'running'" class="status-dot-pulse"></span>
      </span>
      <span class="status-text">
        <template v-if="status === 'running'">正在分析</template>
        <template v-else-if="status === 'awaiting_input'">等待回复</template>
        <template v-else-if="status === 'completed'">已完成</template>
        <template v-else-if="status === 'failed'">失败</template>
      </span>
      <span v-if="elapsed && (status === 'running' || status === 'awaiting_input')" class="status-time">{{ elapsed }}</span>
    </div>

    <button class="ghost-btn abort" v-if="status === 'running' || status === 'awaiting_input'" @click="emit('abort')">
      <span class="dot" style="background: var(--rose)"></span>中止
    </button>

    <div class="tool-group">
      <button class="icon-btn theme-toggle" @click="toggle($event)" :title="theme === 'dark' ? '切换到浅色 (⌘J)' : '切换到深色 (⌘J)'"><Moon v-if="theme === 'dark'" :size="16" :stroke-width="1.8" /><Sun v-else :size="16" :stroke-width="1.8" /></button>
      <button class="icon-btn" title="导出"><Download :size="16" :stroke-width="1.8" /></button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  grid-column: 1 / -1;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px 0 16px;
  background: var(--surface);
  /* 底部 1px hairline + 极轻 shadow-sm：把顶栏从内容流“抬”起来一档 */
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  z-index: 5;
}

/* ─── 品牌区 ─────────────────────────────────────────────── */
.brand { display: flex; align-items: center; gap: 10px; padding-right: 6px; }
/* unslop-ignore: 品牌徽标是翠绿稀缺强调最合理的位置——产品“面貌”，非装饰色块 */
.brand-logo {
  width: 32px; height: 32px; border-radius: var(--r-sm);
  background: var(--accent); border: none;
  display: grid; place-items: center;
  color: var(--on-accent);
  /* 极轻内阴影：让实色块有“精加工”的立体边沿，非发光 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}
.brand-name {
  font-size: 15.5px; font-weight: 700; letter-spacing: -0.015em;
  color: var(--text); line-height: 1;
}
.brand-name span { color: var(--accent); }
.brand-sub {
  font-family: var(--mono); font-size: 9.5px; color: var(--text-4);
  font-weight: 600; margin-left: 4px; letter-spacing: 0.16em;
  padding: 3px 7px; border-radius: var(--r-xs);
  background: var(--surface-2); border: 1px solid var(--border);
  text-transform: uppercase; line-height: 1;
}
.spacer { flex: 1; }

/* ─── 状态 pill：更精密的语义色封装 ───────────────────────── */
.status-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 11px 5px 9px; border-radius: var(--r-pill);
  background: var(--surface-2); border: 1px solid var(--border);
  font-size: 11.5px; font-weight: 600; color: var(--text-2);
  font-family: var(--sans); line-height: 1;
}
.status-dot {
  width: 7px; height: 7px; border-radius: 50%; flex: none;
  background: var(--text-4); position: relative;
}
/* 语义色覆盖：按状态上色，配形素（圆点 + 文字），不只用颜色 */
.status-pill.s-running .status-dot { background: var(--green); }
.status-pill.s-awaiting_input .status-dot { background: var(--amber); }
.status-pill.s-completed .status-dot { background: var(--green); }
.status-pill.s-failed .status-dot { background: var(--rose); }

/* running 脉冲环（仪器感：信号在“呼吸”） */
.status-dot-pulse {
  position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid var(--green); opacity: 0.55;
  animation: ping 1.8s var(--ease-out) infinite;
}
.status-text { letter-spacing: 0.005em; }
.status-time {
  font-family: var(--mono); font-size: 11px; color: var(--text-3);
  font-weight: 500; letter-spacing: 0.02em;
  padding-left: 8px; margin-left: 4px;
  border-left: 1px solid var(--border-2);
}

/* ─── 工具按钮组：用分隔线收束成“控件区” ────────────────── */
.tool-group {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 3px; border-radius: var(--r-sm);
  background: var(--surface-2); border: 1px solid var(--border);
}
.tool-group .icon-btn {
  width: 28px; height: 28px; border: none; background: transparent;
  box-shadow: none;
}
.tool-group .icon-btn:hover {
  background: var(--surface-3); color: var(--accent);
  border-color: transparent;
}

.abort { color: var(--rose); border-color: var(--rose-line); }
.abort:hover { background: var(--rose-soft); border-color: var(--rose); color: var(--rose); }
.theme-toggle:hover { color: var(--accent); }
</style>

