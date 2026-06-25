<script setup lang="ts">
/**
 * ConversationView — 三栏洞察工作台容器（Signal Observatory）。
 *
 * 只负责：编排三栏 grid + 持有状态/composable + 把数据 props 传给子组件。
 * 视觉与交互细节下沉到 components/。
 * 布局：左栏(会话列表) + 主区(对话：历史/运行流/报告卡) + 证据面板 + 底部 composer。
 */
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import {
  LENS_OPTIONS,
  type Conversation, type ConversationConfig, type DataSourceTag, type Message, type Report, type LensKey, type TimeRange,
} from "@ai-insight/shared-types";
import { listConversations, createConversation, getConversation, sendMessage } from "@ai-insight/api-client";
import { useInsightRun } from "../composables/useInsightRun.js";
import { isUxMode } from "../utils";

import AppTopbar from "../components/AppTopbar.vue";
import SidebarLeft from "../components/SidebarLeft.vue";
import MessageList from "../components/MessageList.vue";
import RunStream from "../components/RunStream.vue";
import ReportCard from "../components/ReportCard.vue";
import EvidencePanel from "../components/EvidencePanel.vue";
import Composer from "../components/Composer.vue";
import type { ToolCallState } from "../components/types";

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
const loading = ref(false);

const config = reactive<ConversationConfig>({
  timeRange: "1w",
  tagPrefs: ["tech", "news"],
  lens: "deep",
});
const lensIdx = ref(0);
const lens = computed(() => LENS_OPTIONS[lensIdx.value]);

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
    if (c.config) {
      config.timeRange = c.config.timeRange;
      config.tagPrefs = c.config.tagPrefs ?? ["tech", "news"];
      config.lens = c.config.lens ?? "deep";
      const li = LENS_OPTIONS.findIndex((l) => l.key === config.lens);
      if (li >= 0) lensIdx.value = li;
    }
  } catch (e) {
    console.error("load conversation failed", e);
  } finally {
    loading.value = false;
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
    const r = await sendMessage(currentConv.value.id, text, { ...config, lens: lens.value.key });
    run.subscribe(r.run.id);
  } catch (e) {
    console.error("send failed", e);
  }
}

function onToggleTag(t: DataSourceTag) {
  const i = config.tagPrefs.indexOf(t);
  if (i >= 0) config.tagPrefs.splice(i, 1);
  else config.tagPrefs.push(t);
}
function onCycleLens() {
  lensIdx.value = (lensIdx.value + 1) % LENS_OPTIONS.length;
  config.lens = LENS_OPTIONS[lensIdx.value].key;
}

function newInsight() {
  router.push("/c/new");
}
function selectConversation(c: Conversation) {
  router.push(`/c/${c.id}`);
}
function openReport(id: string) {
  router.push(`/reports/${id}`);
}

// 工具调用（reactive 数组 → 传给子组件；类型为 ToolCallState[]）
const toolCalls = computed<ToolCallState[]>(() => run.toolCalls as unknown as ToolCallState[]);

watch(() => run.report, () => scrollToBottom());
watch(() => run.status, () => scrollToBottom());

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
  <div class="shell grid-bg">
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

      <main class="convo">
        <div class="convo-scroll scroll" ref="convoScroll">
          <div class="convo-inner">
            <MessageList
              :messages="messages"
              :idle="run.status.value === 'idle'"
              :loading="loading" />

            <RunStream
              :status="run.status.value"
              :assistant-text="run.assistantText.value"
              :thinking="run.thinking.value"
              :tool-calls="toolCalls" />

            <ReportCard
              v-if="run.report.value"
              :report="run.report.value"
              @open="openReport"
              @download="(id: string) => { /* 默认 href 行为即可 */ }" />
          </div>
        </div>

        <Composer
          :status="run.status.value"
          :time-range="config.timeRange"
          :tag-prefs="config.tagPrefs"
          :lens="config.lens ?? 'deep'"
          @send="onSend"
          @abort="run.abort()"
          @update:time-range="(v: TimeRange) => (config.timeRange = v)"
          @toggle-tag="onToggleTag"
          @cycle-lens="onCycleLens" />
      </main>

      <EvidencePanel :tool-calls="toolCalls" />
    </div>
  </div>
</template>

<style>
/* 容器布局：两行(topbar/panes)；panes 三栏，composer 内嵌于主列底部 */
.shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  height: 100vh;
}
.panes {
  display: grid;
  grid-template-columns: 256px 1fr 332px;
  min-height: 0;
}
.convo {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg);
}
.convo-scroll {
  flex: 1;
  overflow-y: auto;
}
.convo-inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 30px 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
