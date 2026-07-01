<script setup lang="ts">
/**
 * Composer — 底部输入框（暗玻璃 + focus 发光环 + chips）。
 */
import { ref, nextTick } from "vue";
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
  // awaiting_input 时由父组件把 send 路由到 reply；running 时禁用
  if (!text || props.status === "running") return;
  emit("send", text);
  draft.value = "";
  autoGrow();
}
</script>

<template>
  <div class="dock">
    <div class="dock-inner">
      <form class="composer" :class="{ running: status === 'running' || status === 'awaiting_input' }" @submit.prevent="submit">
        <div class="comp-area">
          <textarea ref="ta" v-model="draft" rows="3"
            :placeholder="status === 'awaiting_input' ? 'Agent 在等你的回复…' : status === 'running' ? '洞察运行中…可继续追问' : '发起一次洞察，描述你想了解的赛道或问题…'"
            @input="autoGrow" @keydown="onKey"></textarea>
          <button v-if="status === 'running' || status === 'awaiting_input'" type="button" class="stop-btn" @click="emit('abort')" title="中止运行">
            <span style="display: block; width: 11px; height: 11px; background: currentColor; border-radius: 2px"></span>
          </button>
          <button v-else type="submit" class="send-btn" :class="draft.trim() ? 'on' : 'off'" :disabled="!draft.trim()" title="发送 (Enter)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
          </button>
        </div>

        <div v-if="status !== 'awaiting_input'" class="comp-tools">
          <div class="tool-group">
            <span class="tool-group-label">时间窗</span>
            <button type="button" v-for="r in TIME_RANGE_OPTIONS" :key="r.value" class="rchip"
              :class="{ on: r.value === timeRange }" @click="emit('update:timeRange', r.value)">{{ r.label }}</button>
          </div>
          <div class="v-divider"></div>
          <div class="tool-group">
            <span class="tool-group-label">标签</span>
            <button type="button" v-for="t in ALL_TAGS" :key="t" class="tchip"
              :class="{ on: tagPrefs.includes(t) }" @click="emit('toggleTag', t)">{{ TAG_LABELS[t] }}</button>
          </div>
        </div>
      </form>
      <div class="comp-hint">
        <span>Agent 按意图自主选择视角并调度数据源（搜索 · RSS · 爬虫），综合成报告。</span>
        <span><span class="kbd">Enter</span> 发送 · <span class="kbd">Shift</span>+<span class="kbd">Enter</span> 换行</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dock { padding: 8px 20px 16px; background: linear-gradient(180deg, transparent, var(--bg) 35%); position: relative; z-index: 5; }
.dock-inner { max-width: 760px; margin: 0 auto; }
.composer {
  background: var(--glass); backdrop-filter: blur(12px) saturate(140%); -webkit-backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid var(--glass-border); border-radius: var(--r-xl);
  box-shadow: var(--shadow-md); transition: var(--t-mid); overflow: hidden;
}
.composer:focus-within { border-color: var(--brand-line); box-shadow: var(--ring), var(--shadow-md); }
.composer.running { border-color: var(--brand-line); }

.comp-area { padding: 14px 16px 5px; display: flex; gap: 10px; align-items: flex-end; }
.comp-area textarea {
  flex: 1; border: 0; outline: 0; resize: none; background: transparent;
  font-family: var(--sans); font-size: 14.5px; line-height: 1.55; color: var(--ink);
  min-height: 76px; max-height: 220px;
}
.comp-area textarea::placeholder { color: var(--ink-3); }

.send-btn { width: 36px; height: 36px; border-radius: var(--r-md); border: 0; cursor: pointer; flex: none; display: flex; align-items: center; justify-content: center; transition: var(--t-mid); color: #04111a; }
.send-btn.on { background: linear-gradient(180deg, var(--brand), var(--brand-2)); box-shadow: 0 4px 14px -2px var(--brand-glow); }
.send-btn.on:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 20px -2px var(--brand-glow); }
.send-btn.off { background: var(--surface-3); color: var(--ink-4); cursor: not-allowed; }
.stop-btn { width: 36px; height: 36px; border-radius: var(--r-md); border: 0; cursor: pointer; flex: none; background: var(--surface-3); color: var(--ink-2); display: flex; align-items: center; justify-content: center; transition: var(--t-fast); }
.stop-btn:hover { background: var(--rose-soft); color: var(--rose); }

.comp-tools { display: flex; align-items: center; gap: 8px; padding: 9px 12px 11px; flex-wrap: wrap; border-top: 1px solid var(--line); background: var(--surface-2); }
.tool-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tool-group-label { font-family: var(--mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); margin-right: 3px; }
.v-divider { width: 1px; height: 18px; background: var(--line); }

.comp-hint { display: flex; align-items: center; justify-content: space-between; padding: 7px 6px 0; font-size: 11px; color: var(--ink-3); }
</style>
