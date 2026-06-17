/**
 * 报告 DTO（含 Article 池）—— 用户端 + 管理端共用。
 * 见 doc/design-doc/06-数据模型.md (reports/report_items/articles)。
 */
import { z } from 'zod';
import type { ReportStatus, ReportSection } from '../enums.js';

/** Article 池条目（AI 处理产物）。 */
export interface ArticleView {
  id: number;
  rawItemId: number | null;
  categoryCode: string | null;
  summary: string;
  heat: number;
  tags: string[] | null;
  critical: boolean;
  trendComment: string | null;
  processedAt: string;
}

/** 报告头条结构（该用户命中的最高 heat，critical 优先）。 */
export interface ReportHeadline {
  articleId: number;
  title: string;
  summary: string;
  categoryCode: string | null;
  heat: number;
  critical: boolean;
}

/** 报告组装条目（个性化裁剪后）。 */
export interface ReportBodyItem {
  articleId: number;
  title: string;
  summary: string;
  categoryCode: string | null;
  heat: number;
  critical: boolean;
  sourceLabel?: string | null;
  publishedAt?: string | null;
  section: ReportSection;
  sortOrder: number;
  /** 该条目的个性化点评（深度报告） */
  editorNote?: string | null;
}

/** 领域点评 / 趋势片段（深度报告）。 */
export interface ReportTrendSection {
  categoryCode: string;
  comment: string;
}

/** 报告完整视图。 */
export interface ReportView {
  id: number;
  issueNo: string;
  userId: number;
  scheduleId: number;
  periodStart: string;
  periodEnd: string;
  headlineJson: ReportHeadline | null;
  bodyJson: {
    items: ReportBodyItem[];
    trends: ReportTrendSection[];
    /** 统计卡用：By the Numbers */
    stats?: { label: string; value: string | number }[];
  };
  status: ReportStatus;
  createdAt: string;
  sentAt: string | null;
}

/** 往期报告列表项（精简）。 */
export interface ReportArchiveItem {
  id: number;
  issueNo: string;
  periodStart: string;
  periodEnd: string;
  headlineTitle: string | null;
  itemCount: number;
  status: ReportStatus;
}

/** 管理端事后纠错 Article。 */
export const UpdateArticleBody = z.object({
  summary: z.string().min(1).optional(),
  heat: z.number().int().min(0).max(100).optional(),
  critical: z.boolean().optional(),
  trendComment: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type UpdateArticleBody = z.infer<typeof UpdateArticleBody>;
