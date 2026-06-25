/**
 * 鉴权 SPI — TokenVerifier 接口 + DevTokenVerifier（dev 降级）。
 *
 * 设计 §3.7：Header Authorization: Bearer <token>。后端 verify(token) → { userId, role }。
 * prod：留给内网 JWT 校验实现。dev：DevTokenVerifier（不验签，任意 token 通过，
 * 或用共享 secret 签发/解析；这里 dev 模式直接放行并返回 dev-user）。
 */
import { jwtVerify } from "jose";
import { config, isDevAuthMode } from "./config.js";

export interface AuthPrincipal {
  userId: string;
  role: "user" | "admin";
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthPrincipal | null>;
}

/**
 * Dev 降级校验器：无 JWT_SECRET 时启用。
 * - 任意非空 token → dev-user（role=user）。
 * - 也接受 dev-login 签发的简单 token（见 signDevToken）。
 */
export class DevTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthPrincipal | null> {
    if (!token) return null;
    // dev-login 签发的 token 形如 "dev:<userId>:<role>"
    const devMatch = token.match(/^dev:([^:]+):([^:]+)$/);
    if (devMatch) {
      return { userId: devMatch[1], role: devMatch[2] as "user" | "admin" };
    }
    // 任意 token 默认 dev-user
    return { userId: "dev-user", role: "user" };
  }
}

/**
 * prod 校验器：配置 JWT_SECRET 时启用。jose HS256 真验签（iss/aud 可选校验）。
 * 失败返 null → 401。仅 HS256；RS256/JWKS 留待内网集成时扩展。
 */
export class ProdTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthPrincipal | null> {
    if (!token || !config.jwtSecret) return null;
    try {
      const secret = new TextEncoder().encode(config.jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        ...(config.jwtIssuer ? { issuer: config.jwtIssuer } : {}),
        ...(config.jwtAudience ? { audience: config.jwtAudience } : {}),
      });
      const p = payload as { sub?: string; role?: "user" | "admin" };
      if (!p.sub) return null;
      return { userId: p.sub, role: p.role ?? "user" };
    } catch {
      return null;
    }
  }
}

/** 根据配置选择校验器。 */
export function createTokenVerifier(): TokenVerifier {
  return isDevAuthMode() ? new DevTokenVerifier() : new ProdTokenVerifier();
}

/** dev-login 签发 token。 */
export function signDevToken(userId: string, role: "user" | "admin"): string {
  return `dev:${userId}:${role}`;
}
