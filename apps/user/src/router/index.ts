import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/**
 * 用户端路由表。
 * 见 doc/design-doc/08-前端架构.md §8.2。
 *
 * Phase 0：仅注册路由 + 占位页面，验证 dev 启动与 Tailwind（A6）。
 * Phase 3 落地真实页面与数据（验收 D5–D8）。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'current',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '本期报告' },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '往期报告' },
  },
  {
    path: '/reports/:id',
    name: 'report-detail',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '报告详情' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '订阅设置' },
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '我的反馈' },
  },
  {
    path: '/insight',
    name: 'insight',
    component: () => import('../views/InsightView.vue'),
    meta: { title: '主动洞察' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'The Insight Review';
  document.title = `${title} · The Insight Review`;
});

export default router;
