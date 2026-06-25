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
export const getSettings = () => req<{ settings: Record<string, string> }>("/api/admin/settings");
export const updateSettings = (data: {
  proxy?: string;
  llm?: { providerName?: string; baseUrl?: string; model?: string };
  rssCadence?: string;
}) =>
  req<{ ok: boolean; settings: Record<string, string> }>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });

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
    "tool_call_end", "step_update", "report_created", "run_completed", "run_failed",
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
