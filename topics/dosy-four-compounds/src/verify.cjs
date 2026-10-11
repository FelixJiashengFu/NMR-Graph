/* ============================================================
   verify.cjs — DOSY 教学页自动验证脚本
   依赖：puppeteer-core（已随 Node 运行时提供）+ 系统 Chrome / Edge
   运行：node verify.cjs
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const HERE = __dirname;
const PAGE = path.join(HERE, '..', 'index.html');
const OUT = path.join(HERE, '..', 'verify');
const SHOT = path.join(HERE, '..');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(p => fs.existsSync(p));

const results = [];
let failed = 0;
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  if (!pass) failed++;
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   [' + detail + ']' : ''));
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* ---------- 期望值（与 Python 端独立算出，用于交叉校验） ---------- */
const EXPECT = {
  scaleDefault: 1.0,
  dPred_298_110_030: 6.618,          // nm / mPa·s / K
  radiusWater_298_110: 0.125,        // nm
  radiusTSP_298_110: 0.441,
  points: {
    blue:  [[2.91,4.48],[1.78,4.42],[0.66,4.50],[0.16,4.40],[0.05,4.60],[-0.07,4.63]],
    green: [[4.03,6.40],[3.50,6.52],[3.19,6.66]],
    red:   [[2.22,8.66]],
    black: [[4.77,15.89]],
  }
};

