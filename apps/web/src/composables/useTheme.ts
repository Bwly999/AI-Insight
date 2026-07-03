/**
 * useTheme — 深色情报台双主题（dark 默认 / light）。
 *
 * 在 document.documentElement 上设 data-theme，并持久化到 localStorage。
 * 多组件共享同一 ref（模块级单例）。
 *
 * 切换主题时，若浏览器支持 View Transitions API，则触发以点击位置为圆心
 * 的圆形展开过渡（参考 https://hsinyau.com/posts/view-transitions-api）。
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
  return "light";
}

const theme = ref<Theme>(readInitial());

/** 最近一次触发切换的坐标（视口相对），用于圆形展开的圆心。 */
let lastTransitionXY: { x: number; y: number } | null = null;

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

/** 是否支持 View Transitions API。 */
function supportsViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof (
      document as Document & {
        startViewTransition?: unknown;
      }
    ).startViewTransition === "function"
  );
}

/**
 * 切换主题。可选传入触发事件的坐标（视口相对），用于圆形展开动画的圆心。
 * 不传则回退到屏幕中心。
 */
function toggle(event?: { clientX: number; clientY: number }) {
  const next: Theme = theme.value === "dark" ? "light" : "dark";

  if (!supportsViewTransition()) {
    apply(next);
    return;
  }

  // 记录圆心：优先用事件坐标，否则屏幕中心
  lastTransitionXY = event
    ? { x: event.clientX, y: event.clientY }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  // 通过 CSS 自定义属性把圆心传给 ::view-transition-*(root)
  document.documentElement.style.setProperty(
    "--vt-x",
    `${lastTransitionXY.x}px`,
  );
  document.documentElement.style.setProperty(
    "--vt-y",
    `${lastTransitionXY.y}px`,
  );

  // 打上本次目标主题标记，CSS 据此选择展开或收缩方向
  document.documentElement.dataset.vtTo = next;

  const transition = (
    document as Document & {
      startViewTransition: (cb: () => void) => { finished: Promise<void> };
    }
  ).startViewTransition(() => apply(next));
  transition.finished
    .catch(() => {
      /* 用户可能在中途再次切换，跳过跳过的过渡会 reject，忽略 */
    })
    .finally(() => {
      // 动画结束后清理标记，避免残留影响下次或被 selector 命中
      delete document.documentElement.dataset.vtTo;
    });
}

/** 挂载前同步应用一次（避免主题闪烁），在 main.ts / App.vue setup 早期调用。 */
export function initTheme() {
  apply(theme.value);
}

export function useTheme() {
  return {
    theme,
    toggle,
    setTheme: (t: Theme) => apply(t),
  };
}
