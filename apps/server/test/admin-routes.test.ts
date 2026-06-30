/**
 * Admin 路由 smoke：proxy/test + admin/datasources CRUD + settings proxySource 回显。
 * dev 模式（无 JWT_SECRET），authenticate 放行 dev-user；为升级 admin，
 * 直接注入 admin 角色的 principal（绕过 requireAdmin 的门禁）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../src/app.js";
import { adminRoutes } from "../src/routes/admin.js";
import { setupTestDb } from "./helpers.js";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  setupTestDb();
  // 不设 JWT_SECRET → dev 降级；再覆盖 authenticate 强制设 admin 角色
  app = await buildApp();
  app.authenticate = async (req: FastifyRequest, _reply: FastifyReply) => {
    req.user = { userId: "dev-user", role: "admin" };
  };
  await app.register(adminRoutes);
});

describe("admin proxy/test", () => {
  it("非法 URL → 400 invalid_proxy_url", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/proxy/test",
      payload: { proxy: "not-a-url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_proxy_url");
  });

  it("直连测试（无代理）返回结构化结果（在线则 ok，离线则带 error）", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/proxy/test",
      payload: { proxy: "" },
    });
    // 网络环境可能通/不通，只校验结构（离线时 ok=false 带 error）
    const body = res.json();
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("latencyMs");
    expect(body.testedProxy).toBe("(direct)");
    if (!body.ok) expect(body).toHaveProperty("error");
  }, 15000);
});

describe("admin settings proxySource", () => {
  it("GET settings 附 proxySource（初始 null）", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/settings" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("settings");
    expect(body.proxySource).toEqual({ value: "", source: null });
  });

  it("保存 proxy 后 proxySource.source=settings", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/settings",
      payload: { proxy: "http://127.0.0.1:7890" },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().proxySource.source).toBe("settings");

    const get = await app.inject({ method: "GET", url: "/api/admin/settings" });
    expect(get.json().proxySource).toEqual({ value: "http://127.0.0.1:7890", source: "settings" });
  });
});

describe("admin datasources CRUD", () => {
  it("列表/增/启停/删 RSS", async () => {
    const list0 = await app.inject({ method: "GET", url: "/api/admin/datasources" });
    expect(list0.statusCode).toBe(200);
    const before = list0.json().items.length;

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/datasources",
      payload: { name: "测试源", feedUrl: "https://example.com/feed.xml", tags: ["tech"] },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const list1 = await app.inject({ method: "GET", url: "/api/admin/datasources" });
    expect(list1.json().items.length).toBe(before + 1);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/admin/datasources/${id}`,
      payload: { enabled: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().enabled).toBe(false);

    const del = await app.inject({ method: "DELETE", url: `/api/admin/datasources/${id}` });
    expect(del.statusCode).toBe(204);

    // 删后查不到（PATCH 返回 404）
    const after = await app.inject({
      method: "PATCH",
      url: `/api/admin/datasources/${id}`,
      payload: { enabled: true },
    });
    expect(after.statusCode).toBe(404);
  });

  it("RSS 增缺 feedUrl → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/datasources",
      payload: { name: "无url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("feed_url_required");
  });
});
