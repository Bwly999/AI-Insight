<script setup lang="ts">
/**
 * AdminSettingsView — 代理 / LLM / RSS 周期 设置（热切换）。
 * apiKey 不经此 UI（env-only）。
 */
import { ref, onMounted } from "vue";
import { getSettings, updateSettings } from "@ai-insight/api-client";
import { useTheme } from "../composables/useTheme";

const { theme, toggle } = useTheme();

const proxy = ref("");
const llmModel = ref("");
const llmBaseUrl = ref("");
const llmProviderName = ref("");
const rssCadence = ref("");
const loading = ref(true);
const saving = ref(false);
const msg = ref("");
const msgOk = ref(false);

onMounted(async () => {
  try {
    const r = await getSettings();
    const s = r.settings;
    proxy.value = s.proxy ?? "";
    rssCadence.value = s.rssCadence ?? "";
    if (s.llm) {
      try {
        const llm = JSON.parse(s.llm);
        llmModel.value = llm.model ?? "";
        llmBaseUrl.value = llm.baseUrl ?? "";
        llmProviderName.value = llm.providerName ?? "";
      } catch { /* ignore */ }
    }
  } finally {
    loading.value = false;
  }
});

async function save() {
  saving.value = true;
  msg.value = "";
  try {
    const r = await updateSettings({
      ...(proxy.value !== "" || true ? { proxy: proxy.value } : {}),
      llm: {
        ...(llmProviderName.value && { providerName: llmProviderName.value }),
        ...(llmBaseUrl.value && { baseUrl: llmBaseUrl.value }),
        ...(llmModel.value && { model: llmModel.value }),
      },
      ...(rssCadence.value && { rssCadence: rssCadence.value }),
    });
    msg.value = "已保存。proxy 即时生效；LLM 下次 run 生效；RSS 周期已重排。";
    msgOk.value = true;
    const s = r.settings;
    if (s.rssCadence) rssCadence.value = s.rssCadence;
  } catch (e) {
    msg.value = (e as Error).message;
    msgOk.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page grid-bg">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-INSIGHT · 管理端</div>
            <h1 class="title">设置</h1>
          </div>
          <div class="mast-right">
            <button class="icon-btn theme-toggle" @click="toggle" title="切换主题">
              <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </button>
          </div>
        </div>
        <div class="double-rule"></div>
        <nav class="tabs">
          <a class="tab" href="#/runs">运行监控</a>
          <span class="tab on">设置</span>
        </nav>
      </header>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else class="cards">
        <section class="card">
          <div class="card-head">代理（出站）</div>
          <p class="card-hint">留空 = 不用代理；即时生效。例 <code class="mono">http://host:port</code></p>
          <input v-model="proxy" class="f-input mono" placeholder="http://proxy.example.com:7890" />
        </section>

        <section class="card">
          <div class="card-head">LLM provider</div>
          <p class="card-hint">model/baseUrl/providerName 可覆盖 env；<b>apiKey 仅 env（不在此存）</b>。下次 run 生效。</p>
          <div class="f-row">
            <label class="f-field"><span class="f-label">providerName</span>
              <input v-model="llmProviderName" class="f-input mono" placeholder="deepseek" /></label>
            <label class="f-field"><span class="f-label">model</span>
              <input v-model="llmModel" class="f-input mono" placeholder="deepseek-v4-flash" /></label>
          </div>
          <label class="f-field"><span class="f-label">baseUrl</span>
            <input v-model="llmBaseUrl" class="f-input mono" placeholder="https://api.deepseek.com" /></label>
        </section>

        <section class="card">
          <div class="card-head">RSS 轮询周期</div>
          <p class="card-hint">5 字段 cron；保存后重排任务。</p>
          <input v-model="rssCadence" class="f-input mono" placeholder="*/30 * * * *" />
        </section>

        <div v-if="msg" class="msg" :class="{ ok: msgOk }">{{ msg }}</div>
        <button class="primary-btn" :disabled="saving" @click="save">{{ saving ? "保存中…" : "保存设置" }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 720px; margin: 0 auto; padding: 40px 24px 64px; }
.masthead { margin-bottom: 24px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: var(--brand); font-weight: 600; }
.title { font-family: var(--frau); font-weight: 600; font-size: 34px; margin: 8px 0 0; color: var(--ink); }
.double-rule { border-top: 3px double var(--brand); opacity: 0.5; margin-bottom: 14px; }
.tabs { display: flex; gap: 4px; }
.tab { font-size: 13px; color: var(--ink-3); padding: 6px 14px; border-radius: var(--r-pill); text-decoration: none; cursor: pointer; }
.tab.on { background: var(--brand-soft); color: var(--brand); font-weight: 600; }

.state { color: var(--ink-3); padding: 60px; text-align: center; font-family: var(--mono); }
.cards { display: flex; flex-direction: column; gap: 16px; }
.card { border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-md); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
.card-head { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: var(--brand); font-weight: 600; }
.card-hint { font-size: 12px; color: var(--ink-3); margin: 0 0 4px; }
.card-hint code { font-size: 11px; background: var(--surface-3); padding: 1px 5px; border-radius: var(--r-xs); }
.f-row { display: flex; gap: 10px; flex-wrap: wrap; }
.f-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
.f-label { font-size: 10px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--mono); }
.f-input { width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink); border-radius: var(--r-sm); padding: 8px 11px; font-size: 13px; font-family: inherit; }
.f-input:focus { outline: none; border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
.msg { font-size: 12.5px; color: var(--ink-2); padding: 10px 14px; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--line); }
.msg.ok { color: #2ecc71; border-color: rgba(46,204,113,0.3); background: rgba(46,204,113,0.08); }
.primary-btn { align-self: flex-start; padding: 9px 24px; border-radius: var(--r-md); border: none; cursor: pointer; background: linear-gradient(180deg, var(--brand), var(--brand-2)); color: #04111a; font-weight: 600; font-size: 13.5px; box-shadow: 0 4px 16px -4px var(--brand-glow); }
.primary-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }
</style>
