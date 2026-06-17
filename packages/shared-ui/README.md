# @ai-insight/shared-ui

编辑风设计系统（验收 A6 / D5 / 15-UIUX设计.md）。

## 样式

| 文件 | 作用 | 适用 |
|---|---|---|
| `styles/fonts.css` | Fraunces / Inter Tight / JetBrains Mono | 两端 |
| `styles/tokens.css` | `:root`（用户端）+ `[data-theme="admin"]`（管理端反相） | 两端 |
| `styles/editorial.css` | 印刷质感工具类（stamp/drop-cap/marker/heat-bar/marquee…） | 用户端 |
| `styles/admin.css` | 深色控制台覆写（去噪点/状态点/卡片） | 管理端 |

```ts
// apps/user/src/main.ts
import '@ai-insight/shared-ui/styles/fonts.css';
import '@ai-insight/shared-ui/styles/tokens.css';
import '@ai-insight/shared-ui/styles/editorial.css';

// apps/admin/src/main.ts（多叠 admin.css，并在 <html data-theme="admin">）
import '@ai-insight/shared-ui/styles/fonts.css';
import '@ai-insight/shared-ui/styles/tokens.css';
import '@ai-insight/shared-ui/styles/editorial.css';
import '@ai-insight/shared-ui/styles/admin.css';
```

## Tailwind

```ts
// tailwind.config.ts
import preset from '@ai-insight/shared-ui/tailwind-preset';
export default { presets: [preset], content: [...] };
```

随后可用 `bg-paper text-ink text-vermillion font-serif` 等；因 token 是 CSS 变量，
`[data-theme="admin"]` 切换即可整体反相。

## 组件

- `<HeatBar :heat="0-100" />` —— 10 格热度条
- `<StampBadge label="TOP STORY" />` —— 印章标签
- `<EmptyState title="…" hint="…" />` —— 空状态

页面级组件（AppHeader/ArticleCard/AdminShell 等）按 Phase 3（用户端）/ 1-4（管理端）交付。
