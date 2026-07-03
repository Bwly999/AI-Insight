<script setup lang="ts">
/**
 * SchedulesView — 定时洞察列表 + 创建表单（Workbench 风格）。
 * 启停 / 删除 / 下次触发时刻。
 */
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Plus, Trash2, Sun, Moon, ArrowLeft, CalendarClock } from "@lucide/vue";
import {
  listSchedules,
  createSchedule,
  patchSchedule,
  deleteSchedule,
} from "@ai-insight/api-client";
import {
  LENS_OPTIONS,
  TIME_RANGE_OPTIONS,
  type Schedule,
  type LensKey,
  type TimeRange,
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
      config: { timeRange: timeRange.value, lens: lens.value },
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
  <div class="page">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-Insight · 调度</div>
            <h1 class="title">定时洞察</h1>
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
        <div class="empty-glyph"><CalendarClock :size="48" :stroke-width="1.4" /></div>
        <div class="big">还没有定时洞察</div>
        <p>把一次洞察 prompt 固化为定时任务，到点自动跑全流程。</p>
      </div>
      <div v-else class="sch-list">
        <div v-for="s in schedules" :key="s.id" class="sch-row" :class="{ off: !s.enabled }">
          <div class="sch-main">
            <div class="sch-prompt">{{ s.prompt }}</div>
            <div class="sch-meta mono">
              <span class="sch-cron">{{ s.cron }}</span>
              <span>{{ s.lens ?? "deep" }}</span>
              <span>{{ s.config.timeRange }}</span>
            </div>
            <div class="sch-times mono">
              <span>下次 {{ relTime(s.nextRunAt) }}</span>
              <span v-if="s.lastRunAt">· 上次 {{ relTime(s.lastRunAt) }}</span>
            </div>
          </div>
          <div class="sch-act">
            <button class="switch" :class="{ on: s.enabled }" @click="toggleEnabled(s)" :title="s.enabled ? '已启用' : '已停用'"><span class="knob"></span></button>
            <button class="del-btn" @click="remove(s)" title="删除">
              <Trash2 :size="15" :stroke-width="2" />
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
.kicker { font-size: 11px; font-weight: 600; color: var(--accent-text); letter-spacing: 0.04em; }
.title { font-size: 28px; font-weight: 700; margin: 8px 0 0; letter-spacing: -0.01em; color: var(--text); }
.mast-right { display: flex; gap: 8px; align-items: center; }
.rule { border-top: 1px solid var(--border); }

.form-card {
  border: 1px solid var(--border); background: var(--surface); border-radius: 12px;
  padding: 22px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 12px;
  box-shadow: var(--shadow-sm);
}
.form-head { font-size: 11px; font-weight: 600; color: var(--accent-text); letter-spacing: 0.04em; }
.f-input {
  width: 100%; background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
  border-radius: 8px; padding: 9px 11px; font-size: 13.5px; font-family: inherit; transition: var(--t-fast);
}
.f-input:focus { outline: none; border-color: var(--accent); }
.f-prompt { resize: vertical; font-size: 15px; }
.f-row { display: flex; gap: 10px; flex-wrap: wrap; }
.f-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 120px; }
.f-label { font-size: 10px; color: var(--text-3); letter-spacing: 0.04em; font-family: var(--mono); }
.f-quick { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.qbtn { font-size: 11px; padding: 3px 9px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); cursor: pointer; font-family: var(--mono); transition: var(--t-fast); }
.qbtn:hover { color: var(--accent); border-color: var(--accent); }
.f-error { color: var(--rose); font-size: 12px; }
.primary-btn {
  align-self: flex-start; padding: 9px 22px; border-radius: 8px; border: none; cursor: pointer;
  background: var(--accent); color: var(--on-accent); font-weight: 600; font-size: 13.5px;
  transition: var(--t-fast);
}
.primary-btn:hover:not(:disabled) { background: var(--accent-hover); }
.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.state { color: var(--text-3); padding: 60px; text-align: center; font-family: var(--mono); }
.empty { padding: 60px 40px; text-align: center; color: var(--text-3); }
.empty-glyph { display: flex; color: var(--text-4); opacity: 0.5; margin-bottom: 14px; }
.big { font-size: 24px; font-weight: 700; color: var(--text-2); letter-spacing: -0.01em; }
.empty p { margin-top: 8px; }

.sch-list { display: flex; flex-direction: column; gap: 10px; }
.sch-row {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface);
  transition: var(--t-fast); box-shadow: var(--shadow-sm);
}
.sch-row.off { opacity: 0.55; }
.sch-row:hover { border-color: var(--border-2); }
.sch-main { flex: 1; min-width: 0; }
.sch-prompt { font-size: 15px; font-weight: 600; color: var(--text); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sch-meta { font-size: 11px; color: var(--text-3); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap; }
.sch-cron { color: var(--accent-text); }
.sch-times { font-size: 11px; color: var(--text-3); margin-top: 4px; display: flex; gap: 8px; }
.sch-act { display: flex; align-items: center; gap: 8px; }

.switch {
  width: 38px; height: 22px; border-radius: var(--r-pill); border: 1px solid var(--border);
  background: var(--surface-3); cursor: pointer; position: relative; transition: var(--t-fast); padding: 0;
}
.switch .knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--text-3); transition: var(--t-fast);
}
.switch.on { background: var(--accent); border-color: var(--accent); }
.switch.on .knob { left: 18px; background: var(--on-accent); }

.del-btn {
  width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text-3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: var(--t-fast);
}
.del-btn:hover { color: var(--rose); border-color: var(--rose); }
</style>
