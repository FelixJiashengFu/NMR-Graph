/* ============================================================
   app.js —— 交互逻辑（无任何外部依赖，可离线运行）
   ============================================================ */
(function () {
'use strict';
const D = window.DATA;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const fx = (v, n) => Number(v).toFixed(n === undefined ? 2 : n);
const fN = v => (v < 0 ? '−' + Math.abs(v).toFixed(1) : v.toFixed(1));

/* ============================================================
   0. 术语系统
   ============================================================ */
const TERM = {};
D.glossary.forEach(g => { TERM[g.id] = g; });

function termHTML(key) {
  const g = TERM[key];
  if (!g) return '[[' + key + ']]';
  return '<button type="button" class="term" data-tkey="' + key + '" aria-expanded="false" aria-controls="pop-' + key + '">' + g.t + '</button>' +
         '<span class="pop" id="pop-' + key + '" data-tpop="' + key + '"><b>' + g.t + '</b><span class="en">' + g.e + '</span>' + g.d + '</span>';
}

function processTerms(root) {
  const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, SVG: 1 };
  const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;   // 绝不进入 <script>/<style> 等
      if (p.namespaceURI && p.namespaceURI.indexOf('svg') >= 0) return NodeFilter.FILTER_REJECT;
      return (node.nodeValue && node.nodeValue.indexOf('[[') >= 0)
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });
  const hits = [];
  while (walker.nextNode()) hits.push(walker.currentNode);
  hits.forEach(n => {
    const frag = document.createDocumentFragment();
    const parts = n.nodeValue.split(/(\[\[[A-Za-z0-9_]+\]\])/g);
    parts.forEach(part => {
      const m = /^\[\[([A-Za-z0-9_]+)\]\]$/.exec(part);
      if (m) {
        const tpl = document.createElement('template');
        tpl.innerHTML = termHTML(m[1]).trim();
        frag.appendChild(tpl.content);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    n.parentNode.replaceChild(frag, n);
  });
  return hits.length;
}

function closeAllPops() {
  $$('.pop[data-open="1"]').forEach(p => {
    p.removeAttribute('data-open');
    const b = $('[data-tkey="' + p.dataset.tpop + '"]');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', e => {
  const t = e.target;
  const b = t && t.closest ? t.closest('.term') : null;
  if (b) {
    const p = $('#pop-' + b.dataset.tkey);
    const open = p.getAttribute('data-open') === '1';
    closeAllPops();
    if (!open) { p.setAttribute('data-open', '1'); b.setAttribute('aria-expanded', 'true'); }
    return;
  }
  if (!t || !t.closest || !t.closest('.pop')) closeAllPops();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPops(); });

/* ============================================================
   1. 全局状态
   ============================================================ */
const state = {
  unit: 'benziso', box: null,
  dH: 6.86, dN: -309.0,
  th: 0, delta: 111,
  view: 'recon', zoom: 'full'
};

/* HMBC 演示模型：I = |sin(pi*J*Dl)| * exp(-2*Dl/T2)，Dl 单位秒 */
function modelIntensity(peakId) {
  const J = D.model.Jdemo[peakId];
  if (!J) return 1;
  const Dl = state.delta / 1000;
  return Math.abs(Math.sin(Math.PI * J * Dl)) * Math.exp(-2 * Dl / D.model.T2);
}
function modelNorm() {
  let mx = 0;
  D.peaks.forEach(p => { const v = modelIntensity(p.id); if (v > mx) mx = v; });
  return mx > 0 ? mx : 1;
}
const PEAK_MAXH = Math.max.apply(null, D.peaks.map(x => x.h));
const relIntensity = p => p.h / PEAK_MAXH;
function visible(p) {
  const mix = 0.55 * relIntensity(p) + 0.45 * (modelIntensity(p.id) / modelNorm());
  return mix * 100 >= state.th - 1e-6;
}

/* ============================================================
   2. 重建谱图（示意）
   ============================================================ */
const G = { x0: 62, x1: 618, yT: 96, yB: 440, pT: 18, pB: 74 };
const xOf = dH => G.x0 + (8.0 - dH) / 7 * (G.x1 - G.x0);
const yOf = dN => G.yT + (dN + 342) / 109 * (G.yB - G.yT);

const GRP = {
  dashed: { color: '#7ab6f5', shape: 'square', label: '蓝虚框内（芳香区）' },
  ellipse: { color: '#e2686a', shape: 'circle', label: '红椭圆圈出' },
  solid: { color: '#b48ef0', shape: 'triangle', label: '紫实框内（脂肪区）' },
  free: { color: '#9fb0c3', shape: 'diamond', label: '未加框（孤立峰 / 弱峰）' }
};

function shapeSVG(shape, x, y, r, color, op) {
  const o = ' fill="' + color + '" fill-opacity="' + op + '" stroke="' + color + '" stroke-width="1.4"';
  if (shape === 'circle') return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"' + o + '></circle>';
  if (shape === 'square') return '<rect x="' + (x - r) + '" y="' + (y - r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '"' + o + '></rect>';
  if (shape === 'triangle') return '<polygon points="' + x + ',' + (y - r * 1.15) + ' ' + (x + r) + ',' + (y + r * 0.75) + ' ' + (x - r) + ',' + (y + r * 0.75) + '"' + o + '></polygon>';
  return '<polygon points="' + x + ',' + (y - r * 1.2) + ' ' + (x + r * 1.2) + ',' + y + ' ' + x + ',' + (y + r * 1.2) + ' ' + (x - r * 1.2) + ',' + y + '"' + o + '></polygon>';
}

function buildRecon() {
  let s = '';
  s += '<svg class="recon" viewBox="0 0 700 500" role="img" aria-label="按原图估读坐标重画的 1H-15N HMBC 示意散点图，含顶部一维氢谱投影。此图为示意重建，不是原始实验曲线。">';
  s += '<text class="banner" x="' + G.x0 + '" y="12">示意重建（按原图估读峰位重画）· 非原始实验曲线</text>';

  /* 顶部一维 ¹H 投影（按估读峰位合成的示意曲线） */
  const pMax = 56, maxH = Math.max.apply(null, D.projection.map(p => p.h));
  let d = '', first = true;
  for (let x = G.x0; x <= G.x1; x += 1) {
    let v = 0;
    D.projection.forEach(p => {
      const xi = xOf(p.dH), w = 1.5;
      v += p.h * (w * w) / ((x - xi) * (x - xi) + w * w);
    });
    const y = G.pB - Math.min(1, v / maxH) * pMax;
    d += (first ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    first = false;
  }
  s += '<path d="' + d + '" fill="none" stroke="#c3cede" stroke-width="1.2"></path>';
  s += '<line x1="' + G.x0 + '" y1="' + G.pB + '" x2="' + G.x1 + '" y2="' + G.pB + '" stroke="#3f4c5c" stroke-width="1"></line>';
  s += '<text x="' + (G.x0 - 4) + '" y="' + (G.pB - pMax + 6) + '" text-anchor="end" class="axlab" style="font-size:10px">¹H 投影</text>';
  s += '<line x1="' + xOf(state.dH) + '" y1="' + (G.pB - pMax) + '" x2="' + xOf(state.dH) + '" y2="' + G.pB + '" stroke="#5fd0a8" stroke-width="1.4" stroke-dasharray="3 3"></line>';

  /* 绘图区 */
  s += '<rect x="' + G.x0 + '" y="' + G.yT + '" width="' + (G.x1 - G.x0) + '" height="' + (G.yB - G.yT) + '" fill="#0b0e13" stroke="#3f4c5c" stroke-width="1.4"></rect>';
  for (let n = -340; n <= -240; n += 10) {
    const y = yOf(n);
    s += '<line class="' + (n % 20 === 0 ? 'grid' : 'gridm') + '" x1="' + G.x0 + '" y1="' + y + '" x2="' + G.x1 + '" y2="' + y + '"></line>';
  }
  for (let h = 8; h >= 1; h--) {
    const x = xOf(h);
    s += '<line class="gridm" x1="' + x + '" y1="' + G.yT + '" x2="' + x + '" y2="' + G.yB + '"></line>';
  }
  /* 纵轴刻度：−320 在上、−240 在下（与原图一致） */
  for (let n = -240; n >= -320; n -= 10) {
    const y = yOf(n);
    s += '<line class="axis" x1="' + (G.x0 - 5) + '" y1="' + y + '" x2="' + G.x0 + '" y2="' + y + '"></line>';
    s += '<text x="' + (G.x0 - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + n + '</text>';
  }
  s += '<text class="axlab" transform="translate(16,' + ((G.yT + G.yB) / 2) + ') rotate(-90)" text-anchor="middle">δ_N (ppm)</text>';
  for (let h = 7; h >= 1; h--) {
    const x = xOf(h);
    s += '<line class="axis" x1="' + x + '" y1="' + G.yB + '" x2="' + x + '" y2="' + (G.yB + 5) + '"></line>';
    s += '<text x="' + x + '" y="' + (G.yB + 18) + '" text-anchor="middle">' + h + '</text>';
  }
  s += '<text class="axlab" x="' + ((G.x0 + G.x1) / 2) + '" y="' + (G.yB + 38) + '" text-anchor="middle">δ_H (ppm)</text>';

  /* 三个标注区 */
  D.boxes.forEach(b => {
    const xa = xOf(b.dH[0]), xb = xOf(b.dH[1]);
    const ya = yOf(b.dN[0]), yb = yOf(b.dN[1]);
    const on = state.box === b.id, sw = on ? 2.6 : 1.6, op = on ? '1' : '0.65';
    if (b.kind === 'ellipse') {
      s += '<ellipse cx="' + ((xa + xb) / 2) + '" cy="' + ((ya + yb) / 2) + '" rx="' + (Math.abs(xb - xa) / 2) + '" ry="' + (Math.abs(yb - ya) / 2) + '" fill="none" stroke="' + b.color + '" stroke-width="' + sw + '" stroke-opacity="' + op + '"></ellipse>';
    } else {
      s += '<rect x="' + Math.min(xa, xb) + '" y="' + Math.min(ya, yb) + '" width="' + Math.abs(xb - xa) + '" height="' + Math.abs(yb - ya) + '" fill="none" stroke="' + b.color + '" stroke-width="' + sw + '" stroke-opacity="' + op + '"' + (b.id === 'dashed' ? ' stroke-dasharray="6 4"' : '') + '></rect>';
    }
    s += '<text x="' + (Math.min(xa, xb) + 3) + '" y="' + (Math.min(ya, yb) - 5) + '" style="font-size:10.5px;fill:' + b.color + '">' + b.label + '</text>';
  });

  /* 交叉峰 */
  const np = nearestPeak();
  D.peaks.forEach(p => {
    const x = xOf(p.dH), y = yOf(p.dN), g = GRP[p.group];
    const r = 3.4 + 3.6 * relIntensity(p);
    const op = visible(p) ? (0.55 + 0.45 * (modelIntensity(p.id) / modelNorm())).toFixed(2) : '0.10';
    s += '<g class="pkg" data-pid="' + p.id + '" role="button" tabindex="0" aria-label="交叉峰 ' + p.id + '，δH ' + fx(p.dH) + ' ppm，δN ' + fN(p.dN) + ' ppm，' + p.tag + '">';
    s += '<circle class="pkhit" cx="' + x + '" cy="' + y + '" r="13" fill="transparent"></circle>';
    if (np.id === p.id) s += '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 7) + '" fill="none" stroke="#5fd0a8" stroke-width="1.6" stroke-dasharray="3 2"></circle>';
    s += shapeSVG(g.shape, x, y, r, g.color, op);
    s += '<text class="pklab" x="' + (x + 9) + '" y="' + (y - 7) + '" style="fill:' + g.color + '">' + p.id + '</text>';
    s += '</g>';
  });

  /* 游标 */
  s += '<line x1="' + xOf(state.dH) + '" y1="' + G.yT + '" x2="' + xOf(state.dH) + '" y2="' + G.yB + '" stroke="#5fd0a8" stroke-width="1.5" stroke-dasharray="4 3"></line>';
  s += '<line x1="' + G.x0 + '" y1="' + yOf(state.dN) + '" x2="' + G.x1 + '" y2="' + yOf(state.dN) + '" stroke="#7ab6f5" stroke-width="1.5" stroke-dasharray="4 3"></line>';
  s += '<text x="' + (xOf(state.dH) + 4) + '" y="' + (G.yT + 13) + '" style="font-size:10.5px;fill:#5fd0a8">δH=' + fx(state.dH) + '</text>';
  s += '<text x="' + (G.x0 + 4) + '" y="' + (yOf(state.dN) - 4) + '" style="font-size:10.5px;fill:#7ab6f5">δN=' + fN(state.dN) + '</text>';
  s += '</svg>';

  const host = $('#reconHost');
  host.innerHTML = s;
  $$('.pkg', host).forEach(el => {
    const act = () => { const p = D.peaks.find(q => q.id === el.dataset.pid); if (p) { state.dH = +p.dH.toFixed(2); state.dN = p.dN; syncSliders(); render(); } };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
}

/* ============================================================
   3. 原图叠加层
   ============================================================ */
function buildOverlay() {
  const f = D.frame, np = nearestPeak();
  let s = '';
  s += '<line class="cur-h" x1="' + f.x0 + '" y1="' + D.dN2px(state.dN) + '" x2="' + f.x1 + '" y2="' + D.dN2px(state.dN) + '"></line>';
  s += '<line class="cur" x1="' + D.dH2px(state.dH) + '" y1="' + f.y0 + '" x2="' + D.dH2px(state.dH) + '" y2="' + f.y1 + '"></line>';
  s += '<circle class="mk" cx="' + D.dH2px(np.dH) + '" cy="' + D.dN2px(np.dN) + '" r="14" stroke="#5fd0a8"></circle>';
  s += '<text x="' + (D.dH2px(state.dH) + 6) + '" y="' + (f.y0 + 18) + '">δH ' + fx(state.dH) + '</text>';
  s += '<text x="' + (f.x0 + 6) + '" y="' + (D.dN2px(state.dN) - 6) + '">δN ' + fN(state.dN) + '</text>';
  $('#origOvl').innerHTML = s;
}

/* ============================================================
   4. 分子结构 SVG（按原图结构式重画，示意）
   ============================================================ */
const A = {
  ar1: [193, 100], C5: [169, 58.4], C6: [121, 58.4], C7: [97, 100],
  C3a: [169, 141.6], C7a: [121, 141.6],
  S1: [66, 172], N2: [126, 209], C3: [178, 180],
  pipN1: [256, 250], pipE: [278, 211.9], pipF: [322, 211.9],
  pipA: [344, 250], pipN4: [322, 288.1], pipC: [278, 288.1],
  eC1: [360, 330], eC2: [360, 374],
  oC3a: [513.3, 380], oC4: [470, 355], oC5: [426.7, 380],
  oC6: [426.7, 430], oC7: [470, 455], oC7a: [513.3, 430],
  lacC3: [560, 352], lacC2: [602, 388], lacN1: [556, 432],
  lacO: [650, 362], lacH: [556, 476], Cl: [378, 452]
};
const ATOM_META = {
  S1: { t: 'S', c: '#f2d64b', n: '硫原子（苯并异噻唑环内）' },
  N2: { t: 'N', c: '#7ab6f5', n: '苯并异噻唑环内氮' },
  pipN1: { t: 'N', c: '#7ab6f5', n: '哌嗪氮（连芳杂环，N-芳基）' },
  pipN4: { t: 'N', c: '#7ab6f5', n: '哌嗪氮（连烷基，N-烷基）' },
  lacN1: { t: 'N', c: '#7ab6f5', n: '氧化吲哚内酰胺氮' },
  lacO: { t: 'O', c: '#e2686a', n: '羰基氧（C=O）' },
  Cl: { t: 'Cl', c: '#7fd68a', n: '芳环上的氯原子' },
  lacH: { t: 'H', c: '#8fd8c0', n: '内酰胺 N–H 上的氢' }
};
const BONDS = [
  ['ar1', 'C3a'], ['C3a', 'C7a'], ['C7a', 'C7'], ['C7', 'C6'], ['C6', 'C5'], ['C5', 'ar1'],
  ['C7a', 'S1'], ['S1', 'N2'], ['N2', 'C3'], ['C3', 'C3a'], ['C3', 'pipN1'],
  ['pipN1', 'pipE'], ['pipE', 'pipF'], ['pipF', 'pipA'], ['pipA', 'pipN4'], ['pipN4', 'pipC'], ['pipC', 'pipN1'],
  ['pipN4', 'eC1'], ['eC1', 'eC2'], ['eC2', 'oC5'],
  ['oC3a', 'oC4'], ['oC4', 'oC5'], ['oC5', 'oC6'], ['oC6', 'oC7'], ['oC7', 'oC7a'], ['oC7a', 'oC3a'],
  ['oC3a', 'lacC3'], ['lacC3', 'lacC2'], ['lacC2', 'lacN1'], ['lacN1', 'oC7a'],
  ['oC6', 'Cl'], ['lacN1', 'lacH']
];
const DBL = [['N2', 'C3'], ['lacC2', 'lacO']];
const RINGS = {
  bz5: { pts: ['S1', 'N2', 'C3', 'C3a', 'C7a'], units: 'benziso' },
  bz6: { pts: ['ar1', 'C3a', 'C7a', 'C7', 'C6', 'C5'], units: 'benziso aryl', c: [145, 100] },
  pip: { pts: ['pipN1', 'pipE', 'pipF', 'pipA', 'pipN4', 'pipC'], units: 'pipA pipB' },
  lac5: { pts: ['lacC3', 'lacC2', 'lacN1', 'oC7a', 'oC3a'], units: 'lactam' },
  ox6: { pts: ['oC3a', 'oC4', 'oC5', 'oC6', 'oC7', 'oC7a'], units: 'aryl', c: [470, 405] }
};
const AROM_INNER = [['ar1', 'C3a', 'bz6'], ['C7a', 'C7', 'bz6'], ['C6', 'C5', 'bz6'],
                    ['oC3a', 'oC4', 'ox6'], ['oC5', 'oC6', 'ox6'], ['oC7', 'oC7a', 'ox6']];

const UNIT_ATOMS = {
  benziso: ['S1', 'N2'],
  pipA: ['pipN1'],
  pipB: ['pipN4'],
  lactam: ['lacN1', 'lacH', 'lacO'],
  aryl: ['Cl']
};
const ATOM_UNIT = {};
Object.keys(UNIT_ATOMS).forEach(u => UNIT_ATOMS[u].forEach(a => { ATOM_UNIT[a] = u; }));

/* 带原子符号间隙的键（骨架式的标准画法：符号处留空，键不穿字） */
const ATOM_GAP = { S1: 10, N2: 10, pipN1: 9, pipN4: 9, lacN1: 9, lacO: 9, Cl: 11, lacH: 8 };
function seg(p, q, off, cx, cy) {
  let x1 = A[p][0], y1 = A[p][1], x2 = A[q][0], y2 = A[q][1];
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  let ux = dx / L, uy = dy / L;
  const gp = ATOM_GAP[p] || 0, gq = ATOM_GAP[q] || 0;
  x1 += ux * gp; y1 += uy * gp; x2 -= ux * gq; y2 -= uy * gq;
  if (off) {
    let nx = -uy, ny = ux;
    if (cx !== undefined) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
    }
    x1 += nx * off; y1 += ny * off; x2 += nx * off; y2 += ny * off;
  }
  return 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1);
}
const polyPts = pts => pts.map(k => A[k][0].toFixed(1) + ',' + A[k][1].toFixed(1)).join(' ');

function buildStruct() {
  let s = '<svg viewBox="45 35 630 470" role="img" aria-label="齐拉西酮骨架结构示意图：左为 1,2-苯并异噻唑，经哌嗪与乙基链连到右端的 6-氯氧化吲哚。">';
  /* 环高亮 */
  Object.keys(RINGS).forEach(k => {
    const r = RINGS[k];
    s += '<polygon class="ringhl" data-rings="' + r.units + '" points="' + polyPts(r.pts) + '"></polygon>';
  });
  /* 键 */
  BONDS.forEach(b => { s += '<path class="bond" d="' + seg(b[0], b[1]) + '"></path>'; });
  DBL.forEach(b => {
    s += '<path class="bond2" d="' + seg(b[0], b[1], 3.2) + '"></path>';
    s += '<path class="bond2" d="' + seg(b[0], b[1], -3.2) + '"></path>';
  });
  AROM_INNER.forEach(t => { const c = RINGS[t[2]].c; s += '<path class="arom" d="' + seg(t[0], t[1], 5.5, c[0], c[1]) + '"></path>'; });
  /* 原子标签 + 高亮 + 命中区 */
  Object.keys(ATOM_META).forEach(k => {
    const m = ATOM_META[k], p = A[k];
    s += '<g class="atomg" data-atom="' + k + '">' +
         '<circle class="ringhl" cx="' + p[0] + '" cy="' + p[1] + '" r="15"></circle>' +
         '<circle class="hl" cx="' + p[0] + '" cy="' + p[1] + '" r="15" stroke="#5fd0a8" fill="none"></circle>' +
         '<text class="atom" x="' + p[0] + '" y="' + p[1] + '" fill="' + m.c + '">' + m.t + '</text>' +
         '<circle class="hit" cx="' + p[0] + '" cy="' + p[1] + '" r="17" tabindex="0" role="button" aria-label="' + m.n + '"></circle>' +
         '</g>';
  });
  s += '</svg>';
  $('#structHost').innerHTML = s;

  $$('#structHost .hit').forEach(el => {
    const g = el.closest('.atomg'), u = ATOM_UNIT[g.dataset.atom];
    const act = () => { if (u) { state.unit = u; state.box = null; render(); } };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
}

/* ============================================================
   5. 官能团小结构图（按骨架式规范重画：原子符号处键留空）
   ============================================================ */
function hexA(cx, cy, R, deg0) {
  const out = [];
  for (let i = 0; i < 6; i++) { const a = (deg0 + i * 60) * Math.PI / 180; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  return out;
}
function seg2(p, q, g1, g2, off, cx, cy) {
  let [x1, y1] = p, [x2, y2] = q;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  x1 += ux * (g1 || 0); y1 += uy * (g1 || 0);
  x2 -= ux * (g2 || 0); y2 -= uy * (g2 || 0);
  if (off) {
    let nx = -uy, ny = ux;
    if (cx !== undefined) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
    }
    x1 += nx * off; y1 += ny * off; x2 += nx * off; y2 += ny * off;
  }
  return 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1);
}
function ringPath(pts, gaps) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d += seg2(a, b, (gaps || [])[i] || 0, (gaps || [])[(i + 1) % pts.length] || 0);
  }
  return d;
}
function aromPath(pts, idx, c) {
  return idx.map(([i, j]) => seg2(pts[i], pts[j], 0, 0, 3.4, c[0], c[1])).join('');
}

function fgBenziso() {
  const b = hexA(38, 26, 16, 0);                 // 苯环，平底
  const S = [12, 50], N = [31, 70], C3 = [53, 61];
  const five = [b[1], C3, N, S, b[2]];           // b[1]-C3-N-S-b[2]
  const gaps = [0, 0, 10, 10, 0];
  let s = '<svg viewBox="0 0 118 84" role="img" aria-label="1,2-苯并异噻唑结构小图：苯环与含硫、氮的五元环稠合。">';
  s += '<path class="b" d="' + ringPath(b, [0, 0, 0, 0, 0, 0]) + '"></path>';
  s += '<path class="b1" d="' + aromPath(b, [[0, 1], [2, 3], [4, 5]], [38, 26]) + '"></path>';
  s += '<path class="b" d="' + ringPath(five, gaps) + '"></path>';
  s += '<text class="a" x="' + S[0] + '" y="' + S[1] + '" fill="#f2d64b">S</text>';
  s += '<text class="a" x="' + N[0] + '" y="' + N[1] + '" fill="#7ab6f5">N</text>';
  s += '<text class="c" x="84" y="20">1,2-苯并</text><text class="c" x="84" y="32">异噻唑</text>' +
       '<text class="c" x="84" y="48">benziso-</text><text class="c" x="84" y="60">thiazole</text>';
  s += '</svg>';
  return s;
}
function fgPiperazine() {
  const h = hexA(42, 42, 20, 0);
  const gaps = [10, 0, 0, 10, 0, 0];             // 0 位与 3 位为 N
  let s = '<svg viewBox="0 0 118 84" role="img" aria-label="哌嗪结构小图：含两个氮的六元饱和环，两个氮处于 1,4 位。">';
  s += '<path class="b" d="' + ringPath(h, gaps) + '"></path>';
  s += '<text class="a" x="' + h[3][0] + '" y="' + h[3][1] + '" fill="#7ab6f5">N</text>';
  s += '<text class="a" x="' + h[0][0] + '" y="' + h[0][1] + '" fill="#7ab6f5">N</text>';
  s += '<text class="c" x="88" y="36">哌嗪</text><text class="c" x="88" y="50">piperazine</text>';
  s += '</svg>';
  return s;
}
function fgOxindole() {
  const b = hexA(34, 34, 16, 30);                // 苯环，尖顶
  const C3 = [64, 20], C2 = [80, 32], N1 = [64, 44], O = [100, 24], H = [64, 68];
  const five = [b[5], C3, C2, N1, b[0]];         // C3a(上右)-C3-C2-N1-C7a(下右)
  const gaps = [0, 0, 0, 9, 0];
  let s = '<svg viewBox="0 0 118 84" role="img" aria-label="氧化吲哚内酰胺结构小图：苯环与含 N-H 和 C=O 的五元内酰胺环稠合。">';
  s += '<path class="b" d="' + ringPath(b, [0, 0, 0, 0, 0, 0]) + '"></path>';
  s += '<path class="b1" d="' + aromPath(b, [[0, 1], [2, 3], [4, 5]], [34, 34]) + '"></path>';
  s += '<path class="b" d="' + ringPath(five, gaps) + '"></path>';
  s += '<path class="b1" d="' + seg2(C2, O, 0, 11, 2.2) + '"></path>';
  s += '<path class="b1" d="' + seg2(C2, O, 0, 11, -2.2) + '"></path>';
  s += '<path class="b" d="' + seg2(N1, H, 9, 8) + '"></path>';
  s += '<text class="a" x="' + O[0] + '" y="' + O[1] + '" fill="#e2686a">O</text>';
  s += '<text class="a" x="' + N1[0] + '" y="' + N1[1] + '" fill="#7ab6f5">N</text>';
  s += '<text class="c" x="' + H[0] + '" y="' + H[1] + '" fill="#8fd8c0">H</text>';
  s += '</svg>';
  return s;
}
function fgArylCl() {
  const h = hexA(40, 36, 17, 30);
  const Cl = [9, 54];
  let s = '<svg viewBox="0 0 118 84" role="img" aria-label="芳基氯结构小图：苯环上直接连接一个氯原子。">';
  s += '<path class="b" d="' + ringPath(h, [0, 0, 0, 0, 0, 0]) + '"></path>';
  s += '<path class="b1" d="' + aromPath(h, [[0, 1], [2, 3], [4, 5]], [40, 36]) + '"></path>';
  s += '<path class="b" d="' + seg2(h[2], Cl, 0, 10) + '"></path>';
  s += '<text class="a" x="' + Cl[0] + '" y="' + Cl[1] + '" fill="#7fd68a">Cl</text>';
  s += '<text class="c" x="88" y="36">芳基氯</text><text class="c" x="88" y="50">aryl-Cl</text>';
  s += '</svg>';
  return s;
}
function buildFG() {
  const items = [['1,2-苯并异噻唑', fgBenziso()], ['哌嗪', fgPiperazine()], ['氧化吲哚内酰胺', fgOxindole()], ['芳基氯', fgArylCl()]];
  $('#fgRow').innerHTML = items.map(it => '<span class="fg" title="' + it[0] + '（结构示意图）">' + it[1] + '</span>').join('');
}

/* ============================================================
   6. 选择列表
   ============================================================ */
function buildLists() {
  $('#objList').innerHTML = D.units.map(u =>
    '<button type="button" class="objbtn" data-uid="' + u.id + '" aria-pressed="' + (state.unit === u.id) + '">' +
    u.name + '<span class="en">' + u.en + '</span></button>').join('');
  $('#boxList').innerHTML = D.boxes.map(b =>
    '<button type="button" class="objbtn" data-bid="' + b.id + '" aria-pressed="' + (state.box === b.id) + '">' +
    b.label + '　<span class="en">' + b.contains.join(' / ') + '</span></button>').join('');

  $$('#objList .objbtn').forEach(el => el.addEventListener('click', () => { state.unit = el.dataset.uid; state.box = null; render(); }));
  $$('#boxList .objbtn').forEach(el => el.addEventListener('click', () => {
    state.box = (state.box === el.dataset.bid) ? null : el.dataset.bid;
    if (state.box) {
      const b = D.boxes.find(x => x.id === state.box);
      if (b && b.contains[0]) { const p = D.peaks.find(x => x.id === b.contains[0]); if (p) { state.dH = +p.dH.toFixed(2); state.dN = p.dN; syncSliders(); } }
    }
    render();
  }));
}

/* ============================================================
   7. 读数与解释
   ============================================================ */
function nearestPeak() {
  let best = D.peaks[0], bd = 1e9;
  D.peaks.forEach(p => {
    const dd = Math.abs(p.dH - state.dH) / 0.25 + Math.abs(p.dN - state.dN) / 4;
    if (dd < bd) { bd = dd; best = p; }
  });
  return best;
}
function projMatch(dH) {
  let best = D.projection[0], bd = 1e9;
  D.projection.forEach(p => { const d = Math.abs(p.dH - dH); if (d < bd) { bd = d; best = p; } });
  return { peak: best, diff: bd };
}
const BADGE = {
  observe: ['原图观测', 'b-observe'], infer: ['结构辅助推断', 'b-infer'],
  theory: ['理论计数', 'b-theory'], model: ['演示模型', 'b-model']
};
const srcBadge = k => { const m = BADGE[k] || BADGE.observe; return '<span class="badge ' + m[1] + '">' + m[0] + '</span>'; };

function render() {
  const np = nearestPeak();
  const ddH = Math.abs(np.dH - state.dH), ddN = Math.abs(np.dN - state.dN);
  const pm = projMatch(np.dH);
  const boxOf = D.boxes.find(b => b.contains.indexOf(np.id) >= 0);

  $('#roMain').innerHTML = 'δ<sub>H</sub> ' + fx(state.dH) + ' ppm　/　δ<sub>N</sub> ' + fN(state.dN) + ' ppm';
  $('#roSub').textContent = '距最近交叉峰 ' + np.id + '：ΔδH ' + fx(ddH) + ' ppm，ΔδN ' + ddN.toFixed(1) + ' ppm' + (ddH < 0.12 && ddN < 2 ? '（已重合）' : '');

  $('#roKv').innerHTML =
    '<dt>最近交叉峰</dt><dd class="mono">' + np.id + '　δ<sub>H</sub> ' + fx(np.dH) + ' / δ<sub>N</sub> ' + fN(np.dN) + '</dd>' +
    '<dt>估读强度</dt><dd class="mono">' + np.h + ' px（相对 ' + (relIntensity(np) * 100).toFixed(0) + ' %）</dd>' +
    '<dt>原图标注</dt><dd>' + (boxOf ? boxOf.label + '：' + boxOf.note : '未加框') + '</dd>' +
    '<dt>一维投影对照</dt><dd>' + (pm.diff <= 0.12
      ? '有对应峰 δ<sub>H</sub> ' + fx(pm.peak.dH) + '（Δ ' + fx(pm.diff) + ' ppm）'
      : '<span style="color:var(--warn)">无对应峰（最近投影峰 δ<sub>H</sub> ' + fx(pm.peak.dH) + '，Δ ' + fx(pm.diff) + ' ppm）</span>') + '</dd>' +
    '<dt>演示模型相对强度</dt><dd class="mono">' + (modelIntensity(np.id) / modelNorm() * 100).toFixed(0) + ' %</dd>';
  $('#roSrc').innerHTML = srcBadge('observe') + ' ' + srcBadge('infer') + ' ' + srcBadge('model');

  let ex = '';
  if (state.box) {
    const b = D.boxes.find(x => x.id === state.box);
    ex += '<h4 style="color:' + b.color + '">' + b.label + '　' + srcBadge('observe') + '</h4>' +
      '<p>原图范围：δ<sub>H</sub> ' + fx(b.dH[0]) + ' – ' + fx(b.dH[1]) + ' ppm，δ<sub>N</sub> ' + fN(b.dN[0]) + ' – ' + fN(b.dN[1]) + ' ppm。</p>' +
      '<p>框内交叉峰：' + b.contains.map(id => { const p = D.peaks.find(x => x.id === id); return '<span class="mono">' + id + '（' + fx(p.dH) + ' / ' + fN(p.dN) + '）</span>'; }).join('、') + '。</p>' +
      '<p>' + b.note + '。原图没有说明加框的理由，本页只把它当作"作者希望你注意的位置"记录，不替它编造解释。</p>';
  }
  if (state.unit) {
    const u = D.units.find(x => x.id === state.unit);
    ex += '<h4>' + u.name + '<span class="mono" style="color:var(--dim);font-size:12px">　' + u.en + '</span></h4>' +
      '<p>' + u.text + '</p>' +
      '<dl class="kv">' +
      '<dt>预期 δ<sub>H</sub></dt><dd>' + u.dHexp + '</dd>' +
      '<dt>预期 δ<sub>N</sub></dt><dd>' + u.dNexp + '</dd>' +
      '<dt>相关原图观测</dt><dd>' + (u.related.length ? u.related.join('、') : '本页未把任何交叉峰与该单元关联') + '</dd>' +
      '</dl>' +
      '<p style="margin-top:6px">' + srcBadge('infer') + ' 以上"预期"是通用核磁规律的定性描述，不是从这张图测出来的数据；"相关原图观测"只表示峰位落在该单元的常见区间内，<strong>不等于归属</strong>。</p>';
  }
  ex += '<hr><h4>当前游标位置</h4>' +
    '<p>你正停在 δ<sub>H</sub> ' + fx(state.dH) + ' ppm、δ<sub>N</sub> ' + fN(state.dN) + ' ppm，距离最近的交叉峰是 <span class="mono">' + np.id + '</span>（δ<sub>H</sub> ' + fx(np.dH) + ' / δ<sub>N</sub> ' + fN(np.dN) + '）。' +
    (pm.diff <= 0.12
      ? '一维 ¹H 投影在 δ<sub>H</sub> ' + fx(pm.peak.dH) + ' 处确有对应峰，这个交叉峰的氢维位置是自洽的。'
      : '<span style="color:var(--warn)">一维 ¹H 投影在 δ<sub>H</sub> ' + fx(np.dH) + ' 附近没有可见峰（最近投影峰在 ' + fx(pm.peak.dH) + '，相差 ' + fx(pm.diff) + ' ppm）。这是原图上一个真实存在的不一致，本页不对它做强行解释。</span>') +
    '</p>';
  $('#explain').innerHTML = ex;

  const Jopt = 1 / (2 * (state.delta / 1000));
  const rows = D.peaks.map(p => {
    const mi = modelIntensity(p.id) / modelNorm();
    return '<tr><td class="n">' + p.id + '</td><td class="n">' + D.model.Jdemo[p.id].toFixed(1) + '</td><td class="n">' + (mi * 100).toFixed(0) + ' %</td><td>' + (visible(p) ? '显示' : '<span style="color:var(--dim)">已隐藏</span>') + '</td></tr>';
  }).join('');
  $('#modelRead').innerHTML =
    '<p>Δ₂ = <span class="mono">' + state.delta + ' ms</span>　⇒　理论最佳 J = 1/(2Δ₂) ≈ <span class="mono">' + Jopt.toFixed(2) + ' Hz</span></p>' +
    '<p class="hint">强度模型 |sin(π·J·Δ₂)|·exp(−2Δ₂/T₂)，T₂ = ' + D.model.T2 + ' s（演示取值）。纯正弦项在 Δ₂ = 1/(2J) 处取极大，指数弛豫项会把实际极大点略微前移，因此最佳延迟总是略短于 1/(2J)。J 值为演示假设值，非原图数据。</p>' +
    '<div class="tblwrap"><table style="min-width:0"><thead><tr><th>峰</th><th class="n">假定 J (Hz)</th><th class="n">相对强度</th><th>显示</th></tr></thead><tbody>' + rows + '</tbody></table></div>';

  buildRecon(); buildOverlay(); applyHighlight(); markRows(np.id);
  $('#vJopt').textContent = 'J ≈ ' + Jopt.toFixed(1) + ' Hz';
}

function markRows(pid) {
  $$('#peakTbl tbody tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.pid === pid));
}
function applyHighlight() {
  $$('#structHost .atomg').forEach(g => g.classList.toggle('on', !!state.unit && (UNIT_ATOMS[state.unit] || []).indexOf(g.dataset.atom) >= 0));
  $$('#structHost .ringhl[data-rings]').forEach(el =>
    el.style.fillOpacity = (state.unit && el.dataset.rings.split(' ').indexOf(state.unit) >= 0) ? '.16' : '0');
  $$('#objList .objbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.uid === state.unit)));
  $$('#boxList .objbtn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bid === state.box)));
}

/* ============================================================
   8. 控件绑定
   ============================================================ */
function syncSliders() {
  $('#sldH').value = state.dH; $('#sldN').value = state.dN;
  $('#vH').textContent = fx(state.dH) + ' ppm';
  $('#vN').textContent = fN(state.dN) + ' ppm';
}
function bindSliders() {
  $('#sldH').addEventListener('input', e => { state.dH = parseFloat(e.target.value); $('#vH').textContent = fx(state.dH) + ' ppm'; render(); });
  $('#sldN').addEventListener('input', e => { state.dN = parseFloat(e.target.value); $('#vN').textContent = fN(state.dN) + ' ppm'; render(); });
  $('#sldTh').addEventListener('input', e => { state.th = parseFloat(e.target.value); $('#vTh').textContent = state.th + ' %'; render(); });
  $('#sldD').addEventListener('input', e => { state.delta = parseFloat(e.target.value); $('#vD').textContent = state.delta + ' ms'; render(); });
  $('#btnReset').addEventListener('click', () => {
    state.unit = 'benziso'; state.box = null; state.dH = 6.86; state.dN = -309; state.th = 0; state.delta = 111;
    $('#sldTh').value = 0; $('#vTh').textContent = '0 %'; $('#sldD').value = 111; $('#vD').textContent = '111 ms';
    syncSliders(); render();
  });
  $('#btnSnap').addEventListener('click', () => {
    const np = nearestPeak(); state.dH = +np.dH.toFixed(2); state.dN = np.dN; syncSliders(); render();
  });
  $$('#segView button').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    $$('#segView button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('#viewRecon').hidden = state.view !== 'recon';
    $('#viewOrig').hidden = state.view !== 'orig';
    $('#viewBadge').textContent = state.view === 'recon' ? '估读重建（示意）' : '原图 + 叠加层';
    render();
  }));
}
/* 谱图面板获得焦点时，方向键微调游标（不影响页面滚动） */
function bindReconKeys() {
  const host = $('#reconHost');
  host.setAttribute('tabindex', '0');
  host.setAttribute('role', 'application');
  host.setAttribute('aria-label', '交互式二维谱图。使用左右方向键微调 δH，上下方向键微调 δN。');
  host.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      state.dH = Math.min(8, Math.max(1, +(state.dH + (k === 'ArrowLeft' ? 0.02 : -0.02)).toFixed(2)));
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      state.dN = Math.min(-232.5, Math.max(-342.5, +(state.dN + (k === 'ArrowUp' ? -0.5 : 0.5)).toFixed(1)));
    } else { return; }
    e.preventDefault(); syncSliders(); render();
  });
}

/* ============================================================
   9. 局部放大
   ============================================================ */
const REGIONS = [
  { id: 'full', name: '全图', x: 0, y: 0, w: 1053, h: 811, cap: '完整幻灯片：左侧标题与要点文字，右侧上方结构式、右侧下方二维谱。' },
  { id: 'struct', name: '结构式', x: 706, y: 58, w: 298, h: 288, cap: '分子结构式区域：1,2-苯并异噻唑（黄 S、蓝 N）→ 哌嗪（两个蓝 N）→ 乙基链 → 6-氯氧化吲哚（绿 Cl、红 O、青 H）。' },
  { id: 'spec', name: '谱图全图', x: 598, y: 378, w: 452, h: 320, cap: '二维谱整体：顶部为一维 ¹H 投影，左侧纵轴为 δ_N（−320 在上、−240 在下），底部横轴为 δ_H（7 → 1）。' },
  { id: 'aromatic', name: '芳香区', x: 660, y: 420, w: 160, h: 200, cap: '芳香区（δ_H 6.2–8.0）：红椭圆与蓝色虚线框都在这一带，共 5 个交叉峰。' },
  { id: 'aliphatic', name: '脂肪区', x: 850, y: 420, w: 190, h: 210, cap: '脂肪区（δ_H 1.0–3.8）：紫色实线框内是最强的一个交叉峰，右上还有纵轴最负处的弱峰。' },
  { id: 'redpeak', name: '红圈峰', x: 686, y: 440, w: 96, h: 96, cap: '原图用红椭圆圈出的交叉峰（δ_H≈6.86 / δ_N≈−309）及其周边。' }
];
function buildZoomBtns() {
  $('#segZoom').innerHTML = REGIONS.map(r => '<button type="button" data-rid="' + r.id + '" aria-pressed="' + (r.id === 'full') + '">' + r.name + '</button>').join('');
  $$('#segZoom button').forEach(b => b.addEventListener('click', () => {
    state.zoom = b.dataset.rid;
    $$('#segZoom button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyZoom();
  }));
}
function applyZoom() {
  const r = REGIONS.find(z => z.id === state.zoom) || REGIONS[0];
  const vp = $('#zoomVp'), img = $('#zoomImg');
  const W = vp.clientWidth, H = vp.clientHeight;
  if (!W || !H) return;
  const k = Math.min(W / r.w, H / r.h);
  img.style.width = (D.meta.imgW * k) + 'px';
  img.style.height = 'auto';
  img.style.left = (-r.x * k + (W - r.w * k) / 2) + 'px';
  img.style.top = (-r.y * k + (H - r.h * k) / 2) + 'px';
  $('#zoomCap').textContent = '当前区域：' + r.name + '。' + r.cap;
}

/* ============================================================
   10. 表格
   ============================================================ */
function buildTables() {
  $('#peakTbl tbody').innerHTML = D.peaks.map(p => {
    const box = D.boxes.find(b => b.contains.indexOf(p.id) >= 0);
    return '<tr data-pid="' + p.id + '">' +
      '<td class="mono">' + p.id + '</td>' +
      '<td class="n">' + fx(p.dH) + ' ±0.05</td>' +
      '<td class="n">' + fN(p.dN) + ' ±1.5</td>' +
      '<td class="n">' + p.h + ' px　<span style="color:var(--dim)">' + Math.round(relIntensity(p) * 100) + '%</span></td>' +
      '<td>' + (box ? box.label : '未加框') + '</td>' +
      '<td>' + srcBadge('observe') + '</td></tr>';
  }).join('');
  $$('#peakTbl tbody tr').forEach(tr => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => { const p = D.peaks.find(x => x.id === tr.dataset.pid); state.dH = +p.dH.toFixed(2); state.dN = p.dN; syncSliders(); render(); });
  });

  $('#boxTbl tbody').innerHTML = D.boxes.map(b =>
    '<tr><td style="color:' + b.color + '">' + b.label + '</td>' +
    '<td class="n">' + fx(b.dH[0]) + ' – ' + fx(b.dH[1]) + '</td>' +
    '<td class="n">' + fN(b.dN[0]) + ' – ' + fN(b.dN[1]) + '</td>' +
    '<td class="mono">' + b.contains.join('、') + '</td>' +
    '<td>' + b.note + '</td></tr>').join('');

  const wname = { vw: '极弱', w: '弱', m: '中', s: '强' };
  $('#projTbl tbody').innerHTML = D.projection.map(p => {
    const hits = D.peaks.filter(q => Math.abs(q.dH - p.dH) <= 0.12).map(q => q.id);
    const note = hits.length
      ? '与 2D 交叉峰 <span class="mono">' + hits.join('、') + '</span> 的 δ<sub>H</sub> 一致'
      : '<span style="color:var(--dim)">二维图上无 δ<sub>H</sub> 对应的交叉峰</span>';
    return '<tr><td class="n">' + fx(p.dH) + '</td><td class="n">' + p.h.toFixed(1) + ' px</td><td>' + wname[p.w] + '</td><td>' + note + '</td></tr>';
  }).join('') +
    '<tr><td class="n">4.30 – 4.80</td><td class="n">无可见峰</td><td>—</td><td><span style="color:var(--warn)">此区间一维投影无峰，但二维图上有一个交叉峰 P6（δ<sub>H</sub>≈4.56）</span></td></tr>' +
    '<tr><td class="n">2.10 – 2.45</td><td class="n">无可见峰</td><td>—</td><td><span style="color:var(--warn)">此区间一维投影无峰，但二维图上有一个极弱峰 P7（δ<sub>H</sub>≈2.26）</span></td></tr>';

  $('#srcTextTbl').innerHTML =
    '<tr><td>标题</td><td>' + D.sourceText.title.en + '</td><td>' + D.sourceText.title.zh + '</td></tr>' +
    D.sourceText.bullets.map((b, i) =>
      '<tr><td>要点 ' + (i + 1) + '</td><td>' + b.en + '</td><td>' + b.zh +
      '<br><span class="footnote">词条：' + Object.keys(b.terms).map(k => k + ' → ' + b.terms[k]).join('；') + '</span></td></tr>').join('');

  $('#glossTbl tbody').innerHTML = D.glossary.map(g =>
    '<tr id="gl-' + g.id + '"><td>' + termHTML(g.id) + '</td><td class="mono" style="font-size:12px">' + g.e + '</td><td>' + g.d + '</td></tr>').join('');
}

/* ============================================================
   11. 分步推理 / 数值核对 / 常见误区
   ============================================================ */
function buildNarrative() {
  const steps = [
    ['第 1 步', '读标题，确定实验类型', '原图标题 <em>Additional Nuclei</em>（"其他核"）＋ 正文 "proton nitrogen HMBC"，可直接判定这是一张 [[HMBC]]：横轴氢、纵轴氮、检测远程 H–N 耦合。', 'observe'],
    ['第 2 步', '读横轴', '横轴刻度 7, 6, 5, 4, 3, 2, 1，绘图框实际覆盖 δ<sub>H</sub> ≈ ' + fx(D.frameRange.dH[0]) + ' 至 ' + fx(D.frameRange.dH[1]) + ' ppm。这个范围属于 [[delta]] 的常见区间，进一步印证横轴是氢。', 'observe'],
    ['第 3 步', '读纵轴（最容易出错的一步）', '纵轴标注 −320 在上、−240 在下，说明 δ<sub>N</sub> 向下增大。绘图框覆盖 δ<sub>N</sub> ≈ ' + fN(D.frameRange.dN[0]) + ' 至 ' + fN(D.frameRange.dN[1]) + ' ppm。数值全为负，与"以液氨或硝基甲烷为参照时胺/酰胺氮落在负值区"的常识相符（原图未标注参照物）。', 'observe'],
    ['第 4 步', '读结构式', '右侧结构式：[[benziso]]（含 S、N）— [[pip]]（两个 N）— 乙基链 — [[oxindole]]（[[lactam]] N–H、C=O、C–Cl）。逐原子计数得分子式 C<sub>21</sub>H<sub>21</sub>ClN<sub>4</sub>OS，含 <b>4 个氮</b>。', 'infer'],
    ['第 5 步', '数交叉峰', '逐像素检测后共可辨 <b>10 个</b>[[cross]]：芳香区 5 个（δ<sub>H</sub> 6.59–7.38）、脂肪区 4 个（δ<sub>H</sub> 1.44–2.27）、孤立 1 个（δ<sub>H</sub> ≈ 4.56）。全部落在 δ<sub>N</sub> −264 至 −316 之间。', 'observe'],
    ['第 6 步', '看原图的手工标注', '红椭圆圈出 δ<sub>H</sub>≈6.86 / δ<sub>N</sub>≈−309 的<b>单个</b>峰；蓝色虚线框圈出芳香区 4 个峰；紫色实线框圈出 δ<sub>H</sub>≈1.75 / δ<sub>N</sub>≈−271 的<b>最强</b>峰。三者用了三种不同的视觉编码（椭圆 / 虚线 / 实线），说明作者在区分三类信息。', 'observe'],
    ['第 7 步', '把二维交叉峰的 δ<sub>H</sub> 与[[proj]]对照', '10 个交叉峰里有 <b>8 个</b>能在一维投影上找到对应峰（偏差 ≤0.12 ppm）；但 P6（δ<sub>H</sub>≈4.56）与 P7（δ<sub>H</sub>≈2.26，极弱峰）在投影上<b>找不到</b>对应峰——这两处的一维投影几乎是平的。这是一个必须在结论里保留的疑点。', 'observe'],
    ['第 8 步', '给出可负责的结论', '这张 ¹H–¹⁵N HMBC 提供了通过氮原子的远程 H–N 相关信息，可用于确定分子中氮的周边连接关系，从而帮助阐明齐拉西酮降解产物的结构。但<b>单凭这张图不能</b>给出完整归属，也<b>不能</b>证明某个具体结构——原图本身也没有给出这些。', 'infer']
  ];
  $('#stepHost').innerHTML = steps.map(s =>
    '<div class="step"><div class="sh">' + s[0] + '</div><h3 style="margin:2px 0 4px">' + s[1] + '　' + srcBadge(s[3]) + '</h3><p style="margin:0">' + s[2] + '</p></div>').join('');

  /* 数值核对 */
  const dx = [], dy = [];
  for (let i = 1; i < D.calib.xTicksPx.length; i++) dx.push(D.calib.xTicksPx[i] - D.calib.xTicksPx[i - 1]);
  for (let i = 1; i < D.calib.yTicksPx.length; i++) dy.push(D.calib.yTicksPx[i] - D.calib.yTicksPx[i - 1]);
  const rng = a => (Math.max.apply(null, a) - Math.min.apply(null, a)).toFixed(1);
  const r2 = (xs, ys) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    return (sxy * sxy) / (sxx * syy);
  };
  const r2x = r2(D.calib.xTicksPx, D.calib.xTicksPpm), r2y = r2(D.calib.yTicksPx, D.calib.yTicksPpm);
  const cons = D.peaks.map(p => {
    const pm = projMatch(p.dH), ok = pm.diff <= 0.12;
    return '<tr><td class="mono">' + p.id + '</td><td class="n">' + fx(p.dH) + '</td><td class="n">' + fx(pm.peak.dH) + '</td>' +
      '<td class="n">' + fx(pm.diff) + '</td><td>' + (ok ? '<span style="color:var(--ok)">一致</span>' : '<span style="color:var(--warn)">不一致</span>') + '</td></tr>';
  }).join('');

  const checks = [
    ['横轴刻度线性度', '原图横轴 7 个主刻度的像素间距为 ' + dx.map(v => v.toFixed(1)).join(', ') + ' px，极差 ' + rng(dx) + ' px。换算成 ppm：' + rng(dx) + ' px ÷ ' + fx(Math.abs(D.calib.pxPerPpmH)) + ' px/ppm ≈ ' + (parseFloat(rng(dx)) / Math.abs(D.calib.pxPerPpmH)).toFixed(3) + ' ppm。线性回归 R² = ' + r2x.toFixed(6) + '，可视为严格线性。', 'observe'],
    ['纵轴刻度线性度', '纵轴 9 个主刻度的像素间距为 ' + dy.map(v => v.toFixed(1)).join(', ') + ' px，极差 ' + rng(dy) + ' px。换算成 ppm：' + rng(dy) + ' px ÷ ' + fx(Math.abs(D.calib.pxPerPpmN), 3) + ' px/ppm ≈ ' + (parseFloat(rng(dy)) / Math.abs(D.calib.pxPerPpmN)).toFixed(2) + ' ppm。R² = ' + r2y.toFixed(6) + '。', 'observe'],
    ['单位与量纲核对', '化学位移 δ = (ν<sub>sample</sub> − ν<sub>ref</sub>)/ν<sub>ref</sub> × 10⁶，是无量纲相对量，单位写作 [[ppm]]。横轴 δ<sub>H</sub> 与纵轴 δ<sub>N</sub> 共用同一个 ppm 定义，但两者参照物不同，<b>数值不可直接比较</b>。', 'theory'],
    ['二维 ↔ 一维 δ<sub>H</sub> 一致性', '理论上每个交叉峰的 δ<sub>H</sub> 都应等于一维 ¹H 谱上某个峰的位置。本图 10 个交叉峰中有 8 个满足（偏差 ≤0.12 ppm，在估读误差内）；<b>P6（δ<sub>H</sub>≈4.56）与 P7（δ<sub>H</sub>≈2.26）不满足</b>。', 'observe'],
    ['分子式与不饱和度', '由结构式逐原子计数：C 21、H 21、Cl 1、N 4、O 1、S 1 → C<sub>21</sub>H<sub>21</sub>ClN<sub>4</sub>OS，相对分子质量 ' + D.formula.mW + '。不饱和度 DBE = (2×21 + 2 + 4 − 21 − 1)/2 = <b>' + D.formula.dbe + '</b>。', 'theory'],
    ['不饱和度逐环核对', D.formula.dbeDetail.join('；') + '。与 DBE = ' + D.formula.dbe + ' 一致。', 'theory'],
    ['氢原子计数核对', D.formula.hCount.join('；') + '。与分子式中的 21 个 H 一致。', 'theory'],
    ['¹⁵N 窗口覆盖核对', '本图纵轴窗口约 ' + fN(D.frameRange.dN[0]) + ' 至 ' + fN(D.frameRange.dN[1]) + ' ppm，观测到的交叉峰落在 δ<sub>N</sub> −264 至 −316。若分子中某个氮的化学位移落在窗口之外，它<b>不会</b>出现在这张图上——"图上没有"不等于"分子里没有"。', 'observe'],
    ['演示模型：边界情形', 'Δ₂ 滑块范围 20–250 ms，对应理论最佳 J = 1/(2Δ₂) = ' + (1 / (2 * 0.020)).toFixed(0) + ' – ' + (1 / (2 * 0.250)).toFixed(0) + ' Hz。当 Δ₂ = ' + D.model.deltaDefault + ' ms 时 J ≈ ' + (1 / (2 * D.model.deltaDefault / 1000)).toFixed(2) + ' Hz。', 'model'],
    ['演示模型：应保持不变的关系', '纯正弦项 |sin(π·J·Δ₂)| 在 Δ₂ = 1/(2J) 处取极大；叠加指数弛豫项 exp(−2Δ₂/T₂) 后，实际极大点总是<b>略短于</b> 1/(2J)（本模型下比值约 0.88–0.93），且 Δ₂ 越大弛豫衰减越强。把 Δ₂ 固定在任一值，逐峰强度只随该峰假定的 J 变化——这条单调关系与滑块无关，是本页模型的不变量。', 'model']
  ];
  $('#checkHost').innerHTML = checks.map(c =>
    '<div class="srcbox" style="margin:8px 0"><h3 style="margin:0 0 4px">' + c[0] + '　' + srcBadge(c[2]) + '</h3><p style="margin:0">' + c[1] + '</p></div>').join('') +
    '<h3 style="margin-top:14px">二维交叉峰 δ<sub>H</sub> 与一维投影对照表</h3>' +
    '<div class="tblwrap"><table><thead><tr><th>峰</th><th class="n">2D δ<sub>H</sub></th><th class="n">1D 最近投影峰</th><th class="n">Δ (ppm)</th><th>判定</th></tr></thead><tbody>' + cons + '</tbody></table></div>';

  const pitfalls = [
    ['把纵轴读成正数', '纵轴 −320 在上、−240 在下，全部是负值。读成 +309 会让"更负的氮"变成"更正"，直接颠倒化学结论。', 'observe'],
    ['以为一个 ¹⁵N 峰就是一个氮原子', '本图 δ<sub>N</sub> −270 附近密集出现 4 个交叉峰，而分子里只有 4 个氮。[[abund]]仅约 0.37 %，二维谱在氮维的采样点数通常很少，峰在纵向上被拉宽，同一个氮可以表现为一列很"胖"的响应。因此<b>不能</b>用峰列数反推氮原子数。', 'theory'],
    ['把交叉峰高度当定量数据', 'HMBC 的峰强同时受[[J]]与[[delay]]的匹配程度、以及弛豫过程调制。本页"估读强度"一列只是像素高度，<b>不能</b>用来做浓度或比例计算。', 'theory'],
    ['以为 HMBC 是"一键相关"', 'HMBC 检测的是跨越 2–3 根键的远程耦合，不是直接相连。所以图上一个点表示"这个氢和这个氮之间隔着 2–3 根键"，而不是"这个氢连在这个氮上"。', 'theory'],
    ['默认二维交叉峰的 δ<sub>H</sub> 一定等于一维谱峰位', '本图 10 个交叉峰里有 2 个（P6 δ<sub>H</sub>≈4.56、P7 δ<sub>H</sub>≈2.26）在一维投影上找不到对应峰。遇到这种情况应当存疑，而不是硬把最近的投影峰拉过来解释。', 'observe'],
    ['以为"降解产物"的结构已经确定', '原图只给了一句"帮助阐明一个降解产物"，以及一个骨架结构式。降解产物的确切结构、位点、以及这张谱图具体排除了哪些候选结构，原图都没有写。', 'observe'],
    ['把本页的重建图当成原始实验曲线', '本页的散点图是按原图[[est]]的峰位重画的<b>示意图</b>；峰的大小来自像素高度，不是真实信号强度；顶部一维投影也是按估读峰位用洛伦兹线型合成的。任何定量分析都不能基于这张重建图。', 'model'],
    ['忽略溶剂与杂质峰', '原图未标注氘代溶剂，一维投影上 δ<sub>H</sub> ≈ 5.30、2.50 等位置存在弱峰，无法从图上判断是样品信号还是残余溶剂。背景文献也提到样品中乙酰胺污染严重。', 'observe']
  ];
  $('#pitfallHost').innerHTML = pitfalls.map((p, i) =>
    '<div class="warnbox" style="margin:8px 0"><h3>误区 ' + (i + 1) + '：' + p[0] + '　' + srcBadge(p[2]) + '</h3><p style="margin:0">' + p[1] + '</p></div>').join('');

  $('#citeText').textContent = D.externalRef.cite;
  $('#refPoints').innerHTML = D.externalRef.points.map(p => '<li>' + p + '</li>').join('');
  $('#unknownList').innerHTML = D.unknowns.map(p => '<li>' + p + '</li>').join('');
}

/* ============================================================
   12. 图例
   ============================================================ */
function buildLegend() {
  $('#legend').innerHTML = Object.keys(GRP).map(k => {
    const g = GRP[k];
    return '<span><i style="border-color:' + g.color + ';background:' + g.color + '"></i>' + g.label + '</span>';
  }).join('') + '<span><i style="border-color:#5fd0a8;background:transparent;border-radius:50%"></i>绿色虚线圆 = 当前选中</span>';
}

/* ============================================================
   13. 启动
   ============================================================ */
function boot() {
  $('#goalText').textContent = D.meta.goal;
  buildLists(); buildStruct(); buildFG(); buildTables(); buildNarrative(); buildLegend();
  buildZoomBtns(); bindSliders(); bindReconKeys();
  processTerms(document.body);
  syncSliders();
  render();
  window.addEventListener('resize', applyZoom);
  if (window.ResizeObserver) new ResizeObserver(applyZoom).observe($('#zoomVp'));
  requestAnimationFrame(applyZoom);
  document.documentElement.setAttribute('data-ready', '1');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
