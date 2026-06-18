<script setup lang="ts">
/**
 * AdminShell：左侧固定侧边栏 + 顶栏布局。
 * 见 doc/design-doc/15-UIUX设计.md §15.3.4。
 */
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const auth = useAuthStore();

const navGroups = computed(() => [
  {
    label: '运行监控',
    items: [
      { to: '/dashboard', label: '仪表盘' },
      { to: '/insight/sessions', label: '洞察会话' },
    ],
  },
  {
    label: '内容配置',
    items: [
      { to: '/sources', label: '数据源' },
      { to: '/categories', label: '领域定义' },
      { to: '/schedules', label: '报告调度' },
      { to: '/reports', label: '报告管理' },
    ],
  },
  {
    label: '推送管理',
    items: [{ to: '/channels', label: '通知通道' }],
  },
  {
    label: '系统',
    items: [
      { to: '/cron', label: '全局 cron' },
      { to: '/proxy', label: 'HTTP 代理' },
      { to: '/users', label: '用户管理' },
    ],
  },
]);
</script>

<template>
  <div class="min-h-screen flex">
    <!-- 侧边栏 -->
    <aside class="w-60 shrink-0 p-4 sticky top-0 h-screen overflow-auto" style="background: var(--paper-2); border-right: 1px solid var(--rule)">
      <div class="pb-4 mb-4" style="border-bottom: 1px solid var(--rule)">
        <p class="metric-num text-xl" style="color: var(--vermillion)">AI Insight</p>
        <p class="text-xs opacity-60 mono-data">控制室 · CONSOLE</p>
      </div>
      <nav v-for="g in navGroups" :key="g.label" class="mb-5">
        <p class="text-[10px] uppercase tracking-widest opacity-50 mb-2 mono-data">{{ g.label }}</p>
        <RouterLink
          v-for="item in g.items"
          :key="item.to"
          :to="item.to"
          class="block px-3 py-2 text-sm rounded-sm transition-colors"
          :class="route.path === item.to ? '' : 'opacity-80 hover:opacity-100'"
          :style="route.path === item.to
            ? 'background: var(--bg-hover); color: var(--paper); border-left: 2px solid var(--vermillion)'
            : ''"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- 主区 -->
    <div class="flex-1 min-w-0">
      <!-- 顶栏 -->
      <header class="flex items-center px-8 py-4" style="border-bottom: 1px solid var(--rule)">
        <h1 class="metric-num text-2xl">{{ (route.meta.title as string) ?? '控制台' }}</h1>
        <div class="ml-auto flex items-center gap-4 text-sm">
          <span v-if="auth.user" class="mono-data">
            {{ auth.user.name }} · <span style="color: var(--forest)">{{ auth.user.role }}</span>
          </span>
          <span v-else class="mono-data opacity-50">未登录</span>
        </div>
      </header>

      <main class="p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
