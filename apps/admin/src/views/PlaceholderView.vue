<script setup lang="ts">
import { useRoute } from 'vue-router';
import { EmptyState } from '@ai-insight/shared-ui';

const route = useRoute();
</script>

<template>
  <div class="admin-card p-8">
    <EmptyState
      :title="`— ${(route.meta.title as string) ?? '页面'} 待开发 —`"
      :hint="`路由 ${String(route.name ?? route.path)} · 对应 Phase 见 doc/design-doc/12-分阶段路线图.md`"
    />
  </div>
</template>
