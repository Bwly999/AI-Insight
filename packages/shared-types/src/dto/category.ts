/**
 * 领域定义 DTO —— 管理端 CRUD。
 * 领域由管理端定义（对应原型 ai/bio/quant/climate/soc），用户订阅时勾选。
 */
import { z } from 'zod';

export const CreateCategoryBody = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  color: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/).default('#1a1612'),
  sortOrder: z.number().int().default(0),
  enabled: z.boolean().default(true),
});
export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;

export const UpdateCategoryBody = CreateCategoryBody.partial();
export type UpdateCategoryBody = z.infer<typeof UpdateCategoryBody>;

export interface CategoryView {
  id: number;
  code: string;
  label: string;
  color: string;
  sortOrder: number;
  enabled: boolean;
}
