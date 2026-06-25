<script setup lang="ts">
/**
 * SchedulesView — 定时洞察列表 + 创建表单（启停 / 删除 / 下次触发时刻）。
 */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  listSchedules,
  createSchedule,
  patchSchedule,
  deleteSchedule,
} from "@ai-insight/api-client";
import {
  LENS_OPTIONS,
  TIME_RANGE_OPTIONS,
  ALL_TAGS,
  type Schedule,
  type LensKey,
  type TimeRange,
  type DataSourceTag,
} from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const { theme, toggle } = useTheme();

const schedules = ref<Schedule[]>([]);
const loading = ref(true);

// 表单
const prompt = ref("");
const cron = ref("0 9 * * *");
const timeRange = ref<TimeRange>("1w");
const lens = ref<LensKey>("deep");
const tagPrefs = ref<DataSourceTag[]>(["tech", "news"]);
const creating = ref(false);
const error = ref("");

onMounted(async () => {
  await reload();
});

async function reload() {
  loading.value = true;
  try {
    const r = await listSchedules();
    schedules.value = r.items;
  } finally {
    loading.value = false;
  }
}

function toggleTag(t: DataSourceTag) {
  const i = tagPrefs.value.indexOf(t);
  if (i >= 0) tagPrefs.value.splice(i, 1);
  else tagPrefs.value.push(t);
}

function setCron(c: string) {
  cron.value = c;
}

async function submit() {
  error.value = "";
  if (!prompt.value.trim() || !cron.value.trim()) {
    error.value = "prompt 与 cron 必填";
    return;
  }
  creating.value = true;
  try {
    await createSchedule({
      prompt: prompt.value.trim(),
      cron: cron.value.trim(),
      lens: lens.value,
      config: { timeRange: timeRange.value, tagPrefs: tagPrefs.value, lens: lens.value },
    });
    prompt.value = "";
    await reload();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    creating.value = false;
  }
}

