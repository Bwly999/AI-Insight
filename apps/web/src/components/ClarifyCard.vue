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
  <div class="clarify fade-up">
    <div class="cl-top">
      <span class="cl-ava">?</span>
      <span class="cl-kicker">需要你澄清</span>
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
        回复 ↵
      </button>
    </div>
    <div class="cl-hint"><span class="kbd">Enter</span> 回复 · Agent 会据此继续</div>
  </div>
</template>

<style scoped>
.clarify {
  background: var(--surface); border: 1px solid var(--amber-line);
  border-radius: 12px; box-shadow: var(--shadow-md); overflow: hidden;
}
.cl-top { display: flex; align-items: center; gap: 9px; padding: 13px 17px 0; }
.cl-ava {
  width: 22px; height: 22px; border-radius: 6px; flex: none;
  background: var(--amber); color: #1a0f00; font-weight: 800; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.cl-kicker { font-size: 11px; font-weight: 600; color: var(--amber); letter-spacing: 0.04em; }

.cl-question { font-size: 14.5px; line-height: 1.6; color: var(--text); margin: 10px 17px 0; }

.cl-options { display: flex; flex-direction: column; gap: 7px; margin: 12px 17px 0; }
.cl-option {
  text-align: left; background: var(--surface); border: 1px solid var(--border);
  border-left: 2px solid var(--amber-line);
  border-radius: 8px; padding: 9px 12px; font-size: 13px; color: var(--text); cursor: pointer;
  transition: var(--t-fast);
}
.cl-option:hover { border-color: var(--amber); border-left-color: var(--amber); background: var(--amber-soft); }

.cl-input { display: flex; gap: 9px; align-items: flex-end; padding: 12px 17px 4px; }
.cl-input textarea {
  flex: 1; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface-2); padding: 9px 11px; resize: none; outline: 0;
  font-family: var(--sans); font-size: 13.5px; line-height: 1.55; color: var(--text);
  min-height: 42px; max-height: 160px; transition: var(--t-fast);
}
.cl-input textarea:focus { border-color: var(--amber); }
.cl-input textarea::placeholder { color: var(--text-3); }
.cl-send {
  border: 0; border-radius: 8px; cursor: pointer; flex: none;
  padding: 0 14px; height: 38px;
  font-size: 13px; font-weight: 600; transition: var(--t-fast);
}
.cl-send.on { background: var(--amber); color: #1a0f00; }
.cl-send.on:hover { filter: brightness(1.06); }
.cl-send.off { background: var(--surface-3); color: var(--text-4); cursor: not-allowed; }

.cl-hint { padding: 0 19px 14px; font-size: 11px; color: var(--text-3); }
</style>
