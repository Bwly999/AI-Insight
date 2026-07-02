/**
 * 组件间共享的局部类型（仅 web 组件用）。
 * ToolCallState 单一来源在 composables/blocks（ToolBlock 别名），此处 re-export 供组件引用。
 */
export type { ToolCallState } from "../composables/useInsightRun";

/** 工具 → 信号色（用 CSS 变量名引用主题） */
export function toolColor(toolName: string): { bg: string; fg: string; varName: string } {
  if (toolName === "search") return { bg: "color-mix(in srgb, var(--src-search) 18%, transparent)", fg: "var(--src-search)", varName: "--src-search" };
  if (toolName === "fetch_rss" || toolName === "rss") return { bg: "color-mix(in srgb, var(--src-rss) 18%, transparent)", fg: "var(--src-rss)", varName: "--src-rss" };
  if (toolName === "crawl") return { bg: "color-mix(in srgb, var(--src-crawl) 18%, transparent)", fg: "var(--src-crawl)", varName: "--src-crawl" };
  if (toolName === "read") return { bg: "color-mix(in srgb, var(--text-3) 22%, transparent)", fg: "var(--text-2)", varName: "--text-2" };
  if (toolName === "ask") return { bg: "color-mix(in srgb, var(--amber) 22%, transparent)", fg: "var(--amber)", varName: "--amber" };
  return { bg: "color-mix(in srgb, var(--accent) 18%, transparent)", fg: "var(--accent)", varName: "--accent" };
}

export function toolLabel(t: string): string {
  return (
    {
      search: "搜索",
      crawl: "抓取",
      fetch_rss: "RSS",
      rss: "RSS",
      extract_content: "提取",
      list_datasources: "数据源",
      save_report: "报告",
      read: "读取",
      ask: "澄清",
    } as Record<string, string>
  )[t] ?? t;
}

export function toolArgsPreview(args: Record<string, unknown>): string {
  const q = args.query as string | undefined;
  if (q) return q;
  const kw = args.keywords as string[] | undefined;
  if (kw) return kw.join(" ");
  const url = args.url as string | undefined;
  if (url) return url;
  const platforms = args.platforms as string[] | undefined;
  if (platforms) return platforms.join("·");
  return JSON.stringify(args).slice(0, 50);
}
