/* ==========================================================================
   ADEQUATE 交互教学页 · 逻辑
   数据分层：
     【原图观测】= 幻灯片上可读到的文字与骨架
     【结构辅助推断】= 由骨架推出的连接性 / 对称性
     【理论计数】= 可严格计算的数目（碳数、分子式、可观测性判定）
     【演示模型】= 示意化学位移、转移效率、灵敏度指数（非实测）
   ========================================================================== */
'use strict';
(function () {

/* ---------------------------------------------------------------- 1. 数据 */

/* 15 个碳原子。坐标为本页重绘示意骨架（非原图像素坐标）。 */
const CARBONS = [
  {n:1,  x:325, y:172, k:'Cq',  nH:0, grp:'ring',  role:'苯环 ipso（连烷基侧链）', eq:null, dC:141.5},
  {n:2,  x:375, y:172, k:'CH',  nH:1, grp:'ring',  role:'苯环 CH（与 C6 等价）',    eq:6,    dC:129.0},
  {n:3,  x:400, y:215, k:'CH',  nH:1, grp:'ring',  role:'苯环 CH（与 C5 等价）',    eq:5,    dC:128.5},
  {n:4,  x:375, y:258, k:'Cq',  nH:0, grp:'ring',  role:'苯环 ipso（连苄位 CH2）',  eq:null, dC:134.5},
  {n:5,  x:325, y:258, k:'CH',  nH:1, grp:'ring',  role:'苯环 CH（与 C3 等价）',    eq:3,    dC:128.5},
  {n:6,  x:300, y:215, k:'CH',  nH:1, grp:'ring',  role:'苯环 CH（与 C2 等价）',    eq:2,    dC:129.0},
  {n:7,  x:322, y:94,  k:'CH2', nH:2, grp:'ch2oh', role:'羟甲基 CH2OH 的碳',        eq:null, dC:66.5},
  {n:8,  x:292, y:126, k:'CH',  nH:1, grp:'chain', role:'侧链次甲基（连苯环与 CH2OH）', eq:null, dC:39.5},
  {n:9,  x:258, y:148, k:'CH2', nH:2, grp:'chain', role:'侧链 CH2',                eq:null, dC:45.0},
  {n:10, x:226, y:122, k:'CH',  nH:1, grp:'chain', role:'侧链次甲基（连两个甲基）', eq:null, dC:25.5},
  {n:11, x:190, y:134, k:'CH3', nH:3, grp:'chain', role:'端甲基',                   eq:null, dC:22.5},
  {n:12, x:232, y:164, k:'CH3', nH:3, grp:'chain', role:'支链甲基',                 eq:null, dC:20.5},
  {n:13, x:406, y:296, k:'CH2', nH:2, grp:'ester', role:'苄位 CH2（两侧均为季碳）', eq:null, dC:40.5},
  {n:14, x:440, y:318, k:'Cq',  nH:0, grp:'ester', role:'酯羰基 C=O',              eq:null, dC:172.0},
  {n:15, x:508, y:354, k:'CH3', nH:3, grp:'ester', role:'甲氧基 OCH3 的碳（被氧隔断）', eq:null, dC:52.0}
];

/* 杂原子（非碳，仅作骨架标注） */
const HET = {
  O1:{x:352, y:82,  label:'OH', cls:'het'},
  O2:{x:462, y:294, label:'O',  cls:'het'},
  O3:{x:474, y:346, label:'O',  cls:'het'}
};

/* 键表：t = ar（芳环）/ single / double */
const BONDS = [
  {a:1,b:2,t:'ar'},{a:2,b:3,t:'ar'},{a:3,b:4,t:'ar'},
  {a:4,b:5,t:'ar'},{a:5,b:6,t:'ar'},{a:6,b:1,t:'ar'},
  {a:1,b:8,t:'single'},{a:8,b:7,t:'single'},{a:7,b:'O1',t:'single'},
  {a:8,b:9,t:'single'},{a:9,b:10,t:'single'},
  {a:10,b:11,t:'single'},{a:10,b:12,t:'single'},
  {a:4,b:13,t:'single'},{a:13,b:14,t:'single'},
  {a:14,b:'O2',t:'double'},{a:14,b:'O3',t:'single'},{a:'O3',b:15,t:'single'}
];

/* 典型 ¹J(CC)（文献典型值，示意；非实测） */
const J_TYPICAL = {
  ar:57, C1_C8:36, C4_C13:36, C13_C14:40, C8_C7:35, sp3:34
};

/* 对象（片段）选择 */
const GROUPS = [
  {id:'ring',  name:'苯环',        sub:'C1–C6 · 2 个季碳 + 4 个 CH',        atoms:[1,2,3,4,5,6], het:[]},
  {id:'chain', name:'烷基侧链',    sub:'C8–C12 · 全部带氢',                 atoms:[8,9,10,11,12], het:[]},
  {id:'ch2oh', name:'羟甲基 –CH₂OH', sub:'C7 + O1',                          atoms:[7], het:['O1']},
  {id:'ester', name:'酯基 –CO₂CH₃', sub:'C13、C14 + O2、O3 + C15',            atoms:[13,14,15], het:['O2','O3']},
  {id:'ome',   name:'甲氧基 –OCH₃', sub:'C15 + O3（被氧隔断）',               atoms:[15], het:['O3']}
];

/* 13 个独立的 ¹³C 信号（等价碳合并）。dC 为文献典型值，仅作示意。 */
const SIGNALS = [
  {id:'C14',   atoms:[14],   k:'Cq',  dC:172.0},
  {id:'C1',    atoms:[1],    k:'Cq',  dC:141.5},
  {id:'C4',    atoms:[4],    k:'Cq',  dC:134.5},
  {id:'C2/C6', atoms:[2,6],  k:'CH',  dC:129.0},
  {id:'C3/C5', atoms:[3,5],  k:'CH',  dC:128.5},
  {id:'C7',    atoms:[7],    k:'CH2', dC:66.5},
  {id:'C15',   atoms:[15],   k:'CH3', dC:52.0},
  {id:'C9',    atoms:[9],    k:'CH2', dC:45.0},
  {id:'C13',   atoms:[13],   k:'CH2', dC:40.5},
  {id:'C8',    atoms:[8],    k:'CH',  dC:39.5},
  {id:'C10',   atoms:[10],   k:'CH',  dC:25.5},
  {id:'C11',   atoms:[11],   k:'CH3', dC:22.5},
  {id:'C12',   atoms:[12],   k:'CH3', dC:20.5}
];

/* 实验类型：hops = 沿 C–C 键的最大键数；needH = 另一端必须带氢 */
const EXPERIMENTS = {
  inad:  {key:'inad',  name:'INADEQUATE',   sub:'¹³C 直接检测 · 相邻 ¹³C–¹³C', hops:1, needH:false, gain:1,  gainNote:'基准'},
  adeq11:{key:'adeq11',name:'1,1-ADEQUATE', sub:'¹H 检测 · 相邻碳',            hops:1, needH:true,  gain:30, gainNote:'¹H 检测增益（示意 ×30）'},
  adeq1n:{key:'adeq1n',name:'1,n-ADEQUATE', sub:'¹H 检测 · 2–3 键',            hops:3, needH:true,  gain:6,  gainNote:'¹H 检测但长程效率低（示意 ×6）'}
};

/* 术语（供正文注释与术语表共用） */
const TERMS = {
  adequate:{zh:'ADEQUATE', en:'ADequate DoublE QUAntum Transfer Experiment',
    d:'质子检测的 ¹³C–¹³C 相关实验。通过一次 ¹J(CH) 与一次 ¹J(CC) 把相邻两个碳关联起来，灵敏度远高于 INADEQUATE。m,n-ADEQUATE 中的 m、n 分别表示 ¹H→¹³C 与 ¹³C→¹³C 的键数。'},
  inadequate:{zh:'INADEQUATE', en:'Incredible Natural Abundance DoublE QUAntum Transfer Experiment',
    d:'直接在 ¹³C 通道检测的 ¹³C–¹³C 相关实验，不要求相关碳带氢，因此能看到季碳；但天然丰度下两个相邻 ¹³C 同时出现的概率仅约 0.01%，灵敏度极低。'},
  dq:{zh:'双量子（DQ）', en:'double quantum',
    d:'两个耦合核共同参与的相干态。ADEQUATE/INADEQUATE 的 F1 维编码的就是一对碳的双量子频率，因此谱图需要"换算"才能读成常规的 ¹³C 化学位移。'},
  jcc:{zh:'¹J(CC)', en:'one-bond carbon–carbon coupling',
    d:'相邻两个碳之间的一键耦合常数。单键约 34–45 Hz，双键约 65 Hz，电负性取代基会使其增大。实验的延迟 Δ 需按设定值 1/(4J) 调谐。'},
  jch:{zh:'¹J(CH)', en:'one-bond carbon–proton coupling',
    d:'碳与其直接相连氢之间的一键耦合常数，sp³ 碳约 125 Hz，sp² 约 160 Hz。质子检测实验靠它把 ¹H 极化转移到 ¹³C 或把 ¹³C 相干转回 ¹H。'},
  quat:{zh:'季碳', en:'quaternary carbon',
    d:'不直接连接氢的碳（如取代芳碳、羰基碳）。它在 ¹H 检测实验里没有自己的质子可用于起始或回传极化，因此能否被观测取决于其相邻碳是否带氢。'},
  protonated:{zh:'质子化碳', en:'protonated carbon',
    d:'至少带一个氢的碳，即 CH、CH₂、CH₃。它可以直接参与 ¹J(CH) 极化转移，是 ¹H 检测实验的"入口"。'},
  natab:{zh:'天然丰度', en:'natural abundance',
    d:'¹³C 在自然界中的丰度约为 1.1%。需要两个相邻碳都是 ¹³C 的实验，其成对概率约为 (1.1%)² ≈ 1.2×10⁻⁴，即约万分之一。'},
  hsqc:{zh:'HSQC', en:'heteronuclear single-quantum correlation',
    d:'把氢与其直接相连的碳关联起来的 ¹H–¹³C 二维实验，用于确定每个氢挂在哪个碳上，并读出碳的化学位移。灵敏度高，是归属的常规第一步。'},
  hmbc:{zh:'HMBC', en:'heteronuclear multiple-bond correlation',
    d:'把氢与 2–3 键之外的碳关联起来的 ¹H–¹³C 二维实验。它能看到季碳，是补足 ADEQUATE 盲区的常用手段；缺点是相关距离不唯一。'},
  dept:{zh:'DEPT', en:'distortionless enhancement by polarization transfer',
    d:'一维 ¹³C 实验，用脉冲角度区分 CH、CH₂、CH₃；季碳不出峰。用于快速确定每个碳的氢数。'},
  equiv:{zh:'化学等价', en:'chemical equivalence',
    d:'分子内通过对称操作可以互相重合的原子，具有完全相同的化学位移，在任何谱图中都只给一个信号，无法被区分。'},
  symmetry:{zh:'对称面', en:'mirror plane',
    d:'使分子与自身重合的镜面。本分子的对位取代苯环存在一个包含两个取代基的镜面，把 C2↔C6、C3↔C5 互换，从而造成等价。'},
  assignment:{zh:'归属', en:'assignment',
    d:'把谱图中的每一个信号对应到分子中具体的原子。对 ¹³C 归属而言，就是确定每个碳的化学位移。'},
  crews:{zh:'Crews 规则', en:"Crews' rule",
    d:'一条经验规则：当分子中杂原子过多、把碳骨架切成许多被杂原子隔断的小片段时，基于 ¹J(CC) 的 ADEQUATE/INADEQUATE 会因缺少 C–C 连接而难以拼出完整结构。'},
  ipso:{zh:'ipso 碳', en:'ipso carbon',
    d:'芳环上直接连着取代基的那个环碳。它是季碳（无氢），在 ¹H 检测实验中只能作为"被相关碳"出现。'},
  sig:{zh:'信号', en:'signal',
    d:'谱图中出现的一组吸收峰。化学等价的原子共用一个信号，因此 15 个碳原子只给出 13 个 ¹³C 信号。'}
};

/* ------------------------------------------------------------ 2. 工具函数 */

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function pos(id) {
  if (typeof id === 'number') {
    const c = CARBONS.find(v => v.n === id);
    return { x:c.x, y:c.y };
  }
  return { x:HET[id].x, y:HET[id].y };
}
function carbon(n) { return CARBONS.find(c => c.n === n); }
function nHof(n) { const c = carbon(n); return c ? c.nH : 0; }
function ccNeighbors(n) {
  const out = [];
  BONDS.forEach(b => {
    if (typeof b.a !== 'number' || typeof b.b !== 'number') return;
    if (b.a === n) out.push(b.b);
    else if (b.b === n) out.push(b.a);
  });
  return out;
}
function hasCC(n) { return ccNeighbors(n).length > 0; }
function jccOf(b) {
  if (b.t === 'ar') return J_TYPICAL.ar;
  const s = [b.a, b.b].join('-');
  if (s === '1-8' || s === '8-1') return J_TYPICAL.C1_C8;
  if (s === '4-13' || s === '13-4') return J_TYPICAL.C4_C13;
  if (s === '13-14' || s === '14-13') return J_TYPICAL.C13_C14;
  if (s === '8-7' || s === '7-8') return J_TYPICAL.C8_C7;
  return J_TYPICAL.sp3;
}
/* 演示模型：转移效率 E = sin²(π · J_actual · Δ)，Δ = 1/(4·J_set) */
function transferEff(jActual, jSet) {
  const d = 1 / (4 * jSet);           // s
  const x = Math.PI * jActual * d;
  return Math.pow(Math.sin(x), 2);
}
/* 可达性判定：沿 C–C 键 hops 步内能否到达一个（带氢的）碳 */
function reachable(n, hops, needH) {
  let frontier = [n];
  const seen = new Set([n]);
  for (let d = 0; d < hops; d++) {
    const next = [];
    frontier.forEach(x => ccNeighbors(x).forEach(y => {
      if (!seen.has(y)) { seen.add(y); next.push(y); }
    }));
    frontier = next;
    if (!frontier.length) break;
  }
  const others = [...seen].filter(x => x !== n);
  if (!others.length) return false;
  if (!needH) return true;
  return others.some(x => nHof(x) > 0);
}

/* ------------------------------------------------------------ 3. 状态 */

const state = {
  exp: 'adeq11',
  enrich: 1.1,      // %
  jset: 55,         // Hz
  showNum: true,
  hlQuat: false,
  sel: { type:'none', id:null }
};

function curExp() { return EXPERIMENTS[state.exp]; }
function visible(n) { const e = curExp(); return reachable(n, e.hops, e.needH); }
function pairProb() { const a = state.enrich / 100; return a * a; }
/* 参考态：1,1-ADEQUATE + 天然丰度 + J_set = 55 Hz，令其相对强度指数 = 100 */
const EFF_REF = (function () {
  const v = BONDS.filter(b => typeof b.a === 'number' && typeof b.b === 'number')
                 .map(b => transferEff(jccOf(b), 55));
  return v.reduce((s, x) => s + x, 0) / v.length;
})();
const P_REF = Math.pow(0.011, 2);
function meanEff() {
  const vals = BONDS.filter(b => typeof b.a === 'number' && typeof b.b === 'number')
                    .map(b => transferEff(jccOf(b), state.jset));
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
function maxEffOf(n) {
  const vals = BONDS.filter(b => (b.a === n && typeof b.b === 'number') || (b.b === n && typeof b.a === 'number'))
                    .map(b => transferEff(jccOf(b), state.jset));
  return vals.length ? Math.max(...vals) : 0;
}
function isSelectedCarbon(n) { return state.sel.type === 'carbon' && state.sel.id === n; }
function inSelectedGroup(n) {
  if (state.sel.type !== 'group') return false;
  const g = GROUPS.find(x => x.id === state.sel.id);
  return !!g && g.atoms.indexOf(n) >= 0;
}
function selGroupOfCarbon(n) {
  if (state.sel.type !== 'carbon') return null;
  return GROUPS.find(g => g.atoms.indexOf(n) >= 0) || null;
}

/* ------------------------------------------------------- 4. 分子图渲染 */

const SVG_MOL = document.getElementById('mol');
const TIP = document.getElementById('tip');

function renderMolecule() {
  /* 重建会销毁旧节点，先记住当前聚焦的碳，重建后还原焦点（键盘可用性） */
  const ae = document.activeElement;
  const keepFocus = (ae && ae.classList && ae.classList.contains('cnode'))
    ? ae.getAttribute('data-n') : null;

  while (SVG_MOL.firstChild) SVG_MOL.removeChild(SVG_MOL.firstChild);

  /* 芳环内圈双键：1-2、3-4、5-6 */
  const ringDouble = [[1,2],[3,4],[5,6]];
  const center = { x:350, y:215 };

  /* --- 键 --- */
  BONDS.forEach(b => {
    const p = pos(b.a), q = pos(b.b);
    const isCC = typeof b.a === 'number' && typeof b.b === 'number';
    const detected = isCC && (nHof(b.a) > 0 || nHof(b.b) > 0);  // 1,1-ADEQUATE 能否给出该键的交叉峰
    const eff = transferEff(jccOf(b), state.jset);
    let cls = 'molbond';
    if (b.t === 'ar') cls += ' ar';
    if (b.t === 'double') cls += ' carbonyl';
    if (isCC) {
      /* INADEQUATE 直接在 ¹³C 通道检测，任何 C–C 键都能成对；ADEQUATE 需要一端带氢 */
      const ok = (state.exp === 'inad') ? true : detected;
      cls += ok ? ' bond-obs' : ' bond-miss';
    }
    const line = el('line', {x1:p.x, y1:p.y, x2:q.x, y2:q.y, 'class':cls});
    if (isCC) {
      line.style.strokeWidth = (1.5 + 2.6 * eff).toFixed(2);
      line.style.opacity = (0.35 + 0.65 * Math.min(1, eff / 0.5)).toFixed(2);
    }
    SVG_MOL.appendChild(line);

    /* 芳环内圈线 */
    if (b.t === 'ar' && ringDouble.some(d =>
        (d[0] === b.a && d[1] === b.b) || (d[0] === b.b && d[1] === b.a))) {
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
      let nx = -dy / L, ny = dx / L;
      const cx = center.x - p.x, cy = center.y - p.y;
      if (nx * cx + ny * cy < 0) { nx = -nx; ny = -ny; }
      const off = 5.5;
      SVG_MOL.appendChild(el('line', {
        x1: p.x + dx * 0.16 + nx * off, y1: p.y + dy * 0.16 + ny * off,
        x2: p.x + dx * 0.84 + nx * off, y2: p.y + dy * 0.84 + ny * off,
        'class':'molbond in'
      }));
    }
    /* C=O 第二条线 */
    if (b.t === 'double') {
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L, off = 4;
      SVG_MOL.appendChild(el('line', {
        x1: p.x + dx * 0.12 + nx * off, y1: p.y + dy * 0.12 + ny * off,
        x2: p.x + dx * 0.88 + nx * off, y2: p.y + dy * 0.88 + ny * off,
        'class':'molbond carbonyl'
      }));
    }
  });

  /* --- 杂原子标签 --- */
  Object.keys(HET).forEach(id => {
    const h = HET[id];
    const t = el('text', {x:h.x, y:h.y, 'class':'atomlabel het'});
    t.textContent = h.label;
    SVG_MOL.appendChild(t);
  });

  /* --- 甲基等端基文字标签 --- */
  const extra = [
    {x:158, y:140, s:'H₃C', anchor:'end'},
    {x:232, y:190, s:'CH₃', anchor:'middle'},
    {x:534, y:358, s:'CH₃', anchor:'start'}
  ];
  extra.forEach(t => {
    const e = el('text', {x:t.x, y:t.y, 'class':'atomlabel', 'text-anchor':t.anchor});
    e.textContent = t.s;
    SVG_MOL.appendChild(e);
  });

  /* --- 碳节点 --- */
  CARBONS.forEach(c => {
    const vis = visible(c.n);
    const st = vis ? 'obs' : 'miss';
    const g = el('g', {
      'class':'cnode', 'data-n':c.n, 'data-st':st,
      'data-sel': isSelectedCarbon(c.n) ? '1' : '0',
      tabindex:'0', role:'button',
      'aria-label': '碳 ' + c.n + '，' + kindZh(c.k) + '，' + c.role +
                    '；当前实验下' + (vis ? '在 ¹³C 维出现' : '不在 ¹³C 维出现')
    });
    g.appendChild(el('circle', {cx:c.x, cy:c.y, r:15, 'class':'halo'}));
    g.appendChild(el('circle', {cx:c.x, cy:c.y, r:9.6, 'class':'ring'}));
    const t = el('text', {x:c.x, y:c.y + 0.5, 'class':'tnum'});
    t.textContent = c.n;
    g.appendChild(t);
    if (!state.showNum) { t.setAttribute('opacity', '0'); }
    g.addEventListener('click', () => select({ type:'carbon', id:c.n }));
    g.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select({ type:'carbon', id:c.n }); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); focusCarbon(c.n, 1); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); focusCarbon(c.n, -1); }
    });
    g.addEventListener('mouseenter', ev => showTip(ev, c.n));
    g.addEventListener('focus', ev => showTip(ev, c.n));
    g.addEventListener('mouseleave', hideTip);
    g.addEventListener('blur', hideTip);
    SVG_MOL.appendChild(g);
  });

  /* 高亮片段 */
  if (state.hlQuat) {
    CARBONS.filter(c => c.nH === 0).forEach(c => {
      const g = SVG_MOL.querySelector('.cnode[data-n="' + c.n + '"]');
      if (g) g.querySelector('.ring').setAttribute('stroke-dasharray', '3 2');
    });
  }
  if (state.sel.type === 'group') {
    const g = GROUPS.find(x => x.id === state.sel.id);
    if (g) g.atoms.forEach(n => {
      const node = SVG_MOL.querySelector('.cnode[data-n="' + n + '"]');
      if (node) node.setAttribute('data-sel', '1');
    });
  }

  if (keepFocus) {
    const back = SVG_MOL.querySelector('.cnode[data-n="' + keepFocus + '"]');
    if (back) back.focus({ preventScroll: true });
  }
}
function kindZh(k) {
  return k === 'Cq' ? '季碳' : k === 'CH' ? 'CH' : k === 'CH2' ? 'CH₂' : 'CH₃';
}
function focusCarbon(n, dir) {
  const i = CARBONS.findIndex(c => c.n === n);
  const j = (i + dir + CARBONS.length) % CARBONS.length;
  const node = SVG_MOL.querySelector('.cnode[data-n="' + CARBONS[j].n + '"]');
  if (node) node.focus();
}
function showTip(ev, n) {
  const c = carbon(n);
  if (!c) return;
  TIP.textContent = 'C' + c.n + ' · ' + kindZh(c.k) + ' · ' + c.role +
    ' · ' + (visible(c.n) ? '¹³C 维出现' : '¹³C 维不出现');
  TIP.hidden = false;
  const src = (ev && ev.currentTarget) ? ev.currentTarget : null;
  const r = src && src.getBoundingClientRect ? src.getBoundingClientRect()
                                            : { left:0, top:0, width:0, height:0, bottom:0 };
  const w = TIP.offsetWidth, hh = TIP.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = r.top - hh - 8;
  if (top < 8) top = r.bottom + 8;
  TIP.style.left = left + 'px';
  TIP.style.top = top + 'px';
}
function hideTip() { TIP.hidden = true; }

