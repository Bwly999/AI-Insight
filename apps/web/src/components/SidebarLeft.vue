<script setup lang="ts">
/**
 * SidebarLeft — Workbench V2 左栏（情报台索引卡）。
 * 工具区（CTA + 搜索）+ 时间桶索引卡列表（鼠标光晕 + active glow）+ 底部导航。
 *
 * V2 变化：从单行 list-item 升级为「索引卡」——
 *   - card-t 标题（2 行 clamp）+ card-ft 元信息行（轮数 accent / 时长 / 来源数 / 相对时间）
 *   - active 态：lime-soft gradient + lime border + glow-sm
 *   - 鼠标跟随光晕（--mx/--my + radial-gradient，reduced-motion 关闭）
 */
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Plus, BookOpen, Clock, Search, X, Telescope, CalendarRange, Trash2 } from "@lucide/vue";
import {
  LENS_OPTIONS,
  TIME_RANGE_OPTIONS,
  type Conversation,
} from "@ai-insight/shared-types";
import ConfirmDialog from "./ConfirmDialog.vue";

const props = defineProps<{
  conversations: Conversation[];
  currentConvId: string | null;
}>();

const emit = defineEmits<{ newInsight: []; select: [c: Conversation]; remove: [c: Conversation]; goReports: [] }>();
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

// ── 时间桶：今天 / 本周 / 更早 ──────────────────────────────────────────────
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const TODAY = startOfToday();
const WEEK = TODAY - 6 * 24 * 3600 * 1000;

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
const reportsCount = 12; // 占位：真实值待 ReportsStore
const schedulesCount = 4; // 占位

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return new Date(iso).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace("/", "-");
}

// ── config 派生标签（卡片底栏元信息） ──────────────────────────────────────
// 后端 Conversation 只有 title/config/createdAt/updatedAt；messageCount/sourceCount 需 N+1 请求。
// 这里用 config 里已有的 lens（视角）+ timeRange（时间窗）作为卡片元信息，零额外请求。
function lensLabel(c: Conversation): string | null {
  const k = c.config?.lens;
  if (!k) return null;
  return LENS_OPTIONS.find((o) => o.key === k)?.label ?? null;
}
function timeRangeLabel(c: Conversation): string | null {
  const v = c.config?.timeRange;
  if (!v) return null;
  return TIME_RANGE_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

function clearQuery() {
  query.value = "";
}

// ── 鼠标跟随光晕（写在卡片 CSS 变量上；reduced-motion 时不绑监听）──────────────
function onCardMove(e: MouseEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
  el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
}

// ── 删除：Ctrl/Cmd+点击直接删（跳过确认）；普通点击弹 ConfirmDialog ─────────────
const pendingDelete = ref<Conversation | null>(null);
function onDeleteClick(e: MouseEvent, c: Conversation) {
  // 阻止冒泡到卡片本身（避免触发 select）
  e.stopPropagation();
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Ctrl（Win）/ Cmd（Mac）+ 点击：直接删除，不二次确认
    emit("remove", c);
    return;
  }
  pendingDelete.value = c;
}
function confirmDelete() {
  if (pendingDelete.value) emit("remove", pendingDelete.value);
  pendingDelete.value = null;
}
function cancelDelete() {
  pendingDelete.value = null;
}
// 卡片键盘可达性：div[role=button] 补 Enter/Space → select
function onCardKeydown(e: KeyboardEvent, c: Conversation) {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    emit("select", c);
  }
}
// 平台相关提示文案（Win: Ctrl / Mac: ⌘）。在 script 算好，模板直接引用。
const delShortcutHint = (() => {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "")) {
    return "（⌘+点击直接删除）";
  }
  return "（Ctrl+点击直接删除）";
})();
</script>

