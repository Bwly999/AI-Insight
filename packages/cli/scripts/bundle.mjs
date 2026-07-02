/**
 * 把 @ai-insight/cli 打成单个自包含 CommonJS bundle，
 * 输出到 .agents/skills/ai-insight/scripts/aiinsight.cjs，
 * 让 ai-insight skill 目录真正自包含（拷走即可跑，零 node_modules）。
 *
 * 内联范围：workspace 包（datasources / shared-types）+ 全部外部依赖
 *   （needle / cheerio / undici / fast-xml-parser / typebox / firecrawl → axios+zod...）
 * 只保留 node:* 内置模块为 external。
 *
 * 重建：pnpm --filter @ai-insight/cli bundle
 * 详见 .agents/skills/ai-insight/scripts/README.md
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPkgRoot = resolve(__dirname, "..");
const repoRoot = resolve(cliPkgRoot, "..", "..");
const outfile = resolve(repoRoot, ".agents", "skills", "ai-insight", "scripts", "aiinsight.cjs");

// esbuild 解析：优先用本包 node_modules（正常 pnpm install 后）；
// 回退到仓库根 .build-tools（开发期 pnpm install 受阻时的绕路，见 .gitignore）。
const require = createRequire(import.meta.url);
let build;
try {
  ({ build } = require("esbuild"));
} catch {
  ({ build } = require(resolve(repoRoot, ".build-tools", "node_modules", "esbuild")));
}

/** 把所有 node: 内置模块 + 旧式无前缀内置名都标为 external */
const nodeBuiltins = [
  "node:fs", "node:os", "node:path", "node:util", "node:url",
  "node:crypto", "node:http", "node:https", "node:net", "node:tls",
  "node:zlib", "node:stream", "node:buffer", "node:events", "node:child_process",
  // 兼容无 node: 前缀的写法（保险）
  "fs", "os", "path", "util", "url", "crypto", "http", "https", "net", "tls",
  "zlib", "stream", "buffer", "events", "child_process",
];

const result = await build({
  entryPoints: [resolve(cliPkgRoot, "src", "bin.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile,
  // bundle: true 即内联全部依赖；external 仅排除 node 内置模块
  external: nodeBuiltins,
  // 关键：不做任何 process.env 的 define 替换，保留运行时读取
  // （config-store.ts 读 AIINSIGHT_CONFIG；datasources/config.ts 的 env 兜底）
  define: {},
  sourcemap: false,
  // banner 留个标记，方便识别这是生成物
  banner: {
    js: [
      "/*!",
      " * aiinsight CLI — self-contained bundle",
      " * 生成自 packages/cli (esbuild)。请勿手改。",
      " * 重建：pnpm --filter @ai-insight/cli bundle",
      " */",
    ].join("\n"),
  },
  logLevel: "info",
});

if (result.errors.length > 0) {
  console.error("bundle 失败：", result.errors);
  process.exit(1);
}
console.log(`✓ bundle -> ${outfile}`);
