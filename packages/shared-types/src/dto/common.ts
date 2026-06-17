/**
 * 通用 DTO：分页、API 响应包装。
 */
import { z } from 'zod';

/** 分页查询参数。 */
export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

/** 分页响应。 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 统一失败响应体。 */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
