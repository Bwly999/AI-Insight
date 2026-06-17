/**
 * db 插件：decorate('db', drizzle client)。
 * 见 doc/design-doc/04-后端架构.md §4.2、06-数据模型.md §6.4。
 */
import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../db/schema.js';
import { config } from '../config.js';

export default fp(
  async (app) => {
    // 单例连接池（应用生命周期内复用）。
    // schema 中所有时间戳已显式给默认值，故运行期不依赖 session 级
    // explicit_defaults_for_timestamp 设置（迁移阶段由 apply 脚本统一处理）。
    const pool = mysql.createPool({
      uri: config.databaseUrl,
      connectionLimit: 10,
      multipleStatements: false,
      timezone: 'Z',
    });

    const db = drizzle(pool, { schema, mode: 'default' });

    app.decorate('db', db);

    app.addHook('onClose', async () => {
      await pool.end();
      app.log.info('mysql pool closed');
    });

    app.log.info('db plugin ready (drizzle + mysql2)');
  },
  { name: 'db' },
);
