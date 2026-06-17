import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

/**
 * 管理端路由表 + 管理员守卫。
 * 见 doc/design-doc/08-前端架构.md §8.3 / §8.4。
 *
 * 全局前置守卫：未登录 → 重定向首页拉取用户；role !== ADMIN → 提示无权限。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: '仪表盘', group: '运行监控' },
  },
  {
    path: '/sources',
    name: 'sources',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '数据源', group: '内容配置' },
  },
  {
    path: '/categories',
    name: 'categories',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '领域定义', group: '内容配置' },
  },
  {
    path: '/schedules',
    name: 'schedules',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '报告调度', group: '内容配置' },
  },
  {
    path: '/cron',
    name: 'cron',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '全局 cron', group: '系统' },
  },
  {
    path: '/proxy',
    name: 'proxy',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: 'HTTP 代理', group: '系统' },
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '报告管理', group: '内容配置' },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '用户管理', group: '系统' },
  },
  {
    path: '/channels',
    name: 'channels',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '通知通道', group: '推送管理' },
  },
  { path: '/', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.user && !auth.loading) {
    await auth.fetchMe();
  }
  // 守卫：非 ADMIN 不可进入（见 08-前端架构 §8.4）
  if (auth.user && auth.user.role !== 'ADMIN') {
    if (to.name !== 'forbidden') {
      // 提示无权限（占位：可单独做 forbidden 页）
      console.warn('[admin] 该账号无管理员权限，访问被拒');
    }
    return false;
  }
  return true;
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '控制台';
  document.title = `${title} · AI Insight 控制台`;
});

export default router;
