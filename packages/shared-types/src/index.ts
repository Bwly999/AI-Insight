/**
 * AI-Insight 前后端共享类型 / 枚举 / DTO。
 *
 * 领域语言见 ../../CONTEXT.md。命名严格对齐领域术语：
 * Insight / Insight Run / Report / Conversation / DataSource / Schedule / Lens。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 枚举
// ─────────────────────────────────────────────────────────────────────────────

/** 数据源类型 */
export type DataSourceType = "search" | "rss" | "crawler";

/** 数据源标签 — 帮 Agent 针对性调用 */
export type DataSourceTag =
  | "general"
  | "news"
  | "academic"
  | "tech"
  | "product"
  | "business"
  | "social";

/** 洞察时间窗（Run 配置） */
export type TimeRange = "1d" | "3d" | "1w" | "1m" | "6m" | "1y" | "all";

/** 分析视角（Lens，可选） */
export type LensKey = "deep" | "dual" | "flash" | "timeline";

/** 用户角色 */
export type UserRole = "user" | "admin";

/** 消息角色 */
export type MessageRole = "user" | "assistant" | "tool";

/** Insight Run 状态 */
export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_input" // Agent 反问用户，暂停等待回复（Claude-Code 式暂停/恢复）
  | "completed"
  | "failed"
  | "interrupted";

/** DataSourceItem 的来源类型（归一化） */
export type ItemSourceType = "search" | "rss" | "crawler";

// ─────────────────────────────────────────────────────────────────────────────
// 常量映射（UI 与后端共享）
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1d", label: "当天" },
  { value: "3d", label: "三日" },
  { value: "1w", label: "一周" },
  { value: "1m", label: "一月" },
  { value: "6m", label: "半年" },
  { value: "1y", label: "一年" },
  { value: "all", label: "全部" },
];

export const LENS_OPTIONS: { key: LensKey; label: string }[] = [
  { key: "deep", label: "综合" },
  { key: "dual", label: "正反" },
  { key: "flash", label: "速览" },
  { key: "timeline", label: "脉络" },
];

export const ALL_TAGS: DataSourceTag[] = [
  "general",
  "news",
  "academic",
  "tech",
  "product",
  "business",
  "social",
];

export const TAG_LABELS: Record<DataSourceTag, string> = {
  general: "通用",
  news: "新闻",
  academic: "学术",
  tech: "技术",
  product: "产品",
  business: "商业",
  social: "社交",
};

// ─────────────────────────────────────────────────────────────────────────────
// 核心实体 DTO
// ─────────────────────────────────────────────────────────────────────────────

/** Conversation（会话）：ChatGPT 式对话线程，承载发起 Insight 的上下文。 */
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  config: ConversationConfig;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Conversation 级运行配置（时间窗 + 标签偏好）。 */
export interface ConversationConfig {
  timeRange: TimeRange;
  tagPrefs: DataSourceTag[];
  lens?: LensKey; // 默认 deep
}

/** Message（消息）：对话历史的一条，DB 为唯一真相源。 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: MessageContent;
  toolCall?: ToolCallRecord;
  runId?: string;
  createdAt: string;
}

export type MessageContent =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool_result"; toolName: string; summary: string; found: number }
  // Agent 反问用户（落库以便历史回看；回复作为普通 user msg 落库）
  | { kind: "clarification"; inputId: string; question: string; options?: string[] };

/** 工具调用记录（落 message 行）。 */
export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  found?: number; // 命中条数
  durationMs?: number;
}

/** Insight Run（洞察运行）：Insight 的一次执行。 */
export interface InsightRun {
  id: string;
  conversationId: string;
  triggerMessageId: string;
  status: RunStatus;
  lens?: LensKey;
  config: ConversationConfig;
  prompt: string;
  startedAt?: string;
  endedAt?: string;
  tokens?: number;
  reportId?: string;
  error?: string;
  createdAt: string;
}

/** Report（报告）：Insight Run 的核心交付产物，一等公民。 */
export interface Report {
  id: string;
  runId: string;
  conversationId: string;
  title: string;
  standfirst?: string; // 导语
  markdown: string;
  html: string; // standalone HTML（editorial 版式）
  createdAt: string;
}

/** DataSource（数据源实体）：DB 一行。 */
export interface DataSource {
  id: string;
  type: DataSourceType;
  name: string;
  tags: DataSourceTag[];
  enabled: boolean;
  config: Record<string, unknown>; // type 相关：search=引擎名 / rss={feedUrl} / crawler={platform}
  createdAt: string;
}

/** DataSourceItem（归一化条目）：跨源统一结构，去重 key = 规范化 URL。 */
export interface DataSourceItem {
  id: string; // 内部 id（sourceType:sourceName:sourceId）
  sourceType: ItemSourceType;
  sourceName: string;
  sourceId: string;
  title: string;
  url: string;
  summary?: string;
  content?: string; // 正文（extract_content 后填充）
  author?: string;
  publishedAt?: string; // ISO
  tags: DataSourceTag[];
  heat?: number; // 0-100 热度（结构化，区别于 newsnow 的 freeform extra.info）
  fetchedAt: string; // ISO
}

/** RunItem（本轮工具命中的来源条目，落 run_items 表）：供证据面板展开展示。 */
export interface RunItem {
  id: string;
  runId: string;
  toolName: string;
  sourceType: ItemSourceType;
  sourceName: string;
  sourceId: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  fetchedAt: string;
  createdAt: string;
}

/** Schedule（定时任务）：把一个 Insight 配置为定时重复执行。 */
export interface Schedule {
  id: string;
  userId: string;
  prompt: string;
  config: ConversationConfig;
  cron: string;
  lens?: LensKey;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

/** 用户 */
export interface User {
  id: string;
  role: UserRole;
  externalId?: string;
  name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 运行事件（SSE 透传给前端）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agent 运行过程中的事件，经 SSE 透传前端。
 * 由 packages/agent 把 Pi SDK 的 AgentEvent 映射为本类型。
 */
export type AgentEvent =
  | { type: "run_started"; runId: string; prompt: string }
  | { type: "thinking_delta"; runId: string; text: string }
  | { type: "text_delta"; runId: string; text: string }
  | { type: "tool_call_start"; runId: string; toolName: string; toolCallId: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; runId: string; toolName: string; toolCallId: string; found?: number; durationMs: number; ok: boolean }
  // Agent 通过 read 打开某 Lens 的 reference 文件时触发（暴露 Agent 实际选用的视角）
  | { type: "lens_selected"; runId: string; lens: LensKey }
  // Agent 用 ask 工具反问用户：run 进入 awaiting_input，前端渲染澄清卡，回复走 POST /api/runs/:id/input
  | { type: "clarification_needed"; runId: string; inputId: string; question: string; options?: string[] }
  | { type: "report_created"; runId: string; report: Report }
  | { type: "run_completed"; runId: string; tokens?: number }
  | { type: "run_failed"; runId: string; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// API 响应封装
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  lastRun?: InsightRun;
}
