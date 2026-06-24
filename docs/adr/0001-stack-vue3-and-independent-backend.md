# 技术栈：Vue3 前端 + 独立 TypeScript 后端

`产品原型需求.md` 原指定「TypeScript + Next.js 全栈 + TailwindCSS v4」。决定改为 **Vue3 前端（用户端 / 管理端两个 SPA）+ 独立 TypeScript 后端（Fastify）**，前后端分离；TailwindCSS v4 保留。

后端需承载分钟级 Agent 长任务 + 定时调度 + RSS 后台轮询，与 Next.js 无状态请求/响应模型冲突；独立常驻后端天然适配。前端选 Vue3 出于团队/生态偏好。此决定偏离需求文档，故记录。
