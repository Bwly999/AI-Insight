<script setup lang="ts">
/**
 * ClarifyCard — Agent 反问用户的澄清卡（暂停/恢复会话的可视化入口）。
 * 渲染问题 + 可选候选按钮 + 开放文本输入。emit reply(text)。
 */
import { ref, nextTick } from "vue";

defineProps<{
  question: string;
  options?: string[];
}>();

const emit = defineEmits<{ reply: [text: string] }>();

const draft = ref("");
const ta = ref<HTMLTextAreaElement | null>(null);

async function autoGrow() {
  await nextTick();
  const el = ta.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function submit() {
  const text = draft.value.trim();
  if (!text) return;
  emit("reply", text);
  draft.value = "";
}

function pick(option: string) {
  emit("reply", option);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="clarify reveal">
    <div class="cl-glow"></div>
    <div class="cl-top">
      <span class="cl-ava">?</span>
      <span class="cl-kicker">需要你澄清 · CLARIFICATION</span>
    </div>
    <p class="cl-question">{{ question }}</p>

    <div v-if="options?.length" class="cl-options">
      <button v-for="opt in options" :key="opt" type="button" class="cl-option" @click="pick(opt)">
        {{ opt }}
      </button>
    </div>

    <div class="cl-input">
      <textarea ref="ta" v-model="draft" rows="2" placeholder="输入你的回复…（或点上方候选）"
        @input="autoGrow" @keydown="onKey"></textarea>
      <button type="button" class="cl-send" :class="draft.trim() ? 'on' : 'off'" :disabled="!draft.trim()" @click="submit">
        回复
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </button>
    </div>
    <div class="cl-hint"><span class="kbd">Enter</span> 回复 · Agent 会据此继续</div>
  </div>
</template>

<style scoped>
.clarify {
  position: relative; overflow: hidden;
  background: linear-gradient(180deg, var(--surface), var(--surface-2));
  border: 1px solid var(--amber-line);
  border-radius: var(--r-lg); box-shadow: var(--shadow-md);
}
.cl-glow {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(380px 140px at 90% -20%, var(--amber-soft), transparent 70%);
}
.cl-top { display: flex; align-items: center; gap: 9px; padding: 15px 20px 0; position: relative; }
.cl-ava {
  width: 24px; height: 24px; border-radius: var(--r-sm); flex: none;
  background: var(--amber); color: #1a0f00; font-weight: 800; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 12px -2px var(--amber);
}
.cl-kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.14em; font-size: 10px; color: var(--amber); font-weight: 600; }

.cl-question { font-size: 15px; line-height: 1.6; color: var(--ink); margin: 10px 20px 0; position: relative; }

.cl-options { display: flex; flex-direction: column; gap: 7px; margin: 14px 20px 0; position: relative; }
.cl-option {
  text-align: left; background: var(--surface); border: 1px solid var(--line);
  border-left: 2px solid var(--amber-line);
  border-radius: var(--r-md); padding: 10px 13px; font-size: 13px; color: var(--ink); cursor: pointer;
  transition: var(--t-fast);
}
.cl-option:hover { border-color: var(--amber); border-left-color: var(--amber); box-shadow: 0 0 14px -6px var(--amber); transform: translateX(2px); }

.cl-input { display: flex; gap: 9px; align-items: flex-end; padding: 14px 20px 4px; position: relative; }
.cl-input textarea {
  flex: 1; border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--surface); padding: 10px 12px; resize: none; outline: 0;
  font-family: var(--sans); font-size: 14px; line-height: 1.55; color: var(--ink);
  min-height: 48px; max-height: 160px; transition: var(--t-fast);
}
.cl-input textarea:focus { border-color: var(--amber); box-shadow: 0 0 0 3px var(--amber-soft); }
.cl-input textarea::placeholder { color: var(--ink-3); }
.cl-send {
  border: 0; border-radius: var(--r-md); cursor: pointer; flex: none;
  padding: 0 14px; height: 40px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; transition: var(--t-fast);
}
.cl-send.on { background: var(--amber); color: #1a0f00; box-shadow: 0 4px 14px -2px var(--amber); }
.cl-send.on:hover { filter: brightness(1.06); transform: translateY(-1px); }
.cl-send.off { background: var(--surface-3); color: var(--ink-4); cursor: not-allowed; }

.cl-hint { padding: 0 22px 16px; font-size: 11px; color: var(--ink-3); }
</style>
