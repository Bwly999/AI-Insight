<script setup lang="ts">
/**
 * ConversationView — 三栏 Workbench 容器。
 * 左栏(会话列表) + 主区(conv-head + 历史/运行流/报告卡 + composer) + 右栏(数据源)。
 */
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
import { ChevronDown } from "@lucide/vue";
import { useRouter } from "vue-router";
import {
  type Conversation, type ConversationConfig, type AgentMessage, type TimeRange, type Report, type ReportSummary,
} from "@ai-insight/shared-types";
import { listConversations, createConversation, getConversation, sendMessage } from "@ai-insight/api-client";
import { useInsightRun } from "../composables/useInsightRun.js";
import { isUxMode } from "../utils";
import { downloadReportHtml } from "../utils/download";

import AppTopbar from "../components/AppTopbar.vue";
import SidebarLeft from "../components/SidebarLeft.vue";
import MessageList from "../components/MessageList.vue";
import RunStream from "../components/RunStream.vue";
import ReportCard from "../components/ReportCard.vue";
import EvidencePanel from "../components/EvidencePanel.vue";
import ClarifyCard from "../components/ClarifyCard.vue";
import Composer from "../components/Composer.vue";
import ReportModal from "../components/ReportModal.vue";
import type { ToolBlock } from "../composables/blocks";
import { toolBlocksOf } from "../composables/blocks";

const props = defineProps<{ id: string }>();
const router = useRouter();

// ─── 会话列表 ─────────────────────────────────────────────────────────────
const conversations = ref<Conversation[]>([]);
async function loadConversations() {
  try {
    const r = await listConversations();
    conversations.value = r.items;
  } catch (e) {
    console.error(e);
  }
}

// ─── 当前会话 ─────────────────────────────────────────────────────────────
const currentConv = ref<Conversation | null>(null);
const messages = ref<AgentMessage[]>([]);
/** 该对话的历史报告（按 createdAt 升序），用于回放时按时间线归位渲染报告卡。 */
const historyReports = ref<ReportSummary[]>([]);
const loading = ref(false);

const config = reactive<ConversationConfig>({
  timeRange: "1w",
  // lens 留空：由 Agent 按意图自主路由（skill 模型）
});

