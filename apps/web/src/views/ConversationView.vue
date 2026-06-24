<script setup lang="ts">
/**
 * ConversationView — 三栏洞察工作台（忠实还原 prototype/user-end-workstation-v2.html）。
 *
 * 布局：左侧栏(会话列表) + 主区(对话：run步骤/思考/工具卡/报告卡) + 证据面板。
 * 底部 ChatGPT 风格 composer（时间窗/标签/Lens）。
 */
import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import {
  TIME_RANGE_OPTIONS, LENS_OPTIONS, ALL_TAGS, TAG_LABELS,
  type Conversation, type ConversationConfig, type DataSourceTag, type Message, type Report,
} from "@ai-insight/shared-types";
import {
  listConversations, createConversation, getConversation, sendMessage,
} from "@ai-insight/api-client";
import { useInsightRun } from "../composables/useInsightRun.js";

const props = defineProps<{ id: string }>();
const router = useRouter();

// ─── 会话列表 ─────────────────────────────────────────────────────────────
const conversations = ref<Conversation[]>([]);
async function loadConversations() {
  try {
    const r = await listConversations();
    conversations.value = r.items;
  } catch (e) { console.error(e); }
}

// ─── 当前会话 ─────────────────────────────────────────────────────────────
const currentConv = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);
const loading = ref(false);

// 配置（时间窗/标签/Lens）位于 composer
const config = reactive<ConversationConfig>({
  timeRange: "1w",
  tagPrefs: ["tech", "news"],
  lens: "deep",
});
const lensIdx = ref(0);
const lens = computed(() => LENS_OPTIONS[lensIdx.value]);
const cycleLens = () => { lensIdx.value = (lensIdx.value + 1) % LENS_OPTIONS.length; };
const toggleTag = (t: DataSourceTag) => {
  const i = config.tagPrefs.indexOf(t);
  if (i >= 0) config.tagPrefs.splice(i, 1);
  else config.tagPrefs.push(t);
};

