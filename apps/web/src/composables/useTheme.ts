/**
 * useTheme — 深色情报台双主题（dark 默认 / light）。
 *
 * 在 document.documentElement 上设 data-theme，并持久化到 localStorage。
 * 多组件共享同一 ref（模块级单例）。
 */
import { ref } from "vue";

export type Theme = "dark" | "light";

const STORAGE_KEY = "ai-insight-theme";

function readInitial(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return "dark";
}

const theme = ref<Theme>(readInitial());

function apply(t: Theme) {
  theme.value = t;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
  }
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
}

/** 挂载前同步应用一次（避免主题闪烁），在 main.ts / App.vue setup 早期调用。 */
export function initTheme() {
  apply(theme.value);
}

export function useTheme() {
  return {
    theme,
    toggle: () => apply(theme.value === "dark" ? "light" : "dark"),
    setTheme: (t: Theme) => apply(t),
  };
}
