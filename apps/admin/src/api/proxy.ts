import { apiClient } from './client';

export interface ProxyConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  auth?: { scheme: string; token?: string };
}

export async function getProxy() {
  return apiClient.get('/admin/proxy');
}

export async function updateProxy(data: ProxyConfig) {
  return apiClient.put('/admin/proxy', data);
}

export async function testProxy() {
  return apiClient.post('/admin/proxy/test');
}
