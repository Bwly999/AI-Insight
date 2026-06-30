import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/runs" },
  {
    path: "/runs",
    name: "admin-runs",
    component: () => import("./views/AdminRunsView.vue"),
  },
  {
    path: "/schedules",
    name: "admin-schedules",
    component: () => import("./views/AdminSchedulesView.vue"),
  },
  {
    path: "/datasources",
    name: "admin-datasources",
    component: () => import("./views/AdminDataSourcesView.vue"),
  },
  {
    path: "/settings",
    name: "admin-settings",
    component: () => import("./views/AdminSettingsView.vue"),
  },
];

export const router = createRouter({
  // hash 模式：与视图里的 <a href="#/xxx"> tab 链接匹配。
  // （history 模式不监听 hashchange，会导致"URL 变了但页面不切"。）
  history: createWebHashHistory(),
  routes,
});
