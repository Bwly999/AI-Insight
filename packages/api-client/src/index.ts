/**
 * @ai-insight/api-client — 前端 REST + SSE + TokenProvider 封装。
 *
 * 设计 §3.7：TokenProvider 接口（dev 存 localStorage，prod 内网 SSO 注入）。
 * REST：fetch 封装，自动带 Authorization。
 * SSE：EventSource 封装（run stream）。
 */
import type {
  Conversation,
  ConversationConfig,
  ConversationWithMessages,
  DataSource,
  InsightRun,
  LensKey,
  Message,
  Report,
  RunItem,
  Schedule,
  AgentEvent,
} from "@ai-insight/shared-types";

// ─── TokenProvider ────────────────────────────────────────────────────────
export interface TokenProvider {
  getToken(): string | null;
  setToken(token: string | null): void;
}

const TOKEN_KEY = "ai-insight-token";

/** dev TokenProvider：localStorage。 */
export const localStorageTokenProvider: TokenProvider = {
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

// ─── 配置 ─────────────────────────────────────────────────────────────────
const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? "";

function authHeaders(): Record<string, string> {
  const t = localStorageTokenProvider.getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────
export async function devLogin(role: "user" | "admin" = "user"): Promise<{ token: string; user: { id: string; role: string; name: string } }> {
  const r = await req<{ token: string; user: { id: string; role: string; name: string } }>(
    "/api/auth/dev-login",
    { method: "POST", body: JSON.stringify({ role }) },
  );
  localStorageTokenProvider.setToken(r.token);
  return r;
}

// ─── Conversations ────────────────────────────────────────────────────────
export const listConversations = () => req<{ items: Conversation[] }>("/api/conversations");
export const getConversation = (id: string) => req<ConversationWithMessages>(`/api/conversations/${id}`);
export const createConversation = (data: { title?: string; config?: Partial<ConversationConfig> }) =>
  req<Conversation>("/api/conversations", { method: "POST", body: JSON.stringify(data) });
export const patchConversation = (id: string, patch: { title?: string; config?: Partial<ConversationConfig> }) =>
  req<Conversation>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const sendMessage = (conversationId: string, text: string, config?: Partial<ConversationConfig>) =>
  req<{ run: InsightRun; message: Message }>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, config }),
  });

// ─── Runs ─────────────────────────────────────────────────────────────────
export const getRun = (id: string) => req<InsightRun>(`/api/runs/${id}`);
export const abortRun = (id: string) => req<{ ok: boolean }>(`/api/runs/${id}/abort`, { method: "POST" });

/** 回复 Agent 的澄清请求（暂停/恢复会话）。 */
export const submitRunInput = (runId: string, text: string) =>
  req<{ ok: boolean }>(`/api/runs/${runId}/input`, { method: "POST", body: JSON.stringify({ text }) });

/** 本轮采集的来源条目（证据面板展开）。 */
export const listRunItems = (runId: string) =>
  req<{ items: RunItem[] }>(`/api/runs/${runId}/items`);

// ─── Reports ──────────────────────────────────────────────────────────────
export const listReports = (conversationId?: string) =>
  req<{ items: Report[] }>(`/api/reports${conversationId ? `?conversationId=${conversationId}` : ""}`);
export const getReport = (id: string) => req<Report>(`/api/reports/${id}`);
export function reportHtmlUrl(id: string): string {
  return `${API_BASE}/api/reports/${id}/html`;
}

// ─── DataSources ──────────────────────────────────────────────────────────
export const listDataSources = () => req<{ items: DataSource[] }>("/api/datasources");

// ─── Schedules ────────────────────────────────────────────────────────────
export const listSchedules = () => req<{ items: Schedule[] }>("/api/schedules");
export const createSchedule = (data: {
  prompt: string;
  config?: ConversationConfig;
  cron: string;
  lens?: LensKey;
}) => req<Schedule>("/api/schedules", { method: "POST", body: JSON.stringify(data) });
export const patchSchedule = (
  id: string,
  patch: { enabled?: boolean; cron?: string; prompt?: string },
) => req<Schedule>(`/api/schedules/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteSchedule = (id: string) =>
  req<void>(`/api/schedules/${id}`, { method: "DELETE" });

// ─── Admin（admin 角色）──────────────────────────────────────────────────
export const listAllRuns = () =>
  req<{ items: (InsightRun & { conversationTitle?: string; reportTitle?: string })[] }>(
    "/api/admin/runs",
  );
export const listAllSchedules = () => req<{ items: Schedule[] }>("/api/admin/schedules");

/** 当前生效代理来源（settings=管理端热切换 / env=PROXY_URL / null=直连）。 */
export type ProxySource = "settings" | "env" | null;

export interface SettingsResponse {
  settings: Record<string, string>;
  proxySource?: { value: string; source: ProxySource };
}

export const getSettings = () => req<SettingsResponse>("/api/admin/settings");
export const updateSettings = (data: {
  proxy?: string;
  llm?: { providerName?: string; baseUrl?: string; model?: string };
  rssCadence?: string;
}) =>
  req<{ ok: boolean; settings: Record<string, string>; proxySource?: { value: string; source: ProxySource } }>(
    "/api/admin/settings",
    { method: "PUT", body: JSON.stringify(data) },
  );

/** 测试代理连通性（不写库）。proxy 省略则测当前生效代理。 */
export const testProxy = (data: { proxy?: string }) =>
  req<{ ok: boolean; status: number; latencyMs: number; testedProxy: string; error?: string }>(
    "/api/admin/proxy/test",
    { method: "POST", body: JSON.stringify(data) },
  );

// admin 数据源管理（admin 门禁封装；数据源为全局实体）
export const listAllDataSources = (type?: "search" | "rss" | "crawler") =>
  req<{ items: DataSource[] }>(`/api/admin/datasources${type ? `?type=${type}` : ""}`);
export const patchAdminDataSource = (
  id: string,
  patch: { enabled?: boolean; tags?: import("@ai-insight/shared-types").DataSourceTag[]; name?: string },
) => req<DataSource>(`/api/admin/datasources/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const createAdminDataSource = (data: {
  name: string;
  feedUrl: string;
  tags?: import("@ai-insight/shared-types").DataSourceTag[];
}) => req<DataSource>("/api/admin/datasources", { method: "POST", body: JSON.stringify(data) });
export const deleteAdminDataSource = (id: string) =>
  req<void>(`/api/admin/datasources/${id}`, { method: "DELETE" });

// ─── SSE run stream ───────────────────────────────────────────────────────
/**
 * 订阅 Run 的 SSE 事件流。
 * @returns 关闭函数。
 *
 * 注意：EventSource 不支持自定义 header，token 经 query 传递（后端 dev 放行）。
 */
export function subscribeRunStream(
  runId: string,
  onEvent: (ev: AgentEvent) => void,
  onError?: (e: Event) => void,
): () => void {
  const token = localStorageTokenProvider.getToken();
  const url = `${API_BASE}/api/runs/${runId}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const es = new EventSource(url);
  // SSE event 名 = AgentEvent.type
  const types = [
    "run_started", "thinking_delta", "text_delta", "tool_call_start",
    "tool_call_end", "lens_selected", "clarification_needed",
    "report_created", "run_completed", "run_failed",
  ];
  for (const t of types) {
    es.addEventListener(t, (e) => {
      try {
        onEvent(JSON.parse((e as MessageEvent).data) as AgentEvent);
      } catch {
        /* ignore parse error */
      }
    });
  }
  es.addEventListener("hello", () => {
    /* 连接确认 */
  });
  if (onError) es.onerror = onError;
  return () => es.close();
}
