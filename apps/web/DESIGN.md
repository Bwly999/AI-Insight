---
name: "AI-Insight · 洞察工作台"
description: "研究员的情报台 —— 柠绿信号工作台 + 朱砂 editorial 报告的双声调设计系统（浅/深双主题 · 仪器背景 + 信号发光）。"
colors:
  # ── Workbench · 浅色（canonical） ──
  lime: "#5B8C1A"
  lime-hover: "#3F6312"
  lime-soft: "rgba(91,140,26,.10)"
  lime-line: "rgba(91,140,26,.28)"
  lime-text: "#3F6312"
  mist-bg: "#FAFAFB"
  mist-surface: "#FFFFFF"
  mist-surface-2: "#F4F4F6"
  mist-surface-3: "#EFEFF2"
  graphite: "#18181B"
  graphite-2: "#3F3F46"
  graphite-3: "#71717A"
  graphite-4: "#A1A1AA"
  mist-border: "#E7E7EA"
  mist-border-2: "#DEDDE1"
  # ── Workbench · 深色覆盖（情报台原色） ──
  lime-dark: "#D4FF3F"
  lime-dark-hover: "#A8CC2A"
  lime-dark-soft: "rgba(212,255,63,.10)"
  lime-dark-line: "rgba(212,255,63,.30)"
  carbon-bg: "#0E0F13"
  carbon-surface: "#16171D"
  carbon-surface-2: "#1C1E25"
  carbon-text: "#E5E7EB"
  carbon-border: "#262830"
  # ── 状态信号（语义色） ──
  signal-green: "#16A34A"
  signal-amber: "#C4870E"
  signal-rose: "#DC2626"
  # ── 数据源信号（主题稳定） ──
  src-search: "#3B7EA1"
  src-rss: "#9B5DE5"
  src-crawl: "#C4870E"
  # ── Editorial 报告（固定浅色交付物） ──
  editorial-vermillion: "#c8341a"
  editorial-paper: "#ffffff"
  editorial-paper-2: "#ece5d6"
  editorial-ink: "#1a1612"
  editorial-ink-2: "#4a423a"
typography:
  body:
    fontFamily: "Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.6"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.14em"
    lineHeight: "1"
  mono:
    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "12.5px"
    fontFeature: "'zero', 'ss01'"
  display-workbench:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.01em"
    lineHeight: "1.3"
  editorial-display:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: "1.08"
    letterSpacing: "-0.015em"
  editorial-body:
    fontFamily: "'Inter Tight', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    lineHeight: "1.7"
rounded:
  xs: "5px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  pill: "999px"
spacing:
  "0": "0px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
  button-secondary:
    backgroundColor: "{colors.mist-surface}"
    textColor: "{colors.graphite-2}"
    rounded: "{rounded.sm}"
    height: "36px"
  button-ghost:
    backgroundColor: "{colors.mist-surface}"
    textColor: "{colors.graphite-2}"
    rounded: "{rounded.sm}"
    width: "32px"
    height: "32px"
  chip:
    backgroundColor: "{colors.mist-surface}"
    textColor: "{colors.graphite-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-selected:
    backgroundColor: "{colors.lime-soft}"
    textColor: "{colors.graphite}"
  conversation-card:
    rounded: "{rounded.md}"
    padding: "12px 14px"
  conversation-card-active:
    backgroundColor: "linear-gradient(160deg, {colors.lime-soft}, var(--bg-2))"
---

# Design System: AI-Insight · 洞察工作台

## 1. Overview

**Creative North Star: "研究员的情报台（The Intelligence Desk）"**

AI-Insight 是研究员的情报台。**表面是一件运转中的仪器**：柠绿（lime）信号强调的工作台，Inter + JetBrains Mono，mesh + grid 仪器背景，运行中状态以受控的信号发光（signal glow）标注——会话、流式推理、遥测条、证据面板、引用增长图、引用关系图谱都在这里发生。**仪器产出的，是一份出版物**：朱砂 + 白纸的 editorial 报告，Fraunces 衬线 + drop-cap + 双线报头，与可下载的 standalone HTML 同源同色。工具是主身份，报告是它的一等交付物。

