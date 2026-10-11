/* =============================================================================
 * 构建脚本：把 src/ 下的模板、样式、脚本与 assets/ 下的原图
 * 合并为一个可离线打开的自包含 index.html。
 *
 * 用法：node src/build.mjs
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readBin = p => fs.readFileSync(path.join(ROOT, p));

/** 把 data.js 的 ESM 导出改写为普通声明，便于内联为经典脚本 */
function stripExports(src) {
  return src
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+class\s+/gm, 'class ')
    .replace(/^export\s+default\s+/gm, 'var __default__ = ');
}

const dataUri = (p, mime) => 'data:' + mime + ';base64,' + readBin(p).toString('base64');

/** 验证摘要（若 verify/report.json 存在则注入页脚） */
function verifySummary() {
  const f = path.join(ROOT, 'verify', 'report.json');
  if (!fs.existsSync(f)) return '验证结果：<span class="srcbadge src-read">尚未运行验证脚本</span>';
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const cls = r.failed === 0 ? 'src-obs' : 'src-read';
  const parts = [];
  parts.push('共 ' + r.total + ' 项检查，通过 ' + r.passed + ' 项，失败 ' + r.failed + ' 项');
  if (r.groups) {
    Object.keys(r.groups).forEach(g => {
      parts.push(g + ' ' + r.groups[g].passed + '/' + r.groups[g].total);
    });
  }
  return '验证结果：<span class="srcbadge ' + cls + '">' + parts.join(' · ') + '</span>' +
    '<span style="margin-left:8px;color:var(--text-mute)">（由 verify/verify.mjs 自动生成，运行时间 ' +
    r.time + '）</span>';
}

function build() {
  let html = read('src/template.html');
  const css = read('src/styles.css');
  const data = stripExports(read('src/data.js'));
  const app = read('src/app.js');

  html = html.replace('{{CSS}}', () => css);
  html = html.replace('{{DATA}}', () => '/* ===== data.js（由 build.mjs 内联） ===== */\n' + data);
  html = html.replace('{{APP}}', () => '/* ===== app.js（由 build.mjs 内联） ===== */\n' + app);
  html = html.replace('{{IMG_HMBC}}', () => dataUri('assets/original-hmbc.png', 'image/png'));
  html = html.replace('{{IMG_HSQC}}', () => dataUri('assets/original-hsqc.png', 'image/png'));

  // 页脚验证摘要
  html = html.replace(
    /<p id="verify-summary"[^>]*>[\s\S]*?<\/p>/,
    '<p id="verify-summary" style="margin:0">' + verifySummary() + '</p>'
  );

  const out = path.join(ROOT, 'index.html');
  fs.writeFileSync(out, html, 'utf8');

  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log('✓ 已生成 ' + path.relative(ROOT, out) + '  (' + kb + ' KB)');
  console.log('  · 内联样式 ' + (css.length / 1024).toFixed(1) + ' KB');
  console.log('  · 内联脚本 ' + ((data.length + app.length) / 1024).toFixed(1) + ' KB');
  console.log('  · 内嵌原图 2 张（base64 PNG）');
}

build();
