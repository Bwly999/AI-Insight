import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import * as repo from "../src/repo.js";
import type { ConversationConfig, DataSourceItem } from "@ai-insight/shared-types";

let userId: string;
beforeAll(() => {
  ({ userId } = setupTestDb());
});

const CFG: ConversationConfig = {
  timeRange: "1w",
  tagPrefs: ["tech"],
  lens: "deep",
};

describe("conversations 软删", () => {
  it("软删后不在 list/get 中出现；二次软删返回 false", () => {
    const c = repo.createConversation(userId, "软删测试", CFG);
    expect(repo.getConversation(c.id)?.id).toBe(c.id);
    expect(repo.listConversations(userId).some((x) => x.id === c.id)).toBe(true);

    expect(repo.softDeleteConversation(c.id)).toBe(true);
    expect(repo.getConversation(c.id)).toBeUndefined();
    expect(repo.listConversations(userId).some((x) => x.id === c.id)).toBe(false);

    // 已软删的行不再命中（where deleted_at IS NULL）
    expect(repo.softDeleteConversation(c.id)).toBe(false);
  });

  it("软删不阻断同用户其它会话", () => {
    const a = repo.createConversation(userId, "a", CFG);
    const b = repo.createConversation(userId, "b", CFG);
    repo.softDeleteConversation(a.id);
    const list = repo.listConversations(userId);
    expect(list.some((x) => x.id === a.id)).toBe(false);
    expect(list.some((x) => x.id === b.id)).toBe(true);
  });
});

describe("runs + run_items", () => {
  it("run 生命周期 + tokens 写入 + collectedItems 持久化", () => {
    const conv = repo.createConversation(userId, "run 测试", CFG);
    const msg = repo.addMessage(conv.id, "user", { kind: "text", text: "hi" });
    const run = repo.createRun(conv.id, msg.id, "hi", CFG, "deep");
    expect(repo.getRun(run.id)?.status).toBe("queued");
    expect(repo.getLastRun(conv.id)?.id).toBe(run.id);

    repo.updateRun(run.id, { status: "running", startedAt: new Date().toISOString() });
    expect(repo.getRun(run.id)?.status).toBe("running");

    repo.updateRun(run.id, {
      status: "completed",
      endedAt: new Date().toISOString(),
      tokens: 1234,
    });
    const done = repo.getRun(run.id);
    expect(done?.status).toBe("completed");
    expect(done?.tokens).toBe(1234);

    const item: DataSourceItem = {
      id: "search:Mock:1",
      sourceType: "search",
      sourceName: "Mock",
      sourceId: "1",
      title: "信号 A",
      url: "https://example.com/a",
      summary: "摘要",
      publishedAt: new Date().toISOString(),
      tags: [],
      fetchedAt: new Date().toISOString(),
    };
    repo.recordRunItems(run.id, [{ item, toolName: "search" }]);
    const recorded = repo.listRunItems(run.id);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].toolName).toBe("search");
    expect(recorded[0].title).toBe("信号 A");
    expect(recorded[0].runId).toBe(run.id);
  });
});

describe("schedules CRUD", () => {
  it("create → list → patch(enabled) → delete", () => {
    const s = repo.createSchedule(userId, {
      prompt: "每日 AI 动态",
      config: CFG,
      cron: "0 9 * * *",
      lens: "deep",
    });
    expect(s.cron).toBe("0 9 * * *");
    expect(repo.listSchedules(userId).some((x) => x.id === s.id)).toBe(true);

    const patched = repo.patchSchedule(s.id, { enabled: false });
    expect(patched?.enabled).toBe(false);

    repo.deleteSchedule(s.id);
    expect(repo.listSchedules(userId).some((x) => x.id === s.id)).toBe(false);
  });
});

describe("reconcileInterruptedRuns", () => {
  it("把 running 标记为 interrupted", () => {
    const conv = repo.createConversation(userId, "reconcile 测试", CFG);
    const msg = repo.addMessage(conv.id, "user", { kind: "text", text: "x" });
    const run = repo.createRun(conv.id, msg.id, "x", CFG, "deep");
    repo.updateRun(run.id, { status: "running", startedAt: new Date().toISOString() });

    const n = repo.reconcileInterruptedRuns();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(repo.getRun(run.id)?.status).toBe("interrupted");
  });
});

describe("data_source_items FTS", () => {
  const mkItem = (n: number, title: string): DataSourceItem => ({
    id: `rss:Feed:url${n}`,
    sourceType: "rss",
    sourceName: "Feed",
    sourceId: `url${n}`,
    title,
    url: `https://example.com/${n}`,
    summary: "summary",
    publishedAt: new Date().toISOString(),
    tags: ["tech"],
    fetchedAt: new Date().toISOString(),
  });

  it("upsert → FTS 关键词命中 → delete 后不命中（触发器同步）", () => {
    const items = [
      mkItem(1, "AI coding tools weekly roundup"),
      mkItem(2, "Unrelated weather report"),
    ];
    expect(repo.upsertDataSourceItems(items)).toBe(2);

    // 关键词命中
    const hits = repo.searchDataSourceItemsFts({ keywords: ["coding"] });
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toContain("coding");

    // 多关键词 OR
    const or = repo.searchDataSourceItemsFts({ keywords: ["coding", "weather"] });
    expect(or).toHaveLength(2);

    // 无关键词 → []（交调用方回退）
    expect(repo.searchDataSourceItemsFts({ keywords: [] })).toEqual([]);

    // upsert 更新标题后，旧关键词不再命中、新关键词命中（UPDATE 触发器）
    repo.upsertDataSourceItems([{ ...items[0], title: "renamed to finance" }]);
    expect(repo.searchDataSourceItemsFts({ keywords: ["coding"] })).toEqual([]);
    expect(repo.searchDataSourceItemsFts({ keywords: ["finance"] })).toHaveLength(1);

    // delete 后 FTS 不命中（DELETE 触发器）
    const deleted = repo.deleteStaleItems(0);
    expect(deleted).toBeGreaterThanOrEqual(2);
    expect(repo.searchDataSourceItemsFts({ keywords: ["finance"] })).toEqual([]);
  });
});
