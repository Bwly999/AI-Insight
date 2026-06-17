/**
 * 数据源（采集层）DTO —— 管理端 CRUD。
 * 见 doc/design-doc/06-数据模型.md (sources)、04-后端架构.md (admin/sources)。
 *
 * 注意：config 中的敏感 key（api key 等）加密存储，传输/展示时脱敏。
 */
import { z } from 'zod';
import { SourceType } from '../enums.js';

export const SourceTypeValues = z.enum([
  'RSS',
  'SEARCH_API',
  'SEARCH_CRAWL',
  'WEB_SCRAPER',
]);

export const CreateSourceBody = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  type: SourceTypeValues,
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});
export type CreateSourceBody = z.infer<typeof CreateSourceBody>;

export const UpdateSourceBody = CreateSourceBody.partial();
export type UpdateSourceBody = z.infer<typeof UpdateSourceBody>;

export interface SourceView {
  id: number;
  code: string;
  name: string;
  type: SourceType;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

/** 数据源列表查询（含最近采集状态摘要）。 */
export interface SourceListItem extends SourceView {
  lastCollectStatus?: string | null;
  lastCollectAt?: string | null;
}
