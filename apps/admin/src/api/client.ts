/**
 * axios 客户端 + Bearer 拦截器（管理端复用，同用户端逻辑）。
 * 见 doc/design-doc/08-前端架构.md §8.4。
 */
import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'ai-insight:admin-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const baseURL = import.meta.env.VITE_API_BASE ?? '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
});

apiClient.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      clearToken();
      window.location.assign('/');
    }
    if (status === 403) {
      // 非 ADMIN 访问 admin：提示无权限（见 08-前端架构 §8.4）
      console.warn('[admin] 403: 该账号无管理员权限');
    }
    return Promise.reject(err);
  },
);
