<script setup lang="ts">
/**
 * MessageBlocks — 按 kind 顺序渲染一个 assistant turn 的有序 blocks。
 * 实时流（RunStream）与历史回看（MessageList）共用本组件。
 *
 *   thinking → 可折叠思考卡（Brain 图标 + 紫调 + 时长 tag，running 时 spark 动画 & 时长跳动）
 *   text     → 轻量 markdown 渲染
 *   tool     → 工具卡（lucide 图标 + 信号色左边框，结果默认展开 + 高度/字数限制）
 *
 * 图标统一使用 @lucide/vue（lucide-vue-next 已废弃）。
 */
import { computed, onUnmounted, ref, watch, type Component } from "vue";
import {
  Brain,
  Search,
  Rss,
  Bug,
  FileText,
  Newspaper,
  Database,
  CircleQuestionMark,
  Wrench,
  ChevronDown,
  Clock,
  Check,
  X,
  Loader,
} from "@lucide/vue";
import type { Block, ThinkingBlock, ToolBlock } from "../composables/blocks";
import { toolLabel, toolArgsPreview, toolColor } from "./types";
import { mdToHtml } from "../utils/markdown";

const props = withDefaults(
  defineProps<{
    blocks: Block[];
    /** 是否正在流式输出（影响思考卡 spark 动画与时长跳动）。 */
    streaming?: boolean;
    /** 思考卡默认是否展开（默认 false；实时流可传 true）。 */
    defaultThinkOpen?: boolean;
  }>(),
  { streaming: false, defaultThinkOpen: false },
);

/** 工具结果正文最多保留的字符数，超出部分截断提示。 */
const TOOL_RESULT_MAX_CHARS = 4000;

// 每个 block 的折叠态（思考卡 / 工具卡）
const thinkOpen = ref<Record<string, boolean>>({});
// 工具卡默认展开（null = 未操作 = 默认展开）
const toolOpen = ref<Record<string, boolean | null>>({});

function ensureThink(id: string): boolean {
  if (thinkOpen.value[id] == null) thinkOpen.value[id] = props.streaming || props.defaultThinkOpen;
  return thinkOpen.value[id];
}
function toggleThink(id: string) {
  thinkOpen.value[id] = !ensureThink(id);
}
/** 工具卡：未操作过默认展开，点击切换。 */
function isToolOpen(id: string): boolean {
  const v = toolOpen.value[id];
  return v == null ? true : v;
}
function toggleTool(id: string) {
  toolOpen.value[id] = !isToolOpen(id);
}

// streaming 结束后，让仍在"默认展开"但用户没手动操作过的思考卡自动收起
watch(
  () => props.streaming,
  (s) => {
    if (!s) {
      for (const b of props.blocks) {
        if (b.kind === "thinking" && thinkOpen.value[b.id] == null) thinkOpen.value[b.id] = false;
      }
    }
  },
);

// ─── 思考时长跳动（streaming 时 1s tick，驱动"正在思考 X.Xs"实时刷新）──────────
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | null = null;
watch(
  () => props.streaming,
  (s) => {
    if (s && !tickTimer) {
      tickTimer = setInterval(() => (now.value = Date.now()), 500);
    } else if (!s && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  },
  { immediate: true },
);
onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});

/** 格式化思考时长：封口后用 durationMs，思考中用 startedAt → now。 */
function thinkSeconds(b: ThinkingBlock): number {
  if (b.durationMs != null) return b.durationMs / 1000;
  if (b.startedAt != null) return (now.value - b.startedAt) / 1000;
  return 0;
}
/** 思考块是否处于"正在思考"（用于驱动跳动指示）。 */
function isThinking(b: ThinkingBlock): boolean {
  return props.streaming && b.startedAt != null && b.durationMs == null;
}
function fmtDuration(sec: number): string {
  return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
}

// ─── 工具卡 ──────────────────────────────────────────────────────────────
function toolStatusKey(c: ToolBlock): "running" | "ok" | "fail" {
  if (c.ok === false) return "fail";
  if (c.ok === true || c.found != null) return "ok";
  return "running";
}

/** 按工具名选 lucide 图标组件（与 toolLabel/toolColor 的工具名一致）。 */
function toolIcon(toolName: string): Component {
  const t = toolName.toLowerCase();
  switch (t) {
    case "search":
      return Search;
    case "fetch_rss":
    case "rss":
      return Rss;
    case "crawl":
      return Bug;
    case "extract_content":
    case "read":
      return FileText;
    case "save_report":
      return Newspaper;
    case "list_datasources":
      return Database;
    case "ask":
      return CircleQuestionMark;
    default:
      return Wrench; // 兜底：通用工具
  }
}