async function toggleEnabled(s: Schedule) {
  try {
    await patchSchedule(s.id, { enabled: !s.enabled });
    await reload();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function remove(s: Schedule) {
  if (!confirm(`删除定时「${s.prompt.slice(0, 24)}」？`)) return;
  try {
    await deleteSchedule(s.id);
    await reload();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function relTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const min = Math.floor(abs / 60000);
  if (min < 1) return "即将";
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const suffix = diff >= 0 ? "后" : "前";
  if (day > 0) return `${day} 天${suffix}`;
  if (hr > 0) return `${hr} 小时${suffix}`;
  return `${min} 分钟${suffix}`;
}
</script>

<template>
  <div class="page grid-bg">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-INSIGHT · 调度</div>
            <h1 class="title">定时洞察</h1>
          </div>
          <div class="mast-right">
            <button class="ghost-btn" @click="router.push('/c/new')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              新洞察
            </button>
            <button class="icon-btn theme-toggle" @click="toggle" title="切换主题">
              <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            </button>
          </div>
        </div>
        <div class="double-rule"></div>
      </header>

      <section class="form-card">
        <div class="form-head">新建定时</div>
        <textarea v-model="prompt" class="f-input f-prompt" placeholder="洞察 prompt（如：本周 AI 编程工具赛道动态）" rows="2"></textarea>
        <div class="f-row">
          <label class="f-field">
            <span class="f-label">cron</span>
            <input v-model="cron" class="f-input mono" placeholder="0 9 * * *" />
          </label>
          <label class="f-field">
            <span class="f-label">时间窗</span>
            <select v-model="timeRange" class="f-input">
              <option v-for="o in TIME_RANGE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="f-field">
            <span class="f-label">视角</span>
            <select v-model="lens" class="f-input">
              <option v-for="o in LENS_OPTIONS" :key="o.key" :value="o.key">{{ o.label }}</option>
            </select>
          </label>
        </div>
        <div class="f-chips">
          <button v-for="t in ALL_TAGS" :key="t" class="chip" :class="{ on: tagPrefs.includes(t) }" @click="toggleTag(t)">{{ t }}</button>
        </div>
        <div class="f-quick">
          <span class="f-label">快选：</span>
          <button class="qbtn" @click="setCron('*/2 * * * *')">每2分</button>
          <button class="qbtn" @click="setCron('0 * * * *')">每小时</button>
          <button class="qbtn" @click="setCron('0 9 * * *')">每天9点</button>
        </div>
        <div v-if="error" class="f-error">{{ error }}</div>
        <button class="primary-btn" :disabled="creating" @click="submit">
          {{ creating ? "创建中…" : "创建定时" }}
        </button>
      </section>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else-if="!schedules.length" class="empty">
        <div class="empty-glyph">◔</div>
        <div class="empty-big">还没有定时洞察</div>
        <p>把一次洞察 prompt 固化为定时任务，到点自动跑全流程。</p>
      </div>
      <div v-else class="sch-list">
        <div v-for="s in schedules" :key="s.id" class="sch-row" :class="{ off: !s.enabled }">
          <div class="sch-main">
            <div class="sch-prompt">{{ s.prompt }}</div>
            <div class="sch-meta mono">
              <span class="sch-cron">{{ s.cron }}</span>
              <span class="sch-lens">{{ s.lens ?? "deep" }}</span>
              <span class="sch-tr">{{ s.config.timeRange }}</span>
              <span v-if="s.config.tagPrefs?.length" class="sch-tags">{{ s.config.tagPrefs.join("/") }}</span>
            </div>
            <div class="sch-times mono">
              <span>下次 {{ relTime(s.nextRunAt) }}</span>
              <span v-if="s.lastRunAt">· 上次 {{ relTime(s.lastRunAt) }}</span>
            </div>
          </div>
          <div class="sch-act">
            <button class="switch" :class="{ on: s.enabled }" @click="toggleEnabled(s)" :title="s.enabled ? '已启用' : '已停用'"><span class="knob"></span></button>
            <button class="del-btn" @click="remove(s)" title="删除">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 880px; margin: 0 auto; padding: 48px 24px 64px; }

.masthead { margin-bottom: 28px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: var(--brand); font-weight: 600; }
.title { font-family: var(--frau); font-weight: 600; font-size: 38px; margin: 8px 0 0; letter-spacing: -0.015em; color: var(--ink); }
.mast-right { display: flex; gap: 8px; }
.double-rule { border-top: 3px double var(--brand); opacity: 0.5; }

.form-card {
  border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-md);
  padding: 22px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 12px;
}
.form-head { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: var(--brand); font-weight: 600; }
.f-input {
  width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink);
  border-radius: var(--r-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit;
}
.f-input:focus { outline: none; border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
.f-prompt { resize: vertical; font-family: var(--frau); font-size: 15px; }
.f-row { display: flex; gap: 10px; flex-wrap: wrap; }
.f-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 120px; }
.f-label { font-size: 10px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--mono); }
.f-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  font-size: 11px; padding: 4px 11px; border-radius: var(--r-pill); border: 1px solid var(--line);
  background: var(--bg); color: var(--ink-3); cursor: pointer; transition: var(--t-fast); font-family: var(--mono);
}
.chip.on { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand); font-weight: 600; }
.f-quick { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.qbtn { font-size: 11px; padding: 3px 9px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--bg); color: var(--ink-2); cursor: pointer; font-family: var(--mono); }
.qbtn:hover { color: var(--brand); border-color: var(--brand-line); }
.f-error { color: #c0392b; font-size: 12px; }
.primary-btn {
  align-self: flex-start; padding: 9px 22px; border-radius: var(--r-md); border: none; cursor: pointer;
  background: linear-gradient(180deg, var(--brand), var(--brand-2)); color: #04111a; font-weight: 600; font-size: 13.5px;
  box-shadow: 0 4px 16px -4px var(--brand-glow); transition: var(--t-mid);
}
.primary-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.state { color: var(--ink-3); padding: 60px; text-align: center; font-family: var(--mono); }
.empty { padding: 60px 40px; text-align: center; color: var(--ink-3); }
.empty-glyph { font-family: var(--mono); font-size: 48px; color: var(--brand); opacity: 0.5; margin-bottom: 14px; text-shadow: 0 0 24px var(--brand-glow); }
.empty-big { font-family: var(--frau); font-size: 24px; color: var(--ink-2); }
.empty p { margin-top: 8px; }

.sch-list { display: flex; flex-direction: column; gap: 10px; }
.sch-row {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface);
  transition: var(--t-fast);
}
.sch-row.off { opacity: 0.55; }
.sch-row:hover { border-color: var(--brand-line); box-shadow: var(--shadow-md); }
.sch-main { flex: 1; min-width: 0; }
.sch-prompt { font-family: var(--frau); font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sch-meta { font-size: 11px; color: var(--ink-3); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap; }
.sch-cron { color: var(--brand); }
.sch-lens, .sch-tr, .sch-tags { color: var(--ink-3); }
.sch-times { font-size: 11px; color: var(--ink-3); margin-top: 4px; display: flex; gap: 8px; }
.sch-act { display: flex; align-items: center; gap: 8px; }

.switch {
  width: 38px; height: 22px; border-radius: var(--r-pill); border: 1px solid var(--line);
  background: var(--surface-3); cursor: pointer; position: relative; transition: var(--t-fast); padding: 0;
}
.switch .knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--ink-3); transition: var(--t-fast);
}
.switch.on { background: var(--brand); border-color: var(--brand); }
.switch.on .knob { left: 18px; background: #04111a; }

.del-btn {
  width: 30px; height: 30px; border-radius: var(--r-sm); border: 1px solid var(--line);
  background: var(--bg); color: var(--ink-3); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: var(--t-fast);
}
.del-btn:hover { color: #c0392b; border-color: #c0392b; }

.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }
</style>
