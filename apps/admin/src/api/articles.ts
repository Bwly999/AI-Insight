import { apiClient } from './client';

export async function listArticles(params: { page?: number; pageSize?: number; category?: string }) {
  return apiClient.get('/admin/articles', { params });
}

export async function updateArticle(id: number, data: { summary?: string; heat?: number; critical?: boolean; tags?: string[]; trendComment?: string }) {
  return apiClient.put(`/admin/articles/${id}`, data);
}
