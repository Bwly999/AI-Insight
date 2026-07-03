---
target: apps/web/src/views/ConversationView.vue
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-07-03T04-07-22Z
slug: apps-web-src-views-conversationview-vue
---
# Critique · ConversationView（洞察工作台主界面）

**Target**: `apps/web/src/views/ConversationView.vue` · register: product
**Method**: dual-agent (A: 设计评审 · B: 检测器 + 浏览器)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 工具级状态丰富（status-pill、elapsed mono、ping、每工具 ok/fail/running、ctx conic ring）；缺多源运行的整体进度，`completed→idle` 无终态确认。 |
| 2 | Match System / Real World | 3 | 中英文混排对分析师合适；但 eyebrow "Deep Lens · 工作台" 是内部黑话，研究员不知道它选了什么。 |
| 3 | User Control and Freedom | 2 | Esc 关 modal、awaiting_input 可恢复；但误发无撤销、运行中无法单工具取消只能整轮 abort、abort 仅在 topbar 无就近出口。 |
| 4 | Consistency and Standards | 3 | 组件词汇统一；但"accent 左边线"在不同组件用了 1px/2px/3px 不同宽度（检测器独立命中多处 side-tab）。 |
| 5 | Error Prevention | 2 | 空草稿禁用发送、time-range 约束有效；但 **Abort 无确认**（长时运行的重操作），导航无草稿恢复，`getConversation` 失败仅 console.error。 |
| 6 | Recognition Rather Than Recall | 3 | 列表/证据面板/内联报告卡都可见，`[n]→①` 内联；扣分：`分析中/已完成` tag 是按选中态推断的，非真实 run 状态——失败/陈旧会误导。 |
| 7 | Flexibility and Efficiency | 2 | 占位符宣传 `⌘K/⌘↵/⌘J`，但 **`⌘K` 在 Composer 未接线**（只处理了 Enter）；无命令面板、列表无键盘导航、报告无批量下载、无 `?` 快捷键发现。 |
| 8 | Aesthetic and Minimalist Design | 3 | 整体干净、tonal layering 承载深度；conv-head `.meta` 三段 11.5px `text-3` 在噪声底线边缘；`r-note` 解释性文字应隐式化。 |
| 9 | Error Recovery | 2 | load/refresh/send 全部 `console.error` 吞掉；`getReport` 失败静默降级为无引用报告；无内联错误 UI、无重试、无 failed 卡。 |
| 10 | Help and Documentation | 1 | 无帮助入口、无 `?` overlay、ClarifyCard 是唯一教学点；对一个"可追溯"为卖点的工具，引用机制不可发现。 |
| **Total** | | **24/40** | **Acceptable（视觉/反 slop 扎实，缺口在交互/状态/帮助轴）** |

## Anti-Patterns Verdict

**LLM 评审**：通过 product-register 测试——一个熟悉 Linear/Notion/Raycast 的研究员坐下会信任这些控件，不会在某个"微妙地不对"的组件上停顿。没有发光、渐变文字、玻璃拟态、奶油底、hero-metric 网格、UI 标签里的装饰 display 字体。双声调（Inter/Mono 工作台 vs Fraunces+朱砂 editorial 报告）是刻意的、读起来像被设计过而非被拼装。**真正的弱点是 slop 的反面：在好几处界面对其"更锐利、更有主张"的方向太怯懦**——conv-head 层级被洗掉（24px h1、lede 用 text-3）、空态 glyph 在 opacity 0.5、多个 active 态只靠边框变色而不主动建立层级。

**确定性扫描**：检测器成功解析了 `.vue` SFC（不只 index.html）。共 **14 处**：`side-tab` ×7、`overused-font` ×6、`bounce-easing` ×1。CLI 命中与 LLM 评审**独立收敛**：A 在启发式 4 标记的"accent 左边线宽度不一致（1/2/3px）"，B 的检测器正好把 ClarifyCard、EvidencePanel、MessageBlocks、ReportModal、blockquote 的左边线全部报了出来。

**高置信误报（已剔除）**：
- ReportModal 全部 5 处 `overused-font`（Fraunces）+ 1 处 `side-tab`（朱砂 blockquote）——刻意的 editorial 报告，每条都带 `unslop-ignore` 注释；检测器不读 CSS 注释里的 ignore 标记。
- MessageBlocks `.think`/`.tool` 的 2px 左边线——是**状态指示器**（base 用 border-2，状态类覆盖为 RSS/amber/green/rose），等价于状态徽章，不是装饰条。
- `style.css` blockquote 左线——排版通则。
- `bounce-easing`（`--ease-spring`）——token 定义了但**全仓库零引用**，是死 CSS。
- index.html 的 `single-font`——检测器只看到 `<link>` 预加载的 Inter，没看 CSS 里的 Fraunces/Mono。

**留存的真问题**：ClarifyCard 琥珀 2px 左线、EvidencePanel `text-4` 2px 左线（这两条偏装饰性 side-stripe，值得复看）；`tiny-text` 11.5px（运行时实测命中，与 A 标记的 conv-head meta 噪声底线吻合）；死 token `--ease-spring` 应删除。