/* ------------------------------------------------------- 5. 信号列表 */

const SIGBOX = document.getElementById('siglist');
const SIGCOUNT = document.getElementById('sigcount');
function renderSignals() {
  while (SIGBOX.firstChild) SIGBOX.removeChild(SIGBOX.firstChild);
  let visN = 0;
  SIGNALS.forEach(s => {
    const rep = s.atoms[0];
    const vis = s.atoms.some(a => visible(a));
    if (vis) visN++;
    const eff = vis ? maxEffOf(rep) : 0;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'sigrow';
    row.setAttribute('data-st', vis ? 'obs' : 'miss');
    row.setAttribute('data-sel', (state.sel.type === 'carbon' && s.atoms.indexOf(state.sel.id) >= 0) ? '1' : '0');
    const eq = s.atoms.length > 1 ? ' <span class="eq">×2</span>' : '';
    row.innerHTML =
      '<span class="s-id">' + s.id + eq + '</span>' +
      '<span class="s-dc">' + s.dC.toFixed(1) + '</span>' +
      '<span class="s-bar"><span class="s-fill" style="width:' + (vis ? (eff * 100).toFixed(0) : 0) + '%"></span></span>' +
      '<span class="s-st">' + (vis ? '出现' : '不出现') + '</span>';
    row.setAttribute('aria-label', s.id + ' 号信号，δC 约 ' + s.dC.toFixed(1) + ' ppm（示意），' +
      (vis ? '在所选实验的 ¹³C 维出现' : '在所选实验的 ¹³C 维不出现'));
    row.addEventListener('click', () => select({ type:'carbon', id: rep }));
    SIGBOX.appendChild(row);
  });
  if (SIGCOUNT) SIGCOUNT.textContent = visN + ' / 13 出现';
}

