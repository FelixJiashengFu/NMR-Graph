// 把 template.html + styles.css + model.js + data.js + app.js + 原图 + KaTeX 公式与字体
// 合成一个可离线直接打开的 ../index.html。
// 运行：node source/build.mjs   （或 deno run -A source/build.mjs；先 npm install / deno install）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import katex from "katex";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");
const katexDist = path.dirname(require.resolve("katex/dist/katex.min.css"));

let html = read("template.html");
const measure = JSON.parse(read("measure.json"));

// ---- 0. 正文里写死的数字必须与估读结果一致，否则拒绝构建 ----
const S = Object.fromEntries(measure.summary.map((r) => [r.site, r]));
const expectText = { C1: [1.06, 8.2], C7: [0.91, 14.3], C6: [1.32, 22.5], C5: [1.57, 26.4], C2: [2.42, 36.3], C4: [2.40, 42.7] };
for (const [site, [h, c]] of Object.entries(expectText)) {
  if (S[site].dH !== h || S[site].dC !== c) throw new Error(`正文数字与 measure.json 不一致：${site} 应为 ${S[site].dH} / ${S[site].dC}，正文写的是 ${h} / ${c}。请同步修改 template.html、data.js 和本表。`);
}
if (measure.images.original.width !== 1888 || measure.images.original.height !== 935) throw new Error("原图尺寸与正文不一致");

// ---- 1. 证据级别标签 ----
const EVIDENCE = new Function(read("data.js") + "\nreturn EVIDENCE;")();
html = html.replace(/\{\{ev:(\w+)\}\}/g, (_, k) => {
  if (!EVIDENCE[k]) throw new Error("未知证据级别 " + k);
  return `<span class="ev ${k}"><i aria-hidden="true">${EVIDENCE[k].mark}</i>${EVIDENCE[k].label}</span>`;
});

// ---- 2. 公式：构建时用 KaTeX 渲染成静态 HTML（页面里不需要 KaTeX 脚本）----
let formulaCount = 0;
const tex = (src, displayMode) => { formulaCount++; return katex.renderToString(src.trim(), { displayMode, throwOnError: true, strict: "error", output: "htmlAndMathml" }); };
html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, src) => tex(src, true));
html = html.replace(/\\\(([\s\S]+?)\\\)/g, (_, src) => tex(src, false));

// ---- 3. KaTeX 样式与字体：只内嵌用得到的 woff2，其余 @font-face 删除（避免离线时请求缺失文件）----
const KEEP_FONTS = ["KaTeX_Main-Regular", "KaTeX_Main-Italic", "KaTeX_Main-Bold", "KaTeX_Math-Italic", "KaTeX_Size1-Regular", "KaTeX_Size2-Regular", "KaTeX_Size3-Regular", "KaTeX_AMS-Regular"];
const embedded = [];
let katexCss = fs.readFileSync(path.join(katexDist, "katex.min.css"), "utf8").replace(/@font-face\{[^}]*\}/g, (block) => {
  const m = block.match(/url\(fonts\/([\w-]+)\.woff2\)/);
  if (!m || !KEEP_FONTS.includes(m[1])) return "";
  const b64 = fs.readFileSync(path.join(katexDist, "fonts", m[1] + ".woff2")).toString("base64");
  embedded.push(m[1]);
  return block.replace(/src:[^;}]+/, () => `src:url(data:font/woff2;base64,${b64}) format("woff2")`);
});
if (embedded.length !== KEEP_FONTS.length) throw new Error("KaTeX 字体内嵌不完整：" + embedded.join(","));
if (/url\((?!data:)/.test(katexCss)) throw new Error("KaTeX 样式中仍有外部 url()");

// ---- 4. 页面只需要 measure.json 的一个子集 ----
const pagePanel = (p) => ({ name: p.name, frame: p.frame, hAxis: { slope: p.hAxis.slope, intercept: p.hAxis.intercept, pxPerPpm: p.hAxis.pxPerPpm, atLeft: p.hAxis.atLeft, atRight: p.hAxis.atRight }, cAxis: { slope: p.cAxis.slope, intercept: p.cAxis.intercept, pxPerPpm: p.cAxis.pxPerPpm, atTop: p.cAxis.atTop, atBottom: p.cAxis.atBottom }, peaks: p.peaks.map((q) => ({ px: q.px, py: q.py, dH: q.dH, dC: q.dC, color: q.color })) });
const pageMeasure = {
  image: { width: measure.images.original.width, height: measure.images.original.height },
  panels: measure.images.original.panels.map(pagePanel),
  summary: measure.summary.map((r) => ({ site: r.site, dH: r.dH, dC: r.dC, hsqc: r.hsqc, edited: r.edited })),
  spread: { ...measure.spread, maxCaptureDiffH: measure.images.earlier ? measure.spread.maxCaptureDiffH : null, maxCaptureDiffC: measure.images.earlier ? measure.spread.maxCaptureDiffC : null },
};

// ---- 5. 拼装（一律用函数替换，避免脚本里的 $& 等被当成替换记号）----
const safeJs = (s) => s.replace(/<\/script/gi, "<\\/script");
const put = (marker, value) => { if (!html.includes(marker)) throw new Error("模板缺少占位符 " + marker); html = html.replace(marker, () => value); };
put("/*__KATEX_CSS__*/", katexCss);
put("/*__CSS__*/", read("styles.css"));
put("/*__MEASURE__*/null", JSON.stringify(pageMeasure));
put("/*__MODEL__*/", safeJs(read("model.js")));
put("/*__DATA__*/", safeJs(read("data.js")));
put("/*__APP__*/", safeJs(read("app.js")));
const png = fs.readFileSync(path.join(here, "original.png"));
put("__ORIGINAL_DATA_URI__", "data:image/png;base64," + png.toString("base64"));

// ---- 6. 自查：没有残留占位符，没有会自动加载的外部资源 ----
for (const bad of ["/*__", "{{ev:", "__ORIGINAL_DATA_URI__", "$$"]) if (html.includes(bad)) throw new Error("残留占位符：" + bad);
const auto = html.match(/<(?:img|script|link|iframe|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//gi);
if (auto) throw new Error("存在会自动加载的外部资源：" + auto[0]);
if (/url\(\s*["']?(?:https?:)?\/\//i.test(html)) throw new Error("样式中存在外部 url()");

const out = path.join(here, "..", "index.html");
fs.writeFileSync(out, html);
console.log(`已生成 ${out}`);
console.log(`  大小 ${(fs.statSync(out).size / 1024).toFixed(0)} KB；公式 ${formulaCount} 处；内嵌字体 ${embedded.length} 个；原图 ${(png.length / 1024).toFixed(0)} KB`);