**可视化**：检测器 overlay 已注入 [Human] 标签页（dev server 在 5176 起来，空工作台 shell 渲染成功；后端未起，所以只实测到空态的 tiny-text + bounce-easing，组件级 side-tab/overused-font 靠 CLI 验证）。

## Overall Impression

视觉系统克制、自信、反 slop 到位——这是一份被认真设计过的产品。但它**把克制推到了怯懦的边缘**：在"研究员的工作台"该最有主张的地方（会话头部、引用标记、空态、失败态）反而退缩。配合"更锐利"的战略方向，最大的机会是**把已经存在的强骨架更响亮地说出来**——同时补上交互/状态/帮助轴的硬缺口（静默失败、abort 无确认、快捷键未接线），这些是视觉克制补不回来的。

## What's Working

1. **双声调分离是"被设计"而非"被拼装"**——工作台（Inter/Mono + 翠玉 + 雾中性）与报告（Fraunces 900 + 朱砂 + 暖纸）绝不互渗，`var(--frau)` 严格 scoped 到 ReportCard/ReportModal，ReportCard 用 600 预览、modal 升级到 900+drop-cap。
2. **引用可追溯是结构性的**——`[n]→①` 转换、`data-cites` 驱动 cite-popup、EvidencePanel 编号来源列表，构成真实审计链，正是"show the work"。
3. **`prefers-reduced-motion` 完整落实**——全局 reset、View Transitions 圆形展开、reveal/fade-up 全部降级，罕见且正确。

## Priority Issues

- **[P0] 运行生命周期的静默失败吞掉** — Why: `loadConversation`/`refreshMessages`/`sendMessage`/`listRunItems`/`getReport` 全部 `console.error` 吞掉；`run_completed` 后 `refreshMessages` 失败正是"第二次发送清空第一次回应"已记 bug 的根因，而用户什么也看不到。对一个卖点就是"可信、可交付"的产品，不可见失败是存亡级。— Fix: RunStream 加内联 failed 卡（错误文案 + 重试，重新触发 refresh/send）；conv-head 用 banner 显示 `getConversation` 错误；ReportModal 的 `getReport` 降级改成内联"部分引用不可用"提示而非静默丢引用。— Suggested: `$impeccable harden`

- **[P1] Abort 无确认、无粒度** — Why: 一轮爬了几十页的多源洞察又慢又贵，topbar 一次误点 `中止`（或 composer 停止图标）就不可逆地毁掉它；这个破坏性控件是挨着主题切换的普通 ghost-btn。— Fix: 首次 abort 加轻量内联确认（"中止将丢弃本轮已收集的 N 条来源" + 继续/中止）；MessageBlocks 内加单工具取消，让失控的 crawl 可被单独 kill 而不毁整轮。— Suggested: `$impeccable harden`

