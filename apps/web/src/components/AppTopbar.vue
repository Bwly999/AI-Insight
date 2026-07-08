<script setup lang="ts">
/**
 * AppTopbar — Workbench V2 顶栏（情报台三段式）。
 * 左：品牌（BrandMark + 名称 + tag）/ 中：面包屑 / 右：遥测条 + 中止 + 工具组。
 * 顶栏高度 64px（承载遥测密度），backdrop-filter 仪器感。
 *
 * 遥测条（TelemetryStrip 内联）：4 cell（状态/耗时/来源/词元），状态 cell 带 live 脉冲点。
 * 中止仅在 running/awaiting_input 显示；工具组：主题切换 + 导出。
 */
import { computed } from "vue";
import { Sun, Moon, Download, Square } from "@lucide/vue";
import type { Conversation } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";
import BrandMark from "./BrandMark.vue";

const props = defineProps<{
  currentConv: Conversation | null;
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  elapsed: string;
  /** 本轮引用来源数（遥测"来源"cell）；null 时显示 —。 */
  sourceCount?: number | null;
  /** 词元用量估算（遥测"词元"cell）；null 时显示 —。 */
  tokenCount?: string | null;
}>();

const emit = defineEmits<{ abort: [] }>();
const { theme, toggle } = useTheme();

const isRunning = computed(() => props.status === "running");
const isLive = computed(() => props.status === "running" || props.status === "awaiting_input");

// 遥测"状态"cell 文案 + 是否 live 高亮
const statusLabel = computed(() => {
  switch (props.status) {
    case "running": return "分析中";
    case "awaiting_input": return "待回复";
    case "completed": return "已完成";
    case "failed": return "失败";
    default: return "就绪";
  }
});

// 面包屑当前项标题（取当前会话标题，截断）
const crumbTitle = computed(() => {
  const t = props.currentConv?.title;
  if (!t || t === "新洞察") return "新会话";
  return t.length > 20 ? t.slice(0, 20) + "…" : t;
});
</script>

<template>
  <header class="topbar">
    <!-- ─── 左：品牌 ─── -->
    <div class="brand">
      <!-- unslop-ignore: 品牌 mark = 柠绿稀缺强调最合理的位置（产品"面貌"），配 glow-md 信号发光 -->
      <div class="brand-logo"><BrandMark :size="18" /></div>
      <div class="brand-name">AI<span class="dot">·</span>洞察</div>
      <span class="brand-tag">/ 洞察引擎</span>
    </div>

    <!-- ─── 中：面包屑 ─── -->
    <div class="crumb-wrap">
      <nav class="crumb" aria-label="面包屑">
        <span class="cr">工作台</span>
        <span class="csep">/</span>
        <span class="cr">会话</span>
        <span class="csep">/</span>
        <span class="cr cur" :title="currentConv?.title">
          <span class="cr-txt">{{ crumbTitle }}</span>
        </span>
      </nav>
    </div>

    <!-- ─── 右：遥测条 + 操作 ─── -->
    <div class="hdr-right">
      <!-- 遥测条：4 cell，仅在有会话时显示 -->
      <div v-if="currentConv" class="tel" aria-label="运行遥测">
        <div class="cell" :class="{ live: isLive }">
          <span class="ck">状态</span>
          <span class="cv" :class="{ acc: isLive }">{{ statusLabel }}</span>
        </div>
        <div class="cell">
          <span class="ck">耗时</span>
          <span class="cv">{{ (isLive || status === 'completed') && elapsed ? elapsed : '—' }}</span>
        </div>
        <div class="cell">
          <span class="ck">来源</span>
          <span class="cv">{{ sourceCount != null ? sourceCount : '—' }}</span>
        </div>
        <div class="cell">
          <span class="ck">词元</span>
          <span class="cv">{{ tokenCount ?? '—' }}</span>
        </div>
      </div>

      <!-- 中止按钮（仅运行中/等待回复） -->
      <button v-if="isLive" class="abort-btn" type="button" @click="emit('abort')">
        <Square :size="12" :stroke-width="2.5" />
        <span>中止</span>
      </button>

      <!-- 工具组 -->
      <div class="tool-group">
        <button
          class="tb"
          type="button"
          @click="toggle($event)"
          :title="theme === 'dark' ? '切换到浅色 (⌘J)' : '切换到深色 (⌘J)'">
          <Moon v-if="theme === 'dark'" :size="15" :stroke-width="1.8" />
          <Sun v-else :size="15" :stroke-width="1.8" />
        </button>
        <button class="tb" type="button" title="导出">
          <Download :size="15" :stroke-width="1.8" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  grid-column: 1 / -1;
  height: 64px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  gap: 0;
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: 10;
}

