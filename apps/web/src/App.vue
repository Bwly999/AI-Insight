<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "./composables/useAuth.js";

const { login, token } = useAuth();

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
