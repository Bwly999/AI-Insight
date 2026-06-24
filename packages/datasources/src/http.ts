/**
 * 统一 HTTP 客户端 — 全部出站走此出口，代理在出口统一处理（见 ADR-0004）。
 *
 * 代理：启动时若有 PROXY_URL，建 undici ProxyAgent 设为全局 dispatcher，
 * 数据源层不感知代理。本模块封装 fetch，提供 json()/text() 便捷方法，
 * 并内置超时与浏览器 UA。
 */
import { ProxyAgent, setGlobalDispatcher, Agent } from "undici";

let proxyConfigured = false;
let currentProxy: string | null = null;

/**
 * 配置全局出站代理。传 URL 启用代理；传 null/undefined 则用直连。
 * 幂等：重复调用只更新一次。通常 server 启动时调用一次。
 */
export function configureProxy(proxyUrl?: string | null): void {
  if (proxyUrl === currentProxy) return;
  currentProxy = proxyUrl ?? null;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } else {
    setGlobalDispatcher(new Agent());
  }
  proxyConfigured = true;
}

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** 超时（毫秒），默认 15000。 */
  timeoutMs?: number;
  /** 自定义 UA。 */
  userAgent?: string;
  /** 自定义 dispatcher（覆盖全局，用于强制直连测试）。 */
  dispatcher?: unknown;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public url: string,
  ) {
    super(`${message} (HTTP ${status}) @ ${url}`);
    this.name = "HttpError";
  }
}

/** 底层 fetch 封装（带超时）。返回 Response。 */
export async function rawFetch(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 15000,
  );
  const headers: Record<string, string> = {
    "User-Agent": opts.userAgent ?? DEFAULT_UA,
    ...(opts.headers ?? {}),
  };
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body,
      signal: controller.signal,
      ...(opts.dispatcher ? { dispatcher: opts.dispatcher as never } : {}),
    });
    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, url);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/** GET 并返回解析后的 JSON。 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await rawFetch(url, opts);
  return (await res.json()) as T;
}

/** GET 并返回文本（HTML / XML / 纯文本）。 */
export async function fetchText(
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const res = await rawFetch(url, opts);
  return res.text();
}

/** POST JSON 并返回解析后的 JSON。 */
export async function postJson<T = unknown>(
  url: string,
  payload: unknown,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await rawFetch(url, {
    ...opts,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers ?? {}),
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
  return (await res.json()) as T;
}

export { HttpError, proxyConfigured };