/* ─── 左：品牌 ─── */
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  height: 100%;
  border-right: 1px solid var(--border);
}
/* unslop-ignore: 品牌徽标是柠绿稀缺强调最合理的位置——产品"面貌"，配 glow-md 信号发光 */
.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  display: grid;
  place-items: center;
  color: var(--on-accent);
  box-shadow: var(--glow-md); /* 信号发光：品牌 mark 是产品"面貌" */
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--text);
}
.brand-name .dot {
  color: var(--accent);
  margin: 0 1px;
}
.brand-tag {
  font-family: var(--mono);
  font-size: 9.5px;
  color: var(--text-4);
  font-weight: 600;
  letter-spacing: 0.16em;
  margin-left: 6px;
  text-transform: uppercase;
}

/* ─── 中：面包屑 ─── */
.crumb-wrap {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  min-width: 0;
}
.crumb {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 13px;
  min-width: 0;
}
.cr {
  padding: 5px 9px;
  border-radius: var(--r-xs);
  color: var(--text-4);
  cursor: pointer;
  transition: var(--t-fast);
  position: relative;
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cr:hover {
  color: var(--text-2);
  background: var(--accent-soft);
}
.cr.cur {
  color: var(--accent-text);
  font-weight: 600;
  cursor: default;
}
.cr.cur:hover {
  background: transparent;
}
/* 当前项底部柠绿下划线 + glow-sm（信号锚点：你在哪） */
.cr.cur::after {
  content: "";
  position: absolute;
  left: 9px;
  right: 9px;
  bottom: 1px;
  height: 1.5px;
  background: var(--accent);
  box-shadow: var(--glow-sm);
  border-radius: 1px;
}
.cr-txt {
  display: inline-block;
}
.csep {
  color: var(--text-4);
  font-family: var(--mono);
  font-size: 11px;
  padding: 0 1px;
}

/* ─── 右：遥测 + 操作 ─── */
.hdr-right {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 16px 0 0;
  height: 100%;
}

/* 遥测条 */
.tel {
  display: inline-flex;
  align-items: stretch;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  backdrop-filter: blur(8px);
  overflow: hidden;
  margin-right: 12px;
}
.cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 0 15px;
  min-width: 78px;
  border-right: 1px solid var(--border);
  position: relative;
}
.cell:last-child {
  border-right: none;
}
/* live cell：柠绿 soft 底 + 脉冲点 */
.cell.live {
  background: linear-gradient(180deg, var(--accent-soft), transparent);
}
.cell.live::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: var(--glow-dot); /* 信号发光：live 脉冲点 */
  animation: cell-pulse 1.6s ease-in-out infinite;
}
@keyframes cell-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.ck {
  font-family: var(--sans);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--text-4);
  text-transform: uppercase;
}
.cell.live .ck {
  color: var(--accent-text);
}
.cv {
  font-family: var(--mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  line-height: 1;
  font-feature-settings: "zero";
}
.cv.acc {
  color: var(--accent-text);
}

/* 中止按钮 */
.abort-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: var(--t-fast);
  background: var(--rose-soft);
  border: 1px solid var(--rose-line);
  color: var(--rose);
  font-size: 12px;
  font-weight: 600;
}
.abort-btn:hover {
  border-color: var(--rose);
  background: color-mix(in srgb, var(--rose) 15%, transparent);
}

/* 工具组 */
.tool-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  border: 1px solid var(--border);
  margin-left: 10px;
}
.tb {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--r-xs);
  display: grid;
  place-items: center;
  color: var(--text-3);
  cursor: pointer;
  transition: var(--t-fast);
}
.tb:hover {
  background: var(--surface-3);
  color: var(--accent);
}

@media (max-width: 1080px) {
  .crumb-wrap { display: none; }
}
@media (max-width: 880px) {
  .tel .cell:nth-child(n+3) { display: none; } /* 小屏只显状态+耗时 */
  .brand-tag { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .cell.live::before { animation: none; }
}
</style>
