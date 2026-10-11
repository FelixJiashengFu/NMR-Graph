
/* _build.js —— 组装单文件离线页面（Node 版）
   关键教训：katex.min.js 源码里本身就含字面量 "<!--KATEX_JS-->"（4 处，出现在它的报错格式化代码里）。
   所以内联之后绝不能再对整篇文档做 replace()，否则会命中库内部的字符串并把文档拼接错乱。
   这里改成显式拼接：head + <script>lib</script> + <script>页身</script> + tail。 */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const DIST = path.join(HERE, 'vendor');
const NAME = path.join('..', 'index.html');
const PARTS = ['_page_part2.js', '_page_part3.js', '_page_part4.js',
               '_page_part5a.js', '_page_part5b.js', '_page_part5c.js', '_page_part6.js'];
const SO = '<' + 'script>', SC = '<' + '/script>', STY = '<' + 'style>', STYC = '<' + '/style>';
const NL = String.fromCharCode(10);
const rd = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(HERE, p), 'utf8');
const count = (h, n) => h.split(n).length - 1;

const tpl = rd('_template_head.html');
for (const ph of ['<!--KATEX_CSS-->', '<!--KATEX_JS-->', '<!--KERNEL-->']) {
  const n = count(tpl, ph);
  if (n !== 1) throw new Error('模板占位符 ' + ph + ' 出现 ' + n + ' 次（应为 1）');
}
console.log('[1] 模板占位符各 1 个');

const kernel = rd('_kernel.js');
let body = '';
for (const p of PARTS) body += rd(p) + NL;
// 硬判据：页身脚本里出现 "</" 会让 HTML 解析器提前结束 <script> 块（踩过一次，页面直接瘫痪）
for (const p of PARTS.concat(['_kernel.js'])) {
  const txt = rd(p);
  if (txt.indexOf('</') >= 0) throw new Error(p + ' 里含 "</"，必须写成 "<" + "/"：' + txt.slice(txt.indexOf('</') - 40, txt.indexOf('</') + 20));
}
if (kernel.indexOf('</') >= 0) throw new Error('内核里含 "</"');
console.log('[2] 内核 ' + kernel.length + ' 字符，页身 ' + body.length + ' 字符');

const PH_CSS = '<!--KATEX_CSS-->', PH_JS = '<!--KATEX_JS-->', PH_K = '<!--KERNEL-->';
const iCss = tpl.indexOf(PH_CSS), iJs = tpl.indexOf(PH_JS), iK = tpl.indexOf(PH_K);
if (!(iCss < iJs && iK < iJs)) throw new Error('占位符顺序异常');

// 先把模板切成几段（此后再不做全局 replace）
const head = tpl.slice(0, iCss);                       // ... <head> ... 直到 CSS 占位符
const between = tpl.slice(iCss + PH_CSS.length, iK);   // CSS 与内核之间
const between2 = tpl.slice(iK + PH_K.length, iJs);     // 内核占位符与 JS 占位符之间
const tail = tpl.slice(iJs + PH_JS.length);            // 占位符之后的收尾（</body></html>）

const cssRaw = rd(path.join(DIST, 'katex.min.css'));
let fontCount = 0;
const css = cssRaw
  .replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g, '')
  .replace(/url\(fonts\/([^)/]+\.woff2)\)/g, (_, name) => {
    fontCount++;
    const font = fs.readFileSync(path.join(DIST, 'fonts', name));
    return 'url(data:font/woff2;base64,' + font.toString('base64') + ')';
  });
if (fontCount !== 20) throw new Error('预期 20 个内嵌字体，实际 ' + fontCount);
const js = rd(path.join(DIST, 'katex.min.js'));
if (js.length < 200000) throw new Error('katex.min.js 只有 ' + js.length + ' 字符，可疑');
if (js.indexOf('=' + SC) >= 0 || js.indexOf(SO) >= 0) throw new Error('katex.min.js 里含 script 标签，内联会截断文档');
console.log('[3] katex.min.js 长度 ' + js.length + '，其中含字面量 KATEX_JS 占位符 ' + count(js, PH_JS) + ' 处（库自身的字符串，必须避开）');

const out = head
  + STY + NL + css + NL + STYC
  + between
  + kernel
  + between2
  + SO + NL + js + NL + SC     // KaTeX 库
  + NL + SO + NL + body + NL + SC   // 页身
  + tail;

const sig = js.slice(0, 60);
if (out.indexOf(sig) < 0) throw new Error('KaTeX 库没有被真正内联进去');
if (count(out, 'id="kernel"') !== 1) throw new Error('内核脚本块应恰好 1 个');
const ext = (out.match(/(?:src|href)\s*=\s*"[^"]*"/g) || []).filter(u => /https?:|\/\//.test(u));
if (ext.length) throw new Error('存在外部加载: ' + ext.join(', '));
const so = (out.match(/<script/g) || []).length, sc = (out.match(/<\/script>/g) || []).length;
if (so !== sc) throw new Error('script 标签不配对: ' + so + ' vs ' + sc);
const sty = (out.match(/<style/g) || []).length, styc = (out.match(/<\/style>/g) || []).length;
if (sty !== styc) throw new Error('style 标签不配对: ' + sty + ' vs ' + styc);
for (const ph of [PH_CSS, PH_K]) if (out.indexOf(ph) >= 0) throw new Error('残留占位符 ' + ph);
console.log('[4] 内联成功；零外部加载；标签配对（script ' + so + '/' + sc + '，style ' + sty + '/' + styc + '）');

const dst = path.join(HERE, NAME);
fs.writeFileSync(dst, out, 'utf8');
console.log('[5] 写出 ' + NAME + '：' + out.length + ' 字符 / ' + fs.statSync(dst).size + ' 字节');
