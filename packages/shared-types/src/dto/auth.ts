/**
 * 鉴权相关 DTO。
 * 见 doc/design-doc/07-核心流程.md（鉴权链）。
 *
 * 平台无登录接口：token 由外部登录服务签发。
 * 后端 preHandler 解包 JWT 取 { id, name }，再查库定 role。
 */
import { z } from 'zod';
import type { UserRole } from '../enums.js';

/** 平台从 JWT 解包后识别出的用户身份（request.user）。 */
export interface AuthUser {
  /** 数据库 users.id */
  id: number;
  /** JWT 中的 id（externalId） */
  externalId: string;
  name: string;
  role: UserRole;
}

/** GET /auth/me 响应。 */
export interface AuthMeResponse {
  id: number;
  externalId: string;
  name: string;
  role: UserRole;
}

/**
 * 平台期望从 JWT payload 中读取的最小声明。
 * 具体字段路径（如 sub/name/自定义）留白，由 auth.ts 适配映射，
 * 见 doc/design-doc/14-留白与后续确认.md。
 */
export const JwtClaimsShape = z.object({
  id: z.string().optional(),
  sub: z.string().optional(),
  name: z.string().optional(),
  username: z.string().optional(),
});
export type JwtClaimsShape = z.infer<typeof JwtClaimsShape>;
