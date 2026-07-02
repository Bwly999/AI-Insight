# scripts/

`aiinsight.cjs` —— `@ai-insight/cli`（`packages/cli`）的自包含 bundle 产物，由 esbuild 打包。

本 skill 依赖它来采集数据（见 `references/datasources.md` 的「ZCode / Bash-only 环境」一节）。

## 这是什么

把 `packages/cli`（入口 `src/bin.ts`）连同其全部依赖——workspace 包 `@ai-insight/datasources` / `@ai-insight/shared-types`，以及外部依赖 needle / cheerio / undici / fast-xml-parser / @sinclair/typebox / firecrawl（→ axios + zod ...）——**内联成单个 CommonJS 文件**，只保留 `node:*` 内置模块为 external。

结果：**只需 Node ≥20 即可运行，零 `node_modules`、零安装**。拷走整个 skill 目录即可用。

## 运行

```bash
# 路径相对本 skill 根目录
node scripts/aiinsight.cjs search "AI" --engines ddg,exa --time 1w
node scripts/aiinsight.cjs extract https://example.com/article
node scripts/aiinsight.cjs config list
node scripts/aiinsight.cjs --help
```

详见 `references/datasources.md`。

## 何时重建

改了下列任一源码后，需重新生成此 bundle：

- `packages/cli/src/**`
- `packages/datasources/src/**`
- `packages/shared-types/src/**`

## 重建方法

```bash
# 从仓库根
pnpm build:skill
# 或
pnpm --filter @ai-insight/cli bundle
```

构建脚本：`packages/cli/scripts/bundle.mjs`（esbuild）。

> **注意**：本 bundle **提交进 git**（不 gitignore），目的是让 skill 目录真正自包含——任何人 clone / 拷贝即可用，无需先 build。改源码后记得重新生成并提交更新后的 `aiinsight.cjs`。

## bundle 大小

约 4 MB（主要是 firecrawl SDK → axios / zod 树，以及 cheerio）。可接受：换取零安装的发布体验。

## 不要手改

`aiinsight.cjs` 是生成物。要改 CLI 行为请改 `packages/cli/src` 后重建。
