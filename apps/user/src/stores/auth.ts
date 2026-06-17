import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AuthMeResponse } from '@ai-insight/shared-types';
import { apiClient, getToken, setToken, clearToken } from '../api/client';

/**
 * 当前用户状态。
 * 见 doc/design-doc/08-前端架构.md §8.4（认证与请求）。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthMeResponse | null>(null);
  const loading = ref(false);

  async function fetchMe(): Promise<void> {
    if (!getToken()) {
      user.value = null;
      return;
    }
    loading.value = true;
    try {
      const { data } = await apiClient.get<AuthMeResponse>('/auth/me');
      user.value = data;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  /** 开发辅助：写入一个手工构造的 token（对接外部登录前的占位）。 */
  function loginWithDevToken(token: string) {
    setToken(token);
    void fetchMe();
  }

  function logout() {
    clearToken();
    user.value = null;
  }

  return { user, loading, fetchMe, loginWithDevToken, logout };
});
