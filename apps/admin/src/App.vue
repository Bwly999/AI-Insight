<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "./composables/useAuth.js";
import { initTheme } from "./composables/useTheme";

const { login, token } = useAuth();

initTheme();

onMounted(async () => {
  // dev：无 token 时自动以 admin 角色 dev-login
  if (!token.value) {
    try {
      await login("admin");
    } catch (e) {
      console.error("admin dev-login failed", e);
    }
  }
});
</script>

<template>
  <router-view />
</template>
