<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "./composables/useAuth.js";
import { initTheme } from "./composables/useTheme";

const { login, token } = useAuth();

// 主题同步（与 index.html 预绘制脚本保持一致）
initTheme();

onMounted(async () => {
  // dev：无 token 时自动 dev-login
  if (!token.value) {
    try {
      await login();
    } catch (e) {
      console.error("dev-login failed", e);
    }
  }
});
</script>

<template>
  <router-view />
</template>
