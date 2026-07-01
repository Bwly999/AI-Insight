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
/** 当前已创建的全局 dispatcher 引用，供 shutdownHttp 优雅关闭。 */
let activeDispatcher: Agent | ProxyAgent | null = null;

/**
 * 配置全局出站代理。传 URL 启用代理；传 null/undefined 则用直连。
 * 幂等：重复调用只更新一次。通常 server 启动时调用一次。
 */
export function configureProxy(proxyUrl?: string | null): void {
  if (proxyUrl === currentProxy) return;
  currentProxy = proxyUrl ?? null;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : new Agent();
  activeDispatcher = dispatcher;
  setGlobalDispatcher(dispatcher);
  proxyConfigured = true;
}

/**
 * 优雅关闭全局 dispatcher（释放 keep-alive 连接/定时器）。
 * CLI 短命进程退出前调用——否则 process.exit() 强制 teardown 时，
 * undici 残留句柄会在 Windows 触发 libuv 的 UV_HANDLE_CLOSING 断言。
 * 长驻进程（server）无需调用。幂等；未配置过代理时为空操作。
 *
 * 用 destroy() 而非 close()：close() 只等空闲连接自然关闭，实测仍残留
 * 句柄触发断言；destroy() 强制拆除连接池与内部 Poller，确保退出干净。
 */
export async function shutdownHttp(): Promise<void> {
  const d = activeDispatcher;
  activeDispatcher = null;
  if (d) {
    try {
      await d.destroy();
    } catch {
      /* 忽略：进程即将退出，残留句柄由 teardown 兜底 */
    }
  }
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
  } catch (e) {
    // 网络层错误（连接超时/DNS/拒绝）— fetch 抛 TypeError: fetch failed，
    // 原始 cause 在 e.cause（如 UND_ERR_CONNECT_TIMEOUT）。包裹后向上抛，
    // 避免下游只看到笼统的 "fetch failed" 无法诊断。
    if (e instanceof HttpError) throw e;
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    const reason = cause?.code ?? cause?.message ?? (e as Error).message;
    throw new Error(`fetch failed @ ${url}: ${reason}`, { cause: e });
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
