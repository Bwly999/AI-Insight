import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createInsightSession } from "../src/session-factory.js";
import type { AgentProviderConfig } from "../src/session-factory.js";

/**
 * session 创建不发 LLM 请求（仅注册 provider + 组装 prompt/工具），
 * 故 provider 用假 key 即可；断言聚焦 systemPrompt 内容与 read 沙箱行为。
 */
const FAKE_PROVIDER: AgentProviderConfig = {
  providerName: "deepseek",
  baseUrl: "http://localhost:0/v1",
  apiKey: "fake-test-key",
  model: "deepseek-test",
};

/** 仓库根下的真实 ai-insight skill 目录。 */
const SKILL_DIR = resolve(__dirname, "../../../.agents/skills/ai-insight");

describe("createInsightSession — skill 接入", () => {
  it("传 skillDir 后：system prompt 含 ai-insight skill 元数据", async () => {
    const session = await createInsightSession(FAKE_PROVIDER, [], {
      skillDir: SKILL_DIR,
    });
    const prompt = session.agent.state.systemPrompt ?? "";

    // skill 元数据经 formatSkillsForPrompt 以 XML 注入，必含 name + description 片段
    expect(prompt).toMatch(/ai-insight/);
    expect(prompt).toMatch(/行业洞察/);
  });

  it("传 skillDir 后：全局 skill 不泄漏进 prompt", async () => {
    const session = await createInsightSession(FAKE_PROVIDER, [], {
      skillDir: SKILL_DIR,
    });
    const prompt = session.agent.state.systemPrompt ?? "";

    // noSkills:true + additionalSkillPaths → 仅 ai-insight；开发机全局 skill 不该出现
    for (const leaked of [
      "vue-best-practices",
      "playwright-cli",
      "find-docs",
      "skill-creator",
    ]) {
      expect(prompt).not.toContain(leaked);
    }
  });

  it("传 skillDir 后：read 工具已注册且沙箱拦截越界路径", async () => {
    const session = await createInsightSession(FAKE_PROVIDER, [], {
      skillDir: SKILL_DIR,
    });
    const tools = session.agent.state.tools;
    const readTool = tools.find((t) => t.name === "read");
    expect(readTool, "read 工具应作为 customTool 注入").toBeDefined();

    // 越界绝对路径：被沙箱拒
    const outside = resolve(SKILL_DIR, "../../../package.json");
    await expect(
      (readTool as { execute: (...a: unknown[]) => Promise<unknown> }).execute(
        "call-outside",
        { path: outside },
        undefined,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/Permission denied|沙箱/);

    // 越界相对路径（../ 逃逸）：被沙箱拒
    await expect(
      (readTool as { execute: (...a: unknown[]) => Promise<unknown> }).execute(
        "call-escape",
        { path: "../../package.json" },
        undefined,
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/Permission denied|沙箱/);

    // skill 内合法文件：可读
    const res = await (readTool as {
      execute: (...a: unknown[]) => Promise<{ content: { text: string }[] }>;
    }).execute(
      "call-inside",
      { path: "references/deep-insight.md" },
      undefined,
      undefined,
      undefined,
    );
    expect(res.content[0].text).toContain("deep");
  });

  it("不传 skillDir：退化为旧行为（无 read、无 skill 元数据）", async () => {
    const session = await createInsightSession(FAKE_PROVIDER, []);
    const tools = session.agent.state.tools;
    expect(tools.find((t) => t.name === "read")).toBeUndefined();
    // 仍含角色人设，但不含 skill XML 块
    expect(session.agent.state.systemPrompt ?? "").toMatch(/情报分析师/);
  });
});
