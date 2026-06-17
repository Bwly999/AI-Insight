/**
 * 反馈 / 收藏 DTO —— 用户端。
 * 见 doc/design-doc/06-数据模型.md (feedback)。
 */
import { z } from 'zod';
import type { FeedbackType } from '../enums.js';

export const CreateFeedbackBody = z.object({
  articleId: z.number().int().positive(),
  type: z.enum(['USEFUL', 'USELESS', 'COLLECT']),
  note: z.string().max(1000).optional(),
});
export type CreateFeedbackBody = z.infer<typeof CreateFeedbackBody>;

/** 反馈列表中附带的文章精简信息。 */
export interface FeedbackArticleLite {
  id: number;
  summary: string;
  categoryCode: string | null;
}

export interface FeedbackView {
  id: number;
  userId: number;
  articleId: number;
  type: FeedbackType;
  note: string | null;
  createdAt: string;
  article?: FeedbackArticleLite;
}