/** 工具结果正文（查询条数 + 已截断提示）。超 4000 字截断。 */
const toolBodyCache = new WeakMap<ToolBlock, { text: string; truncated: boolean }>();
function toolBody(b: ToolBlock): { text: string; truncated: boolean } {
  const cached = toolBodyCache.get(b);
  if (cached) return cached;
  const parts: string[] = [];
  if (b.found != null) parts.push(`查询到 ${b.found} 条数据`);
  if (b.durationMs != null) parts.push(`耗时 ${(b.durationMs / 1000).toFixed(1)}s`);
  const summary = parts.join("，");
  // args 里若有较长的 query/keywords 作为预览正文
  const argsText = toolArgsPreview(b.args);
  let raw = summary;
  if (argsText && argsText.length > 3) raw += (raw ? "\n\n" : "") + `查询：${argsText}`;
  const truncated = raw.length > TOOL_RESULT_MAX_CHARS;
  const text = truncated ? raw.slice(0, TOOL_RESULT_MAX_CHARS) : raw;
  const result = { text, truncated };
  toolBodyCache.set(b, result);
  return result;
}

const hasContent = computed(() => props.blocks.length > 0);
</script>

<template>
  <div v-if="hasContent" class="blocks">
    <template v-for="b in blocks" :key="b.id">
      <!-- 思考卡（Brain 图标 + 紫调 + 时长 tag，可折叠） -->
      <div v-if="b.kind === 'thinking'" class="think" :class="{ open: ensureThink(b.id), live: isThinking(b) }">
        <div class="think-head" @click="toggleThink(b.id)">
          <Brain :size="16" :stroke-width="1.8" class="th-ico" />
          <span class="th-label">思考过程</span>
          <span class="th-spark" v-if="isThinking(b)"></span>
          <span class="th-right">
            <span class="th-dur" :class="{ live: isThinking(b) }">
              <Clock :size="11" :stroke-width="2" class="th-dur-ico" />
              {{ fmtDuration(thinkSeconds(b)) }}
            </span>
            <ChevronDown :size="15" :stroke-width="2" class="chev" :class="{ open: ensureThink(b.id) }" />
          </span>
        </div>
        <div class="think-body">{{ b.text }}</div>
      </div>

      <!-- 回复文本（markdown） -->
      <div v-else-if="b.kind === 'text'" class="md" v-html="mdToHtml(b.text)"></div>

      <!-- 工具卡（lucide 图标 + 信号色左边框；结果默认展开 + 高度/字数限制） -->
      <div
        v-else
        class="tool"
        :class="[toolStatusKey(b), { open: isToolOpen(b.id) }]"
        :style="{ '--tc': toolColor(b.toolName).fg }">
        <div class="tool-head" @click="toggleTool(b.id)">
          <component :is="toolIcon(b.toolName)" :size="15" :stroke-width="1.8" class="tool-ico" />
          <span class="tool-name">{{ toolLabel(b.toolName) }}</span>
          <span class="tool-args">{{ toolArgsPreview(b.args) }}</span>
          <span class="th-right">
            <span v-if="toolStatusKey(b) === 'ok'" class="tool-status ok">
              <Check :size="12" :stroke-width="2.5" /><span v-if="b.found != null"> {{ b.found }} 条</span><span v-if="b.durationMs"> · {{ (b.durationMs / 1000).toFixed(1) }}s</span>
            </span>
            <span v-else-if="toolStatusKey(b) === 'fail'" class="tool-status fail"><X :size="12" :stroke-width="2.5" /> 失败</span>
            <span v-else class="tool-status running"><Loader :size="12" :stroke-width="2.5" class="spin" /> 运行中</span>
            <ChevronDown :size="15" :stroke-width="2" class="chev" :class="{ open: isToolOpen(b.id) }" />
          </span>
        </div>
        <div v-if="toolBody(b).text || toolStatusKey(b) === 'running'" class="tool-body-wrap" :class="{ open: isToolOpen(b.id) }">
          <div class="tool-body">
            <template v-if="toolBody(b).text">{{ toolBody(b).text }}</template>
            <template v-else>正在执行…</template>
          </div>
          <div v-if="toolBody(b).truncated" class="tool-truncated">…结果已截断（超过 {{ TOOL_RESULT_MAX_CHARS }} 字）</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.blocks { display: flex; flex-direction: column; gap: 9px; }

