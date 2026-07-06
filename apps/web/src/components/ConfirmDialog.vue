<script setup lang="ts">
/**
 * ConfirmDialog — 通用确认弹窗（工作台 register）。
 *
 * 复用 ReportModal 的 modal 模式（modal-veil + Esc 关闭 + body scroll lock），
 * 但用工作台系统色（Inter + JetBrains Mono），危险态用 --rose 语义色
 * （DESIGN.md「Abort button: rose-soft 底 + rose 字 + rose-line 边」）。
 * 朱砂 --vermillion 是 editorial 报告专属，此处绝不交叉。
 *
 * 形素冗余：danger 态配 AlertTriangle 图标，状态绝不只靠颜色（WCAG AA）。
 */
import { computed, onMounted, onUnmounted, watch } from "vue";
import { AlertTriangle } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    /** 危险态：确认键转 rose 语义色 + 警示图标。默认 true。 */
    danger?: boolean;
  }>(),
  { confirmText: "删除", cancelText: "取消", danger: true },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const danger = computed(() => props.danger);

function onKey(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === "Escape") emit("cancel");
  else if (e.key === "Enter") emit("confirm");
}
// 打开时锁 body 滚动 + 绑 Esc/Enter；关闭时还原。与 ReportModal 同款（lines 73-85）。
watch(
  () => props.open,
  (v) => {
    if (typeof document !== "undefined") document.body.style.overflow = v ? "hidden" : "";
  },
);
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => {
  document.removeEventListener("keydown", onKey);
  if (typeof document !== "undefined") document.body.style.overflow = "";
});
</script>

<template>
  <!-- Teleport 到 body：ConfirmDialog 常挂在带 backdrop-filter/transform 的祖先里
       （如 SidebarLeft 的 .col-left），这些属性会创建包含块、把 position:fixed 困在
       左栏内而非屏幕居中。传送出 <aside> 后 fixed 才真正相对 viewport。 -->
  <Teleport to="body">
    <div v-if="open" class="modal-veil" @click.self="emit('cancel')">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="dlg-body">
          <div class="dlg-glyph" :class="{ danger }">
            <AlertTriangle :size="20" :stroke-width="2" />
          </div>
          <h2 class="dlg-title">{{ title }}</h2>
          <p v-if="message" class="dlg-msg">{{ message }}</p>
        </div>
        <div class="dlg-actions">
          <button class="btn cancel" type="button" autofocus @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button class="btn confirm" :class="{ danger }" type="button" @click="emit('confirm')">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-veil {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 28px;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  width: min(420px, 100%);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.dlg-body {
  padding: 24px 24px 6px;
}
.dlg-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
  color: var(--text-3);
  margin-bottom: 14px;
}
/* danger 形素冗余：rose 图标底，WCAG AA 不只靠颜色 */
.dlg-glyph.danger {
  background: var(--rose-soft);
  color: var(--rose);
}
.dlg-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
.dlg-msg {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
  line-height: 1.6;
}

.dlg-actions {
  display: flex;
  gap: 8px;
  padding: 20px 24px 24px;
  justify-content: flex-end;
}
.btn {
  height: 34px;
  padding: 0 16px;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--t-fast);
  border: 1px solid transparent;
}
/* 取消：surface 底 + border，hover 字转 accent（与 ghost button 一致） */
.btn.cancel {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text-2);
}
.btn.cancel:hover {
  border-color: var(--border-2);
  color: var(--text);
}
/* 确认（默认）：柠绿主操作 */
.btn.confirm {
  background: var(--accent);
  color: var(--on-accent);
}
.btn.confirm:hover {
  background: var(--accent-hover);
}
/* danger 确认：rose 实色（DESIGN.md Abort button 语义） */
.btn.confirm.danger {
  background: var(--rose);
  color: #fff;
}
.btn.confirm.danger:hover {
  background: color-mix(in srgb, var(--rose) 88%, #000);
}
</style>
