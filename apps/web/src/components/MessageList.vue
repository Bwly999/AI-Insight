<script setup lang="ts">
/**
 * MessageList — 历史消息（Workbench 风格）。
 * 用 fromMessages 把 DB 历史 Message[] + 报告 聚合成 turns：
 *   user turn → 右对齐气泡；assistant turn → AI 头像 + MessageBlocks（有序思考/工具/回复块）。
 *   turn.report（若该轮 run 产出了报告）→ ReportCard，归位到该 turn 末尾。
 * 兼容旧数据：单条 text assistant 消息 → 含单个 TextBlock 的 turn。
 */
import { computed } from "vue";
import { Sparkles } from "@lucide/vue";
import type { Message, ReportSummary } from "@ai-insight/shared-types";
import { fromMessages } from "../composables/blocks";
import MessageBlocks from "./MessageBlocks.vue";
import ReportCard from "./ReportCard.vue";

const props = defineProps<{
  messages: Message[];
  /** 该对话的全部历史报告（按 runId 归位到产生它的 turn 末尾渲染）。 */
  reports?: ReportSummary[];
  idle: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{ openReport: [id: string]; downloadReport: [id: string] }>();

const turns = computed(() => fromMessages(props.messages, props.reports ?? []));

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <template v-for="t in turns" :key="t.id">
    <!-- 用户气泡 -->
    <div v-if="t.role === 'user'" class="turn user fade-up">
      <div class="b-user">
        <div class="u-eb">你 · {{ timeLabel(t.at) }}</div>
        {{ t.text }}
      </div>
    </div>

    <!-- AI 回复（有序 blocks：思考 / 工具 / 回复 + 报告卡） -->
    <div v-else class="turn ai fade-up">
      <div class="ai-ava">A</div>
      <div class="ai-body">
        <div class="ai-eb">AI-Insight</div>
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
    <div class="hero-glyph"><Sparkles :size="56" :stroke-width="1.4" /></div>
    <div class="big">发起一次洞察</div>
    <p>描述你想了解的赛道或问题，Agent 会自主调度数据源（搜索 · RSS · 爬虫）并综合成报告。</p>
    <div class="hero-hints">
      <span class="hint"><span class="dot" style="background: var(--src-search)"></span>搜索</span>
      <span class="hint"><span class="dot" style="background: var(--src-rss)"></span>RSS</span>
      <span class="hint"><span class="dot" style="background: var(--src-crawl)"></span>爬虫</span>
    </div>
  </div>
</template>

<style scoped>
.turn.user { display: flex; justify-content: flex-end; }
.b-user {
  max-width: 74%; padding: 11px 15px;
  border-radius: 14px 14px 4px 14px;
  background: var(--surface-3); color: var(--text);
  font-size: 14px; line-height: 1.6;
}
.u-eb { font-size: 11px; font-weight: 600; color: var(--text-3); margin-bottom: 5px; }

.turn.ai { display: flex; gap: 13px; }
.ai-ava {
  width: 30px; height: 30px; border-radius: 9px; flex: none;
  background: var(--surface-3); color: var(--text);
  display: grid; place-items: center;
  font-weight: 700; font-size: 13px;
  border: 1px solid var(--border);
}
.ai-body { flex: 1; min-width: 0; }
.ai-eb { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }

.empty { padding: 8vh 40px 40px; }
.hero-glyph {
  display: flex; color: var(--accent);
  opacity: 0.5; margin-bottom: 12px;
}
.empty p { margin-top: 8px; max-width: 420px; line-height: 1.6; }
.hero-hints { display: flex; gap: 16px; margin-top: 22px; }
.hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 11px; color: var(--text-3);
  padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--r-pill);
}
</style>
