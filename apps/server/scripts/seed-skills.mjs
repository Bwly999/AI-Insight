/**
 * 灌入 skill 种子数据。
 * 从 src/insight/skills/*.md 解析 YAML frontmatter + body，写入 skill_revisions。
 *
 * 用法：cd apps/server && node scripts/seed-skills.mjs
 */
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://root:aiinsight@localhost:3306/ai_insight';
const SKILLS_DIR = path.resolve(import.meta.dirname, '../src/insight/skills');

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`无法解析 frontmatter: ${filePath}`);
  return { frontmatter: match[1], body: match[2].trim() };
}

function parseYaml(yamlStr) {
  const result = {};
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith('[') && value.endsWith(']')) {
      try { value = JSON.parse(value.replace(/'/g, '"')); } catch { value = value; }
    }
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    result[key] = value;
  }
  return result;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(SKILLS_DIR, file);
    const { frontmatter: yamlStr, body } = parseMarkdown(filePath);
    const meta = parseYaml(yamlStr);

    const name = meta.name || file.replace('.md', '');
    const version = meta.version || '1.0.0';
    const frontmatter = JSON.stringify(meta);

    // 检查是否存在
    const [existing] = await conn.execute(
      'SELECT id FROM skill_revisions WHERE name = ? AND version = ?',
      [name, version],
    );

    if (existing[0]) {
      await conn.execute(
        'UPDATE skill_revisions SET body_md=?, frontmatter=?, enabled=true, audit_note=? WHERE name=? AND version=?',
        [body, frontmatter, `更新 ${version}`, name, version],
      );
      console.log(`UPDATE  ${name}@${version}`);
    } else {
      await conn.execute(
        'INSERT INTO skill_revisions (name, version, frontmatter, body_md, author_id, enabled, audit_note) VALUES (?, ?, ?, ?, 1, true, ?)',
        [name, version, frontmatter, body, `初始导入 ${version}`],
      );
      console.log(`INSERT  ${name}@${version}`);
    }
  }

  await conn.end();
  console.log(`\n✅ 完成：${files.length} 个 skill 已同步`);
}

main().catch((err) => {
  console.error('❌ skill 种子灌入失败', err);
  process.exit(1);
});
