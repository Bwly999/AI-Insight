<script setup lang="ts">
/**
 * Composer — 底部输入框（Workbench 风格）。
 * sticky + 渐变淡出底；focus 时 border 变 accent；上下文进度环 + 时间窗/标签 chips。
 */
import { ref, nextTick, computed } from "vue";
import {
  TIME_RANGE_OPTIONS, ALL_TAGS, TAG_LABELS,
  type TimeRange, type DataSourceTag,
} from "@ai-insight/shared-types";

const props = defineProps<{
  status: "idle" | "running" | "completed" | "failed" | "awaiting_input";
  timeRange: TimeRange;
  tagPrefs: DataSourceTag[];
}>();

const emit = defineEmits<{
  send: [text: string];
  abort: [];
  "update:timeRange": [v: TimeRange];
  toggleTag: [t: DataSourceTag];
}>();

const draft = ref("");
const ta = ref<HTMLTextAreaElement | null>(null);

// 上下文占用（mock：按草稿长度估算，0-100%）
const ctxPct = computed(() => Math.min(100, Math.round((draft.value.length / 4000) * 100) || (props.status === "running" ? 41 : 0)));

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
          <button type="button" v-for="r in TIME_RANGE_OPTIONS" :key="r.value" class="rchip"
            :class="{ on: r.value === timeRange }" @click="emit('update:timeRange', r.value)">{{ r.label }}</button>
          <span class="chip-sep"></span>
          <button type="button" v-for="t in ALL_TAGS" :key="t" class="tchip"
            :class="{ on: tagPrefs.includes(t) }" @click="emit('toggleTag', t)">{{ TAG_LABELS[t] }}</button>
        </div>

        <span class="ctx-ring" :style="{ background: `conic-gradient(var(--accent) 0 ${ctxPct}%, var(--border-2) ${ctxPct}% 100%)` }" :title="`上下文 ${ctxPct}%`"></span>
        <span class="cm-meta">Deep · 上下文 {{ ctxPct }}%</span>

        <button v-if="status === 'running' || status === 'awaiting_input'" type="button" class="stop-btn" @click="emit('abort')" title="中止运行">
          <span style="display: block; width: 11px; height: 11px; background: currentColor; border-radius: 2px"></span>
        </button>
        <button v-else type="button" class="send-btn" :class="draft.trim() ? 'on' : 'off'" :disabled="!draft.trim()" @click="submit">
          发送 ↵
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
  background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px;
  padding: 12px 14px; box-shadow: var(--shadow-md); transition: var(--t-fast);
}
.composer:focus-within { border-color: var(--accent); }
.composer.running { border-color: var(--accent-line); }

.composer textarea {
  width: 100%; border: none; outline: none; resize: none; background: transparent;
  font-family: var(--sans); font-size: 14px; color: var(--text); line-height: 1.6;
  min-height: 42px; max-height: 220px;
}
.composer textarea::placeholder { color: var(--text-4); }

.composer-foot { display: flex; align-items: center; gap: 11px; margin-top: 9px; flex-wrap: wrap; }
.chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chip-sep { width: 1px; height: 16px; background: var(--border); margin: 0 3px; }

.ctx-ring { width: 15px; height: 15px; border-radius: 50%; flex: none; }
.cm-meta { font-size: 11.5px; color: var(--text-3); font-weight: 500; }

.send-btn {
  margin-left: auto; background: var(--accent); color: var(--on-accent);
  border: none; border-radius: 8px; padding: 8px 16px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: var(--t-fast);
}
.send-btn.on:hover { background: var(--accent-hover); }
.send-btn.off { background: var(--surface-3); color: var(--text-4); cursor: not-allowed; }
.stop-btn {
  margin-left: auto; border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px;
  background: var(--surface); color: var(--rose); font-size: 13px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; transition: var(--t-fast);
}
.stop-btn:hover { background: var(--rose-soft); border-color: var(--rose); }
</style>
