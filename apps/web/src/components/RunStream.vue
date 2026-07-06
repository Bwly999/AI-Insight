<script setup lang="ts">
/**
 * RunStream — 运行中实时流（Workbench 风格）。
 * AI 头像 + lens eyebrow + MessageBlocks（按到达顺序循环渲染思考/工具/回复）。
 */
import { computed } from "vue";
import { LENS_OPTIONS, type LensKey } from "@ai-insight/shared-types";
import type { Block } from "../composables/blocks";
import MessageBlocks from "./MessageBlocks.vue";
import AgentMark from "./AgentMark.vue";

const props = defineProps<{
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  blocks: Block[];
  lens: LensKey | null;
}>();

const streaming = computed(() => props.status === "running");
// 仅在运行中/等待输入时显示实时流；completed/failed 后内容已落库并由 MessageList 历史渲染，
// 此处不再显示，避免与历史重复。
const show = computed(() => props.status === "running" || props.status === "awaiting_input");
const lensLabel = computed(() => (props.lens ? LENS_OPTIONS.find((l) => l.key === props.lens)?.label : undefined));
const hasText = computed(() => props.blocks.some((b) => b.kind === "text"));
const isLive = computed(() => props.status === "running" || props.status === "awaiting_input");
</script>

<template>
  <div v-if="show" class="turn ai fade-up">
    <div class="ai-ava" :class="{ live: isLive }">
      <AgentMark :size="16" />
      <span v-if="isLive" class="live-ring"></span>
    </div>
    <div class="ai-body">
      <div class="ai-eb">
        <span class="ai-name">AI-Insight</span>
        <span class="ai-dot"></span>
        <span v-if="lens" class="lens">{{ lensLabel ?? lens }}</span>
      </div>

      <!-- 有序 blocks：思考 → 工具 → 回复 循环 -->
      <MessageBlocks :blocks="blocks" :streaming="streaming" :default-think-open="true" />

      <!-- 流式指示：运行中且尚无任何文本块 -->
      <div v-if="status === 'running' && !hasText" class="writing">
        <span class="wd"></span> 正在生成
      </div>
    </div>
  </div>
</template>

<style scoped>
.turn.ai { display: flex; gap: 13px; }
/* unslop-ignore: AI 头像 accent-soft tint（与 MessageList 统一 agent 身份）+ glow-sm 信号 */
.ai-ava {
  width: 30px; height: 30px; border-radius: var(--r-sm); flex: none;
  background: var(--accent-soft); color: var(--accent);
  display: grid; place-items: center;
  position: relative;
  border: 1px solid var(--accent-line);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), var(--glow-sm);
}
/* 运行态：avatar 外圈一圈翠绿脉冲（仪器“工作中”信号） */
.live-ring {
  position: absolute; inset: -3px; border-radius: calc(var(--r-sm) + 3px);
  border: 1.5px solid var(--accent); opacity: 0.5;
  animation: ping 1.8s var(--ease-out) infinite;
  pointer-events: none;
}
.ai-body { flex: 1; min-width: 0; }
.ai-eb {
  display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
}
.ai-name {
  font-size: 12.5px; font-weight: 700; color: var(--text); letter-spacing: -0.005em;
}
.ai-dot {
  width: 2.5px; height: 2.5px; border-radius: 50%; background: var(--text-4); flex: none;
}
.ai-eb .lens {
  font-family: var(--mono); font-size: 9.5px; font-weight: 600;
  padding: 2px 6px; border-radius: var(--r-xs);
  background: var(--accent-soft); color: var(--accent-text); border: 1px solid var(--accent-line);
  letter-spacing: 0.1em; text-transform: uppercase;
}

/* 流式指示 */
.writing {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12.5px; color: var(--text-3); font-weight: 500; margin-top: 8px;
}
.writing .wd {
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
  animation: wd-blink 1.2s ease-in-out infinite;
}
</style>

