// 浏览器验收：通过 Chrome DevTools 协议逐项触发页面交互，收集脚本错误，并在 1280 / 390 / 375 / 320 px 下检查横向溢出。
// 运行：node source/qa-browser.cjs   （需要 Node 22 以上和本机 Chrome；Chrome 路径可用环境变量 CHROME 指定）
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const CH = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const prof = mkdtempSync(path.join(tmpdir(), 'qa-chrome-'));
const port = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TEST = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s), txt = s => $(s).textContent.trim();
  const R = {};
  $('#zoom-a').click(); await sleep(1000);
  R.zoomA = [$('#zoom-a').getAttribute('aria-pressed'), [...document.querySelectorAll('#specMain text')].map(t => t.textContent).filter(s => /^10\\d\\d\\.\\d\\d$/.test(s)).join(',')];
  $('#zoom-c').click(); await sleep(1000);
  R.zoomC = [...document.querySelectorAll('#specMain text')].map(t => t.textContent).filter(s => /^3\\d\\d\\.\\d\\d$/.test(s)).join(',');
  $('#zoom-full').click(); await sleep(1000);
  const ov = [...document.querySelectorAll('#specMain svg > rect')].pop(), r = ov.getBoundingClientRect();
  ov.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.1, clientY: r.top + 60, bubbles: true }));
  R.readout = txt('#specRead');
  ov.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.1, clientY: r.top + 60, bubbles: true })); await sleep(1000);
  R.clickZoom = $('#zoom-a').getAttribute('aria-pressed');
  $('#zoom-full').click(); await sleep(900);
  $('#tree-c').click(); R.treeC = txt('#treeStep');
  $('#treePrev').click(); R.treePrev = txt('#treeStep') + ' | ' + txt('#treeCap');
  $('#tree-b').click(); R.treeB = txt('#treeStep') + ' prevDisabled=' + $('#treePrev').disabled + ' nextDisabled=' + $('#treeNext').disabled;
  $('#tree-a').click(); $('#treePlay').click(); await sleep(200); R.playStart = txt('#treeStep'); await sleep(4200); R.playEnd = txt('#treeStep');
  $('#jOuter').click(); R.jOuter = [txt('#jqRead'), txt('#jtRead')];
  $('#jClear').click();
  [...document.querySelectorAll('#jq rect[role=button]')][1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  [...document.querySelectorAll('#jq rect[role=button]')][2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  R.jPair = txt('#jqRead');
  const nu = $('#nu0'); nu.value = 0; nu.dispatchEvent(new Event('input'));
  R.field60 = ['#nu0Val', '#roJppm', '#roDnu', '#roRatio'].map(txt).join(' / ');
  $('#nu-1200').click(); R.field1200 = ['#nu0Val', '#roJppm', '#roRatio'].map(txt).join(' / ');
  $('#nu-250_13').click(); R.field250 = ['#nu0Val', '#roJppm', '#roDnu', '#roRatio'].map(txt).join(' / ');
  R.cands = [...document.querySelectorAll('.cand')].map(b => { b.click(); return b.dataset.id + ':' + txt('#candTitle').match(/命中 (\\d) \\/ 6/)[1] + ':' + [...document.querySelectorAll('#candSeal text')].map(t => t.textContent).join(''); }).join(' ');
  const g = $('#molBig .grp[data-s="c"]'); g.dispatchEvent(new MouseEvent('mouseenter')); await sleep(400);
  R.finalHover = [g.classList.contains('hot'), getComputedStyle(g.querySelector('.blob')).opacity, [...document.querySelectorAll('#specMini path[data-s="a"]')].map(p => p.style.opacity).join(',')].join(' | ');
  g.dispatchEvent(new MouseEvent('mouseleave'));
  R.counts = { svgs: document.querySelectorAll('svg').length, seals: document.querySelectorAll('[data-seal] svg').length, ensos: document.querySelectorAll('[data-enso] svg').length, shiftRows: document.querySelectorAll('.shift-row').length, hitRows: document.querySelectorAll('.shift-row.hit').length };
  return JSON.stringify(R, null, 1);
})()`;
const OVERFLOW = `(() => {
  const bad = [...document.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= innerWidth + 1) return false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) return false;
    return true;
  }).map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && el.className.baseVal === undefined ? '.' + el.className : '') + ' right=' + Math.round(el.getBoundingClientRect().right));
  return JSON.stringify({ innerWidth, docScrollWidth: document.documentElement.scrollWidth, offenders: bad.slice(0, 12) });
})()`;
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
(async () => {
  try {
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      try { const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); wsUrl = (list.find(t => t.type === 'page') || {}).webSocketDebuggerUrl; } catch {}
      if (!wsUrl) await sleep(250);
    }
    const ws = new WebSocket(wsUrl);
    await new Promise(r => (ws.onopen = r));
    let id = 0;
    const pending = new Map(), errors = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EVAL ERROR ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
    await send('Page.navigate', { url }); await sleep(4500);
    console.log('desktop interactions:', await evaluate(TEST));
    console.log('desktop overflow:', await evaluate(OVERFLOW));
    for (const w of [390, 375, 320]) {
      // mobile:false 让视口固定为 w；手机模式下超宽内容会把视口撑大，反而查不出元素
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 2, mobile: false });
      await send('Page.reload'); await sleep(4000);
      console.log(w + 'px overflow:', await evaluate(OVERFLOW));
    }
    console.log('errors:', JSON.stringify(errors, null, 1));
    ws.close();
  } finally { chrome.kill(); }
})();
