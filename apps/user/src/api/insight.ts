import { apiClient } from './client';

export async function createInsightSession(data: {
  intent: string;
  skillSet?: string[];
  budget?: { maxSteps?: number; maxToolCalls?: number; maxTokens?: number };
}) {
  return apiClient.post('/insight/sessions', data, {
    responseType: 'stream',
    adapter: 'fetch', // 用于 SSE
  });
}

export async function getInsightSession(id: number) {
  return apiClient.get(`/insight/sessions/${id}`);
}

export async function listMySessions(params: { page?: number; status?: string }) {
  return apiClient.get('/insight/sessions', { params });
}