这套系统**自信而有主张**：层级由字重、对比与密度承载，并在"携带信息的语义点"上用柠绿 glow 让"系统活着"的感觉可被感知。它信任用户的专业能力——研究员整天在读，所以可读性永远高于"优雅"。它**主动拒绝 2026 AI 默认审美**：不要奶油 / 沙 / 米色背景，不要装饰性玻璃拟态，不要装饰性发光（背景氛围 halo、卡片泛光），不要渐变文字，不要千篇一律的卡片网格，不要每个 section 上方的全大写 eyebrow。仓库以 `unslop-ignore` 标记每一处刻意决策（品牌 mark、editorial 衬线、drop-cap、朱砂报头、信号发光、仪器背景），这些是品牌声音，不是 AI 语法。

> 战略演进（V2 重设计，2026-07，来自 PRODUCT.md）：从 V1 的"克制锐利"进化到"自信张扬"。主强调色从翠玉绿迁移到**柠绿 lime**——更亮、更有信号穿透力；引入 **mesh + grid 仪器背景** 与 **信号点发光**，让运行中状态、数据节点、关系图谱"活"起来。柠绿的面积上限从 V1 的 ≤10% 放开到 ~15-20%（仍是强调，不是底色）；发光仍**仅限于信号/状态语义点**，装饰性发光是禁区。

**Key Characteristics:**
- **双声调（Two-Voice）**：柠绿工作台（sans/mono）与朱砂 editorial 报告（serif）刻意分层，绝不混用。
- **仪器背景（Instrument Backdrop）**：mesh radial gradient + 网格作为全局铺底，给"情报台"的氛围感；opacity 受主题与 reduced-motion 控制。
- **柠绿是信号强调**：占比 ≤15-20%，集中在主操作、active 态、focus、live 信号、数据端点。
- **信号发光（Signal Glow）**：`--glow-sm/md/lg` 仅用于 live 指示、增长曲线端点、关系图节点、品牌 mark、focus 强化——发光必须标注一个可被读出的状态。
- **Mono 即数据**：JetBrains Mono 专属时间 / 标签 / 代码 / 元信息 / 遥测数值。
- **仪器级可读性**：正文 ≥4.5:1，永远不为"优雅"牺牲对比。柠绿在浅色模式用深翠绿 `#5B8C1A` 保证对比。
- **浅/深双主题**：两套都过对比检查；主题切换为 View Transitions 圆形展开。

## 2. Colors: 柠绿 / 朱砂 / 墨灰双声调色板

工作台用一组**冷中性 + 单一柠绿信号强调**；editorial 报告用一组**固定浅色 paper + 朱砂**暖调。两套各自完整，刻意不交叉。

### Primary
- **柠绿（Lime）** `#5B8C1A`（浅色）/ `#D4FF3F`（深色）：工作台唯一强调色。主按钮、active 态、focus ring、发送键、进度环、链接 hover、live 信号、数据端点、关系图节点。**占比 ≤15-20%**——仍是强调不是底色，但比 V1 的 ≤10% 更大胆。深色用亮柠绿 `#D4FF3F`（高饱和、信号穿透力强）；浅色用深翠绿 `#5B8C1A`（保证 ≥4.5:1 对比）。
- **柠绿浅（Lime Soft）** `rgba(91,140,26,.10)`（浅）/ `rgba(212,255,63,.10)`（深）：accent 的 tint 背景——选中 chip、tag、code 背景、focus ring 填充、active 卡片渐变。

### Secondary（editorial 报告专属）
- **朱砂红（Editorial Vermillion）** `#c8341a`：editorial 报告里**唯一**的强调色——报头 kicker、标题 drop-cap、链接、blockquote 左线、引用标记 `[n]`。**绝不出现在工作台界面**。这是"朱砂 + 白纸"的刻意 editorial 决策，与奶油 + sage 的 AI 默认无关。
- **editorial paper** `#ffffff` / **paper-2 暖纸** `#ece5d6`：报告交付物的纸面。paper-2 是系统里**唯一**被许可的暖色调——且只允许出现在 editorial 报告内部。

### Neutral
- **雾白（Mist）** `#FAFAFB`（深色炭灰 `#0E0F13`）：工作台 body 背景。**真正的近白中性，chroma ≈ 0**，不是奶油 / 米色。这是反 AI-slop 的第一道防线。仪器背景的 mesh/grid 叠在此之上。
- **雾面（Mist Surface）** `#FFFFFF` / surface-2 `#F4F4F6` / surface-3 `#EFEFF2`：tonal layering 的三层表面，靠明度差表达深度，不靠阴影。
- **墨灰（Graphite）** `#18181B`（深色 `#E5E7EB`）：正文文字。配套 graphite-2 `#3F3F46`（次级）、graphite-3 `#71717A`（元信息）、graphite-4 `#A1A1AA`（占位 / 禁用——但占位仍需 ≥4.5:1）。
- **雾线（Mist Border）** `#E7E7EA` / border-2 `#DEDDE1`：分隔线与边框，发丝级。

