---
name: "AI-Insight · 洞察工作台"
description: "研究员的工作台 —— 翠玉绿工作台 + 朱砂 editorial 报告的双声调设计系统（浅/深双主题）。"
colors:
  # ── Workbench · 浅色（canonical） ──
  verdant-emerald: "#2F855A"
  verdant-emerald-hover: "#276749"
  verdant-emerald-soft: "#E1EFE5"
  verdant-emerald-line: "#C7E3D0"
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
  # ── Workbench · 深色覆盖 ──
  verdant-emerald-dark: "#3DD684"
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
    backgroundColor: "{colors.verdant-emerald}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.verdant-emerald-hover}"
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
    backgroundColor: "{colors.verdant-emerald-soft}"
    textColor: "{colors.graphite}"
  conversation-item:
    rounded: "{rounded.sm}"
    padding: "9px 11px"
  conversation-item-active:
    backgroundColor: "{colors.mist-surface-2}"
---

# Design System: AI-Insight · 洞察工作台

## 1. Overview

**Creative North Star: "研究员的工作台（The Research Desk）"**

AI-Insight 是研究员的工作台。**表面是一件仪器**：翠玉绿强调的扁平工作台，Inter + JetBrains Mono，无发光，浅/深双主题——会话、流式推理、证据面板都在这里发生。**仪器产出的，是一份出版物**：朱砂 + 白纸的 editorial 报告，Fraunces 衬线 + drop-cap + 双线报头，与可下载的 standalone HTML 同源同色。工具是主身份，报告是它的一等交付物。

这套系统刻意**克制而自信**：层级由字重、对比与密度承载，不靠发光、渐变或装饰。它信任用户的专业能力——研究员整天在读，所以可读性永远高于"优雅"。它**主动拒绝 2026 AI 默认审美**：不要奶油 / 沙 / 米色背景，不要玻璃拟态，不要发光，不要渐变文字，不要千篇一律的卡片网格，不要每个 section 上方的全大写 eyebrow。仓库以 `unslop-ignore` 标记每一处刻意决策（editorial 衬线、drop-cap、朱砂报头），这些是品牌声音，不是 AI 语法。

> 战略方向（来自 PRODUCT.md）：在当前克制的基线上往"**更锐利、更有主张**"推——更紧的节奏、更强的层级、更高的对比。DESIGN.md 记录的是**今天**的系统；锐利化是未来 `craft` / `bolder` / `layout` 的方向，不是在文档里凭空改数值。

**Key Characteristics:**
- **双声调（Two-Voice）**：翠玉绿工作台（sans/mono）与朱砂 editorial 报告（serif）刻意分层，绝不混用。
- **扁平优先（Flat-By-Default）**：表面靠 tonal layering（surface / surface-2 / surface-3）表达深度；阴影只服务于状态。
- **翠玉绿是稀缺强调**：占比 ≤10%，稀缺即是它的力量。
- **Mono 即数据**：JetBrains Mono 专属时间 / 标签 / 代码 / 元信息。
- **仪器级可读性**：正文 ≥4.5:1，永远不为"优雅"牺牲对比。
- **浅/深双主题**：两套都过对比检查；主题切换为 View Transitions 圆形展开。

## 2. Colors: 翠玉 / 朱砂 / 墨灰双声调色板

工作台用一组**冷中性 + 单一翠玉强调**；editorial 报告用一组**固定浅色 paper + 朱砂**暖调。两套各自完整，刻意不交叉。

### Primary
- **翠玉绿（Verdant Emerald）** `#2F855A`（深色 `#3DD684`）：工作台唯一强调色。主按钮、active 态、focus ring、发送键、进度环、链接 hover。**占比 ≤10%**——稀缺即其力量。深色模式提亮至 `#3DD684` 保证对比。
- **翠玉浅（Emerald Soft）** `#E1EFE5`（深色 `rgba(61,214,132,0.14)`）：accent 的 tint 背景——选中 chip、tag、code 背景、focus ring 填充。

### Secondary（editorial 报告专属）
- **朱砂红（Editorial Vermillion）** `#c8341a`：editorial 报告里**唯一**的强调色——报头 kicker、标题 drop-cap、链接、blockquote 左线、引用标记 `[n]`。**绝不出现在工作台界面**。这是"朱砂 + 白纸"的刻意 editorial 决策，与奶油 + sage 的 AI 默认无关。
- **editorial paper** `#ffffff` / **paper-2 暖纸** `#ece5d6`：报告交付物的纸面。paper-2 是系统里**唯一**被许可的暖色调——且只允许出现在 editorial 报告内部。

### Neutral
- **雾白（Mist）** `#FAFAFB`（深色炭灰 `#0E0F13`）：工作台 body 背景。**真正的近白中性，chroma ≈ 0**，不是奶油 / 米色。这是反 AI-slop 的第一道防线。
- **雾面（Mist Surface）** `#FFFFFF` / surface-2 `#F4F4F6` / surface-3 `#EFEFF2`：tonal layering 的三层表面，靠明度差表达深度，不靠阴影。
- **墨灰（Graphite）** `#18181B`（深色 `#E5E7EB`）：正文文字。配套 graphite-2 `#3F3F46`（次级）、graphite-3 `#71717A`（元信息）、graphite-4 `#A1A1AA`（占位 / 禁用——但占位仍需 ≥4.5:1）。
- **雾线（Mist Border）** `#E7E7EA` / border-2 `#DEDDE1`：分隔线与边框，发丝级。

