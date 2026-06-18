import { apiClient } from './client';

export interface CronConfig {
  collect: { expression: string; nextRuns: string[] };
  process: { expression: string; nextRuns: string[] };
}

export async function getCron() {
  return apiClient.get('/admin/cron');
}

export async function updateCron(data: { collect?: string; process?: string }) {
  return apiClient.put('/admin/cron', data);
}
