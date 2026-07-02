<script setup lang="ts">
/**
 * ReportModal — 报告弹窗（替代 ReportView 全屏页）。
 * 遮罩模糊 + 880px 卡片；body 渲染 markdown（含 [n]→① 引用）；foot 下载 HTML（独立网页分享）。
 * ESC / 点遮罩关闭。
 */
import { computed, onMounted, onUnmounted, watch } from "vue";
import { reportHtmlUrl } from "@ai-insight/api-client";
import type { Report } from "@ai-insight/shared-types";
import { mdToHtml } from "../utils/markdown";

const props = defineProps<{ report: Report | null }>();
const emit = defineEmits<{ close: [] }>();

const open = computed(() => !!props.report);
const bodyHtml = computed(() => (props.report ? mdToHtml(props.report.markdown) : ""));
const htmlUrl = computed(() => (props.report ? reportHtmlUrl(props.report.id) : "#"));

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) emit("close");
}
watch(open, (v) => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = v ? "hidden" : "";
  }
});
onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => {
  document.removeEventListener("keydown", onKey);
  if (typeof document !== "undefined") document.body.style.overflow = "";
});
</script>

<template>
  <div v-if="report" class="modal-veil open" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="m-eb">分析报告 · 草稿</div>
          <h2>{{ report.title }}</h2>
        </div>
        <button class="icon-btn" style="margin-left: auto" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body scroll">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="md" v-html="bodyHtml"></div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
        <a class="btn" :href="htmlUrl" download target="_blank" rel="noopener">下载 HTML</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-veil {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 28px;
}
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  width: min(880px, 100%); max-height: 88vh; overflow: hidden;
  box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
}
.modal-head {
  padding: 16px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 14px;
}
.modal-head h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--text); }
.m-eb { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 2px; letter-spacing: 0.04em; }

.modal-body { flex: 1; overflow-y: auto; padding: 24px 32px; }

.modal-foot {
  padding: 12px 24px; border-top: 1px solid var(--border);
  display: flex; gap: 10px;
}
.modal-foot .btn {
  font-size: 13px; font-weight: 600; padding: 8px 15px; border-radius: 8px;
  cursor: pointer; border: 1px solid var(--border); background: var(--surface);
  color: var(--text-2); text-decoration: none; transition: var(--t-fast);
}
.modal-foot .btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
