<script setup lang="ts">
/**
 * MessageList — 历史消息（用户气泡 / AI 消息，AI 文本走轻量 markdown）。
 */
import { computed } from "vue";
import type { Message } from "@ai-insight/shared-types";
import { mdToHtml } from "../utils/markdown";

const props = defineProps<{ messages: Message[]; idle: boolean; loading: boolean }>();

const visibleMessages = computed(() => props.messages.filter((m) => m.content.kind === "text"));
const aiHtml = (text: string) => mdToHtml(text);
</script>

<template>
  <template v-for="m in visibleMessages" :key="m.id">
    <div v-if="m.role === 'user'" class="msg-user reveal">
      <div class="bubble-user">{{ m.content.kind === 'text' ? m.content.text : '' }}</div>
    </div>
    <div v-else-if="m.role === 'assistant'" class="msg-ai reveal">
      <div class="ai-ava">洞</div>
      <div class="ai-body">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="m.content.kind === 'text'" class="md-body" v-html="aiHtml(m.content.text)"></div>
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
.msg-user { display: flex; justify-content: flex-end; }
.bubble-user {
  max-width: 78%; background: var(--surface-raised); border: 1px solid var(--line);
  border-radius: var(--r-lg) var(--r-lg) 4px var(--r-lg);
  padding: 12px 16px; font-size: 14.5px; line-height: 1.65; color: var(--ink);
  box-shadow: var(--shadow-sm);
}
.msg-ai { display: flex; gap: 12px; }
.ai-ava {
  width: 32px; height: 32px; border-radius: var(--r-sm); flex: none;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  display: flex; align-items: center; justify-content: center;
  color: #04111a; font-weight: 700; font-size: 14px;
  box-shadow: 0 0 14px -2px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.ai-body { flex: 1; min-width: 0; }

.empty { padding: 8vh 40px 40px; }
.hero-glyph {
  font-family: var(--mono); font-size: 56px; color: var(--brand);
  opacity: 0.5; margin-bottom: 12px;
  text-shadow: 0 0 30px var(--brand-glow);
  animation: pulse 2.4s ease-in-out infinite;
}
.empty p { margin-top: 8px; max-width: 420px; line-height: 1.6; }
.hero-hints { display: flex; gap: 16px; margin-top: 22px; }
.hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 11px; color: var(--ink-3);
  padding: 4px 10px; border: 1px solid var(--line); border-radius: var(--r-pill);
}
</style>
