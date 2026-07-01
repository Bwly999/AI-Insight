/**
 * 搜索引擎统一接口 + DuckDuckGo 实现（基于 needle + html 端点）。
 *
 * 接口设计（改进自 union-search：原项目无统一接口，引擎各自散落）：
 *   search(input): Promise<DataSourceItem[]>
 * 归一化到 DataSourceItem（强制在引擎边界归一，而非合并时）。
 *
 * DuckDuckGo 用 needle 直请求 html.duckduckgo.com/html/ 端点：
 *   - 用 needle（原生 http.Agent）而非 undici，绕开 Windows 上
 *     undici ProxyAgent 的 UV_HANDLE_CLOSING 原生崩溃
 *   - 用 html 端点（反爬远轻于 links.duckduckgo.com/d.js，后者会被
 *     anomalyDetectionBlock 拦截）；duck-duck-scrape 库即因走 d.js 端点
 *     100% 被反爬拦截而弃用
 *   - 浏览器级 headers（Chrome UA + Accept + Accept-Language）规避反爬
 *   - proxy 通过 needle 的 proxy 选项透传（CONNECT 隧道）
 *
 * 引擎接受注入的 EngineConfig（不再直读 process.env），
 * 使 CLI（JSON 注入）与 server（DB/env 注入）共用同一份代码。
 */
import type { TSchema } from "@sinclair/typebox";
import needle from "needle";
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { timeRangeToDuckDf } from "../time-range.js";
import type { EngineConfig } from "../config.js";

/** 搜索引擎输入。 */
export interface SearchInput {
  query: string;
  timeRange?: TimeRange;
  tags?: DataSourceTag[];
  limit?: number;
  /** 引擎特有参数（由 CLI 从 --<engine>.<param> flag 解析注入；引擎自行解释）。 */
  params?: Record<string, unknown>;
}

/**
 * 搜索引擎统一接口。
 *
 * `paramsSchema`：引擎特有参数的 TypeBox schema。
 * CLI 据此自动生成 `--<name>.<param>` flag 并静态校验。
 * 无特有参数的引擎（如 ddg）留空。
 */
export interface SearchEngine {
  /** 引擎 id（用于 --engines 选项与注册表 key，如 "ddg"）。 */
  readonly name: string;
  /** 展示名（用于 sourceName 与帮助文本，如 "DuckDuckGo"）。 */
  readonly label: string;
  /** 是否已配置（缺 key 的引擎返回 false，扇出时跳过）。 */
  isConfigured(): boolean;
  /** 执行搜索，返回归一化 DataSourceItem[]。 */
  search(input: SearchInput): Promise<DataSourceItem[]>;
  /** 引擎特有参数 schema（CLI 据此生成命名空间 flag）。 */
  readonly paramsSchema?: TSchema;
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo — needle + html 端点（绕开 undici 崩溃 + 反爬）
// ─────────────────────────────────────────────────────────────────────────────

const DDG_URL = "https://html.duckduckgo.com/html/";

/** 浏览器级 headers（规避反爬：模拟真实浏览器，而非裸 fetch）。 */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  // 避免 DDG 反爬把请求当机器
  Referer: "https://duckduckgo.com/",
};

/**
 * 解包 DDG 重定向 URL（//duckduckgo.com/l/?uddg=<encoded> → 真实 URL）。
 * 移植自 ref/ddg-demo/search.js 的 unwrapRedirect。
 */
function unwrapRedirect(href: string | undefined): string {
  if (!href) return "";
  try {
    const full = href.startsWith("//") ? "https:" + href : href;
    if (full.includes("uddg=")) {
      const u = new URL(full);
      const uddg = u.searchParams.get("uddg");
      if (uddg) return uddg;
    }
  } catch {
    /* fall through */
  }
  return href;
}

export class DuckDuckGoEngine implements SearchEngine {
  readonly name = "ddg";
  readonly label = "DuckDuckGo";
  /** needle 请求选项：透传 proxy（绕开 undici，用 needle 的 CONNECT 隧道）。 */
  private needleOpts: needle.NeedleOptions;

  constructor(cfg: EngineConfig = {}) {
    this.needleOpts = {
      headers: BROWSER_HEADERS,
      follow: 5, // 跟随重定向
      timeout: 15000,
      ...(cfg.proxyUrl ? { proxy: cfg.proxyUrl } : {}),
    };
  }

  isConfigured(): boolean {
    return true; // 无 key
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    const limit = Math.min(input.limit ?? 10, 10);
    const df = input.timeRange ? timeRangeToDuckDf(input.timeRange) : undefined;

    // DDG lite 用 POST + form data；df=d/w/m/y 控制时间窗
    const data: Record<string, string> = { q: input.query, b: "", l: "wt-wt" };
    if (df) data.df = df;

    const res = await needle("post", DDG_URL, data, this.needleOpts);
    const body = typeof res.body === "string" ? res.body : String(res.body);

    if (res.statusCode !== 200) {
      throw new Error(`DuckDuckGo returned HTTP ${res.statusCode}`);
    }
    // 反爬检测：DDG 返回 anomalyDetectionBlock 页面而非结果
    if (body.includes("anomalyDetectionBlock")) {
      throw new Error("DuckDuckGo anomaly block detected (rate limited?)");
    }

    // 动态 import cheerio（避免顶层 import 影响其他不用 cheerio 的引擎）
    const cheerioMod = await import("cheerio");
    const $ = cheerioMod.load(body);
    const items: DataSourceItem[] = [];
    const now = new Date().toISOString();

    $("div.result").each((_, el) => {
      if (items.length >= limit) return false;
      const $el = $(el);
      // 过滤广告：DDG 给广告 result 标记 class "result--ad"
      // （真实结果 class 含 "web-result"，无 "result--ad"）
      const cls = $el.attr("class") ?? "";
      if (cls.includes("result--ad")) return;
      const $a = $el.find("h2 a").first();
      const title = $a.text().trim();
      const href = unwrapRedirect($a.attr("href"));
      const snippet = $el.find("a.result__snippet").first().text().trim();
      if (!title || !href) return;
      items.push({
        id: `search:duckduckgo:${href}`,
        sourceType: "search",
        sourceName: this.label,
        sourceId: href,
        title,
        url: href,
        summary: snippet || undefined,
        tags: input.tags ?? [],
        fetchedAt: now,
      });
    });

    return items;
  }
}