### Tertiary（语义信号）
- **信号绿 / 琥珀 / 玫瑰** `#16A34A` / `#C4870E` / `#DC2626`：状态语义色（成功 / 警示 / 错误）。**绝不只靠颜色**——必须配形素（图标或文字）。
- **数据源色** search `#3B7EA1` / rss `#9B5DE5` / crawl `#C4870E`：数据源类型标识，主题稳定，靠色相 + 形素区分（色盲安全）。

### Named Rules
- **The 稀缺翠玉 Rule.** 翠玉绿出现在任何一屏的面积 ≤10%。它是强调，不是底色。一旦它铺满 surface，就稀释了它作为"信号"的力量。
- **The Paper-Only Rule.** 暖纸 `#ece5d6` 只允许出现在 editorial 报告表面内部。**永远不许**用作工作台 body / 卡片 / section 背景。这是反"奶油底 AI 默认"的硬边界。
- **The 双声调不混 Rule.** 朱砂 `#c8341a` 与 Fraunces 衬线只属于 editorial 报告；翠玉 `#2F855A` 与 Inter 只属于工作台。两个 register 的色与字绝不交叉使用。
- **The 对比底线 Rule.** 正文 ≥4.5:1，大字 ≥3:1，占位符同样 ≥4.5:1。不接受"灰一点更优雅"——浅灰正文是 AI 设计难读的头号原因。

## 3. Typography: Inter × JetBrains Mono × Fraunces

**工作台字体：** Inter（正文）+ JetBrains Mono（数据 / 标签）。
**Editorial 字体：** Fraunces（标题，opsz + weight 900）+ Inter Tight（报告正文）。
**字符：** 三族刻意分层——几何 sans（Inter）做工作台，等宽（Mono）做数据，可变衬线（Fraunces）做交付物。两两之间是**对比轴**，不是近似轴。

### Hierarchy
- **Editorial Display**（Fraunces 900，36px，line-height 1.08，letter-spacing -0.015em）：报告主标题。**仅此一处**用衬线 display。
- **Editorial Standfirst**（Fraunces italic，18px）：报告导语，配 drop-cap（4.2rem 朱砂首字母）。
- **Workbench Display**（Inter 700，28px，letter-spacing -0.01em）：工作台最大字号——空态大标题、页面标题。
- **Body**（Inter 400，14px，line-height 1.6）：工作台正文。Markdown 正文 14.5px / 1.75，**max-width 68ch**。
- **Label**（JetBrains Mono 500，11px，uppercase，letter-spacing 0.14em）：全大写小标签——eyebrow、时间戳、元信息。**只用于真正的 label，不滥用为每个 section 的 kicker。**
- **Mono**（JetBrains Mono，12.5px，tabular-nums）：代码、数字、时间、`.cite` 引用标记。

### Named Rules
- **The Mono-Means-Data Rule.** JetBrains Mono 专属数据 / 时间 / 代码 / 标签 / 引用。**绝不**用 mono 跑正文，也绝不拿它当装饰。
- **The 65–75ch Rule.** 正文行长锁在 65–75ch（系统用 68ch）。超过即损可读性。
- **The One-Serif Surface Rule.** Fraunces 只活在 editorial 报告里。工作台出现衬线 = register 污染，立即改回 Inter。

## 4. Elevation

**扁平优先，tonal layering 为主，阴影只服务于状态。** 深度由表面明度差（surface → surface-2 → surface-3）承载，不靠投影。这是反"ghost card（1px 边框 + 软宽投影）"套路的刻意决策。

### Shadow Vocabulary
- **shadow-sm** `0 1px 2px rgba(0,0,0,0.04)`（深色 `rgba(0,0,0,0.3)`）：极轻，几乎只在 raised surface 边缘。
- **shadow-md** `0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)`：composer 输入框、悬浮元素。
- **shadow-lg** `0 8px 30px rgba(0,0,0,0.12)`：modal 弹窗、cite 弹窗。

### Named Rules
- **The 无发光 Rule.** 没有装饰性 blur / glow / 渐变光晕。`backdrop-filter: blur(4px)` 只用在 modal 遮罩与 editorial 浮动按钮——功能性隔离背景，不是装饰。
- **The Flat-By-Default Rule.** 表面静止时是平的。阴影只作为状态响应出现（hover、悬浮、modal）——**绝不**给静态卡片加投影当装饰。
- **The Ghost-Card 禁令.** 永远不要把 `border: 1px solid X` 和 `box-shadow` blur ≥16px 配在一起当装饰。二选一：要么纯边框，要么 ≤8px blur 的定义阴影。

## 5. Components