/* ------------------------------------------------------- 6. 读数面板 */

const READ = document.getElementById('readout');
const DETAIL = document.getElementById('detail');

function renderReadout() {
  const e = curExp();
  const visCount = CARBONS.filter(c => visible(c.n)).length;
  const visSig = SIGNALS.filter(s => s.atoms.some(a => visible(a))).length;
  const P = pairProb();
  const eff = meanEff();
  READ.innerHTML =
    '<div class="grid2">' +
      '<div class="read"><div class="r-k">当前实验</div><div class="r-v" style="font-size:14px">' + e.name + '</div></div>' +
      '<div class="read"><div class="r-k">¹³C 维可见碳</div><div class="r-v">' + visCount + ' <small>/ 15</small></div></div>' +
      '<div class="read"><div class="r-k">可见独立信号</div><div class="r-v">' + visSig + ' <small>/ 13</small></div></div>' +
      '<div class="read"><div class="r-k">相邻 ¹³C 对概率</div><div class="r-v">' + fmtProb(P) + '</div></div>' +
      '<div class="read"><div class="r-k">¹J(CC) 设定</div><div class="r-v">' + state.jset.toFixed(0) + ' <small>Hz</small></div></div>' +
      '<div class="read"><div class="r-k">平均转移效率</div><div class="r-v">' + (eff * 100).toFixed(0) + '<small>%</small></div></div>' +
    '</div>' +
    '<div class="read" style="margin-top:9px"><div class="r-k">相对信号强度指数（示意）</div>' +
      '<div class="r-v">' + relIndex().toFixed(0) + ' <small>参考态 = 100</small></div></div>';
}
/* 相对强度指数：以 1,1-ADEQUATE + 天然丰度 + J=55 Hz 为 100 */
function relIndex() {
  const e = curExp();
  return 100 * (pairProb() / P_REF) * (e.gain / 30) * (meanEff() / EFF_REF);
}
function fmtProb(p) {
  if (p >= 0.01) return (p * 100).toFixed(1) + '<small>%</small>';
  return (p * 1e6).toFixed(1) + '<small>×10⁻⁶</small>';
}

