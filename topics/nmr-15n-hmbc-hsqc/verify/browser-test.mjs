/* =============================================================================
 * 浏览器实测脚本（Playwright + 已安装的 Chromium）
 * 覆盖：术语注释、图形点击、滑块、原图展开、键盘操作、
 *       桌面 + 两种手机宽度、横向溢出、标签重叠、控制台错误
 *
 * 用法：node verify/browser-test.mjs
 * 输出：控制台报告 + verify/browser-report.json + preview.png（整页截图）
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/* playwright-core 安装在托管 Node 工作区中（ESM 不读 NODE_PATH，故按绝对路径解析） */
const PW_CANDIDATES = [
  process.env.PW_CORE_PATH,
  'C:/Users/fujia/.workbuddy-ai/binaries/node/workspace/node_modules/playwright-core/index.js',
  path.resolve(process.cwd(), 'node_modules/playwright-core/index.js'),
].filter(Boolean);
let chromium = null, pwPath = null;
for (const c of PW_CANDIDATES) {
  if (!fs.existsSync(c)) continue;
  const mod = await import(url.pathToFileURL(c).href);
  chromium = mod.chromium || (mod.default && mod.default.chromium) || null;
  if (chromium) { pwPath = c; break; }
}
if (!chromium) {
  console.error('未找到 playwright-core，请先安装：npm i playwright-core');
  process.exit(3);
}
console.log('使用 playwright-core：' + pwPath);

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Users/fujia/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });

const results = [];
let pass = 0, fail = 0;
function check(desc, cond, detail) {
  results.push({ desc, ok: !!cond, detail: detail == null ? '' : String(detail) });
  if (cond) pass++; else fail++;
  console.log('  ' + (cond ? '✓' : '✗') + ' ' + desc + (cond || !detail ? '' : '   → ' + detail));
}
function section(t) { console.log('\n' + t); }

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

/** 页面内通用检查：横向溢出 / 元素超出视口 */
async function layoutProbe(page, tag) {
  return page.evaluate((tag) => {
    const de = document.documentElement;
    const out = {
      tag,
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      innerW: window.innerWidth,
      overflowers: [],
      tinyFonts: [],
    };
    // 横向溢出元素
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
        // 允许被裁剪容器（overflow hidden）或可横向滚动容器内部的元素
        let p = el.parentElement, inClipper = false;
        while (p && p !== document.body) {
          const pcs = getComputedStyle(p);
          if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll' || pcs.overflowX === 'hidden' ||
              pcs.overflow === 'hidden' || pcs.overflow === 'clip') { inClipper = true; break; }
          p = p.parentElement;
        }
        if (!inClipper) out.overflowers.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), right: Math.round(r.right), left: Math.round(r.left) });
      }
    });
    return out;
  }, tag);
}

/** SVG 文本重叠检测 */
async function svgTextOverlap(page, sel) {
  return page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    if (!svg) return { ok: false, reason: 'svg not found' };
    const texts = Array.from(svg.querySelectorAll('text')).filter(t => t.textContent.trim());
    const boxes = texts.map(t => {
      const r = t.getBoundingClientRect();
      return { t: t.textContent.trim(), x: r.left, y: r.top, w: r.width, h: r.height };
    }).filter(b => b.w > 0 && b.h > 0);
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1.5 && oy > 1.5) {
          const area = Math.min(ox * oy / (a.w * a.h), ox * oy / (b.w * b.h));
          if (area > 0.22) hits.push([a.t, b.t, Math.round(ox), Math.round(oy)]);
        }
      }
    }
    return { ok: hits.length === 0, hits, count: boxes.length };
  }, sel);
}

