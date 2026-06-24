# 持久化用 SQLite（better-sqlite3 + WAL + FTS5）+ Drizzle

单进程内网部署；需存储会话 / 消息 / 运行 / 报告 / 数据源 / RSS 索引 / 定时 / 设置；其中 `fetch_rss` 需按关键词 + 时间范围检索 RSS 条目。

采用 **SQLite**（`better-sqlite3`，开启 WAL；`data_source_items` 用 **FTS5** 全文索引供 RSS 关键词检索）+ **Drizzle ORM**（schema-as-code、类型安全）。

单文件零运维，与单进程拓扑一致；FTS5 内置全文检索正好满足 RSS 查询；`newsnow` / `Signex` 均用 SQLite。放弃 Postgres / MySQL 的并发与托管优势——单实例几十并发 SQLite（WAL 多读单写、写为 ms 级短事务）足够；Drizzle 使日后换库成本低。
