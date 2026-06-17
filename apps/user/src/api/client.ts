/**
 * axios 客户端 + Bearer 拦截器。
 * 见 doc/design-doc/08-前端架构.md §8.4。
 *
 * - 登录代码使用方实现：token 由外部登录服务签发。
 * - 本平台从约定的存储位置（localStorage）取 token 注入 Authorization。
 * - 401 → 清 token 并重定向登录（此处仅占位：throw 让上层处理）。
 */
import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'ai-insight:token';

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

// 请求拦截器：注入 Authorization: Bearer <token>
apiClient.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// 响应拦截器：401 → 清 token（登录由使用方实现，这里仅发信号）
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
      // 留白：使用方登录实现就位后，这里跳转到其登录入口
      // window.location.assign('/login')
    }
    return Promise.reject(err);
  },
);