### Tertiary（语义信号）
- **信号绿 / 琥珀 / 玫瑰** `#16A34A` / `#C4870E` / `#DC2626`：状态语义色（成功 / 警示 / 错误）。**绝不只靠颜色**——必须配形素（图标或文字）。注意：信号绿 `--green` 用于"工具执行成功"等纯状态语义，与柠绿 `--accent`（工作台主强调）分工——柠绿是品牌强调，信号绿是状态色。
- **数据源色** search `#3B7EA1` / rss `#9B5DE5` / crawl `#C4870E`：数据源类型标识，主题稳定，靠色相 + 形素区分（色盲安全）。

### Named Rules
- **The 柠绿信号 Rule.** 柠绿出现在任何一屏的面积 ≤15-20%。它是信号强调，不是底色。一旦它铺满 surface，就稀释了它作为"信号"的力量。
- **The Paper-Only Rule.** 暖纸 `#ece5d6` 只允许出现在 editorial 报告表面内部。**永远不许**用作工作台 body / 卡片 / section 背景。这是反"奶油底 AI 默认"的硬边界。
- **The 双声调不混 Rule.** 朱砂 `#c8341a` 与 Fraunces 衬线只属于 editorial 报告；柠绿 `#5B8C1A`/`#D4FF3F` 与 Inter 只属于工作台。两个 register 的色与字绝不交叉使用。
- **The 对比底线 Rule.** 正文 ≥4.5:1，大字 ≥3:1，占位符同样 ≥4.5:1。柠绿在浅色模式**必须**用深翠绿 `#5B8C1A`（亮柠绿在白底上对比不足）；深色模式才用亮柠绿 `#D4FF3F`。

## 3. Typography: Inter × JetBrains Mono × Fraunces

**工作台字体：** Inter（正文）+ JetBrains Mono（数据 / 标签）。
**Editorial 字体：** Fraunces（标题，opsz + weight 900）+ Inter Tight（报告正文）。
**字符：** 三族刻意分层——几何 sans（Inter）做工作台，等宽（Mono）做数据，可变衬线（Fraunces）做交付物。两两之间是**对比轴**，不是近似轴。

### Hierarchy
- **Editorial Display**（Fraunces 900，36px，line-height 1.08，letter-spacing -0.015em）：报告主标题。**仅此一处**用衬线 display。
- **Editorial Standfirst**（Fraunces italic，18px）：报告导语，配 drop-cap（4.2rem 朱砂首字母）。
- **Workbench Display**（Inter 700，28px，letter-spacing -0.01em）：工作台最大字号——空态大标题、会话标题。当前会话标题里的关键词可用 `<em>` 标注（Inter italic + 柠绿色），制造编辑式强调。
- **Body**（Inter 400，14px，line-height 1.6）：工作台正文。Markdown 正文 14.5px / 1.75，**max-width 68ch**。
- **Label**（JetBrains Mono 500，11px，uppercase，letter-spacing 0.14em）：全大写小标签——eyebrow、时间戳、元信息、遥测 cell key。**只用于真正的 label，不滥用为每个 section 的 kicker。**
- **Mono**（JetBrains Mono，12.5px，tabular-nums）：代码、数字、时间、`.cite` 引用标记、遥测数值、面包屑分隔符。

### Named Rules
- **The Mono-Means-Data Rule.** JetBrains Mono 专属数据 / 时间 / 代码 / 标签 / 引用 / 遥测数值。**绝不**用 mono 跑正文，也绝不拿它当装饰。
- **The 65–75ch Rule.** 正文行长锁在 65–75ch（系统用 68ch）。超过即损可读性。
- **The One-Serif Surface Rule.** Fraunces 只活在 editorial 报告里。工作台出现衬线 = register 污染，立即改回 Inter。

## 4. Backdrop: 仪器背景（Instrument Backdrop）

