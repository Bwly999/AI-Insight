<script setup lang="ts">
/**
 * RunStream — 运行中实时流：工具调用 timeline + 思考卡(扫描线) + 实时文本(光标)。
 * 深色情报台发光质感的重点载体。
 */
import { computed } from "vue";
import type { ToolCallState, } from "./types";
import { toolColor, toolLabel, toolArgsPreview } from "./types";

const props = defineProps<{
  status: "idle" | "running" | "completed" | "failed";
  assistantText: string;
  thinking: string[];
  toolCalls: ToolCallState[];
}>();

const show = computed(() => props.status === "running" || props.assistantText || props.toolCalls.length);
const thinkingTail = computed(() => props.thinking.slice(-1)[0]?.slice(-220) ?? "");
</script>

<template>
  <div v-if="show" class="msg-ai reveal">
    <div class="ai-ava">
      <span v-if="status === 'running'" class="ring" style="width: 15px; height: 15px"></span>
      <template v-else>洞</template>
    </div>
    <div class="ai-body">
      <!-- 工具调用 timeline -->
      <div v-if="toolCalls.length">
        <div class="section-label"><span class="label">工具调用</span><span class="ln"></span></div>
        <div class="tools">
          <div v-for="c in toolCalls" :key="c.toolCallId" class="tool"
            :style="{ '--tc': toolColor(c.toolName).varName }">
            <span class="tool-tag" :style="{ background: toolColor(c.toolName).bg, color: toolColor(c.toolName).fg }">
              {{ toolLabel(c.toolName) }}
            </span>
            <span class="tool-arg mono">{{ toolArgsPreview(c.args) }}</span>
            <span v-if="c.found != null" class="tool-found">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {{ c.found }} 条
            </span>
            <span v-else-if="c.ok === undefined" class="ring" style="width: 10px; height: 10px"></span>
          </div>
        </div>
      </div>

      <!-- 思考过程 -->
      <div v-if="thinking.length" class="think">
        <div class="scanline" v-if="status === 'running'"></div>
        <div class="think-head">
          <span class="think-icon signal-dot">◎</span>
          <span>思考过程</span>
          <span class="label">{{ thinking.length }} 段</span>
        </div>
        <div class="think-body mono">{{ thinkingTail }}<span v-if="status === 'running'" class="cursor"></span></div>
      </div>

      <!-- 实时 analyst 文本 -->
      <div v-if="assistantText" class="ai-text-stream">
        {{ assistantText }}<span v-if="status === 'running'" class="cursor"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-ai { display: flex; gap: 12px; }
.ai-ava {
  width: 32px; height: 32px; border-radius: var(--r-sm); flex: none;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  display: flex; align-items: center; justify-content: center;
  color: #04111a; font-weight: 700; font-size: 14px;
  box-shadow: 0 0 14px -2px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.ai-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }

.section-label { display: flex; align-items: center; gap: 8px; margin: 0 0 9px; }
.section-label .ln { flex: 1; height: 1px; background: linear-gradient(90deg, var(--line), transparent); }

.tools { display: flex; flex-direction: column; gap: 7px; }
.tool {
  display: flex; align-items: center; gap: 9px;
  background: var(--surface); border: 1px solid var(--line);
  border-left: 2px solid var(--tc, var(--brand));
  border-radius: var(--r-md); padding: 9px 12px; font-size: 12.5px;
  box-shadow: var(--shadow-sm);
  transition: var(--t-fast);
}
.tool:hover { border-color: var(--tc, var(--brand)); box-shadow: 0 0 14px -6px color-mix(in srgb, var(--tc, var(--brand)) 60%, transparent); }
.tool-tag { font-family: var(--mono); font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: var(--r-xs); letter-spacing: 0.04em; }
.tool-arg { color: var(--ink-2); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.tool-found { display: flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 11px; color: var(--green); white-space: nowrap; }

.think { position: relative; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.scanline {
  position: absolute; left: 0; right: 0; top: 0; height: 60%;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--brand) 8%, transparent), transparent);
  pointer-events: none; animation: scanline 3.2s linear infinite;
}
.think-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 12.5px; color: var(--ink-2); position: relative; }
.think-icon { color: var(--brand); font-family: var(--mono); font-size: 13px; }
.think-head .label { margin-left: auto; }
.think-body {
  padding: 0 14px 12px; font-size: 12px; line-height: 1.7; color: var(--ink-2);
  border-top: 1px dashed var(--line); position: relative;
}

.ai-text-stream {
  font-size: 14px; line-height: 1.7; color: var(--ink); white-space: pre-wrap;
  padding: 2px 0;
}
</style>
