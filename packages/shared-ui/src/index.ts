/**
 * @ai-insight/shared-ui —— 编辑风设计系统入口。
 * 见 doc/design-doc/15-UIUX设计.md。
 *
 * 样式入口（CSS）：
 *   import '@ai-insight/shared-ui/styles/fonts.css'
 *   import '@ai-insight/shared-ui/styles/tokens.css'
 *   import '@ai-insight/shared-ui/styles/editorial.css'   // 用户端
 *   import '@ai-insight/shared-ui/styles/admin.css'       // 管理端（叠加）
 *
 * 组件按需导入（Phase 0 仅提供原子组件，页面级组件 Phase 3/1-4 补）。
 */
export { default as HeatBar } from './components/HeatBar.vue';
export { default as StampBadge } from './components/StampBadge.vue';
export { default as EmptyState } from './components/EmptyState.vue';
