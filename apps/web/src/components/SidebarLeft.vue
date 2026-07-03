<script setup lang="ts">
/**
 * SidebarLeft — 会话列表（Workbench 左栏）。
 * 进行中 / 历史两组；conv-item 左边框 active 态；底部报告/定时导航。
 */
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Plus, BookOpen, Clock } from "@lucide/vue";
import type { Conversation } from "@ai-insight/shared-types";

const props = defineProps<{
  conversations: Conversation[];
  currentConvId: string | null;
}>();

const emit = defineEmits<{ newInsight: []; select: [c: Conversation]; goReports: [] }>();
const router = useRouter();
function goSchedules() {
  router.push("/schedules");
}

// 进行中 = 最近 1 天内更新；其余归历史
const inProgress = computed(() => {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  return props.conversations.filter((c) => new Date(c.updatedAt).getTime() >= cutoff);
});
const history = computed(() => {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  return props.conversations.filter((c) => new Date(c.updatedAt).getTime() < cutoff);
});

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `今天 · ${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return iso.slice(5, 10).replace("-", " 月 ");
}
</script>

<template>
  <aside class="col-left">
    <button class="new-btn" @click="emit('newInsight')">
      <Plus :size="14" :stroke-width="2.6" />
      新对话
    </button>

    <div class="conv-list scroll">
      <template v-if="inProgress.length">
        <div class="cl-eb">进行中</div>
        <button v-for="c in inProgress" :key="c.id" class="conv-item"
          :class="{ active: c.id === currentConvId }" @click="emit('select', c)">
          <div class="ci-title">{{ c.title }}</div>
          <div class="ci-meta">{{ relTime(c.updatedAt) }}</div>
          <span v-if="c.id === currentConvId" class="ci-tag draft">分析中</span>
        </button>
      </template>

      <div class="cl-eb" v-if="history.length">历史</div>
      <button v-for="c in history" :key="c.id" class="conv-item"
        :class="{ active: c.id === currentConvId }" @click="emit('select', c)">
        <div class="ci-title">{{ c.title }}</div>
        <div class="ci-meta">{{ relTime(c.updatedAt) }}</div>
        <span v-if="c.id === currentConvId" class="ci-tag done">已完成</span>
      </button>

      <div v-if="!conversations.length" class="list-empty">暂无会话</div>
    </div>

    <div class="side-bottom">
      <div class="nav-link" @click="emit('goReports')">
        <BookOpen :size="16" :stroke-width="1.8" />
        我的报告
      </div>
      <div class="nav-link" @click="goSchedules">
        <Clock :size="16" :stroke-width="1.8" />
        我的定时
      </div>
    </div>
  </aside>
</template>

<style scoped>
.col-left {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.new-btn {
  margin: 14px 14px 6px; padding: 10px 13px; border: none; border-radius: var(--r-sm);
  background: var(--accent); color: var(--on-accent);
  font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 8px; transition: var(--t-fast);
}
.new-btn:hover { background: var(--accent-hover); }

.conv-list { flex: 1; overflow-y: auto; padding: 8px 10px 16px; }
.cl-eb {
  font-family: var(--mono); font-size: var(--fs-xs); font-weight: 600;
  color: var(--text-4); padding: 14px 9px 7px; letter-spacing: 0.12em; text-transform: uppercase;
}
.conv-item {
  display: block; width: 100%; text-align: left;
  padding: 9px 11px; border-radius: var(--r-sm); cursor: pointer; margin-bottom: 1px;
  transition: var(--t-fast); background: transparent; border: none;
  position: relative;
}
.conv-item:hover { background: var(--surface-2); }
.conv-item.active { background: var(--surface-2); border-left: 2px solid var(--accent); padding-left: 9px; }
.ci-title {
  font-size: 13.5px; font-weight: 500; color: var(--text); line-height: 1.35;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.conv-item.active .ci-title { color: var(--text); font-weight: 600; }
.ci-meta { margin-top: 3px; font-family: var(--mono); font-size: 10.5px; color: var(--text-3); letter-spacing: 0.01em; }
.ci-tag {
  display: inline-block; margin-top: 5px; font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: var(--r-xs); letter-spacing: 0.02em;
  font-family: var(--mono);
}
.ci-tag.draft { background: var(--accent-soft); color: var(--accent-text); border: 1px solid var(--accent-line); }
.ci-tag.done { background: var(--surface-3); color: var(--text-3); }
.list-empty { padding: 20px; text-align: center; color: var(--text-3); font-size: 12px; }

.side-bottom { border-top: 1px solid var(--border); padding: 8px 10px; }
.nav-link {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 11px; border-radius: var(--r-sm);
  font-size: 13px; color: var(--text-2); cursor: pointer; transition: var(--t-fast);
}
.nav-link:hover { background: var(--surface-2); color: var(--accent); }
.nav-link:focus-visible { outline: none; box-shadow: var(--ring); }
</style>
