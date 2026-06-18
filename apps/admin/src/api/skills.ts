import { apiClient } from './client';

export async function listSkills() {
  return apiClient.get('/admin/skills');
}

export async function createSkill(data: { name: string; version: string; frontmatter: Record<string, unknown>; bodyMd: string; auditNote: string }) {
  return apiClient.post('/admin/skills', data);
}

export async function enableSkill(name: string, version: string) {
  return apiClient.post(`/admin/skills/${name}/enable`, { version });
}

export async function disableSkill(name: string) {
  return apiClient.post(`/admin/skills/${name}/disable`);
}
