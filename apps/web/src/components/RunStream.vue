<script setup lang="ts">
/**
 * RunStream — 运行中实时流（Workbench 风格）。
 * AI 头像 + lens eyebrow + MessageBlocks（按到达顺序循环渲染思考/工具/回复）。
 */
import { computed } from "vue";
import { LENS_OPTIONS, type LensKey } from "@ai-insight/shared-types";
import type { Block } from "../composables/blocks";
import MessageBlocks from "./MessageBlocks.vue";

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

/* 流式指示 */
.writing { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-3); font-weight: 500; margin-top: 6px; }
.writing .wd { width: 6px; height: 6px; border-radius: 50%; background: var(--text-4); animation: wd-blink 1.2s ease-in-out infinite; }
</style>
