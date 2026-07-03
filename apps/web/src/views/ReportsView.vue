<script setup lang="ts">
/**
 * ReportsView — 报告档案列表（Workbench 风格）。
 * 点击条目打开 ReportModal 弹窗（不再跳路由）；分享靠下载 HTML。
 */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Plus, Sun, Moon, ArrowLeft, Sparkles, ArrowRight } from "@lucide/vue";
import { listReports } from "@ai-insight/api-client";
import type { Report } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";
import { mdInline } from "../utils/markdown";
import ReportModal from "../components/ReportModal.vue";

const router = useRouter();
const { theme, toggle } = useTheme();
const reports = ref<Report[]>([]);
const loading = ref(true);

// 弹窗
const modalReport = ref<Report | null>(null);

onMounted(async () => {
  try {
    const r = await listReports();
    reports.value = r.items;
  } finally {
    loading.value = false;
  }
});

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const day = Math.floor(diff / 86400000);
  if (day < 1) return "今天";
  if (day < 30) return `${day} 天前`;
  return iso.slice(0, 10);
}

function openReport(r: Report) {
  modalReport.value = r;
}

/** 卡片标题/导语按 inline markdown 渲染（与弹窗 ReportModal 同源），先 esc() 再应用规则，安全用于 v-html。 */
function titleHtml(r: Report): string {
  return mdInline(r.title);
}
function ledeHtml(r: Report): string {
  return r.standfirst ? mdInline(r.standfirst) : "";
}
</script>

<template>
  <div class="page">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-Insight · 档案</div>
            <h1 class="title">洞察报告档案</h1>
          </div>
          <div class="mast-right">
            <button class="ghost-btn" @click="router.push('/c/new')">
              <Plus :size="15" :stroke-width="2.2" />
              新洞察
            </button>
            <button class="icon-btn" @click="toggle($event)" :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"><Moon v-if="theme === 'dark'" :size="16" :stroke-width="1.8" /><Sun v-else :size="16" :stroke-width="1.8" /></button>
            <button class="icon-btn" @click="router.push('/c/new')" title="返回工作台"><ArrowLeft :size="16" :stroke-width="1.8" /></button>
          </div>
        </div>
        <div class="rule"></div>
      </header>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="!reports.length" class="empty">
        <div class="empty-glyph"><Sparkles :size="48" :stroke-width="1.4" /></div>
        <div class="big">还没有报告</div>
        <p>发起一次洞察，Agent 会为你生成报告。</p>
      </div>
      <div v-else class="rep-list">
        <button v-for="r in reports" :key="r.id" class="rep-card" @click="openReport(r)">
          <div class="rc-top"><span>分析报告</span><span>{{ relTime(r.createdAt) }}</span></div>
          <div class="rc-body">
            <!-- eslint-disable-next-line vue/no-v-html -- mdInline 先 esc() 再应用 inline 规则，安全 -->
            <h3 v-html="titleHtml(r)"></h3>
            <!-- eslint-disable-next-line vue/no-v-html -- mdInline 先 esc() 再应用 inline 规则，安全 -->
            <p v-if="r.standfirst" class="rc-lede" v-html="ledeHtml(r)"></p>
          </div>
          <div class="rc-foot">
            <span class="rc-hint">点击查阅 <ArrowRight :size="11" :stroke-width="2.2" /></span>
          </div>
        </button>
      </div>
    </div>

    <ReportModal :report="modalReport" @close="modalReport = null" />
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 880px; margin: 0 auto; padding: 48px 24px 64px; }

.masthead { margin-bottom: 32px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.kicker { font-size: 11px; font-weight: 600; color: var(--accent-text); letter-spacing: 0.04em; }
.title { font-size: 28px; font-weight: 700; margin: 8px 0 0; letter-spacing: -0.01em; color: var(--text); }
.mast-right { display: flex; gap: 8px; align-items: center; }
.rule { border-top: 1px solid var(--border); }

.state { color: var(--text-3); padding: 60px; text-align: center; font-family: var(--mono); }
.empty { padding: 80px 40px; text-align: center; color: var(--text-3); }
.empty-glyph { display: flex; color: var(--text-4); opacity: 0.5; margin-bottom: 14px; }
.big { font-size: 24px; font-weight: 700; color: var(--text-2); letter-spacing: -0.01em; }
.empty p { margin-top: 8px; }

.rep-list { display: flex; flex-direction: column; gap: 12px; }
.rep-card {
  display: block; width: 100%; text-align: left;
  border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
  cursor: pointer; transition: var(--t-fast); overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.rep-card:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: var(--shadow-md); }
.rc-top {
  background: var(--surface-3); color: var(--text-2);
  padding: 6px 15px; display: flex; justify-content: space-between;
  font-size: 11px; font-weight: 600; border-bottom: 1px solid var(--border);
}
.rc-body { padding: 15px 17px; }
.rc-body h3 { font-size: 17px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; color: var(--text); }
.rc-lede {
  font-size: 13px; color: var(--text-3); margin: 0; line-height: 1.5;
  /* 摘要按 markdown 渲染后用行数截断，避免字符切割打断 ** 等内联标记 */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.rc-foot {
  padding: 8px 17px; border-top: 1px solid var(--border);
  font-size: 11px; color: var(--accent-text); font-weight: 600;
}
/* 查阅提示：文字与图标 inline-flex 垂直居中，避免错行 */
.rc-hint { display: inline-flex; align-items: center; gap: 4px; }
</style>
