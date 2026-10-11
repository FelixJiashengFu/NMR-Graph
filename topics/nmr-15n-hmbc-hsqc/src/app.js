/* =============================================================================
 * 交互逻辑 —— 深色教学仪表盘
 * 依赖：data.js 中定义的 HMBC / HSQC / GLOSSARY / EN_ZH / 纯函数
 * 说明：所有图形均为“按原图坐标轴重绘的示意”，已标注“示意”；
 *       原图以 <img> 原样保留，未作任何修改。
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------------- 0. 小工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, n) => Number(v).toFixed(n);

  /** 术语按钮（可点按、可键盘访问） */
  const T = k => '<button type="button" class="term" data-term="' + esc(k) + '" aria-describedby="glossary">' + esc(k) + '</button>';

  /** 来源徽标 */
  const BADGE = {
    obs: '<span class="srcbadge src-obs">原图观测</span>',
    read: '<span class="srcbadge src-read">坐标估读</span>',
    infer: '<span class="srcbadge src-infer">结构推断</span>',
    demo: '<span class="srcbadge src-demo">演示模型</span>',
  };

  /* ---------------- 1. 全局状态 ---------------- */
  const state = {
    obj: 'hmbc',            // 'hmbc' | 'hsqc'
    sel: null,              // 选中的峰 id / label+state
    site: null,             // 选中的氮位点 id
    hmbc: { dH: 6.86, dN: -309.4, thr: 0.0, zones: true, trace: true },
    hsqc: { dH: 8.71, dN: 115.9, phos: 1.0, black: true, arrow: true },
  };

  /* ---------------- 2. 坐标映射 ---------------- */
  // HMBC：viewBox 0 0 720 520
  const H_ = { L: 64, R: 698, T: 96, B: 468, x0: 8.0, x1: 1.0, y0: -342, y1: -233 };
  const hX = dH => H_.L + (H_.x0 - dH) / (H_.x0 - H_.x1) * (H_.R - H_.L);
  const hY = dN => H_.T + (dN - H_.y0) / (H_.y1 - H_.y0) * (H_.B - H_.T);
  const hXinv = px => H_.x0 - (px - H_.L) / (H_.R - H_.L) * (H_.x0 - H_.x1);
  const hYinv = py => H_.y0 + (py - H_.T) / (H_.B - H_.T) * (H_.y1 - H_.y0);

  // HSQC：viewBox 0 0 720 500
  const Q_ = { L: 70, R: 634, T: 54, B: 444, x0: 9.0, x1: 8.0, y0: 108.1, y1: 117.1 };
  const qX = dH => Q_.L + (Q_.x0 - dH) / (Q_.x0 - Q_.x1) * (Q_.R - Q_.L);
  const qY = dN => Q_.T + (dN - Q_.y0) / (Q_.y1 - Q_.y0) * (Q_.B - Q_.T);

  /* ---------------- 3. 原图数据 URI（构建时内嵌，仅出现一次） ---------------- */
  const IMGSRC = {};
  function readImgSrc() {
    const a = $('#orig-img-hmbc'), b = $('#orig-img-hsqc');
    if (a) IMGSRC.hmbc = a.getAttribute('src');
    if (b) IMGSRC.hsqc = b.getAttribute('src');
  }

  /* =========================================================================
   * 4. 化学结构 SVG
   * ====================================================================== */

  /** 原子标签 */
  function atom(x, y, text, color, size) {
    return '<text class="atom" x="' + x + '" y="' + (y + 4.5) + '" text-anchor="middle" ' +
      'fill="' + color + '" font-size="' + (size || 12.5) + '">' + text + '</text>';
  }
  const C = { S: '#d8c85a', N: '#6aa9e0', O: '#e07a6a', Cl: '#5fd0a8', C: '#93a1b0', H: '#a8b4c2' };

  function bond(a, b, dbl) {
    let s = '<line class="bond" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
    if (dbl) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      const ox = -dy / L * 2.6, oy = dx / L * 2.6;
      s += '<line class="bond-d" x1="' + (a[0] + ox) + '" y1="' + (a[1] + oy) + '" x2="' + (b[0] + ox) + '" y2="' + (b[1] + oy) + '"/>';
    }
    return s;
  }

  /** 哌嗪小结构（正文内嵌，标“示意”） */
  function svgPiperazine() {
    const p = [[12, 40], [24, 18], [48, 18], [60, 40], [48, 62], [24, 62]];
    let s = '<svg viewBox="0 0 72 80" role="img" aria-label="哌嗪结构示意：六元环对位两个氮原子">';
    const order = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
    order.forEach(([i, j]) => { s += bond(p[i], p[j]); });
    s += atom(12, 40, 'N', C.N) + atom(60, 40, 'N', C.N);
    s += atom(24, 18, 'C', C.C) + atom(48, 18, 'C', C.C) + atom(48, 62, 'C', C.C) + atom(24, 62, 'C', C.C);
    return s + '</svg>';
  }

  /** 苯并异噻唑小结构 */
  function svgBenzisothiazole() {
    const b = { C7: [34, 22], C6: [16, 32], C5: [16, 54], C4: [34, 64], C3a: [52, 54], C7a: [52, 32] };
    const f = { S: [56, 12], N: [78, 30], C3: [72, 52] };
    let s = '<svg viewBox="0 0 96 78" role="img" aria-label="1,2-苯并异噻唑结构示意：苯环与含硫含氮五元环稠合">';
    s += bond(b.C7, b.C6, true) + bond(b.C6, b.C5) + bond(b.C5, b.C4, true) +
      bond(b.C4, b.C3a) + bond(b.C3a, b.C7a, true) + bond(b.C7a, b.C7);
    s += bond(b.C3a, f.C3) + bond(f.C3, f.N, true) + bond(f.N, f.S) + bond(f.S, b.C7a);
    s += atom(f.S[0], f.S[1], 'S', C.S) + atom(f.N[0], f.N[1], 'N', C.N);
    s += atom(b.C4[0], b.C4[1], 'C', C.C) + atom(b.C7[0], b.C7[1], 'C', C.C);
    return s + '</svg>';
  }

  /** 羟吲哚（2-吲哚酮）小结构 */
  function svgOxindole() {
    const b = { C3a: [66, 26], C4: [44, 14], C5: [22, 26], C6: [22, 52], C7: [44, 64], C7a: [66, 52] };
    const f = { C3: [90, 20], C2: [100, 42], N1: [88, 64], O: [120, 32], H: [102, 82] };
    let s = '<svg viewBox="0 0 132 92" role="img" aria-label="2-吲哚酮结构示意：苯环与含氮五元内酰胺环稠合">';
    s += bond(b.C3a, b.C4, true) + bond(b.C4, b.C5) + bond(b.C5, b.C6, true) +
      bond(b.C6, b.C7) + bond(b.C7, b.C7a, true) + bond(b.C7a, b.C3a);
    s += bond(b.C3a, f.C3) + bond(f.C3, f.C2) + bond(f.C2, f.N1) + bond(f.N1, b.C7a);
    s += bond(f.C2, f.O, true);
    s += atom(f.N1[0], f.N1[1], 'N', C.N) + atom(f.O[0], f.O[1], 'O', C.O);
    s += '<text class="atom" x="' + f.H[0] + '" y="' + f.H[1] + '" text-anchor="middle" fill="' + C.H + '" font-size="11">H</text>';
    s += atom(b.C5[0], b.C5[1], 'C', C.C);
    return s + '</svg>';
  }

  /** 丝氨酸侧链小结构（未磷酸化，作对照） */
  function svgSerine() {
    let s = '<svg viewBox="0 0 128 74" role="img" aria-label="丝氨酸侧链结构示意：碳—碳—羟基">';
    const Ca = [14, 16], Cb = [14, 44], Og = [14, 66];
    s += bond(Ca, Cb) + bond(Cb, Og);
    s += atom(Ca[0], Ca[1], 'C', C.C) + atom(Cb[0], Cb[1], 'C', C.C) + atom(Og[0] + 16, Og[1], 'OH', C.O, 11);
    s += '<text class="ax" x="52" y="20" fill="' + C.C + '">肽键骨架</text>';
    s += '<text class="ax" x="52" y="70" fill="' + C.O + '">未磷酸化</text>';
    return s + '</svg>';
  }

  /** 肽键（酰胺）小结构 */
  function svgAmide() {
    let s = '<svg viewBox="0 0 108 56" role="img" aria-label="肽键结构示意：氮—碳（双键氧）—氮">';
    const N1 = [14, 34], Cc = [48, 20], O = [48, 6], N2 = [82, 34];
    s += bond(N1, Cc) + bond(Cc, N2) + bond(Cc, O, true);
    s += atom(N1[0], N1[1], 'N', C.N) + atom(Cc[0], Cc[1], 'C', C.C) + atom(O[0], O[1], 'O', C.O) + atom(N2[0], N2[1], 'N', C.N);
    s += '<text class="atom" x="8" y="20" fill="' + C.H + '" font-size="11">H</text>';
    return s + '</svg>';
  }

  /** 磷酸丝氨酸侧链小结构（含原子与键） */
  function svgPhosphoSer() {
    let s = '<svg viewBox="0 0 140 104" role="img" aria-label="磷酸丝氨酸侧链结构示意：碳—碳—氧—磷，磷上连双键氧与两个羟基">';
    const Ca = [14, 16], Cb = [14, 48], Og = [14, 78], P = [54, 78];
    const Oa = [54, 46], Ob = [90, 96], Oc = [90, 58];
    s += bond(Ca, Cb) + bond(Cb, Og) + bond(Og, P) + bond(P, Oa, true) + bond(P, Ob) + bond(P, Oc);
    s += atom(Ca[0], Ca[1], 'C', C.C) + atom(Cb[0], Cb[1], 'C', C.C) + atom(Og[0], Og[1], 'O', C.O);
    s += atom(P[0], P[1], 'P', '#c9a4e0');
    s += atom(Oa[0], Oa[1], 'O', C.O) + atom(Ob[0] + 12, Ob[1], 'OH', C.O, 11) + atom(Oc[0] + 12, Oc[1], 'OH', C.O, 11);
    return s + '</svg>';
  }

  /** 齐拉西酮完整结构（可交互：氮位点可点选） */
  const ZIP = {
    C7: [58, 42], C6: [35.5, 55], C5: [35.5, 81], C4: [58, 94], C3a: [80.5, 81], C7a: [80.5, 55],
    C3: [108, 78], N2: [110, 48], S1: [84, 34],
    Np1: [144, 78], Cp2: [156, 56], Cp3: [180, 56], Np4: [192, 78], Cp5: [180, 100], Cp6: [156, 100],
    Ca: [210, 100], Cb: [218, 132],
    oC5: [229.5, 155], oC6: [229.5, 181], oC7: [252, 194], oC7a: [274.5, 181],
    oC3a: [274.5, 155], oC4: [252, 142], oC3: [302, 148], oC2: [312, 172], oN1: [300, 194],
    O: [332, 162], Hn: [312, 214], Cl: [208, 196],
  };

  function svgZiprasidone() {
    const z = ZIP;
    let s = '<svg viewBox="8 14 348 220" role="img" aria-label="齐拉西酮结构示意：苯并异噻唑—哌嗪—乙基—氯代羟吲哚">';
    // 苯环
    s += bond(z.C7, z.C6, true) + bond(z.C6, z.C5) + bond(z.C5, z.C4, true) +
      bond(z.C4, z.C3a) + bond(z.C3a, z.C7a, true) + bond(z.C7a, z.C7);
    // 异噻唑五元环
    s += bond(z.C3a, z.C3) + bond(z.C3, z.N2, true) + bond(z.N2, z.S1) + bond(z.S1, z.C7a);
    // 哌嗪
    s += bond(z.C3, z.Np1) + bond(z.Np1, z.Cp2) + bond(z.Cp2, z.Cp3) + bond(z.Cp3, z.Np4) +
      bond(z.Np4, z.Cp5) + bond(z.Cp5, z.Cp6) + bond(z.Cp6, z.Np1);
    // 乙基链
    s += bond(z.Np4, z.Ca) + bond(z.Ca, z.Cb) + bond(z.Cb, z.oC5);
    // 羟吲哚苯环
    s += bond(z.oC3a, z.oC4, true) + bond(z.oC4, z.oC5) + bond(z.oC5, z.oC6, true) +
      bond(z.oC6, z.oC7) + bond(z.oC7, z.oC7a, true) + bond(z.oC7a, z.oC3a);
    // 内酰胺五元环
    s += bond(z.oC3a, z.oC3) + bond(z.oC3, z.oC2) + bond(z.oC2, z.oN1) + bond(z.oN1, z.oC7a) + bond(z.oC2, z.O, true);
    // 取代基
    s += bond(z.oC6, z.Cl);

    // 杂原子标签
    s += atom(z.S1[0], z.S1[1], 'S', C.S);
    s += atom(z.N2[0], z.N2[1], 'N', C.N);
    s += atom(z.Np1[0], z.Np1[1], 'N', C.N);
    s += atom(z.Np4[0], z.Np4[1], 'N', C.N);
    s += atom(z.oN1[0], z.oN1[1], 'N', C.N);
    s += atom(z.O[0], z.O[1], 'O', C.O);
    s += atom(z.Cl[0], z.Cl[1], 'Cl', C.Cl);
    s += '<text class="atom" x="' + (z.Hn[0] + 6) + '" y="' + z.Hn[1] + '" text-anchor="middle" fill="' + C.H + '" font-size="11">H</text>';
    s += bond(z.oN1, z.Hn);

    // 可交互氮位点
    const sites = [
      { id: 'N-btz', p: z.N2, r: 16 },
      { id: 'N-pip', p: z.Np1, r: 16 },
      { id: 'N-pip2', p: z.Np4, r: 16 },
      { id: 'N-lactam', p: z.oN1, r: 17 },
      { id: 'N-new', p: z.C7, r: 17 },
    ];
    sites.forEach(si => {
      s += '<g class="site" data-site="' + si.id + '" tabindex="0" role="button" ' +
        'aria-label="氮位点 ' + esc(siteName(si.id)) + '"><circle class="hl" cx="' + si.p[0] + '" cy="' + si.p[1] +
        '" r="' + si.r + '"/><circle cx="' + si.p[0] + '" cy="' + si.p[1] + '" r="' + si.r + '"/></g>';
    });
    return s + '</svg>';
  }

  function siteName(id) {
    const m = { 'N-btz': '苯并异噻唑氮', 'N-pip': '哌嗪氮（连苯并异噻唑）', 'N-pip2': '哌嗪氮（连乙基链）', 'N-lactam': '羟吲哚 N–H', 'N-new': '红圈峰对应位点（未确认）' };
    return m[id] || id;
  }

  /* =========================================================================
   * 4b. 正文内嵌的小型结构图（标注“示意”，含原子与连接键）
   * ====================================================================== */

  const MINI = {
    piperazine: { svg: svgPiperazine, cap: '哌嗪（示意）' },
    benzisothiazole: { svg: svgBenzisothiazole, cap: '苯并异噻唑（示意）' },
    oxindole: { svg: svgOxindole, cap: '2-吲哚酮（示意）' },
    amide: { svg: svgAmide, cap: '肽键 / 酰胺（示意）' },
    phosphoser: { svg: svgPhosphoSer, cap: '磷酸丝氨酸侧链（示意）' },
    serine: { svg: svgSerine, cap: '丝氨酸侧链（示意）' },
  };

  function renderMinis() {
    $$('[data-mini]').forEach(el => {
      const m = MINI[el.getAttribute('data-mini')];
      if (!m) return;
      el.innerHTML = m.svg() + '<span class="cl">' + m.cap + '</span>';
    });
  }

  /* =========================================================================
   * 5. 交互谱图（重绘示意）
   * ====================================================================== */

  function axesHmbc() {
    let s = '';
    // 网格 + 刻度
    HMBC.axis.y.ticks.forEach(v => {
      const y = hY(v);
      s += '<line class="grid" x1="' + H_.L + '" y1="' + y + '" x2="' + H_.R + '" y2="' + y + '"/>';
      s += '<text class="ax" x="' + (H_.L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v + '</text>';
    });
    HMBC.axis.x.ticks.forEach(v => {
      const x = hX(v);
      s += '<line class="grid" x1="' + x + '" y1="' + H_.T + '" x2="' + x + '" y2="' + H_.B + '"/>';
      s += '<text class="ax" x="' + x + '" y="' + (H_.B + 16) + '" text-anchor="middle">' + v + '</text>';
    });
    s += '<rect class="frame" x="' + H_.L + '" y="' + H_.T + '" width="' + (H_.R - H_.L) + '" height="' + (H_.B - H_.T) + '"/>';
    s += '<text class="axl" x="' + ((H_.L + H_.R) / 2) + '" y="' + (H_.B + 34) + '" text-anchor="middle">δH (ppm)</text>';
    s += '<text class="axl" x="14" y="' + ((H_.T + H_.B) / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + ((H_.T + H_.B) / 2) + ')">δN (ppm)</text>';
    return s;
  }

  function axesHsqc() {
    let s = '';
    HSQC.axis.y.ticks.forEach(v => {
      const y = qY(v);
      s += '<line class="grid" x1="' + Q_.L + '" y1="' + y + '" x2="' + Q_.R + '" y2="' + y + '"/>';
      s += '<text class="ax" x="' + (Q_.R + 10) + '" y="' + (y + 4) + '" text-anchor="start">' + v + '</text>';
    });
    HSQC.axis.x.ticks.forEach(v => {
      const x = qX(v);
      s += '<line class="grid" x1="' + x + '" y1="' + Q_.T + '" x2="' + x + '" y2="' + Q_.B + '"/>';
      s += '<text class="ax" x="' + x + '" y="' + (Q_.B + 17) + '" text-anchor="middle">' + fmt(v, 1) + '</text>';
    });
    s += '<rect class="frame" x="' + Q_.L + '" y="' + Q_.T + '" width="' + (Q_.R - Q_.L) + '" height="' + (Q_.B - Q_.T) + '"/>';
    s += '<text class="axl" x="' + ((Q_.L + Q_.R) / 2) + '" y="' + (Q_.B + 36) + '" text-anchor="middle">¹H (ppm)</text>';
    const ym = (Q_.T + Q_.B) / 2;
    s += '<text class="axl" x="' + (Q_.R + 46) + '" y="' + ym + '" text-anchor="middle" transform="rotate(90 ' + (Q_.R + 46) + ' ' + ym + ')">δN (ppm)</text>';
    return s;
  }

  /** 1D ¹H 投影（示意） */
  function traceHmbc() {
    const base = H_.T, H = 68;
    let d = '';
    const pts = HMBC.trace1d.slice().sort((a, b) => b.dH - a.dH);
    d += 'M ' + hX(8.0) + ' ' + base;
    let prev = hX(8.0);
    pts.forEach(p => {
      const x = hX(p.dH), y = base - p.a * H;
      d += ' L ' + (x - 3.2) + ' ' + base + ' L ' + x + ' ' + y + ' L ' + (x + 3.2) + ' ' + base;
      prev = x + 3.2;
    });
    d += ' L ' + hX(1.0) + ' ' + base;
    return '<path d="' + d + '" fill="none" stroke="#c3ccd6" stroke-width="1.1" ' +
      'aria-label="一维氢谱投影示意，非原始数据"/>';
  }

  function peakMarkHmbc(p, vis, sel, near) {
    const x = hX(p.dH), y = hY(p.dN);
    const hh = p.h * 1.53;
    const dim = vis ? '' : ' dim';
    const s2 = sel ? ' sel' : '';
    const color = p.mark === 'red' ? '#e0645a' : (near ? '#5fd0a8' : '#e6ecf2');
    return '<g class="pk' + dim + s2 + '" data-peak="' + p.id + '" tabindex="0" role="button" ' +
      'aria-label="交叉峰 ' + p.id + '：δH ' + fmt(p.dH, 2) + ' ppm，δN ' + fmt(p.dN, 1) + ' ppm">' +
      '<circle class="ring" cx="' + x + '" cy="' + y + '" r="' + (Math.max(hh / 2, 8) + 6) + '"/>' +
      '<circle class="hit" cx="' + x + '" cy="' + y + '" r="' + (Math.max(hh / 2, 8) + 9) + '"/>' +
      '<line x1="' + x + '" y1="' + (y - hh / 2) + '" x2="' + x + '" y2="' + (y + hh / 2) + '" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/>' +
      (sel ? '<text class="pk-lbl" x="' + (x + 10) + '" y="' + (y - hh / 2 - 4) + '">' + p.id + '</text>' : '') +
      '</g>';
  }

  function renderHmbc() {
    const st = state.hmbc;
    const vis = hmbcVisible(HMBC.peaks, st.thr);
    const near = peaksNear(HMBC.peaks, st.dH, st.dN, 0.25, 4.0).map(p => p.id);
    let s = '<svg viewBox="0 0 720 520" role="group" aria-label="齐拉西酮降解产物 ¹H–¹⁵N HMBC 示意重绘图">';
    s += axesHmbc();
    if (st.trace) s += traceHmbc();
    // 原图标注框（示意重绘）
    if (st.zones) {
      const rb = HMBC.boxes[0];
      s += '<ellipse class="zone zone-red" cx="' + ((hX(rb.dH0) + hX(rb.dH1)) / 2) + '" cy="' + ((hY(rb.dN0) + hY(rb.dN1)) / 2) +
        '" rx="' + (Math.abs(hX(rb.dH1) - hX(rb.dH0)) / 2) + '" ry="' + (Math.abs(hY(rb.dN1) - hY(rb.dN0)) / 2) + '"/>';
      const db = HMBC.boxes[1];
      s += '<rect class="zone zone-dash" x="' + Math.min(hX(db.dH0), hX(db.dH1)) + '" y="' + Math.min(hY(db.dN0), hY(db.dN1)) +
        '" width="' + Math.abs(hX(db.dH1) - hX(db.dH0)) + '" height="' + Math.abs(hY(db.dN1) - hY(db.dN0)) + '"/>';
      const sb = HMBC.boxes[2];
      s += '<rect class="zone zone-solid" x="' + Math.min(hX(sb.dH0), hX(sb.dH1)) + '" y="' + Math.min(hY(sb.dN0), hY(sb.dN1)) +
        '" width="' + Math.abs(hX(sb.dH1) - hX(sb.dH0)) + '" height="' + Math.abs(hY(sb.dN1) - hY(sb.dN0)) + '"/>';
    }
    // 交叉峰
    HMBC.peaks.forEach(p => { s += peakMarkHmbc(p, vis.find(v => v.id === p.id).shown, state.sel === p.id, near.indexOf(p.id) >= 0); });
    // 光标
    const cx = hX(st.dH), cy = hY(st.dN);
    s += '<line class="cur" x1="' + cx + '" y1="' + H_.T + '" x2="' + cx + '" y2="' + H_.B + '"/>';
    s += '<line class="cur" x1="' + H_.L + '" y1="' + cy + '" x2="' + H_.R + '" y2="' + cy + '"/>';
    s += '<text class="cur-t" x="' + (cx + 4) + '" y="' + (H_.T + 12) + '">δH ' + fmt(st.dH, 2) + '</text>';
    s += '<text class="cur-t" x="' + (H_.L + 4) + '" y="' + (cy - 5) + '">δN ' + fmt(st.dN, 1) + '</text>';
    s += '</svg>';
    return s;
  }

  function peakMarkHsqc(p, isBlue, sel, color, alpha) {
    const x = qX(p.dH), y = qY(p.dN);
    return '<g class="pk' + (sel ? ' sel' : '') + '" data-peak="' + esc(p.label + '|' + p.state) + '" tabindex="0" role="button" ' +
      'aria-label="' + esc(p.label) + ' ' + p.state + ' 组：δH ' + fmt(p.dH, 2) + '，δN ' + fmt(p.dN, 1) + '">' +
      '<ellipse class="ring" cx="' + x + '" cy="' + y + '" rx="13" ry="14"/>' +
      '<ellipse class="hit" cx="' + x + '" cy="' + y + '" rx="16" ry="16"/>' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="4.6" ry="8.5" fill="' + color + '" opacity="' + (alpha == null ? 1 : alpha) + '"/>' +
      '</g>';
  }

  function renderHsqc() {
    const st = state.hsqc;
    const blue = hsqcBlueSeries(st.phos);
    const black = hsqcBlackSeries();
    let s = '<svg viewBox="0 0 720 500" role="group" aria-label="磷酸化蛋白 ¹⁵N HSQC 示意重绘图">';
    s += axesHsqc();
    // 箭头（原图标注）
    if (st.arrow) {
      const a = HSQC.peaks.find(k => k.label === 'Ser3');
      const b = HSQC.peaks.find(k => k.label === 'pSer3');
      const y = qY(a.dN) + 16, x1 = qX(a.dH) - 6, x2 = qX(b.dH) + 6;
      s += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#a8b4c2" stroke-width="1.4"/>' +
        '<path d="M ' + x2 + ' ' + y + ' l 8 -4 l 0 8 z" fill="#a8b4c2"/>' +
        '<text class="ax" x="' + ((x1 + x2) / 2) + '" y="' + (y - 7) + '" text-anchor="middle">磷酸化位移 ΔδH ≈ +' + fmt(serShift().dH, 2) + ' ppm</text>';
    }
    if (st.black) black.forEach(p => { s += peakMarkHsqc(p, false, state.sel === p.label + '|a', '#e6ecf2', 1); });
    blue.forEach(p => {
      s += peakMarkHsqc(p, true, state.sel === p.label + '|b', '#3fa9f5', 1);
      // 位移轨迹
      const a = HSQC.peaks.find(k => k.label === (p.partner || p.label) && k.state === 'a');
      if (a && st.phos > 0 && st.phos < 1) {
        s += '<line x1="' + qX(a.dH) + '" y1="' + qY(a.dN) + '" x2="' + qX(p.dH) + '" y2="' + qY(p.dN) +
          '" stroke="#3fa9f5" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>';
      }
    });
    // 标注文字
    const labels = [
      ['Gly2', 8.413, 108.91, 8, -8], ['Gly5', 8.181, 109.73, 8, 14],
      ['Gly4', 8.617, 111.24, -8, -8], ['Gly1', 8.364, 114.50, 8, -8],
      ['Ser3', 8.392, 115.88, 10, 4], ['pSer3', 8.710, 115.85, -8, 16],
    ];
    labels.forEach(([t, dh, dn, ox, oy]) => {
      s += '<text class="pk-lbl" x="' + (qX(dh) + ox) + '" y="' + (qY(dn) + oy) + '" text-anchor="' + (ox < 0 ? 'end' : 'start') + '">' + t + '</text>';
    });
    // 光标
    const cx = qX(st.dH), cy = qY(st.dN);
    s += '<line class="cur" x1="' + cx + '" y1="' + Q_.T + '" x2="' + cx + '" y2="' + Q_.B + '"/>';
    s += '<line class="cur" x1="' + Q_.L + '" y1="' + cy + '" x2="' + Q_.R + '" y2="' + cy + '"/>';
    s += '<text class="cur-t" x="' + (cx + 4) + '" y="' + (Q_.T + 12) + '">¹H ' + fmt(st.dH, 2) + '</text>';
    s += '<text class="cur-t" x="' + (Q_.R - 4) + '" y="' + (cy - 5) + '" text-anchor="end">δN ' + fmt(st.dN, 1) + '</text>';
    s += '</svg>';
    return s;
  }

  /* =========================================================================
   * 6. 右栏读数
   * ====================================================================== */

  function readoutHmbc() {
    const st = state.hmbc;
    const near = peaksNear(HMBC.peaks, st.dH, st.dN, 0.25, 4.0);
    const p = state.sel ? HMBC.peaks.find(x => x.id === state.sel) : near[0];
    const site = state.site ? HMBC_SITES.find(s => s.id === state.site) : null;
    let h = '<dl class="readout">';
    h += '<dt>当前对象</dt><dd>' + esc(HMBC.title) + '</dd>';
    h += '<dt>光标 δH</dt><dd>' + fmt(st.dH, 2) + ' <span class="u">ppm</span></dd>';
    h += '<dt>光标 δN</dt><dd>' + fmt(st.dN, 1) + ' <span class="u">ppm</span></dd>';
    h += '<dt>容差</dt><dd>±0.25 / ±4.0 <span class="u">ppm</span></dd>';
    h += '<dt>命中峰</dt><dd>' + near.length + ' <span class="u">个</span></dd>';
    if (p) {
      h += '<dt>峰编号</dt><dd>' + esc(p.id) + ' <span class="u">' + esc(p.zone) + '</span></dd>';
      h += '<dt>峰位</dt><dd>δH ' + fmt(p.dH, 2) + ' / δN ' + fmt(p.dN, 1) + '</dd>';
      h += '<dt>相对强度</dt><dd>' + Math.round(relIntensity(p.h) * 100) + ' <span class="u">%（按原图条带高度归一）</span></dd>';
    }
    h += '<dt>选中位点</dt><dd>' + (site ? esc(site.name) : '—') + '</dd>';
    h += '</dl>';
    return h;
  }

  function readoutHsqc() {
    const st = state.hsqc;
    const blue = hsqcBlueSeries(st.phos);
    const sh = serShift();
    const nearB = peaksNear(blue.map(b => ({ ...b, id: b.label })), st.dH, st.dN, 0.06, 1.0);
    const nearA = peaksNear(hsqcBlackSeries().map(b => ({ ...b, id: b.label })), st.dH, st.dN, 0.06, 1.0);
    let h = '<dl class="readout">';
    h += '<dt>当前对象</dt><dd>' + esc(HSQC.title) + '</dd>';
    h += '<dt>光标 ¹H</dt><dd>' + fmt(st.dH, 2) + ' <span class="u">ppm</span></dd>';
    h += '<dt>光标 δN</dt><dd>' + fmt(st.dN, 1) + ' <span class="u">ppm</span></dd>';
    h += '<dt>磷酸化程度</dt><dd>' + Math.round(st.phos * 100) + ' <span class="u">%（演示模型）</span></dd>';
    h += '<dt>命中 (a) 黑峰</dt><dd>' + (nearA.length ? nearA.map(x => x.id).join('、') : '—') + '</dd>';
    h += '<dt>命中 (b) 蓝峰</dt><dd>' + (nearB.length ? nearB.map(x => x.id).join('、') : '—') + '</dd>';
    h += '<dt>Ser3 → pSer3</dt><dd>ΔδH = +' + fmt(sh.dH, 3) + ' / ΔδN = ' + fmt(sh.dN, 2) + '</dd>';
    h += '</dl>';
    return h;
  }

  function explainHmbc() {
    const st = state.hmbc;
    const near = peaksNear(HMBC.peaks, st.dH, st.dN, 0.25, 4.0);
    let h = '<div class="explain">';
    if (near.length) {
      const p = near[0];
      h += '<p>光标落在 <strong>' + esc(p.name) + '（' + esc(p.id) + '）</strong>附近，该峰位于原图的 <strong>' + esc(p.zone) + '</strong>。</p>';
      h += '<p>读数 δH = <strong>' + fmt(p.dH, 2) + ' ppm</strong>，δN = <strong>' + fmt(p.dN, 1) + ' ppm</strong>。 ' + BADGE.read + '</p>';
    } else {
      h += '<p>光标附近没有交叉峰。可拖动滑块靠近标注框内的峰位。</p>';
    }
    h += '<ul>' +
      '<li>本图为 <strong>' + T('HMBC') + '</strong>：横轴是 ¹H 化学位移，纵轴是 ¹⁵N 化学位移，一个斑点代表一对 ¹H–¹⁵N 远程相关。</li>' +
      '<li>原图共有 3 处手工标注：红圈、蓝虚线框、蓝实线框。' + BADGE.obs + '</li>' +
      '<li>9 个峰按 δN 分成两簇：<strong>7 个</strong>集中在 −270 ± 4 ppm，<strong>2 个</strong>明显更负（红圈峰 −309.4，右上角弱峰 −316.6），两簇相差约 39 ppm。' + BADGE.read + '</li>' +
      '<li>若图 1 用硝基甲烷作参考物，则 −270 簇换算到液氨标度约 +110 ppm，与图 2 的酰胺氮区间一致。' + BADGE.infer + '</li>' +
      '</ul></div>';
    return h;
  }

  function explainHsqc() {
    const st = state.hsqc;
    const sh = serShift();
    let h = '<div class="explain">';
    h += '<p>磷酸化程度设为 <strong>' + Math.round(st.phos * 100) + '%</strong>。蓝色 (b) 组峰位由演示模型在 (a) 组位置与观测 (b) 位置之间线性插值。' + BADGE.demo + '</p>';
    h += '<ul>' +
      '<li><strong>Ser3 → pSer3</strong>：¹H 位移 <strong>+' + fmt(sh.dH, 3) + ' ppm</strong>（向低场），¹⁵N 位移 <strong>' + fmt(sh.dN, 2) + ' ppm</strong>（几乎不变）。' + BADGE.read + '</li>' +
      '<li>Gly1/4/5 的黑蓝峰对位移很小（¹H 约 0.01–0.06 ppm）。' + BADGE.read + '</li>' +
      '<li>该图纵轴 δN 为正值（108–116），与图 1 的负值（−233 至 −342）<strong>不能直接比较</strong>，原因见“常见误区”。</li>' +
      '</ul></div>';
    return h;
  }

  /* =========================================================================
   * 7. 归属表
   * ====================================================================== */

  function tableHmbc() {
    let rows = HMBC.peaks.map(p => {
      const sel = state.sel === p.id ? ' class="on"' : '';
      const site = HMBC_SITES.filter(s => s.peaks.indexOf(p.id) >= 0).map(s => s.name).join('；') || '—';
      return '<tr' + sel + '><td class="mono">' + p.id + '</td><td class="mono">' + fmt(p.dH, 2) + '</td>' +
        '<td class="mono">' + fmt(p.dN, 1) + '</td><td>' + p.zone + '</td>' +
        '<td class="mono">' + Math.round(relIntensity(p.h) * 100) + '%</td>' +
        '<td>' + site + ' ' + BADGE.infer + '</td><td>' + BADGE.read + '</td></tr>';
    }).join('');
    return '<div class="tbl-scroll"><table><caption class="sr-only">图 1 交叉峰归属表</caption>' +
      '<thead><tr><th>峰编号</th><th>δH (ppm)</th><th>δN (ppm)</th><th>原图标注区</th><th>相对强度</th><th>候选氮位点（结构推断）</th><th>数据来源</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="hint">相对强度按原图条带像素高度归一（最强峰 B1 = 43 px 记 100%）。归属列为按化学结构给出的<strong>候选</strong>对应，原图并未给出逐峰归属。</p>';
  }

  function tableHsqc() {
    const groups = ['Gly2', 'Gly5', 'Gly4', 'Gly1', 'Ser3', 'pSer3'];
    let rows = groups.map(g => {
      const a = HSQC.peaks.find(p => p.label === g && p.state === 'a');
      const b = HSQC.peaks.find(p => p.label === g && p.state === 'b');
      const dH = a && b ? fmt(b.dH - a.dH, 3) : '—';
      const dN = a && b ? fmt(b.dN - a.dN, 2) : '—';
      return '<tr><td class="mono">' + g + '</td>' +
        '<td class="mono">' + (a ? fmt(a.dH, 3) + ' / ' + fmt(a.dN, 2) : '—') + '</td>' +
        '<td class="mono">' + (b ? fmt(b.dH, 3) + ' / ' + fmt(b.dN, 2) : '未观测到') + '</td>' +
        '<td class="mono">' + dH + '</td><td class="mono">' + dN + '</td>' +
        '<td>' + BADGE.read + '</td></tr>';
    }).join('');
    return '<div class="tbl-scroll"><table><caption class="sr-only">图 2 峰对归属表</caption>' +
      '<thead><tr><th>残基</th><th>(a) 黑峰 δH / δN</th><th>(b) 蓝峰 δH / δN</th><th>ΔδH</th><th>ΔδN</th><th>数据来源</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="hint">原图只标注了残基名（Gly1/2/4/5、Ser3、pSer3），未给出完整序列、样品条件与参考物；峰位为按坐标轴估读。</p>';
  }

  /* =========================================================================
   * 8. 局部放大（原图不改动，仅裁剪显示）
   * ====================================================================== */

  function zoomCard(z, meta, key) {
    const [x, y, w, h] = z.box;
    const wPct = (meta.w / w) * 100;
    const lPct = -(x / w) * 100;
    const tPct = -(y / h) * 100;
    return '<div class="zoomcard"><h4>' + esc(z.name) + '</h4>' +
      '<div class="zoomview" style="aspect-ratio:' + w + '/' + h + '">' +
      '<img src="' + IMGSRC[key] + '" alt="原图局部放大：' + esc(z.name) + '" ' +
      'style="width:' + wPct.toFixed(4) + '%;left:' + lPct.toFixed(4) + '%;top:' + tPct.toFixed(4) + '%"></div>' +
      '<div class="cap">原图像素区域 x ' + x + '–' + (x + w) + '，y ' + y + '–' + (y + h) + '（按原分辨率裁剪放大，像素未重采样）</div></div>';
  }

  function renderZooms() {
    $('#zoom-hmbc').innerHTML = HMBC.zooms.map(z => zoomCard(z, HMBC.img, 'hmbc')).join('');
    $('#zoom-hsqc').innerHTML = HSQC.zooms.map(z => zoomCard(z, HSQC.img, 'hsqc')).join('');
  }

  /* =========================================================================
   * 9. 术语注释弹层
   * ====================================================================== */

  let popEl = null;
  function ensurePop() {
    if (popEl) return popEl;
    popEl = document.createElement('div');
    popEl.className = 'pop';
    popEl.setAttribute('role', 'dialog');
    popEl.setAttribute('aria-label', '术语注释');
    document.body.appendChild(popEl);
    return popEl;
  }
  function showPop(btn) {
    const k = btn.getAttribute('data-term');
    const g = GLOSSARY.find(x => x.k === k);
    if (!g) return;
    const p = ensurePop();
    p.innerHTML = '<button type="button" class="x" aria-label="关闭注释">×</button>' +
      '<span class="t">' + esc(g.k) + '</span><span class="e">' + esc(g.en) + '</span>' + esc(g.zh);
    p.classList.add('on');
    const r = btn.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = r.left + window.pageXOffset;
    let top = r.bottom + window.pageYOffset + 6;
    const vw = document.documentElement.clientWidth;
    if (left + pw > vw - 10) left = vw - pw - 10;
    if (left < 10) left = 10;
    if (r.bottom + ph + 12 > window.innerHeight) top = r.top + window.pageYOffset - ph - 6;
    p.style.left = left + 'px';
    p.style.top = Math.max(window.pageYOffset + 6, top) + 'px';
    p.querySelector('.x').addEventListener('click', hidePop);
  }
  function hidePop() { if (popEl) popEl.classList.remove('on'); }

  document.addEventListener('click', e => {
    const t = e.target.closest('.term');
    if (t) { showPop(t); return; }
    if (!e.target.closest('.pop')) hidePop();
  });
  document.addEventListener('focusin', e => {
    const t = e.target.closest && e.target.closest('.term');
    if (t) showPop(t);
  });
  document.addEventListener('focusout', e => {
    if (e.target.closest && e.target.closest('.term')) hidePop();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hidePop(); closeLightbox(); }
  });

  /* =========================================================================
   * 10. 灯箱（原图展开）
   * ====================================================================== */

  function openLightbox(src, alt) {
    let lb = $('#lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'lightbox'; lb.className = 'lightbox';
      lb.innerHTML = '<div class="lb-bar">按 Esc 或点击关闭按钮退出</div>' +
        '<button type="button" class="lb-close">关闭 ✕</button><img alt="">';
      document.body.appendChild(lb);
      lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
      lb.addEventListener('click', ev => { if (ev.target === lb) closeLightbox(); });
    }
    const img = lb.querySelector('img');
    img.src = src; img.alt = alt || '';
    lb.classList.add('on');
    lb.querySelector('.lb-close').focus();
  }
  function closeLightbox() {
    const lb = $('#lightbox');
    if (lb) { lb.classList.remove('on'); }
  }

  /* =========================================================================
   * 11. 控件与事件
   * ====================================================================== */

  function buildControls() {
    const isH = state.obj === 'hmbc';
    const box = $('#ctl-dynamic');
    let h = '';
    if (isH) {
      h += slider('h-dh', '光标 δH', 'ppm', 1.0, 8.0, 0.01, state.hmbc.dH);
      h += slider('h-dn', '光标 δN', 'ppm', -342, -233, 0.5, state.hmbc.dN);
      h += slider('h-thr', '显示强度阈值（演示模型）', '%', 0, 100, 1, state.hmbc.thr * 100);
      h += '<div class="switch"><input type="checkbox" id="h-zones"' + (state.hmbc.zones ? ' checked' : '') + '>' +
        '<label for="h-zones">显示原图手工标注框</label></div>';
      h += '<div class="switch"><input type="checkbox" id="h-trace"' + (state.hmbc.trace ? ' checked' : '') + '>' +
        '<label for="h-trace">显示 1D ¹H 投影（示意）</label></div>';
      h += '<p class="hint">强度阈值只改变<strong>示意重绘图</strong>中显示的条带数量，不改变任何峰位；原图条带高度归一后最低峰（T1）约 21%。</p>';
    } else {
      h += slider('q-phos', '磷酸化程度（演示模型）', '%', 0, 100, 1, state.hsqc.phos * 100);
      h += slider('q-dh', '光标 ¹H', 'ppm', 8.0, 9.0, 0.01, state.hsqc.dH);
      h += slider('q-dn', '光标 δN', 'ppm', 108.1, 117.1, 0.1, state.hsqc.dN);
      h += '<div class="switch"><input type="checkbox" id="q-black"' + (state.hsqc.black ? ' checked' : '') + '>' +
        '<label for="q-black">显示 (a) 组黑峰（不随滑块变化）</label></div>';
      h += '<div class="switch"><input type="checkbox" id="q-arrow"' + (state.hsqc.arrow ? ' checked' : '') + '>' +
        '<label for="q-arrow">显示原图箭头（Ser3 → pSer3）</label></div>';
      h += '<p class="hint">磷酸化程度 0% 时蓝峰与黑峰重合，100% 时蓝峰位于原图观测位置；<strong>中间取值属于演示模型</strong>，原图只提供两个端点。</p>';
    }
    box.innerHTML = h;
    bindControls();
  }

  function slider(id, label, unit, min, max, step, val) {
    return '<div class="ctl"><label for="' + id + '"><span>' + esc(label) + '</span>' +
      '<span class="val" id="' + id + '-v">' + (step < 1 ? fmt(val, 2) : Math.round(val)) + ' ' + unit + '</span></label>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" ' +
      'aria-label="' + esc(label) + '，单位 ' + unit + '"></div>';
  }

  function bindControls() {
    const isH = state.obj === 'hmbc';
    const setVal = (id, txt) => { const e = $('#' + id + '-v'); if (e) e.textContent = txt; };
    if (isH) {
      $('#h-dh').addEventListener('input', e => { state.hmbc.dH = +e.target.value; setVal('h-dh', fmt(e.target.value, 2) + ' ppm'); refreshPlotOnly(); });
      $('#h-dn').addEventListener('input', e => { state.hmbc.dN = +e.target.value; setVal('h-dn', fmt(e.target.value, 1) + ' ppm'); refreshPlotOnly(); });
      $('#h-thr').addEventListener('input', e => { state.hmbc.thr = +e.target.value / 100; setVal('h-thr', Math.round(e.target.value) + ' %'); refreshPlotOnly(); });
      $('#h-zones').addEventListener('change', e => { state.hmbc.zones = e.target.checked; refreshPlotOnly(); });
      $('#h-trace').addEventListener('change', e => { state.hmbc.trace = e.target.checked; refreshPlotOnly(); });
    } else {
      $('#q-phos').addEventListener('input', e => { state.hsqc.phos = +e.target.value / 100; setVal('q-phos', Math.round(e.target.value) + ' %'); refreshPlotOnly(); });
      $('#q-dh').addEventListener('input', e => { state.hsqc.dH = +e.target.value; setVal('q-dh', fmt(e.target.value, 2) + ' ppm'); refreshPlotOnly(); });
      $('#q-dn').addEventListener('input', e => { state.hsqc.dN = +e.target.value; setVal('q-dn', fmt(e.target.value, 1) + ' ppm'); refreshPlotOnly(); });
      $('#q-black').addEventListener('change', e => { state.hsqc.black = e.target.checked; refreshPlotOnly(); });
      $('#q-arrow').addEventListener('change', e => { state.hsqc.arrow = e.target.checked; refreshPlotOnly(); });
    }
  }

  /* ---------------- 12. 渲染管线 ---------------- */

  function refreshPlotOnly() {
    if (state.obj === 'hmbc') {
      $('#plot').innerHTML = renderHmbc();
      $('#readout').innerHTML = readoutHmbc();
      $('#explain').innerHTML = explainHmbc();
      $('#table-main').innerHTML = tableHmbc();
    } else {
      $('#plot').innerHTML = renderHsqc();
      $('#readout').innerHTML = readoutHsqc();
      $('#explain').innerHTML = explainHsqc();
      $('#table-main').innerHTML = tableHsqc();
    }
    renderPkList();
    bindPlot();
  }

  function renderPkList() {
    const box = $('#pk-list');
    if (state.obj === 'hmbc') {
      box.innerHTML = HMBC.peaks.map(p =>
        '<button type="button" data-pk="' + p.id + '" aria-pressed="' + (state.sel === p.id) + '">' + p.id + '</button>').join('');
    } else {
      box.innerHTML = HSQC.peaks.map(p =>
        '<button type="button" data-pk="' + p.label + '|' + p.state + '" aria-pressed="' + (state.sel === p.label + '|' + p.state) + '">' +
        p.label + ' ' + p.state + '</button>').join('');
    }
    $$('#pk-list button').forEach(b => {
      b.addEventListener('click', () => selectPeak(b.getAttribute('data-pk')));
    });
  }

  function bindPlot() {
    $$('#plot .pk').forEach(g => {
      const act = () => selectPeak(g.getAttribute('data-peak'));
      g.addEventListener('click', act);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); act(); }
      });
    });
  }

  function selectPeak(id) {
    state.sel = id;
    if (state.obj === 'hmbc') {
      const p = HMBC.peaks.find(x => x.id === id);
      if (p) { state.hmbc.dH = p.dH; state.hmbc.dN = p.dN; }
    } else {
      const [lab] = id.split('|');
      const p = HSQC.peaks.find(x => x.label === lab);
      if (p) { state.hsqc.dH = p.dH; state.hsqc.dN = p.dN; }
    }
    buildControls();
    refreshPlotOnly();
    updateStructHighlight();
    const el = $('#plot .pk[data-peak="' + id + '"]');
    if (el && document.activeElement !== el) { /* 保持焦点策略：仅点击时聚焦 */ }
  }

  function updateStructHighlight() {
    const box = $('#struct');
    if (!box) return;
    if (state.obj === 'hmbc') {
      box.innerHTML = '<div class="structbox">' + svgZiprasidone() + '</div>' +
        '<div class="struct-cap">齐拉西酮结构<strong>示意</strong>（按化学名重绘，非原图矢量化）。' +
        '带圆圈的氮为 ¹⁵N 候选位点，可点按。</div>';
      $$('#struct .site').forEach(g => {
        const act = () => { state.site = g.getAttribute('data-site'); updateStructHighlight(); refreshPlotOnly(); };
        g.addEventListener('click', act);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      });
      if (state.site) {
        const g = $('#struct .site[data-site="' + state.site + '"]');
        if (g) g.classList.add('on');
      }
    } else {
      box.innerHTML = '<div class="structbox">' + svgPhosphoSerBig() + '</div>' +
        '<div class="struct-cap">磷酸丝氨酸侧链<strong>示意</strong>：丝氨酸 –CH₂–OH 的羟基被磷酸基取代。</div>';
    }
  }

  /** 大号磷酸丝氨酸（中部结构面板用） */
  function svgPhosphoSerBig() {
    let s = '<svg viewBox="0 0 420 200" role="img" aria-label="磷酸丝氨酸侧链结构示意（大图）">';
    const N = [40, 60], Ca = [90, 60], Cc = [140, 60], O1 = [140, 22], N2 = [190, 60], H1 = [30, 32], H2 = [204, 30];
    const Cb = [90, 110], Og = [90, 155], P = [150, 155], Oa = [150, 112], Ob = [196, 178], Oc = [196, 138];
    s += bond(N, Ca) + bond(N, H1) + bond(Ca, Cc) + bond(Cc, O1, true) + bond(Cc, N2) + bond(N2, H2);
    s += bond(Ca, Cb) + bond(Cb, Og) + bond(Og, P) + bond(P, Oa, true) + bond(P, Ob) + bond(P, Oc);
    s += atom(N[0], N[1], 'N', C.N) + atom(Ca[0], Ca[1], 'C', C.C) + atom(Cc[0], Cc[1], 'C', C.C);
    s += atom(O1[0], O1[1], 'O', C.O) + atom(N2[0], N2[1], 'N', C.N);
    s += atom(Cb[0], Cb[1], 'C', C.C) + atom(Og[0], Og[1], 'O', C.O) + atom(P[0], P[1], 'P', '#c9a4e0');
    s += atom(Oa[0], Oa[1], 'O', C.O) + atom(Ob[0] + 14, Ob[1], 'OH', C.O, 11) + atom(Oc[0] + 14, Oc[1], 'OH', C.O, 11);
    s += '<text class="ax" x="' + (H1[0] - 2) + '" y="' + H1[1] + '" text-anchor="middle" fill="' + C.H + '">H</text>';
    s += '<text class="ax" x="' + H2[0] + '" y="' + H2[1] + '" text-anchor="middle" fill="' + C.H + '">H</text>';
    s += '<text class="ax" x="70" y="132" fill="' + C.C + '">肽键骨架</text>';
    s += '<text class="ax" x="150" y="86" fill="#c9a4e0">磷酸基（磷酸化引入）</text>';
    return s + '</svg>';
  }

  function switchObject(id) {
    state.obj = id;
    state.sel = null;
    state.site = null;
    $$('.obj-btn').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-obj') === id)));
    $('#obj-title').textContent = id === 'hmbc' ? HMBC.title : HSQC.title;
    $('#obj-sub').textContent = id === 'hmbc' ? HMBC.subtitle : HSQC.subtitle;
    $('#obj-badge').innerHTML = id === 'hmbc'
      ? BADGE.read + ' ' + BADGE.infer
      : BADGE.read + ' ' + BADGE.demo;
    $('#obj-legend').innerHTML = id === 'hmbc'
      ? '<span><i class="sw" style="background:#e0645a"></i>红圈强调峰</span>' +
        '<span><i class="sw" style="background:#e6ecf2"></i>普通交叉峰</span>' +
        '<span><i class="sw" style="background:transparent;border-style:dashed;border-color:#6aa9e0"></i>原图蓝虚线框</span>'
      : '<span><i class="sw" style="background:#e6ecf2"></i>(a) 黑峰</span>' +
        '<span><i class="sw" style="background:#3fa9f5"></i>(b) 蓝峰</span>' +
        '<span><i class="sw" style="background:transparent;border-color:#a8b4c2"></i>原图箭头</span>';
    buildControls();
    refreshPlotOnly();
    updateStructHighlight();
  }

  /* ---------------- 13. 初始化 ---------------- */

  function init() {
    readImgSrc();
    $$('.obj-btn').forEach(b => b.addEventListener('click', () => switchObject(b.getAttribute('data-obj'))));
    // 原图灯箱
    $$('.origcard img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.getAttribute('src'), img.getAttribute('alt')));
      img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(img.getAttribute('src'), img.getAttribute('alt')); } });
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
    });
    // 中部图的点击 → 设置光标（点击空白处）
    document.addEventListener('click', e => {
      const svg = e.target.closest('#plot svg');
      if (!svg || e.target.closest('.pk')) return;
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const px = (e.clientX - r.left) / r.width * vb.width;
      const py = (e.clientY - r.top) / r.height * vb.height;
      if (state.obj === 'hmbc') {
        const dH = hXinv(px), dN = hYinv(py);
        if (dH >= 1 && dH <= 8) state.hmbc.dH = Math.round(dH * 100) / 100;
        if (dN >= -342 && dN <= -233) state.hmbc.dN = Math.round(dN * 2) / 2;
      } else {
        const dH = Q_.x0 - (px - Q_.L) / (Q_.R - Q_.L) * (Q_.x0 - Q_.x1);
        const dN = Q_.y0 + (py - Q_.T) / (Q_.B - Q_.T) * (Q_.y1 - Q_.y0);
        if (dH >= 8.0 && dH <= 9.0) state.hsqc.dH = Math.round(dH * 100) / 100;
        if (dN >= 108.1 && dN <= 117.1) state.hsqc.dN = Math.round(dN * 10) / 10;
      }
      buildControls();
      refreshPlotOnly();
    });
    renderZooms();
    renderMinis();
    switchObject('hmbc');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