/* ─── 公共：header 右侧容器 + chevron ──────────────────────────────────── */
.th-right { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; flex: none; }
.chev {
  width: 15px; height: 15px; color: var(--text-3); flex: none;
  transition: transform var(--t-fast, .15s); transform: rotate(-90deg);
}
.chev.open { transform: rotate(0deg); }

/* ─── 思考卡（紫调）──────────────────────────────────────────────────── */
.think {
  border: 1px solid var(--border); border-left: 2px solid var(--border-2);
  border-radius: 10px; overflow: hidden; background: var(--surface);
  transition: border-color var(--t-fast, .15s);
}
.think.open { border-left-color: color-mix(in srgb, var(--src-rss) 55%, transparent); }
.think.live { border-left-color: var(--src-rss); }
.think-head {
  display: flex; align-items: center; gap: 9px; padding: 9px 13px;
  cursor: pointer; user-select: none;
}
.th-ico {
  width: 16px; height: 16px; flex: none;
  color: color-mix(in srgb, var(--src-rss) 80%, var(--text-2));
}
.th-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--text-2); display: flex; align-items: center; gap: 6px;
}
.th-spark {
  flex: 1; height: 2px; border-radius: 1px; min-width: 24px;
  background: linear-gradient(90deg, transparent, var(--src-rss) 30%, var(--src-rss) 70%, transparent);
  background-size: 200% 100%; animation: spark 2.4s linear infinite; opacity: 0.5;
}
/* 时长 tag */
.th-dur {
  display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--mono); font-size: 10.5px; font-weight: 600;
  padding: 2px 7px; border-radius: 5px; letter-spacing: 0.02em;
  background: var(--surface-2); color: var(--text-3); white-space: nowrap;
}
.th-dur.live {
  background: color-mix(in srgb, var(--src-rss) 14%, transparent);
  color: var(--src-rss);
}
.th-dur-ico { width: 11px; height: 11px; }
.think.live .th-dur.live { animation: dur-pulse 1s ease-in-out infinite; }
.think-body {
  padding: 10px 14px 13px; font-size: 13px; line-height: 1.75; color: var(--text-3);
  border-top: 1px solid var(--border); display: none; white-space: pre-wrap;
}
.think.open .think-body { display: block; }

/* ─── 工具卡（按工具类型的信号色）────────────────────────────────────── */
.tool {
  --tc: var(--text-3); /* 工具图标色，由内联 --tc 覆盖 */
  position: relative;
  border: 1px solid var(--border); border-left: 2px solid var(--border-2);
  border-radius: 9px; overflow: hidden; background: var(--surface);
  transition: border-color var(--t-fast, .15s);
}
/* 状态色覆盖左边框 */
.tool.running { border-left-color: var(--amber); }
.tool.ok { border-left-color: var(--green); }
.tool.fail { border-left-color: var(--rose); }

.tool-head { display: flex; align-items: center; gap: 9px; padding: 9px 12px; cursor: pointer; }
.tool-ico {
  width: 15px; height: 15px; flex: none;
  color: var(--tc);
}
.tool-name {
  font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text);
  white-space: nowrap;
}
.tool-args {
  font-family: var(--mono); font-size: 11px; color: var(--text-3); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.tool-status {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
  letter-spacing: 0.02em; font-family: var(--mono); white-space: nowrap;
}
.tool-status.ok { background: var(--green-soft); color: var(--green); }
.tool-status.fail { background: var(--rose-soft); color: var(--rose); }
.tool-status.running { background: var(--amber-soft); color: var(--amber); }
.tool-status .spin { display: inline-block; animation: spin 1s linear infinite; }

/* 工具结果：默认展开，最大高度限制 + 滚动；收起时隐藏 */
.tool-body-wrap {
  border-top: 1px solid var(--border);
  max-height: 220px; overflow-y: auto; overscroll-behavior: contain;
}
.tool-body-wrap:not(.open) { display: none; }
.tool-body {
  padding: 9px 12px 11px; font-size: 12px; color: var(--text-2); line-height: 1.6;
  white-space: pre-wrap; word-break: break-word;
}
.tool-truncated {
  padding: 7px 12px 10px; font-size: 11px; color: var(--text-3); font-style: italic;
  border-top: 1px dashed var(--border); background: var(--surface-2);
}
</style>