function renderDetail() {
  const e = curExp();
  let h = '';
  if (state.sel.type === 'carbon') {
    const c = carbon(state.sel.id);
    const vis = visible(c.n);
    const g = selGroupOfCarbon(c.n);
    const nb = ccNeighbors(c.n);
    h += '<div class="explain">';
    h += '<b>选中：C' + c.n + '</b> <span class="tag tag-inf">结构辅助推断</span><br>' + c.role + '<br>';
    h += '<table class="mini-table"><tbody>';
    h += '<tr><th>碳类型</th><td>' + kindZh(c.k) + '（' + c.k + '）</td></tr>';
    h += '<tr><th>直接连氢数</th><td class="n">' + c.nH + '</td></tr>';
    h += '<tr><th>所属片段</th><td>' + (g ? g.name : '—') + '</td></tr>';
    h += '<tr><th>δC（示意）</th><td class="n">' + c.dC.toFixed(1) + ' ppm</td></tr>';
    h += '<tr><th>C–C 邻接</th><td>' + (nb.length ? nb.map(x => 'C' + x).join('、') : '无（被杂原子隔断）') + '</td></tr>';
    if (c.eq) h += '<tr><th>化学等价</th><td>与 C' + c.eq + ' 等价（只给一个信号）</td></tr>';
    h += '</tbody></table>';
    h += '<p style="margin-top:8px">在 <b>' + e.name + '</b> 下：' +
         (vis ? '<span class="hl">该碳出现在 ¹³C 维</span>' : '<span class="hlb">该碳不出现于 ¹³C 维</span>') + '</p>';
    h += '<ul><li>' + ruleText(c.n) + '</li>';
    if (nb.length) h += '<li>最强 C–C 键的转移效率（示意）：<span class="hl">' + (maxEffOf(c.n) * 100).toFixed(0) + '%</span></li>';
    h += '</ul>';
    if (!vis) h += '<p style="margin-top:6px">补救手段：用 ' + rescue(c.n) + '</p>';
    h += '</div>';
  } else if (state.sel.type === 'group') {
    const g = GROUPS.find(x => x.id === state.sel.id);
    const atoms = g.atoms;
    const visA = atoms.filter(n => visible(n));
    h += '<div class="explain"><b>选中片段：' + g.name + '</b> <span class="tag tag-inf">结构辅助推断</span><br>' + g.sub + '<br>';
    h += '<table class="mini-table"><thead><tr><th>碳</th><th>类型</th><th>H</th><th>¹³C 维</th></tr></thead><tbody>';
    atoms.forEach(n => {
      const c = carbon(n);
      h += '<tr><td class="n">C' + n + '</td><td>' + kindZh(c.k) + '</td><td class="n">' + c.nH + '</td>' +
           '<td class="' + (visible(n) ? 'yes' : 'no') + '">' + (visible(n) ? '出现' : '不出现') + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<p style="margin-top:8px">在 <b>' + e.name + '</b> 下，该片段 ' + visA.length + '/' + atoms.length + ' 个碳出现在 ¹³C 维。</p>';
    h += '<ul>' + groupNote(g.id) + '</ul></div>';
  } else {
    h += '<div class="explain"><b>点击左侧对象或中间结构中的碳原子</b>，这里会同步显示该对象的碳数、质子化情况、' +
         '在 <b>' + e.name + '</b> 下是否出现在 ¹³C 维，以及需要补充的实验。<br>' +
         '当前判定规则：<span class="hl">' + ruleSummary() + '</span></div>';
  }
  DETAIL.innerHTML = h;
  if (document.querySelector('#asg tbody tr')) renderTable();
}
function ruleSummary() {
  const e = curExp();
  if (e.needH) return '沿 C–C 键 ' + e.hops + ' 步内能到达一个带氢碳 → 出现在 ¹³C 维';
  return '存在 C–C 键 → 出现在 ¹³C 维（不要求带氢）';
}
function ruleText(n) {
  const e = curExp();
  const nb = ccNeighbors(n);
  if (!nb.length) return '该碳没有 C–C 键（被氧隔断），¹J(CC) 相关无从建立，任何基于 C–C 相关实验都拿不到它。';
  if (!e.needH) return '存在 C–C 键（' + nb.map(x => 'C' + x).join('、') + '），¹³C 直接检测即可形成双量子相关。';
  const ok = nb.filter(x => nHof(x) > 0);
  if (ok.length) return '邻接带氢碳 ' + ok.map(x => 'C' + x).join('、') + '，可借其 ¹J(CH) 建立相关。';
  return '邻接碳（' + nb.map(x => 'C' + x).join('、') + '）全部为季碳，没有 ¹J(CH) 可用，故本碳不作为"被相关碳"出现。';
}
function rescue(n) {
  const c = carbon(n);
  if (!hasCC(n)) return 'HSQC 读其 δC（' + c.dC.toFixed(1) + ' ppm，示意），再用 HMBC 的 ³J 相关确认它与羰基的连接。';
  if (c.nH > 0) return 'HSQC（确定其 δC 与氢的连接）+ HMBC（补上被季碳隔断的相关）。';
  return 'HMBC（从邻近氢出发的 ²J/³J 相关）或 INADEQUATE。';
}
function groupNote(id) {
  const m = {
    ring:'<li>对位取代使 C2≡C6、C3≡C5 化学等价：4 个环 CH 只有 2 个信号，任何实验都无法区分。</li>' +
         '<li>两个 ipso 碳（C1、C4）都是季碳，但它们各自邻接带氢碳，因此在 1,1-ADEQUATE 的 ¹³C 维仍会出现。</li>',
    chain:'<li>整条侧链都由带氢碳组成，是一条完整的 ¹H–¹³C 相关"通路"，ADEQUATE 可以把它整段拼出来。</li>',
    ch2oh:'<li>C7 与 C8 相邻，二者都带氢，因此 C7、C8 在 1,1-ADEQUATE 中互相给出交叉峰。</li>' +
          '<li>羟基氢不出现在碳谱相关中；氧把 C7 与外界隔开一段，但 C7–C8 键不受影响。</li>',
    ester:'<li>C14（羰基）是季碳，但邻接带氢的 C13，所以在 1,1-ADEQUATE 的 ¹³C 维仍会出现。</li>' +
          '<li>C13 两侧（C4、C14）都是季碳 → C13 本身不作为"被相关碳"出现。</li>' +
          '<li>C15 与 O 相连，没有 C–C 键 → 在 INADEQUATE 与 ADEQUATE 中都不出现。</li>',
    ome:'<li>C15 被氧与碳骨架隔断，缺少 ¹J(CC)，因此 INADEQUATE / ADEQUATE 都给不出它的 C–C 相关。</li>' +
        '<li>甲氧基通常靠 HSQC（δC ≈ 52、δH ≈ 3.7，示意）加 HMBC 的 ³J 相关来确定。</li>'
  };
  return m[id] || '';
}

/* ------------------------------------------------------- 7. 选择与联动 */

function select(sel) {
  state.sel = sel;
  if (sel.type === 'carbon') {
    const c = carbon(sel.id);
    if (c) {
      const g = GROUPS.find(x => x.atoms.indexOf(c.n) >= 0);
      setGroupPressed(g ? g.id : null);
    }
  } else if (sel.type === 'group') {
    setGroupPressed(sel.id);
  } else {
    setGroupPressed(null);
  }
  renderMolecule(); renderSignals(); renderDetail();
}
function setGroupPressed(id) {
  document.querySelectorAll('#groups .chip').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.g === id ? 'true' : 'false');
  });
}

