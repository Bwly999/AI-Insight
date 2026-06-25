import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";

/**
 * ProdTokenVerifier（jose HS256）—— 先设 env 再动态 import，使 config 加载时读到
 * （dotenv 不覆盖已设的 process.env）。
 */
describe("ProdTokenVerifier (jose HS256)", () => {
  let verify: (t: string) => Promise<{ userId: string; role: string } | null>;
  const SECRET = "test-secret-xxx";

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    process.env.JWT_ISSUER = "ai-insight";
    const auth = await import("../src/auth.js");
    const v = new auth.ProdTokenVerifier();
    verify = (t) => v.verify(t) as Promise<{ userId: string; role: string } | null>;
  });

  const sign = (
    payload: Record<string, unknown>,
    opts: { issuer?: string; secret?: string; sub?: string } = {},
  ) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(opts.sub ?? "u1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .setIssuer(opts.issuer ?? "ai-insight")
      .sign(new TextEncoder().encode(opts.secret ?? SECRET));

  it("接受合法 HS256 JWT（sub+role=admin）", async () => {
    const p = await verify(await sign({ role: "admin" }));
    expect(p).toEqual({ userId: "u1", role: "admin" });
  });

  it("无 role 默认 user", async () => {
    const p = await verify(await sign({}));
    expect(p).toEqual({ userId: "u1", role: "user" });
  });

  it("拒绝篡改的 JWT（签名破坏）", async () => {
    const token = await sign({ role: "admin" });
    const tampered = token.slice(0, -3) + "xxx";
    expect(await verify(tampered)).toBeNull();
  });

  it("拒绝用错 secret 签的 JWT", async () => {
    const token = await sign({ role: "admin" }, { secret: "wrong-secret" });
    expect(await verify(token)).toBeNull();
  });

  it("拒绝 issuer 不符的 JWT", async () => {
    const token = await sign({ role: "admin" }, { issuer: "other-issuer" });
    expect(await verify(token)).toBeNull();
  });

  it("拒绝非 JWT / 空串", async () => {
    expect(await verify("")).toBeNull();
    expect(await verify("not.a.jwt")).toBeNull();
  });
});