**工作台不再是纯色底——它是一件运转中的仪器。** mesh radial gradient + 网格作为全局固定铺底（`position:fixed; inset:0; z-index:0; pointer-events:none`），内容浮于其上。

### Layers
- **mesh**：3 个 radial-gradient 色斑（柠绿 / 蓝 / 琥珀，极低 opacity），给"情报台"的氛围感。浅色 opacity ~0.5，深色 opacity 1.0。
- **grid-bg**：64px 网格线（`linear-gradient` 双轴），带 radial mask 让中心清晰、边缘淡出。浅色 opacity ~0.45，深色 opacity 1.0。

### Named Rules
- **The 仪器背景 Rule.** 背景层永远 `pointer-events:none` + `z-index:0`，绝不干扰内容交互。opacity 受主题控制（浅色更淡，深色更明显）。
- **The Reduced-Motion 降级 Rule.** 背景层本身无动画，但所有依赖背景氛围的 glow / pulse 动画必须在 `prefers-reduced-motion: reduce` 下降级为静态。
- **The 反氛围光 Rule.** mesh 色斑是"环境光"，不是"焦点光"。焦点信号（live 指示、数据端点）用 `--glow-sm/md/lg` 的柠绿信号发光，**不靠 mesh 表达**——mesh 只负责"氛围"，glow 负责"信号"。

## 5. Signal Glow: 信号发光（V2 新增）

**发光不再是禁区——但它必须标注一个可被读出的状态。** 这是 V2 相对 V1 最重要的规则演进。

### Glow Vocabulary
- **glow-sm** `0 0 12px rgba(212,255,63,.3)`（浅色 `0 0 0 1px rgba(91,140,26,.15)`）：极轻——live 状态点、focus ring 强化、cite hover、关系图节点脉冲。
- **glow-md** `0 0 24px rgba(212,255,63,.35)`（浅色 `0 4px 16px rgba(91,140,26,.18)`）：中等——active 卡片边框、发送键 hover、品牌 mark。
- **glow-lg** `0 0 32px rgba(212,255,63,.45)`（浅色 `0 8px 24px rgba(91,140,26,.22)`）：强——极少用，仅用于"系统启动 / 报告生成完成"等里程碑时刻（暂未启用）。

### Named Rules
- **The 信号发光 Rule.** 发光**只**用于携带信息的语义点：① 运行中状态（live 脉冲、avatar live-ring）；② 数据端点（增长曲线最新值、关系图结论节点）；③ focus 强化（输入框 focus ring、active 卡片）；④ 品牌 mark（产品"面貌"）。**装饰性发光是禁区**——不给静态卡片加泛光、不给背景加 halo、不给文字加 glow。
- **The Reduced-Motion 降级 Rule.** 所有 glow 脉冲动画（live ping、节点呼吸）必须在 `prefers-reduced-motion: reduce` 下降级为静态发光（保留 glow 视觉，去掉动画）。

## 6. Elevation

**扁平优先，tonal layering 为主，阴影只服务于状态。** 深度由表面明度差（surface → surface-2 → surface-3）承载，不靠投影。这是反"ghost card（1px 边框 + 软宽投影）"套路的刻意决策。**信号发光（signal glow）不替代阴影**——它是"信号灯"，不是"立体感"。

### Shadow Vocabulary
- **shadow-sm** `0 1px 2px rgba(0,0,0,0.04)`（深色 `rgba(0,0,0,0.3)`）：极轻，几乎只在 raised surface 边缘。
- **shadow-md** `0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)`：composer 输入框、悬浮元素、modal。
- **shadow-lg** `0 8px 30px rgba(0,0,0,0.12)`：modal 弹窗、cite 弹窗、下拉面板。

### Named Rules
- **The 信号发光 ≠ 阴影 Rule.** glow（柠绿信号光）与 shadow（黑色投影）是两套系统。glow 表达"这里有信号"，shadow 表达"这层浮在上面"。不要用 glow 替代 shadow 制造立体感，也不要用 shadow 替代 glow 表达信号。
- **The Flat-By-Default Rule.** 表面静止时是平的。阴影只作为状态响应出现（hover、悬浮、modal）——**绝不**给静态卡片加投影当装饰。
- **The Ghost-Card 禁令.** 永远不要把 `border: 1px solid X` 和 `box-shadow` blur ≥16px 配在一起当装饰。二选一：要么纯边框，要么 ≤8px blur 的定义阴影。注意：`border + glow`（信号发光）是**允许的**，因为 glow 是信号语义不是立体装饰——但仅限信号点。

