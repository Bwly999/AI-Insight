/**
 * Editorial 报告 SSR 渲染 — 纯渲染函数版（无 .vue SFC 依赖）。
 *
 * 用途：服务端 standalone HTML 渲染（@vue/server-renderer）。
 * 不导入 .vue 文件 → tsx 运行时可直接加载（无需 vue 插件）。
 * EditorialReport.vue（SFC 版）供用户端客户端渲染复用（同样的版式）。
 */
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h, type Component } from "vue";
import {
  editorialRootVars,
  editorialComponentCss,
  editorialFontLink,
} from "./tokens.js";
import { mdInline } from "./report-markdown.js";
import type { Citation } from "@ai-insight/shared-types";

export interface RenderReportInput {
  title: string;
  standfirst?: string;
  bodyHtml: string;
  citations?: Citation[];
  meta?: {
    issueNo?: string;
    createdAt?: string;
    signalCount?: number;
    sourceCount?: number;
  };
}

/** EditorialReport 组件（渲染函数版，与 .vue 版版式一致）。 */
const EditorialReportSsr: Component = {
  props: {
    title: { type: String, required: true },
    standfirst: String,
    bodyHtml: { type: String, required: true },
    meta: Object,
  },
  setup(props) {
    const pubDate = () => {
      const c = props.meta?.createdAt as string | undefined;
      return (c ? c : new Date().toISOString()).slice(0, 10);
    };
    return () =>
      h("article", { class: "editorial-report" }, [
        // 报头
        h("header", { class: "report-masthead" }, [
          h("div", { class: "masthead-meta" }, [
            h("span", { class: "kicker" }, "AI-Insight · 洞察报告"),
            props.meta?.issueNo
              ? h("span", { class: "issue-no" }, `№ ${props.meta.issueNo}`)
              : null,
            h("span", { class: "font-mono pub-date" }, pubDate()),
          ]),
          h("div", { class: "double-rule masthead-rule" }),
          // 标题/导语用 mdInline 解析内联标记（**bold** 等），与 web ReportModal 一致；
          // innerHTML 在 SSR 等价 v-html（editorial-body 已用此法）。mdInline 先 esc() 再应用规则，安全。
          h("h1", { class: "report-title", innerHTML: mdInline(props.title) }),
          props.standfirst
            ? h("p", { class: "report-standfirst drop-cap", innerHTML: mdInline(props.standfirst) })
            : null,
        ]),
        // 正文（v-html 等价：innerHTML）
        h("div", { class: "editorial-body", innerHTML: props.bodyHtml }),
        // 供稿行：仅当实际传入 signalCount/sourceCount 时渲染（避免只传 createdAt 时出现 "收录 — 条信号"）
        props.meta && (props.meta.signalCount != null || props.meta.sourceCount != null)
          ? h("footer", { class: "report-footer thick-rule" }, [
              h(
                "span",
                { class: "font-mono footer-meta" },
                `收录 ${props.meta.signalCount ?? "—"} 条信号 · ${props.meta.sourceCount ?? "—"} 个数据源`,
              ),
              h(
                "span",
                { class: "font-mono footer-meta" },
                "由 AI-Insight Agent 自主采集数据源并综合生成",
              ),
            ])
          : null,
      ]);
  },
};

/**
 * 渲染 standalone HTML 报告字符串（editorial 版式，可独立打开/下载）。
 */
