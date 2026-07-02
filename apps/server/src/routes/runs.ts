/**
 * 运行路由 — Run 状态 + SSE 事件流 + 中止。
 *
 * GET /api/runs/:id/stream 是 SSE 端点（EventSource）。
 * Runner（Phase 3）通过 registerRunStreamProvider 注入事件流来源。
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as repo from "../repo.js";
import { submitRunInput, currentInputId, isAwaiting } from "../runner/pending-inputs.js";

/** SSE 事件流提供者（Phase 3 Runner 注册）：订阅 runId 事件，push 到 reply.raw。 */
export type RunStreamProvider = (
  runId: string,
  push: (event: string, data: unknown) => void,
  onClose: () => void,
) => () => void; // 返回 unsubscribe

let _streamProvider: RunStreamProvider | null = null;

export function registerRunStreamProvider(fn: RunStreamProvider): void {
  _streamProvider = fn;
}

export async function runRoutes(app: FastifyInstance): Promise<void> {
  // Run 状态
  app.get("/api/runs/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const run = repo.getRun((req.params as { id: string }).id);
    if (!run) return reply.code(404).send({ error: "not_found" });
    return run;
  });

  // SSE 事件流
  app.get("/api/runs/:id/stream", { preHandler: app.authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const runId = (req.params as { id: string }).id;
    const run = repo.getRun(runId);
    if (!run) return reply.code(404).send({ error: "not_found" });

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // 发一个 hello 让连接确认
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ runId })}\n\n`);

    const push = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const onClose = () => {
      try {
        reply.raw.end();
      } catch {
        /* already closed */
      }
    };

    // 心跳（防代理超时）
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`:keepalive ${Date.now()}\n\n`);
      } catch {
        /* closed */
      }
    }, 15000);

    let unsubscribe: (() => void) | null = null;
    if (_streamProvider) {
      unsubscribe = _streamProvider(runId, push, onClose);
    } else {
      // Phase 3 前：直接把当前 run 状态推一次后关闭
      push("run_state", run);
      onClose();
    }

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe?.();
    });

    return reply; // 保持连接
  });

  // 中止运行
  app.post("/api/runs/:id/abort", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const run = repo.getRun(id);
    if (!run) return reply.code(404).send({ error: "not_found" });
    if (_abortHandler) _abortHandler(id);
    repo.updateRun(id, { status: "interrupted", endedAt: new Date().toISOString() });
    return { ok: true };
  });

  // 回复 Agent 的澄清请求（暂停/恢复会话：把用户回复送回阻塞中的 ask 工具）
  app.post("/api/runs/:id/input", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const run = repo.getRun(id);
    if (!run) return reply.code(404).send({ error: "not_found" });
    const body = (req.body ?? {}) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "empty_input" });

    if (!isAwaiting(id)) return reply.code(409).send({ error: "not_awaiting_input" });
    const inputId = currentInputId(id);
    if (!inputId) return reply.code(409).send({ error: "not_awaiting_input" });

    const delivered = submitRunInput(id, inputId, text);
    if (!delivered) return reply.code(409).send({ error: "input_mismatch" });

    // 恢复运行态。用户回复经 ask 工具的 execute 返回为 ToolResult content，
    // Pi SessionManager 会在 message_end 时自动 appendMessage 到 .jsonl（无需旁路写 DB）。
    repo.updateRun(id, { status: "running" });
    return { ok: true };
  });

  // 本轮采集的来源条目（证据面板展开用）
  app.get("/api/runs/:id/items", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const run = repo.getRun(id);
    if (!run) return reply.code(404).send({ error: "not_found" });
    return { items: repo.listRunItems(id) };
  });
}

let _abortHandler: ((runId: string) => void) | null = null;
export function setAbortHandler(fn: (runId: string) => void): void {
  _abortHandler = fn;
}
