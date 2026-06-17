<script setup lang="ts">
import { useRoute } from 'vue-router';
import { EmptyState } from '@ai-insight/shared-ui';

const route = useRoute();
</script>

<template>
  <div class="mx-auto py-20" style="max-width: var(--max-width); padding: 0 var(--gutter)">
    <header class="double-rule pb-4">
      <h1 class="font-black text-ink" style="font-family: var(--font-serif); font-size: clamp(2rem, 5vw, 3rem)">
        {{ (route.meta.title as string) ?? '页面' }}
      </h1>
    </header>
    <EmptyState
      title="— 本页将在后续阶段印刷 —"
      :hint="`路由 ${String(route.name ?? route.path)} · 对应 Phase 见 doc/design-doc/12-分阶段路线图.md`"
    />
  </div>
</template>
