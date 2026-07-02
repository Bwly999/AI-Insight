<script setup lang="ts">
/**
 * RunStream — 运行中实时流（Workbench 风格）。
 * AI 头像 + lens eyebrow + 可折叠思考块（spark 动画）+ 可折叠工具卡（状态色左边框）+ 实时文本。
 */
import { computed, ref } from "vue";
import { LENS_OPTIONS, type LensKey } from "@ai-insight/shared-types";
import type { ToolCallState } from "./types";
import { toolLabel, toolArgsPreview } from "./types";

const props = defineProps<{
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  assistantText: string;
  thinking: string[];
  toolCalls: ToolCallState[];
  lens: LensKey | null;
}>();

const show = computed(() => props.status === "running" || props.status === "awaiting_input" || !!props.assistantText || props.toolCalls.length > 0);
const thinkingFull = computed(() => props.thinking.join(""));
const lensLabel = computed(() => (props.lens ? LENS_OPTIONS.find((l) => l.key === props.lens)?.label : undefined));

// 思考块折叠态：运行中默认展开，完成/失败后默认收起
const thinkOpen = ref(props.status === "running");
// 每个工具卡的折叠态（默认收起，仅 running 态的展开）
const toolOpenMap = ref<Record<string, boolean>>({});
function toggleTool(id: string) {
  toolOpenMap.value[id] = !toolOpenMap.value[id];
}

function toolStatusClass(c: ToolCallState): string {
  if (c.ok === false) return "fail";
  if (c.ok === true || c.found != null) return "ok";
  return "running";
}
</script>

<template>
  <div v-if="show" class="turn ai fade-up">
    <div class="ai-ava">
      <span v-if="status === 'running' || status === 'awaiting_input'" class="ring" style="width: 15px; height: 15px"></span>
      <template v-else>A</template>
    </div>
    <div class="ai-body">
      <div class="ai-eb">
        AI-Insight
        <span v-if="lens" class="lens">{{ lensLabel ?? lens }}</span>
      </div>

      <!-- 思考块（可折叠） -->
      <div v-if="thinking.length" class="think" :class="{ open: thinkOpen }">
        <div class="think-head" @click="thinkOpen = !thinkOpen">
          <svg class="th-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6a4 4 0 014 4v10l-4-3H9a4 4 0 01-4-4V7a4 4 0 014-4z" /></svg>
          <span class="th-label">思考过程</span>
          <span class="th-spark" v-if="status === 'running'"></span>
          <span class="th-toggle">{{ thinkOpen ? '▾ 展开' : '▸ 展开' }}</span>
        </div>
        <div class="think-body">{{ thinkingFull }}</div>
      </div>

      <!-- 工具卡（可折叠，状态色左边框） -->
      <div v-if="toolCalls.length" class="tools">
        <div v-for="c in toolCalls" :key="c.toolCallId" class="tool" :class="[toolStatusClass(c), { open: !!toolOpenMap[c.toolCallId] }]">
          <div class="tool-head" @click="toggleTool(c.toolCallId)">
            <span class="tool-name">{{ toolLabel(c.toolName) }}</span>
            <span class="tool-args">{{ toolArgsPreview(c.args) }}</span>
            <span v-if="c.ok === true || c.found != null" class="tool-status ok">✓ {{ c.found ?? '' }}条<span v-if="c.durationMs"> · {{ (c.durationMs / 1000).toFixed(1) }}s</span></span>
            <span v-else-if="c.ok === false" class="tool-status fail">✕ 失败</span>
            <span v-else class="tool-status running"><span class="spin">◐</span> 运行中</span>
          </div>
          <div v-if="c.found != null" class="tool-body">
            命中 <b>{{ c.found }}</b> 条信号{{ c.durationMs ? `，耗时 ${(c.durationMs / 1000).toFixed(1)}s` : '' }}。
          </div>
        </div>
      </div>

      <!-- 实时文本 -->
      <div v-if="assistantText" class="md" v-html="assistantText"></div>

      <!-- 流式指示 -->
      <div v-if="status === 'running' && !assistantText" class="writing">
        <span class="wd"></span> 正在生成
      </div>
    </div>
  </div>
</template>

<style scoped>
.turn.ai { display: flex; gap: 13px; }
.ai-ava {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  background: var(--surface-3); color: var(--text);
  display: grid; place-items: center;
  font-weight: 700; font-size: 13px;
  border: 1px solid var(--border);
}
.ai-body { flex: 1; min-width: 0; }
.ai-eb { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; display: flex; align-items: center; gap: 7px; }
.ai-eb .lens {
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;
  background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border);
}

/* 思考块 */
.think {
  margin: 6px 0 12px; border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; background: var(--surface);
}
.think-head { display: flex; align-items: center; gap: 9px; padding: 9px 13px; cursor: pointer; user-select: none; }
.th-label { font-size: 12px; font-weight: 600; color: var(--text-3); display: flex; align-items: center; gap: 6px; }
.th-ico { width: 15px; height: 15px; color: var(--text-3); }
.th-spark {
  flex: 1; height: 2px; border-radius: 1px;
  background: linear-gradient(90deg, transparent, var(--border-2) 30%, var(--border-2) 70%, transparent);
  background-size: 200% 100%; animation: spark 2.4s linear infinite; opacity: 0.6;
}
.th-toggle { font-size: 11px; font-weight: 500; color: var(--text-3); }
.think-body {
  padding: 0 14px 13px; font-size: 13px; line-height: 1.7; color: var(--text-3);
  border-top: 1px solid var(--border); display: none; white-space: pre-wrap;
}
.think.open .think-body { display: block; }

/* 工具卡 */
.tools { display: flex; flex-direction: column; gap: 9px; margin: 9px 0; }
.tool {
  border: 1px solid var(--border); border-left: 2px solid var(--border-2);
  border-radius: 9px; overflow: hidden; background: var(--surface);
}
.tool.running { border-left-color: var(--amber); }
.tool.ok { border-left-color: var(--green); }
.tool.fail { border-left-color: var(--rose); }
.tool-head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; }
.tool-name { font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text); }
.tool-args {
  font-family: var(--mono); font-size: 11px; color: var(--text-3); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tool-status {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
  letter-spacing: 0.02em; font-family: var(--mono); white-space: nowrap;
}
.tool-status.ok { background: var(--green-soft); color: var(--green); }
.tool-status.fail { background: var(--rose-soft); color: var(--rose); }
.tool-status.running { background: var(--amber-soft); color: var(--amber); }
.tool-status .spin { display: inline-block; animation: spin 1s linear infinite; }
.tool-body {
  padding: 0 12px 11px; font-size: 12px; color: var(--text-2); display: none; line-height: 1.6;
}
.tool-body b { font-family: var(--mono); color: var(--green); }
.tool.open .tool-body { display: block; }

/* 流式指示 */
.writing { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-3); font-weight: 500; margin-top: 6px; }
.writing .wd { width: 6px; height: 6px; border-radius: 50%; background: var(--text-4); animation: wd-blink 1.2s ease-in-out infinite; }
</style>
