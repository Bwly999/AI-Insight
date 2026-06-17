import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AuthMeResponse } from '@ai-insight/shared-types';
import { apiClient, getToken, setToken, clearToken } from '../api/client';

/**
 * 管理端当前用户状态 + 管理员守卫信号。
 * 见 doc/design-doc/08-前端架构.md §8.4。
 */
export const useAuthStore = defineStore('admin-auth', () => {
  const user = ref<AuthMeResponse | null>(null);
  const loading = ref(false);
  const forbidden = ref(false); // 403：访问 admin 但非 ADMIN

  async function fetchMe(): Promise<AuthMeResponse | null> {
    if (!getToken()) {
      user.value = null;
      return null;
    }
    loading.value = true;
    try {
      const { data } = await apiClient.get<AuthMeResponse>('/auth/me');
      user.value = data;
      forbidden.value = data.role !== 'ADMIN';
      return data;
    } catch {
      user.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function loginWithDevToken(token: string) {
    setToken(token);
    return fetchMe();
  }

  function logout() {
    clearToken();
    user.value = null;
  }

  return { user, loading, forbidden, fetchMe, loginWithDevToken, logout };
});