async function loadConversation(id: string) {
  if (id === "new") {
    // 新建：先建会话再跳转
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

const draft = ref("");
const ta = ref<HTMLTextAreaElement | null>(null);
const convoScroll = ref<HTMLElement | null>(null);

const autoGrow = async () => {
  await nextTick();
  const el = ta.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
};

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
};

async function send() {
  const text = draft.value.trim();
  if (!text || !currentConv.value) return;
  // 立即把用户消息加到 UI
  messages.value.push({
    id: `temp_${Date.now()}`,
    conversationId: currentConv.value.id,
    role: "user",
    content: { kind: "text", text },
    createdAt: new Date().toISOString(),
  });
  draft.value = "";
  autoGrow();
  await scrollToBottom();
  try {
    const r = await sendMessage(currentConv.value.id, text, { ...config, lens: lens.value.key });
    run.subscribe(r.run.id);
  } catch (e) {
    console.error("send failed", e);
  }
}

async function scrollToBottom() {
  await nextTick();
  const el = convoScroll.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(() => run.report, () => scrollToBottom());
watch(() => run.status, () => scrollToBottom());

function newInsight() {
  router.push("/c/new");
}

function selectConversation(c: Conversation) {
  router.push(`/c/${c.id}`);
}

onMounted(() => {
  loadConversations();
  loadConversation(props.id);
});

watch(() => props.id, (id) => {
  if (id) loadConversation(id);
});

// 证据面板：把工具命中的信号模拟（实际从 run 事件取；MVP 用工具调用 found 数展示）
const evidence = computed(() => run.toolCalls);

// 颜色辅助
function srcColor(toolName: string): string {
  if (toolName === "search") return "#2563eb";
  if (toolName === "fetch_rss") return "#7c3aed";
  return "#ea580c";
}
function toolLabel(t: string): string {
  return ({ search: "搜索", crawl: "抓取", fetch_rss: "RSS", extract_content: "提取", list_datasources: "数据源", save_report: "报告" } as Record<string, string>)[t] ?? t;
}
</script>

<template>
  <div class="shell">
    <!-- TOPBAR -->
    <header class="topbar">
      <div class="flex items-center gap-2.5">
        <div class="brand-mark">洞</div>
        <span class="font-semibold text-[14px] tracking-tight">AI-Insight</span>
      </div>
      <span class="crumb-sep">/</span>
      <span class="text-[13px]" style="color: var(--ink-2)">会话</span>
      <span class="crumb-sep">/</span>
      <span class="text-[13px] font-medium">{{ currentConv?.title ?? "新洞察" }}</span>

      <div class="ml-3 flex items-center gap-2" v-if="run.status.value !== 'idle'">
        <span v-if="run.status.value === 'running'" class="run-pill" style="background: var(--brand-soft); color: var(--brand-2); border-color: var(--brand-line)">
          <span class="dot pulse" style="background: var(--brand)"></span>运行中
        </span>
        <span v-else-if="run.status.value === 'completed'" class="run-pill">
          <span class="dot" style="background: var(--green)"></span>已完成
        </span>
        <span v-else-if="run.status.value === 'failed'" class="run-pill" style="background: var(--rose-soft); color: var(--rose); border-color: var(--rose)">
          <span class="dot" style="background: var(--rose)"></span>失败
        </span>
        <span class="label" v-if="run.status.value === 'running'">耗时 {{ run.elapsed.value }}</span>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button class="ghost-btn" v-if="run.status.value === 'running'" @click="run.abort()">
          <span class="dot" style="background: var(--rose)"></span>中止运行
        </button>
        <div class="u-ava" title="WL">WL</div>
      </div>
    </header>

    <!-- PANES -->
    <div class="panes">
      <!-- SIDEBAR -->
      <aside class="sidebar">
        <div class="p-3 space-y-2.5">
          <button class="new-insight w-full" @click="newInsight">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            发起新洞察
          </button>
        </div>
        <div class="px-3 pb-1 flex items-center justify-between">
          <span class="label">最近会话</span>
          <span class="label">{{ conversations.length }}</span>
        </div>
        <div class="flex-1 overflow-y-auto scroll px-2 pb-2 space-y-0.5">
          <button v-for="c in conversations" :key="c.id" class="conv-item"
            :class="{ active: c.id === currentConv?.id }" @click="selectConversation(c)">
            <div class="t">{{ c.title }}</div>
            <div class="m">{{ c.updatedAt.slice(0, 10) }}</div>
          </button>
        </div>
        <div class="border-t p-2 space-y-0.5" style="border-color: var(--line)">
          <div class="nav-link" @click="router.push('/reports')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            我的报告
          </div>
        </div>
      </aside>

      <!-- CONVERSATION -->
      <main class="convo">
        <div class="convo-scroll scroll" ref="convoScroll">
          <div class="convo-inner space-y-6">
            <!-- 历史消息 -->
            <template v-for="m in messages" :key="m.id">
              <div v-if="m.role === 'user'" class="msg-user reveal">
                <div class="bubble-user" v-if="m.content.kind === 'text'">{{ m.content.text }}</div>
              </div>
              <div v-else-if="m.role === 'assistant' && m.content.kind === 'text'" class="msg-ai reveal">
                <div class="ai-ava">洞</div>
                <div class="ai-body"><p class="ai-text">{{ m.content.text }}</p></div>
              </div>
            </template>

            <!-- 运行中：步骤 + 思考 + 工具卡 -->
            <div v-if="run.status.value === 'running' || run.assistantText.value || run.toolCalls.length" class="msg-ai reveal">
              <div class="ai-ava"><span v-if="run.status.value==='running'" class="ring" style="width:14px;height:14px"></span><template v-else>洞</template></div>
              <div class="ai-body space-y-3">
                <!-- 工具调用 timeline -->
                <div v-if="run.toolCalls.length">
                  <div class="section-label"><span class="label">工具调用</span><span class="ln"></span></div>
                  <div class="tools">
                    <div v-for="c in run.toolCalls" :key="c.toolCallId" class="tool">
                      <span class="tool-tag" :style="{ background: ({search:'#e8f0fe',rss:'#f1eafe',crawl:'#fdeee2',fetch_rss:'#f1eafe',extract_content:'#f1f5f9',list_datasources:'#f1f5f9',save_report:'#f1f5f9'} as Record<string,string>)[c.toolName]||'#f1f5f9', color: ({search:'#1d4ed8',rss:'#6d28d9',crawl:'#c2410c',fetch_rss:'#6d28d9'} as Record<string,string>)[c.toolName]||'#475569' }">{{ toolLabel(c.toolName) }}</span>
                      <span class="tool-arg">{{ c.args.query || (c.args.keywords as string[] | undefined)?.join?.(' ') || c.args.url || (c.args.platforms as string[] | undefined)?.join?.('·') || JSON.stringify(c.args).slice(0,50) }}</span>
                      <span v-if="c.found != null" class="tool-found">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {{ c.found }} 条
                      </span>
                      <span v-else-if="c.ok===undefined" class="ring" style="width:10px;height:10px"></span>
                    </div>
                  </div>
                </div>
                <!-- 思考过程 -->
                <div v-if="run.thinking.value.length" class="think">
                  <div class="think-head"><span>思考过程</span><span class="label">{{ run.thinking.value.length }} 段</span></div>
                  <div class="think-body mono">{{ run.thinking.value.slice(-1)[0]?.slice(-200) }}…</div>
                </div>
                <!-- analyst text -->
                <p v-if="run.assistantText.value" class="ai-text">{{ run.assistantText.value }}</p>
              </div>
            </div>

            <!-- 报告卡 -->
            <div v-if="run.report.value" class="report reveal">
              <div class="report-top">
                <span class="dot" style="background: var(--brand)"></span>
                <span class="report-kicker">洞察报告</span>
                <span class="label ml-auto">artifact · html + markdown</span>
              </div>
              <div class="report-body">
                <h2 class="report-title">{{ run.report.value.title }}</h2>
                <p class="report-stand" v-if="run.report.value.standfirst">{{ run.report.value.standfirst }}</p>
                <div class="report-actions">
                  <button class="btn-primary" @click="router.push(`/reports/${run.report.value!.id}`)">
                    查看完整报告
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                  <a class="btn-secondary" :href="`/api/reports/${run.report.value.id}/html`" target="_blank">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    下载 HTML
                  </a>
                </div>
              </div>
            </div>

            <!-- 空态 -->
            <div v-if="messages.length === 0 && run.status.value === 'idle' && !loading" class="empty">
              <div class="big">发起一次洞察</div>
              <p style="margin-top:8px">描述你想了解的赛道或问题，Agent 会自主调度数据源（搜索 · RSS · 爬虫）并综合成报告。</p>
            </div>
          </div>
        </div>
      </main>

      <!-- EVIDENCE -->
      <aside class="evidence">
        <div class="ev-head">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-semibold">证据</span>
            <span class="label">{{ run.toolCalls.length }}</span>
          </div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="dot" style="background:#2563eb"></span>搜索</span>
          <span class="legend-item"><span class="dot" style="background:#7c3aed"></span>RSS</span>
          <span class="legend-item"><span class="dot" style="background:#ea580c"></span>爬虫</span>
        </div>
        <div class="ev-scroll scroll">
          <div v-for="c in evidence" :key="'ev-'+c.toolCallId" class="ev-card">
            <div class="ev-top">
              <span class="ev-src"><span class="dot" :style="{background:srcColor(c.toolName)}"></span>{{ toolLabel(c.toolName) }}</span>
              <span class="ev-rel">{{ c.args.query || (c.args.keywords as string[] | undefined)?.join?.(' ') || '' }}</span>
            </div>
            <div class="ev-title">命中 {{ c.found ?? '…' }} 条信号</div>
            <div class="ev-heat">
              <div class="ev-heat-track"><div class="ev-heat-fill heat-bar" :style="{width: Math.min(100,(c.found??0)*5)+'%', background: srcColor(c.toolName)}"></div></div>
              <span class="ev-heat-n">{{ c.found ?? '—' }}</span>
            </div>
          </div>
          <div v-if="!evidence.length" class="empty" style="height:200px">
            <p>工具调用的证据将在此展示</p>
          </div>
        </div>
      </aside>
    </div>

    <!-- CHAT DOCK -->
    <div class="dock">
      <div class="dock-inner">
        <form class="composer" :class="{ running: run.status.value === 'running' }" @submit.prevent="send">
          <div class="comp-area">
            <textarea ref="ta" v-model="draft" rows="1"
              :placeholder="run.status.value==='running' ? '洞察运行中…可继续追问' : '发起一次洞察，描述你想了解的赛道或问题…'"
              @input="autoGrow" @keydown="onKey"></textarea>
            <button v-if="run.status.value==='running'" type="button" class="stop-btn" @click="run.abort()" title="中止运行">
              <span class="block" style="width:11px;height:11px;background:currentColor;border-radius:2px"></span>
            </button>
            <button v-else type="submit" class="send-btn" :class="draft.trim()? 'on':'off'" :disabled="!draft.trim()" title="发送 (Enter)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </button>
          </div>
          <div class="comp-tools">
            <div class="tool-group">
              <span class="tool-group-label">时间窗</span>
              <button type="button" v-for="r in TIME_RANGE_OPTIONS" :key="r.value" class="rchip"
                :class="{on:r.value===config.timeRange}" @click="config.timeRange=r.value">{{ r.label }}</button>
            </div>
            <div class="v-divider"></div>
            <div class="tool-group">
              <span class="tool-group-label">标签</span>
              <button type="button" v-for="t in ALL_TAGS" :key="t" class="tchip"
                :class="{on:config.tagPrefs.includes(t)}" @click="toggleTag(t)">{{ TAG_LABELS[t] }}</button>
            </div>
            <div class="v-divider"></div>
            <div class="tool-group">
              <button type="button" class="lens" @click="cycleLens">
                视角<span class="v">{{ lens.label }}</span>
              </button>
            </div>
          </div>
        </form>
        <div class="comp-hint">
          <span>洞察由 Agent 自主调度数据源（搜索 · RSS · 爬虫）并综合成报告。</span>
          <span><span class="kbd">Enter</span> 发送 · <span class="kbd">Shift</span>+<span class="kbd">Enter</span> 换行</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./conversation.css"></style>