## 7. Components

### Buttons
- **Shape:** 小圆角（`--r-sm` 8px）。主按钮 36px 高，ghost/icon 32px。**绝不**用 24px+ 大圆角——那是 codex tell。
- **Primary:** 柠绿底 `#5B8C1A`/`#D4FF3F` + on-accent 字，`0 16px` padding，600 weight。hover → `--accent-hover` + glow-md。运行中的发送键转 rose + 停止图标——状态切换即颜色切换。
- **Secondary / Ghost:** surface 底 + graphite-2 字 + border。hover 时 border 转 accent、字转 accent——颜色变化承载状态，不加阴影。
- **Icon button:** 32×32 方形，surface + border，hover 转 accent。
- **Abort button:** rose-soft 底 + rose 字 + rose-line 边，hover 转 rose 实色 + rose glow。

### Chips
- **Style:** surface 底 + border + pill 圆角（999px），`4 10px` padding，11px 字。
- **State:** 选中 → 柠绿浅底 + accent-line 边 + accent-text 字 + 600 weight。未选中保持中性。

### Composer（签名输入）
- **Shape:** 1.5px border + 12px 圆角 + shadow-md，sticky 在底部，底色 `linear-gradient(transparent → bg)` 淡出。
- **Focus:** border 转 accent + glow-sm ring（不再是纯 border）。
- **Foot:** 时间窗 chip + conic-gradient 上下文进度环（柠绿）+ mono 元信息 + 发送键。密度服务于"一眼看清状态"。

### Telemetry Strip（V2 新签名组件 · 顶栏右侧）
- **Shape:** 单行 4-cell 横条，每 cell `状态/耗时/来源/词元`，cell 间 hairline 分隔。
- **Live cell:** 状态 cell 在运行中带柠绿 live 脉冲点（glow-sm + ping 动画）+ 柠绿 soft 底色渐变。
- **Values:** JetBrains Mono 12.5px tabular-nums；key 用 sans 9.5px uppercase tracked。
- **Named Rule:** 遥测条是"仪器在运转"的核心证据——它必须实时反映 run 状态，绝不做静态装饰。

### Breadcrumb（V2 新组件 · 顶栏中间）
- **Shape:** `工作台 / 会话 / {当前标题}`，分隔符用 mono `/`。
- **Current item:** 底部柠绿下划线（glow-sm）+ 字重 600。标题可用 `<em>` italic + 柠绿色做编辑式强调。
- **Named Rule:** 面包屑是"你在哪"的唯一指示——当前项必须有清晰的视觉锚点（下划线 + glow）。

### Conversation card（V2 升级 · 左栏索引卡）
- **Shape:** 12px 圆角卡片（不再是单行 list-item），`12 14px` padding，标题 2 行 clamp + 元信息行（轮数 accent / 时长 / 来源数 / 相对时间）。
- **Hover:** 边框转 border-2 + 鼠标跟随光晕（radial-gradient at `--mx/--my`，柠绿 soft，reduced-motion 关闭）。
- **Active:** 柠绿 soft gradient 底 + 柠绿 line 边 + glow-sm + 标题转柠绿色。
- **Named Rule:** 卡片是"可追溯单元"——它的元信息（轮数 / 来源数）让研究员一眼判断"这个会话有多深"。

### Citation Growth Chart（V2 新签名组件 · 右栏）
- **Shape:** SVG 折线图，柠绿 polyline + gradient fill + 端点 dot（glow-sm + 脉冲）。
- **Data:** 近 N 轮的引用数序列，单调上升时显示"持续增长 ↗"。
- **Named Rule:** 增长图是"证据在积累"的可视化——它必须反映真实历史，绝不做假数据装饰。

### Citation Relation Graph（V2 新签名组件 · 右栏）
- **Shape:** SVG 节点-边图，中心结论节点（柠绿菱形 + glow + 呼吸脉冲）+ 环形来源节点（编号 + 柠绿描边）。
- **Edges:** 采纳（柠绿实线 + 流动粒子）/ 相交（蓝虚线）/ 对立（红波浪线）三色，配 legend。
- **Named Rule:** 关系图是"证据之间如何相互支持 / 矛盾"的核心——它让"多源交叉验证"可视，而不是一堆孤立链接。

