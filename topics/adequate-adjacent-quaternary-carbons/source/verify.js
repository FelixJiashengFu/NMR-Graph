/**
 * 验证脚本：在真实 Chromium 中测试 ADEQUATE 教学页的主要交互
 * 用法：
 *   NODE_PATH=<workspace>/node_modules node verify.js
 * 覆盖：加载错误、术语注释、图形点击、滑块、原图展开/放大镜、
 *       键盘操作、三种视口宽度、横向溢出、公式与标签、截图
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const pass = [], fail = [], info = [];
const ok  = (n, c, extra) => (c ? pass : fail).push(n + (extra ? ' — ' + extra : ''));
const log = (n, v) => info.push(n + ': ' + v);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--allow-file-access-from-files', '--disable-dev-shm-usage', '--no-sandbox']
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url().slice(0, 80)));

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForSelector('#molsvg .atomhit', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 400));

  /* ---------- T1 加载与结构 ---------- */
  ok('T1 页面加载无 JS 错误', errors.length === 0, errors.join(' | ') || '无');
  const ids = ['#molsvg','#netsvg','#barsvg','#objlist','#readout','#countBody',
               '#assignBody','#glossList','#regions','#origfull','#zoomer','#termcard',
               '#gAtoms','#gNetEdges','#gBars','#fgrow'];
  const missing = await page.$$eval(ids.map(i => i).join(','), () => []).catch(() => null);
  for (const id of ids) {
    const found = await page.$(id);
    if (!found) fail.push('T1 缺少元素 ' + id);
  }
  ok('T1 关键容器齐全', !fail.some(f => f.startsWith('T1 缺少')));

  // 原子数量
  const atomCount = await page.$$eval('#gAtoms .atomhit', els => els.length);
  ok('T1 分子图原子可点击节点数 = 20', atomCount === 20, '实际 ' + atomCount);

  // 原图加载成功（base64 内嵌）
  const imgOk = await page.$eval('#origfull', el => el.complete && el.naturalWidth > 0);
  ok('T1 内嵌原图成功解码', imgOk, imgOk ? '' : 'naturalWidth=0');
  const zoomSrc = await page.$eval('#zoomer', el => el.src.startsWith('data:image/png;base64,') && el.naturalWidth > 0);
  ok('T1 放大镜图片已挂载', zoomSrc);

  /* ---------- T2 术语注释 ---------- */
  const termCount = await page.$$eval('.term', els => els.length);
  ok('T2 正文术语按钮数量 ≥ 8', termCount >= 8, '实际 ' + termCount);

  await page.click('.term');
  await new Promise(r => setTimeout(r, 200));
  let cardVis = await page.$eval('#termcard', el => !el.hidden && el.offsetHeight > 0);
  let cardTitle = await page.$eval('#termcardTitle', el => el.textContent.trim());
  ok('T2 点击术语弹出注释卡', cardVis && cardTitle.length > 0, '标题「' + cardTitle + '」');

  // 卡片在视口内（不溢出）
  const inView = await page.$eval('#termcard', el => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  });
  ok('T2 注释卡不超出视口', inView);

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));
  const closed = await page.$eval('#termcard', el => el.hidden);
  ok('T2 Esc 可关闭注释卡', closed);

  // 键盘打开术语（focus + Enter）
  await page.$eval('.term', el => el.focus());
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 200));
  const kbOpen = await page.$eval('#termcard', el => !el.hidden);
  ok('T2 键盘 Enter 可打开注释卡', kbOpen);
  const focusInCard = await page.evaluate(() =>
    document.activeElement && document.activeElement.id === 'termClose');
  ok('T2 打开后焦点进入卡片（键盘可达）', focusInCard);
  await page.keyboard.press('Escape');

  /* ---------- T3 分子图点击 ---------- */
  // 先切到带氢碳建立基线（Q1 是默认选中项，直接点击不会产生读数变化）
  await page.click('#gAtoms .atomhit[data-id="a3"]');
  await new Promise(r => setTimeout(r, 200));
  const readBefore = await page.$eval('#readout', el => el.textContent);
  await page.click('#gAtoms .atomhit[data-id="Q1"]');
  await new Promise(r => setTimeout(r, 200));
  const readQ1 = await page.$eval('#readout', el => el.textContent);
  ok('T3 点击季碳 Q1 更新读数', readQ1 !== readBefore && readQ1.includes('季碳'));
  ok('T3 Q1 判定为“部分失效”', readQ1.includes('部分失效'), readQ1.slice(0, 60).replace(/\s+/g, ' '));

  await page.click('#gAtoms .atomhit[data-id="a3"]');
  await new Promise(r => setTimeout(r, 200));
  const readA3 = await page.$eval('#readout', el => el.textContent);
  ok('T3 点击带氢碳 a3 判定为“可关联”', readA3.includes('可关联'));
  ok('T3 不同原子读数不同', readA3 !== readQ1);

  // 左侧列表按钮同步
  const pressed = await page.$$eval('.objlist .btn[aria-pressed="true"]', els => els.map(e => e.dataset.id));
  ok('T3 左侧列表 aria-pressed 同步', pressed.includes('a3'), JSON.stringify(pressed));

  // 杂原子
  await page.click('#gAtoms .atomhit[data-id="S"]');
  await new Promise(r => setTimeout(r, 200));
  const readS = await page.$eval('#readout', el => el.textContent);
  ok('T3 点击硫 S 判定为“不适用”', readS.includes('不适用'));

  /* ---------- T4 复选框显示选项 ---------- */
  const barsSnapshot = () => page.$eval('#gBars', el => el.innerHTML.length);
  await page.click('#optPair'); await new Promise(r => setTimeout(r, 150));
  const annCount = await page.$$eval('#gAnn circle', els => els.length);
  ok('T4 勾选“圈出相邻季碳对”出现标记', annCount >= 2, '标记数 ' + annCount);
  await page.click('#optQ'); await new Promise(r => setTimeout(r, 150));
  const qHalo = await page.$$eval('#gAtoms circle[stroke-dasharray="3 2"]',
    els => els.filter(e => getComputedStyle(e).display !== 'none').length);
  ok('T4 勾选“高亮全部季碳”出现可见高亮环 = 4', qHalo === 4, '可见环数 ' + qHalo);
  await page.click('#optPair'); await page.click('#optQ');

  // 对称性合并 → 归属表行数变化
  const rowsBefore = await page.$$eval('#assignBody tr', els => els.length);
  await page.click('#optSym'); await new Promise(r => setTimeout(r, 250));
  const rowsAfter = await page.$$eval('#assignBody tr', els => els.length);
  ok('T4 对称性合并改变归属表行数', rowsAfter < rowsBefore, rowsBefore + ' → ' + rowsAfter);
  await page.click('#optSym'); await new Promise(r => setTimeout(r, 200));

  /* ---------- T5 滑块 ---------- */
  const setRange = async (id, v) => {
    await page.$eval(id, (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await new Promise(r => setTimeout(r, 180));
  };

  const barW = () => page.$$eval('#gBars rect', els => els.map(e => +e.getAttribute('width')).reduce((a, b) => a + b, 0));
  await setRange('#sJ', 30); const w30 = await barW(); const vJ30 = await page.$eval('#vJ', e => e.textContent);
  await setRange('#sJ', 80); const w80 = await barW(); const vJ80 = await page.$eval('#vJ', e => e.textContent);
  ok('T5 ¹J_CC 滑块改变示意强度图', w30 !== w80, '总宽 ' + w30.toFixed(0) + ' → ' + w80.toFixed(0));
  ok('T5 ¹J_CC 滑块数值带单位 Hz', /Hz$/.test(vJ30) && /Hz$/.test(vJ80), vJ30 + ' / ' + vJ80);

  // 不变性：季碳-季碳强度恒为 0
  const qqZero = await page.evaluate(() => {
    const out = [];
    for (const v of [30, 55, 80]) {
      const el = document.querySelector('#sJ');
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
      const txt = document.querySelector('#gBars').textContent;
      out.push(/0 —— 原理性缺失/.test(txt));
    }
    return out;
  });
  ok('T5 不变性：季碳—季碳强度恒为 0', qqZero.every(Boolean), JSON.stringify(qqZero));

  // 计数不随滑块变化
  const countsBefore = await page.$eval('#countBody', e => e.textContent);
  await setRange('#sJ', 33); await setRange('#sW', 5); await setRange('#sLR', 30);
  const countsAfter = await page.$eval('#countBody', e => e.textContent);
  ok('T5 不变性：计数表不随演示参数改变', countsBefore === countsAfter);

  // 远程耦合 → 网络图出现黄色虚线（基线取 0%）
  await setRange('#sLR', 0);
  const dashedBefore = await page.$$eval('#gNetEdges line', els => els.filter(e => e.getAttribute('stroke') === '#e3b341').length);
  await setRange('#sLR', 40);
  const dashedAfter = await page.$$eval('#gNetEdges line', els => els.filter(e => e.getAttribute('stroke') === '#e3b341').length);
  ok('T5 远程耦合滑块产生伪相关虚线', dashedAfter > dashedBefore, dashedBefore + ' → ' + dashedAfter);
  await setRange('#sLR', 0);

  // 峰宽滑块
  await setRange('#sW', 0.5); const vW = await page.$eval('#vW', e => e.textContent);
  ok('T5 峰宽滑块数值带单位 Hz', /Hz$/.test(vW), vW);
  await setRange('#sW', 2); await setRange('#sJ', 55);

  /* ---------- T6 原图展开与放大镜 ---------- */
  const detailsCount = await page.$$eval('#regions details', els => els.length);
  ok('T6 原图分区可展开数量 ≥ 6', detailsCount >= 6, '实际 ' + detailsCount);

  await page.click('#regions details:first-child summary');
  await new Promise(r => setTimeout(r, 300));
  const dOpen = await page.$eval('#regions details:first-child', el => el.open);
  ok('T6 分区可展开（details open）', dOpen);
  const regionImgOk = await page.$eval('#regions details:first-child img',
    el => el.complete && el.naturalWidth > 0);
  ok('T6 分区内原图正常显示', regionImgOk);

  // 分区裁剪参数有效性：必须放大(>=100%)且向左上偏移(<=0)，否则会露出空白
  const crop = await page.$$eval('#regions details img', els => els.map(e => ({
    w: parseFloat(e.style.width), l: parseFloat(e.style.left), t: parseFloat(e.style.top)
  })));
  const cropOk = crop.length >= 7 && crop.every(c =>
    isFinite(c.w) && c.w >= 100 && isFinite(c.l) && c.l <= 0.01 && isFinite(c.t) && c.t <= 0.01);
  ok('T6 分区裁剪参数有效（放大且向左上偏移）', cropOk,
     '分区数=' + crop.length + ' 首项 w=' + crop[0].w.toFixed(0) + '% l=' + crop[0].l.toFixed(0) + '% t=' + crop[0].t.toFixed(0) + '%');

  // 放大镜倍率
  const zBefore = await page.$eval('#zoomer', el => el.style.width);
  await page.click('#z40'); await new Promise(r => setTimeout(r, 200));
  const zAfter = await page.$eval('#zoomer', el => el.style.width);
  ok('T6 放大镜切换倍率生效', zBefore !== zAfter, zBefore + ' → ' + zAfter);
  const pressed40 = await page.$eval('#z40', el => el.getAttribute('aria-pressed'));
  ok('T6 倍率按钮 aria-pressed 正确', pressed40 === 'true');
  await page.click('#zReset'); await new Promise(r => setTimeout(r, 200));

  // 放大镜平移
  const tfBefore = await page.$eval('#zoomer', el => el.style.transform);
  await page.click('#zR'); await new Promise(r => setTimeout(r, 150));
  const tfAfter = await page.$eval('#zoomer', el => el.style.transform);
  ok('T6 放大镜平移生效', tfBefore !== tfAfter, tfBefore + ' → ' + tfAfter);
  await page.click('#zReset');

  /* ---------- T7 键盘操作 ---------- */
  await page.$eval('#gAtoms .atomhit[data-id="Q1"]', el => el.focus());
  const kBefore = await page.$eval('#readout', el => el.textContent.slice(0, 40));
  await page.keyboard.press('ArrowRight');
  await new Promise(r => setTimeout(r, 200));
  const kAfter = await page.$eval('#readout', el => el.textContent.slice(0, 40));
  ok('T7 方向键切换选中原子', kBefore !== kAfter);

  // Tab 可达性：术语 / 原子 / 滑块 / 按钮
  const focusables = await page.evaluate(() =>
    document.querySelectorAll('a[href],button,input,[tabindex]:not([tabindex="-1"])').length);
  ok('T7 存在可聚焦控件 ≥ 30', focusables >= 30, '实际 ' + focusables);

  // 滑块键盘
  await page.$eval('#sJ', el => el.focus());
  await page.keyboard.press('ArrowRight');
  await new Promise(r => setTimeout(r, 150));
  const jAfterKey = await page.$eval('#sJ', el => el.value);
  ok('T7 滑块支持方向键微调', jAfterKey !== '55', '值 ' + jAfterKey);
  await setRange('#sJ', 55);

  /* ---------- T8 公式与标签 ---------- */
  const supsub = await page.$$eval('sup,sub', els => els.length);
  ok('T8 公式上下标（sup/sub）已渲染', supsub >= 10, '数量 ' + supsub);
  const svgTexts = await page.$$eval('#molsvg text', els => els.length);
  ok('T8 分子图有文字标签', svgTexts >= 10, '数量 ' + svgTexts);

  // SVG 文本不超出各自 viewBox
  const svgOverflow = await page.evaluate(() => {
    const bad = [];
    ['molsvg','netsvg','barsvg'].forEach(id => {
      const svg = document.getElementById(id);
      const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      svg.querySelectorAll('text').forEach(t => {
        const x = +t.getAttribute('x'), y = +t.getAttribute('y');
        if (x < vb[0] - 2 || x > vb[0] + vb[2] + 2 || y < vb[1] - 2 || y > vb[1] + vb[3] + 2)
          bad.push(id + ':' + t.textContent.slice(0, 10) + '@' + x + ',' + y);
      });
    });
    return bad;
  });
  ok('T8 SVG 标签未超出画布', svgOverflow.length === 0, svgOverflow.slice(0, 3).join('; '));

  /* ---------- T9 响应式与溢出 ---------- */
  const viewports = [
    { name: '桌面 1440', w: 1440, h: 900 },
    { name: '手机 390',  w: 390,  h: 844 },
    { name: '手机 360',  w: 360,  h: 780 }
  ];
  for (const vp of viewports) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await new Promise(r => setTimeout(r, 400));
    const ov = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth
    }));
    ok('T9 ' + vp.name + ' 无页面横向溢出', ov.sw <= ov.iw + 1, 'scrollWidth=' + ov.sw + ' innerWidth=' + ov.iw);

    // 检查是否有元素right超出视口（排除可横向滚动容器内的元素）
    const bleeders = await page.evaluate(() => {
      const out = [];
      const w = window.innerWidth;
      document.querySelectorAll('section.blk, .panel, h1, .goal, .mustread, p, li, dl.gloss > div, .fg').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > w + 1 || r.left < -1)) {
          // 若祖先是可横向滚动容器则允许
          let p = el.parentElement, scrollable = false;
          while (p && p !== document.body) {
            const st = getComputedStyle(p);
            if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) { scrollable = true; break; }
            p = p.parentElement;
          }
          if (!scrollable) out.push((el.tagName + '.' + (el.className || '')).slice(0, 45) + ' right=' + Math.round(r.right));
        }
      });
      return out;
    });
    ok('T9 ' + vp.name + ' 无元素越界', bleeders.length === 0, bleeders.slice(0, 2).join(' | '));

    // 分子图容器在窄屏可横向滚动查看（不裁切）
    const stageScroll = await page.$eval('#molsvg', el => {
      const st = el.closest('.stage');
      return { ovx: getComputedStyle(st).overflowX, canScroll: st.scrollWidth > st.clientWidth };
    });
    if (vp.w < 760) {
      ok('T9 ' + vp.name + ' 分子图可滚动查看（非裁切）',
         stageScroll.ovx === 'auto' || stageScroll.ovx === 'scroll', 'overflowX=' + stageScroll.ovx);
    }
  }

  /* ---------- T10 手机端术语卡不溢出 ---------- */
  await page.setViewport({ width: 360, height: 780 });
  await new Promise(r => setTimeout(r, 300));
  await page.$eval('.term', el => el.focus());
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 300));
  const cardFit = await page.$eval('#termcard', el => {
    const r = el.getBoundingClientRect();
    return { f: r.left >= 0 && r.right <= window.innerWidth + 1, l: Math.round(r.left), rr: Math.round(r.right) };
  });
  ok('T10 手机端术语卡不横向溢出', cardFit.f, 'left=' + cardFit.l + ' right=' + cardFit.rr);
  await page.keyboard.press('Escape');

  /* ---------- T11 重叠检测：SVG 文字标签 ---------- */
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 300));
  const svgOverlap = await page.evaluate(() => {
    const out = [];
    ['molsvg', 'netsvg', 'barsvg'].forEach(id => {
      const texts = [...document.querySelectorAll('#' + id + ' text')]
        .filter(t => getComputedStyle(t).display !== 'none')
        .map(t => ({ s: t.textContent.trim(), r: t.getBoundingClientRect() }))
        .filter(o => o.r.width > 0 && o.r.height > 0);
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i].r, b = texts[j].r;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0 && oy > 0) {
            const inter = ox * oy;
            const small = Math.min(a.width * a.height, b.width * b.height);
            if (small > 0 && inter / small > 0.30)
              out.push(id + ': 「' + texts[i].s + '」×「' + texts[j].s + '」 ' + Math.round(inter / small * 100) + '%');
          }
        }
      }
    });
    return out;
  });
  ok('T11 SVG 文字标签互不重叠', svgOverlap.length === 0, svgOverlap.slice(0, 3).join(' | '));

  /* ---------- T12 重叠检测：正文元素（桌面 + 手机） ---------- */
  for (const vp of [{ n: '桌面 1440', w: 1440, h: 900 }, { n: '手机 390', w: 390, h: 844 }, { n: '手机 360', w: 360, h: 780 }]) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await new Promise(r => setTimeout(r, 350));
    const bodyOverlap = await page.evaluate(() => {
      const sel = 'section.blk p, section.blk li, .readout dd, .readout dt, dl.gloss dt, dl.gloss dd, .kv .v, .mustread li';
      const visible = e => {
        const d = e.closest('details');
        if (d && !d.open) return false;               // 折叠分区内的内容不计
        if (typeof e.checkVisibility === 'function') {
          try {
            return e.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true });
          } catch (_) { /* 回退 */ }
        }
        return e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
      };
      const els = [...document.querySelectorAll(sel)]
        .filter(visible)
        .map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(o => o.r.width > 0 && o.r.height > 0);
      const out = [];
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const A = els[i], B = els[j];
          if (A.e.parentElement === B.e.parentElement) continue;   // 同容器内兄弟不比较
          if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
          const a = A.r, b = B.r;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) {
            const inter = ox * oy;
            const small = Math.min(a.width * a.height, b.width * b.height);
            if (small > 0 && inter / small > 0.25)
              out.push((A.e.textContent || '').slice(0, 14) + ' × ' + (B.e.textContent || '').slice(0, 14));
          }
        }
      }
      return out;
    });
    ok('T12 ' + vp.n + ' 正文元素无实质性重叠', bodyOverlap.length === 0, bodyOverlap.slice(0, 2).join(' | '));
  }

  /* ---------- T13 桌面三栏顺序 ---------- */
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 300));
  const colsOrder = await page.evaluate(() => {
    const c = document.querySelector('.p-ctrl').getBoundingClientRect();
    const m = document.querySelector('.p-main').getBoundingClientRect();
    const r = document.querySelector('.p-read').getBoundingClientRect();
    return { c: Math.round(c.left), m: Math.round(m.left), r: Math.round(r.left),
             sameRow: Math.abs(c.top - m.top) < 5 && Math.abs(m.top - r.top) < 5 };
  });
  ok('T13 桌面三栏左→中→右且同一行', colsOrder.c < colsOrder.m && colsOrder.m < colsOrder.r && colsOrder.sameRow,
     JSON.stringify(colsOrder));

  /* ---------- 截图 ---------- */
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, '..', 'preview.png'), fullPage: true });
  log('桌面整页截图', 'preview.png');

  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, '..', 'preview-mobile.png'), fullPage: true });
  log('手机整页截图', 'preview-mobile.png');

  /* ---------- 汇总 ---------- */
  console.log('\n===== 通过 (' + pass.length + ') =====');
  pass.forEach(p => console.log('  PASS  ' + p));
  if (fail.length) {
    console.log('\n===== 失败 (' + fail.length + ') =====');
    fail.forEach(f => console.log('  FAIL  ' + f));
  }
  if (info.length) { console.log('\n===== 信息 ====='); info.forEach(i => console.log('  ' + i)); }
  console.log('\n结果：' + pass.length + ' 通过 / ' + fail.length + ' 失败');

  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('脚本异常:', e); process.exit(2); });
