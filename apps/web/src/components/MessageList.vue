<script setup lang="ts">
/**
 * MessageList — 历史消息（Workbench 风格）。
 * 用 fromAgentMessages 把 Pi 原生 AgentMessage[] + 报告 聚合成 turns：
 *   user turn → 右对齐气泡；assistant turn → AI 头像 + MessageBlocks（有序思考/工具/回复块）。
 *   turn.report（若该轮 run 产出了报告）→ ReportCard，按时间线归位到该 turn 末尾。
 */
import { computed } from "vue";
import { Sparkles } from "@lucide/vue";
import type { AgentMessage, ReportSummary } from "@ai-insight/shared-types";
import { fromAgentMessages } from "../composables/blocks";
import MessageBlocks from "./MessageBlocks.vue";
import ReportCard from "./ReportCard.vue";
import AgentMark from "./AgentMark.vue";

const props = defineProps<{
  messages: AgentMessage[];
  /** 该对话的全部历史报告（按时间线归位到产生它的 turn 末尾渲染）。 */
  reports?: ReportSummary[];
  idle: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{ openReport: [id: string]; downloadReport: [id: string] }>();

const turns = computed(() => fromAgentMessages(props.messages, props.reports ?? []));

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <template v-for="t in turns" :key="t.id">
    <!-- 用户气泡 -->
    <div v-if="t.role === 'user'" class="turn user">
      <div class="b-user">
        <div class="u-eb"><span class="u-who">你</span><span class="u-t">{{ timeLabel(t.at) }}</span></div>
        <div class="u-text">{{ t.text }}</div>
      </div>
    </div>

    <!-- AI 回复（有序 blocks：思考 / 工具 / 回复 + 报告卡） -->
    <div v-else class="turn ai">
      <div class="ai-ava"><AgentMark :size="16" /></div>
      <div class="ai-body">
        <div class="ai-eb">
          <span class="ai-name">AI-Insight</span>
          <span class="ai-dot"></span>
          <span class="ai-role">Deep Lens</span>
        </div>
        <MessageBlocks :blocks="t.blocks ?? []" :default-think-open="false" />
        <ReportCard
          v-if="t.report"
          :report="t.report"
          @open="emit('openReport', $event)"
          @download="emit('downloadReport', $event)" />
      </div>
    </div>
  </template>

  <div v-if="!messages.length && idle && !loading" class="empty">
    <div class="hero-glyph"><Sparkles :size="44" :stroke-width="1.4" /></div>
    <div class="big">发起一次洞察</div>
    <p>描述你想了解的赛道或问题，Agent 会自主调度数据源并综合成报告。</p>
    <div class="hero-hints">
      <span class="hint"><span class="dot" style="background: var(--src-search)"></span>搜索</span>
      <span class="hint"><span class="dot" style="background: var(--src-rss)"></span>RSS</span>
      <span class="hint"><span class="dot" style="background: var(--src-crawl)"></span>爬虫</span>
    </div>
  </div>
</template>

<style scoped>
/* ─── 用户气泡：右对齐，tone-on-tone 的克制块 ───────────────── */
.turn.user { display: flex; justify-content: flex-end; }
.b-user {
  max-width: 74%; padding: 10px 14px 11px;
  border-radius: 14px 14px 4px 14px;
  background: var(--surface-2); color: var(--text);
  border: 1px solid var(--border);
  font-size: 14px; line-height: 1.6;
}
.u-eb {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px;
}
.u-who {
  font-size: 11px; font-weight: 700; color: var(--text-2); letter-spacing: 0.01em;
}
.u-t {
  font-family: var(--mono); font-size: 10px; color: var(--text-4);
  letter-spacing: 0.02em; font-weight: 500;
}
.u-text { white-space: pre-wrap; word-break: break-word; }

/* ─── AI 回复 ─────────────────────────────────────────────── */
.turn.ai { display: flex; gap: 13px; }
/* unslop-ignore: AI 头像用 accent-soft tint 承载 agent 身份——
   柠绿作为“信号/身份”的合法应用，配 glow-sm 信号发光。 */
.ai-ava {
  width: 30px; height: 30px; border-radius: var(--r-sm); flex: none;
  background: var(--accent-soft); color: var(--accent);
  display: grid; place-items: center;
  border: 1px solid var(--accent-line);
  /* 精致内边沿 + 信号发光：让 tint 块有“徽章”质感 + agent 身份信号 */
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), var(--glow-sm);
}
.ai-body { flex: 1; min-width: 0; }
.ai-eb {
  display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
}
.ai-name {
  font-size: 12.5px; font-weight: 700; color: var(--text); letter-spacing: -0.005em;
}
.ai-dot {
  width: 2.5px; height: 2.5px; border-radius: 50%; background: var(--text-4); flex: none;
}
.ai-role {
  font-family: var(--mono); font-size: 9.5px; font-weight: 600;
  color: var(--accent-text); letter-spacing: 0.1em; text-transform: uppercase;
  padding: 2px 6px; border-radius: var(--r-xs);
  background: var(--accent-soft); border: 1px solid var(--accent-line);
}

/* ─── 空态：首屏焦点 ──────────────────────────────────────── */
.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 7vh 40px 40px;
}
/* unslop-ignore: 空态是首屏唯一焦点，accent-soft 容器承载柠绿“仪器已就绪”语义 + glow 信号 */
.hero-glyph {
  display: inline-flex; align-items: center; justify-content: center;
  width: 76px; height: 76px; border-radius: 50%; flex: none;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid var(--accent-line);
  margin-bottom: 22px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), var(--glow-md);
}
.big {
  font-size: var(--fs-2xl); color: var(--text); font-weight: 700;
  letter-spacing: -0.015em;
}
.empty p {
  margin-top: 10px; max-width: 420px; line-height: 1.65;
  color: var(--text-2); font-size: 14px;
}
.hero-hints { display: flex; gap: 10px; margin-top: 26px; }
.hint {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--mono); font-size: 11px; color: var(--text-2); font-weight: 600;
  padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--r-pill);
  background: var(--surface); letter-spacing: 0.04em; text-transform: uppercase;
}
</style>