export async function renderReportStandalone(
  input: RenderReportInput,
): Promise<string> {
  const app = createSSRApp({
    render: () =>
      h(EditorialReportSsr, {
        title: input.title,
        standfirst: input.standfirst,
        bodyHtml: input.bodyHtml,
        meta: input.meta,
      }),
  });
  const bodyContent = await renderToString(app);

  // 引用数据 + 🔗弹窗交互（仅有 citations 时注入；数字①是 <a> 无需 JS）
  const citationsBlock = input.citations?.length
    ? buildCitationsBlock(input.citations)
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(input.title)} · AI-Insight 洞察报告</title>
${editorialFontLink}
<style>
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);}
${editorialRootVars}
${editorialComponentCss}
.editorial-report{max-width:760px;margin:0 auto;padding:40px 24px 64px;font-family:'Inter Tight',-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:var(--ink);}
.report-masthead{border-bottom:3px solid var(--rule);padding-bottom:20px;margin-bottom:28px;}
.masthead-meta{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap;}
.kicker{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--vermillion);font-weight:600;}
.issue-no{font-family:'Fraunces',Georgia,serif;font-style:italic;color:var(--ink-3);font-size:14px;}
.pub-date{margin-left:auto;font-size:11px;color:var(--ink-3);}
.report-title{font-family:'Fraunces',Georgia,serif;font-weight:900;font-size:36px;line-height:1.08;letter-spacing:-.015em;color:var(--ink);margin:6px 0 0;}
.report-standfirst{font-size:18px;color:var(--ink-2);margin:14px 0 0;font-style:italic;}
.report-footer{margin-top:40px;padding-top:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;}
.footer-meta{font-size:11px;color:var(--ink-3);}
.cite-overlay{position:fixed;inset:0;background:rgba(26,22,18,.45);display:flex;align-items:center;justify-content:center;z-index:9999;}
.cite-modal{background:#fdfcf8;border-radius:10px;max-width:520px;max-height:70vh;overflow-y:auto;padding:24px 28px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.18);}
.cite-modal-item{padding:10px 0;border-bottom:1px solid rgba(26,22,18,.08);}
.cite-modal-item:last-child{border-bottom:none;}
.cite-modal-title{font-weight:600;color:var(--ink);text-decoration:none;display:block;margin-bottom:4px;font-size:14px;}
.cite-modal-title:hover{color:var(--vermillion);}
.cite-modal-summary{font-size:12.5px;color:var(--ink-2);line-height:1.55;margin:0;}
.cite-modal-close{position:absolute;top:6px;right:12px;border:none;background:none;font-size:22px;cursor:pointer;color:var(--ink-3);line-height:1;}
</style>
</head>
<body>
${bodyContent}
${citationsBlock}
</body>
</html>`;
}

/**
 * 烘焙引用数据 JSON + 🔗弹窗 vanilla JS 到 standalone HTML。
 * 数字①是 <a target=_blank> 无需 JS；🔗点击读 JSON 弹模态框列出 summary。
 */
function buildCitationsBlock(citations: Citation[]): string {
  // escape </script> 防注入
  const json = JSON.stringify(citations).replace(/</g, "\\u003c");
  return `<script type="application/json" id="citations">${json}</script>
<script>
document.addEventListener('click', function(e) {
  var link = e.target.closest('.cite-link');
  if (!link) return;
  e.preventDefault();
  var nums = link.getAttribute('data-cites').split(',').map(Number);
  var raw = document.getElementById('citations');
  if (!raw) return;
  var data = JSON.parse(raw.textContent);
  var items = nums.map(function(n) {
    return data.find(function(c) { return c.citeNo === n; });
  }).filter(Boolean);
  if (!items.length) return;
  var overlay = document.createElement('div');
  overlay.className = 'cite-overlay';
  var box = document.createElement('div');
  box.className = 'cite-modal';
  items.forEach(function(it) {
    var row = document.createElement('div');
    row.className = 'cite-modal-item';
    var t = document.createElement('a');
    t.href = it.url; t.target = '_blank'; t.rel = 'noopener noreferrer';
    t.textContent = it.title; t.className = 'cite-modal-title';
    row.appendChild(t);
    if (it.summary) {
      var s = document.createElement('p');
      s.textContent = it.summary; s.className = 'cite-modal-summary';
      row.appendChild(s);
    }
    box.appendChild(row);
  });
  var close = document.createElement('button');
  close.className = 'cite-modal-close'; close.textContent = '\\u00d7';
  close.onclick = function() { document.body.removeChild(overlay); };
  box.appendChild(close);
  overlay.appendChild(box);
  overlay.onclick = function(ev) { if (ev.target === overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);
});
</script>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
