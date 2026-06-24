/**
 * URL 规范化与去重 — 移植自 ref/union-search-skill 的 _normalize_link / dedup 逻辑。
 *
 * 去重 key = 规范化 URL。规范化：去跟踪参数（utm_* 等）、去 fragment、
 * 小写 scheme+host、去尾斜杠。Yahoo 重定向链接先解包 RU 参数。
 */

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "ref_url",
  "_hsenc",
  "_hsmi",
  "igshid",
  "yclid",
  "msclkid",
  "spm",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAMS.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p));
}

/** 解包 Yahoo / DuckDuckGo 等重定向包装的真正 URL。 */
function unwrapRedirect(url: string): string {
  try {
    const u = new URL(url);
    // duckduckgo.com/l/?uddg=<encoded>
    const uddg = u.searchParams.get("uddg");
    if (uddg) {
      try {
        return decodeURIComponent(uddg);
      } catch {
        return uddg;
      }
    }
    // yahoo: RU=<encoded> query 或 /RU=<encoded>/ path
    const ru = u.searchParams.get("RU");
    if (ru) {
      try {
        return decodeURIComponent(ru);
      } catch {
        return ru;
      }
    }
    const ruPath = u.pathname.match(/\/RU=([^/]+)\//);
    if (ruPath?.[1]) {
      try {
        return decodeURIComponent(ruPath[1]);
      } catch {
        return ruPath[1];
      }
    }
    // google news: url=<encoded>
    const gurl = u.searchParams.get("url");
    if (gurl) {
      try {
        return decodeURIComponent(gurl);
      } catch {
        return gurl;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * 规范化 URL：去跟踪参数、去 fragment、小写 scheme+host、去尾斜杠。
 * 返回的字符串用作去重 key。
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  let url = unwrapRedirect(rawUrl.trim());

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // 非法 URL，原样返回（小写化）
    return url.toLowerCase();
  }

  // 小写 scheme + host
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  // 去跟踪参数
  const keys = Array.from(u.searchParams.keys());
  for (const k of keys) {
    if (isTrackingParam(k)) u.searchParams.delete(k);
  }

  // 去尾斜杠（仅根路径）
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  // 排序 query 参数，保证顺序无关
  u.searchParams.sort();

  // 去 fragment
  u.hash = "";

  return u.toString();
}

/** 规范化标题：折叠空白 + 小写（Unicode fold 近似）。 */
export function normalizeTitle(title: string): string {
  return (title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 去重：按规范化 URL（首选）或规范化标题去重。
 * 保留首次出现，丢弃后续重复。
 */
export function dedupeItems<T extends { url?: string; title?: string }>(
  items: T[],
): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const url = item.url ? normalizeUrl(item.url) : "";
    const title = item.title ? normalizeTitle(item.title) : "";
    if (url && seenUrls.has(url)) continue;
    if (title && seenTitles.has(title)) continue;
    if (url) seenUrls.add(url);
    if (title) seenTitles.add(title);
    out.push(item);
  }
  return out;
}
