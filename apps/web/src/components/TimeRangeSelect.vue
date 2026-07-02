<script setup lang="ts">
/**
 * TimeRangeSelect — 时间窗下拉选择器。
 * 触发器左侧 Clock 图标 + 当前标签 + 旋转 chevron；面板向上展开（composer 贴底，
 * 向下会被裁切）。hover/键盘双通道：↑↓ 移动 · Enter/Space 确认 · Esc 收起 · 点击外部收起。
 */
import { ref, computed, onBeforeUnmount } from "vue";
import { Clock, ChevronDown, Check } from "@lucide/vue";
import { TIME_RANGE_OPTIONS, type TimeRange } from "@ai-insight/shared-types";

const props = defineProps<{ modelValue: TimeRange }>();
const emit = defineEmits<{ "update:modelValue": [v: TimeRange] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const activeIdx = ref(0);

const currentLabel = computed(
  () => TIME_RANGE_OPTIONS.find((o) => o.value === props.modelValue)?.label ?? ""
);
const currentIndex = computed(() =>
  Math.max(0, TIME_RANGE_OPTIONS.findIndex((o) => o.value === props.modelValue))
);
const optId = (i: number) => `tr-opt-${i}`;

function openMenu() {
  activeIdx.value = currentIndex.value;
  open.value = true;
  document.addEventListener("mousedown", onDocMouseDown);
  document.addEventListener("keydown", onDocKeydown);
}
function closeMenu() {
  open.value = false;
  document.removeEventListener("mousedown", onDocMouseDown);
  document.removeEventListener("keydown", onDocKeydown);
}
function toggle() {
  open.value ? closeMenu() : openMenu();
}
function choose(v: TimeRange) {
  emit("update:modelValue", v);
  closeMenu();
}
function moveActive(step: number) {
  const n = TIME_RANGE_OPTIONS.length;
  activeIdx.value = (activeIdx.value + step + n) % n;
}
function onTriggerKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!open.value) openMenu();
      else moveActive(1);
      break;
    case "ArrowUp":
      e.preventDefault();
      if (!open.value) openMenu();
      else moveActive(-1);
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      if (open.value) choose(TIME_RANGE_OPTIONS[activeIdx.value].value);
      else openMenu();
      break;
  }
}
function onDocMouseDown(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) closeMenu();
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeMenu();
}

onBeforeUnmount(closeMenu);
</script>

<template>
  <div class="tr" ref="root">
    <button type="button" class="tr-trigger" :class="{ open }"
      :aria-expanded="open" aria-haspopup="listbox"
      :aria-activedescendant="open ? optId(activeIdx) : undefined"
      @click="toggle" @keydown="onTriggerKeydown">
      <Clock :size="14" :stroke-width="2" class="tr-ic" />
      <span class="tr-label">{{ currentLabel }}</span>
      <ChevronDown :size="14" :stroke-width="2" class="tr-chev" />
    </button>

    <Transition name="tr-pop">
      <ul v-if="open" class="tr-panel" role="listbox" aria-label="时间范围">
        <li v-for="(opt, i) in TIME_RANGE_OPTIONS" :key="opt.value"
          :id="optId(i)" role="option" :aria-selected="opt.value === modelValue"
          class="tr-opt" :class="{ on: opt.value === modelValue, active: i === activeIdx }"
          @click="choose(opt.value)" @mouseenter="activeIdx = i">
          <span class="tr-opt-label">{{ opt.label }}</span>
          <Check v-if="opt.value === modelValue" :size="13" :stroke-width="2.4" class="tr-opt-check" />
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.tr { position: relative; display: inline-flex; }

.tr-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 7px 0 9px;
  border: 1px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--text-2);
  font-family: var(--sans); font-size: var(--fs-sm); font-weight: 500; line-height: 1;
  cursor: pointer; transition: var(--t-fast);
}
.tr-trigger:hover { border-color: var(--border-2); color: var(--text); background: var(--surface-2); }
.tr-trigger:focus-visible { outline: none; box-shadow: var(--ring); border-color: var(--accent-line); }
.tr-trigger.open { border-color: var(--accent-line); box-shadow: var(--ring); }

.tr-ic { color: var(--text-3); transition: var(--t-fast); flex: none; }
.tr-trigger:hover .tr-ic,
.tr-trigger.open .tr-ic { color: var(--accent); }

.tr-chev { color: var(--text-4); flex: none; transition: transform var(--t-fast), color var(--t-fast); }
.tr-trigger.open .tr-chev { transform: rotate(180deg); color: var(--text-3); }

.tr-panel {
  position: absolute; bottom: calc(100% + 6px); left: 0;
  min-width: 100%; width: max-content;
  list-style: none; margin: 0; padding: 4px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
  transform-origin: bottom center;
  z-index: 50;
}
.tr-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 7px 10px; border-radius: 6px;
  font-size: var(--fs-sm); color: var(--text-2); line-height: 1;
  cursor: pointer; user-select: none; transition: var(--t-fast);
}
.tr-opt.active { background: var(--surface-2); color: var(--text); }
.tr-opt.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
.tr-opt-check { color: var(--accent); flex: none; }

/* 面板向上展开：从触发器边缘淡入浮起 */
.tr-pop-enter-from,
.tr-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.97); }
.tr-pop-enter-active,
.tr-pop-leave-active { transition: opacity 0.14s var(--ease-out), transform 0.14s var(--ease-out); }
</style>
