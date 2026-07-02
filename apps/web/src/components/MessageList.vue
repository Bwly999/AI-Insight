<script setup lang="ts">
/**
 * MessageList — 历史消息（用户气泡 / AI 消息，AI 文本走轻量 markdown）。
 * 历史消息不重建工具卡/思考块（未持久化）；仅渲染 markdown 正文。
 */
import { computed } from "vue";
import type { Message } from "@ai-insight/shared-types";
import { mdToHtml } from "../utils/markdown";

const props = defineProps<{ messages: Message[]; idle: boolean; loading: boolean }>();

const visibleMessages = computed(() => props.messages.filter((m) => m.content.kind === "text"));
const aiHtml = (text: string) => mdToHtml(text);

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <template v-for="m in visibleMessages" :key="m.id">
    <div v-if="m.role === 'user'" class="turn user fade-up">
      <div class="b-user">
        <div class="u-eb">你 · {{ timeLabel(m.createdAt) }}</div>
        {{ m.content.kind === 'text' ? m.content.text : '' }}
      </div>
    </div>
    <div v-else-if="m.role === 'assistant'" class="turn ai fade-up">
      <div class="ai-ava">A</div>
      <div class="ai-body">
        <div class="ai-eb">AI-Insight</div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="m.content.kind === 'text'" class="md" v-html="aiHtml(m.content.text)"></div>
      </div>
    </div>
  </template>

  <div v-if="!messages.length && idle && !loading" class="empty">
    <div class="hero-glyph">◎</div>
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
.ai-eb { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }

.empty { padding: 8vh 40px 40px; }
.hero-glyph {
  font-family: var(--mono); font-size: 56px; color: var(--accent);
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
