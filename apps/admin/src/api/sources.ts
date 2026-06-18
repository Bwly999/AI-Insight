import { apiClient } from './client';

export interface Source {
  id: number;
  code: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  lastCollectStatus?: string | null;
  lastCollectAt?: string | null;
}

export interface SourceForm {
  code: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export async function listSources(params: { page?: number; pageSize?: number; type?: string; enabled?: string }) {
  return apiClient.get('/admin/sources', { params });
}

export async function getSource(id: number) {
  return apiClient.get(`/admin/sources/${id}`);
}

export async function createSource(data: SourceForm) {
  return apiClient.post('/admin/sources', data);
}

export async function updateSource(id: number, data: Partial<SourceForm>) {
  return apiClient.put(`/admin/sources/${id}`, data);
}

export async function deleteSource(id: number) {
  return apiClient.delete(`/admin/sources/${id}`);
}

export async function testSource(id: number) {
  return apiClient.post(`/admin/sources/${id}/test`);
}

export async function runCollect(sourceId?: number) {
  return apiClient.post('/admin/collect/run', { sourceId });
}

export async function listCollectLogs(params: { page?: number; pageSize?: number; sourceId?: number; status?: string }) {
  return apiClient.get('/admin/collect/logs', { params });
}
