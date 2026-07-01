/**
 * 引擎命名空间 flag 解析（约定 b：--<engine>.<param>）。
 *
 * 见 docs/design §5.2。从引擎的 paramsSchema（TypeBox）反射出参数，
 * 收集 `--arxiv.categories` 形式的 flag，转成 params 对象注入引擎。
 *
 * `--<engine>.<param>` 仅当 engine 在启用列表中才合法（静态校验）。
 */
import type { TSchema } from "@sinclair/typebox";
import { parseListArg } from "./args.js";

/**
 * 从 argv 中解析命名空间 flag `--<engine>.<param>=value` 或 `--<engine>.<param> value`。
 *
 * @param argv 原始 argv（不含 node/bin）
 * @param enabledEngineIds 已启用引擎 id 集合（用于校验）
 * @param schemaByEngine 各引擎的 paramsSchema（用于参数名反射）
 * @returns { engineParams: Record<engineId, Record<param, value>>, rest: 剩余 argv }
 */
export function parseEngineFlags(
  argv: string[],
  enabledEngineIds: Set<string>,
  schemaByEngine: Record<string, TSchema | undefined>,
): {
  engineParams: Record<string, Record<string, unknown>>;
  rest: string[];
  /** 解析过程中遇到的错误（如未知引擎命名空间）；不抛异常，交由命令决定 exit code。 */
  errors: string[];
} {
  const engineParams: Record<string, Record<string, unknown>> = {};
  const rest: string[] = [];
  const errors: string[] = [];
  const nsRe = /^--([a-z0-9_-]+)\.([a-z0-9_-]+)=(.*)$/i;
  const nsReSpace = /^--([a-z0-9_-]+)\.([a-z0-9_-]+)$/i;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // --engine.param=value
    const m1 = arg && nsRe.exec(arg);
    if (m1) {
      const [, engineId, param, value] = m1;
      collectParam(engineParams, engineId, param, parseValue(value), enabledEngineIds, schemaByEngine, errors);
      continue;
    }

    // --engine.param value（空格分隔）
    const m2 = arg && nsReSpace.exec(arg);
    if (m2) {
      const [, engineId, param] = m2;
      const next = argv[i + 1];
      // 下一个 token 当作值：存在且不是 flag（--xxx 或 -x，但允许负数 -5）
      if (next !== undefined && !isFlagToken(next)) {
        collectParam(engineParams, engineId, param, parseValue(next), enabledEngineIds, schemaByEngine, errors);
        i++; // 消费 value
        continue;
      }
    }

    // 非命名空间 flag，原样保留（交由主解析器处理）
    if (arg) rest.push(arg);
  }

  return { engineParams, rest, errors };
}

/** 把单值写入对应引擎的 params；同时做引擎/参数合法性校验。错误推入 errors（不抛）。 */
function collectParam(
  out: Record<string, Record<string, unknown>>,
  engineId: string,
  param: string,
  value: unknown,
  enabledEngineIds: Set<string>,
  schemaByEngine: Record<string, TSchema | undefined>,
  errors: string[],
): void {
  if (!enabledEngineIds.has(engineId)) {
    errors.push(`未知或未启用的引擎命名空间: --${engineId}.${param}（引擎 ${engineId} 不在 --engines 中）`);
    return;
  }
  const schema = schemaByEngine[engineId];
  const knownParams = schema && isObjectSchema(schema) ? Object.keys(schema.properties) : [];
  // 无 schema 或 schema 已声明该参数 → 接受；schema 存在但参数未声明 → 警告但接受（宽松）
  if (knownParams.length > 0 && !knownParams.includes(param)) {
    console.warn(`[warn] 引擎 ${engineId} 无参数 ${param}（已知: ${knownParams.join(", ")}）`);
  }

  // 数组型参数（schema 声明为数组）→ 用 parseListArg 拆分（逗号或空格）。
  // 标量型参数（如 --exa.type=neural）保持原值不拆。
  const paramSchema = schema && isObjectSchema(schema) ? schema.properties[param] : undefined;
  if (typeof value === "string" && isArrayParam(paramSchema)) {
    value = parseListArg(value);
  }

  if (!out[engineId]) out[engineId] = {};
  out[engineId][param] = value;
}

/** 值类型推断：true/false → boolean；纯数字 → number；其余字符串。 */
function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

/**
 * 判断 token 是否为 flag（--xxx 或 -x）。
 * 负数（-5, -3.14）不算 flag（是值）。
 */
function isFlagToken(token: string): boolean {
  if (!token.startsWith("-")) return false;
  // -- 开头一定是 flag
  if (token.startsWith("--")) return true;
  // 单 - 开头：若后面是非数字字符则是 flag（如 -h, -e），否则是负数值（如 -5）
  return !/^-\d/.test(token);
}

/** TypeBox 对象 schema 判定（运行时检查 .properties 字段）。 */
function isObjectSchema(s: TSchema | undefined | null): s is TSchema & { properties: Record<string, TSchema> } {
  return !!s && typeof s === "object" && "properties" in s;
}

/**
 * 判断 TypeBox 参数 schema 是否为数组型（Type.Array 或其 Optional 包装）。
 * 用于决定是否对 flag 值做逗号/空格拆分。
 */
function isArrayParam(s: TSchema | undefined): boolean {
  if (!s) return false;
  const type = (s as { type?: string }).type;
  if (type === "array") return true;
  // Optional(Type.Array(...)) 包装：检查 anyOf 中是否有 array
  const anyOf = (s as { anyOf?: TSchema[] }).anyOf;
  if (Array.isArray(anyOf)) {
    return anyOf.some((m) => (m as { type?: string }).type === "array");
  }
  return false;
}

/**
 * 从 TypeBox paramsSchema 反射出参数名列表（用于帮助文本生成）。
 */
export function describeParams(schema: TSchema | undefined): { name: string; description?: string }[] {
  if (!schema || !isObjectSchema(schema)) return [];
  return Object.entries(schema.properties).map(([name, sub]) => ({
    name,
    description: (sub as { description?: string }).description,
  }));
}
