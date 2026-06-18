/**
 * Skill DTO。
 * 见 dev-spec 1B.2，附录 A.16。
 */
import { z } from 'zod';

export const CreateSkillRevisionBody = z.object({
  name: z.string().min(1).max(64),
  version: z.string().min(1).max(16),
  frontmatter: z.record(z.unknown()),
  bodyMd: z.string().min(1),
  auditNote: z.string().min(1),
});
export type CreateSkillRevisionBody = z.infer<typeof CreateSkillRevisionBody>;

export interface SkillRevisionView {
  id: number;
  name: string;
  version: string;
  frontmatter: Record<string, unknown>;
  bodyMd: string;
  authorId: number;
  authorName: string;
  enabled: boolean;
  createdAt: string;
  auditNote: string;
}

/** Skill 的 YAML frontmatter 类型。 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  tools: string[];
  vaultWrite?: boolean;
  budget?: { maxSteps?: number; maxToolCalls?: number; maxTokens?: number };
  trigger?: { keywords?: string[] };
}