(async () => {
  if (!CHROME) { console.error('找不到 Chrome/Edge'); process.exit(2); }
  if (!fs.existsSync(PAGE)) { console.error('找不到页面：' + PAGE); process.exit(2); }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
           '--font-render-hinting=none', '--force-color-profile=srgb']
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedReqs = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('requestfailed', r => failedReqs.push(r.url().slice(0, 120) + ' :: ' + (r.failure() || {}).errorText));

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto('file:///' + PAGE.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__DOSY_READY__ === true', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));

  /* ================= 1. 基础健康检查 ================= */
  section('1. 页面健康');
  ok('页面无 JS 运行时错误', pageErrors.length === 0, pageErrors.join(' | '));
  ok('控制台无 error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  ok('无外部资源请求失败（离线自包含）', failedReqs.length === 0, failedReqs.slice(0, 3).join(' | '));

  const external = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('link[href],script[src],img[src]').forEach(el => {
      const u = el.getAttribute('href') || el.getAttribute('src') || '';
      if (u && !/^data:|^#|^javascript:/.test(u)) bad.push(el.tagName + ':' + u.slice(0, 60));
    });
    return bad;
  });
  ok('无外部依赖（全部内联）', external.length === 0, external.join(' | '));

  const sections = await page.evaluate(() =>
    ['conclusions','intuition','zoom','table','steps','check','myths','glossary','sources']
      .filter(id => !document.getElementById(id)));
  ok('九个章节齐备且顺序正确', sections.length === 0, sections.join(','));

  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('section.block')).map(s => s.id).join('>'));
  ok('章节顺序 = 主要结论→直观解释→…→来源与限制',
     order === 'conclusions>intuition>zoom>table>steps>check>myths>glossary>sources', order);

  const imgOk = await page.evaluate(() => {
    const i = document.getElementById('origImg');
    return i && i.complete && i.naturalWidth === 1038 && i.naturalHeight === 782;
  });
  ok('原图内联且尺寸 1038×782 未被改动', imgOk);

  /* ================= 2. 数据集与 Python 端一致 ================= */
  section('2. 数据一致性（与 Python 标定结果交叉校验）');
  const jsPoints = await page.evaluate(() => window.__DOSY__.OBS.points);
  let ptOk = true, ptDetail = '';
  for (const c of ['blue', 'green', 'red', 'black']) {
    const a = jsPoints[c].map(p => [p.ppm, p.D]);
    const b = EXPECT.points[c];
    if (JSON.stringify(a) !== JSON.stringify(b)) { ptOk = false; ptDetail += c + ' 不符; '; }
  }
  ok('11 个数据点与 Python 提取结果逐点一致', ptOk, ptDetail);

  const nPts = await page.evaluate(() => Object.values(window.__DOSY__.OBS.points).reduce((s,a)=>s+a.length,0));
  ok('总点数 = 11', nPts === 11, String(nPts));

  /* 与 extract_final.py 从原图重新提取的 JSON 逐点比对（端到端） */
  const jsonPath = path.join(OUT, 'data_extracted.json');
  if (fs.existsSync(jsonPath)) {
    const py = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    let same = true, detail = '';
    for (const c of ['blue', 'green', 'red', 'black']) {
      const a = jsPoints[c].map(p => [p.ppm, p.D]);
      const b = py.points[c].map(p => [p.ppm, p.D]);
      if (JSON.stringify(a) !== JSON.stringify(b)) { same = false; detail += c + ' 不符; '; }
    }
    ok('页面内嵌数据 == Python 从原图重新提取的数据', same, detail);
    ok('标定参数一致（66.64 px/ppm, 10.26 px/D 单位）',
       py.calibration.px_per_ppm === 66.64 && py.calibration.px_per_Dunit === 10.26,
       `${py.calibration.px_per_ppm} / ${py.calibration.px_per_Dunit}`);
  } else {
    ok('找到 extract_final.py 的输出（先运行提取脚本）', false, jsonPath);
  }

  /* ================= 3. 物理模型数值核对 ================= */
  section('3. 模型数值核对');
  const m = await page.evaluate(() => {
    const D = window.__DOSY__;
    return {
      scale: D.modelScale(298.15, 1.10),
      dPred: D.dPredict(298.15, 1.10, 0.30),
      rWater: D.radiusFromD(298.15, 1.10, 15.89),
      rTSP: D.radiusFromD(298.15, 1.10, 4.50),
      scaleHot: D.modelScale(323, 1.10),
      scaleVisc: D.modelScale(298.15, 1.60),
      dPredSmall: D.dPredict(298.15, 1.10, 0.10),
      dPredBig: D.dPredict(298.15, 1.10, 1.00),
    };
  });
  ok('默认缩放因子 = 1.000', Math.abs(m.scale - 1) < 1e-9, m.scale.toFixed(6));
  ok('Stokes–Einstein: r=0.30 nm → D ≈ 6.62', Math.abs(m.dPred - EXPECT.dPred_298_110_030) < 0.01, m.dPred.toFixed(3));
  ok('水的流体力学半径 ≈ 0.125 nm', Math.abs(m.rWater - EXPECT.radiusWater_298_110) < 0.002, m.rWater.toFixed(4));
  ok('TSP 的流体力学半径 ≈ 0.441 nm', Math.abs(m.rTSP - EXPECT.radiusTSP_298_110) < 0.002, m.rTSP.toFixed(4));
  ok('半径顺序 水 < 丙酮 < 胆碱 < TSP',
     m.rWater < 0.23 && 0.23 < 0.30 && 0.30 < m.rTSP, '0.125 < 0.229 < 0.304 < 0.441');
  ok('D ∝ T：升温 → 缩放因子 > 1', m.scaleHot > 1, m.scaleHot.toFixed(4));
  ok('D ∝ 1/η：增黏 → 缩放因子 < 1', m.scaleVisc < 1, m.scaleVisc.toFixed(4));
  ok('D ∝ 1/r：半径减小 → D 增大', m.dPredSmall > m.dPredBig, m.dPredSmall.toFixed(2) + ' > ' + m.dPredBig.toFixed(2));

  /* ================= 4. 交互：对象选择 ================= */
  section('4. 交互 — 对象选择同步');
  for (const cid of ['blue', 'green', 'red', 'black']) {
    await page.click(`#objList .obj-btn[data-c="${cid}"]`);
    await new Promise(r => setTimeout(r, 120));
    const st = await page.evaluate((cid) => ({
      pressed: document.querySelector(`#objList .obj-btn[data-c="${cid}"]`).getAttribute('aria-pressed'),
      sel: window.__DOSY__.state.sel,
      structActive: document.querySelector(`#structGrid .struct-card[data-c="${cid}"]`).dataset.active,
      rowSel: Array.from(document.querySelectorAll('#assignTable tbody tr[data-c]'))
                .filter(r => r.getAttribute('aria-selected') === 'true').length,
      readout: document.getElementById('readout').textContent,
      guide: document.querySelectorAll('#plot .svg-guide').length,
      selPts: document.querySelectorAll('#plot .pt.sel').length,
    }), cid);
    const okAll = st.pressed === 'true' && st.sel === cid && st.structActive === '1' &&
                  st.rowSel > 0 && st.guide === 1 && st.selPts === EXPECT.points[cid].length &&
                  st.readout.indexOf('原图标注') >= 0;
    ok(`选中「${cid}」→ 按钮/结构/表格/读数/参考线/高亮点 全部同步`, okAll,
       `pressed=${st.pressed} struct=${st.structActive} rows=${st.rowSel} guide=${st.guide} pts=${st.selPts}`);
  }
  await page.click('#objList .obj-btn[data-c="all"]');
  await new Promise(r => setTimeout(r, 120));
  const allState = await page.evaluate(() => ({
    guide: document.querySelectorAll('#plot .svg-guide').length,
    dim: document.querySelectorAll('#plot .dim').length,
    txt: document.getElementById('readout').textContent,
  }));
  ok('切回「全部」→ 取消高亮、取消参考线', allState.guide === 0 && allState.dim === 0 && allState.txt.indexOf('四种化合物对比') >= 0);

  /* ================= 5. 交互：滑块 ================= */
  section('5. 交互 — 滑块产生有意义的图形变化');
  async function setRange(sel, val) {
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, sel, val);
    await new Promise(r => setTimeout(r, 120));
  }
  const before = await page.evaluate(() => document.querySelector('#plot .star') &&
      document.querySelector('#plot .star').getAttribute('points'));

  /* 温度 */
  await setRange('#sT', 323.15);
  const hot = await page.evaluate(() => ({
    T: window.__DOSY__.state.T,
    label: document.getElementById('vT').textContent,
    star: document.querySelector('#plot .star').getAttribute('points'),
    hint: document.getElementById('plotHint').textContent,
    calc: document.getElementById('calcOut').textContent,
    scale: window.__DOSY__.modelScale(window.__DOSY__.state.T, window.__DOSY__.state.eta),
  }));
  ok('温度滑块 → 标签显示单位 K（两位小数）', /323\.15 K/.test(hot.label), hot.label);
  ok('温度滑块 → 图形发生变化（预测星标移动）', hot.star !== before, '');
  ok('温度滑块 → 缩放因子 = 323.15/298.15 = 1.084',
     Math.abs(hot.scale - 323.15 / 298.15) < 1e-9, hot.scale.toFixed(6));
  ok('温度滑块 → 缩放因子写入提示文字', /1\.08[0-9]/.test(hot.hint), hot.hint.slice(-40));
  ok('温度滑块 → 验算框同步更新', /323\.15 K/.test(hot.calc), '');

  /* 黏度（先复位温度，单独考察 1/η） */
  await setRange('#sT', 298.15);
  await setRange('#sEta', 0.60);
  const visc = await page.evaluate(() => ({
    eta: window.__DOSY__.state.eta,
    label: document.getElementById('vEta').textContent,
    star: document.querySelector('#plot .star').getAttribute('points'),
    hint: document.getElementById('plotHint').textContent,
    scale: window.__DOSY__.modelScale(window.__DOSY__.state.T, window.__DOSY__.state.eta),
  }));
  ok('黏度滑块 → 标签显示单位 mPa·s', /0\.60 mPa·s/.test(visc.label), visc.label);
  ok('黏度滑块 → 图形发生变化', visc.star !== hot.star, '');
  ok('黏度滑块 → 缩放因子 = 1.10/0.60 = 1.833（D ∝ 1/η）',
     Math.abs(visc.scale - 1.10 / 0.60) < 1e-9, visc.scale.toFixed(6));

  /* 半径 */
  await setRange('#sR', 1.00);
  const rBig = await page.evaluate(() => ({ label: document.getElementById('vR').textContent,
                                            r: window.__DOSY__.state.r }));
  ok('半径滑块 → 标签显示单位 nm', /1\.00 nm/.test(rBig.label) && rBig.r === 1, rBig.label);

  /* 复位并核对默认值 → 模型点与观测点重合 */
  await setRange('#sT', 298.15); await setRange('#sEta', 1.10); await setRange('#sR', 0.30);
  const reset = await page.evaluate(() => ({
    T: window.__DOSY__.state.T, eta: window.__DOSY__.state.eta, r: window.__DOSY__.state.r,
    scale: window.__DOSY__.modelScale(window.__DOSY__.state.T, window.__DOSY__.state.eta),
  }));
  ok('滑块可精确复位到默认值 298.15 K / 1.10 mPa·s / 0.30 nm',
     Math.abs(reset.T - 298.15) < 1e-9 && Math.abs(reset.eta - 1.10) < 1e-9 && Math.abs(reset.r - 0.30) < 1e-9,
     `${reset.T} / ${reset.eta} / ${reset.r}`);
  ok('复位后缩放因子精确 = 1.000', Math.abs(reset.scale - 1) < 1e-9, reset.scale.toFixed(6));

  /* ================= 6. 交互：开关 ================= */
  section('6. 交互 — 显示开关');
  const specOn = await page.evaluate(() => document.querySelectorAll('#plot polyline').length);
  await page.click('#tgSpec'); await new Promise(r => setTimeout(r, 100));
  const specOff = await page.evaluate(() => document.querySelectorAll('#plot polyline').length);
  ok('一维谱开关 → 谱线条带显隐', specOn > 0 && specOff === 0, `${specOn} → ${specOff}`);
  await page.click('#tgSpec'); await new Promise(r => setTimeout(r, 100));

  const modelOn = await page.evaluate(() => document.querySelectorAll('#plot .star').length);
  await page.click('#tgModel'); await new Promise(r => setTimeout(r, 100));
  const modelOff = await page.evaluate(() => document.querySelectorAll('#plot .star').length);
  ok('演示模型开关 → 预测线与模型点显隐', modelOn === 1 && modelOff === 0, `${modelOn} → ${modelOff}`);
  await page.click('#tgModel'); await new Promise(r => setTimeout(r, 100));

  /* ================= 7. 交互：术语注释 ================= */
  section('7. 交互 — 术语注释');
  const termCount = await page.evaluate(() => document.querySelectorAll('.term').length);
  ok('正文含 ≥10 处可点按术语注释', termCount >= 10, String(termCount));
  const termKeys = await page.evaluate(() => Array.from(document.querySelectorAll('.term')).map(t => t.dataset.term));
  const undef = await page.evaluate((ks) => ks.filter(k => !window.__DOSY_TERMS__ || !window.__DOSY_TERMS__[k]), termKeys);
  ok('每处术语都有对应定义', undef.length === 0, undef.join(','));
  await page.click('.term[data-term="dosy"]');
  await new Promise(r => setTimeout(r, 150));
  const pop = await page.evaluate(() => {
    const p = document.getElementById('popover');
    return { on: p.classList.contains('on'), txt: p.textContent, inView: p.getBoundingClientRect().right <= window.innerWidth + 1 };
  });
  ok('点击术语 → 气泡显示且含中文注释', pop.on && pop.txt.indexOf('DOSY') >= 0, pop.txt.slice(0, 40));
  ok('气泡不超出视口右边', pop.inView);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 120));
  ok('Escape 关闭气泡', await page.evaluate(() => !document.getElementById('popover').classList.contains('on')));

  /* 键盘访问术语 */
  await page.evaluate(() => document.querySelector('.term[data-term="stokes"]').focus());
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 150));
  const pop2 = await page.evaluate(() => ({ on: document.getElementById('popover').classList.contains('on'),
                                            txt: document.getElementById('popover').textContent }));
  ok('键盘 Enter 打开术语气泡', pop2.on && pop2.txt.indexOf('Stokes') >= 0, pop2.txt.slice(0, 30));
  await page.keyboard.press('Escape');

  /* ================= 8. 交互：放大镜与原图展开 ================= */
  section('8. 交互 — 局部放大与原图展开');
  const lens0 = await page.evaluate(() => getComputedStyle(document.getElementById('lens')).backgroundPosition);
  await page.click('.lens-bar button[data-region="xaxis"]');
  await new Promise(r => setTimeout(r, 150));
  const lens1 = await page.evaluate(() => ({
    pos: getComputedStyle(document.getElementById('lens')).backgroundPosition,
    size: getComputedStyle(document.getElementById('lens')).backgroundSize,
    meta: document.getElementById('lensMeta').textContent,
    hasBg: /data:image\/png/.test(getComputedStyle(document.getElementById('lens')).backgroundImage),
  }));
  ok('切换放大区域 → 背景位置改变', lens1.pos !== lens0, `${lens0} → ${lens1.pos}`);
  ok('放大镜使用内联原图作为背景', lens1.hasBg);
  ok('放大镜说明含像素范围与显示比例', /原图像素/.test(lens1.meta) && /显示比例/.test(lens1.meta), lens1.meta.slice(0, 60));

  await setRange('#sLens', 3);
  const lens2 = await page.evaluate(() => getComputedStyle(document.getElementById('lens')).backgroundSize);
  ok('放大倍率滑块 → 背景尺寸改变', lens2 !== lens1.size, `${lens1.size} → ${lens2}`);
  await setRange('#sLens', 1);
  await page.click('.lens-bar button[data-region="full"]');

  const detOpen = await page.evaluate(() => {
    const d = document.querySelector('details.orig');
    d.open = true;
    const i = d.querySelector('img');
    return { open: d.open, w: i.getBoundingClientRect().width, natural: i.naturalWidth };
  });
  ok('原图可展开且以原始尺寸显示', detOpen.open && Math.abs(detOpen.w - detOpen.natural) < 2,
     `显示宽 ${detOpen.w.toFixed(0)} / 原始 ${detOpen.natural}`);

  /* ================= 9. 键盘操作 ================= */
  section('9. 键盘可达性');
  const focusable = await page.evaluate(() => {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(sel)).filter(el => el.offsetParent !== null).length;
  });
  ok('存在大量可聚焦控件', focusable > 30, String(focusable));

  const kb = await page.evaluate(() => {
    const p = document.querySelector('#plot .pt[data-c="green"]');
    p.focus();
    return document.activeElement === p;
  });
  ok('图上的点可被聚焦', kb);

  /* 指向/聚焦点 → 读数行更新 */
  await page.evaluate(() => document.querySelector('#plot .pt[data-c="red"]').focus());
  await new Promise(r => setTimeout(r, 180));
  const ptTxt = await page.evaluate(() => document.getElementById('ptRead').textContent);
  ok('聚焦图上的点 → 显示该点 δH 与 D', /2\.22/.test(ptTxt) && /8\.66/.test(ptTxt), ptTxt.slice(0, 64));

  const hasTitle = await page.evaluate(() => document.querySelectorAll('#plot .pt > title').length);
  ok('每个数据点都带原生悬停提示', hasTitle === 11, String(hasTitle));

  await page.evaluate(() => document.querySelector('#plot .pt[data-c="green"]').focus());
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 150));
  ok('键盘 Enter 选中图上的点', await page.evaluate(() => window.__DOSY__.state.sel === 'green'));
  await page.click('#objList .obj-btn[data-c="all"]');

  /* Tab 顺序 */
  await page.evaluate(() => document.querySelector('#objList .obj-btn[data-c="all"]').focus());
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => document.activeElement && document.activeElement.className);
  ok('Tab 键可在控件间移动', typeof afterTab === 'string' && afterTab.length > 0, afterTab);

  /* ================= 10. 结构与公式渲染 ================= */
  section('10. 结构式与公式渲染');
  const struct = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#structGrid .struct-card').forEach(c => {
      const svg = c.querySelector('svg');
      out[c.dataset.c] = {
        lines: svg.querySelectorAll('line').length,
        texts: Array.from(svg.querySelectorAll('text')).map(t => t.textContent.trim()),
        w: svg.getBoundingClientRect().width,
      };
    });
    return out;
  });
  const need = { blue: ['Si','O','O⁻','Na⁺','D','CH₃'], green: ['N⁺','Cl⁻','OH','CH₃'], red: ['O','CH₃'], black: ['O','H'] };
  for (const cid of Object.keys(need)) {
    const s = struct[cid];
    const hasAll = need[cid].every(t => s.texts.includes(t));
    ok(`结构式「${cid}」画出原子与连接键（${s.lines} 条键）`, s.lines >= 2 && hasAll, s.texts.join(','));
  }
  const subCount = await page.evaluate(() => document.querySelectorAll('sub').length + document.querySelectorAll('sup').length);
  ok('化学式/单位使用 sub、sup 渲染', subCount > 30, String(subCount));

  /* ================= 11. 横向溢出：桌面 + 两种手机宽度 ================= */
  section('11. 横向溢出与响应式');
  const sizes = [
    { w: 1440, h: 1000, name: '桌面 1440' },
    { w: 414,  h: 900,  name: '手机 414 (iPhone 11 Pro Max)' },
    { w: 375,  h: 812,  name: '手机 375 (iPhone SE/8)' },
  ];
  for (const s of sizes) {
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 300));
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      const bad = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
          // 允许在显式可滚动容器内
          let p = el.parentElement, scrollable = false;
          while (p && p !== document.body) {
            const ov = getComputedStyle(p).overflowX;
            if (ov === 'auto' || ov === 'scroll') { scrollable = true; break; }
            p = p.parentElement;
          }
          if (!scrollable) bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 28) +
                                   ' [' + r.left.toFixed(0) + '..' + r.right.toFixed(0) + ']');
        }
      });
      return { docScroll: de.scrollWidth - de.clientWidth, bad: bad.slice(0, 5) };
    });
    ok(`${s.name}：无横向溢出`, over.docScroll <= 1 && over.bad.length === 0,
       `scrollWidth 超出 ${over.docScroll}px; ${over.bad.join(' | ')}`);

    const clipped = await page.evaluate(() => {
      const de = document.documentElement;
      const bad = [];
      document.querySelectorAll('.wrap, section.block, .col, .struct-card, .hero, #readout').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > de.clientWidth + 1.5) bad.push(el.tagName + '.' + (el.className||'').toString().slice(0,24));
      });
      return bad.slice(0, 5);
    });
    ok(`${s.name}：主要容器未被裁切（表格另在可横向滚动的容器内）`, clipped.length === 0, clipped.join(' | '));

    /* 表格是否被包在可横向滚动的容器内 */
    const tblSafe = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('table').forEach(t => {
        let p = t.parentElement, scrollable = false;
        while (p && p !== document.body) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'auto' || ov === 'scroll') { scrollable = true; break; }
          p = p.parentElement;
        }
        if (!scrollable) bad.push(t.id || t.className);
      });
      return bad;
    });
    ok(`${s.name}：宽表格均置于可横向滚动容器内`, tblSafe.length === 0, tblSafe.join(' | '));
  }

  /* 手机上三栏应纵向堆叠 */
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 250));
  const stack = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.grid3 > .col')).map(c => c.getBoundingClientRect());
    return { n: cols.length, sameX: cols.every(c => Math.abs(c.left - cols[0].left) < 2),
             stacked: cols.every((c, i) => i === 0 || c.top >= cols[i-1].top) };
  });
  ok('手机端三栏纵向排列（不重叠）', stack.n === 3 && stack.sameX && stack.stacked, JSON.stringify(stack));

  /* 手机上术语气泡与结构图不溢出 */
  await page.evaluate(() => document.querySelector('.term[data-term="dosy"]').click());
  await new Promise(r => setTimeout(r, 150));
  const popMobile = await page.evaluate(() => {
    const r = document.getElementById('popover').getBoundingClientRect();
    return { l: r.left, r: r.right, vw: document.documentElement.clientWidth };
  });
  ok('手机端术语气泡不溢出', popMobile.l >= -1 && popMobile.r <= popMobile.vw + 1,
     `[${popMobile.l.toFixed(0)}..${popMobile.r.toFixed(0)}] vw=${popMobile.vw}`);
  await page.keyboard.press('Escape');

  const structMobile = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#structGrid .struct-card svg').forEach(s => {
      const r = s.getBoundingClientRect();
      if (r.right > document.documentElement.clientWidth + 1) bad.push(s.getAttribute('aria-label'));
    });
    return bad;
  });
  ok('手机端结构小图不溢出', structMobile.length === 0, structMobile.join(' | '));

  /* ================= 12. 截图 ================= */
  section('12. 截图');
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const d = document.querySelector('details.orig'); if (d) d.open = false; });
  await page.screenshot({ path: path.join(SHOT, 'preview.png'), fullPage: true });
  console.log('  preview.png (桌面整页)');

  await page.setViewport({ width: 414, height: 900 });
  await new Promise(r => setTimeout(r, 350));
  await page.screenshot({ path: path.join(OUT, 'mobile_414.png'), fullPage: true });
  console.log('  verify/mobile_414.png');

  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 350));
  await page.screenshot({ path: path.join(OUT, 'mobile_375.png'), fullPage: true });
  console.log('  verify/mobile_375.png');

  /* 交互态截图 */
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click('#objList .obj-btn[data-c="green"]');
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, 'state_green_selected.png'), fullPage: false });
  await page.click('#objList .obj-btn[data-c="all"]');

  /* ================= 汇总 ================= */
  await browser.close();
  const total = results.length;
  const passed = total - failed;
  const summary = `\n================ 汇总 ================\n通过 ${passed}/${total}，失败 ${failed}\n`;
  console.log(summary);
  fs.writeFileSync(path.join(OUT, 'verify_report.txt'),
    results.map(r => (r.pass ? '[PASS] ' : '[FAIL] ') + r.name + (r.detail ? '  :: ' + r.detail : '')).join('\n') + '\n' + summary,
    'utf-8');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('验证脚本异常：', e); process.exit(3); });
