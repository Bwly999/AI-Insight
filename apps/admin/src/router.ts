import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/runs" },
  {
    path: "/runs",
    name: "admin-runs",
    component: () => import("./views/AdminRunsView.vue"),
  },
  {
    path: "/settings",
    name: "admin-settings",
    component: () => import("./views/AdminSettingsView.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
