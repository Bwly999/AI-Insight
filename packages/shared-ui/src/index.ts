/**
 * @ai-insight/shared-ui — Vue 设计系统（web+admin 共用，含 EditorialReport）。
 *
 * 注意：
 *  - renderReportStandalone（SSR，纯渲染函数，无 .vue 依赖）→ server 运行时用。
 *  - EditorialReport.vue（SFC）→ 用户端客户端渲染用（需 vue 插件解析）。
 */
export {
  renderReportStandalone,
  type RenderReportInput,
} from "./editorial-ssr.js";
export {
  editorialColors,
  editorialRootVars,
  editorialComponentCss,
  editorialFontLink,
} from "./tokens.js";
// EditorialReport.vue 仅在客户端（vite + vue 插件）使用，按需具名导入，不放 barrel
