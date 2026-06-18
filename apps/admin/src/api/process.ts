import { apiClient } from './client';

export async function triggerProcess() {
  return apiClient.post('/admin/process/run');
}

export async function getProcessStatus() {
  return apiClient.get('/admin/process/status');
}

export async function rerunArticle(articleId: number) {
  return apiClient.post(`/admin/process/rerun/${articleId}`);
}
