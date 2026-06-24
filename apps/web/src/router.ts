import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/c/new" },
  {
    path: "/c/:id",
    name: "conversation",
    component: () => import("./views/ConversationView.vue"),
    props: true,
  },
  {
    path: "/reports",
    name: "reports",
    component: () => import("./views/ReportsView.vue"),
  },
  {
    path: "/reports/:id",
    name: "report",
    component: () => import("./views/ReportView.vue"),
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
