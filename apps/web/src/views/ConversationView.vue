<script setup lang="ts">
/**
 * ConversationView — 三栏 Workbench 容器。
 * 左栏(会话列表) + 主区(conv-head + 历史/运行流/报告卡 + composer) + 右栏(数据源)。
 */
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import {
  type Conversation, type ConversationConfig, type Message, type TimeRange, type Report, type ReportSummary,
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
const messages = ref<Message[]>([]);
/** 该对话的历史报告（按 createdAt 升序），用于回放时按 runId 归位渲染报告卡。 */
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
 * run 完成后调用：把后端已落库的本轮内容（思考/工具/文本）并入 messages 历史，
 * 这样下一轮 subscribe 清空 run.blocks 时，上轮内容已固化为历史、不会消失。
 *
 * 时序安全：SSE 的 run_completed 在后端 persistBlocks+updateRun 之后才 emit，
 * 故收到时 DB 必已写完，直接拉取即可拿到本轮落库的全部块。
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

async function onSend(text: string) {
  if (!currentConv.value) return;

  // Agent 等待澄清时：把发送路由到 reply（暂停/恢复会话），不新建 run
  if (run.status.value === "awaiting_input") {
    run.reply(text);
    return;
  }

  messages.value.push({
    id: `temp_${Date.now()}`,
    conversationId: currentConv.value.id,
    role: "user",
    content: { kind: "text", text },
    createdAt: new Date().toISOString(),
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

// ─── 引用联动：点击 .cite 高亮右栏对应来源 ─────────────────────────────────
function onStreamClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.classList?.contains("cite")) {
    const n = target.getAttribute("data-cite");
    if (!n) return;
    const el = document.getElementById("src" + n);
    if (el) {
      el.style.borderColor = "var(--accent)";
      el.style.boxShadow = "0 0 0 2px var(--accent-soft)";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        el.style.borderColor = "";
        el.style.boxShadow = "";
      }, 1500);
    }
  }
}

// 工具调用（从 blocks 派生 → 传给 EvidencePanel，仅兼容签名）
const toolCalls = computed<ToolBlock[]>(() => toolBlocksOf(run.blocks.value));

// conv-head meta
const sourceCount = computed(() => {
  // 运行中来源数（来自 toolCalls found 之和的粗略估计无意义；右栏会显示真实数）
  return null;
});
void sourceCount;

watch(() => run.report, () => scrollToBottom());
watch(() => run.status, () => scrollToBottom());

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
      id: `temp_${Date.now()}`,
      conversationId: "ux-conv",
      role: "user",
      content: { kind: "text", text: "Tell me about AI trends in 2024" },
      createdAt: new Date().toISOString(),
    });
    run.subscribe("ux-run");
  }
  loadConversations();
  loadConversation(props.id);
});

watch(
  () => props.id,
  (id) => {
    if (id) loadConversation(id);
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

        <div class="stream scroll" ref="convoScroll" @click="onStreamClick">
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

.stream {
  flex: 1; overflow-y: auto; padding: 24px 44px 24px;
}
</style>