/* ------------------------------------------------------- 8. 控件绑定 */

/* 片段选择 */
const GB = document.getElementById('groups');
GROUPS.forEach(g => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.dataset.g = g.id;
  b.setAttribute('aria-pressed', 'false');
  b.innerHTML = g.name + '<span class="chip-s">' + g.sub + '</span>';
  b.addEventListener('click', () => {
    if (state.sel.type === 'group' && state.sel.id === g.id) select({type:'none', id:null});
    else select({ type:'group', id:g.id });
  });
  GB.appendChild(b);
});

/* 实验类型 */
const EB = document.getElementById('exps');
Object.keys(EXPERIMENTS).forEach(k => {
  const e = EXPERIMENTS[k];
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.e = k;
  b.setAttribute('aria-pressed', k === state.exp ? 'true' : 'false');
  b.innerHTML = e.name + '<span class="seg-s">' + e.sub + '</span>';
  b.addEventListener('click', () => {
    state.exp = k;
    document.querySelectorAll('#exps button').forEach(x =>
      x.setAttribute('aria-pressed', x.dataset.e === k ? 'true' : 'false'));
    refresh();
  });
  EB.appendChild(b);
});

/* 滑块 */
const ENR = document.getElementById('enrich');
const ENRV = document.getElementById('enrich-v');
ENR.addEventListener('input', () => {
  state.enrich = parseFloat(ENR.value);
  ENRV.textContent = state.enrich.toFixed(1) + ' %';
  refresh();
});
const JS = document.getElementById('jset');
const JSV = document.getElementById('jset-v');
JS.addEventListener('input', () => {
  state.jset = parseFloat(JS.value);
  JSV.textContent = state.jset.toFixed(0) + ' Hz';
  refresh();
});