async function loadConversation(id: string) {
  if (id === "new") {
    if (isUxMode()) {
      currentConv.value = {
        id: "ux-conv",
        userId: "ux-user",
        title: "UX Mode Conversation",
        config: { ...config },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return;
    }
    const c = await createConversation({ title: "新洞察", config: { ...config } });
    router.replace(`/c/${c.id}`);
    return;
  }
  loading.value = true;
  try {
    const c = await getConversation(id);
    currentConv.value = c;
    messages.value = c.messages;
    historyReports.value = c.reports ?? [];
    if (c.config) {
      config.timeRange = c.config.timeRange;
      config.lens = c.config.lens;
    }
  } catch (e) {
    console.error("load conversation failed", e);
  } finally {
    loading.value = false;
  }
}

/**
 * 轻量刷新消息（不动 loading/config/标题）。
 * run 完成后调用：从后端拉取 Pi SessionManager 已落盘的 .jsonl 重建的 AgentMessage[]，
 * 这样下一轮 subscribe 清空 run.blocks 时，上轮内容已固化为历史、不会消失。
 *
 * 时序安全：SSE 的 run_completed 在 Pi appendMessage（message_end 时）之后才 emit，
 * 故收到时 .jsonl 必已写完，SessionManager.open + buildSessionContext 即可拿到本轮全部消息。
 */
async function refreshMessages() {
  const id = currentConv.value?.id;
  if (!id || id === "ux-conv") return;
  try {
    const c = await getConversation(id);
    messages.value = c.messages;
    historyReports.value = c.reports ?? [];
  } catch (e) {
    console.error("refresh messages failed", e);
  }
}

// ─── 运行状态 ─────────────────────────────────────────────────────────────
const run = useInsightRun();
const convoScroll = ref<HTMLElement | null>(null);

async function scrollToBottom() {
  await nextTick();
  const el = convoScroll.value;
  if (el) el.scrollTop = el.scrollHeight;
}

// ─── 滚动到底部悬浮按钮 ───────────────────────────────────────────────────
/** 距底部阈值（px）：小于此值视为"已到底"。 */
const SCROLL_BOTTOM_THRESHOLD = 48;
/** 当前对话是否未滚动到底部（用于决定悬浮按钮显隐）。 */
const notAtBottom = ref(false);
/** 用户是否曾向上滚动（避免流式 auto-scroll 与用户阅读打架）。 */
const userScrolledUp = ref(false);

function onConvoScroll() {
  const el = convoScroll.value;
  if (!el) return;
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  const atBottom = distFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  notAtBottom.value = !atBottom;
  userScrolledUp.value = !atBottom;
}

/** 程序化滚到底：重置 flag 并滚到底（用于流式追加 auto-scroll）。 */
async function autoStickToBottom() {
  if (userScrolledUp.value) return; // 用户在向上阅读，不打扰
  await scrollToBottom();
}

function jumpToBottom() {
  userScrolledUp.value = false;
  notAtBottom.value = false;
  scrollToBottom();
}

async function onSend(text: string) {
  if (!currentConv.value) return;

  // Agent 等待澄清时：把发送路由到 reply（暂停/恢复会话），不新建 run
  if (run.status.value === "awaiting_input") {
    run.reply(text);
    return;
  }

  // 乐观插入临时 user message（Pi 原生 UserMessage 结构）。
  // 后端 session.prompt() 时 Pi 会自己 appendMessage 真正的 user message，
  // refreshMessages 拉取后会用权威版本替换这条临时项。
  messages.value.push({
    role: "user",
    content: text,
    timestamp: Date.now(),
  });
  await scrollToBottom();

  if (isUxMode()) {
    run.subscribe("ux-run");
    return;
  }
  try {
    // lens 不再由前端指定：交给 Agent 自主路由
    const r = await sendMessage(currentConv.value.id, text, { ...config });
    run.subscribe(r.run.id);
  } catch (e) {
    console.error("send failed", e);
  }
}

function newInsight() {
  router.push("/c/new");
}
function selectConversation(c: Conversation) {
  router.push(`/c/${c.id}`);
}

// ─── 报告弹窗 ─────────────────────────────────────────────────────────────
// 运行中实时报告 与 历史报告复用同一弹窗
const modalReport = ref<Report | ReportSummary | null>(null);
/** 按 id 查报告：优先实时 run.report（含运行中即时态），否则查历史 historyReports。 */
function findReport(id: string): Report | ReportSummary | undefined {
  if (run.report.value && run.report.value.id === id) return run.report.value;
  return historyReports.value.find((r) => r.id === id);
}
function openReportModal(id: string) {
  const r = findReport(id);
  if (r) modalReport.value = r;
}
function closeReportModal() {
  modalReport.value = null;
}
// 下载报告：经鉴权 fetch 取 on-demand 渲染的 standalone HTML 落盘
// （与弹窗下载共用同一 helper → 同一渲染来源，保证与系统内实时一致）
async function downloadReport(id: string) {
  const r = findReport(id);
  if (!r) return;
  const filename = `${(r.title || "insight-report").replace(/[\\/:*?"<>|]/g, "_")}.html`;
  await downloadReportHtml(id, filename);
}

// ─── 引用：聊天流内 .cite-link 点击暂不弹窗（无 citations 上下文），数字①在 ReportModal 内交互 ──
function onStreamClick(_e: MouseEvent) {
  // 聊天流过程性文字里的 [n] 回退为纯 ①（无链接）；完整引用交互在报告弹窗内。
}

// 工具调用（从 blocks 派生 → 传给 EvidencePanel，仅兼容签名）
const toolCalls = computed<ToolBlock[]>(() => toolBlocksOf(run.blocks.value));

// conv-head meta
const sourceCount = computed(() => {
  // 运行中来源数（来自 toolCalls found 之和的粗略估计无意义；右栏会显示真实数）
  return null;
});
void sourceCount;

watch(() => run.report, () => autoStickToBottom());
watch(() => run.status, () => autoStickToBottom());
// 流式追加新 block / 新消息时，若用户未上滑，跟随到底部
watch(() => run.blocks.value.length, () => autoStickToBottom());
watch(() => messages.value.length, () => autoStickToBottom());

// run 完成或失败时刷新消息：把本轮落库的思考/工具/文本并入历史。
// 解决"第二次发送清空第一次回应"——上轮内容固化进 messages 后，新一轮 subscribe
// 清空 run.blocks 不再导致历史丢失。
watch(
  () => run.status.value,
  (s, prev) => {
    // 仅在从 running/awaiting_input 转入终态时刷新，避免初始化或重复触发
    if ((s === "completed" || s === "failed") && prev !== s && prev !== "idle") {
      refreshMessages();
    }
  },
);

onMounted(() => {
  if (isUxMode()) {
    messages.value.push({
      role: "user",
      content: "Tell me about AI trends in 2024",
      timestamp: Date.now(),
    });
    run.subscribe("ux-run");
  }
  loadConversations();
  // 加载完成后默认贴底
  loadConversation(props.id).then(() => autoStickToBottom());
});
// 滚动监听在模板 @scroll 上绑定，随组件销毁自动解绑。

watch(
  () => props.id,
  (id) => {
    if (!id) return;
    userScrolledUp.value = false;
    notAtBottom.value = false;
    loadConversation(id).then(() => autoStickToBottom());
  },
);
</script>

<template>
  <div class="shell">
    <AppTopbar
      :current-conv="currentConv"
      :status="run.status.value"
      :elapsed="run.elapsed.value"
      @abort="run.abort()" />

    <div class="panes">
      <SidebarLeft
        :conversations="conversations"
        :current-conv-id="currentConv?.id ?? null"
        @new-insight="newInsight"
        @select="selectConversation"
        @go-reports="router.push('/reports')" />

      <main class="col-mid">
        <div class="conv-head" v-if="currentConv && currentConv.id !== 'new'">
          <div class="eb">Deep Lens · 工作台</div>
          <h1>{{ currentConv.title }}</h1>
          <p class="lede" v-if="currentConv.title !== '新洞察'">关于该主题的多源交叉洞察，附完整证据链。</p>
          <div class="meta">
            <span>{{ messages.length }} 轮对话</span>
            <span v-if="run.lens.value">视角 · {{ run.lens.value }}</span>
            <span>{{ new Date(currentConv.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) }}</span>
          </div>
        </div>

        <div class="stream-wrap">
          <div class="stream scroll" ref="convoScroll" @click="onStreamClick" @scroll="onConvoScroll">
            <MessageList
              :messages="messages"
              :reports="historyReports"
              :idle="run.status.value === 'idle'"
              :loading="loading"
              @open-report="openReportModal"
              @download-report="downloadReport" />

            <RunStream
              :status="run.status.value"
              :blocks="run.blocks.value"
              :lens="run.lens.value" />

            <ClarifyCard
              v-if="run.clarification.value"
              :question="run.clarification.value.question"
              :options="run.clarification.value.options"
              @reply="(text: string) => run.reply(text)" />

            <ReportCard
              v-if="run.report.value"
              :report="run.report.value"
              @open="openReportModal"
              @download="downloadReport" />
          </div>

          <button
            v-if="notAtBottom"
            class="scroll-bottom-btn"
            type="button"
            title="滚动到底部"
            aria-label="滚动到底部"
            @click="jumpToBottom">
            <ChevronDown :size="20" :stroke-width="2.2" />
          </button>
        </div>

        <Composer
          :status="run.status.value"
          :time-range="config.timeRange"
          @send="onSend"
          @abort="run.abort()"
          @update:time-range="(v: TimeRange) => (config.timeRange = v)" />
      </main>

      <EvidencePanel :tool-calls="toolCalls" :run-id="run.runId.value" :run-status="run.status.value" />
    </div>

    <ReportModal :report="modalReport" @close="closeReportModal" />
  </div>
</template>

<style>
.shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  height: 100vh;
}
.panes {
  display: grid;
  grid-template-columns: 262px 1fr 340px;
  min-height: 0;
}
@media (max-width: 1180px) {
  .panes { grid-template-columns: 240px 1fr; }
  .col-right { display: none !important; }
}

