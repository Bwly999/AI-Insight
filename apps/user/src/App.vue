<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
onMounted(() => {
  void auth.fetchMe();
});
</script>

<template>
  <div class="paper-bg min-h-screen">
    <RouterView />
  </div>
</template>
