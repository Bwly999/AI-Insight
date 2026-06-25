/**
 * useAuth — admin dev 登录态（token 存 localStorage；与 web 共享 key）。
 * 注意：localStorage 按 origin 隔离，admin (5174) 与 web (5173) 各自独立。
 */
import { ref } from "vue";
import { devLogin, localStorageTokenProvider } from "@ai-insight/api-client";

const token = ref<string | null>(localStorageTokenProvider.getToken());
const user = ref<{ id: string; name: string } | null>(null);

export function useAuth() {
  async function login(role: "user" | "admin" = "admin") {
    const r = await devLogin(role);
    token.value = r.token;
    user.value = { id: r.user.id, name: r.user.name };
    return r;
  }
  function logout() {
    localStorageTokenProvider.setToken(null);
    token.value = null;
    user.value = null;
  }
  return { token, user, login, logout };
}
