<script setup lang="ts">
/**
 * Composer — 底部输入框（Workbench 风格）。
 * sticky + 渐变淡出底；focus 时 border 变 accent；时间窗下拉 + 上下文进度环。
 */
import { ref, nextTick, computed } from "vue";
import { type TimeRange } from "@ai-insight/shared-types";
import { SquareArrowUp, SquarePause } from "@lucide/vue";
import TimeRangeSelect from "./TimeRangeSelect.vue";

const props = defineProps<{
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  timeRange: TimeRange;
}>();

const emit = defineEmits<{
  send: [text: string];
  abort: [];
  "update:timeRange": [v: TimeRange];
}>();

const draft = ref("");
const ta = ref<HTMLTextAreaElement | null>(null);

// 上下文占用（mock：按草稿长度估算，0-100%）
const ctxPct = computed(() => Math.min(100, Math.round((draft.value.length / 4000) * 100) || (props.status === "running" ? 41 : 0)));
// 运行中（含等待澄清）：按钮转为停止态，点击调用 abort → POST /api/runs/:id/abort
const isRunning = computed(() => props.status === "running" || props.status === "awaiting_input");

async function autoGrow() {
  await nextTick();
  const el = ta.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 220) + "px";
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
function submit() {
  const text = draft.value.trim();
  if (!text || props.status === "running") return;
  emit("send", text);
  draft.value = "";
  autoGrow();
}
</script>

<template>
  <div class="composer-wrap">
    <div class="composer" :class="{ running: status === 'running' || status === 'awaiting_input' }">
      <textarea ref="ta" v-model="draft" rows="2"
        :placeholder="status === 'awaiting_input' ? 'Agent 在等你的回复…' : status === 'running' ? '洞察运行中…可继续追问' : '继续追问，或补充新线索…   (⌘K 聚焦 · ⌘↵ 发送)'"
        @input="autoGrow" @keydown="onKey"></textarea>

      <div class="composer-foot">
        <div class="chips">
          <TimeRangeSelect :model-value="timeRange"
            @update:model-value="(v) => emit('update:timeRange', v)" />
        </div>

        <span class="ctx-ring" :style="{ background: `conic-gradient(var(--accent) 0 ${ctxPct}%, var(--border-2) ${ctxPct}% 100%)` }" :title="`上下文 ${ctxPct}%`"></span>
        <span class="cm-meta">Deep · 上下文 {{ ctxPct }}%</span>

        <button
          type="button"
          class="send-btn"
          :class="{ stop: isRunning }"
          :disabled="!isRunning && !draft.trim()"
          :title="isRunning ? '中止运行' : '发送 (⌘↵)'"
          @click="isRunning ? emit('abort') : submit()">
          <SquarePause v-if="isRunning" :size="22" :stroke-width="2.2" />
          <SquareArrowUp v-else :size="22" :stroke-width="2.2" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.composer-wrap {
  position: sticky; bottom: 0;
  padding: 14px 44px 20px;
  background: linear-gradient(180deg, transparent 0%, var(--bg) 55%);
  z-index: 5;
}
.composer {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  padding: 12px 14px; box-shadow: var(--shadow-md); transition: var(--t-fast);
}
.composer:focus-within { border-color: var(--accent); box-shadow: var(--shadow-md), var(--ring); }
.composer.running { border-color: var(--accent-line); }

.composer textarea {
  width: 100%; border: none; outline: none; resize: none; background: transparent;
  font-family: var(--sans); font-size: 14px; color: var(--text); line-height: 1.6;
  min-height: 42px; max-height: 220px;
}
.composer textarea::placeholder { color: var(--text-4); }

/* 底栏：上方一条 hairline 分隔，让“输入区/控件区”分层清晰 */
.composer-foot {
  display: flex; align-items: center; gap: 11px; margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border); flex-wrap: wrap;
}
.composer:focus-within .composer-foot { border-top-color: var(--accent-line); }
.chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

/* 上下文进度环：加一个 surface 底色环作“轨道”，让 conic 进度更清晰 */
.ctx-ring {
  width: 15px; height: 15px; border-radius: 50%; flex: none; position: relative;
}
.cm-meta { font-family: var(--mono); font-size: 11px; color: var(--text-3); font-weight: 500; letter-spacing: 0.02em; }

/* 发送键：accent 实色圆形 CTA —— 主操作的最强视觉权重 */
.send-btn {
  margin-left: auto; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; border-radius: var(--r-sm);
  background: var(--accent); color: var(--on-accent);
  cursor: pointer; transition: var(--t-fast);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}
.send-btn:hover:not(:disabled):not(.stop) { background: var(--accent-hover); }
.send-btn:active:not(:disabled) { transform: translateY(0.5px); }
.send-btn:focus-visible { outline: none; box-shadow: var(--ring); }
.send-btn:disabled {
  color: var(--text-4); cursor: not-allowed; background: var(--surface-3);
  box-shadow: none;
}
.send-btn.stop { color: var(--rose); background: var(--rose-soft); box-shadow: none; }
.send-btn.stop:hover { background: var(--rose); color: var(--on-accent); }
</style>

