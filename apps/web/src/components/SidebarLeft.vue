<script setup lang="ts">
/**
 * SidebarLeft — 会话列表（深面板 + 发光 active）。
 */
import { useRouter } from "vue-router";
import type { Conversation } from "@ai-insight/shared-types";

defineProps<{
  conversations: Conversation[];
  currentConvId: string | null;
}>();

const emit = defineEmits<{ newInsight: []; select: [c: Conversation]; goReports: [] }>();
const router = useRouter();
function goSchedules() {
  router.push("/schedules");
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return iso.slice(0, 10);
}
</script>

<template>
  <aside class="sidebar">
    <div class="side-top">
      <button class="new-insight" @click="emit('newInsight')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        发起新洞察
      </button>
    </div>

    <div class="list-head">
      <span class="label">最近会话</span>
      <span class="count mono">{{ conversations.length }}</span>
    </div>

    <div class="conv-scroll scroll">
      <button v-for="c in conversations" :key="c.id" class="conv-item"
        :class="{ active: c.id === currentConvId }" @click="emit('select', c)">
        <div class="t">{{ c.title }}</div>
        <div class="m mono">{{ relTime(c.updatedAt) }}</div>
      </button>
      <div v-if="!conversations.length" class="list-empty">暂无会话</div>
    </div>

    <div class="side-bottom">
      <div class="nav-link" @click="emit('goReports')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
        我的报告
      </div>
      <div class="nav-link" @click="goSchedules">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
        我的定时
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  background: var(--surface-2);
  border-right: 1px solid var(--line);
  display: flex; flex-direction: column; min-height: 0;
}
.side-top { padding: var(--sp-3); }
.new-insight {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 40px; border-radius: var(--r-md);
  background: linear-gradient(180deg, var(--brand), var(--brand-2));
  color: #04111a; font-size: 13.5px; font-weight: 600; border: none; cursor: pointer;
  box-shadow: 0 4px 16px -4px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: var(--t-mid);
}
.new-insight:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 24px -4px var(--brand-glow); }

.list-head { display: flex; align-items: center; justify-content: space-between; padding: 0 var(--sp-3) var(--sp-1); }
.count { font-size: 10px; color: var(--ink-3); background: var(--surface-3); padding: 1px 7px; border-radius: var(--r-pill); }

.conv-scroll { flex: 1; overflow-y: auto; padding: var(--sp-1) var(--sp-2) var(--sp-2); }
.conv-item {
  display: block; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: var(--r-md);
  cursor: pointer; border: 1px solid transparent; background: transparent;
  transition: var(--t-fast); position: relative; margin-bottom: 2px;
}
.conv-item:hover { background: var(--surface); border-color: var(--line); }
.conv-item.active {
  background: var(--brand-soft); border-color: var(--brand-line);
  box-shadow: inset 3px 0 0 var(--brand), 0 0 16px -6px var(--brand-glow);
}
.conv-item .t { font-size: 13px; color: var(--ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-item.active .t { color: var(--brand); font-weight: 600; }
.conv-item .m { font-size: 11px; color: var(--ink-3); margin-top: 3px; }
.list-empty { padding: 20px; text-align: center; color: var(--ink-3); font-size: 12px; }

.side-bottom { border-top: 1px solid var(--line); padding: var(--sp-2); }
.nav-link {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 12px; border-radius: var(--r-sm);
  font-size: 13px; color: var(--ink-2); cursor: pointer; transition: var(--t-fast);
}
.nav-link:hover { background: var(--surface); color: var(--brand); }
</style>
