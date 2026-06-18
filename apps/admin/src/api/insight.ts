import { apiClient } from './client';

export async function listSessions(params: { page?: number; pageSize?: number; userId?: number; status?: string }) {
  return apiClient.get('/admin/insight/sessions', { params });
}

export async function getSessionTrace(id: number) {
  return apiClient.get(`/admin/insight/sessions/${id}/trace`);
}
