<script setup lang="ts">
/**
 * AdminDataSourcesView — 数据源管理（admin）：按类型分组，
 * 全类型启停 + 标签编辑；RSS 增删。
 * 数据源为全局实体，走 admin 门禁封装端点。
 */
import { ref, computed, onMounted } from "vue";
import {
  listAllDataSources,
  patchAdminDataSource,
  createAdminDataSource,
  deleteAdminDataSource,
} from "@ai-insight/api-client";
import { ALL_TAGS, TAG_LABELS, type DataSource, type DataSourceTag, type DataSourceType } from "@ai-insight/shared-types";
import { useTheme } from "../composables/useTheme";

const { theme, toggle } = useTheme();
const sources = ref<DataSource[]>([]);
const loading = ref(true);
const error = ref("");

// 新增 RSS 表单
const newName = ref("");
const newFeedUrl = ref("");
const newTags = ref<DataSourceTag[]>(["general", "tech"]);
const creating = ref(false);

onMounted(async () => {
  await reload();
});

async function reload() {
  loading.value = true;
  try {
    const r = await listAllDataSources();
    sources.value = r.items;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

const grouped = computed(() => {
  const byType: Record<DataSourceType, DataSource[]> = { search: [], rss: [], crawler: [] };
  for (const s of sources.value) byType[s.type].push(s);
  return byType;
});

const TYPE_LABELS: Record<DataSourceType, string> = {
  search: "搜索",
  rss: "RSS",
  crawler: "爬虫",
};

function toggleTagLocal(ds: DataSource, t: DataSourceTag) {
  const cur = [...ds.tags];
  const i = cur.indexOf(t);
  if (i >= 0) cur.splice(i, 1);
  else cur.push(t);
  void saveTags(ds, cur);
}

async function saveTags(ds: DataSource, tags: DataSourceTag[]) {
  try {
    const updated = await patchAdminDataSource(ds.id, { tags });
    const i = sources.value.findIndex((s) => s.id === ds.id);
    if (i >= 0) sources.value[i] = updated;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function toggleEnabled(ds: DataSource) {
  try {
    const updated = await patchAdminDataSource(ds.id, { enabled: !ds.enabled });
    const i = sources.value.findIndex((s) => s.id === ds.id);
    if (i >= 0) sources.value[i] = updated;
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function toggleNewTag(t: DataSourceTag) {
  const i = newTags.value.indexOf(t);
  if (i >= 0) newTags.value.splice(i, 1);
  else newTags.value.push(t);
}

async function addFeed() {
  error.value = "";
  if (!newFeedUrl.value.trim()) {
    error.value = "feedUrl 必填";
    return;
  }
  creating.value = true;
  try {
    await createAdminDataSource({
      name: newName.value.trim(),
      feedUrl: newFeedUrl.value.trim(),
      tags: newTags.value,
    });
    newName.value = "";
    newFeedUrl.value = "";
    await reload();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    creating.value = false;
  }
}

async function removeFeed(ds: DataSource) {
  if (!confirm(`删除 RSS 源「${ds.name}」？`)) return;
  try {
    await deleteAdminDataSource(ds.id);
    await reload();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function feedUrl(ds: DataSource): string {
  return (ds.config as { feedUrl?: string }).feedUrl ?? "";
}
</script>

<template>
  <div class="page grid-bg">
    <div class="page-inner">
      <header class="masthead">
        <div class="mast-top">
          <div class="mast-left">
            <div class="kicker">AI-INSIGHT · 管理端</div>
            <h1 class="title">数据源</h1>
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
          <a class="tab" href="#/schedules">定时任务</a>
          <span class="tab on">数据源</span>
          <a class="tab" href="#/settings">设置</a>
        </nav>
      </header>

      <!-- 新增 RSS -->
      <section class="form-card">
        <div class="form-head">新增 RSS 源（即时首拉建索引）</div>
        <div class="f-row">
          <label class="f-field grow2">
            <span class="f-label">Feed URL</span>
            <input v-model="newFeedUrl" class="f-input mono" placeholder="https://rsshub.app/..." />
          </label>
          <label class="f-field">
            <span class="f-label">名称（可选）</span>
            <input v-model="newName" class="f-input" placeholder="自动取 URL" />
          </label>
        </div>
        <div class="f-chips">
          <button v-for="t in ALL_TAGS" :key="t" class="chip" :class="{ on: newTags.includes(t) }" @click="toggleNewTag(t)">{{ TAG_LABELS[t] }}</button>
        </div>
        <div v-if="error" class="f-error">{{ error }}</div>
        <button class="primary-btn" :disabled="creating" @click="addFeed">
          {{ creating ? "添加中…" : "添加 RSS" }}
        </button>
      </section>

      <div v-if="loading" class="state">加载中…</div>
      <div v-else class="groups">
        <section v-for="t in (['search','rss','crawler'] as DataSourceType[])" :key="t" class="group" v-show="grouped[t].length">
          <div class="group-head">
            <span class="group-type" :class="t">{{ TYPE_LABELS[t] }}</span>
            <span class="group-count mono">{{ grouped[t].length }}</span>
          </div>
          <div class="ds-list">
            <div v-for="ds in grouped[t]" :key="ds.id" class="ds-row" :class="{ off: !ds.enabled }">
              <button class="switch" :class="{ on: ds.enabled }" @click="toggleEnabled(ds)" :title="ds.enabled ? '已启用' : '已停用'"><span class="knob"></span></button>
              <div class="ds-main">
                <div class="ds-name">
                  {{ ds.name }}
                  <span v-if="t === 'rss' && feedUrl(ds)" class="ds-url mono">{{ feedUrl(ds) }}</span>
                </div>
                <div class="ds-tags">
                  <button v-for="tag in ALL_TAGS" :key="tag" class="tchip" :class="{ on: ds.tags.includes(tag) }" @click="toggleTagLocal(ds, tag)">{{ TAG_LABELS[tag] }}</button>
                </div>
              </div>
              <button v-if="t === 'rss'" class="del-btn" @click="removeFeed(ds)" title="删除">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: var(--bg); }
.page-inner { max-width: 920px; margin: 0 auto; padding: 40px 24px 64px; }

.masthead { margin-bottom: 24px; }
.mast-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: var(--brand); font-weight: 600; }
.title { font-family: var(--frau); font-weight: 600; font-size: 34px; margin: 8px 0 0; color: var(--ink); }
.double-rule { border-top: 3px double var(--brand); opacity: 0.5; margin-bottom: 14px; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tab { font-size: 13px; color: var(--ink-3); padding: 6px 14px; border-radius: var(--r-pill); text-decoration: none; cursor: pointer; }
.tab.on { background: var(--brand-soft); color: var(--brand); font-weight: 600; }

.form-card {
  border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-md);
  padding: 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px;
}
.form-head { font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: var(--brand); font-weight: 600; }
.f-row { display: flex; gap: 10px; flex-wrap: wrap; }
.f-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 160px; }
.f-field.grow2 { flex: 2; }
.f-label { font-size: 10px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--mono); }
.f-input {
  width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--ink);
  border-radius: var(--r-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit;
}
.f-input:focus { outline: none; border-color: var(--brand-line); box-shadow: 0 0 0 3px var(--brand-soft); }
.f-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  font-size: 11px; padding: 4px 11px; border-radius: var(--r-pill); border: 1px solid var(--line);
  background: var(--bg); color: var(--ink-3); cursor: pointer; transition: var(--t-fast); font-family: var(--mono);
}
.chip.on { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand); font-weight: 600; }
.f-error { color: #c0392b; font-size: 12px; }
.primary-btn {
  align-self: flex-start; padding: 9px 22px; border-radius: var(--r-md); border: none; cursor: pointer;
  background: linear-gradient(180deg, var(--brand), var(--brand-2)); color: #04111a; font-weight: 600; font-size: 13.5px;
  box-shadow: 0 4px 16px -4px var(--brand-glow); transition: var(--t-mid);
}
.primary-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.state { color: var(--ink-3); padding: 60px; text-align: center; font-family: var(--mono); }

.groups { display: flex; flex-direction: column; gap: 22px; }
.group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.group-type {
  font-family: var(--mono); text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px;
  font-weight: 600; padding: 3px 10px; border-radius: var(--r-pill);
}
.group-type.search { background: rgba(99,102,241,0.12); color: var(--src-search, #6366f1); }
.group-type.rss { background: rgba(245,158,11,0.12); color: var(--src-rss, #f59e0b); }
.group-type.crawler { background: rgba(16,185,129,0.12); color: var(--src-crawl, #10b981); }
.group-count { font-size: 11px; color: var(--ink-3); }

.ds-list { display: flex; flex-direction: column; gap: 8px; }
.ds-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface);
  transition: var(--t-fast);
}
.ds-row.off { opacity: 0.55; }
.ds-row:hover { border-color: var(--brand-line); }
.ds-main { flex: 1; min-width: 0; }
.ds-name { font-family: var(--frau); font-size: 15px; font-weight: 600; color: var(--ink); display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.ds-url { font-size: 11px; color: var(--ink-3); font-weight: 400; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.tchip {
  font-size: 10.5px; padding: 2px 9px; border-radius: var(--r-pill); border: 1px solid var(--line);
  background: var(--bg); color: var(--ink-3); cursor: pointer; transition: var(--t-fast); font-family: var(--mono);
}
.tchip.on { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand); }
.tchip:hover { border-color: var(--brand-line); }

.switch {
  width: 38px; height: 22px; border-radius: var(--r-pill); border: 1px solid var(--line);
  background: var(--surface-3); cursor: pointer; position: relative; transition: var(--t-fast); padding: 0; flex-shrink: 0;
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
  transition: var(--t-fast); flex-shrink: 0;
}
.del-btn:hover { color: #c0392b; border-color: #c0392b; }

.theme-toggle { color: var(--ink-2); }
.theme-toggle:hover { color: var(--brand); background: var(--brand-soft); }
</style>
