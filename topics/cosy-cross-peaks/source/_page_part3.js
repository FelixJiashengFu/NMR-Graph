
  /* ======================= 画布工具 ======================= */
  function hidpi(cv) {
    var r = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    var w = cv.clientWidth || cv.width, h = cv.height * (cv.clientWidth ? cv.height / cv.height : 1);
    var attrW = +cv.getAttribute("width"), attrH = +cv.getAttribute("height");
    var cssW = cv.clientWidth || attrW;
    var cssH = Math.round(cssW * attrH / attrW);
    cv.style.height = cssH + "px";
    cv.width = Math.round(cssW * r); cv.height = Math.round(cssH * r);
    var g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0);
    return { g: g, w: cssW, h: cssH };
  }
  function amp2col(a) {         // 幅度 → 颜色（顺序色标，中性=弱，青=强）
    var t = Math.max(0, Math.min(1, a));
    var stops = [[0, [70, 82, 96]], [0.45, [95, 208, 168]], [1, [186, 255, 226]]];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var u = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]), A = stops[i - 1][1], B = stops[i][1];
        return "rgb(" + Math.round(A[0] + (B[0] - A[0]) * u) + "," + Math.round(A[1] + (B[1] - A[1]) * u) +
               "," + Math.round(A[2] + (B[2] - A[2]) * u) + ")";
      }
    }
    return "rgb(186,255,226)";
  }

  /* ======================= 2D COSY 图 ======================= */
  var MAP = { x0: 0, y0: 0, s: 1, lo: 1.35, hi: 5.05, hits: [] };
  function draw2D() {
    var c = hidpi($("cv2d")), g = c.g, W = c.w, H = c.h;
    g.clearRect(0, 0, W, H);
    var M = { l: 64, r: 26, t: 104, b: 62 };
    var plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    var s = Math.min(plotW / (MAP.hi - MAP.lo), plotH / (MAP.hi - MAP.lo));
    var pw = s * (MAP.hi - MAP.lo), ph = s * (MAP.hi - MAP.lo);
    var x0 = M.l + (plotW - pw) / 2, y0 = M.t + (plotH - ph) / 2;
    var X = function (ppm) { return x0 + (ppm - MAP.lo) * s; };
    var Y = function (ppm) { return y0 + (ppm - MAP.lo) * s; };
    MAP.x0 = x0; MAP.y0 = y0; MAP.s = s;
    MAP.X = X; MAP.Y = Y;

    // 面板底
    g.fillStyle = "#10151c"; g.fillRect(x0, y0, pw, ph);
    g.strokeStyle = "#303a47"; g.lineWidth = 1; g.strokeRect(x0 + .5, y0 + .5, pw, ph);

    // 网格（0.5 ppm）
    g.strokeStyle = "#1b222c"; g.lineWidth = 1;
    for (var v = 1.5; v <= 5.0; v += 0.5) {
      g.beginPath(); g.moveTo(X(v), y0); g.lineTo(X(v), y0 + ph); g.stroke();
      g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x0 + pw, Y(v)); g.stroke();
    }
    // 对角线
    g.save(); g.setLineDash([5, 4]); g.strokeStyle = "#4a5768"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(X(MAP.lo), Y(MAP.lo)); g.lineTo(X(MAP.hi), Y(MAP.hi)); g.stroke(); g.restore();

    var stt = st(), P = N.visiblePeaks(stt), mx = 0;
    P.forEach(function (p) { mx = Math.max(mx, p.mag); });
    mx = mx || 1;
    var sel = ST.sel;

    // 峰
    MAP.hits = [];
    P.forEach(function (p, idx) {
      var cx = X(p.f2), cy = Y(p.f1);
      var r = 4 + 12 * Math.pow(Math.min(1, p.mag / mx), 0.45);
      var on = (sel.type === "pair" && ((sel.i === Math.round(p.f2 * 100) && sel.j === Math.round(p.f1 * 100))));
      var isSelSite = (sel.type === "site" && (isSiteOf(p, sel.i)));
      var col = p.visible ? amp2col(p.mag / mx) : "#39424f";
      g.globalAlpha = p.visible ? 0.95 : 0.5;
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.78, 0, 0, 6.2832);
      g.fillStyle = p.visible ? col : "rgba(57,66,79,.55)"; g.fill();
      if (p.diag) { g.setLineDash([2, 2]); g.strokeStyle = "rgba(255,255,255,.45)"; g.stroke(); g.setLineDash([]); }
      if (p.members.length > 1) {     // 第二重编码：位移重合处画双环
        g.beginPath(); g.ellipse(cx, cy, r + 3.2, r * 0.78 + 3.2, 0, 0, 6.2832);
        g.strokeStyle = "#a98bf0"; g.lineWidth = 1.2; g.stroke();
      }
      g.globalAlpha = 1;
      if (on || isSelSite) {
        g.beginPath(); g.ellipse(cx, cy, r + 6.5, r * 0.78 + 6.5, 0, 0, 6.2832);
        g.strokeStyle = "#f0a83c"; g.lineWidth = 2; g.stroke();
      }
      if (!p.visible) {   // 不可见的格：叉号，第二重编码
        g.strokeStyle = "rgba(226,100,95,.75)"; g.lineWidth = 1.4;
        var d = r + 1.5;
        g.beginPath(); g.moveTo(cx - d, cy - d * .78); g.lineTo(cx + d, cy + d * .78);
        g.moveTo(cx + d, cy - d * .78); g.lineTo(cx - d, cy + d * .78); g.stroke();
      }
      MAP.hits.push({ cx: cx, cy: cy, r: Math.max(r + 6, 12), f2: p.f2, f1: p.f1, p: p });
    });

    // 1D 投影（上：F2；右：F1），用一阶多重峰画成线谱
    var mults = N.multiplets(stt), yBase = y0 - 16, xBase = x0 + pw + 16;
    var hMax = 62;
    mults.forEach(function (m, si) {
      var lines = N.multipletLines(m.partners), tot = 0;
      lines.forEach(function (L) { tot += L.w; });
      if (!tot) tot = 1;
      var jc = 1 / (FIELDS[ST.fieldIdx]);
      g.strokeStyle = "#9fb0c1"; g.lineWidth = 1.2;
      lines.forEach(function (L) {
        var ppm = m.d + L.off * jc * (ST.system === "figure" ? 1 : 1);
        var hh = hMax * (L.w / tot) * 1.0 + 2;
        g.beginPath(); g.moveTo(X(ppm), yBase); g.lineTo(X(ppm), yBase - hh); g.stroke();
      });
      // 组标注
      g.fillStyle = "#aeb9c7"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
      g.textAlign = "center";
      g.fillText(m.key + " · " + m.mult + "H", X(m.d), yBase - hMax - 6);
      // 右侧
      lines.forEach(function (L) {
        var ppm = m.d + L.off * jc;
        var ww = hMax * (L.w / tot) + 2;
        g.beginPath(); g.moveTo(xBase, Y(ppm)); g.lineTo(xBase + ww, Y(ppm)); g.stroke();
      });
      g.save(); g.translate(xBase + hMax + 12, Y(m.d)); g.rotate(-Math.PI / 2);
      g.fillStyle = "#aeb9c7"; g.textAlign = "center"; g.fillText(m.key, 0, 0); g.restore();
    });
    g.strokeStyle = "#232b35"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, yBase); g.lineTo(x0 + pw, yBase); g.stroke();
    g.beginPath(); g.moveTo(xBase, y0); g.lineTo(xBase, y0 + ph); g.stroke();

    // 坐标轴
    g.fillStyle = "#7f8b9b"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
    g.textAlign = "center";
    for (var t = 1.5; t <= 5.0001; t += 0.5) {
      g.fillText(t.toFixed(1), X(t), y0 + ph + 15);
      g.save(); g.translate(x0 - 12, Y(t)); g.rotate(-Math.PI / 2); g.textAlign = "center";
      g.fillText(t.toFixed(1), 0, 0); g.restore();
    }
    g.fillStyle = "#aeb9c7"; g.font = "12px " + getComputedStyle(document.body).fontFamily;
    g.fillText("F2 · ¹H 化学位移 (ppm)", x0 + pw / 2, y0 + ph + 38);
    g.save(); g.translate(16, y0 + ph / 2); g.rotate(-Math.PI / 2);
    g.fillText("F1 · ¹H 化学位移 (ppm)", 0, 0); g.restore();
    g.save(); g.translate(x0 + pw * 0.62, y0 + ph * 0.30); g.rotate(-Math.atan2(ph, pw));
    g.fillStyle = "#5c6a7c"; g.font = "italic 12px " + getComputedStyle(document.body).fontFamily;
    g.fillText("对角峰线 F1 = F2", 0, -6); g.restore();

    // 图注
    var vis = P.filter(function (p) { return p.visible; }).length;
    $("cap2d").textContent = "示意：模型算出的 2D COSY（非实测数据）。当前 " + P.length + " 个格，" +
      vis + " 个可见（阈值 " + fmt(ST.th, 3) + "）。椭圆大小 = 模型幅度，虚线椭圆 = 对角峰，叉号 = 低于阈值，双环 = 该处叠了两个不同的峰。";
  }
  function isSiteOf(p, id) {
    var sys = N.getSystem(st()), d = sys.sites[id - 1] ? sys.sites[id - 1].d : null;
    if (d === null) return false;
    return (Math.abs(p.f2 - d) < 0.03 && Math.abs(p.f1 - d) < 0.03);
  }

  /* ======================= 结构式 ======================= */
  var MOLHITS = [];
  function drawMol() {
    var c = hidpi($("cvMol")), g = c.g, W = c.w, H = c.h;
    g.clearRect(0, 0, W, H);
    var sys = N.getSystem(st()), n = sys.sites.length;
    var pad = 58, avail = W - pad * 2;
    var xr = [], i;
    for (i = 0; i < n; i++) xr.push(pad + avail * i / Math.max(1, n - 1));
    var yc = H * 0.56;
    MOLHITS = [];

    // 位点：一个位点画成一个「碳球 + 若干氢」的简化单元
    var rC = 19;
    for (i = 0; i < n; i++) {
      var s = sys.sites[i], x = xr[i], sel = (ST.sel.type === "site" && ST.sel.i === s.id);
      if (i < n - 1) {   // 键
        g.strokeStyle = "#5a6472"; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + rC, yc); g.lineTo(xr[i + 1] - rC, yc); g.stroke();
        var Jv = sys.J[i][i + 1];
        if (Jv > 0) {
          g.fillStyle = "#f0a83c"; g.font = "11.5px " + getComputedStyle(document.body).fontFamily;
          g.textAlign = "center";
          g.fillText("³J = " + Jv.toFixed(1) + " Hz", (x + xr[i + 1]) / 2, yc - 7);
        }
      }
      // 碳球
      g.beginPath(); g.arc(x, yc, rC, 0, 6.2832);
      g.fillStyle = s.exch ? "#5b4a86" : "#2b3a63"; g.fill();
      g.strokeStyle = sel ? "#f0a83c" : "#5865EA"; g.lineWidth = sel ? 3 : 2; g.stroke();
      g.fillStyle = "#dfe7f3"; g.font = "600 12px " + getComputedStyle(document.body).fontFamily;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("C" + i, x, yc + 1);
      // 氢（个数 = mult；用小球表示）
      var m = s.mult, hr = 9;
      for (var k = 0; k < m; k++) {
        var ang = -Math.PI / 2 + (k - (m - 1) / 2) * 0.62, rr = rC + 17;
        var hx = x + Math.cos(ang) * rr, hy = yc + Math.sin(ang) * rr - 6;
        g.beginPath(); g.moveTo(x + Math.cos(ang) * rC, yc + Math.sin(ang) * rC);
        g.lineTo(hx, hy); g.strokeStyle = "#3d4654"; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.arc(hx, hy, hr, 0, 6.2832);
        g.fillStyle = s.exch ? "#8d6fd8" : "#EBE84E"; g.globalAlpha = s.exch ? .95 : .92; g.fill(); g.globalAlpha = 1;
        g.fillStyle = "#20242b"; g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
        g.fillText("H", hx, hy + .5);
      }
      // 标注两行
      g.textBaseline = "alphabetic";
      g.fillStyle = sel ? "#f0a83c" : "#5fd0a8";
      g.font = "600 13px " + getComputedStyle(document.body).fontFamily;
      g.fillText("(" + s.id + ") " + s.label, x, yc + rC + 44);
      g.fillStyle = "#aeb9c7"; g.font = "12px " + getComputedStyle(document.body).fontFamily;
      g.fillText(s.mult + "H · δ " + s.d.toFixed(2) + " ppm", x, yc + rC + 62);
      g.fillStyle = "#7f8b9b"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
      g.fillText(s.key, x, yc + rC + 79);
      MOLHITS.push({ x: x, y: yc, r: rC + 20, id: s.id });
    }
    $("capMol").textContent = "示意：结构来自原图的球棍图（C/O/N/H 的相对位置逐像素读出）" +
      (ST.system === "figure" ? "；当前显示原图骨架的四个可分辨位点。" : "；当前把化学等价的氢并成一个位点。") +
      " 弧线上的 ³J 为文献近似值。";
  }

  /* ======================= τ 曲线 ======================= */
  function drawTau() {
    var c = hidpi($("cvTau")), g = c.g, W = c.w, H = c.h;
    g.clearRect(0, 0, W, H);
    var M = { l: 52, r: 96, t: 20, b: 38 };
    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    var tMax = 160, K = N.normK(1200);
    var X = function (t) { return M.l + pw * t / tMax; };
    var Y = function (a) { return M.t + ph * (1 - (a + 0.45) / 1.5); };
    g.strokeStyle = "#232b35"; g.lineWidth = 1;
    [-0.4, 0, 0.5, 1].forEach(function (a) {
      g.beginPath(); g.moveTo(M.l, Y(a)); g.lineTo(M.l + pw, Y(a)); g.stroke();
      g.fillStyle = "#7f8b9b"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
      g.textAlign = "right"; g.fillText(a.toFixed(1), M.l - 6, Y(a) + 4);
    });
    g.fillStyle = "#7f8b9b"; g.textAlign = "center";
    for (var t = 0; t <= tMax; t += 40) { g.fillText(t + "", X(t), M.t + ph + 15); }
    g.fillStyle = "#aeb9c7"; g.fillText("混合时间 τm (ms)", M.l + pw / 2, M.t + ph + 32);

    var sys = N.getSystem(st()), refJ = 7.3;
    // 曲线 1：交叉峰（参考耦合 J=7.3）
    for (var pass = 0; pass < 3; pass++) {
      g.beginPath();
      for (var tt = 0; tt <= tMax; tt += 0.5) {
        var yv;
        if (pass === 0) yv = N.fCross(refJ, tt, 1200) / K;
        else if (pass === 1) yv = N.gDiag(refJ, tt, 1200) / K;
        else yv = N.fCross(5.2, tt, 1200) / K;
        var xx = X(tt), yy = Y(yv);
        if (tt === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.strokeStyle = pass === 0 ? "#5fd0a8" : (pass === 1 ? "#4d9de0" : "#f0a83c");
      g.lineWidth = pass === 2 ? 1.4 : 2;
      if (pass === 2) g.setLineDash([5, 4]);
      g.stroke(); g.setLineDash([]);
    }
    // 当前位置
    var tcur = ST.tau, tp = N.turnPointMs(refJ, 1200);
    g.strokeStyle = "#e7edf5"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(X(tcur), M.t); g.lineTo(X(tcur), M.t + ph); g.stroke();
    g.fillStyle = "#e7edf5"; g.textAlign = "center"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
    g.fillText("τm=" + tcur + " ms", X(tcur), M.t - 6);
    g.strokeStyle = "#a98bf0"; g.setLineDash([3, 3]); g.lineWidth = 1.2;
    [1 / (2 * refJ) * 1000, tp].forEach(function (tm) {
      g.beginPath(); g.moveTo(X(tm), M.t); g.lineTo(X(tm), M.t + ph); g.stroke();
    });
    g.setLineDash([]);
    g.fillStyle = "#a98bf0"; g.textAlign = "left"; g.font = "11px " + getComputedStyle(document.body).fontFamily;
    g.fillText("1/(2J)=68.5", X(1 / (2 * refJ) * 1000) + 3, M.t + 11);
    g.fillText("含弛豫最优=" + fmt(tp, 1), X(tp) + 3, M.t + 25);
    // 图例
    var lg = [["交叉峰 J=7.3", "#5fd0a8"], ["对角峰 J=7.3", "#4d9de0"], ["交叉峰 J=5.2", "#f0a83c"]];
    lg.forEach(function (L, i) {
      g.fillStyle = L[1]; g.fillRect(M.l + pw + 10, M.t + 8 + i * 18, 14, 3);
      g.fillStyle = "#aeb9c7"; g.textAlign = "left"; g.font = "11.5px " + getComputedStyle(document.body).fontFamily;
      g.fillText(L[0], M.l + pw + 29, M.t + 13 + i * 18);
    });
    $("capTau").textContent = "示意：模型量（已按参考耦合的最优值归一化）。τm → 0 时交叉峰 → 0；" +
      "τm 太长时弛豫把两个峰一起压下去。注意 J 越大，最优 τm 越靠左。";
  }
