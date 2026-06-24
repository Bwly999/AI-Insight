# 单进程 Fastify + 同进程跑 Agent + node-cron + SSE（无独立 worker、无 Redis）

后端用一个 **Fastify 进程**同时承载 API、Agent 洞察运行、node-cron 调度（RSS 轮询 + 定时洞察）。Agent 任务**同进程内执行**（agent loop 是异步 I/O，不阻塞事件循环）；运行事件通过**内存 EventEmitter（按 runId）**经 SSE 透传前端。**不引入独立 worker 进程，不引入 Redis / BullMQ。**

内网单实例部署下，agent loop 异步 I/O 不会阻塞，多实例横向扩展前不值得引入 worker + Redis 的运维成本。代价：进程重启会中断运行中的 Run——以 DB 持久化 run 状态、启动时把 `running` 标记为 `interrupted` 兜底，定时任务下次自然重跑。