.col-mid {
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  background: var(--bg);
}
.conv-head {
  padding: 22px 44px 18px; border-bottom: 1px solid var(--border);
  background: var(--surface); flex: none;
}
.conv-head .eb { font-size: 11px; font-weight: 600; color: var(--text-3); letter-spacing: 0.04em; }
.conv-head h1 { font-size: 22px; font-weight: 700; margin: 6px 0 4px; letter-spacing: -0.01em; color: var(--text); }
.conv-head .lede { font-size: 13.5px; color: var(--text-3); max-width: 60ch; margin: 0; }
.conv-head .meta { margin-top: 11px; display: flex; gap: 16px; font-size: 11.5px; color: var(--text-3); font-weight: 500; }

.stream-wrap {
  flex: 1; min-height: 0; position: relative; display: flex;
}

.stream {
  flex: 1; overflow-y: auto; padding: 24px 44px 24px;
}

/* 滚动到底部悬浮按钮 */
.scroll-bottom-btn {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 20px;
  width: 38px; height: 38px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-2);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform var(--t-fast, .15s), box-shadow var(--t-fast, .15s), color var(--t-fast, .15s);
  z-index: 10;
}
.scroll-bottom-btn:hover {
  color: var(--text);
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
.scroll-bottom-btn:active {
  transform: translateX(-50%) translateY(0);
}
</style>
