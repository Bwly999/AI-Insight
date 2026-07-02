/**
 * Editorial 设计 tokens — 单一来源（CSS 变量 + JS 颜色统一，避免 ref/v2-editorial.html 的重复）。
 *
 * 色板（paper/ink/vermillion/mustard/forest/cobalt/rose）+ 字体（Fraunces/Inter Tight/JetBrains Mono）。
 * 源自 ref/v2-editorial.html。
 */

/** editorial 色板（hex 值，同时用于 CSS 变量与 JS）。 */
export const editorialColors = {
  paper: "#ffffff",
  paper2: "#ece5d6",
  ink: "#1a1612",
  ink2: "#4a423a",
  ink3: "#8a8073",
  rule: "#1a1612",
  vermillion: "#c8341a",
  mustard: "#d4a017",
  forest: "#2d5a3d",
  cobalt: "#1d3b6e",
  rose: "#a83a5c",
} as const;

/** CSS :root 变量声明（editorial 色板 + 字体）。 */
export const editorialRootVars = `
:root{
  --paper:${editorialColors.paper};
  --paper-2:${editorialColors.paper2};
  --ink:${editorialColors.ink};
  --ink-2:${editorialColors.ink2};
  --ink-3:${editorialColors.ink3};
  --rule:${editorialColors.rule};
  --vermillion:${editorialColors.vermillion};
  --mustard:${editorialColors.mustard};
  --forest:${editorialColors.forest};
  --cobalt:${editorialColors.cobalt};
  --rose:${editorialColors.rose};
}`;

/** editorial 专属 CSS（版式构件：drop-cap / stamp / heat bar / num-display 等）。 */
export const editorialComponentCss = `
.font-serif{font-family:'Fraunces',Georgia,serif;font-variation-settings:"opsz" 96;}
.font-mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
.font-body{font-family:'Inter Tight',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}
.tabular{font-variant-numeric:tabular-nums;}
.num-display{font-family:'Fraunces',Georgia,serif;font-weight:300;font-style:italic;line-height:0.9;}
.ink-border{border-color:var(--rule);}
.double-rule{border-top:3px double var(--rule);}
.thick-rule{border-top:4px solid var(--rule);}
.drop-cap::first-letter{font-family:'Fraunces',Georgia,serif;font-weight:900;float:left;
  font-size:4.2rem;line-height:0.82;color:var(--vermillion);margin:0.1rem 0.6rem 0 0;}
.marker{background:linear-gradient(180deg,transparent 60%,rgba(212,160,23,.45) 60%);padding:0 2px;}
.stamp{display:inline-block;border:2px solid var(--vermillion);color:var(--vermillion);
  font-family:'JetBrains Mono',monospace;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;font-size:11px;padding:3px 8px;transform:rotate(-6deg);}
.editorial-body h1,.editorial-body h2,.editorial-body h3{font-family:'Fraunces',Georgia,serif;color:var(--ink);}
.editorial-body h1{font-size:32px;line-height:1.1;margin:0 0 12px;letter-spacing:-.01em;}
.editorial-body h2{font-size:22px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(26,22,18,.15);}
.editorial-body h3{font-size:17px;margin:22px 0 8px;}
.editorial-body p{margin:10px 0;line-height:1.7;}
.editorial-body ul{padding-left:22px;margin:10px 0;}
.editorial-body li{margin:5px 0;}
.editorial-body a{color:var(--vermillion);}
.editorial-body blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid var(--vermillion);
  background:rgba(200,52,26,.06);color:var(--ink-2);border-radius:0 6px 6px 0;}
.editorial-body code{background:rgba(26,22,18,.08);padding:1px 5px;border-radius:4px;
  font-family:'JetBrains Mono',monospace;font-size:.92em;}
.editorial-body pre{background:var(--ink);color:#e6eaf0;padding:16px;border-radius:8px;overflow-x:auto;}
.editorial-body pre code{background:none;color:inherit;padding:0;}
.editorial-body table{border-collapse:collapse;width:100%;margin:14px 0;font-size:.95em;}
.editorial-body th,.editorial-body td{border:1px solid rgba(26,22,18,.18);padding:6px 10px;text-align:left;}
.editorial-body th{background:rgba(26,22,18,.05);font-weight:600;}
.editorial-body .cite{color:var(--vermillion);font-weight:600;cursor:default;font-size:.8em;}
`;

export const editorialFontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,900&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;
