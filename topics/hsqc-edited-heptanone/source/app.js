// 页面交互：对象选择联动、重绘示意谱图、两个演示模型、原图局部放大、术语注释。
// 依赖：MEASURE（原图估读，build 时注入）、HSQCModel（model.js）、data.js 中的 SITES / TERMS / FG 等。
(() => {
  "use strict";
  const M = HSQCModel;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fH = (v) => v.toFixed(2), fC = (v) => v.toFixed(1);
  const signed = (v, d = 2) => { const r = Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v; return (r < 0 ? "−" : "+") + Math.abs(r).toFixed(d); };

  const EST = Object.fromEntries(MEASURE.summary.map((r) => [Number(r.site.slice(1)), r]));
  const PANELS = { hsqc: MEASURE.panels[0], edited: MEASURE.panels[1] };
  const IMG = MEASURE.image;
  const UNC = { h: 0.03, c: 0.5 };          // 页面声明的估读不确定度
  const JHH = 7.4;                           // 演示模型 ② 的邻位耦合（假设）
  const DEFAULTS = { delay: 8, j: 125, field: 400, zoom: 2 };
  const state = { sel: 2, ...DEFAULTS, view: "hsqc", ring: true };
  const siteOf = (id) => SITES[id - 1];
  const GLYPH = { black: "◇", red: "○", none: "✕" };
  const COLOR_ZH = { black: "黑", red: "红", none: "—" };

  const evTag = (k) => `<span class="ev ${k}"><i aria-hidden="true">${EVIDENCE[k].mark}</i>${EVIDENCE[k].label}</span>`;

  // ---------- 官能团小结构图：画出每个原子和每根键 ----------
  function fgSvg(key) {
    const g = FG[key]; if (!g) return "";
    const pad = (t) => (t.length > 1 ? 10 : 8);
    let s = "";
    for (const [i, j, order] of g.bonds) {
      const [x1, y1, t1] = g.atoms[i], [x2, y2, t2] = g.atoms[j];
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const ax = x1 + ux * pad(t1), ay = y1 + uy * pad(t1), bx = x2 - ux * pad(t2), by = y2 - uy * pad(t2);
      if (order === 2) { const ox = -uy * 2.6, oy = ux * 2.6; s += `<line class="bond" x1="${ax + ox}" y1="${ay + oy}" x2="${bx + ox}" y2="${by + oy}"/><line class="bond" x1="${ax - ox}" y1="${ay - oy}" x2="${bx - ox}" y2="${by - oy}"/>`; }
      else s += `<line class="bond" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
    }
    for (const [x, y, t, kind] of g.atoms) {
      if (kind === "a") s += `<circle class="ring" cx="${x}" cy="${y}" r="10.5"/>`;
      s += `<text class="t-${kind}" x="${x}" y="${y}">${esc(t)}</text>`;
    }
    return `<span class="fg" role="img" aria-label="${esc(g.desc)}"><svg width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}" aria-hidden="true">${s}</svg><span class="cap">${esc(g.name)}</span></span>`;
  }
  function fillFg(root) { root.querySelectorAll("[data-fg]").forEach((el) => { if (!el.firstChild) el.outerHTML = fgSvg(el.dataset.fg); }); }

  // ---------- 选择 ----------
  function select(id, opts = {}) {
    state.sel = clamp(Number(id), 1, 7);
    updateSelection();
    if (opts.focusList) $("objList").querySelector(`[data-id="${state.sel}"]`).focus();
  }
  const onActivate = (el, fn) => { el.addEventListener("click", fn); el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } }); };

  function buildObjList() {
    $("objList").innerHTML = SITES.map((s) => {
      const e = EST[s.id];
      const t2 = e ? `δH ≈ ${fH(e.dH)} · δC ≈ ${fC(e.dC)} ppm` : "无交叉峰（不带氢）";
      return `<button type="button" class="obj" data-id="${s.id}" aria-pressed="false"><span class="glyph g-${s.phase}" aria-hidden="true">${GLYPH[s.phase]}</span><span><span class="t1">C${s.id} · ${s.formula}</span><span class="t2 mono">${t2}</span></span></button>`;
    }).join("");
    $("objList").querySelectorAll(".obj").forEach((b) => {
      b.addEventListener("click", () => select(b.dataset.id));
      b.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return; e.preventDefault(); select(((state.sel - 1 + d + 7) % 7) + 1, { focusList: true });
      });
    });
  }

  // ---------- 结构（示意重绘，补全氢） ----------
  function buildStructure() {
    const svg = $("structure"), narrow = svg.parentElement.clientWidth - 34 < 640;
    svg.dataset.layout = narrow ? "narrow" : "wide";
    const P = [], Hs = {};
    if (!narrow) {
      svg.setAttribute("viewBox", "0 0 780 262");
      for (let i = 1; i <= 7; i++) P[i] = { x: 62 + (i - 1) * 109, y: i % 2 ? 112 : 160 };
      Hs[1] = [[-40, -2], [2, -42], [-20, 36]]; Hs[7] = [[40, -2], [-2, -42], [20, 36]];
      Hs[2] = Hs[4] = Hs[6] = [[-22, 38], [22, 38]]; Hs[5] = [[-22, -38], [22, -38]];
    } else {
      svg.setAttribute("viewBox", "0 0 340 566");
      for (let i = 1; i <= 7; i++) P[i] = { x: i % 2 ? 128 : 196, y: 58 + (i - 1) * 74 };
      Hs[1] = [[-40, -14], [-40, 18], [4, -40]]; Hs[7] = [[-40, -14], [-40, 18], [4, 40]];
      Hs[2] = Hs[4] = Hs[6] = [[40, -16], [40, 16]]; Hs[5] = [[-40, -16], [-40, 16]];
    }
    let s = "";
    for (const [a, b] of M.BONDS) {
      const A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      s += `<line class="bond" x1="${A.x + ux * 19}" y1="${A.y + uy * 19}" x2="${B.x - ux * 19}" y2="${B.y - uy * 19}"/>`;
    }
    // 羰基氧：双键
    const c3 = P[3], O = narrow ? { x: c3.x - 58, y: c3.y } : { x: c3.x, y: c3.y - 58 };
    if (narrow) s += `<line class="bond" x1="${c3.x - 19}" y1="${c3.y - 3.5}" x2="${O.x + 11}" y2="${O.y - 3.5}"/><line class="bond" x1="${c3.x - 19}" y1="${c3.y + 3.5}" x2="${O.x + 11}" y2="${O.y + 3.5}"/>`;
    else s += `<line class="bond" x1="${c3.x - 3.5}" y1="${c3.y - 19}" x2="${O.x - 3.5}" y2="${O.y + 11}"/><line class="bond" x1="${c3.x + 3.5}" y1="${c3.y - 19}" x2="${O.x + 3.5}" y2="${O.y + 11}"/>`;
    s += `<text class="otext" x="${O.x}" y="${O.y}">O</text>`;
    for (const site of SITES) {
      const p = P[site.id], e = EST[site.id];
      const label = `C${site.id}，${site.formula}，${site.name}` + (e ? `；氢约 ${fH(e.dH)}，碳约 ${fC(e.dC)} ppm` : "；无交叉峰");
      let g = `<g class="atom" data-id="${site.id}" tabindex="0" role="button" aria-label="${esc(label)}">`;
      // 透明的点按区域：整列（或整行）都可以点，不必对准小圆
      g += narrow ? `<rect class="hitarea" x="0" y="${p.y - 35}" width="340" height="70"/>` : `<rect class="hitarea" x="${p.x - 52}" y="44" width="104" height="212"/>`;
      for (const [dx, dy] of Hs[site.id] || []) {
        const d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        g += `<line class="hbond" x1="${p.x + ux * 18}" y1="${p.y + uy * 18}" x2="${p.x + dx - ux * 9}" y2="${p.y + dy - uy * 9}"/><text class="htext" x="${p.x + dx}" y="${p.y + dy}">H</text>`;
      }
      g += `<circle class="disc" cx="${p.x}" cy="${p.y}" r="17"/><text class="ctext" x="${p.x}" y="${p.y}">C${site.id}</text>`;
      const cap1 = `${GLYPH[site.phase]} C${site.id} · ${site.formula}`, cap2 = site.id === 3 ? "无交叉峰" : site.pos.split("（")[0];
      if (!narrow) g += `<text class="cap1" x="${p.x}" y="228" text-anchor="middle">${cap1}</text><text class="cap2" x="${p.x}" y="246" text-anchor="middle">${cap2}</text>`;
      else if (site.id === 3) g += `<text class="cap1" x="${p.x + 26}" y="${p.y}" text-anchor="start">${cap1}</text><text class="cap2" x="${p.x + 26}" y="${p.y + 16}" text-anchor="start">${cap2}</text>`;
      else if (site.id % 2) g += `<text class="cap1" x="${p.x - 58}" y="${p.y - 4}" text-anchor="end">${cap1}</text><text class="cap2" x="${p.x - 58}" y="${p.y + 13}" text-anchor="end">${cap2}</text>`;
      else g += `<text class="cap1" x="${p.x + 58}" y="${p.y - 4}" text-anchor="start">${cap1}</text><text class="cap2" x="${p.x + 58}" y="${p.y + 13}" text-anchor="start">${cap2}</text>`;
      s += g + "</g>";
    }
    svg.innerHTML = s;
    svg.querySelectorAll(".atom").forEach((g) => onActivate(g, () => select(g.dataset.id)));
  }

  // ---------- 重绘的示意谱图 ----------
  const H_HI = 3.0, H_LO = 0.5, C_MAX = 50;
  function specGeom(svg) {
    const W = clamp(Math.round(svg.parentElement.clientWidth), 240, 520), m = { l: 12, r: 58, t: 14, b: 46 };
    const pw = W - m.l - m.r, ph = Math.round(pw * 0.96), H = m.t + ph + m.b;
    return { W, H, m, pw, ph, X: (h) => m.l + (H_HI - h) / (H_HI - H_LO) * pw, Y: (c) => m.t + c / C_MAX * ph };
  }
  function buildSpectrum(kind) {
    const svg = $(kind === "hsqc" ? "specHsqc" : "specEdited"), g = specGeom(svg), { m, pw, ph, X, Y } = g;
    svg.setAttribute("viewBox", `0 0 ${g.W} ${g.H}`); svg._geom = g;
    let s = "";
    for (let h = 3.0; h >= 0.49; h -= 0.5) s += `<line class="grid" x1="${X(h)}" x2="${X(h)}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${X(h)}" y="${m.t + ph + 17}" text-anchor="middle">${h.toFixed(1)}</text>`;
    for (let c = 0; c <= 50; c += 10) s += `<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${Y(c)}" y2="${Y(c)}"/><text class="tick" x="${m.l + pw + 7}" y="${Y(c) + 4}">${c}</text>`;
    s += `<rect class="axis" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>`;
    s += `<text class="axlabel" x="${m.l + pw / 2}" y="${m.t + ph + 38}" text-anchor="middle">δ(¹H) / ppm（向右变小）</text>`;
    s += `<text class="axlabel" transform="translate(${g.W - 15} ${m.t + ph / 2}) rotate(90)" text-anchor="middle">δ(¹³C) / ppm（向下变大）</text>`;
    s += `<g class="overlay"></g>`;
    for (const site of SITES) {
      const e = EST[site.id]; if (!e) continue;
      const x = X(e.dH), y = Y(e.dC), cls = kind === "hsqc" ? "plain" : site.phase;
      const mark = cls === "plain" ? `<circle class="mark" r="3.6"/>` : cls === "black" ? `<path class="mark" d="M0 -7 7 0 0 7 -7 0Z"/>` : `<circle class="mark" r="6"/>`;
      const left = site.id === 1 || site.id === 5, lab = `<text class="lab" x="${left ? -11 : 11}" y="${site.id === 5 ? 16 : -9}" text-anchor="${left ? "end" : "start"}">C${site.id}</text>`;
      const aria = `C${site.id}，${site.formula}：氢约 ${fH(e.dH)} ppm，碳约 ${fC(e.dC)} ppm` + (kind === "edited" ? `，原图${COLOR_ZH[site.phase]}峰` : "");
      s += `<g class="pk ${cls}" data-id="${site.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(aria)}"><circle class="hit" r="15"/><circle class="focus" r="14"/>${mark}${lab}</g>`;
    }
    svg.innerHTML = s;
    svg.querySelectorAll(".pk").forEach((p) => onActivate(p, () => select(p.dataset.id)));
    updateSpectrum(kind);
  }
  function updateSpectrum(kind) {
    const svg = $(kind === "hsqc" ? "specHsqc" : "specEdited"), g = svg._geom; if (!g) return;
    const { m, pw, ph, X, Y } = g, e = EST[state.sel], ov = svg.querySelector(".overlay");
    svg.querySelectorAll(".pk").forEach((p) => p.classList.toggle("sel", Number(p.dataset.id) === state.sel));
    if (!e) { ov.innerHTML = `<text class="note" x="${m.l + 8}" y="${m.t + ph * 0.42}">C3：无交叉峰</text><text class="note" x="${m.l + 8}" y="${m.t + ph * 0.42 + 18}">羰基碳不带氢</text>`; return; }
    const x = X(e.dH), y = Y(e.dC), bottom = m.t + ph, right = m.l + pw;
    const tagH = fH(e.dH), tagC = fC(e.dC), hx = clamp(x, m.l + 18, right - 18), cy0 = state.sel === 7 ? 17 : -7;
    ov.innerHTML = `<line class="guide" x1="${x}" y1="${y}" x2="${x}" y2="${bottom}"/><line class="guide" x1="${x}" y1="${y}" x2="${right}" y2="${y}"/>` +
      `<circle class="selring" cx="${x}" cy="${y}" r="12"/>` +
      `<rect class="valbg" x="${hx - 17}" y="${bottom - 19}" width="34" height="16" rx="2"/><text class="valtag" x="${hx}" y="${bottom - 7}" text-anchor="middle">${tagH}</text>` +
      `<rect class="valbg" x="${right - 35}" y="${y + cy0 - 12}" width="32" height="16" rx="2"/><text class="valtag" x="${right - 5}" y="${y + cy0}" text-anchor="end">${tagC}</text>`;
  }

  // ---------- 演示模型 ①：编辑延迟 ----------
  const D_MAX = 12;
  function drawEditCurve() {
    const svg = $("editCurve"), W = clamp(Math.round(svg.parentElement.clientWidth), 250, 780), H = 244, m = { l: 62, r: 14, t: 30, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, X = (d) => m.l + d / D_MAX * pw, Y = (f) => m.t + (1 - f) / 2 * ph;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let s = "";
    for (const f of [-1, -0.5, 0, 0.5, 1]) s += `<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${Y(f)}" y2="${Y(f)}"/><text class="tick" x="${m.l - 6}" y="${Y(f) + 4}" text-anchor="end">${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.abs(f).toFixed(1)}</text>`;
    for (let d = 0; d <= D_MAX; d += 2) s += `<line class="grid" x1="${X(d)}" x2="${X(d)}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${X(d)}" y="${m.t + ph + 16}" text-anchor="middle">${d}</text>`;
    s += `<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${Y(0)}" y2="${Y(0)}"/><rect class="axis" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>`;
    s += `<text class="axlabel" x="${m.l + pw / 2}" y="${H - 5}" text-anchor="middle">编辑延迟 Δ / ms</text><text class="axlabel" transform="translate(14 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">因子 f</text>`;
    const refs = [[M.nullDelayMs(state.j), "1/(2J)"], [M.matchedDelayMs(state.j), "1/J"]];
    for (const [d, t] of refs) if (d <= D_MAX) s += `<line class="ref" x1="${X(d)}" x2="${X(d)}" y1="${m.t}" y2="${m.t + ph}"/><text class="reftext" x="${X(d)}" y="${m.t - 12}" text-anchor="middle">${t}</text>`;
    for (const [n, cls] of [[1, "c-ch"], [2, "c-ch2"], [3, "c-ch3"]]) {
      let d = "";
      for (let i = 0; i <= 240; i++) { const t = i / 240 * D_MAX; d += (i ? "L" : "M") + X(t).toFixed(1) + " " + Y(M.editFactor(n, state.j, t)).toFixed(1); }
      s += `<path class="${cls}" d="${d}"/>`;
    }
    const x = X(state.delay), f1 = M.editFactor(1, state.j, state.delay), f2 = M.editFactor(2, state.j, state.delay), f3 = M.editFactor(3, state.j, state.delay);
    s += `<line class="cursor" x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}"/>`;
    s += `<circle cx="${x}" cy="${Y(f1)}" r="2.6" fill="#a9b7c2"/>`;
    s += `<circle cx="${x}" cy="${Y(f2)}" r="5.5" fill="#0e1116" stroke="#f08b83" stroke-width="2.2"/>`;
    s += `<path d="M${x} ${Y(f3) - 6.5} ${x + 6.5} ${Y(f3)} ${x} ${Y(f3) + 6.5} ${x - 6.5} ${Y(f3)}Z" fill="#0e1116" stroke="#e6edf3" stroke-width="2.2"/>`;
    svg.innerHTML = s;
    $("editCurveDesc").textContent = `图中竖线是当前的 Δ = ${state.delay.toFixed(1)} ms；金色虚线是当前 J = ${state.j} Hz 对应的零点 1/(2J) = ${M.nullDelayMs(state.j).toFixed(2)} ms 和匹配点 1/J = ${M.matchedDelayMs(state.j).toFixed(2)} ms。`;
  }
  function drawEditBars() {
    const svg = $("editBars"), W = clamp(Math.round(svg.parentElement.clientWidth), 250, 780), H = 178, m = { l: 34, r: 8, t: 22, b: 26 };
    const pw = W - m.l - m.r, slot = pw / 7, y0 = m.t + (H - m.t - m.b) / 2, hmax = (H - m.t - m.b) / 2 - 16, bw = clamp(slot * 0.42, 14, 38);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let s = `<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${y0}" y2="${y0}"/><text class="tick" x="4" y="${y0 - hmax / 2 + 4}">正 ＋</text><text class="tick" x="4" y="${y0 + hmax / 2 + 4}">负 −</text>`;
    const parts = [];
    for (const site of SITES) {
      const cx = m.l + slot * (site.id - 0.5), sel = site.id === state.sel;
      if (!site.h) { s += `<text class="tick" x="${cx}" y="${y0 - 8}" text-anchor="middle">无峰</text><text class="barlab" x="${cx}" y="${H - 6}" text-anchor="middle"${sel ? ' fill="#5fd0a8"' : ""}>C3</text>`; parts.push("C3 无峰"); continue; }
      const f = M.editFactor(site.h, state.j, state.delay), h = Math.abs(f) * hmax, up = f >= 0, tip = up ? y0 - h : y0 + h;
      s += `<g class="barg" data-id="${site.id}" style="cursor:pointer"><rect class="bar ${site.phase}${sel ? " sel" : ""}" x="${cx - bw / 2}" y="${up ? y0 - h : y0}" width="${bw}" height="${Math.max(h, 1)}"/>`;
      s += site.h === 3 ? `<path d="M${cx} ${tip - 5} ${cx + 5} ${tip} ${cx} ${tip + 5} ${cx - 5} ${tip}Z" fill="#0e1116" stroke="#e6edf3" stroke-width="1.8"/>` : `<circle cx="${cx}" cy="${tip}" r="4.5" fill="#0e1116" stroke="#f08b83" stroke-width="1.8"/>`;
      s += `<text class="tick" x="${cx}" y="${up ? tip - 9 : tip + 17}" text-anchor="middle">${signed(f, slot < 42 ? 1 : 2)}</text><text class="barlab" x="${cx}" y="${H - 6}" text-anchor="middle"${sel ? ' fill="#5fd0a8"' : ""}>C${site.id}</text><rect x="${cx - slot / 2}" y="${m.t}" width="${slot}" height="${H - m.t}" fill="transparent"/></g>`;
      parts.push(`C${site.id} ${signed(f)}`);
    }
    svg.innerHTML = s;
    svg.querySelectorAll(".barg").forEach((g) => g.addEventListener("click", () => select(g.dataset.id)));
    $("editBarsDesc").textContent = "符号条（向上为正，向下为负；菱形 = CH₃，圆圈 = CH₂）：" + parts.join("，") + "。";
  }
  function updateEditText() {
    const f2 = M.editFactor(2, state.j, state.delay), f3 = M.editFactor(3, state.j, state.delay), st = M.editState(state.j, state.delay);
    const head = `CH₂ 因子 ${signed(f2)}，CH₃ 因子 ${signed(f3)} → `;
    $("editStatus").dataset.state = st;
    $("editStatus").innerHTML = head + (st === "opposite" ? "<b>反号</b>：模型重现了原图“黑与红相反”的现象。" + (Math.abs(f2) < 0.95 ? "延迟与 1/J 不完全匹配，强度下降，但符号仍然可靠。" : "") : st === "same" ? "<b>同号</b>：这时编辑谱分不出 CH₂ 和 CH₃，看起来和常规 HSQC 一样。" : "<b>接近零点</b>：Δ 在 1/(2J) 的奇数倍附近，信号几乎消失。");
    const deg = state.j * state.delay / 1000 * 180;
    $("editKv").innerHTML = `<div><span>当前 π·J·Δ</span><b class="mono">${deg.toFixed(0)}°</b></div><div><span>匹配延迟 1/J</span><b class="mono">${M.matchedDelayMs(state.j).toFixed(2)} ms</b></div><div><span>零点 1/(2J)</span><b class="mono">${M.nullDelayMs(state.j).toFixed(2)} ms</b></div>`;
  }

  // ---------- 演示模型 ②：一级裂分棒图 ----------
  const MP_HI = 2.58, MP_LO = 2.24;
  function drawMultiplet() {
    const svg = $("multiplet"), W = clamp(Math.round(svg.parentElement.clientWidth), 250, 780), H = 268, m = { l: 14, r: 14, t: 34, b: 40 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, y0 = m.t + ph / 2, hmax = ph / 2 - 24, X = (p) => m.l + (MP_HI - p) / (MP_HI - MP_LO) * pw;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const c2 = EST[2].dH, c4 = EST[4].dH, q = M.multiplet(c2, 3, JHH, state.field), t = M.multiplet(c4, 2, JHH, state.field);
    let s = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#f08b83" stroke-width="2"/></pattern></defs>`;
    for (let p = 2.55; p >= 2.249; p -= 0.05) s += `<line class="grid" x1="${X(p)}" x2="${X(p)}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${X(p)}" y="${m.t + ph + 16}" text-anchor="middle">${p.toFixed(2)}</text>`;
    s += `<text class="axlabel" x="${m.l + pw / 2}" y="${H - 5}" text-anchor="middle">δ(¹H) / ppm（示意，向右变小）</text>`;
    // 交叠 / 间隙
    const qr = [q[q.length - 1].ppm, q[0].ppm], tr = [t[t.length - 1].ppm, t[0].ppm], lo = Math.max(qr[0], tr[0]), hi = Math.min(qr[1], tr[1]);
    if (hi > lo) s += `<rect class="ovl" x="${X(hi)}" y="${y0 - 9}" width="${X(lo) - X(hi)}" height="18"/>`;
    else s += `<rect class="gap" x="${X(lo)}" y="${y0 - 9}" width="${Math.max(1, X(hi) - X(lo))}" height="18"/>`;
    s += `<line class="axis" x1="${m.l}" x2="${m.l + pw}" y1="${y0}" y2="${y0}"/>`;
    for (const l of q) { const x = X(l.ppm), h = l.weight / 0.5 * hmax; s += `<line class="stick-q" x1="${x}" x2="${x}" y1="${y0}" y2="${y0 - h}"/><rect x="${x - 4}" y="${y0 - h - 4}" width="8" height="8" fill="#5fd0a8"/>`; }
    for (const l of t) { const x = X(l.ppm), h = l.weight / 0.5 * hmax; s += `<line class="stick-t" x1="${x}" x2="${x}" y1="${y0}" y2="${y0 + h}"/><circle cx="${x}" cy="${y0 + h}" r="4.5" fill="#f1c875"/>`; }
    s += `<path class="span-q" d="M${X(qr[1])} ${y0 - 13} V${y0 - 18} H${X(qr[0])} V${y0 - 13}"/><path class="span-t" d="M${X(tr[1])} ${y0 + 13} V${y0 + 18} H${X(tr[0])} V${y0 + 13}"/>`;
    s += `<text x="${m.l + 4}" y="${m.t - 16}" style="fill:#5fd0a8;font-weight:700">■ C2 的氢：四重峰（向上）</text><text x="${m.l + 4}" y="${m.t + ph - 4}" style="fill:#f1c875;font-weight:700">● C4 的氢：三重峰（向下）</text>`;
    // 10 Hz 比例尺
    const bar = M.hzToPpm(10, state.field) / (MP_HI - MP_LO) * pw, bx = m.l + pw - 6;
    s += `<line x1="${bx - bar}" x2="${bx}" y1="${m.t - 12}" y2="${m.t - 12}" stroke="#e8eef2" stroke-width="2"/><line x1="${bx - bar}" x2="${bx - bar}" y1="${m.t - 16}" y2="${m.t - 8}" stroke="#e8eef2" stroke-width="1.5"/><line x1="${bx}" x2="${bx}" y1="${m.t - 16}" y2="${m.t - 8}" stroke="#e8eef2" stroke-width="1.5"/><text class="tick" x="${bx}" y="${m.t - 20}" text-anchor="end">10 Hz</text>`;
    svg.innerHTML = s;
    const dH = +(c2 - c4).toFixed(2), dC = +(EST[4].dC - EST[2].dC).toFixed(1), hzH = M.ppmToHz(dH, state.field), mhzC = M.carbonMHz(state.field), hzC = M.ppmToHz(dC, mhzC), ov = M.overlapHz(dH, state.field, 3, 2, JHH);
    $("multDesc").textContent = `棒图：横轴 ${MP_HI}–${MP_LO} ppm。四重峰以 ${fH(c2)} ppm 为中心向上画，三重峰以 ${fH(c4)} ppm 为中心向下画；相邻两条线相隔 ${JHH} Hz，即 ${(M.hzToPpm(JHH, state.field)).toFixed(4)} ppm。斜线区是两组范围交叠的部分，虚线框是分开后的空隙。`;
    $("multKv").innerHTML = `<div><span>氢维间距 ${dH.toFixed(2)} ppm × ${state.field} MHz</span><b class="mono">${hzH.toFixed(1)} Hz</b></div><div><span>碳维间距 ${dC.toFixed(1)} ppm × ${mhzC.toFixed(1)} MHz</span><b class="mono">${hzC.toFixed(0)} Hz</b></div><div><span>两组裂分的范围</span><b class="mono">${ov > 0 ? "交叠 " + ov.toFixed(1) + " Hz" : "分开 " + (-ov).toFixed(1) + " Hz"}</b></div>`;
    $("multStatus").dataset.state = ov > 0 ? "overlap" : "apart";
    $("multStatus").innerHTML = (ov > 0
      ? `在 ${state.field} MHz 上，两组氢的中心只隔 ${hzH.toFixed(1)} Hz，四重峰和三重峰<b>互相穿插</b>，一维氢谱里很难分别读出。`
      : `在 ${state.field} MHz 上，两组氢的中心相隔 ${hzH.toFixed(1)} Hz，两组裂分<b>刚好分开</b>；按这个模型，要到约 ${M.separationMHz(dH, 3, 2, JHH).toFixed(0)} MHz 以上才行。`)
      + `同一对碳在碳维上相隔 ${hzC.toFixed(0)} Hz，约是氢维的 ${(hzC / hzH).toFixed(0)} 倍。氢维 0.02 ppm 的差值已接近估读极限。`;
  }

  // ---------- 读数与解释 ----------
  function renderReadout() {
    const s = siteOf(state.sel), e = EST[state.sel];
    const row = (k, v, ev) => `<div class="readrow"><div class="k">${k}${ev ? " " + evTag(ev) : ""}</div><div class="v">${v}</div></div>`;
    let h = row("碳位", `C${s.id} · ${esc(s.name)}`) + `<div class="readrow"><div class="k">基团结构</div><div>${fgSvg(s.fg)}</div></div>`;
    if (e) {
      const f = M.editFactor(s.h, state.j, state.delay);
      h += row("¹H 估读", `<span class="mono">≈ ${fH(e.dH)} ppm</span> <small>± ${UNC.h}</small>`, "obs");
      h += row("¹³C 估读", `<span class="mono">≈ ${fC(e.dC)} ppm</span> <small>± ${UNC.c}</small>`, "obs");
      h += row("编辑谱颜色", `<span class="g-${s.phase}">${GLYPH[s.phase]} ${COLOR_ZH[s.phase]}色</span> <small>常规谱中为黑色</small>`, "obs");
      h += row("碳类型", `${s.formula} <small>${s.h} 个氢（${s.h % 2 ? "奇数" : "偶数"}）· ${esc(s.pos)}</small>`, "cnt");
      h += row("逐峰归属", `归 C${s.id}`, "inf");
      h += row("模型因子", `<span class="mono" id="roFactor">${signed(f)}</span> <small>cos${s.h === 3 ? "³" : "²"}(π·J·Δ)</small>`, "mod");
    } else {
      h += row("交叉峰", "无 <small>两张谱中都没有</small>", "obs");
      h += row("碳类型", "C=O <small>0 个氢</small>", "cnt");
      h += row("¹³C 化学位移", "无法从原图确认 <small>不在 0–50 ppm 的图内</small>");
      h += row("模型因子", "不适用 <small>没有氢，不出峰</small>", "mod");
    }
    $("readout").innerHTML = h;
    let x = `<p class="why">${esc(s.why)}</p><p class="limit">${esc(s.limit)}</p>`;
    if (e) x += `<p class="small muted" style="margin-top:8px">${evTag("cnt")} 按结构预测的一维氢谱裂分（一级近似）：${esc(s.split)}。原图的投影太小，无法逐峰核对。</p>`;
    $("explain").innerHTML = x;
    annotate($("readout")); annotate($("explain"));
  }
  function updateFactorOnly() { const s = siteOf(state.sel), el = $("roFactor"); if (el && s.h) el.textContent = signed(M.editFactor(s.h, state.j, state.delay)); }

  function buildTable() {
    $("assignRows").innerHTML = SITES.map((s) => {
      const e = EST[s.id];
      return `<tr class="pick" data-id="${s.id}" tabindex="0" role="button" aria-label="选择 C${s.id}">` +
        `<td data-label="碳位"><span><strong>C${s.id}</strong> ${esc(s.name)}</span></td>` +
        `<td data-label="基团结构"><span>${fgSvg(s.fg)}</span></td>` +
        `<td data-label="¹H 估读（ppm）"><span class="mono">${e ? "≈ " + fH(e.dH) : "—"}</span></td>` +
        `<td data-label="¹³C 估读（ppm）"><span class="mono">${e ? "≈ " + fC(e.dC) : "无法确认（不在图内）"}</span></td>` +
        `<td data-label="编辑谱颜色"><span class="g-${s.phase}">${GLYPH[s.phase]} ${e ? COLOR_ZH[s.phase] + "色" : "无峰"}</span></td>` +
        `<td data-label="碳类型">${s.formula}（${s.h} 个氢）</td>` +
        `<td data-label="归属依据"><span>${esc(s.why)}</span></td>` +
        `<td data-label="证据级别"><span class="evlines">${(e ? [["obs", "峰位与颜色"], ["cnt", "碳类型"], ["inf", "逐峰归属"]] : [["cnt", "不带氢"], ["obs", "两谱均无峰"]]).map(([k, t]) => `<span>${evTag(k)} ${t}</span>`).join("")}</span></td></tr>`;
    }).join("");
    $("assignRows").querySelectorAll("tr").forEach((tr) => onActivate(tr, (ev) => { if (ev.target.closest && ev.target.closest(".term")) return; select(tr.dataset.id); }));
  }

  // ---------- 原图局部放大 ----------
  function viewRegion() {
    if (state.view === "struct") return STRUCT_REGION;
    const f = PANELS[state.view].frame;
    return [Math.max(0, f.left - 88), Math.max(0, f.top - 98), Math.min(IMG.width, f.right + 88), Math.min(IMG.height, f.bottom + 46)];
  }
  function updateViewer() {
    const v = $("viewer"), img = $("zoomImg"), ring = $("zoomRing"), tag = $("zoomTag"), R = viewRegion(), rw = R[2] - R[0], rh = R[3] - R[1];
    v.style.aspectRatio = `${rw} / ${rh}`;
    const Wc = v.clientWidth; if (!Wc) return;
    const e = EST[state.sel], target = state.view === "struct" ? STRUCT_PX[state.sel] : e ? e[state.view].px : null;
    const vw = rw / state.zoom, vh = rh / state.zoom;
    const cx = clamp(target ? target[0] : (R[0] + R[2]) / 2, R[0] + vw / 2, R[2] - vw / 2), cy = clamp(target ? target[1] : (R[1] + R[3]) / 2, R[1] + vh / 2, R[3] - vh / 2);
    const s = Wc / vw, x0 = cx - vw / 2, y0 = cy - vh / 2;
    img.style.width = IMG.width * s + "px"; img.style.left = -x0 * s + "px"; img.style.top = -y0 * s + "px";
    v.classList.toggle("pix", s >= 3);
    v.dataset.x0 = x0.toFixed(1); v.dataset.y0 = y0.toFixed(1); v.dataset.scale = s.toFixed(3);
    const show = state.ring && !!target;
    ring.hidden = tag.hidden = !show;
    if (show) {
      const rx = (target[0] - x0) * s, ry = (target[1] - y0) * s, d = Math.max(30, 20 * s);
      ring.style.left = rx + "px"; ring.style.top = ry + "px"; ring.style.width = ring.style.height = d + "px";
      tag.textContent = "C" + state.sel;
      const right = rx + d / 2 + 60 < Wc;
      tag.style.left = (right ? rx + d / 2 + 4 : rx - d / 2 - 4) + "px"; tag.style.top = clamp(ry - 11, 2, Wc * rh / rw - 24) + "px"; tag.style.transform = right ? "none" : "translateX(-100%)";
    }
    const name = { hsqc: "常规 HSQC 面板", edited: "编辑 HSQC 面板", struct: "结构式" }[state.view];
    $("zoomCaption").textContent = `${name}：显示原图第 ${Math.round(x0)}–${Math.round(x0 + vw)} 列、第 ${Math.round(y0)}–${Math.round(y0 + vh)} 行；原图 1 像素 = 屏幕 ${s.toFixed(2)} 像素。`;
    let info;
    if (state.view === "struct") info = `<strong>C${state.sel}</strong> 在原图骨架式上的位置（定位圈为人工标注）。原图的骨架式省略了氢；两端写出了 H₃C 和 CH₃，羰基氧写作 O。`;
    else if (e) { const p = e[state.view]; info = `<strong>C${state.sel}</strong> 在该面板中的峰中心：像素 (${p.px[0].toFixed(1)}, ${p.px[1].toFixed(1)}) → δH ≈ ${p.dH.toFixed(3)}，δC ≈ ${p.dC.toFixed(2)} ppm（本面板单独估读；表中的值是两个面板的平均）。原图颜色：${state.view === "edited" ? COLOR_ZH[siteOf(state.sel).phase] : "黑"}色。`; }
    else info = `<strong>C3</strong> 是羰基碳，没有交叉峰，画面停在面板中央。可以在框内确认：只有 6 个等高线小圈。`;
    $("zoomInfo").innerHTML = info;
  }

  // ---------- 选择联动 ----------
  function updateSelection() {
    const s = siteOf(state.sel), e = EST[state.sel];
    $("objList").querySelectorAll(".obj").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.id) === state.sel)));
    $("structure").querySelectorAll(".atom").forEach((g) => g.classList.toggle("sel", Number(g.dataset.id) === state.sel));
    $("assignRows").querySelectorAll("tr").forEach((tr) => tr.classList.toggle("sel", Number(tr.dataset.id) === state.sel));
    updateSpectrum("hsqc"); updateSpectrum("edited"); drawEditBars(); renderReadout(); updateViewer();
    $("nowText").innerHTML = `当前：<b>C${s.id} · ${s.formula}</b>　` + (e ? `<span class="mono">δH ≈ ${fH(e.dH)} · δC ≈ ${fC(e.dC)}</span>` : "无交叉峰");
    document.body.dataset.sel = String(state.sel);
  }

  // ---------- 滑块 ----------
  function syncOutputs() {
    $("oDelay").textContent = state.delay.toFixed(1) + " ms"; $("sDelay").setAttribute("aria-valuetext", state.delay.toFixed(1) + " 毫秒");
    $("oJ").textContent = state.j + " Hz"; $("sJ").setAttribute("aria-valuetext", state.j + " 赫兹");
    $("oField").textContent = state.field + " MHz"; $("sField").setAttribute("aria-valuetext", state.field + " 兆赫");
    $("oZoom").textContent = state.zoom.toFixed(1) + "×"; $("sZoom").setAttribute("aria-valuetext", "放大 " + state.zoom.toFixed(1) + " 倍");
  }
  function updateModel1() { drawEditCurve(); drawEditBars(); updateEditText(); updateFactorOnly(); }
  function bindControls() {
    $("sDelay").addEventListener("input", (e) => { state.delay = Number(e.target.value); syncOutputs(); updateModel1(); });
    $("sJ").addEventListener("input", (e) => { state.j = Number(e.target.value); syncOutputs(); updateModel1(); });
    $("sField").addEventListener("input", (e) => { state.field = Number(e.target.value); syncOutputs(); drawMultiplet(); });
    $("sZoom").addEventListener("input", (e) => { state.zoom = Number(e.target.value); syncOutputs(); updateViewer(); });
    $("showRing").addEventListener("change", (e) => { state.ring = e.target.checked; updateViewer(); });
    $("resetBtn").addEventListener("click", () => {
      Object.assign(state, { delay: DEFAULTS.delay, j: DEFAULTS.j, field: DEFAULTS.field });
      $("sDelay").value = state.delay; $("sJ").value = state.j; $("sField").value = state.field;
      syncOutputs(); updateModel1(); drawMultiplet();
    });
    $("viewBtns").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.view = b.dataset.view;
      $("viewBtns").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      updateViewer();
    }));
    $("prevBtn").addEventListener("click", () => select(((state.sel + 5) % 7) + 1));
    $("nextBtn").addEventListener("click", () => select((state.sel % 7) + 1));
    $("openOriginal").addEventListener("click", () => {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>课程原图（1888 × 935）</title><style>body{margin:0;background:#151a21}img{display:block;margin:auto}</style><img alt="完整课程原图" src="' + $("origFull").src + '"></html>');
      w.document.close();
    });
  }
  // 手机上把模型滑块移到对应图形上方；桌面上放回左栏
  const mqMobile = window.matchMedia("(max-width: 760px)");
  function placeControls() {
    if (mqMobile.matches) { $("slotEdit").append($("ctlDelay"), $("ctlJ")); $("slotField").append($("ctlField")); }
    else $("paramsHome").append($("ctlDelay"), $("ctlJ"), $("ctlField"));
    document.body.dataset.controls = mqMobile.matches ? "inline" : "left";
  }

  // ---------- 术语注释 ----------
  const TERM_BY_KEY = Object.fromEntries(TERMS.map((t) => [t.key, t]));
  const PATTERNS = TERMS.flatMap((t) => t.patterns.map((p) => ({ p, key: t.key }))).sort((a, b) => b.p.length - a.p.length);
  const PAT_KEY = new Map(PATTERNS.map((x) => [x.p, x.key]));
  const TERM_RE = new RegExp(PATTERNS.map((x) => x.p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const isWord = (ch) => !!ch && /[A-Za-z0-9]/.test(ch);
  const SKIP = ".term,.termpop,button,a,svg,.katex,script,style,h1,h2,h3,summary,label,th,output,[data-noterm],.fg,.ev,.badge,.legend,.readrow .k,.evlines";
  function annotate(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
      if (!n.nodeValue.trim() || n.parentElement.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      const dyn = n.parentElement.closest("[data-dynamic]");            // 会被整体重写的区域只在各自重写后单独加注释
      return dyn && dyn !== root ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const seen = new Map();
    for (const node of nodes) {
      const scope = node.parentElement.closest("[data-scope]") || root, done = seen.get(scope) || seen.set(scope, new Set()).get(scope);
      const text = node.nodeValue; let last = 0, frag = null;
      for (const mt of text.matchAll(TERM_RE)) {
        const w = mt[0], i = mt.index, key = PAT_KEY.get(w);
        if (done.has(key)) continue;
        if ((isWord(w[0]) && isWord(text[i - 1])) || (isWord(w[w.length - 1]) && isWord(text[i + w.length]))) continue;
        done.add(key); frag = frag || document.createDocumentFragment();
        if (i > last) frag.append(text.slice(last, i));
        const b = document.createElement("button");
        b.type = "button"; b.className = "term"; b.dataset.term = key; b.textContent = w;
        b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-haspopup", "dialog"); b.title = "查看注释：" + TERM_BY_KEY[key].zh;
        frag.append(b); last = i + w.length;
      }
      if (frag) { if (last < text.length) frag.append(text.slice(last)); node.replaceWith(frag); }
    }
  }
  let popTrigger = null;
  function closePop(refocus) {
    const pop = $("termPop"); if (pop.hidden) return;
    pop.hidden = true;
    if (popTrigger) { popTrigger.setAttribute("aria-expanded", "false"); if (refocus && document.contains(popTrigger)) popTrigger.focus(); }
    popTrigger = null;
  }
  function openPop(btn, byKeyboard) {
    const t = TERM_BY_KEY[btn.dataset.term], pop = $("termPop");
    if (popTrigger === btn) { closePop(false); return; }
    closePop(false);
    $("termPopTitle").textContent = t.zh; $("termPopEn").textContent = t.en;
    $("termPopBody").innerHTML = `<p>${esc(t.def)}</p>` + (t.fg ? `<div>${fgSvg(t.fg)}</div>` : "");
    $("termPopMore").href = "#term-" + t.key;
    pop.hidden = false; popTrigger = btn; btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth, pw = pop.offsetWidth, ph = pop.offsetHeight;
    const left = clamp(r.left, 8, vw - pw - 8) + window.scrollX;
    const below = r.bottom + 6 + ph <= window.innerHeight || r.top - 6 - ph < 0;
    pop.style.left = left + "px"; pop.style.top = (below ? r.bottom + 6 : r.top - 6 - ph) + window.scrollY + "px";
    if (byKeyboard) pop.focus({ preventScroll: true });
  }
  function bindTerms() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("button.term");
      if (btn) { e.stopPropagation(); openPop(btn, e.detail === 0); return; }
      if (!e.target.closest || !e.target.closest("#termPop")) closePop(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("termPop").hidden) { e.preventDefault(); closePop(true); return; }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("button.term")) e.stopPropagation(); // 不触发所在表格行的选择
    }, true);
    $("termPopClose").addEventListener("click", () => closePop(true));
    $("termPopMore").addEventListener("click", () => closePop(false));
    $("termPop").addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const first = $("termPopClose"), last = $("termPopMore");
      if ((e.shiftKey && (document.activeElement === first || document.activeElement === $("termPop"))) || (!e.shiftKey && document.activeElement === last)) { e.preventDefault(); closePop(true); }
    });
  }
  function buildGlossary() {
    $("glossaryList").innerHTML = TERMS.map((t) => `<div id="term-${t.key}"><dt>${esc(t.zh)}<small lang="en">${esc(t.en)}</small></dt><dd>${esc(t.def)}${t.fg ? "<div>" + fgSvg(t.fg) + "</div>" : ""}</dd></div>`).join("");
    $("biRows").innerHTML = BILINGUAL.map((b) => `<tr><td data-label="原图英文" lang="en">${esc(b.en)}</td><td data-label="中文">${esc(b.zh)}</td><td data-label="位置">${esc(b.where)}</td></tr>`).join("");
    $("evList").innerHTML = Object.keys(EVIDENCE).map((k) => `<li>${evTag(k)}<span class="h">${esc(EVIDENCE[k].hint)}</span></li>`).join("");
  }

  // ---------- 数值核对区的动态文字与页面自检 ----------
  function selftest() {
    const c = M.counts(), S = EST, near = (a, b, t) => Math.abs(a - b) <= t;
    const colors = PANELS.edited.peaks.map((p) => p.color);
    const list = [
      ["碳 7、氢 14；2 个 CH₃ + 4 个 CH₂ + 1 个无氢碳", c.carbons === 7 && c.hydrogens === 14 && c.ch3 === 2 && c.ch2 === 4 && c.noH === 1 && c.ch === 0],
      ["预期 HSQC 峰数 = 7 − 1 = 6", c.expectedHsqcPeaks === 6],
      ["不饱和度 = 1", M.dbe(M.FORMULA) === 1],
      ["原图两个面板各测到 6 个峰", PANELS.hsqc.peaks.length === 6 && PANELS.edited.peaks.length === 6],
      ["编辑谱：2 黑 4 红，黑峰的 ¹³C 最低", colors.join() === "black,black,red,red,red,red"],
      ["边框对应 3.0 → 0.5 ppm 与 0 → 50 ppm", near(PANELS.hsqc.hAxis.atLeft, 3, 0.02) && near(PANELS.hsqc.hAxis.atRight, 0.5, 0.02) && near(PANELS.hsqc.cAxis.atTop, 0, 0.5) && near(PANELS.hsqc.cAxis.atBottom, 50, 0.5)],
      ["两个面板估读差：¹H ≤ 0.02、¹³C ≤ 0.8 ppm", MEASURE.spread.maxPanelDiffH <= 0.02 && MEASURE.spread.maxPanelDiffC <= 0.8],
      ["¹H 递减：C4 > C5 > C6 > C7，且 C2 > C1", S[4].dH > S[5].dH && S[5].dH > S[6].dH && S[6].dH > S[7].dH && S[2].dH > S[1].dH],
      ["C2/C4：¹H 差 ≤ 0.05，¹³C 差 > 5 ppm", Math.abs(S[2].dH - S[4].dH) <= 0.05 && S[4].dC - S[2].dC > 5],
      ["经验加和 36.3 + 6.9 与估读 42.7 相差 < 1.5", Math.abs(S[2].dC + M.incrementDelta({ beta: 1, gamma: 1 }) - S[4].dC) < 1.5],
      ["模型：Δ = 1/J 时因子为 −1、+1、−1", [1, 2, 3].every((n) => near(M.editFactor(n, 125, 8), n % 2 ? -1 : 1, 1e-12))],
      ["模型：Δ = 0 全为 +1；Δ = 1/(2J) 全为 0", [1, 2, 3].every((n) => near(M.editFactor(n, 125, 0), 1, 1e-12) && near(M.editFactor(n, 125, 4), 0, 1e-12))],
      ["换算：1/125 Hz = 8.00 ms；0.02 ppm × 400 MHz = 8 Hz", near(M.matchedDelayMs(125), 8, 1e-12) && near(M.ppmToHz(0.02, 400), 8, 1e-12)],
      ["裂分：1:3:3:1 与 1:2:1，925 MHz 以上才分开", M.multiplet(2.42, 3, 7.4, 400).map((l) => l.weight * 8).join() === "1,3,3,1" && M.multiplet(2.4, 2, 7.4, 400).map((l) => l.weight * 4).join() === "1,2,1" && near(M.separationMHz(0.02, 3, 2, 7.4), 925, 1e-9)],
    ].map(([name, pass]) => ({ name, pass: !!pass }));
    return { ok: list.every((x) => x.pass), list };
  }
  function fillChecks() {
    const p = PANELS.hsqc, e = EST[2].hsqc, a = p.hAxis.slope, b = p.hAxis.intercept, a2 = p.cAxis.slope, b2 = p.cAxis.intercept;
    const num = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d), plus = (v, d) => (v < 0 ? "− " : "+ ") + Math.abs(v).toFixed(d);
    $("pxExample").innerHTML = `例：常规面板中 C2 的峰中心在 x = ${e.px[0].toFixed(1)}、y = ${e.px[1].toFixed(1)} 像素。<span class="mono">δH = ${num(a, 6)} × ${e.px[0].toFixed(1)} ${plus(b, 3)} = ${(a * e.px[0] + b).toFixed(2)}</span>；<span class="mono">δC = ${num(a2, 5)} × ${e.px[1].toFixed(1)} ${plus(b2, 2)} = ${(a2 * e.px[1] + b2).toFixed(1)}</span> ppm。`;
    $("pxScale").textContent = `横轴约 ${p.hAxis.pxPerPpm.toFixed(1)} 像素/ppm，1 像素 ≈ ${MEASURE.spread.onePixelH.toFixed(3)} ppm；纵轴约 ${p.cAxis.pxPerPpm.toFixed(2)} 像素/ppm，1 像素 ≈ ${MEASURE.spread.onePixelC.toFixed(2)} ppm。纵轴只有 20 和 40 带数字，拟合时还用了 10 和 30 处的无数字刻度。`;
    const sp = MEASURE.spread;
    $("spreadText").innerHTML = `常规与编辑两个面板分别估读，同一个峰最多相差 <span class="mono">${sp.maxPanelDiffH.toFixed(3)} ppm</span>（氢）和 <span class="mono">${sp.maxPanelDiffC.toFixed(1)} ppm</span>（碳）。` + (sp.maxCaptureDiffH != null ? `对同一张幻灯片的另一份截图重复估读，最多相差 <span class="mono">${sp.maxCaptureDiffH.toFixed(3)} ppm</span> 和 <span class="mono">${sp.maxCaptureDiffC.toFixed(2)} ppm</span>。` : "") + `再考虑投影错位，本页取氢 ±${UNC.h}、碳 ±${UNC.c} ppm 作为估读不确定度。`;
    const st = selftest();
    $("selftest").innerHTML = st.list.map((x) => `<li><span class="${x.pass ? "ok" : "bad"}" aria-hidden="true">${x.pass ? "✓" : "✗"}</span><span>${esc(x.name)}${x.pass ? "" : "（未通过）"}</span></li>`).join("");
    $("selftest").dataset.ok = String(st.ok);
  }

  // ---------- 启动 ----------
  function redrawAll() { buildStructure(); buildSpectrum("hsqc"); buildSpectrum("edited"); drawEditCurve(); drawMultiplet(); updateSelection(); }
  function init() {
    $("zoomImg").src = $("origNative").src = $("origFull").src;
    fillFg(document.body);
    buildGlossary(); buildObjList(); buildTable(); bindControls(); bindTerms(); placeControls(); syncOutputs(); fillChecks();
    redrawAll(); updateEditText();
    annotate(document.querySelector("header")); annotate(document.querySelector("main"));
    let raf = 0, lastW = window.innerWidth;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { placeControls(); redrawAll(); lastW = window.innerWidth; }); };
    window.addEventListener("resize", () => { if (window.innerWidth !== lastW) onResize(); else updateViewer(); });
    mqMobile.addEventListener("change", onResize);
    $("origDetails").addEventListener("toggle", () => { document.body.dataset.origOpen = String($("origDetails").open); });
    document.body.dataset.ready = "1";
  }
  window.__selftest = selftest;
  window.__state = state;
  window.__select = select;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
