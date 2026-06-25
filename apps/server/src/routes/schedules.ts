/**
 * 定时洞察路由 — CRUD + cron 校验 + nextRunAt 计算 + 通知调度器。
 *
 * 触发逻辑在 jobs/scheduler.ts（node-cron）；此处 CRUD 后 notifyScheduleChange() 重载任务。
 */
import type { FastifyInstance } from "fastify";
import type { ConversationConfig } from "@ai-insight/shared-types";
import * as repo from "../repo.js";
import { nextFireIso, validateCron, notifyScheduleChange } from "../jobs/scheduler.js";

const DEFAULT_SCHEDULE_CONFIG: ConversationConfig = {
  timeRange: "1w",
  tagPrefs: ["tech"],
  lens: "deep",
};

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
    if (!validateCron(body.cron)) {
      return reply.code(400).send({ error: "invalid_cron" });
    }
    const sch = repo.createSchedule(req.user!.userId, {
      prompt: body.prompt,
      config: body.config ?? DEFAULT_SCHEDULE_CONFIG,
      cron: body.cron,
      lens: body.lens,
      nextRunAt: nextFireIso(body.cron),
    });
    notifyScheduleChange();
    return reply.code(201).send(sch);
  });

  app.patch("/api/schedules/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { enabled?: boolean; cron?: string; prompt?: string };
    if (body.cron != null && !validateCron(body.cron)) {
      return reply.code(400).send({ error: "invalid_cron" });
    }
    const patch: { enabled?: boolean; cron?: string; prompt?: string; nextRunAt?: string } = {
      ...body,
    };
    if (body.cron != null) patch.nextRunAt = nextFireIso(body.cron);
    const sch = repo.patchSchedule(id, patch);
    if (!sch) return reply.code(404).send({ error: "not_found" });
    notifyScheduleChange();
    return sch;
  });

  app.delete("/api/schedules/:id", { preHandler: app.authenticate }, async (req, reply) => {
    repo.deleteSchedule((req.params as { id: string }).id);
    notifyScheduleChange();
    return reply.code(204).send();
  });
}
