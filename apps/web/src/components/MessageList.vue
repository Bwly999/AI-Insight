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
        <div class="u-eb">你<span class="u-t">{{ timeLabel(t.at) }}</span></div>
        {{ t.text }}
      </div>
    </div>

    <!-- AI 回复（有序 blocks：思考 / 工具 / 回复 + 报告卡） -->
    <div v-else class="turn ai">
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
    <p>描述你想了解的赛道或问题，Agent 会自主调度数据源并综合成报告。</p>
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
.u-eb {
  font-family: var(--mono); font-size: var(--fs-xs); font-weight: 600;
  color: var(--text-3); margin-bottom: 6px; letter-spacing: 0.02em;
}
.u-eb .u-t { margin-left: 6px; color: var(--text-4); }

.turn.ai { display: flex; gap: 13px; }
/* unslop-ignore: AI 头像用 accent-soft tint 区分 agent 身份——
   这是工作台里翠绿作为“信号/身份”的合法应用，非装饰填色。 */
.ai-ava {
  width: 30px; height: 30px; border-radius: var(--r-sm); flex: none;
  background: var(--accent-soft); color: var(--accent-text);
  display: grid; place-items: center;
  font-weight: 700; font-size: 13px;
  border: 1px solid var(--accent-line);
}
.ai-body { flex: 1; min-width: 0; }
.ai-eb { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 6px; letter-spacing: -0.005em; }

.empty { padding: 8vh 40px 40px; }
/* unslop-ignore: 空态是首屏唯一焦点，accent-soft 圆形容器承载翠绿“仪器已就绪”的语义 */
.hero-glyph {
  display: inline-flex; align-items: center; justify-content: center;
  width: 80px; height: 80px; border-radius: 50%; flex: none;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid var(--accent-line);
  margin-bottom: 18px;
}
.empty p { margin-top: 8px; max-width: 420px; line-height: 1.6; color: var(--text-2); }
.hero-hints { display: flex; gap: 10px; margin-top: 22px; }
.hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 11px; color: var(--text-2); font-weight: 500;
  padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--r-pill);
  background: var(--surface); letter-spacing: 0.02em;
}
</style>
