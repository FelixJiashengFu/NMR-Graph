/* 水墨 HSQC：墨圈交叉峰、两条一维曲线、从一维展开到二维、放大碳维、选点题跋；另有位移连线图和卤代甲烷对照。无依赖。 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const registry = {};
  let uid = 0;

  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // 'CH3I' → CH<sub>3</sub>I；'{13}C' → <sup>13</sup>C
  function f(s) {
    return '<span class="chem">' + String(s)
      .replace(/\{(\d+)\}/g, '<sup>$1</sup>')
      .replace(/([A-Za-z)\]])(\d+)/g, '$1<sub>$2</sub>')
      .replace(/\^(\S+)/g, '<sup>$1</sup>') + '</span>';
  }
  // SVG 文字里的上下标：parts 形如 ['δ ', ['13', 'sup'], 'C']
  function rich(t, parts) {
    let shift = 0;
    parts.forEach((part) => {
      const [s, kind] = Array.isArray(part) ? part : [part, ''];
      const want = kind === 'sup' ? -5 : kind === 'sub' ? 3 : 0;
      const ts = svg('tspan', kind ? { 'font-size': '0.72em', dy: want - shift } : { dy: want - shift }, t);
      ts.textContent = s;
      shift = want;
    });
    return t;
  }
  function svgChem(t, s) {
    return rich(t, String(s).split(/(?<=[A-Za-z])(\d+)/).filter(Boolean).map((part) => (/^\d+$/.test(part) ? [part, 'sub'] : part)));
  }
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ease = (k) => k * k * (3 - 2 * k);
  const key = (fn) => (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } };

  function mount(cfg) {
    const host = document.querySelector(cfg.el);
    const panel = document.querySelector(cfg.panel);
    const chips = cfg.chips ? document.querySelector(cfg.chips) : null;
    const slider = cfg.slider ? document.querySelector(cfg.slider) : null;
    const play = cfg.play ? document.querySelector(cfg.play) : null;
    const zoomBtn = cfg.zoom ? document.querySelector(cfg.zoom) : null;
    const table = cfg.table ? document.querySelector(cfg.table) : null;
    const id = ++uid;
    const W = 1000, H = 684;
    const box = { l: 92, r: 926, t: 124, b: 624 };
    const [hHi, hLo] = cfg.h;
    const cFull = cfg.c, cZoom = cfg.zoomC;
    const peaks = cfg.peaks, carbons = cfg.carbons;
    const byId = {}, cOf = {};
    peaks.forEach((p) => { byId[p.id] = p; });
    carbons.forEach((c) => { cOf[c.key] = c; });
    const listeners = [];
    const X = (h) => box.l + (hHi - h) / (hHi - hLo) * (box.r - box.l);
    const y0 = box.t + 24;                 // 收拢成一维时，所有点停在这一行
    const baseT = box.t - 8, baseL = box.l - 8;
    let t = 1, z = 0, cur = null, raf = 0, timer = 0;
    let lo = cFull[0], hi = cFull[1];
    const Yc = (c) => box.t + (c - lo) / (hi - lo) * (box.b - box.t);
    const Y = (p) => y0 + (Yc(p.c) - y0) * ease(t);
    const gap = (a, b) => Math.abs(a.h - b.h).toFixed(2);

    host.innerHTML = '';
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': cfg.title || 'HSQC 谱图' }, host);
    const defs = svg('defs', {}, root);
    const whole = { filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H };
    const rough = svg('filter', Object.assign({ id: `rough${id}` }, whole), defs);
    svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.03 0.09', numOctaves: 2, seed: 7 + id, result: 'n' }, rough);
    svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.4, xChannelSelector: 'R', yChannelSelector: 'G' }, rough);
    const soft = svg('filter', Object.assign({ id: `soft${id}` }, whole), defs);
    svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.08', numOctaves: 2, seed: 3 + id, result: 'n' }, soft);
    svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 1.7, xChannelSelector: 'R', yChannelSelector: 'G' }, soft);
    const blur = svg('filter', { id: `blur${id}`, x: '-60%', y: '-120%', width: '220%', height: '340%' }, defs);
    svg('feGaussianBlur', { stdDeviation: 5 }, blur);
    svg('rect', { x: box.l, y: box.t, width: box.r - box.l, height: box.b - box.t }, svg('clipPath', { id: `box${id}` }, defs));
    svg('rect', { x: 0, y: box.t, width: box.l, height: box.b - box.t }, svg('clipPath', { id: `gut${id}` }, defs));

    // 顶上的一维氢谱：描自截图，画成一道远山
    const sT = 84 / Math.max.apply(null, cfg.top.map((q) => q[1]));
    const sL = 58 / Math.max.apply(null, cfg.left.map((q) => q[1]));
    const dTop = cfg.top.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)} ${(baseT - q[1] * sT).toFixed(1)}`).join('');
    svg('path', { d: `${dTop}L${X(cfg.top[cfg.top.length - 1][0]).toFixed(1)} ${baseT}L${X(cfg.top[0][0]).toFixed(1)} ${baseT}Z`, class: 'ridge', filter: `url(#blur${id})` }, root);
    svg('path', { d: dTop, class: 'trace', filter: `url(#rough${id})` }, root);
    svg('text', { x: box.l + 2, y: baseT - 16, class: 'note' }, root).textContent = cfg.topNote || '';

    // 左侧的碳维曲线：随展开程度长出来
    const gut = svg('g', { 'clip-path': `url(#gut${id})` }, root);
    const leftRidge = svg('path', { class: 'ridge', filter: `url(#blur${id})` }, gut);
    const leftTrace = svg('path', { class: 'trace' }, gut);

    svg('rect', { x: box.l, y: box.t, width: box.r - box.l, height: box.b - box.t, class: 'frame' }, root);
    for (let i = Math.ceil(hLo / 0.05 - 1e-6); i <= Math.floor(hHi / 0.05 + 1e-6); i++) {
      const v = i * 0.05, major = i % 4 === 0;
      svg('line', { x1: X(v), x2: X(v), y1: box.b, y2: box.b + (major ? 7 : 3.5), class: 'tick' }, root);
      if (major) svg('text', { x: X(v), y: box.b + 24, 'text-anchor': 'middle' }, root).textContent = v.toFixed(1);
    }
    rich(svg('text', { x: box.r, y: box.b + 48, 'text-anchor': 'end', class: 'axis-name' }, root), ['δ ', ['1', 'sup'], 'H / ppm']);
    rich(svg('text', { x: box.r + 10, y: box.t - 12, class: 'axis-name' }, root), ['δ ', ['13', 'sup'], 'C']);
    const inkAxes = svg('g', { filter: `url(#rough${id})` }, root);
    svg('path', { d: `M${box.l - 6} ${box.b} L${box.r + 6} ${box.b}`, class: 'axis' }, inkAxes);
    svg('path', { d: `M${box.r} ${box.b} L${box.r} ${box.t - 6}`, class: 'axis', 'stroke-width': 1.6 }, inkAxes);

    const gTicks = svg('g', {}, root);
    const gRows = svg('g', { 'clip-path': `url(#box${id})` }, root);
    const gRail = svg('g', { 'clip-path': `url(#box${id})` }, root);
    const blobLayer = svg('g', { filter: `url(#soft${id})` }, svg('g', { 'clip-path': `url(#box${id})` }, root));
    const gSel = svg('g', {}, root);
    const hov = svg('text', { class: 'hov', x: 0, y: 0 }, root);
    const gHits = svg('g', { 'clip-path': `url(#box${id})` }, root);

    peaks.forEach((p) => {
      p.g = svg('g', { class: 'pk' }, blobLayer);
      svg('ellipse', { rx: 30, ry: 12, class: 'wash', filter: `url(#blur${id})` }, p.g);
      [[25, 8.5], [17, 5.6], [9.5, 3]].forEach(([rx, ry]) => svg('ellipse', { rx, ry, class: 'ring' }, p.g));
      svg('ellipse', { rx: 2.6, ry: 1.3, class: 'core' }, p.g);
      p.hit = svg('ellipse', { rx: 19, ry: 16, class: 'hit', tabindex: 0, role: 'button', 'aria-label': `交叉峰：氢 ${p.hs} ppm，碳 ${cOf[p.carbon].cs} ppm` }, gHits);
      p.hit.addEventListener('click', () => select(p.id));
      p.hit.addEventListener('keydown', key(() => select(p.id)));
      p.hit.addEventListener('mouseenter', () => {
        hov.textContent = t > 0.5 ? `氢 ${p.hs} · 碳 ${cOf[p.carbon].cs}` : `氢 ${p.hs}`;
        hov.setAttribute('x', Math.min(Math.max(X(p.h), box.l + 70), box.r - 70));
        hov.setAttribute('y', Y(p) - 22 - 8 * z);
      });
      p.hit.addEventListener('mouseleave', () => { hov.textContent = ''; });
    });

    function update() {
      const k = ease(z), e = ease(t), sy = 1 + 1.2 * k;
      lo = cFull[0] + (cZoom[0] - cFull[0]) * k;
      hi = cFull[1] + (cZoom[1] - cFull[1]) * k;

      // 碳轴刻度随放大重排
      gTicks.innerHTML = '';
      gTicks.setAttribute('opacity', 0.25 + 0.75 * e);
      const wide = hi - lo > 14, major = wide ? 5 : 1, minor = wide ? 1 : 0.25;
      const selY = cur && e > 0.5 && Y(cur) > box.t && Y(cur) < box.b ? Y(cur) : null;
      for (let i = Math.ceil(lo / minor - 1e-6); i <= Math.floor(hi / minor + 1e-6); i++) {
        const v = i * minor, big = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        svg('line', { x1: box.r, x2: box.r + (big ? 7 : 3.5), y1: Yc(v), y2: Yc(v), class: 'tick' }, gTicks);
        // 选中点的碳位移会写在这一侧，挨得太近的刻度数字让位
        if (big && !(selY != null && Math.abs(Yc(v) - selY) < 13)) svg('text', { x: box.r + 12, y: Yc(v) + 5 }, gTicks).textContent = Math.round(v);
      }

      const pts = cfg.left.filter((q) => q[0] >= lo - 1 && q[0] <= hi + 1);
      if (pts.length > 1 && e > 0.01) {
        const d = pts.map((q, i) => `${i ? 'L' : 'M'}${(baseL - q[1] * sL * e).toFixed(1)} ${Yc(q[0]).toFixed(1)}`).join('');
        leftTrace.setAttribute('d', d);
        leftRidge.setAttribute('d', `${d}L${baseL} ${Yc(pts[pts.length - 1][0]).toFixed(1)}L${baseL} ${Yc(pts[0][0]).toFixed(1)}Z`);
      } else {
        leftTrace.setAttribute('d', '');
        leftRidge.setAttribute('d', '');
      }

      gRows.innerHTML = '';
      carbons.forEach((c) => {
        const y = Yc(c.c), on = !!cur && cur.carbon === c.key;
        svg('line', { x1: box.l, x2: box.r, y1: y, y2: y, class: 'row' + (on ? ' on' : ''), opacity: e }, gRows);
        svg('text', { x: box.l + 14, y: y + (c.side < 0 ? -9 : 27), class: 'row-name' + (on ? ' on' : ''), opacity: e }, gRows).textContent = c.key;
      });

      peaks.forEach((p) => {
        const x = X(p.h), y = Y(p);
        p.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1 ${sy.toFixed(3)})`);
        p.g.setAttribute('class', 'pk' + (p === cur ? ' on' : '') + (cur && cur.mate === p.id ? ' mate' : ''));
        p.hit.setAttribute('cx', x);
        p.hit.setAttribute('cy', y);
        p.hit.setAttribute('ry', 16 * sy);
      });

      gSel.innerHTML = '';
      gRail.innerHTML = '';
      if (cur) {
        const x = X(cur.h), y = Y(cur), inView = y > box.t && y < box.b, ry = 8.5 * sy;
        svg('line', { x1: x, x2: x, y1: baseT, y2: box.b, class: 'cross' }, gSel);
        svg('text', { x, y: box.b + 48, class: 'tag' }, gSel).textContent = cur.hs;
        if (inView && e > 0.5) svg('text', { x: box.r + 12, y: y + 5, class: 'tag', style: 'text-anchor:start', opacity: e }, gSel).textContent = cOf[cur.carbon].cs;
        const m = cur.mate && byId[cur.mate];
        if (m) {
          const xm = X(m.h), ym = Y(m), up = cOf[cur.carbon].side < 0;
          svg('line', { x1: x, x2: xm, y1: y, y2: ym, class: 'rail' }, gRail);
          if (inView) {
            svg('text', { x: (x + xm) / 2, y: up ? Math.min(y, ym) - ry - 12 : Math.max(y, ym) + ry + 25, class: 'tag', opacity: e }, gSel)
              .textContent = `同一个碳 · 相隔 ${gap(cur, m)} ppm`;
          }
        }
      }
      if (slider) {
        slider.value = Math.round(t * 100);
        slider.setAttribute('aria-valuetext', t < 0.02 ? '收拢成一维氢谱' : t > 0.98 ? '完全展开' : `展开 ${Math.round(t * 100)}%`);
      }
    }

    function stop() { cancelAnimationFrame(raf); clearTimeout(timer); }
    function animate(ms, step) {
      stop();
      const finish = () => { stop(); step(1); update(); };
      if (reduce()) { finish(); return; }
      const s = performance.now();
      const tick = (now) => {
        const k = Math.min((now - s) / ms, 1);
        if (k >= 1) { finish(); return; }
        step(k);
        update();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      timer = setTimeout(finish, ms + 400);   // 页面在后台时 rAF 不走，用定时器收尾
    }
    function setZoom(target) {
      const from = z;
      t = 1;
      if (zoomBtn) zoomBtn.setAttribute('aria-pressed', String(target === 1));
      animate(650, (k) => { z = from + (target - from) * k; });
    }

    function renderPanel(p) {
      const c = cOf[p.carbon], m = p.mate && byId[p.mate];
      panel.innerHTML =
        `<div class="p-mz"><b class="num">${p.hs}</b><span>δ<sub>H</sub> / ppm</span></div>` +
        `<div class="p-ion">连在碳<b>${c.key}</b>上，δ<sub>C</sub> ≈ ${c.cs} ppm</div>` +
        `<div class="p-name">${p.name}</div>` +
        `<p>${p.note}</p>` +
        (m ? `<h4>同一个碳上的另一个氢</h4><div class="p-links"><div><button type="button" data-go="${m.id}">δ<sub>H</sub> ${m.hs}<em>相隔 ${gap(p, m)} ppm</em></button>${c.pair ? `<small>${c.pair}</small>` : ''}</div></div>` : '') +
        `<h4>单看一维氢谱</h4><p>${p.solo}</p>`;
      panel.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => select(b.dataset.go)));
    }

    function select(pid) {
      const p = byId[pid];
      if (!p) return;
      cur = p;
      if (z > 0 && (p.c < cZoom[0] || p.c > cZoom[1])) setZoom(0);   // 选到放大范围以外的点，先退回全图
      update();
      renderPanel(p);
      if (chips) chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === pid)));
      listeners.forEach((fn) => fn(pid));
    }

    if (chips) {
      peaks.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = p.id;
        b.innerHTML = `<i>${p.carbon}</i>${p.hs}`;
        b.setAttribute('aria-label', `碳${p.carbon}上的氢，${p.hs} ppm`);
        b.addEventListener('click', () => select(p.id));
        chips.appendChild(b);
      });
    }
    if (table) {
      table.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>δ<sub>H</sub> / ppm</th><th>δ<sub>C</sub> / ppm</th><th>碳</th><th>同碳的另一个氢</th><th>截图像素 (x, y)</th></tr></thead><tbody>' +
        peaks.map((p) => `<tr><td class="n"><button type="button" data-id="${p.id}">${p.h.toFixed(3)}</button></td><td class="n">${p.c.toFixed(2)}</td><td><b class="k">${p.carbon}</b></td><td class="n">${p.mate ? byId[p.mate].hs : '没有'}</td><td class="n">${p.px.join('，')}</td></tr>`).join('') +
        '</tbody></table></div>';
      table.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        select(b.dataset.id);
        host.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
      }));
    }
    if (slider) {
      slider.addEventListener('input', () => {
        stop();
        z = 0;
        if (zoomBtn) zoomBtn.setAttribute('aria-pressed', 'false');
        t = slider.value / 100;
        update();
      });
    }
    if (play) {
      play.addEventListener('click', () => {
        stop();
        z = 0;
        if (zoomBtn) zoomBtn.setAttribute('aria-pressed', 'false');
        if (reduce()) { t = t > 0.5 ? 0 : 1; update(); return; }
        t = 0;
        update();
        timer = setTimeout(() => animate(1900, (k) => { t = k; }), 500);
      });
    }
    if (zoomBtn) {
      zoomBtn.addEventListener('click', () => {
        const target = z < 0.5 ? 1 : 0;
        if (target && cur && (cur.c < cZoom[0] || cur.c > cZoom[1]) && cfg.zoomFocus) {
          cur = byId[cfg.zoomFocus];
          renderPanel(cur);
          if (chips) chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cur.id)));
          listeners.forEach((fn) => fn(cur.id));
        }
        setZoom(target);
      });
    }

    select(cfg.start || peaks[0].id);
    registry[cfg.el] = { select, peaks, carbons, host, on: (fn) => listeners.push(fn), current: () => cur && cur.id };
    return registry[cfg.el];
  }

  // 位移连线图：左边按氢的位移排，右边按碳的位移排。线交叉，就是两边的顺序不一致。
  function slope(sel, specSel) {
    const host = document.querySelector(sel), inst = registry[specSel];
    const W = 460, H = 336, xl = 128, xr = 312, top = 62, bot = 300;
    const ps = inst.peaks, cs = inst.carbons, cOf = {};
    cs.forEach((c) => { cOf[c.key] = c; });
    const span = (arr) => { const a = Math.min.apply(null, arr), b = Math.max.apply(null, arr); return [a - (b - a) * 0.1, b + (b - a) * 0.1]; };
    const [h0, h1] = span(ps.map((p) => p.h)), [c0, c1] = span(cs.map((c) => c.c));
    const yH = (h) => bot - (h - h0) / (h1 - h0) * (bot - top);
    const yC = (c) => bot - (c - c0) / (c1 - c0) * (bot - top);
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': '氢位移与碳位移的连线图' }, host);
    svg('text', { x: xl, y: 24, 'text-anchor': 'middle', class: 'hd' }, root).textContent = '氢的位移';
    svg('text', { x: xr, y: 24, 'text-anchor': 'middle', class: 'hd' }, root).textContent = '碳的位移';
    svg('text', { x: (xl + xr) / 2, y: 44, 'text-anchor': 'middle', class: 'hd' }, root).textContent = '上大 · 下小';
    svg('line', { x1: xl, x2: xl, y1: top - 14, y2: bot + 14, class: 'ax' }, root);
    svg('line', { x1: xr, x2: xr, y1: top - 14, y2: bot + 14, class: 'ax' }, root);
    const gl = svg('g', {}, root);
    // 右侧标签太近时上下错开
    const lab = cs.map((c) => ({ c, y: yC(c.c) + 5 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) {
      const d = 20 - (lab[i].y - lab[i - 1].y);
      if (d > 0) { lab[i - 1].y -= d / 2; lab[i].y += d / 2; }
    }
    lab.forEach((l) => {
      svg('circle', { cx: xr, cy: yC(l.c.c), r: 4, class: 'pt' }, root);
      const tx = svg('text', { x: xr + 12, y: l.y, class: 'lb' }, root);
      svg('tspan', { class: 'k' }, tx).textContent = l.c.key;
      svg('tspan', { dx: 6 }, tx).textContent = l.c.cs;
      l.c.slopeText = tx;
    });
    ps.forEach((p) => {
      const ya = yH(p.h), yb = yC(cOf[p.carbon].c);
      p.sl = svg('line', { x1: xl, y1: ya, x2: xr, y2: yb, class: 'ln' }, gl);
      p.sp = svg('circle', { cx: xl, cy: ya, r: 4, class: 'pt' }, root);
      p.st = svg('text', { x: xl - 12, y: ya + 5, 'text-anchor': 'end', class: 'lb' }, root);
      p.st.textContent = p.hs;
      const hit = svg('line', { x1: xl - 46, y1: ya, x2: xr, y2: yb, class: 'hitl', tabindex: 0, role: 'button', 'aria-label': `氢 ${p.hs} 连到碳${p.carbon} ${cOf[p.carbon].cs}` }, root);
      hit.addEventListener('click', () => inst.select(p.id));
      hit.addEventListener('keydown', key(() => inst.select(p.id)));
    });
    const paint = (pid) => {
      ps.forEach((p) => {
        const on = p.id === pid;
        p.sl.setAttribute('class', 'ln' + (on ? ' on' : ''));
        p.sp.setAttribute('class', 'pt' + (on ? ' on' : ''));
        p.st.setAttribute('class', 'lb' + (on ? ' on' : ''));
        if (on) gl.appendChild(p.sl);
      });
      const cur = ps.find((p) => p.id === pid);
      cs.forEach((c) => c.slopeText.setAttribute('class', 'lb' + (cur && cur.carbon === c.key ? ' on' : '')));
    };
    inst.on(paint);
    paint(inst.current());
  }

  // 卤代甲烷：氢和碳各一列横条，同一把尺子上比较
  function halides(sel, rows) {
    const host = document.querySelector(sel);
    const W = 460, rowH = 34, top = 44, H = top + rows.length * rowH + 8;
    const zh = 86, kh = 27, zc = 312, kc = 1.42;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '甲烷与卤代甲烷的氢、碳化学位移对照' }, host);
    rich(svg('text', { x: zh, y: 22, class: 'hd' }, root), ['氢 δ', ['H', 'sub']]);
    rich(svg('text', { x: zc, y: 22, class: 'hd' }, root), ['碳 δ', ['C', 'sub']]);
    svg('line', { x1: zh, x2: zh, y1: top - 10, y2: H - 6, class: 'zero' }, root);
    svg('line', { x1: zc, x2: zc, y1: top - 10, y2: H - 6, class: 'zero' }, root);
    rows.forEach((r, i) => {
      const y = top + i * rowH + 10;
      svgChem(svg('text', { x: 8, y: y + 5, class: 'f' }, root), r.f);
      const bar = (zero, v, k) => {
        const w = Math.max(Math.abs(v) * k, 2), neg = v < 0;
        svg('rect', { x: neg ? zero - w : zero, y: y - 4.5, width: w, height: 9, rx: 4.5, class: 'bar' + (neg ? ' neg' : '') }, root);
        const tx = svg('text', { x: neg ? zero - w - 7 : zero + w + 7, y: y + 5, 'text-anchor': neg ? 'end' : 'start', class: 'v' + (neg ? ' neg' : '') }, root);
        tx.textContent = String(v).replace('-', '−');
      };
      bar(zh, r.h, kh);
      bar(zc, r.c, kc);
    });
  }

  function decorate() {
    document.querySelectorAll('header.top').forEach((head, i) => {
      const s = svg('svg', { viewBox: '0 0 600 220', class: 'hills', 'aria-hidden': 'true' });
      const d = svg('defs', {}, s);
      const b1 = svg('filter', { id: `hb1-${i}` }, d); svg('feGaussianBlur', { stdDeviation: 4 }, b1);
      const b2 = svg('filter', { id: `hb2-${i}` }, d); svg('feGaussianBlur', { stdDeviation: 1.6 }, b2);
      svg('circle', { cx: 468, cy: 44, r: 15, class: 'sun' }, s);
      svg('path', { d: 'M0 220 L0 160 Q60 126 110 140 T200 92 Q240 60 282 104 T380 84 Q430 52 472 98 T600 124 L600 220Z', class: 'far', filter: `url(#hb1-${i})` }, s);
      svg('path', { d: 'M0 220 L0 196 Q80 158 150 180 T300 156 Q360 128 420 170 T600 176 L600 220Z', class: 'near', filter: `url(#hb2-${i})` }, s);
      head.insertBefore(s, head.firstChild);
    });
    document.querySelectorAll('[data-f]').forEach((e) => { e.innerHTML = f(e.textContent); });
    document.querySelectorAll('[data-sel]').forEach((e) => {
      e.addEventListener('click', () => {
        const inst = registry[e.dataset.spec || '#spec'];
        if (!inst) return;
        inst.select(e.dataset.sel);
        if (e.dataset.stay == null) inst.host.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
      });
    });
  }

  window.InkHSQC = { mount, slope, halides, decorate, f };
})();