<template>
  <aside class="col-left">
    <!-- ─── 工具区 ─── -->
    <div class="sb-tool">
      <button class="new-btn" type="button" @click="emit('newInsight')">
        <Plus :size="15" :stroke-width="2.4" />
        <span>新对话</span>
        <span class="kbd">⌘N</span>
      </button>

      <label class="search">
        <Search :size="13" :stroke-width="2" />
        <input v-model="query" type="text" placeholder="搜索会话" aria-label="搜索会话" />
        <button v-if="query" class="search-clear" type="button" @click="clearQuery" aria-label="清除搜索">
          <X :size="12" :stroke-width="2.4" />
        </button>
      </label>
    </div>

    <!-- ─── 索引卡列表 ─── -->
    <div class="conv-list scroll">
      <template v-if="buckets.length">
        <div v-for="b in buckets" :key="b.key" class="bucket">
          <div class="bk-head">
            <span class="bk-label">{{ b.label }}</span>
            <span class="bk-line"></span>
            <span class="bk-count">{{ String(b.items.length).padStart(2, "0") }}</span>
          </div>
          <div
            v-for="c in b.items"
            :key="c.id"
            class="card"
            :class="{ active: c.id === currentConvId }"
            role="button"
            tabindex="0"
            :aria-label="`会话：${c.title}`"
            @click="emit('select', c)"
            @keydown="onCardKeydown($event, c)"
            @mousemove="onCardMove($event, $event.currentTarget as HTMLElement)">
            <div class="card-hd">
              <div class="card-t">{{ c.title }}</div>
              <!-- 删除按钮：hover 时右上角浮现 rose 危险态 icon button。
                   Ctrl/Cmd+点击直删；普通点击弹 ConfirmDialog。 -->
              <button
                class="del-btn"
                type="button"
                :title="`删除会话${delShortcutHint}`"
                :aria-label="`删除会话：${c.title}`"
                @click="onDeleteClick($event, c)">
                <Trash2 :size="13" :stroke-width="2" />
              </button>
            </div>
            <div class="card-ft">
              <!-- 元信息行：视角（accent）+ 时间窗 + 相对时间。
                   后端 Conversation 无 messageCount/sourceCount，用 config 已有字段填充。 -->
              <span v-if="lensLabel(c)" class="meta acc">
                <Telescope :size="11" :stroke-width="2" />
                {{ lensLabel(c) }}
              </span>
              <span v-if="timeRangeLabel(c)" class="meta">
                <CalendarRange :size="11" :stroke-width="2" />
                {{ timeRangeLabel(c) }}
              </span>
              <span class="card-time">{{ relTime(c.updatedAt) }}</span>
            </div>
          </div>
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

    <!-- ─── 底部导航 ─── -->
    <div class="side-bottom">
      <button class="nav-link" type="button" @click="emit('goReports')">
        <BookOpen :size="15" :stroke-width="1.8" />
        <span class="nav-label">我的报告</span>
        <span class="nav-count">{{ String(reportsCount).padStart(2, "0") }}</span>
      </button>
      <button class="nav-link" type="button" @click="goSchedules">
        <Clock :size="15" :stroke-width="1.8" />
        <span class="nav-label">我的定时</span>
        <span class="nav-count">{{ String(schedulesCount).padStart(2, "0") }}</span>
      </button>
    </div>

    <!-- 删除二次确认弹窗（danger 态：rose 语义色 + AlertTriangle 形素冗余） -->
    <ConfirmDialog
      :open="!!pendingDelete"
      title="删除会话"
      :message="pendingDelete ? `确定删除「${pendingDelete.title}」？该会话的历史记录将一并移除。` : ''"
      confirm-text="删除"
      @confirm="confirmDelete"
      @cancel="cancelDelete" />
  </aside>
</template>

<style scoped>
.col-left {
  background: color-mix(in srgb, var(--bg) 50%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── 工具区 ─────────────────────────────────────────────── */
.sb-tool {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

/* 新对话按钮：lime gradient 底 + glow on hover + kbd。
   非实色 CTA——用 accent-soft gradient + lime 文字，更"信号感"，配 glow-md。
   布局：图标 + "新对话" 居中成组，kbd 右浮——用 padding 留出 kbd 空间避免与居中文字打架。 */
.new-btn {
  width: 100%;
  height: 40px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: var(--t-mid);
  background: linear-gradient(135deg, var(--accent-soft), transparent);
  color: var(--accent-text);
  border: 1px solid var(--accent-line);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  /* 不用 justify-content:center——会让 margin-left:auto 的 kbd 与居中文字互相拉扯。
     改为左侧成组（图标+文字）+ 右侧 kbd（margin-left:auto），视觉更稳。 */
  gap: 8px;
  padding: 0 14px;
  position: relative;
  overflow: hidden;
}
/* hover：边框转实 accent + glow-md + 极轻上抬 */
.new-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(400px circle at 50% 0%, var(--accent-soft), transparent 60%);
  opacity: 0;
  transition: var(--t-mid);
}
.new-btn:hover {
  border-color: var(--accent);
  box-shadow: var(--glow-md);
  transform: translateY(-1px);
}
.new-btn:hover::before {
  opacity: 1;
}
.new-btn .kbd {
  margin-left: auto; /* 推到右侧，与左侧"图标+新对话"成组拉开距离 */
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--r-xs);
  padding: 1px 5px;
  font-weight: 500;
  line-height: 1.4;
}

/* 搜索框 */
.search {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text-4);
  transition: var(--t-fast);
}
.search:focus-within {
  border-color: var(--accent-line);
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
  font-size: 13px;
  color: var(--text);
  outline: none;
  line-height: 1;
}
.search input::placeholder {
  color: var(--text-4);
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
  color: var(--text-4);
  cursor: pointer;
  transition: var(--t-fast);
}
.search-clear:hover {
  color: var(--accent);
  background: var(--surface-2);
}

