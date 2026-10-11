/* inspect.cjs — 截取局部元素用于人工目视检查 */
'use strict';
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const HERE = __dirname, OUT = path.join(HERE, '..', 'verify');
const PAGE = path.join(HERE, '..', 'index.html');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await p.goto('file:///' + PAGE.replace(/\\/g, '/'), { waitUntil: 'load' });
  await p.waitForFunction('window.__DOSY_READY__ === true');
  await new Promise(r => setTimeout(r, 500));

  const shots = { '#structGrid': 'zoom_structs.png', '#plot': 'zoom_plot.png',
                  '.col-left': 'zoom_left.png', '#readout': 'zoom_readout.png' };
  for (const [sel, name] of Object.entries(shots)) {
    const el = await p.$(sel);
    if (el) { await el.screenshot({ path: path.join(OUT, name) }); console.log('saved', name); }
  }
  // 全页
  await p.screenshot({ path: path.join(HERE, '..', 'preview.png'), fullPage: true });
  console.log('saved preview.png');
  await b.close();
})();
