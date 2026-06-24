/**
 * 定时洞察路由 — CRUD（MVP：触发逻辑最小，留接口）。
 */
import type { FastifyInstance } from "fastify";
import type { ConversationConfig } from "@ai-insight/shared-types";
import * as repo from "../repo.js";

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/schedules", { preHandler: app.authenticate }, async (req) => {
    return { items: repo.listSchedules(req.user?.userId) };
  });

  app.post("/api/schedules", { preHandler: app.authenticate }, async (req, reply) => {
    const body = (req.body ?? {}) as {
      prompt: string;
      config?: ConversationConfig;
      cron: string;
      lens?: ConversationConfig["lens"];
    };
    if (!body.prompt || !body.cron) {
      return reply.code(400).send({ error: "prompt_and_cron_required" });
    }
    const sch = repo.createSchedule(req.user!.userId, {
      prompt: body.prompt,
      config: body.config ?? { timeRange: "1w", tagPrefs: ["tech"], lens: "deep" },
      cron: body.cron,
      lens: body.lens,
    });
    return reply.code(201).send(sch);
  });

  app.patch("/api/schedules/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { enabled?: boolean; cron?: string; prompt?: string };
    const sch = repo.patchSchedule(id, body);
    if (!sch) return reply.code(404).send({ error: "not_found" });
    return sch;
  });

  app.delete("/api/schedules/:id", { preHandler: app.authenticate }, async (req, reply) => {
    repo.deleteSchedule((req.params as { id: string }).id);
    return reply.code(204).send();
  });
}