### Conversation list item（legacy，已被 Conversation card 取代）
- 保留旧的单行 item 作为 fallback；新设计统一用 card。

### Editorial report（签名交付物）
- **Paper:** 固定浅色 `#fff` / paper-2 `#ece5d6`，**不跟主题切换**——交付物永远是同一张纸。
- **Masthead:** mono kicker（朱砂，0.16em tracking）+ mono pub-date + 3px double-rule + Fraunces 900 标题。
- **Body:** Inter Tight 16px / 1.7；standfirst 配 4.2rem 朱砂 drop-cap；blockquote 朱砂左线 + 浅朱砂底；`[n]` 引用可点开 cite 弹窗。
- **Single source:** 屏上 modal 与下载 HTML 共用 `@ai-insight/shared-ui` 的 `editorialColors` + `editorialComponentCss`，**色与版式永远一致**。

### Markdown body（消息 / 报告预览）
14.5px / 1.75，max-width 68ch；代码用 mono + surface-2 底；`[n]` → ① 引用标记（mono, super, 可点）。

## 8. Do's and Don'ts

### Do:
- **Do** 把柠绿当信号强调——任何一屏 ≤15-20%，留给主操作、active 态、focus、live 信号、数据端点。
- **Do** 用 tonal layering（surface / surface-2 / surface-3）表达深度，而非阴影。
- **Do** 让正文达到 ≥4.5:1 对比；占位符同理。墨灰向 ink 端压，不要向灰端退。浅色模式的柠绿用深翠绿 `#5B8C1A`。
- **Do** 在携带信息的语义点上用信号发光（glow）：live 脉冲、数据端点、关系节点、focus 强化、品牌 mark。
- **Do** 用 mesh + grid 仪器背景给"情报台"氛围感——但保持 pointer-events:none + z-index:0。
- **Do** 把 JetBrains Mono 留给数据 / 时间 / 代码 / 标签 / 引用 / 遥测数值——它是仪器感的来源。
- **Do** 让 editorial 报告保持固定浅色 + 朱砂 + Fraunces——它是交付物，与工具态刻意分层。
- **Do** 给每个状态语义色配形素（图标 / 文字），绝不只靠颜色。
- **Do** 为每个 glow / pulse 动画带 `prefers-reduced-motion` 降级（仓库已落实，保持）。

### Don't:
- **Don't** 用奶油 / 沙 / 米色（`--paper` / `--cream` / `--sand` 之流）做工作台背景。暖纸 `#ece5d6` 只属于 editorial 报告内部。（PRODUCT.md anti-reference）
- **Don't** 用**装饰性**发光——背景氛围 halo、卡片泛光、文字 glow。发光必须标注一个可被读出的状态（live / 数据端点 / 关系节点 / focus）。（V2 规则演进）
- **Don't** 用玻璃拟态当装饰、渐变文字（`background-clip: text` + 渐变）。功能性 blur 只允许在 modal 遮罩与顶栏 backdrop。（PRODUCT.md anti-reference）
- **Don't** 把 `border: 1px solid` 与 ≥16px blur 的 `box-shadow` 配在一起当装饰（ghost card）。注意：`border + glow`（信号发光）是允许的，因为 glow 是信号不是立体装饰。
- **Don't** 给卡片 / section / 输入框用 24px+ 大圆角。卡片上限 12–16px。
- **Don't** 用千篇一律的"图标 + 标题 + 一句话"卡片网格，或 hero-metric 模板（大数字 + 小标签 + stats）。（PRODUCT.md anti-reference）
- **Don't** 在每个 section 上方加全大写宽字距 eyebrow 当 scaffolding——一个刻意的 label 系统是声音，eyebrow 满天飞是 AI 语法。（PRODUCT.md anti-reference）
- **Don't** 让 Fraunces 衬线或朱砂出现在工作台界面——那是 register 污染。
- **Don't** 把"克制"推到怯懦：洗白灰底正文、只有发丝线层级、所有元素同等权重。**克制 ≠ 不可读。**
- **Don't** 用侧边条 `border-left/right` >1px 当卡片 / callout 的彩色装饰。列表项 active 态的 2px 左线是合法的（状态指示），卡片装饰不是。
- **Don't** 做不展示来源与推理的聊天壳——本产品的存在意义就是"可追溯"。（PRODUCT.md anti-reference）
