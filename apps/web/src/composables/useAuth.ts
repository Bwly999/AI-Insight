/**
 * useAuth — dev 登录态（token 存 localStorage）。
 */
import { ref } from "vue";
import { devLogin, localStorageTokenProvider } from "@ai-insight/api-client";

const token = ref<string | null>(localStorageTokenProvider.getToken());
const user = ref<{ id: string; name: string } | null>(null);

export function useAuth() {
  async function login(role: "user" | "admin" = "user") {
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
