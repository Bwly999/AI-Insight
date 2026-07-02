/**
 * 会话路由 — CRUD + 发消息触发 Run。
 *
 * POST /api/conversations/:id/messages 是洞察入口：建 user msg + run(queued) → 入队 Runner。
 * 此文件暴露 enqueueRun 钩子，由 main.ts 启动 Runner 后注册。
 */
import type { FastifyInstance } from "fastify";
import type { ConversationConfig, TimeRange } from "@ai-insight/shared-types";
import * as repo from "../repo.js";
import { deriveTitle } from "../util.js";

/** 发消息后触发 Run 的钩子（由 main.ts 注册 Runner 后注入）。 */
export type EnqueueRunFn = (runId: string, conversationId: string) => void;
let _enqueueRun: EnqueueRunFn | null = null;

/** 注册「发消息 → 入队 Run」钩子（main.ts 启动 Runner 时调用）。 */
export function setEnqueueRun(fn: EnqueueRunFn): void {
  _enqueueRun = fn;
}

const DEFAULT_CONFIG: ConversationConfig = {
  timeRange: "1w",
  // lens 留空：由 Agent 按意图自主路由（skill 模型）；用户显式指定时才覆盖
};

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  // 列表
  app.get("/api/conversations", { preHandler: app.authenticate }, async (req) => {
    const userId = req.user!.userId;
    return { items: repo.listConversations(userId) };
  });

  // 新建
  app.post("/api/conversations", { preHandler: app.authenticate }, async (req, reply) => {
    const userId = req.user!.userId;
    const body = (req.body ?? {}) as { title?: string; config?: Partial<ConversationConfig> };
    const title = body.title ?? "新洞察";
    const config: ConversationConfig = {
      ...DEFAULT_CONFIG,
      ...(body.config ?? {}),
      timeRange: (body.config?.timeRange ?? DEFAULT_CONFIG.timeRange) as TimeRange,
    };
    const conv = repo.createConversation(userId, title, config);
    return reply.code(201).send(conv);
  });

  // 详情（含消息历史）
  app.get("/api/conversations/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const conv = repo.getConversationWithMessages((req.params as { id: string }).id);
    if (!conv) return reply.code(404).send({ error: "not_found" });
    return conv;
  });

  // 改 config/title
  app.patch("/api/conversations/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { title?: string; config?: Partial<ConversationConfig> };
    const conv = repo.patchConversation(id, {
      ...(body.title != null && { title: body.title }),
      ...(body.config != null && { config: body.config as ConversationConfig }),
    });
    if (!conv) return reply.code(404).send({ error: "not_found" });
    return conv;
  });

  app.delete("/api/conversations/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ok = repo.softDeleteConversation(id);
    if (!ok) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  // 发用户消息 → 触发 Run
  app.post("/api/conversations/:id/messages", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const conv = repo.getConversation(id);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const body = (req.body ?? {}) as { text: string; config?: Partial<ConversationConfig> };
    const prompt = (body.text ?? "").trim();
    if (!prompt) return reply.code(400).send({ error: "empty_message" });

    // 若带了 config 更新会话配置
    let config = conv.config;
    if (body.config) {
      config = { ...config, ...body.config } as ConversationConfig;
      repo.patchConversation(id, { config });
    }

    // 首条消息时用 prompt 派生标题
    if (conv.title === "新洞察") {
      repo.patchConversation(id, { title: deriveTitle(prompt) });
    }

    // 建 user message
    const userMsg = repo.addMessage(id, "user", { kind: "text", text: prompt });

    // 建 run(queued)
    const run = repo.createRun(id, userMsg.id, prompt, config, config.lens);

    // 入队（main.ts 注册 Runner 后注入；未注册时 run 停在 queued，不阻塞路由）
    if (_enqueueRun) _enqueueRun(run.id, id);

    return reply.code(201).send({ run, message: userMsg });
  });
}
