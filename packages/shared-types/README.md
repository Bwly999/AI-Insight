# @ai-insight/shared-types

前后端共享的类型层（验收 F1：单一事实来源）。

```
src/
├── index.ts          # 总导出
├── enums.ts          # 枚举/字面量（与 MySQL 枚举列一致）
├── spi/              # ICollector / INotificationChannel 契约
│   ├── collector.ts
│   ├── notifier.ts
│   └── index.ts
└── dto/              # 请求/响应 DTO（含 zod 运行时校验）
    ├── auth.ts        # AuthUser / GET /auth/me
    ├── source.ts      # 数据源 CRUD
    ├── category.ts    # 领域定义
    ├── schedule.ts    # ReportSchedule
    ├── subscription.ts# 订阅设置
    ├── report.ts      # 报告 / Article 池
    ├── feedback.ts    # 反馈 / 收藏
    ├── system.ts      # 代理 / cron / 通道 / 用户 / 日志 / 仪表盘
    └── index.ts
```

## 使用

```ts
// 后端 / 前端均可
import { ICollector, CreateSourceBody, SourceType } from '@ai-insight/shared-types';
import { SPI } from '@ai-insight/shared-types';
```