/* 显示开关 */
document.getElementById('sw-num').addEventListener('change', ev => {
  state.showNum = ev.target.checked; renderMolecule();
});
document.getElementById('sw-quat').addEventListener('change', ev => {
  state.hlQuat = ev.target.checked; renderMolecule();
});

function refresh() { renderMolecule(); renderSignals(); renderReadout(); renderDetail(); }

/* ------------------------------------------------------- 9. 术语注释 */

const POP = document.getElementById('popover');
let popOwner = null;

function openTerm(btn) {
  const t = TERMS[btn.dataset.t];
  if (!t) return;
  closeTerm();
  POP.innerHTML = '<div class="p-h">' + t.zh + '</div>' +
                  (t.en ? '<div class="p-en">' + t.en + '</div>' : '') +
                  '<div class="p-b">' + t.d + '</div>';
  POP.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  popOwner = btn;
  positionPop(btn);
}
function positionPop(btn) {
  const r = btn.getBoundingClientRect();
  const w = POP.offsetWidth, hh = POP.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = r.bottom + 8;
  if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 8);
  POP.style.left = left + 'px';
  POP.style.top = top + 'px';
}
function closeTerm() {
  POP.hidden = true;
  if (popOwner) { popOwner.setAttribute('aria-expanded', 'false'); popOwner = null; }
}
document.addEventListener('click', ev => {
  const btn = ev.target.closest ? ev.target.closest('.term') : null;
  if (btn) {
    ev.preventDefault();
    if (btn === popOwner) closeTerm(); else openTerm(btn);
    return;
  }
  if (!POP.hidden && !POP.contains(ev.target)) closeTerm();
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { closeTerm(); hideTip(); }
});
window.addEventListener('resize', closeTerm);
/* 滚动时跟随重定位；只有当注释所属的词完全离开视口才关闭 */
window.addEventListener('scroll', () => {
  if (!popOwner) return;
  const r = popOwner.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) closeTerm();
  else positionPop(popOwner);
}, true);

