/**
 * 轻量 markdown → HTML（无依赖）。
 *
 * 实现已统一进 @ai-insight/shared-ui（report-markdown.ts），为 server standalone HTML
 * 与 web 客户端预览的单一渲染来源，保证下载 HTML 与系统内实时一致。
 * 本文件保留为薄 re-export，供 web 侧既有 import（MessageBlocks / ReportModal 等）不改。
 */
export { mdToHtml, mdInline } from "@ai-insight/shared-ui";
