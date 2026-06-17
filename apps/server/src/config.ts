/**
 * 配置加载：从环境变量读取（敏感项一律 env，源码/schema 无明文）。
 * 见 doc/design-doc/09-基础设施与部署.md §9.4、10-安全与可靠性.md。
 */
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    // 留白项允许缺失，但显式标注（见 14-留白与后续确认.md）
    throw new Error(`[config] 缺少必需环境变量: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  jwt: {
    /** 留白：使用方填。未配置时 auth 允许进入开发降级模式（见 auth.ts）。 */
    secret: string;
    issuer?: string;
    audience?: string;
  };
}

function load(): AppConfig {
  const port = Number(optional('PORT', '3000'));
  return {
    nodeEnv: optional('NODE_ENV', 'development'),
    port,
    databaseUrl: required('DATABASE_URL', 'mysql://root:aiinsight@localhost:3306/ai_insight'),
    redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
    llm: {
      // 留白：内网 LLM 地址/key/模型名（见 14-留白）
      baseUrl: optional('LLM_BASE_URL', 'http://internal-llm/v1'),
      apiKey: optional('LLM_API_KEY', 'internal'),
      model: optional('LLM_MODEL', 'internal-model-name'),
    },
    jwt: {
      secret: optional('JWT_SECRET', ''),
      issuer: optional('JWT_ISSUER') || undefined,
      audience: optional('JWT_AUDIENCE') || undefined,
    },
  };
}

export const config = load();