/* 术语表 */
const GL = document.getElementById('glossary-list');
Object.keys(TERMS).forEach(k => {
  const t = TERMS[k];
  const d = document.createElement('dl');
  d.className = 'gl';
  d.id = 'gl-' + k;
  d.innerHTML = '<dt>' + t.zh + '<em>' + (t.en || '') + '</em></dt><dd>' + t.d + '</dd>';
  GL.appendChild(d);
});

/* ------------------------------------------------------- 10. 原图缩放 */

const ZOOM = document.getElementById('zoomer');
const ZR = document.getElementById('zoomrange');
const ZRV = document.getElementById('zoom-v');
/* 区域用"视野中心在图中的比例"表示，与容器尺寸无关 */
const REGIONS = {
  full:  {z:1,   cx:0.500, cy:0.500, label:'全图'},
  title: {z:3.0, cx:0.197, cy:0.129, label:'标题区'},
  text:  {z:2.4, cx:0.296, cy:0.485, label:'问题文字区'},
  mol:   {z:2.4, cx:0.760, cy:0.525, label:'分子结构区'}
};
/* CSS background-position 的百分比语义：P = (c·z − 0.5)/(z − 1)，
   使图中比例 c 的点正好落在容器中心；该式与容器尺寸无关。 */
function posPct(z, c) {
  if (!(z > 1.0001)) return 50;
  return (c * z - 0.5) / (z - 1) * 100;
}
function applyZoom() {
  const z = state.z;
  ZOOM.style.setProperty('--z', z);
  ZOOM.style.setProperty('--px', posPct(z, state.cx));
  ZOOM.style.setProperty('--py', posPct(z, state.cy));
  ZRV.textContent = z.toFixed(1) + '×';
  ZR.value = z;
}
state.z = 1; state.cx = 0.5; state.cy = 0.5;
document.querySelectorAll('#zoombtns button').forEach(b => {
  b.addEventListener('click', () => {
    const r = REGIONS[b.dataset.r];
    state.z = r.z; state.cx = r.cx; state.cy = r.cy;
    document.querySelectorAll('#zoombtns button').forEach(x =>
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    applyZoom();
  });
});
ZR.addEventListener('input', () => { state.z = parseFloat(ZR.value); applyZoom(); });
/* 点击平移：把点击处对应的图中比例设为新的视野中心 */
ZOOM.addEventListener('click', ev => {
  const r = ZOOM.getBoundingClientRect();
  if (!(state.z > 1.0001)) return;
  const imgW = state.z * r.width, imgH = state.z * r.height;
  const offX = posPct(state.z, state.cx) / 100 * (r.width - imgW);
  const offY = posPct(state.z, state.cy) / 100 * (r.height - imgH);
  const nx = (ev.clientX - r.left - offX) / imgW;
  const ny = (ev.clientY - r.top - offY) / imgH;
  state.cx = Math.max(0, Math.min(1, nx));
  state.cy = Math.max(0, Math.min(1, ny));
  applyZoom();
});

/* 可展开的放大区域：同样由 z + 中心比例算出百分比 */
document.querySelectorAll('.zoomer2').forEach(z => {
  const zz = parseFloat(z.dataset.z);
  const cx = parseFloat(z.dataset.cx), cy = parseFloat(z.dataset.cy);
  z.style.setProperty('--z', zz);
  z.style.setProperty('--px', posPct(zz, cx));
  z.style.setProperty('--py', posPct(zz, cy));
});

/* ------------------------------------------------------- 11. 归属表 */

const TB = document.querySelector('#asg tbody');
CARBONS.forEach(c => {
  const g = GROUPS.find(x => x.atoms.indexOf(c.n) >= 0);
  const tr = document.createElement('tr');
  tr.dataset.n = c.n;
  tr.innerHTML =
    '<td class="n">C' + c.n + '</td>' +
    '<td>' + kindZh(c.k) + '</td>' +
    '<td class="n">' + c.nH + '</td>' +
    '<td>' + (g ? g.name : '—') + '</td>' +
    '<td>' + c.role + '</td>' +
    '<td class="n">' + c.dC.toFixed(1) + '</td>' +
    '<td>' + (c.eq ? 'C' + c.eq : '—') + '</td>' +
    '<td class="inad">—</td>' +
    '<td class="adeq">—</td>';
  tr.addEventListener('click', () => select({ type:'carbon', id:c.n }));
  TB.appendChild(tr);
});
function renderTable() {
  document.querySelectorAll('#asg tbody tr').forEach(tr => {
    const n = parseInt(tr.dataset.n, 10);
    const c = carbon(n);
    const iCell = tr.querySelector('.inad');
    const aCell = tr.querySelector('.adeq');
    const iVis = reachable(n, EXPERIMENTS.inad.hops, EXPERIMENTS.inad.needH);
    const aVis = reachable(n, EXPERIMENTS.adeq11.hops, EXPERIMENTS.adeq11.needH);
    iCell.textContent = iVis ? '出现' : '不出现';
    iCell.className = 'inad ' + (iVis ? 'yes' : 'no');
    aCell.textContent = aVis ? '出现' : '不出现';
    aCell.className = 'adeq ' + (aVis ? 'yes' : 'no');
    tr.setAttribute('data-hl', isSelectedCarbon(n) || inSelectedGroup(n) ? '1' : '0');
  });
}

/* ------------------------------------------------------- 12. 初始化 */

function boot() {
  ENR.value = state.enrich; ENRV.textContent = state.enrich.toFixed(1) + ' %';
  JS.value = state.jset;    JSV.textContent = state.jset.toFixed(0) + ' Hz';
  applyZoom();
  refresh();
  renderTable();
  document.querySelectorAll('#zoombtns button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.r === 'full' ? 'true' : 'false'));

  /* 计数自检：把关键结论写进页面，便于人工与脚本核对 */
  const q = CARBONS.filter(c => c.nH === 0).length;
  document.getElementById('chk-c').textContent = CARBONS.length;
  document.getElementById('chk-q').textContent = q;
  document.getElementById('chk-p').textContent = CARBONS.length - q;
  document.getElementById('chk-s').textContent = SIGNALS.length;
  document.getElementById('chk-cc').textContent =
    BONDS.filter(b => typeof b.a === 'number' && typeof b.b === 'number').length;
}

boot();

/* 暴露给验证脚本（无副作用，仅读取） */
window.__ADEQ__ = {
  carbons: CARBONS, bonds: BONDS, signals: SIGNALS, experiments: EXPERIMENTS, terms: TERMS,
  state: state,
  api: {
    visible: visible, reachable: reachable, transferEff: transferEff, jccOf: jccOf,
    select: select, pairProb: pairProb, meanEff: meanEff
  }
};

})();