/* ─── 列表 ──────────────────────────────────────────────── */
.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 16px;
}

.bucket + .bucket {
  margin-top: 6px;
}

/* 时间桶头：label + hairline + count（原型 .bk 风） */
.bk-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px 8px;
}
.bk-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-4);
  text-transform: uppercase;
}
.bk-line {
  flex: 1;
  height: 1px;
  background: var(--border);
}
.bk-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
  font-feature-settings: "zero";
}

/* 索引卡（核心 V2 升级）—— 12px 圆角卡片 + 鼠标光晕 + active glow。
   注：原为 <button>，因内嵌删除按钮（HTML 不允许 button 嵌套 button）改为 <div role=button>。 */
.card {
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 8px;
  cursor: pointer;
  transition: var(--t-mid);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: linear-gradient(160deg, var(--surface), var(--bg-2));
  overflow: hidden;
  position: relative;
  padding: 0;
  outline: none;
}
/* div[role=button] 丢失了原生 button 的 focus 表现，补 focus-visible ring */
.card:focus-visible {
  box-shadow: var(--ring);
  border-color: var(--accent-line);
}
/* 鼠标跟随光晕（radial-gradient at --mx --my）—— reduced-motion 时不绑监听即不出现 */
.card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: var(--r-md);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--t-mid);
  background: radial-gradient(400px circle at var(--mx, 50%) var(--my, 0%), var(--accent-soft), transparent 50%);
}
.card:hover {
  border-color: var(--border-2);
  transform: translateY(-1px);
}
.card:hover::before {
  opacity: 1;
}
/* active：lime-soft gradient + lime border + glow-sm */
.card.active {
  border-color: var(--accent-line);
  background: linear-gradient(160deg, var(--accent-soft), var(--bg-2));
  box-shadow: var(--glow-sm);
}
.card.active::before {
  opacity: 1;
}

.card-hd {
  padding: 12px 14px 7px;
  position: relative;
}
/* 删除按钮：hover 时右上角浮现；rose 危险态（DESIGN.md icon button 32×32 + Abort rose 语义）。
   z-index:1 浮于 .card::before 鼠标光晕之上。默认 opacity:0，.card:hover 才显形。 */
.del-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-xs);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-3);
  cursor: pointer;
  opacity: 0;
  transition: var(--t-fast);
  z-index: 1;
}
.card:hover .del-btn,
.card:focus-within .del-btn {
  opacity: 1;
}
.del-btn:hover {
  color: var(--rose);
  border-color: var(--rose-line);
  background: var(--rose-soft);
}
.card-t {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.35;
  letter-spacing: -0.005em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* 留出右上角删除按钮的空间，避免标题末尾被遮挡 */
  padding-right: 30px;
}
.card.active .card-t {
  color: var(--accent-text);
}

.card-ft {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 7px 14px 10px;
  border-top: 1px solid var(--border);
}
.card.active .card-ft {
  border-top-color: var(--accent-line);
}
/* 元信息项：图标 + 文本，项间用 hairline 分隔（对齐原型 .meta） */
.meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  padding-right: 9px;
  margin-right: 9px;
  border-right: 1px solid var(--border);
  line-height: 1;
}
.meta:last-of-type {
  /* 最后一项 meta 不画右边线（card-time 紧跟其后） */
  border-right: none;
}
.meta :deep(svg) {
  flex: none;
  color: var(--text-4);
}
/* acc 项：柠绿强调（视角 lens 是最有区分度的元信息） */
.meta.acc {
  color: var(--accent-text);
}
.meta.acc :deep(svg) {
  color: var(--accent);
}
.card.active .meta.acc {
  color: var(--accent);
}
.card-time {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
  font-feature-settings: "zero";
}

/* ─── 空态 ──────────────────────────────────────────────── */
.list-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-4);
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
  padding: 10px;
  display: flex;
  gap: 6px;
}
.nav-link {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border-radius: var(--r-sm);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: var(--t-fast);
  border: 1px solid transparent;
  background: transparent;
}
.nav-link:hover {
  background: var(--surface);
  color: var(--accent);
  border-color: var(--border);
}
.nav-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-4);
}

@media (prefers-reduced-motion: reduce) {
  .new-btn,
  .new-btn::before,
  .search,
  .search-clear,
  .card,
  .card::before,
  .del-btn,
  .nav-link {
    transition: none;
  }
  .new-btn:hover,
  .card:hover {
    transform: none;
  }
  /* reduced-motion 下卡片的鼠标光晕不出现（监听仍在跑但 transition: none 让它瞬变；
     更彻底可在 onCardMove 里 matchMedia 短路，这里 transition 关闭已足够） */
}
</style>
