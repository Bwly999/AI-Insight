/**
 * 订阅 DTO —— 用户端订阅设置。
 * 见 doc/design-doc/06-数据模型.md (subscriptions)。
 *
 * 订阅 = 领域 + 关键词 + 挂载的 schedule + 通道偏好。
 * 裁剪命中规则：categoryCodes ∪ keywords 命中 Article。
 */
import { z } from 'zod';

export const UpsertSubscriptionBody = z.object({
  scheduleId: z.number().int().positive(),
  categoryCodes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});
export type UpsertSubscriptionBody = z.infer<typeof UpsertSubscriptionBody>;

export interface SubscriptionView {
  id: number;
  userId: number;
  scheduleId: number;
  categoryCodes: string[];
  keywords: string[];
  channels: string[];
  active: boolean;
  updatedAt: string;
}
