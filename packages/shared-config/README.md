# @ai-insight/shared-config

Monorepo 共享配置预设。各包通过 `"extends"` 引用。

## 目录

- `tsconfig/base.json` —— 基础（strict + noUncheckedIndexedAccess）。
- `tsconfig/node.json` —— server（NodeNext）。
- `tsconfig/vue.json` —— user / admin（Vite + Vue + DOM lib）。

## 引用方式

```jsonc
// apps/server/tsconfig.json
{ "extends": "@ai-insight/shared-config/tsconfig/node.json" }

// apps/user/tsconfig.json
{ "extends": "@ai-insight/shared-config/tsconfig/vue.json" }
```