### Buttons
- **Shape:** 小圆角（`--r-sm` 8px）。主按钮 36px 高，ghost/icon 32px。**绝不**用 24px+ 大圆角——那是 codex tell。
- **Primary:** 翠玉绿底 `#2F855A` + 白字，`0 16px` padding，600 weight。hover → `--accent-hover`。**无发光，无下沉**（不 `translateY`）。
- **Secondary / Ghost:** surface 底 + graphite-2 字 + border。hover 时 border 转 accent、字转 accent——颜色变化承载状态，不加阴影。
- **Icon button:** 32×32 方形，surface + border，hover 转 accent。
- **Composer send:** 透明底 + accent 图标；运行中转 rose + 停止图标——状态切换即颜色切换。

### Chips
- **Style:** surface 底 + border + pill 圆角（999px），`4 10px` padding，11px 字。
- **State:** 选中 → 翠玉浅底 `#E1EFE5` + accent-line 边 + accent-text 字 + 600 weight。未选中保持中性。

### Composer（签名输入）
- **Shape:** 1.5px border + 12px 圆角 + shadow-md，sticky 在底部，底色 `linear-gradient(transparent → bg)` 淡出。
- **Focus:** border 转 accent（**不是**发光 ring）。
- **Foot:** 时间窗 chip + conic-gradient 上下文进度环 + mono 元信息 + 发送键。密度服务于"一眼看清状态"。

### Conversation list item
- **Shape:** 8px 圆角，`9 11px` padding，hover → surface-2。
- **Active:** surface-2 底 + **左边 2px accent 边**（这是列表项 active 态的合法左线，因为它是状态指示，不是卡片装饰）+ 标题转 600。

### Editorial report（签名交付物）
- **Paper:** 固定浅色 `#fff` / paper-2 `#ece5d6`，**不跟主题切换**——交付物永远是同一张纸。
- **Masthead:** mono kicker（朱砂，0.16em tracking）+ mono pub-date + 3px double-rule + Fraunces 900 标题。
- **Body:** Inter Tight 16px / 1.7；standfirst 配 4.2rem 朱砂 drop-cap；blockquote 朱砂左线 + 浅朱砂底；`[n]` 引用可点开 cite 弹窗。
- **Single source:** 屏上 modal 与下载 HTML 共用 `@ai-insight/shared-ui` 的 `editorialColors` + `editorialComponentCss`，**色与版式永远一致**。

### Markdown body（消息 / 报告预览）
14.5px / 1.75，max-width 68ch；代码用 mono + surface-2 底；`[n]` → ① 引用标记（mono, super, 可点）。

## 6. Do's and Don'ts

### Do:
- **Do** 把翠玉绿当稀缺信号——任何一屏 ≤10%，留给主操作、active 态、focus。
- **Do** 用 tonal layering（surface / surface-2 / surface-3）表达深度，而非阴影。
- **Do** 让正文达到 ≥4.5:1 对比；占位符同理。墨灰向 ink 端压，不要向灰端退。
- **Do** 把 JetBrains Mono 留给数据 / 时间 / 代码 / 标签 / 引用——它是仪器感的来源。
- **Do** 让 editorial 报告保持固定浅色 + 朱砂 + Fraunces——它是交付物，与工具态刻意分层。
- **Do** 给每个状态语义色配形素（图标 / 文字），绝不只靠颜色。
- **Do** 为每个动效带 `prefers-reduced-motion` 降级（仓库已落实，保持）。

### Don't:
- **Don't** 用奶油 / 沙 / 米色（`--paper` / `--cream` / `--sand` 之流）做工作台背景。暖纸 `#ece5d6` 只属于 editorial 报告内部。（PRODUCT.md anti-reference）
- **Don't** 用玻璃拟态、发光、渐变文字（`background-clip: text` + 渐变）当装饰。功能性 blur 只允许在 modal 遮罩。（PRODUCT.md anti-reference）
- **Don't** 把 `border: 1px solid` 与 ≥16px blur 的 `box-shadow` 配在一起当装饰（ghost card）。
- **Don't** 给卡片 / section / 输入框用 24px+ 大圆角。卡片上限 12–16px。
- **Don't** 用千篇一律的"图标 + 标题 + 一句话"卡片网格，或 hero-metric 模板（大数字 + 小标签 + stats）。（PRODUCT.md anti-reference）
- **Don't** 在每个 section 上方加全大写宽字距 eyebrow 当 scaffolding——一个刻意的 label 系统是声音，eyebrow 满天飞是 AI 语法。（PRODUCT.md anti-reference）
- **Don't** 让 Fraunces 衬线或朱砂出现在工作台界面——那是 register 污染。
- **Don't** 把"克制"推到怯懦：洗白灰底正文、只有发丝线层级、所有元素同等权重。**克制 ≠ 不可读。**
- **Don't** 用侧边条 `border-left/right` >1px 当卡片 / callout 的彩色装饰。列表项 active 态的 2px 左线是合法的（状态指示），卡片装饰不是。
- **Don't** 做不展示来源与推理的聊天壳——本产品的存在意义就是"可追溯"。（PRODUCT.md anti-reference）
