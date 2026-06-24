# 数据源全部用 TypeScript 实现，不包装 Python union-search-skill

参考项目 `union-search-skill`（Python）含 DuckDuckGo / Exa / Firecrawl 等 30+ 平台；但需求中搜索仅需这 3 个引擎，且 `newsnow`（爬虫）已是 TypeScript。

`packages/datasources` 全 TypeScript：**搜索**（Exa / Firecrawl 官方 JS SDK + DuckDuckGo 用 cheerio）、**RSS**（fast-xml-parser，后台轮询建索引）、**爬虫**（移植 newsnow 的 TS 适配器）。`union-search-skill` 与 `Signex` 仅借设计/模式，**代码不跑**。

纯 TS = 单运行时 / 单部署、原生 agent 工具（无 subprocess 开销）、代理统一在 `undici ProxyAgent` 出口处理。仅需 3 引擎，重写成本远低于运维 Python sidecar。放弃 30+ 平台广度；若未来需要，以可插拔 `DataSource` 接口加 Python-backed adapter 即可，不必现在上 sidecar。
