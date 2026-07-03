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
  border-radius: var(--r-md); box-shadow: var(--shadow-md); overflow: hidden;
  /* 极轻的琥珀顶栏色调，让“需澄清”语义在视觉上立刻可辨 */
}
.cl-top {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 17px 0;
}
.cl-ava {
  width: 22px; height: 22px; border-radius: var(--r-xs); flex: none;
  background: var(--amber); color: #1a0f00; font-weight: 800; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.cl-kicker {
  font-family: var(--mono); font-size: var(--fs-xs); font-weight: 700;
  color: var(--amber); letter-spacing: 0.14em; text-transform: uppercase;
}

.cl-question { font-size: 14.5px; line-height: 1.6; color: var(--text); margin: 10px 17px 0; font-weight: 500; }

.cl-options { display: flex; flex-direction: column; gap: 7px; margin: 13px 17px 0; }
.cl-option {
  text-align: left; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 10px 13px; font-size: 13px; color: var(--text); cursor: pointer;
  transition: var(--t-fast); font-weight: 500;
}
.cl-option:hover { border-color: var(--amber); background: var(--amber-soft); color: var(--text); }

.cl-input { display: flex; gap: 9px; align-items: flex-end; padding: 13px 17px 4px; }
.cl-input textarea {
  flex: 1; border: 1px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface-2); padding: 9px 11px; resize: none; outline: 0;
  font-family: var(--sans); font-size: 13.5px; line-height: 1.55; color: var(--text);
  min-height: 42px; max-height: 160px; transition: var(--t-fast);
}
.cl-input textarea:focus { border-color: var(--amber); background: var(--surface); }
.cl-input textarea::placeholder { color: var(--text-3); }
.cl-send {
  border: 0; border-radius: var(--r-sm); cursor: pointer; flex: none;
  padding: 0 14px; height: 38px;
  font-size: 13px; font-weight: 600; transition: var(--t-fast);
}
.cl-send.on {
  background: var(--amber); color: #1a0f00;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.cl-send.on:hover { background: color-mix(in srgb, var(--amber) 88%, #000); }
.cl-send.off { background: var(--surface-3); color: var(--text-4); cursor: not-allowed; }

.cl-hint { padding: 0 19px 14px; font-size: 11px; color: var(--text-3); }
</style>

