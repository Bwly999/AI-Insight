<script setup lang="ts">
/**
 * SidebarLeft — 会话列表（Workbench 左栏）。
 * 工具区（CTA + 客户端过滤）+ 按 updatedAt 的时间桶列表 + 底部报告/定时导航。
 * 锐利化：active 态用极轻 accent-soft tint + 2px 左线（列表项 active 左线合法）；
 * 真实 run 状态已在顶栏表达，这里不再画伪 tag。
 */
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Plus, BookOpen, Clock, Search, X } from "@lucide/vue";
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

// ── 客户端标题过滤 ────────────────────────────────────────────────────────
const query = ref("");
const q = computed(() => query.value.trim().toLowerCase());
const filtered = computed(() =>
  q.value ? props.conversations.filter((c) => c.title.toLowerCase().includes(q.value)) : props.conversations,
);

// ── 时间桶：今天 / 本周 / 更早（按 updatedAt 降序） ──────────────────────────
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const TODAY = startOfToday();
const WEEK = TODAY - 6 * 24 * 3600 * 1000; // 含今天，共 7 天

interface Bucket {
  key: "today" | "week" | "older";
  label: string;
  items: Conversation[];
}
const buckets = computed<Bucket[]>(() => {
  const today: Conversation[] = [];
  const week: Conversation[] = [];
  const older: Conversation[] = [];
  for (const c of filtered.value) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= TODAY) today.push(c);
    else if (t >= WEEK) week.push(c);
    else older.push(c);
  }
  const sortDesc = (a: Conversation, b: Conversation) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  today.sort(sortDesc);
  week.sort(sortDesc);
  older.sort(sortDesc);
  return ([
    { key: "today", label: "今天", items: today },
    { key: "week", label: "本周", items: week },
    { key: "older", label: "更早", items: older },
  ] as Bucket[]).filter((b) => b.items.length);
});

const total = computed(() => props.conversations.length);

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
  return new Date(iso).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace("/", " 月 ") + " 日";
}

function clearQuery() {
  query.value = "";
}
</script>

<template>
  <aside class="col-left">
    <!-- 工具区：CTA + 搜索 + 列表头计数。hairline 收束成一个面板。 -->
    <div class="sb-tool">
      <button class="new-btn" @click="emit('newInsight')">
        <Plus :size="15" :stroke-width="2.4" />
        新对话
      </button>

      <label class="search">
        <Search :size="13" :stroke-width="2" />
        <input v-model="query" type="text" placeholder="搜索会话" aria-label="搜索会话" />
        <button v-if="query" class="search-clear" type="button" @click="clearQuery" aria-label="清除搜索">
          <X :size="12" :stroke-width="2.4" />
        </button>
      </label>

      <div class="list-head">
        <span class="lh-label">会话</span>
        <span class="lh-count">{{ total }}</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="conv-list scroll">
      <template v-if="buckets.length">
        <div v-for="b in buckets" :key="b.key" class="bucket">
          <div class="bk-eb">{{ b.label }}</div>
          <button
            v-for="c in b.items"
            :key="c.id"
            class="conv-item"
            :class="{ active: c.id === currentConvId }"
            @click="emit('select', c)">
            <div class="ci-title">{{ c.title }}</div>
            <div class="ci-meta">{{ relTime(c.updatedAt) }}</div>
          </button>
        </div>
      </template>

      <!-- 空态 -->
      <div v-else-if="q" class="list-empty">
        <div class="le-glyph"><Search :size="22" :stroke-width="1.6" /></div>
        <div class="le-title">没有匹配的会话</div>
        <div class="le-sub">换个关键词，或<span class="le-action" @click="clearQuery">清除搜索</span></div>
      </div>
      <div v-else class="list-empty">
        <div class="le-glyph"><Search :size="22" :stroke-width="1.6" /></div>
        <div class="le-title">还没有会话</div>
        <div class="le-sub">点上方「新对话」发起一次洞察</div>
      </div>
    </div>

    <!-- 底部导航：hairline 收束 -->
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── 工具区 ─────────────────────────────────────────────── */
.sb-tool {
  padding: 14px 14px 0;
  border-bottom: 1px solid var(--border);
}

/* 新对话按钮：committed accent CTA —— 主操作配清晰触发，无下沉 */
.new-btn {
  width: 100%;
  padding: 10px 13px;
  border: none;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: var(--t-fast);
  /* 精致内边沿：实色 CTA 的“按下去”预期，非发光 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12);
}
.new-btn:hover {
  background: var(--accent-hover);
}
.new-btn:active {
  transform: translateY(0.5px);
}

/* 搜索框：icon-led，border + focus 转 accent（非发光 ring） */
.search {
  margin-top: 9px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 32px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text-3);
  transition: var(--t-fast);
}
.search:focus-within {
  border-color: var(--accent);
  box-shadow: var(--ring);
  color: var(--accent);
}
.search > svg {
  flex: none;
}
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  font-family: var(--sans);
  font-size: 12.5px;
  color: var(--text);
  outline: none;
  line-height: 1;
}
.search input::placeholder {
  color: var(--text-3);
}
.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: var(--t-fast);
}
.search-clear:hover {
  color: var(--accent);
  background: var(--surface-2);
}

/* 列表头：mono label + 计数，把工具区与列表“锁边” */
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 2px 8px;
  font-family: var(--mono);
}
.lh-label {
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}
.lh-count {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-3);
  font-feature-settings: "zero", "ss01";
  letter-spacing: 0.04em;
}

/* ─── 列表 ──────────────────────────────────────────────── */
.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 16px;
}

.bucket + .bucket {
  margin-top: 4px;
}
.bk-eb {
  font-family: var(--mono);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-4);
  padding: 12px 9px 6px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.conv-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 11px;
  border-radius: var(--r-sm);
  cursor: pointer;
  margin-bottom: 1px;
  transition: var(--t-fast);
  background: transparent;
  border: none;
  position: relative;
}
.conv-item:hover {
  background: var(--surface-2);
}
/* active：极轻 accent-soft tint + 2px 左线（列表项 active 左线合法） */
.conv-item.active {
  background: var(--accent-soft);
  border-left: 2px solid var(--accent);
  padding-left: 9px;
}
.ci-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-item.active .ci-title {
  font-weight: 600;
  color: var(--text);
}
.ci-meta {
  margin-top: 3px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--text-3);
  letter-spacing: 0.02em;
}

/* ─── 空态 ──────────────────────────────────────────────── */
.list-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-3);
}
.le-glyph {
  display: flex;
  justify-content: center;
  color: var(--text-4);
  margin-bottom: 10px;
}
.le-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.le-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
}
.le-action {
  color: var(--accent-text);
  cursor: pointer;
  font-weight: 600;
}
.le-action:hover {
  color: var(--accent);
}

/* ─── 底部导航 ──────────────────────────────────────────── */
.side-bottom {
  border-top: 1px solid var(--border);
  padding: 8px 10px;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border-radius: var(--r-sm);
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: var(--t-fast);
}
.nav-link:hover {
  background: var(--surface-2);
  color: var(--accent);
}
.nav-link:focus-visible {
  outline: none;
  box-shadow: var(--ring);
}

@media (prefers-reduced-motion: reduce) {
  .new-btn,
  .search,
  .search-clear,
  .conv-item,
  .nav-link {
    transition: none;
  }
}
</style>