- **[P1] conv-head 层级对"更锐利"方向太怯懦** — Why: 这是整屏的锚——回答"我在看什么"——却读起来像脚注：24px h1、lede 用 `text-3`(#71717A, ~4.6:1)、meta 11.5px `text-3`、eyebrow "Deep Lens · 工作台" 11px 600。DESIGN.md 的工作台 display token 是 28px/700，这里低于它；lede 颜色违反"克制≠不可读"。— Fix: h1 提到 28px/700、letter-spacing -0.015em；lede 改 `text-2`(#3F3F46)；把含糊的"Deep Lens"eyebrow 换成会话首条用户消息（截断），让头部回答"我问了什么"。— Suggested: `$impeccable bolder`

- **[P2] 引用 ↔ EvidencePanel 是断掉的记忆桥** — Why: 报告里点 `①` 开 popup（标题+摘要），但右栏对应来源**不高亮**——研究员得在 20+ 来源卡里肉眼重新定位，违背"验证只需一次点击"。— Fix: cite-popup 打开时把 cite 编号上抛 ConversationView→EvidencePanel，匹配来源加 `.source.cited`（accent 左线 + scrollIntoView + 短暂 ring 脉冲）。— Suggested: `$impeccable shape`

- **[P2] 空/加载态读起来怯懦而非自信** — Why: 空态 `hero-glyph` opacity 0.5、EvidencePanel 空 `Inbox` glyph 也 0.5、`.list-empty` 只剩"暂无会话"零引导——低估了仪器级人设，且错失教学时机。— Fix: 去掉 opacity 雾化；空态给真实首动作（"描述一个你想验证的判断" + 2-3 个示例 prompt 作为 tchip 预填 composer）；EvidencePanel 空态解释契约（"运行完成后，这里按引用顺序列出所有来源"）。— Suggested: `$impeccable onboard`

## Persona Red Flags

**Alex（效率型用户）** —— 走主流程：打字 → ⌘↵ → 看运行 → ⌘-点引用验证 → 下载报告：
- 占位符宣传 `⌘K 聚焦 · ⌘↵ 发送`，但 **`⌘K` 在 Composer.vue 的 `onKey` 里没接线**（只处理了 Enter）——效率用户一按没反应，立刻丢信任。
- 会话列表无键盘导航（无 j/k、无方向键、无 `⌘N` 新建），"新对话"只能鼠标点。
- 报告无多选批量下载，每张 ReportCard 各点一次。
- 运行中 abort 要把鼠标移到 topbar，无 Esc 就近中止。
- cite-popup 内条目无键盘导航。

**Sam（无障碍依赖）** —— tab 穿越 + 屏幕阅读器 + 低视力：
- 空态 `<Sparkles>` glyph **无 `aria-hidden`、无 alt**，屏幕阅读器会朗读 SVG。
- `.scroll-bottom-btn` 有 `aria-label` ✓；但 **status-pill 靠颜色单独传达状态**（绿/红/琥珀底），圆点本身无文字标签。
- ReportCard 是 `role="button" tabindex="0"` + keydown ✓，但**内部下载 `<button>` 嵌在 role=button 里**——破坏无障碍树、部分阅读器双触发。
- `.tool-head`/`.think-head` 是 `<div @click>` 折叠，**无 `role="button"`/`tabindex`/`aria-expanded`**——键盘用户根本无法折叠思考/工具块。
- 对比度：`text-3`(#71717A) on 白 ≈4.6:1 过 AA 正文但 conv-head lede/meta 在 11.5–13.5px 属 AA 小字边缘；`text-4`(#A1A1AA) on 白 ≈2.6:1 **不过 AA**，却被用于 `.ci-tag.done`、`.kbd`、占位符、`.tr-chev`——其中几处承载真实信息。

**Lin / 研究员**（项目 persona，来自 PRODUCT.md——分析师，靠多源研究为生，需要可追溯引用）—— 走：就一个假设开洞察 → 看爬取跑 2-3 分钟 → 打开带引用报告 → 验证 3 条关键结论：
- **运行中不显示来源出处**——stream 显示工具卡（"search · N 条"），但要等完成才在 EvidencePanel 看到读了哪些域名；评估来源质量时是盲区。
- **cite-popup 只给标题+摘要，无引文锚定**——`[n]` 没锚到来源里具体哪一句，Lin 无法判断 3000 字来源里哪句话支撑了结论，只能新开 tab ctrl-F。这是相对"可追溯"承诺最大的缺口。
- **会话列表按 24h 时效分组**（进行中/历史）——Lin 按**主题/线索**思考，3 天前同一假设的洞察被埋进"历史"且无法串联或打标。
- **`分析中/已完成` tag 按选中态推断**——Lin 重开一个实际失败的"已完成"会话会被误导。
- **无 diff/版本视图**对比同一问题的旧报告与重跑——Lin 的核心工作就是"证据变了吗"，却没有这个入口。

## Minor Observations

- AppTopbar 的"导出"按钮（Download 图标）**未接线**——死控件，slop-adjacent。
- `.brand-logo` 的"A"（surface-3 盒）与 `.ai-ava` 的"A"、ReportCard 的 FileText——屏上三个不同的"A"轻微冗余。
- `Composer.vue` 的 `ctxPct` 是按草稿长度 mock 的（`length/4000`，运行中返回假 41）——研究员会发现进度环从不反映真实上下文；要么接线要么删掉。
- conv-head `.meta` 中段"视角 · lens"几乎从不显示（lens 由 Agent 自主路由），死槽位。
- EvidencePanel `.r-count` 硬编码"来自 3 类来源"——实际只用了 1-2 类时误导。
- `--ease-spring` token 定义了全仓库零引用——死 CSS，建议删（检测器因此报 bounce-easing）。
- ClarifyCard 琥珀 2px 左线、EvidencePanel `text-4` 2px 左线——两条偏装饰性 side-stripe（无状态语义），值得复看是否改为整边框或前导图标。
- `.scroll-bottom-btn:hover` 做 `translateY(-2px)` + 加大阴影——轻微"装饰性下沉"，与 DESIGN.md"send 无下沉"的精神不符，建议改纯色变化。

## Questions to Consider

1. **如果 conv-head 回答"我问了什么"而不是重述产品名？** 今天显示"新洞察 / 关于该主题… / N 轮 / 时间"，没一条是真实研究问题。把首条用户消息（截断、600 weight）顶上来，头部才配得上它的 22px padding，也给 Lin 回到 3 天前线索时一个锚。
2. **既然方向是"更锐利"，为什么 cite `①` 标记是 9px、surface-2 底？** 研究员的整个验证闭环都压在这个标记上——把它做到 11px、accent-text 色、1px accent-line 边，能把最弱 affordance 变成最强，正面主张"可追溯就是产品"。
3. **ReportCard 必须活在消息流里，还是可以 pin？** 现在完成的报告会随对话滚走；作为交付物，右栏一个常驻"当前报告"槽（报告存在时与 EvidencePanel 并存/替换）能让 Lin 把结论和证据永久并排。
4. **"自信"版的失败态长什么样？** 今天失败不可见。stream 里一张专用 failed 卡（rose 左线、中文错误、"重试/联系支持/查看部分结果"）能把最差的情绪谷变成"工具诚实"的展示——正是"自信·精准·可追溯"的品牌承诺。
