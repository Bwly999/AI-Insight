<script setup lang="ts">
/**
 * EditorialReport — 编辑风格的洞察报告组件。
 *
 * 两处复用（设计 §4.4）：
 *  - 用户端 /reports/:id 查看页（客户端渲染）
 *  - 服务端 standalone HTML 渲染（@vue/server-renderer renderToString）
 *
 * 源自 ref/v2-editorial.html：报头 / stamp / drop-cap 导语 / 正文(markdown) / 供稿行 / 印章。
 * interactive=false（服务端渲染时）隐藏无关交互。
 */
import { computed } from "vue";

interface Props {
  title: string;
  standfirst?: string;
  /** 已渲染的 HTML 正文（由 markdown→html 转换；放 .editorial-body 容器） */
  bodyHtml: string;
  /** 报告元信息 */
  meta?: {
    issueNo?: string;
    createdAt?: string;
    signalCount?: number;
    sourceCount?: number;
  };
  /** 是否交互态（客户端查看=true，服务端 standalone=false） */
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  interactive: true,
});

const pubDate = computed(() => {
  if (!props.meta?.createdAt) return new Date().toISOString().slice(0, 10);
  return props.meta.createdAt.slice(0, 10);
});
</script>

<template>
  <article class="editorial-report">
    <!-- 报头 -->
    <header class="report-masthead">
      <div class="masthead-meta">
        <span class="kicker">AI-Insight · 洞察报告</span>
        <span v-if="meta?.issueNo" class="issue-no">№ {{ meta.issueNo }}</span>
        <span class="pub-date font-mono">{{ pubDate }}</span>
      </div>
      <div class="double-rule masthead-rule"></div>
      <h1 class="report-title">{{ title }}</h1>
      <p v-if="standfirst" class="report-standfirst drop-cap">{{ standfirst }}</p>
    </header>

    <!-- 正文 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="editorial-body" v-html="bodyHtml"></div>

    <!-- 供稿行 -->
    <footer v-if="meta" class="report-footer thick-rule">
      <span class="font-mono footer-meta">
        收录 {{ meta.signalCount ?? "—" }} 条信号 · {{ meta.sourceCount ?? "—" }} 个数据源
      </span>
      <span class="font-mono footer-meta">
        由 AI-Insight Agent 自主采集数据源并综合生成
      </span>
    </footer>
  </article>
</template>

<style scoped>
.editorial-report {
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 24px 64px;
  color: var(--ink, #1a1612);
  font-family: "Inter Tight", -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.7;
}
.report-masthead {
  border-bottom: 3px solid var(--rule, #1a1612);
  padding-bottom: 20px;
  margin-bottom: 28px;
}
.masthead-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.kicker {
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  color: var(--vermillion, #c8341a);
  font-weight: 600;
}
.issue-no {
  font-family: "Fraunces", Georgia, serif;
  font-style: italic;
  color: var(--ink-3, #8a8073);
  font-size: 14px;
}
.pub-date {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-3, #8a8073);
}
.report-title {
  font-family: "Fraunces", Georgia, serif;
  font-weight: 900;
  font-size: 36px;
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: var(--ink, #1a1612);
  margin: 6px 0 0;
}
.report-standfirst {
  font-size: 18px;
  color: var(--ink-2, #4a423a);
  margin: 14px 0 0;
  font-style: italic;
}
.report-footer {
  margin-top: 40px;
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.footer-meta {
  font-size: 11px;
  color: var(--ink-3, #8a8073);
}
</style>