/** 取某条曲线的渲染信息 */
async function peakInfo(page, sel) {
  return page.evaluate((sel) => {
    const g = document.querySelector(sel);
    if (!g) return null;
    const el = g.querySelector('ellipse:not(.ring):not(.hit), line:not(.ring)');
    if (!el) return null;
    if (el.tagName === 'ellipse') return { cx: +el.getAttribute('cx'), cy: +el.getAttribute('cy') };
    return { cx: +el.getAttribute('x1'), cy: (+el.getAttribute('y1') + +el.getAttribute('y2')) / 2 };
  }, sel);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });

  /* ============ 1. 桌面 ============ */
  section('[1] 桌面 1440×900 · 加载与布局');
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctxD.newPage();
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('requestfailed', r => failedRequests.push(r.url().slice(0, 90)));

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  check('页面标题正确', (await page.title()).indexOf('额外核素') >= 0, await page.title());
  check('无控制台错误', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('无未捕获异常', pageErrors.length === 0, pageErrors.join(' | '));
  check('无失败的网络请求', failedRequests.length === 0, failedRequests.join(' | '));

  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.grid3')).gridTemplateColumns);
  check('桌面为三栏布局', cols.trim().split(/\s+/).length === 3, cols);

  const probeD = await layoutProbe(page, 'desktop');
  check('桌面无横向溢出（scrollWidth ≤ clientWidth）', probeD.scrollW <= probeD.clientW + 1,
    'scrollW=' + probeD.scrollW + ' clientW=' + probeD.clientW);
  check('桌面无元素超出视口', probeD.overflowers.length === 0, JSON.stringify(probeD.overflowers.slice(0, 4)));

  // 原图确实渲染
  const imgOK = await page.evaluate(() => {
    const a = document.getElementById('orig-img-hmbc'), b = document.getElementById('orig-img-hsqc');
    return a && b && a.naturalWidth === 1034 && b.naturalWidth === 1043 && a.complete && b.complete;
  });
  check('两张原图成功解码（1034×807 / 1043×704）', imgOK);

  // 示意重绘标注
  check('谱图区标注“示意重绘”', await page.locator('.svg-note').first().isVisible());

  /* ============ 2. 默认对象 ============ */
  section('[2] 默认对象（HMBC）');
  check('默认标题为 HMBC', (await page.locator('#obj-title').textContent()).indexOf('HMBC') >= 0);
  const hmPeaks = await page.locator('#plot .pk').count();
  check('HMBC 图形渲染 9 个交叉峰', hmPeaks === 9, hmPeaks);
  check('HMBC 渲染 3 个原图标注框', (await page.locator('#plot .zone').count()) === 3);
  const ovH = await svgTextOverlap(page, '#plot svg');
  check('HMBC 图形内标签无重叠', ovH.ok, JSON.stringify(ovH.hits));

  /* ============ 3. 点击交叉峰 ============ */
  section('[3] 图形点击');
  await page.locator('#plot .pk[data-peak="B1"]').click();
  await page.waitForTimeout(150);
  const roAfterClick = await page.locator('#readout').textContent();
  check('点击峰 B1 后读数出现 B1', roAfterClick.indexOf('B1') >= 0);
  check('点击峰 B1 后解释同步更新', (await page.locator('#explain').textContent()).indexOf('脂肪链区') >= 0);
  const curAfter = await page.evaluate(() => document.querySelector('#plot .cur-t').textContent);
  check('光标同步到 δH 1.75', curAfter.indexOf('1.75') >= 0, curAfter);

  /* ============ 4. 点击结构氮位点 ============ */
  section('[4] 结构图点击');
  check('结构图渲染 5 个可交互氮位点', (await page.locator('#struct .site').count()) === 5);
  await page.locator('#struct .site[data-site="N-lactam"]').click();
  await page.waitForTimeout(150);
  check('点击羟吲哚 N 后读数显示该位点',
    (await page.locator('#readout').textContent()).indexOf('羟吲哚 N–H') >= 0);
  check('被选位点带高亮类 on',
    (await page.locator('#struct .site[data-site="N-lactam"].on').count()) === 1);

  /* ============ 5. 术语注释 ============ */
  section('[5] 术语注释');
  const termCount = await page.locator('button.term').count();
  check('正文含 ≥14 个术语按钮', termCount >= 14, termCount);
  await page.locator('button.term[data-term="HMBC"]').first().click();
  await page.waitForTimeout(200);
  const popVisible = await page.locator('.pop.on').count();
  check('点击术语后弹出注释', popVisible === 1);
  const popText = await page.locator('.pop.on').textContent();
  check('注释内容为中文解释且含英文对照', popText.indexOf('异核多键相关谱') >= 0 && popText.indexOf('Heteronuclear') >= 0);
  const popBox = await page.locator('.pop.on').boundingBox();
  check('注释框未超出视口右边界', popBox && (popBox.x + popBox.width) <= 1440 + 1, JSON.stringify(popBox));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('Esc 关闭注释', (await page.locator('.pop.on').count()) === 0);

  /* ============ 6. 键盘操作 ============ */
  section('[6] 键盘操作');
  await page.locator('#plot .pk[data-peak="D1"]').focus();
  const focused = await page.evaluate(() => document.activeElement.getAttribute('data-peak'));
  check('峰可通过 Tab/程序聚焦', focused === 'D1', focused);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('Enter 选中峰 D1', (await page.locator('#readout').textContent()).indexOf('D1') >= 0);
  // 滑块键盘
  await page.locator('#h-dh').focus();
  const before = await page.locator('#h-dh').inputValue();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  const after = await page.locator('#h-dh').inputValue();
  check('滑块可用方向键调节', before !== after, before + ' → ' + after);
  // 对象按钮键盘
  await page.locator('.obj-btn[data-obj="hsqc"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check('对象按钮可用 Enter 切换', (await page.locator('#obj-title').textContent()).indexOf('HSQC') >= 0);

  /* ============ 7. HSQC 交互与演示模型 ============ */
  section('[7] HSQC 演示模型（滑块）');
  check('HSQC 渲染 9 个峰', (await page.locator('#plot .pk').count()) === 9);
  const ovQ = await svgTextOverlap(page, '#plot svg');
  check('HSQC 图形内标签无重叠', ovQ.ok, JSON.stringify(ovQ.hits));

  // p=100% 时蓝峰位置
  await page.locator('#q-phos').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(200);
  const blue100 = await peakInfo(page, '#plot .pk[data-peak="pSer3|b"]');
  const blackSer = await peakInfo(page, '#plot .pk[data-peak="Ser3|a"]');
  check('p=100% 时 pSer3 蓝峰与 Ser3 黑峰水平分离 > 100px',
    blue100 && blackSer && (blackSer.cx - blue100.cx) > 100,
    blue100 && blackSer ? 'Δcx=' + (blackSer.cx - blue100.cx).toFixed(1) : 'null');

  // p=0% 时蓝峰与黑峰重合
  await page.locator('#q-phos').evaluate(el => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(200);
  const blue0 = await peakInfo(page, '#plot .pk[data-peak="pSer3|b"]');
  const blackSer0 = await peakInfo(page, '#plot .pk[data-peak="Ser3|a"]');
  check('p=0% 时 pSer3 蓝峰与 Ser3 黑峰重合（|Δcx| < 1px）',
    blue0 && blackSer0 && Math.abs(blackSer0.cx - blue0.cx) < 1,
    blue0 && blackSer0 ? 'Δcx=' + (blackSer0.cx - blue0.cx).toFixed(2) : 'null');

  // 不变量：黑峰不随滑块变化
  const blackBefore = JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll('#plot .pk[data-peak$="|a"]')).map(g => {
      const e = g.querySelector('ellipse:not(.ring):not(.hit)');
      return e.getAttribute('cx') + ',' + e.getAttribute('cy');
    })));
  await page.locator('#q-phos').evaluate(el => { el.value = 55; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(200);
  const blackAfter = JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll('#plot .pk[data-peak$="|a"]')).map(g => {
      const e = g.querySelector('ellipse:not(.ring):not(.hit)');
      return e.getAttribute('cx') + ',' + e.getAttribute('cy');
    })));
  check('不变量：改变磷酸化程度时 (a) 黑峰位置完全不变', blackBefore === blackAfter);
  const ro55 = await page.locator('#readout').textContent();
  check('读数显示磷酸化程度 55%', ro55.indexOf('55') >= 0);

  // 光标滑块
  await page.locator('#q-dh').evaluate(el => { el.value = 8.71; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(150);
  check('HSQC 光标滑块更新读数', (await page.locator('#readout').textContent()).indexOf('8.71') >= 0);

  /* ============ 8. 局部放大与原图展开 ============ */
  section('[8] 局部放大与原图展开');
  const zoomCount = await page.locator('.zoomcard').count();
  check('渲染 7 张局部放大图', zoomCount === 7, zoomCount);
  const zoomGeom = await page.evaluate(() => {
    const v = document.querySelector('.zoomview');
    const img = v.querySelector('img');
    const vr = v.getBoundingClientRect(), ir = img.getBoundingClientRect();
    return { vw: vr.width, vh: vr.height, iw: ir.width, ih: ir.height, l: ir.left - vr.left, t: ir.top - vr.top };
  });
  check('放大图按原像素缩放（图宽 > 视口宽）', zoomGeom.iw > zoomGeom.vw, JSON.stringify(zoomGeom));
  check('放大图定位为负偏移（裁剪左上角外）', zoomGeom.l <= 0 && zoomGeom.t <= 0);

  await page.locator('#orig-img-hmbc').click();
  await page.waitForTimeout(250);
  check('点击原图后灯箱打开', await page.locator('#lightbox.on').isVisible());
  const lbImg = await page.evaluate(() => {
    const i = document.querySelector('#lightbox img');
    return { w: i.naturalWidth, h: i.naturalHeight };
  });
  check('灯箱显示的原图为完整 1034×807', lbImg.w === 1034 && lbImg.h === 807, JSON.stringify(lbImg));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Esc 关闭灯箱', (await page.locator('#lightbox.on').count()) === 0);

  /* ============ 9. 表格与术语表 ============ */
  section('[9] 表格与术语表');
  check('术语表渲染 ≥20 条', (await page.locator('#glossary-list .item').count()) >= 20);
  check('中英对照表渲染 ≥10 行', (await page.locator('#enzh-body tr').count()) >= 10);
  await page.locator('.obj-btn[data-obj="hmbc"]').click();
  await page.waitForTimeout(250);
  const tableRows = await page.locator('#table-main tbody tr').count();
  check('HMBC 归属表渲染 9 行', tableRows === 9, tableRows);
  await page.locator('.obj-btn[data-obj="hsqc"]').click();
  await page.waitForTimeout(250);
  const tableRowsQ = await page.locator('#table-main tbody tr').count();
  check('HSQC 归属表渲染 6 行（残基分组）', tableRowsQ === 6, tableRowsQ);
  await page.locator('.obj-btn[data-obj="hmbc"]').click();
  await page.waitForTimeout(250);
  await page.locator('#plot .pk[data-peak="D2"]').click();
  await page.waitForTimeout(150);
  check('点击峰后归属表对应行高亮', (await page.locator('#table-main tbody tr.on').count()) === 1);
  check('页脚显示验证摘要', (await page.locator('#verify-summary').textContent()).indexOf('项检查') >= 0);

  /* ============ 10. 桌面整页截图 ============ */
  section('[10] 桌面整页截图');
  await page.locator('.obj-btn[data-obj="hmbc"]').click();
  await page.waitForTimeout(300);
  const previewPath = path.join(ROOT, 'preview.png');
  await page.screenshot({ path: previewPath, fullPage: true });
  const sz = fs.statSync(previewPath).size;
  check('preview.png 已生成', sz > 20000, (sz / 1024).toFixed(1) + ' KB');
  const dims = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth }));
  console.log('    · 整页尺寸 ' + dims.w + ' × ' + dims.h + ' px');
  await ctxD.close();

  /* ============ 11. 手机宽度 ============ */
  const mobiles = [
    { name: 'iPhone 12 (390×844)', width: 390, height: 844 },
    { name: '窄屏 (360×740)', width: 360, height: 740 },
    { name: 'iPhone SE (320×568)', width: 320, height: 568 },
  ];
  for (const m of mobiles) {
    section('[11] 手机端 ' + m.name);
    const ctx = await browser.newContext({ viewport: { width: m.width, height: m.height }, deviceScaleFactor: 2 });
    const p2 = await ctx.newPage();
    const errs2 = [];
    p2.on('pageerror', e => errs2.push(String(e)));
    await p2.goto(PAGE_URL, { waitUntil: 'load' });
    await p2.waitForTimeout(400);

    const cols2 = await p2.evaluate(() => getComputedStyle(document.querySelector('.grid3')).gridTemplateColumns);
    check(m.name + '：纵向单列布局', cols2.trim().split(/\s+/).length === 1, cols2);
    const probe = await layoutProbe(p2, m.name);
    check(m.name + '：无横向溢出', probe.scrollW <= probe.clientW + 1,
      'scrollW=' + probe.scrollW + ' clientW=' + probe.clientW);
    check(m.name + '：无元素超出视口', probe.overflowers.length === 0, JSON.stringify(probe.overflowers.slice(0, 3)));
    check(m.name + '：无 JS 异常', errs2.length === 0, errs2.join(' | '));

    const ov = await svgTextOverlap(p2, '#plot svg');
    check(m.name + '：谱图标签无重叠', ov.ok, JSON.stringify(ov.hits));

    // 谱图未被压扁（宽高比保持）
    const svgBox = await p2.evaluate(() => {
      const s = document.querySelector('#plot svg');
      const r = s.getBoundingClientRect();
      const vb = s.viewBox.baseVal;
      return { w: r.width, h: r.height, ar: r.width / r.height, var: vb.width / vb.height };
    });
    check(m.name + '：谱图保持 viewBox 宽高比', Math.abs(svgBox.ar - svgBox.var) < 0.02,
      JSON.stringify(svgBox));

    // 术语注释在手机端不溢出
    await p2.locator('button.term[data-term="磷酸化"]').first().click();
    await p2.waitForTimeout(220);
    const pb = await p2.locator('.pop.on').boundingBox();
    check(m.name + '：术语注释不溢出视口', pb && pb.x >= -1 && (pb.x + pb.width) <= m.width + 1,
      JSON.stringify(pb));
    await p2.keyboard.press('Escape');

    // 结构小图不溢出
    const miniOK = await p2.evaluate((w) => {
      const bad = [];
      document.querySelectorAll('.minifig, .mini').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > w + 1 || r.left < -1) bad.push(el.className + '@' + Math.round(r.left) + '-' + Math.round(r.right));
      });
      return bad;
    }, m.width);
    check(m.name + '：正文结构小图不溢出', miniOK.length === 0, miniOK.join(', '));

    // 滑块在手机端可操作
    await p2.locator('#h-thr').evaluate(el => { el.value = 60; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p2.waitForTimeout(200);
    const visiblePk = await p2.locator('#plot .pk:not(.dim)').count();
    check(m.name + '：阈值滑块生效（60% 时可见峰减少）', visiblePk > 0 && visiblePk < 9, visiblePk);
    await p2.screenshot({ path: path.join(ROOT, 'build', 'mobile-' + m.width + '.png'), fullPage: false });
    await ctx.close();
  }

  await browser.close();

  /* ============ 汇总 ============ */
  console.log('\n' + '='.repeat(64));
  console.log('浏览器实测：' + (pass + fail) + ' 项，通过 ' + pass + '，失败 ' + fail);
  if (fail) results.filter(r => !r.ok).forEach(r => console.log('  ✗ ' + r.desc + (r.detail ? '  → ' + r.detail : '')));
  console.log('='.repeat(64));
  fs.writeFileSync(path.join(HERE, 'browser-report.json'), JSON.stringify({
    total: pass + fail, passed: pass, failed: fail,
    consoleErrors, pageErrors, failedRequests, results,
    time: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
  }, null, 2), 'utf8');
  console.log('报告已写入 verify/browser-report.json');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
