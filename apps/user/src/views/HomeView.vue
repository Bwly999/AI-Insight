<script setup lang="ts">
/**
 * Phase 0 本期报告骨架页。
 * 验收 A6：dev 可启动 + Tailwind 生效 + 设计 token 可见。
 * Phase 3 将完整复刻 v2-editorial.html 六大区块（见 15-UIUX设计 §15.2.3）。
 */
import { StampBadge, HeatBar, EmptyState } from '@ai-insight/shared-ui';
</script>

<template>
  <div class="mx-auto" style="max-width: var(--max-width); padding: 0 var(--gutter)">
    <!-- 报头跑马灯 -->
    <div class="marquee-ink py-2 -mx-6 md:-mx-10 overflow-hidden">
      <div class="slide-track text-xs uppercase tracking-widest">
        <span class="px-6">VOL. I · Issue №{{ 1 }} · {{ new Date().toLocaleDateString('zh-CN') }}</span>
        <span class="px-6">— Phase 0 骨架已就绪 —</span>
        <span class="px-6">BREAKING · 架构验收 A1–A10 进行中</span>
        <span class="px-6">VOL. I · Issue №{{ 1 }} · {{ new Date().toLocaleDateString('zh-CN') }}</span>
        <span class="px-6">— Phase 0 骨架已就绪 —</span>
      </div>
    </div>

    <!-- 刊名 -->
    <header class="py-10 thick-rule">
      <h1
        class="font-black leading-none text-ink"
        style="font-family: var(--font-serif); font-size: clamp(2.8rem, 9vw, 5.6rem)"
      >
        The Insight Review
      </h1>
      <p class="mt-2 text-ink-2" style="font-family: var(--font-sans)">
        你的 AI 周刊 · Phase 0 架构骨架
      </p>
    </header>

    <!-- 双线导航条 -->
    <nav class="double-rule py-3 flex flex-wrap gap-6 text-sm" aria-label="主导航">
      <RouterLink to="/" class="font-medium text-ink hover:text-vermillion">今日</RouterLink>
      <RouterLink to="/archive" class="text-ink hover:text-vermillion">档案</RouterLink>
      <RouterLink to="/settings" class="text-ink hover:text-vermillion">订阅</RouterLink>
      <RouterLink to="/feedback" class="text-ink hover:text-vermillion">我的反馈</RouterLink>
      <span class="ml-auto flex items-center gap-2 text-ink-3" style="font-family: var(--font-mono)">
        <span class="dot" style="background: var(--forest); width: 8px; height: 8px; border-radius: 50%" />
        ONLINE
      </span>
    </nav>

    <!-- 头版头条区 -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 py-12">
      <article class="lg:col-span-7">
        <StampBadge label="头版 · TOP STORY" />
        <h2
          class="mt-4 font-black leading-tight text-ink"
          style="font-family: var(--font-serif); font-size: clamp(2.2rem, 5vw, 3.8rem)"
        >
          平台骨架已铺好，下一期开始印刷
        </h2>
        <p class="mt-4 drop-cap text-ink-2 leading-relaxed text-lg" style="font-family: var(--font-sans)">
          Monorepo、Fastify 后端、双 Vue3 前端、Drizzle 模型、Docker 编排均就位。
          本期仅是骨架版面——采集、AI 处理与报告将在后续阶段填充，
          最终这里会是一份严肃优雅、可订阅的 AI 洞察周刊。
        </p>
      </article>

      <aside class="lg:col-span-5">
        <!-- 统计卡（墨底纸字） -->
        <div class="p-6" style="background: var(--ink); color: var(--paper)">
          <p class="text-xs uppercase tracking-widest opacity-70" style="font-family: var(--font-mono)">
            By the Numbers
          </p>
          <div class="grid grid-cols-2 gap-6 mt-4">
            <div>
              <p class="metric-num text-4xl">12</p>
              <p class="text-xs opacity-70">数据表</p>
            </div>
            <div>
              <p class="metric-num text-4xl">8</p>
              <p class="text-xs opacity-70">Fastify 插件</p>
            </div>
            <div>
              <p class="metric-num text-4xl">3</p>
              <p class="text-xs opacity-70">SPI 契约</p>
            </div>
            <div>
              <p class="metric-num text-4xl">5</p>
              <p class="text-xs opacity-70">服务编排</p>
            </div>
          </div>
        </div>

        <!-- 编辑荐语 -->
        <div class="mt-6 p-6 border-2" style="border-color: var(--rule)">
          <p class="text-vermillion text-2xl leading-none" style="font-family: var(--font-serif)">¶</p>
          <p class="mt-2 text-ink-2" style="font-family: var(--font-sans)">
            本期是一张空白新闻纸——<span class="marker">骨架已成，墨水待注</span>。
            待 Phase 3，这里会出现真正的头条、精选与领域点评。
          </p>
        </div>
      </aside>
    </section>

    <!-- 热度条样例（验证 shared-ui 组件） -->
    <section class="double-rule py-8">
      <p class="text-xs uppercase tracking-widest text-ink-3 mb-4" style="font-family: var(--font-mono)">
        热度条组件预览
      </p>
      <div class="flex flex-wrap gap-6">
        <div class="flex items-center gap-3"><HeatBar :heat="92" /><span class="tabular text-ink-3 text-sm" style="font-family: var(--font-mono)">92</span></div>
        <div class="flex items-center gap-3"><HeatBar :heat="64" color="var(--cobalt)" /><span class="tabular text-ink-3 text-sm" style="font-family: var(--font-mono)">64</span></div>
        <div class="flex items-center gap-3"><HeatBar :heat="30" color="var(--forest)" /><span class="tabular text-ink-3 text-sm" style="font-family: var(--font-mono)">30</span></div>
      </div>
    </section>

    <!-- 报尾 -->
    <footer class="marquee-ink mt-16 -mx-6 md:-mx-10 py-3 text-center text-xs uppercase tracking-widest">
      — END OF DISPATCH · 下一期于 Phase 3 寄出 —
    </footer>

    <EmptyState title="— 本期暂无更多内容 —" hint="待 Phase 3 接入真实报告数据" />
  </div>
</template>
