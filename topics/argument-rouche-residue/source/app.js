/* app.js — 四个互动图（留数小图、幅角原理、儒歇定理、围道台）和术语注释弹层。依赖 cx.js，无其他依赖。 */
(() => {
  "use strict";
  const { TAU, add, sub, mul, div, scale, abs, arg, exp, polar, powi, wrap, polyEval, polyRoots, turns, integrate, pathPoint } = CX;
  const PI = Math.PI, NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const S = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const set = (e, attrs) => { for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const minus = (s) => String(s).replace("-", "−");
  const fmt = (x, d = 2) => minus((Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d));
  const fmtC = (z, d = 2) => `${fmt(z[0], d)} ${z[1] < -0.5 * 10 ** -d ? "−" : "+"} ${fmt(Math.abs(z[1]), d)}i`;
  const signed = (v, d = 2) => (v >= 0.5 * 10 ** -d ? "+" : "") + fmt(v, d);
  const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const press = (box, on) => $$("button", box).forEach((b) => b.setAttribute("aria-pressed", String(on(b))));

  // 把带 <i> <sub> <sup> 的短字符串写进 SVG 的 <text>（转成 tspan）
  const rich = (el, html) => {
    let it = false, lvl = 0, cur = 0;
    for (const tok of html.split(/(<\/?(?:i|sub|sup)>)/)) {
      if (!tok) continue;
      if (tok === "<i>") it = true; else if (tok === "</i>") it = false; else if (tok === "<sup>") lvl = -1; else if (tok === "<sub>") lvl = 1; else if (tok[0] === "<") lvl = 0;
      else { const a = {}; if (lvl !== cur) a.dy = (lvl - cur) * 5; cur = lvl; if (lvl) a["font-size"] = "0.72em"; if (it) { a["font-style"] = "italic"; a["font-family"] = "KaTeX_Math"; } S("tspan", a, el).textContent = tok; }
    }
    return el;
  };

  // 箭头：杆 + 头；head 只画头（a 是屏幕坐标里的方向角）
  const head = (x, y, a, h = 9) => { const p = (da) => `${(x - h * Math.cos(a + da)).toFixed(1)} ${(y - h * Math.sin(a + da)).toFixed(1)}`; return `M${p(0.5)}L${x.toFixed(1)} ${y.toFixed(1)}L${p(-0.5)}`; };
  const arrow = (x0, y0, x1, y1) => `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}` + head(x1, y1, Math.atan2(y1 - y0, x1 - x0));

  // 一张复平面：数学坐标 ↔ viewBox 坐标，外加坐标轴
  class Plane {
    constructor(svg, W, Ht, opt = {}) { this.svg = svg; this.W = W; this.H = Ht; this.opt = opt; svg.setAttribute("viewBox", `0 0 ${W} ${Ht}`); this.gAx = S("g", {}, svg); }
    view(x0, x1, y0, y1) { this.x0 = x0; this.x1 = x1; this.y0 = y0; this.y1 = y1; this.k = this.W / (x1 - x0); this.axes(); return this; }
    X(x) { return clamp((x - this.x0) * this.k, -1e5, 1e5); }
    Y(y) { return clamp((this.y1 - y) * this.k, -1e5, 1e5); }
    path(pts, i0 = 0, i1 = pts.length - 1) { let d = ""; for (let i = i0; i <= i1; i++) d += (i === i0 ? "M" : "L") + this.X(pts[i][0]).toFixed(1) + " " + this.Y(pts[i][1]).toFixed(1); return d; }
    at(ev) { const r = this.svg.getBoundingClientRect(); return [this.x0 + (ev.clientX - r.left) / r.width * (this.x1 - this.x0), this.y1 - (ev.clientY - r.top) / r.height * (this.y1 - this.y0)]; }
    axes() {
      const g = this.gAx, ox = this.X(0), oy = this.Y(0), o = this.opt; g.replaceChildren();
      S("line", { class: "ax", x1: 0, y1: oy, x2: this.W, y2: oy }, g); S("line", { class: "ax", x1: ox, y1: 0, x2: ox, y2: this.H }, g);
      if (o.re !== "") S("text", { x: this.W - 6, y: oy - 7, "text-anchor": "end" }, g).textContent = o.re || "Re";
      if (o.im !== "") S("text", { x: ox + 8, y: 15 }, g).textContent = o.im || "Im";
      if (o.ticks === false) return;
      const step = niceStep((this.x1 - this.x0) / 6), lab = (v) => minus(+v.toFixed(6));
      for (let v = Math.ceil(this.x0 / step) * step; v < this.x1; v += step) {
        const x = this.X(v); if (Math.abs(v) < step / 2 || x < 16 || x > this.W - 34) continue;
        S("line", { class: "tk", x1: x, y1: oy - 4, x2: x, y2: oy + 4 }, g); S("text", { x, y: oy + 17, "text-anchor": "middle" }, g).textContent = lab(v);
      }
      for (let v = Math.ceil(this.y0 / step) * step; v < this.y1; v += step) {
        const y = this.Y(v); if (Math.abs(v) < step / 2 || y < 24 || y > this.H - 10) continue;
        S("line", { class: "tk", x1: ox - 4, y1: y, x2: ox + 4, y2: y }, g);
        S("text", { x: ox - 8, y: y + 4, "text-anchor": "end" }, g).textContent = (Math.abs(Math.abs(v) - 1) < 1e-9 ? (v < 0 ? "−" : "") : lab(v)) + "i";
      }
    }
  }

  // 0 → 1 的播放器（“走一圈”按钮）。系统要求减少动态效果时直接跳到终点。
  function player(btn, dur, get, put, idle) {
    let raf = 0, t0 = 0, from = 0;
    const stop = () => { if (!raf) return; cancelAnimationFrame(raf); raf = 0; btn.textContent = idle; btn.setAttribute("aria-pressed", "false"); };
    const tick = (now) => { const v = Math.min(1, from + (now - t0) / dur); put(v); if (v >= 1) stop(); else raf = requestAnimationFrame(tick); };
    btn.addEventListener("click", () => {
      if (raf) return stop();
      if (reduced.matches) return put(1);
      from = get() >= 1 ? 0 : get(); t0 = performance.now(); btn.textContent = "暂停"; btn.setAttribute("aria-pressed", "true"); raf = requestAnimationFrame(tick);
    });
    return { stop };
  }

  // 折线图：至多两条线（墨色实线、朱色虚线），一条 y 轴；悬停出读数，点一下回调 onPick
  function lineChart(svg, onPick) {
    const W = 640, Ht = 250, m = { l: 48, r: 60, t: 14, b: 36 }, pw = W - m.l - m.r, ph = Ht - m.t - m.b;
    svg.setAttribute("viewBox", `0 0 ${W} ${Ht}`);
    const cid = svg.id + "-clip";
    S("rect", { x: m.l, y: m.t - 3, width: pw, height: ph + 3 }, S("clipPath", { id: cid }, S("defs", {}, svg)));
    const gGrid = S("g", {}, svg), gSer = S("g", { "clip-path": `url(#${cid})` }, svg), gLab = S("g", {}, svg);
    const mk = S("line", { class: "mk", y1: m.t, y2: m.t + ph, visibility: "hidden" }, svg);
    const cross = S("line", { class: "cross", y1: m.t, y2: m.t + ph, visibility: "hidden" }, svg);
    const hit = S("rect", { class: "hit", x: m.l, y: m.t, width: pw, height: ph }, svg);
    const tip = $(".tip", svg.parentNode), legend = $(".chart-legend", svg.parentNode);
    let o = null;
    const X = (x) => m.l + (x - o.xDom[0]) / (o.xDom[1] - o.xDom[0]) * pw;
    const Y = (y) => m.t + ph - clamp(y / o.yMax, -0.2, 1.4) * ph;
    const xAt = (ev) => { const r = svg.getBoundingClientRect(); return o.xDom[0] + clamp(((ev.clientX - r.left) / r.width * W - m.l) / pw, 0, 1) * (o.xDom[1] - o.xDom[0]); };
    hit.addEventListener("pointermove", (ev) => {
      if (!o) return; const x = xAt(ev), r = svg.getBoundingClientRect();
      set(cross, { x1: X(x), x2: X(x), visibility: "visible" });
      if (tip && o.tip) { tip.innerHTML = o.tip(x); tip.hidden = false; tip.style.left = clamp(X(x) / W * r.width, 90, Math.max(90, r.width - 90)) + "px"; }
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); if (tip) tip.hidden = true; });
    if (onPick) hit.addEventListener("click", (ev) => { if (o) onPick(xAt(ev)); });
    return {
      update(opt) {
        o = opt; gGrid.replaceChildren(); gSer.replaceChildren(); gLab.replaceChildren();
        const step = niceStep(o.yMax / 4);
        for (let v = 0; v <= o.yMax * 1.0001; v += step) {
          if (v > 0) S("line", { class: "grid", x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v) }, gGrid);
          S("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" }, gGrid).textContent = +v.toFixed(6);
        }
        for (const [v, lab] of o.xTicks) S("text", { x: X(v), y: m.t + ph + 19, "text-anchor": "middle" }, gGrid).textContent = lab;
        S("text", { x: m.l + pw + 30, y: m.t + ph + 19 }, gGrid).textContent = o.xName;
        for (const [a, b] of o.bands || []) S("rect", { class: "band", x: X(a), y: m.t, width: Math.max(1, X(b) - X(a)), height: ph }, gSer);
        if (o.hline != null) { S("line", { class: "hl", x1: m.l, x2: m.l + pw, y1: Y(o.hline), y2: Y(o.hline) }, gSer); S("text", { class: "dl", x: m.l + pw - 6, y: Y(o.hline) - 7, "text-anchor": "end" }, gLab).textContent = o.hlineLabel; }
        const ends = [];
        for (const s of o.series) {
          let d = "", pen = false, last = null;
          for (const p of s.pts) { if (!p || !isFinite(p[1])) { pen = false; continue; } d += (pen ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); pen = true; last = p; }
          if (s.area) S("path", { class: "area", d: d + `L${X(last[0]).toFixed(1)} ${Y(0)}L${X(s.pts[0][0]).toFixed(1)} ${Y(0)}Z` }, gSer);
          S("path", { class: s.cls, d }, gSer);
          if (s.label && last) ends.push({ y: clamp(Y(last[1]), m.t + 6, m.t + ph - 2), label: s.label });
        }
        ends.sort((a, b) => a.y - b.y);
        if (ends.length === 2 && ends[1].y - ends[0].y < 16) { const mid = (ends[0].y + ends[1].y) / 2; ends[0].y = mid - 8; ends[1].y = mid + 8; }
        for (const e of ends) S("text", { class: "dl", x: m.l + pw + 8, y: e.y + 4 }, gLab).textContent = e.label;
        S("line", { class: "base", x1: m.l, x2: m.l + pw, y1: Y(0), y2: Y(0) }, gGrid);
        if (legend) legend.innerHTML = (o.legend || []).map(([cls, text]) => `<span><i class="${cls}"></i>${text}</span>`).join("");
      },
      mark(x) { if (!o || x == null) return mk.setAttribute("visibility", "hidden"); set(mk, { x1: X(x), x2: X(x), visibility: "visible" }); },
    };
  }

  /* ───────── 术语注释弹层：正文里的 .term 按钮 → 卷末总表里对应的一条 ───────── */
  (function gloss() {
    const pop = $("#pop"); if (!pop) return;
    let cur = null;
    const close = () => { if (!cur) return; cur.setAttribute("aria-expanded", "false"); pop.hidden = true; cur = null; };
    function open(b) {
      close(); const src = document.getElementById("g-" + b.dataset.g); if (!src) return;
      $("#pop-title").textContent = $("dt", src).textContent; $("#pop-body").innerHTML = $("dd", src).innerHTML; $("#pop-more").href = "#g-" + b.dataset.g;
      pop.hidden = false; b.setAttribute("aria-expanded", "true"); cur = b;
      const r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      pop.style.left = scrollX + clamp(r.left, 16, Math.max(16, vw - pop.offsetWidth - 16)) + "px"; pop.style.top = scrollY + r.bottom + 8 + "px";
    }
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest(".term");
      if (b) return b === cur ? close() : open(b);
      if (ev.target.closest("#pop-close, #pop-more") || !ev.target.closest("#pop")) close();
    });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && cur) { const b = cur; close(); b.focus(); } });
    addEventListener("resize", close);
  })();

  /* ───────── 引：沿单位圆把 zⁿdz 一小步一小步加起来 ───────── */
  (function labSeed() {
    if (!$("#lab-seed")) return;
    const A = new Plane($("#seed-z"), 420, 420).view(-1.75, 1.75, -1.75, 1.75);
    const B = new Plane($("#seed-s"), 420, 420).view(-4.5, 4.5, -1.7, 7.3);
    const st = { n: -1, th: TAU };
    S("circle", { class: "contour", cx: A.X(0), cy: A.Y(0), r: A.k }, A.svg);
    const vec = S("path", { class: "vec" }, A.svg), dot = S("circle", { class: "now", r: 6 }, A.svg);
    const ghost = S("path", { class: "ghost" }, B.svg), trace = S("path", { class: "trace red" }, B.svg);
    S("circle", { class: "zero", cx: B.X(0), cy: B.Y(TAU), r: 3.5 }, B.svg);
    S("text", { class: "lab", x: B.X(0) + 12, y: B.Y(TAU) + 4 }, B.svg).textContent = "2πi";
    const end = S("circle", { class: "now", r: 6 }, B.svg);
    // ∫₀^θ i·e^{i(n+1)t} dt：n = −1 时是 iθ，否则是 (e^{i(n+1)θ} − 1)/(n+1)
    const sum = (n, th) => (n === -1 ? [0, th] : scale(sub(polar(1, (n + 1) * th), [1, 0]), 1 / (n + 1)));
    const locus = (n, th) => { const m = Math.max(2, Math.ceil(300 * th / TAU)), pts = []; for (let i = 0; i <= m; i++) pts.push(sum(n, th * i / m)); return pts; };
    const chips = $("#seed-n"), slider = $("#seed-th"), panel = $("#seed-panel");
    for (const n of [-3, -2, -1, 0, 1, 2]) { const b = document.createElement("button"); b.type = "button"; b.dataset.n = n; b.innerHTML = `<i>n</i> = ${minus(n)}`; chips.appendChild(b); }
    function draw() {
      const { n, th } = st, z = polar(1, th), u = polar(0.62, (n + 1) * th + PI / 2), s = sum(n, th), k = Math.abs(n + 1);
      set(dot, { cx: A.X(z[0]), cy: A.Y(z[1]) });
      vec.setAttribute("d", arrow(A.X(z[0]), A.Y(z[1]), A.X(z[0] + u[0]), A.Y(z[1] + u[1])));
      ghost.setAttribute("d", B.path(locus(n, TAU))); trace.setAttribute("d", B.path(locus(n, th)));
      set(end, { cx: B.X(s[0]), cy: B.Y(s[1]) });
      $("#seed-th-o").textContent = fmt(th / PI, 2) + "π";
      press(chips, (b) => +b.dataset.n === n);
      panel.innerHTML = `<div class="p-mz math"><b>${n === -1 ? "2π<i>i</i>" : "0"}</b><span>走完一圈的总和 ∮ <i class="v">z</i><sup>${minus(n)}</sup> d<i class="v">z</i></span></div>
        <div class="p-ion">此刻累计：<span class="num">${fmtC(s)}</span></div>
        <p>${n === -1
          ? "<i class=\"v\">n</i> = −1 时，每一小步 <i class=\"v\">z</i><sup>−1</sup>d<i class=\"v\">z</i> 都等于 <i class=\"v\">i</i>·dθ，方向始终朝正上方。步步同向，越积越高，走完一圈停在 2π<i class=\"v\">i</i>。"
          : `<i class="v">n</i> = ${minus(n)} 时，每一小步的方向跟着 θ 转：<i class="v">z</i> 走一圈，它${n + 1 < 0 ? "反着" : ""}转 ${k} 圈。小步首尾相接，围成一个圆${k > 1 ? `（绕 ${k} 遍）` : ""}，回到起点，总和是 0。`}</p>
        <p class="hint">右图的红线是把走过的小步接起来的结果；灰线是走完一圈的全貌。</p>`;
    }
    const play = player($("#seed-play"), 6000, () => st.th / TAU, (v) => { st.th = v * TAU; slider.value = Math.round(v * 360); draw(); }, "走一圈");
    chips.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return; st.n = +b.dataset.n; draw(); });
    slider.addEventListener("input", () => { play.stop(); st.th = slider.value / 360 * TAU; draw(); });
    draw();
  })();

  /* ───────── 圈：幅角原理。f(z) = ∏(z − aⱼ)^m / ∏(z − b_k)^m，围道是圆 ───────── */
  (function labArg() {
    if (!$("#lab-arg")) return;
    const N = 1440, VZ = 3.6, LIM = VZ - 0.15, SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", r3 = Math.sqrt(3) / 2;
    const Zp = new Plane($("#arg-z"), 420, 420).view(-VZ, VZ, -VZ, VZ);
    const Wp = new Plane($("#arg-w"), 420, 420, { ticks: false, re: "Re w", im: "Im w" });
    const PRESETS = {
      one: { c: [0, 0], r: 1.5, pts: [["z", 0.6, 0.5, 1]] },
      cube: { c: [0.3, 0.2], r: 1.8, pts: [["z", 1, 0, 1], ["z", -0.5, r3, 1], ["z", -0.5, -r3, 1]] },
      cancel: { c: [0, 0], r: 1.6, pts: [["z", 0.8, 0.4, 1], ["p", -0.7, -0.5, 1]] },
      mix: { c: [0.2, 0], r: 1.8, pts: [["z", 1.1, 0.7, 1], ["z", -0.7, 0.9, 1], ["z", 2.6, -1.4, 1], ["p", -0.3, -0.9, 1]] },
      dbl: { c: [0, 0], r: 1.4, pts: [["z", 0, 0, 2], ["p", 2.3, 1, 1]] },
      ex: { c: [0, 0], r: 2, pts: [["z", 1, 0, 2], ["p", 0, 0, 1], ["p", -3, 0, 1]] },
    };
    const SPOTS = [[-0.6, 0.5], [0.5, -0.8], [-0.6, -0.6], [0.9, 1.3], [2.5, 1.9], [-2.4, -1.7], [-0.4, 2.3], [-2.6, 1.6]];
    const st = { pts: [], c: [0, 0], r: 1.5, t: 1, sel: -1 };
    let Zs, Ws, cum, tot, inside, onC, Nin, Pin, nTurns;

    const gRings = S("g", {}, Wp.svg);
    const wGhost = S("path", { class: "ghost" }, Wp.svg), wTrace = S("path", { class: "trace" }, Wp.svg), wHeads = S("path", { class: "ah" }, Wp.svg);
    const wRay = S("line", { class: "ray" }, Wp.svg), wO = S("circle", { class: "origin", r: 5 }, Wp.svg), wDot = S("circle", { class: "now", r: 6 }, Wp.svg);
    const gSpokes = S("g", {}, Zp.svg), zC = S("circle", { class: "contour" }, Zp.svg), zHead = S("path", { class: "ah" }, Zp.svg);
    const zCtr = S("g", { class: "ctr", tabindex: 0, role: "button", "aria-label": "围道的圆心：可拖动，方向键移动" }, Zp.svg);
    S("circle", { class: "halo", r: 13, fill: "none" }, zCtr); S("path", { class: "glyph", d: "M-7 0H7M0-7V7" }, zCtr); S("circle", { class: "hit", r: 16 }, zCtr);
    const gPts = S("g", {}, Zp.svg), zDot = S("circle", { class: "now", r: 6 }, Zp.svg);
    const dials = $("#arg-dials"), panel = $("#arg-panel"), live = $("#arg-live"), tSl = $("#arg-t"), rSl = $("#arg-r"), presets = $("#arg-presets");

    function compute() {
      const { pts, c, r } = st, prev = new Float64Array(pts.length); let pw = 0, maxL = 0;
      Zs = []; Ws = []; cum = pts.map(() => new Float64Array(N + 1)); tot = new Float64Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const z = add(c, polar(r, TAU * i / N)); let w = [1, 0];
        for (let k = 0; k < pts.length; k++) {
          let d = sub(z, pts[k].z); if (abs(d) < 1e-9) d = [1e-9, 0];
          const a = arg(d); if (i) cum[k][i] = cum[k][i - 1] + wrap(a - prev[k]); prev[k] = a;   // 这个因子的幅角，连续累计
          const f = powi(d, pts[k].m); w = pts[k].kind === "z" ? mul(w, f) : div(w, f);
        }
        const aw = arg(w); if (i) tot[i] = tot[i - 1] + wrap(aw - pw); pw = aw;                     // arg f 的连续累计，直接从 w 算
        const mod = abs(w), L = Math.log1p(mod);                                                    // 径向压缩：|w| ↦ ln(1+|w|)，方向不变
        Zs.push(z); Ws.push(mod > 0 ? [w[0] / mod * L, w[1] / mod * L] : [0, 0]); maxL = Math.max(maxL, L);
      }
      inside = pts.map((p) => abs(sub(p.z, c)) < r);
      onC = pts.some((p) => Math.abs(abs(sub(p.z, c)) - r) < 0.04);
      Nin = 0; Pin = 0; pts.forEach((p, k) => { if (inside[k]) p.kind === "z" ? (Nin += p.m) : (Pin += p.m); });
      nTurns = Math.round(tot[N] / TAU);
      const V = Math.max(maxL, 0.9) * 1.16; Wp.view(-V, V, -V, V); gRings.replaceChildren();
      for (const e of [0, 1, 2, 3, 4, 6, 9]) {
        const R = Math.log1p(10 ** e) * Wp.k; if (R > 200) break;
        S("circle", { class: "ring", cx: 210, cy: 210, r: R }, gRings);
        S("text", { x: 210 + R * 0.7071 + 3, y: 210 + R * 0.7071 + 12 }, gRings).textContent = "|w| = " + (e > 1 ? "10" + SUP[e] : 10 ** e);
      }
      wGhost.setAttribute("d", Wp.path(Ws));
      let hd = ""; for (const f of [0.14, 0.64]) { const i = Math.round(f * N), a = Ws[i], b = Ws[i + 6]; if (abs(sub(b, a)) * Wp.k > 0.8) hd += head(Wp.X(b[0]), Wp.Y(b[1]), Math.atan2(Wp.Y(b[1]) - Wp.Y(a[1]), Wp.X(b[0]) - Wp.X(a[0])), 8); }
      wHeads.setAttribute("d", hd);
      set(wO, { cx: Wp.X(0), cy: Wp.Y(0) });
    }

    function makeDial(name, total) {
      const el = document.createElement("div"); el.className = "dial" + (total ? " total in" : "");
      el.innerHTML = `<svg viewBox="0 0 72 72"><circle class="rim" cx="36" cy="36" r="30"/><path class="arc"/><line class="hand" x1="36" y1="36"/><circle class="hub" cx="36" cy="36" r="2.6"/></svg><span class="d-name">${name}</span><span class="d-val"></span>`;
      return el;
    }
    function setDial(el, a0, phi, label) { // a0 起始方向，phi 累计转角；转得越多，螺线往外走
      const n = Math.max(1, Math.ceil(Math.abs(phi) / 0.1)), lim = Math.min(Math.abs(phi) / TAU, 4); let d = "";
      for (let i = 0; i <= n; i++) { const a = a0 + phi * i / n, rr = 11 + 4.4 * lim * i / n; d += (i ? "L" : "M") + (36 + rr * Math.cos(a)).toFixed(1) + " " + (36 - rr * Math.sin(a)).toFixed(1); }
      $(".arc", el).setAttribute("d", d);
      set($(".hand", el), { x2: (36 + 30 * Math.cos(a0 + phi)).toFixed(1), y2: (36 - 30 * Math.sin(a0 + phi)).toFixed(1) });
      $(".d-val", el).textContent = label;
    }

    function rebuild() { // 点的个数、种类或重数变了：重建把手和罗盘
      gPts.replaceChildren(); gSpokes.replaceChildren(); dials.replaceChildren(); let nz = 0, np = 0;
      st.pts.forEach((p, k) => {
        p.plain = p.kind === "z" ? "a" + ++nz : "b" + ++np; p.name = `<i>${p.plain[0]}</i><sub>${p.plain.slice(1)}</sub>`;
        S("line", { class: "spoke" }, gSpokes);
        const g = S("g", { class: "pt " + (p.kind === "z" ? "zero" : "pole"), tabindex: 0, role: "button" }, gPts);
        S("circle", { class: "halo", r: 13 }, g);
        if (p.kind === "z") S("circle", { class: "glyph", r: 6.5 }, g); else S("path", { class: "glyph", d: "M-6-6L6 6M-6 6L6-6" }, g);
        rich(S("text", { class: "lab", x: 11, y: -9 }, g), p.name + (p.m > 1 ? " ×" + p.m : ""));
        S("circle", { class: "hit", r: 17 }, g);
        g.addEventListener("pointerdown", (ev) => grab(ev, g, p.z, k));
        g.addEventListener("keydown", (ev) => nudge(ev, p.z, k));
        g.addEventListener("focus", () => { if (st.sel !== k) { st.sel = k; draw(); } });
        dials.appendChild(makeDial(p.name));
      });
      dials.appendChild(makeDial("arg <i>f</i> 合计", true));
    }

    function draw() {
      const { pts, c, r, t } = st, i = Math.round(t * N), z = Zs[i], w = Ws[i];
      set(zC, { cx: Zp.X(c[0]), cy: Zp.Y(c[1]), r: r * Zp.k });
      zHead.setAttribute("d", head(Zp.X(c[0] + r * 0.5), Zp.Y(c[1] + r * r3), -PI + PI / 6, 10));
      zCtr.setAttribute("transform", `translate(${Zp.X(c[0]).toFixed(1)} ${Zp.Y(c[1]).toFixed(1)})`);
      set(zDot, { cx: Zp.X(z[0]), cy: Zp.Y(z[1]) });
      pts.forEach((p, k) => {
        const g = gPts.children[k], s = p.kind === "z" ? 1 : -1, el = dials.children[k];
        g.setAttribute("transform", `translate(${Zp.X(p.z[0]).toFixed(1)} ${Zp.Y(p.z[1]).toFixed(1)})`);
        g.classList.toggle("sel", k === st.sel);
        g.setAttribute("aria-label", `${p.kind === "z" ? "零点" : "极点"} ${p.plain}，位于 ${fmtC(p.z)}，${inside[k] ? "圈内" : "圈外"}。可拖动；方向键移动，Delete 删除`);
        set(gSpokes.children[k], { x1: Zp.X(p.z[0]), y1: Zp.Y(p.z[1]), x2: Zp.X(z[0]), y2: Zp.Y(z[1]) });
        // 罗盘画的是这个因子对 arg f 的贡献：零点正转，极点反转
        setDial(el, s * arg(sub(Zs[0], p.z)), s * cum[k][i], signed(s * p.m * cum[k][i] / TAU) + " 圈");
        el.classList.toggle("in", inside[k]); $(".d-name", el).innerHTML = `${p.name} · ${inside[k] ? "圈内" : "圈外"}`;
      });
      setDial(dials.lastChild, arg(Ws[0]), tot[i], signed(tot[i] / TAU) + " 圈");
      wTrace.setAttribute("d", Wp.path(Ws, 0, i));
      set(wDot, { cx: Wp.X(w[0]), cy: Wp.Y(w[1]) }); set(wRay, { x1: Wp.X(0), y1: Wp.Y(0), x2: Wp.X(w[0]), y2: Wp.Y(w[1]) });
      $("#arg-t-o").textContent = Math.round(t * 100) + "%"; $("#arg-r-o").textContent = fmt(r);
      $("#arg-mult").disabled = $("#arg-del").disabled = st.sel < 0;
      const diff = Nin - Pin;
      panel.innerHTML = `<div class="p-mz"><b>${minus(nTurns)}</b><span>圈 · 像曲线 f(C) 绕原点的净圈数，逆时针为正</span></div>
        <div class="p-ion"><i>N</i> − <i>P</i> = ${Nin} − ${Pin} = <b>${minus(diff)}</b></div>
        <p>圈内零点 <i class="v">N</i> = ${Nin}，圈内极点 <i class="v">P</i> = ${Pin}，都按重数计。${!onC && nTurns === diff ? "圈数与 <i class=\"v\">N</i> − <i class=\"v\">P</i> 相等：这就是幅角原理。" : ""}</p>
        ${onC ? "<p class=\"warn\">有零点或极点压在 C 上，或者贴得太近。定理的前提不成立：像曲线穿过原点或冲向无穷远，圈数没有意义。把它拖开一点。</p>" : ""}
        <p>此刻 <i class="v">z</i> 走了 <span class="num">${Math.round(t * 100)}%</span>，arg <i class="v">f</i> 累计 <span class="num">${signed(tot[i] / TAU)}</span> 圈。</p>
        <ul class="pt-list">${pts.map((p, k) => `<li class="${inside[k] ? "in" : ""}"><b>${p.name}</b>${p.kind === "z" ? "零点" : "极点"} ${fmtC(p.z)}${p.m > 1 ? `，${p.m} 重` : ""} · ${inside[k] ? "圈内" : "圈外"}，走完一圈贡献 ${signed((p.kind === "z" ? 1 : -1) * p.m * Math.round(cum[k][N] / TAU), 0)} 圈</li>`).join("") || "<li>没有零点也没有极点：f ≡ 1，像曲线缩成一个点。</li>"}</ul>`;
    }
    const announce = () => { live.textContent = onC ? "有零点或极点压在围道上，圈数没有意义。" : `圈内零点 ${Nin} 个，极点 ${Pin} 个，像曲线绕原点 ${nTurns} 圈。`; };
    const edited = (structural) => { press(presets, () => false); if (structural) rebuild(); compute(); draw(); announce(); };

    function grab(ev, el, z, k) { // 拖动：z 是要改的那个复数（零点、极点或圆心）
      ev.preventDefault(); el.focus(); if (k !== undefined) st.sel = k; el.setPointerCapture(ev.pointerId);
      const move = (e) => { const q = Zp.at(e); z[0] = clamp(q[0], -LIM, LIM); z[1] = clamp(q[1], -LIM, LIM); press(presets, () => false); compute(); draw(); };
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); announce(); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); draw();
    }
    function nudge(ev, z, k) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
      if (d) { ev.preventDefault(); const s = ev.shiftKey ? 0.25 : 0.05; z[0] = clamp(z[0] + d[0] * s, -LIM, LIM); z[1] = clamp(z[1] + d[1] * s, -LIM, LIM); edited(false); }
      else if ((ev.key === "Delete" || ev.key === "Backspace") && k !== undefined) { ev.preventDefault(); st.pts.splice(k, 1); st.sel = -1; edited(true); }
    }
    function load(key) {
      const P = PRESETS[key]; play.stop();
      st.c = P.c.slice(); st.r = P.r; st.pts = P.pts.map(([kind, x, y, m]) => ({ kind, z: [x, y], m })); st.sel = -1; st.t = 1;
      rSl.value = st.r; tSl.value = 1000; rebuild(); compute(); draw(); announce(); press(presets, (b) => b.dataset.p === key);
    }
    function addPt(kind) {
      if (st.pts.length >= 8) return;
      const z = SPOTS.find((s) => st.pts.every((p) => abs(sub(p.z, s)) > 0.45)) || [0, 0];
      st.pts.push({ kind, z: z.slice(), m: 1 }); st.sel = st.pts.length - 1; edited(true);
    }
    const play = player($("#arg-play"), 9000, () => st.t, (v) => { st.t = v; tSl.value = Math.round(v * 1000); draw(); }, "沿 C 走一圈");
    presets.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) load(b.dataset.p); });
    zCtr.addEventListener("pointerdown", (ev) => grab(ev, zCtr, st.c)); zCtr.addEventListener("keydown", (ev) => nudge(ev, st.c));
    tSl.addEventListener("input", () => { play.stop(); st.t = tSl.value / 1000; draw(); });
    rSl.addEventListener("input", () => { st.r = +rSl.value; edited(false); });
    $("#arg-add-z").addEventListener("click", () => addPt("z")); $("#arg-add-p").addEventListener("click", () => addPt("p"));
    $("#arg-mult").addEventListener("click", () => { const p = st.pts[st.sel]; if (p) { p.m = p.m % 3 + 1; const k = st.sel; edited(true); st.sel = k; draw(); } });
    $("#arg-del").addEventListener("click", () => { if (st.sel >= 0) { st.pts.splice(st.sel, 1); st.sel = -1; edited(true); } });
    $$("[data-arg-preset]").forEach((b) => b.addEventListener("click", () => { load(b.dataset.argPreset); $("#lab-arg").scrollIntoView({ block: "center", behavior: reduced.matches ? "auto" : "smooth" }); }));
    load("cube");
  })();

  /* ───────── 绳：儒歇定理。多项式 p = f + g，围道 |z| = R ───────── */
  (function labRouche() {
    if (!$("#lab-rou")) return;
    const M = 720, VZ = 2.75;
    const Zp = new Plane($("#rou-z"), 420, 420).view(-VZ, VZ, -VZ, VZ);
    const Hp = new Plane($("#rou-h"), 420, 420);
    const POLYS = [ // coef[k] 是 z^k 的系数；f 是默认主项的幂次
      { coef: [1, 3, 0, 0, 0, 1], f: [1], R: 1 },
      { coef: [3, -6, 0, 0, 1], f: [1], R: 1 },
      { coef: [12, 0, 0, -5, 0, 0, 0, 1], f: [0], R: 1 },
      { coef: [1, 1, -6, 0, 0, 2], f: [2], R: 1 },
    ];
    const polyHTML = (coef) => { let s = ""; for (let k = coef.length - 1; k >= 0; k--) { const c = coef[k]; if (!c) continue; const a = Math.abs(c); s += (s ? (c < 0 ? " − " : " + ") : (c < 0 ? "−" : "")) + (a === 1 && k ? "" : a) + (k ? "<i>z</i>" + (k > 1 ? `<sup>${k}</sup>` : "") : ""); } return s || "0"; };
    const st = { pi: 0, inF: new Set(), R: 1, t: 1, s: 0.125 };
    let fc, gc, aF, aG, Q, minF, maxG, bad, rootsF, rootsT, nF, nT, nP, wind, onC;

    const zC = S("circle", { class: "contour", cx: Zp.X(0), cy: Zp.Y(0) }, Zp.svg), zHead = S("path", { class: "ah" }, Zp.svg);
    const gF = S("g", {}, Zp.svg), gT = S("g", {}, Zp.svg), zDot = S("circle", { class: "now", r: 6 }, Zp.svg);
    const disc = S("circle", { class: "disc" }, Hp.svg), curve = S("path", { class: "trace red" }, Hp.svg), leash = S("line", { class: "leash" }, Hp.svg);
    const tree = S("circle", { class: "origin", r: 5.5 }, Hp.svg), treeL = S("text", { class: "tag" }, Hp.svg); treeL.textContent = "树 0";
    const man = S("circle", { class: "zero", r: 5.5 }, Hp.svg), manL = S("text", { class: "tag" }, Hp.svg); manL.textContent = "人 1";
    const dog = S("circle", { class: "now", r: 6 }, Hp.svg);
    const polys = $("#rou-polys"), terms = $("#rou-terms"), panel = $("#rou-panel"), RSl = $("#rou-R"), tSl = $("#rou-t"), sSl = $("#rou-s");
    const chart = lineChart($("#rou-chart"), (x) => { play.stop(); st.s = clamp(x / TAU, 0, 1); sSl.value = Math.round(st.s * M); pos(); });
    POLYS.forEach((P, i) => { const b = document.createElement("button"); b.type = "button"; b.dataset.i = i; b.innerHTML = polyHTML(P.coef); polys.appendChild(b); });

    function compute() {
      const { coef } = POLYS[st.pi], { R, t } = st;
      fc = coef.map((c, k) => (st.inF.has(k) ? c : 0)); gc = coef.map((c, k) => (st.inF.has(k) ? 0 : c));
      aF = new Float64Array(M + 1); aG = new Float64Array(M + 1); Q = []; minF = Infinity; maxG = 0; bad = 0;
      for (let i = 0; i <= M; i++) {
        const z = polar(R, TAU * i / M), F = polyEval(fc, z), G = polyEval(gc, z);
        aF[i] = abs(F); aG[i] = abs(G); Q.push(aF[i] > 1e-12 ? div(G, F) : [1e9, 0]);
        if (i < M) { minF = Math.min(minF, aF[i]); maxG = Math.max(maxG, aG[i]); if (aG[i] >= aF[i]) bad++; }
      }
      rootsF = polyRoots(fc); rootsT = polyRoots(coef.map((c, k) => fc[k] + t * gc[k])); const rootsP = polyRoots(coef);
      const cnt = (rs) => rs.filter((z) => abs(z) < R).length; nF = cnt(rootsF); nT = cnt(rootsT); nP = cnt(rootsP);
      onC = rootsF.concat(rootsP).some((z) => Math.abs(abs(z) - R) < 0.012);
      wind = Math.round(turns(Q.slice(0, M).map((q) => [1 + q[0], q[1]])));   // 1 + g/f 绕原点的圈数
    }

    function draw() {
      const { coef } = POLYS[st.pi], { R, t } = st, inV = (z) => Math.abs(z[0]) < VZ && Math.abs(z[1]) < VZ;
      zC.setAttribute("r", R * Zp.k); zHead.setAttribute("d", head(Zp.X(R * 0.5), Zp.Y(R * Math.sqrt(3) / 2), -PI + PI / 6, 10));
      gF.replaceChildren(); gT.replaceChildren();
      const groups = []; for (const z of rootsF) { const g = groups.find((h) => abs(sub(h.z, z)) < 1e-6); g ? g.m++ : groups.push({ z, m: 1 }); }
      for (const g of groups) { if (!inV(g.z)) continue; S("circle", { class: "rootf", cx: Zp.X(g.z[0]), cy: Zp.Y(g.z[1]), r: 9 }, gF); if (g.m > 1) S("text", { class: "lab", x: Zp.X(g.z[0]) + 12, y: Zp.Y(g.z[1]) - 10 }, gF).textContent = "×" + g.m; }
      for (const z of rootsT) if (inV(z)) S("circle", { class: "roott", cx: Zp.X(z[0]), cy: Zp.Y(z[1]), r: 5 }, gT);
      let md = 0; for (let i = 0; i < M; i++) md = Math.max(md, t * abs(Q[i]));
      const V = clamp(md * 1.12 + 0.3, 1.75, 60); Hp.view(0.5 - V, 0.5 + V, -V, V);
      set(disc, { cx: Hp.X(1), cy: Hp.Y(0), r: Hp.k }); curve.setAttribute("d", Hp.path(Q.map((q) => [1 + t * q[0], t * q[1]])));
      set(tree, { cx: Hp.X(0), cy: Hp.Y(0) }); set(treeL, { x: Hp.X(0) - 8, y: Hp.Y(0) + 20, "text-anchor": "end" });
      set(man, { cx: Hp.X(1), cy: Hp.Y(0) }); set(manL, { x: Hp.X(1) + 9, y: Hp.Y(0) - 10 });
      const pF = [], pG = [], bands = []; let open = null;
      for (let i = 0; i <= M; i++) { const x = TAU * i / M; pF.push([x, aF[i]]); pG.push([x, aG[i]]); if (aG[i] >= aF[i]) { open ??= x; } else if (open != null) { bands.push([open, x]); open = null; } }
      if (open != null) bands.push([open, TAU]);
      const top = Math.max(...aF, ...aG) * 1.08, ys = niceStep(top / 4);
      chart.update({ xDom: [0, TAU], xTicks: [[0, "0"], [PI / 2, "π/2"], [PI, "π"], [1.5 * PI, "3π/2"], [TAU, "2π"]], xName: "θ", yMax: Math.ceil(top / ys) * ys, bands,
        series: [{ cls: "s1", label: "|f|", pts: pF }, { cls: "s2", label: "|g|", pts: pG }],
        legend: [["s1", "|f(z)|：人到树的距离"], ["s2", "|g(z)|：绳长"]].concat(bands.length ? [["band", "|g| ≥ |f|：绳子不够短"]] : []),
        tip: (x) => { const i = Math.round(x / TAU * M); return `θ = ${fmt(x / PI)}π　|f| = ${fmt(aF[i])}　|g| = ${fmt(aG[i])}`; } });
      $("#rou-R-o").textContent = fmt(R); $("#rou-t-o").textContent = fmt(t);
      press(polys, (b) => +b.dataset.i === st.pi); press(terms, (b) => st.inF.has(+b.dataset.k));
      const ok = bad === 0, pct = Math.max(1, Math.round(100 * bad / M)), tg = t === 1 ? "" : fmt(t), d = nP - nF;
      panel.innerHTML = `<div class="p-mz"><b>${nT}</b><span>个零点在圈内 · <i class="v">f</i> + ${tg}<i class="v">g</i>${t === 1 ? "" : "（形变途中）"}</span></div>
        <div class="p-ion">主项 <i>f</i> = ${polyHTML(fc)}<br>余项 <i>g</i> = ${polyHTML(gc)}</div>
        <p>在圈 |<i class="v">z</i>| = ${fmt(R)} 上：|<i class="v">f</i>| 最小 <span class="num">${fmt(minF)}</span>，|<i class="v">g</i>| 最大 <span class="num">${fmt(maxG)}</span>。</p>
        ${ok ? `<p class="ok">处处 |<i class="v">g</i>| &lt; |<i class="v">f</i>|，条件成立。儒歇定理保证 <i class="v">f</i> 与 <i class="v">f</i> + <i class="v">g</i> 在圈内零点一样多：都是 <strong>${nF}</strong> 个。</p>`
          : `<p class="no">圈上约有 ${pct}% 的地方 |<i class="v">g</i>| ≥ |<i class="v">f</i>|，条件不成立。定理在这里不下结论：换一个主项，或者换个半径。</p>`}
        ${onC ? "<p class=\"warn\">有零点正好在圈上（或贴得很近），圈内个数在这里会跳变。</p>" : ""}
        <p>实际数一数：<i class="v">f</i> 在圈内 ${nF} 个零点（墨圈），<i class="v">f</i> + <i class="v">g</i> 在圈内 ${nP} 个，相差 ${minus(d)}。右图的曲线 ${$("#tx-ratio").innerHTML} 绕原点 ${minus(wind)} 圈${!onC && d === wind ? "，两个数总是相等" : ""}。</p>
        <p id="rou-now"></p>`;
      pos();
    }
    function pos() { // 只动“此刻的位置”
      const { R, t, s } = st, i = Math.round(s * M) % M, z = polar(R, TAU * i / M), q = Q[i], dg = [1 + t * q[0], t * q[1]];
      set(zDot, { cx: Zp.X(z[0]), cy: Zp.Y(z[1]) }); set(dog, { cx: Hp.X(dg[0]), cy: Hp.Y(dg[1]) });
      set(leash, { x1: Hp.X(1), y1: Hp.Y(0), x2: Hp.X(dg[0]), y2: Hp.Y(dg[1]) });
      chart.mark(s * TAU); $("#rou-s-o").textContent = fmt(2 * s) + "π";
      const now = $("#rou-now"); if (now) now.innerHTML = `此刻 θ = ${fmt(2 * s)}π：人到树 <span class="num">${fmt(aF[i])}</span>，绳长 <span class="num">${fmt(aG[i])}</span>，${aG[i] < aF[i] ? "狗够不到树" : "狗能绕到树的另一边"}。`;
    }
    function setPoly(i, f, R) {
      const P = POLYS[i]; st.pi = i; st.inF = new Set(f || P.f); st.R = R || P.R; st.t = 1; RSl.value = st.R; tSl.value = 1;
      terms.replaceChildren();
      for (let k = P.coef.length - 1; k >= 0; k--) { if (!P.coef[k]) continue; const b = document.createElement("button"); b.type = "button"; b.dataset.k = k; const one = P.coef.map((c, j) => (j === k ? c : 0)); b.innerHTML = polyHTML(one); terms.appendChild(b); }
      compute(); draw();
    }
    const play = player($("#rou-play"), 8000, () => st.s, (v) => { st.s = v; sSl.value = Math.round(v * M); pos(); }, "沿圈走一趟");
    polys.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) setPoly(+b.dataset.i); });
    terms.addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return; const k = +b.dataset.k;
      if (st.inF.has(k)) { if (st.inF.size > 1) st.inF.delete(k); } else st.inF.add(k);
      compute(); draw();
    });
    RSl.addEventListener("input", () => { st.R = +RSl.value; compute(); draw(); });
    tSl.addEventListener("input", () => { st.t = +tSl.value; compute(); draw(); });
    sSl.addEventListener("input", () => { play.stop(); st.s = sSl.value / M; pos(); });
    $$("[data-rou]").forEach((b) => b.addEventListener("click", () => { const [i, f, R] = b.dataset.rou.split(","); setPoly(+i, [+f], +R); $("#lab-rou").scrollIntoView({ block: "center", behavior: reduced.matches ? "auto" : "smooth" }); }));
    setPoly(0);
  })();

  /* ───────── 围：围道台。逐段数值积分，对照 2πi × 圈内留数之和 ───────── */
  (function labContour() {
    if (!$("#lab-ct")) return;
    const one = [1, 0], q = Math.SQRT1_2;
    const P = new Plane($("#ct-z"), 640, 480), In = new Plane($("#ct-inset"), 200, 150, { ticks: false, re: "", im: "" }).view(-1.3, 1.3, -0.55, 1.4);
    const cv = $("#ct-wash"), ctx = cv.getContext("2d");
    const gC = S("g", {}, P.svg), gP = S("g", {}, P.svg), gI = S("g", {}, In.svg);
    const half = (p) => [{ key: "seg", name: "实轴段 [−R, R]", type: "line", a: [-p.R, 0], b: [p.R, 0] }, { key: "arc", name: "上半圆弧 C<sub>R</sub>", type: "arc", c: [0, 0], r: p.R, t0: 0, t1: PI }];
    const pole = (z, res, name, p, note) => ({ z, res, name, note, in: z[1] > 0 && abs(z) < p.R, on: z[1] > 0 && Math.abs(abs(z) - p.R) < 1e-9 });
    const HALF = { pieces: half, view: (p) => { const W = Math.max(2.6, 1.2 * p.R); return [-W, W, -0.42 * W, 1.08 * W]; }, value: (v) => v.seg[0] };
    const EX = {
      trig: { type: "trig", sl: { a: [1.05, 2.5, 0.01, 2] },
        F: (z, p) => div([0, -2], add(add(mul(z, z), scale(z, 2 * p.a)), one)),          // 2 / ( i (z² + 2az + 1) )
        pieces: () => [{ key: "seg", name: "单位圆 |z| = 1", type: "arc", c: [0, 0], r: 1, t0: 0, t1: TAU }],
        poles: (p) => { const s = Math.sqrt(p.a * p.a - 1); return [{ z: [-p.a + s, 0], res: [0, -1 / s], name: "<i>z</i><sub>+</sub>", in: true }, { z: [-p.a - s, 0], res: [0, 1 / s], name: "<i>z</i><sub>−</sub>", in: false }]; },
        view: () => [-5.2, 1.8, -2.625, 2.625], value: (v) => v.total[0], exact: (p) => TAU / Math.sqrt(p.a * p.a - 1) },
      rat1: { ...HALF, type: "rat", sl: { R: [0.4, 12, 0.05, 3] }, F: (z) => div(one, add(one, mul(z, z))),
        poles: (p) => [pole([0, 1], [0, -0.5], "<i>i</i>", p), pole([0, -1], [0, 0.5], "−<i>i</i>", p)], exact: () => PI },
      rat4: { ...HALF, type: "rat", sl: { R: [0.4, 12, 0.05, 3] }, F: (z) => div(one, add(one, powi(z, 4))),
        poles: (p) => [[q, q], [-q, q], [-q, -q], [q, -q]].map((z, j) => pole(z, scale(z, -0.25), `<i>e</i><sup>${j ? 2 * j + 1 : ""}<i>iπ</i>/4</sup>`, p)), exact: () => PI * q },
      rat2: { ...HALF, type: "rat", sl: { R: [0.4, 12, 0.05, 3] }, F: (z) => { const d = add(one, mul(z, z)); return div(one, mul(d, d)); },
        poles: (p) => [pole([0, 1], [0, -0.25], "<i>i</i>", p, "二阶"), pole([0, -1], [0, 0.25], "−<i>i</i>", p, "二阶")], exact: () => PI / 2 },
      four: { ...HALF, type: "four", sl: { R: [0.4, 12, 0.05, 3], a: [0.2, 3, 0.05, 1] }, F: (z, p) => div(exp(mul([0, p.a], z)), add(one, mul(z, z))),
        poles: (p) => [pole([0, 1], [0, -Math.exp(-p.a) / 2], "<i>i</i>", p), pole([0, -1], [0, Math.exp(p.a) / 2], "−<i>i</i>", p)], exact: (p) => PI * Math.exp(-p.a) },
      sinc: { type: "sinc", sl: { R: [2, 30, 0.1, 8], eps: [0.05, 1, 0.01, 0.4] }, F: (z) => div(exp([-z[1], z[0]]), z),
        pieces: (p) => [{ key: "segL", name: "实轴段 [−R, −ε]", type: "line", a: [-p.R, 0], b: [-p.eps, 0] }, { key: "small", name: "小半圆 γ<sub>ε</sub>（顺时针）", type: "arc", c: [0, 0], r: p.eps, t0: PI, t1: 0 },
          { key: "segR", name: "实轴段 [ε, R]", type: "line", a: [p.eps, 0], b: [p.R, 0] }, { key: "arc", name: "大半圆弧 C<sub>R</sub>", type: "arc", c: [0, 0], r: p.R, t0: 0, t1: PI }],
        poles: () => [{ z: [0, 0], res: [1, 0], name: "0", note: "被绕开", in: false }],
        view: HALF.view, value: (v) => (v.segL[1] + v.segR[1]) / 2, exact: () => PI / 2 },
    };
    const SL = { R: "半径 <i class=\"v\">R</i>", a: "参数 <i class=\"v\">a</i>", eps: "小半径 <i class=\"v\">ε</i>" };
    const vals = {}; for (const k in EX) { vals[k] = {}; for (const s in EX[k].sl) vals[k][s] = EX[k].sl[s][3]; }
    const st = { key: "trig", rat: "rat1" };
    const chart = lineChart($("#ct-chart"), (x) => { const ex = EX[st.key]; if (!ex.sl.R) return; const [lo, hi, step] = ex.sl.R; vals[st.key].R = clamp(Math.round(x / step) * step, lo, hi); $("#ct-sl-R").value = vals[st.key].R; draw(); });
    const types = $("#ct-types"), vars = $("#ct-vars"), sliders = $("#ct-sliders"), body = $("#ct-body");
    let timer = 0;

    const nOf = (pc) => clamp(Math.ceil((pc.type === "line" ? abs(sub(pc.b, pc.a)) : Math.abs(pc.t1 - pc.t0) * pc.r) * 60), 600, 2400);
    function evalAll(ex, p) { // 每一段各自积分，再求和
      const F = (z) => ex.F(z, p), v = { total: [0, 0] };
      for (const pc of ex.pieces(p)) { v[pc.key] = integrate(F, pc, nOf(pc)); v.total = add(v.total, v[pc.key]); }
      return v;
    }
    const inkRGB = () => { const h = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim().slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
    function wash(ex, p) { // 墨色 = log|f|，分六层
      const w = cv.width, h = cv.height, img = ctx.createImageData(w, h), [r, g, b] = inkRGB();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const m = abs(ex.F([P.x0 + (i + 0.5) / w * (P.x1 - P.x0), P.y1 - (j + 0.5) / h * (P.y1 - P.y0)], p));
        const v = m > 0 ? (isFinite(m) ? clamp((Math.log10(m) + 1.4) / 2.8, 0, 1) * 6 : 6) : 0, fr = clamp((v - Math.floor(v) - 0.3) / 0.4, 0, 1);
        const u = (Math.floor(v) + fr * fr * (3 - 2 * fr)) / 6, o = (j * w + i) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 150 * u;
      }
      ctx.putImageData(img, 0, 0);
    }
    const TX = (id) => $("#tx-" + id).innerHTML; // 构建时渲染好的公式片段
    function drawPath(plane, g, pcs, heads) {
      for (const pc of pcs) {
        const n = pc.type === "line" ? 1 : 96, pts = []; for (let i = 0; i <= n; i++) pts.push(pathPoint(pc, i / n));
        const d = plane.path(pts); S("path", { class: "halo-line", d }, g); S("path", { class: "contour", d }, g);
        if (!heads) continue;
        const a = pathPoint(pc, 0.5), b = pathPoint(pc, 0.52), len = Math.hypot(plane.X(pathPoint(pc, 1)[0]) - plane.X(pts[0][0]), plane.Y(pathPoint(pc, 1)[1]) - plane.Y(pts[0][1]));
        if (len > 26 || pc.t1 - pc.t0 === TAU) S("path", { class: "ah", d: head(plane.X(b[0]), plane.Y(b[1]), Math.atan2(plane.Y(b[1]) - plane.Y(a[1]), plane.X(b[0]) - plane.X(a[0])), 11) }, g);
      }
    }
    function chartData(ex, p) {
      if (ex.type === "trig") {
        const pts = []; for (let i = 0; i <= 240; i++) { const th = TAU * i / 240; pts.push([th, 1 / (p.a + Math.cos(th))]); }
        const top = 1 / (p.a - 1) * 1.08, ys = niceStep(top / 4);
        return { xDom: [0, TAU], xTicks: [[0, "0"], [PI / 2, "π/2"], [PI, "π"], [1.5 * PI, "3π/2"], [TAU, "2π"]], xName: "θ", yMax: Math.ceil(top / ys) * ys, series: [{ cls: "s1", pts, area: true }],
          tip: (x) => `θ = ${fmt(x / PI)}π　被积函数 = ${fmt(1 / (p.a + Math.cos(x)), 3)}`,
          cap: `被积函数 ${TX("integrand")} 在一个周期上的图像，阴影面积就是所求的 <i>I</i>(<i>a</i>)。<i>a</i> 越接近 1，<i>θ</i> = <i>π</i> 处的尖峰越高。` };
      }
      // 实轴段随 R 累加（每次只补两头新增的一小截），弧每个 R 重新积一次
      const [lo, hi] = ex.sl.R, n = 96, F = (z) => ex.F(z, p), A = [], B = [], sinc = ex.type === "sinc"; let acc = [0, 0], prev = sinc ? p.eps : 0;
      for (let j = 0; j <= n; j++) {
        const R = lo + (hi - lo) * j / n, m = Math.max(8, Math.ceil((R - prev) * 80));
        acc = add(acc, add(integrate(F, { type: "line", a: [prev, 0], b: [R, 0] }, m), integrate(F, { type: "line", a: [-R, 0], b: [-prev, 0] }, m))); prev = R;
        if (ex.poles({ ...p, R }).some((s) => s.z[1] > 0 && Math.abs(abs(s.z) - R) < 0.03)) { A.push([R, sinc ? acc[1] / 2 : acc[0]]); B.push(null); continue; }
        A.push([R, sinc ? acc[1] / 2 : acc[0]]); B.push([R, abs(integrate(F, { type: "arc", c: [0, 0], r: R, t0: 0, t1: PI }, clamp(Math.ceil(R * 120), 300, 1200)))]);
      }
      const e = ex.exact(p), top = e * (sinc ? 1.5 : 1.45), ys = niceStep(top / 4), ticks = []; for (let v = Math.ceil(lo / (sinc ? 5 : 2)) * (sinc ? 5 : 2); v <= hi; v += sinc ? 5 : 2) ticks.push([v, String(v)]);
      const at = (arr, x) => arr[clamp(Math.round((x - lo) / (hi - lo) * n), 0, n)];
      return { xDom: [lo, hi], xTicks: ticks, xName: "R", yMax: Math.ceil(top / ys) * ys, hline: e, hlineLabel: (sinc ? "两个极限都取完：" : "极限 ") + fmt(e, 4),
        series: [{ cls: "s1", label: "实轴", pts: A }, { cls: "s2", label: "|弧|", pts: B }],
        legend: [["s1", sinc ? TX("sinc") : `实轴段上的积分 ${TX("seg")}`], ["s2", "大弧上积分的模"], ["hl", sinc ? "<i>R</i> → ∞ 且 <i>ε</i> → 0 的极限" : "<i>R</i> → ∞ 的极限"]],
        tip: (x) => { const a = at(A, x), b = at(B, x); return `R = ${fmt(a[0], 1)}　实轴 ${fmt(a[1], 4)}　|弧| ${b ? fmt(b[1], 4) : "—"}`; },
        cap: sinc ? "墨线摆动着趋于平稳，这是条件收敛的样子；大弧的贡献按若尔当引理趋于 0。墨线停在虚线下方，是因为 0 到 <i>ε</i> 那一小段被挖掉了：把 <i>ε</i> 调小，整条墨线就往虚线上靠。点图可以改 <i>R</i>。" : "实轴段的积分随 <i>R</i> 增大趋于极限，大弧的贡献趋于 0。弧扫过极点（<i>R</i> = 1）时，闭路把极点收进来，弧上的值随之一跳。点图可以改 <i>R</i>。" };
    }
    function draw() {
      const ex = EX[st.key], p = vals[st.key], pcs = ex.pieces(p), poles = ex.poles(p), v = evalAll(ex, p), onPole = poles.some((s) => s.on);
      P.view(...ex.view(p)); wash(ex, p); gC.replaceChildren(); gP.replaceChildren();
      drawPath(P, gC, pcs, true);
      for (const s of poles) {
        const x = P.X(s.z[0]), y = P.Y(s.z[1]); if (y > P.H - 8 || x < 8) continue;
        if (s.in) S("circle", { class: "pin", cx: x, cy: y, r: 12 }, gP);
        S("path", { class: "polex", d: `M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x - 6} ${y + 6}L${x + 6} ${y - 6}` }, gP);
        rich(S("text", { class: "tag", x: x + 13, y: y - 10 }, gP), s.name);
      }
      const inset = st.key === "sinc"; In.svg.toggleAttribute("hidden", !inset);
      if (inset) { gI.replaceChildren(); drawPath(In, gI, [{ type: "line", a: [-1.3, 0], b: [-p.eps, 0] }, pcs[1], { type: "line", a: [p.eps, 0], b: [1.3, 0] }], true); const x = In.X(0), y = In.Y(0); S("path", { class: "polex", d: `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}` }, gI); S("text", { class: "lab", x: 8, y: 18 }, gI).textContent = "原点附近放大"; }
      for (const s in ex.sl) $("#ct-sl-" + s + "-o").textContent = fmt(p[s], s === "R" && ex.sl.R[2] >= 0.1 ? 1 : 2);
      chart.mark(ex.sl.R ? p.R : null);
      const rs = poles.filter((s) => s.in).reduce((a, s) => add(a, s.res), [0, 0]), rhs = mul([0, TAU], rs), val = ex.value(v), e = ex.exact(p), anyIn = poles.some((s) => s.in);
      const num = (z) => (onPole ? "—" : fmtC(z, 4));
      let text;
      if (ex.type === "trig") text = `<p><i>I</i>(<i>a</i>) = <strong id="ct-val">${fmt(val, 4)}</strong>，上式右端的值是 ${fmt(e, 4)}。这一型没有极限过程：对每个 <i>a</i> &gt; 1，闭路积分直接就是所求。</p><p>两个极点的乘积恒为 1，所以总是一个在圆内、一个在圆外。把 <i>a</i> 拖向 1：两个极点在 −1 处靠拢，积分趋于无穷。</p>`;
      else if (onPole) text = "<p class=\"warn\">极点正好落在弧上：被积函数在路上发散，积分没有定义。围道不能穿过奇点，把 R 调开一点。</p>";
      else if (ex.type === "sinc") text = `<p>圈里没有奇点，闭路合计为 0。小半圆上是 ${fmtC(v.small, 4)}；<i>ε</i> → 0 时它趋于 −<i>πi</i>：单极点绕半圈，拿走半个留数。</p><p>两段实轴合起来是 2<i>i</i> 乘以 ${TX("sinc")}。眼下这个积分是 <strong id="ct-val">${fmt(val, 4)}</strong>；<i>R</i> → ∞、<i>ε</i> → 0 都取完之后是 ${fmt(e, 4)}。</p>`;
      else if (!anyIn) text = "<p><i>R</i> 还不够大，极点在圈外。圈里没有奇点，闭路合计为 0，实轴段与弧互相抵消。把 <i>R</i> 调过 1 试试。</p>";
      else text = `<p>实轴段上 ${TX("seg")} 眼下是 <strong id="ct-val">${fmt(val, 4)}</strong>；<i>R</i> → ∞ 的极限是 ${fmt(e, 4)}，两者相差 ${fmt(Math.abs(e - val), 4)}。差的正是弧上那一份，<i>R</i> 越大它越小。</p>` + (ex.type === "four" ? `<p>${TX("decay")}：往上衰减，往下增长。图的下半边一片浓墨，所以只能从上面围。</p>` : "");
      body.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>围道的一段</th><th class="r">沿它的积分（数值）</th></tr></thead><tbody>
        ${pcs.map((pc) => `<tr><td>${pc.name}</td><td class="r">${num(v[pc.key])}</td></tr>`).join("")}
        <tr class="sum"><td>整条闭路合计</td><td class="r">${num(v.total)}</td></tr><tr class="sum"><td>2<i>πi</i> × 圈内留数之和</td><td class="r">${fmtC(rhs, 4)}</td></tr></tbody></table></div>
        ${text}
        <div class="tbl-wrap"><table><thead><tr><th>极点</th><th>位置</th><th class="r">留数</th><th>圈内</th></tr></thead><tbody>
        ${poles.map((s) => `<tr><td>${s.name}${s.note ? "（" + s.note + "）" : ""}</td><td>${fmtC(s.z)}</td><td class="r">${fmtC(s.res, 4)}</td><td>${s.in ? "是" : "否"}</td></tr>`).join("")}</tbody></table></div>`;
    }
    function redrawChart() { const ex = EX[st.key], o = chartData(ex, vals[st.key]); chart.update(o); chart.mark(ex.sl.R ? vals[st.key].R : null); $("#ct-chart-cap").innerHTML = o.cap; }
    function choose(type, variant) {
      if (variant) st.rat = variant; st.key = type === "rat" ? st.rat : type;
      const ex = EX[st.key], p = vals[st.key];
      $$("button", types).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.type === type)));
      vars.hidden = type !== "rat"; press(vars, (b) => b.dataset.v === st.rat);
      $$(".ex[data-type]").forEach((e) => { e.hidden = e.dataset.type !== type; });
      $$("#ct-q [data-ex]").forEach((e) => { e.hidden = e.dataset.ex !== st.key; });
      sliders.replaceChildren();
      for (const s in ex.sl) {
        const [lo, hi, step] = ex.sl[s], lab = document.createElement("label"); lab.className = "slider";
        lab.innerHTML = `<span>${SL[s]}</span><input type="range" id="ct-sl-${s}" min="${lo}" max="${hi}" step="${step}" value="${p[s]}"><output id="ct-sl-${s}-o"></output>`;
        sliders.appendChild(lab);
        $("input", lab).addEventListener("input", (ev) => { p[s] = +ev.target.value; draw(); if (s !== "R") { clearTimeout(timer); timer = setTimeout(redrawChart, 140); } });
      }
      draw(); redrawChart();
    }
    types.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) choose(b.dataset.type); });
    vars.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) choose("rat", b.dataset.v); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => draw());
    choose("trig");
  })();
})();
