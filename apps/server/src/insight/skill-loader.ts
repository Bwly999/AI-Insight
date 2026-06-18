/**
 * skill-loader —— 从 DB 加载启用的 skill。
 * 见 dev-spec 1B.4，验收 G1。
 */
import { eq, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { skillRevisions } from '../db/schema';
import type { SkillFrontmatter } from './types';

export interface LoadedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
}

/** 加载单个 enabled skill */
export async function loadEnabledSkill(
  app: FastifyInstance,
  name: string,
): Promise<LoadedSkill | null> {
  const [row] = await app.db
    .select()
    .from(skillRevisions)
    .where(and(eq(skillRevisions.name, name), eq(skillRevisions.enabled, true)))
    .limit(1);

  if (!row) return null;
  return {
    frontmatter: row.frontmatter as unknown as SkillFrontmatter,
    body: row.bodyMd,
  };
}

/** 批量加载 skills */
export async function loadSkills(
  app: FastifyInstance,
  names: string[],
): Promise<LoadedSkill[]> {
  const results: LoadedSkill[] = [];
  for (const name of names) {
    const skill = await loadEnabledSkill(app, name);
    if (skill) results.push(skill);
  }
  return results;
}
