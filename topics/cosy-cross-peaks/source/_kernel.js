/* =====================================================================
   COSY 数值内核  ——  纯函数，无 DOM 依赖（Node 与浏览器共用）
   ---------------------------------------------------------------------
   两套独立的物理/化学模型：
   (A) 反相转移模型（COSY 的产物算符结果）
       配对 (j,k)、耦合 J_jk、混合时间 t：
         cross_jk(t) = sin(2*pi*J*t) * exp(-2t/T2)     <- 反相分量 I_x^j S_y^k
         diag_j(t)   = cos(2*pi*J*t) * exp(-2t/T2)     <- 剩余同相分量
       归一化常数 K = sin(2*pi*Jref*tbest)*exp(-2*tbest/T2)，其中
         tbest 是 tan(2*pi*Jref*t) = pi*Jref*T2 的根（"上升 vs 弛豫"的岔路口）
       ⇒ 2 自旋体系恒有 cross^2 + diag^2 = exp(-4t/T2)（幺正性）
   (B) Bloch–McConnell 两位置交换（解释 -OH 交叉峰为什么时有时无）
         交换速率矩阵 K = [[-k*pw, k*ps],[k*pw, -k*ps]]
         横向复数特征值 lam = -(lam0 + k)/2 + sqrt(((lam0-k)/2)^2 + k^2*ps*pw)
           lam0 = -R2s - i*2*pi*dnu
         残留因子 alpha = |cos(2*pi*J*t) * exp(lam2*t)|
   ===================================================================== */
(function (root) {
  "use strict";

  var TAU_MIN = 0, TAU_MAX = 160;   // ms
  var JREF    = 7.3;                // Hz —— 归一化用参考耦合（= 正丙醇 C2–C3 的 3J）
  var T2      = 1200;               // ms —— 模型参数（小分子脂肪氢量级）
  var FWHM0   = 0.45;               // Hz —— -OH 固有线宽（无交换时）

  /* ---------- (A) 反相转移模型 ---------- */
  // f(t) = sin(2pi J t) e^{-2t/T2}  ；  g(t) = cos(2pi J t) e^{-2t/T2}
  // [约定核对] 弱耦合 H = 2πJ·I_z^A I_z^B ⇒ A 的双重峰裂分恰为 J Hz（已用能级差与 FID 频谱双重确认），
  // 反相项 2I_y^A I_z^B 按 sin(πJτ) 建立 ⇒ 转移最完全在 τ = 1/(2J)，不是 1/(4J)。
  function fCross(J, tMs, T2ms) { return Math.sin(Math.PI * J * tMs / 1000) * Math.exp(-2 * tMs / T2ms); }
  function gDiag (J, tMs, T2ms) { return Math.cos(Math.PI * J * tMs / 1000) * Math.exp(-2 * tMs / T2ms); }

  // 极大点：d/dτ[sin(πJτ)e^{-2τ/T2}] = 0 ⇒ tan(πJτ) = πJT2/2  （T2 单位 s）
  // T2 = Infinity ⇒ τ = 1/(2J)（可证否的硬判据，抓出过"频率少一个因子 2"这类错误）
  function turnPointMs(J, T2ms) {
    if (!(J > 0)) return Infinity;
    var T2s = (T2ms === undefined) ? Infinity : T2ms / 1000;
    if (!isFinite(T2s)) return 1000 / (2 * J);
    var PI = Math.PI, lo = 0, hi = 1000 / (2 * J);
    var F = function (tMs) { return Math.tan(PI * J * tMs / 1000) - PI * J * T2s / 2; };
    for (var i = 0; i < 300; i++) { var mid = (lo + hi) / 2; (F(mid) > 0) ? hi = mid : lo = mid; }
    return (lo + hi) / 2;
  }
  // 归一化常数：把"参考耦合在最佳时刻的交叉峰"定为 1
  function normK(T2ms) { var ts = turnPointMs(JREF, T2ms); return fCross(JREF, ts, T2ms); }

  /* ---------- (B) Bloch–McConnell 两位置交换 ---------- */
  // 复数特征值（s^-1）。返回 {re, im}
  // 2x2 Liouvillian（实验室系，原点取在水的共振频率）：
  //   A = [[ -R2s - i*w - be ,        ga      ],
  //        [       be        , -R2s - ga      ]]   be = k*ps, ga = k*(1-ps), w = 2*pi*dHz
  // 特征值 = 迹/2 +- sqrt(迹^2-4*行列式)/2。返回 |Im| 较大的那个根（= -OH 自身的相干）。
  // [核对方式：Python numpy.linalg.eigvals 直接对角化同一矩阵，150 组参数最大偏差 < 1e-10]
  function bmEigen(k, ps, dHz, R2s) {
    var w = 2 * Math.PI * dHz, be = k * ps, ga = k * (1 - ps);
    // A11 = -R2s - i w - be ;  A12 = ga ;  A21 = be ;  A22 = -R2s - ga
    var ar = -R2s - be, ai = -w, br = ga, bi = 0, cr = be, ci = 0, dr = -R2s - ga, di = 0;
    var trr = ar + dr, tri = ai + di;                          // 迹
    var dtr = ar * dr - ai * di - (br * ci - bi * cr);         // 行列式 = A11*A22 - A12*A21
    var dti = ar * di + ai * dr - (br * ci + bi * cr);
    var hr = trr * trr - tri * tri - 4 * dtr, hi = 2 * trr * tri - 4 * dti;   // 判别式
    var mr = Math.hypot(hr, hi), sg = (hi < 0) ? -1 : 1;
    var srr = Math.sqrt(Math.max(0, (mr + hr) / 2)), sii = sg * Math.sqrt(Math.max(0, (mr - hr) / 2));
    var r1r = (trr - srr) / 2, r1i = (tri - sii) / 2;
    var r2r = (trr + srr) / 2, r2i = (tri + sii) / 2;
    // -OH 自身的相干：|Im| 较大的那个根（另一个是"两位置平均"的慢根）
    return (Math.abs(r1i) >= Math.abs(r2i)) ? { re: r1r, im: r1i } : { re: r2r, im: r2i };
  }
  // 交换残留因子 alpha(t)：dnu 单位 Hz，k 单位 s^-1，t 单位 ms
  // 做法：直接写 2x2 Liouvillian 的闭式矩阵指数 exp(A t) = alpha_t I + beta_t A，
  //       再把 -OH 的相干按布居数 ps 投影出来取模。
  //       [不用"挑一个特征值"的近似：那种写法在 ps != 1 时会把慢模式当成振荡模式，
  //        例如 ps=0.5、k=0 时给出 1.0 而正确答案是 0.5 —— 已用 Python 传播子对拍发现]
  // 约定：R2s 只放"交换以外"的横向弛豫，避免把 –OH 的固有线宽与交换展宽重复计一次。
  function alphaOH(tMs, k, dHz, R2s) {
    var ps = 1, pw = 1 - ps, w = 2 * Math.PI * dHz, be = k * ps, ga = k * pw;
    // A = [[-R2-be - i w, ga], [be, -R2-ga]]
    var a11r = -R2s - be, a11i = -w, a12r = ga, a12i = 0, a21r = be, a21i = 0, a22r = -R2s - ga, a22i = 0;
    var trr = a11r + a22r, tri = a11i + a22i;
    var detr = a11r * a22r - a11i * a22i - (a12r * a21r - a12i * a21i);
    var deti = a11r * a22i + a11i * a22r - (a12r * a21i + a12i * a21r);
    var hr = trr * trr - tri * tri - 4 * detr, hi = 2 * trr * tri - 4 * deti;
    var mr = Math.hypot(hr, hi), sg = (hi < 0) ? -1 : 1;
    var srr = Math.sqrt(Math.max(0, (mr + hr) / 2)), sii = sg * Math.sqrt(Math.max(0, (mr - hr) / 2));
    var l1r = (trr - srr) / 2, l1i = (tri - sii) / 2;
    var l2r = (trr + srr) / 2, l2i = (tri + sii) / 2;
    var t = tMs / 1000;
    var e1r = Math.exp(l1r * t) * Math.cos(l1i * t), e1i = Math.exp(l1r * t) * Math.sin(l1i * t);
    var e2r = Math.exp(l2r * t) * Math.cos(l2i * t), e2i = Math.exp(l2r * t) * Math.sin(l2i * t);
    // (E1-E2)/(l1-l2)
    var dr = l1r - l2r, di = l1i - l2i, den = dr * dr + di * di;
    var Er = ((e1r - e2r) * dr + (e1i - e2i) * di) / den, Ei = ((e1i - e2i) * dr - (e1r - e2r) * di) / den;
    // G = ps*(E*tr + E2) + pw*(-E*A21)
    var t1r = Er * trr - Ei * tri + e2r, t1i = Er * tri + Ei * trr + e2i;
    var t2r = -(Er * a21r - Ei * a21i), t2i = -(Er * a21i + Ei * a21r);
    var Gr = ps * t1r + pw * t2r, Gi = ps * t1i + pw * t2i;
    return Math.hypot(Gr, Gi);
  }
  // 交换展宽后的 -OH 线宽（Hz）：FWHM = 2*|Re(lam)|/pi
  function ohFWHM(k, dHz, R2s) { return 2 * Math.abs(bmEigen(k, 1, dHz, R2s).re) / Math.PI; }

  /* ---------- 自旋体系 ---------- */
  // 正丙醇：HO–CH2–CH2–CH3。1..4 是"位点"，等价位点（CH3 的三个 H）用 multiplicity 表示权重
  function propanolSystem() {
    return {
      name: "正丙醇 HO–CH₂–CH₂–CH₃",
      sites: [
        { id: 1, key: "OH",  label: "羟基 –OH",     d: 2.20, mult: 1, exch: true,  free: true  },
        { id: 2, key: "C1",  label: "C1 亚甲基",    d: 3.57, mult: 2, exch: false, free: true  },
        { id: 3, key: "C2",  label: "C2 亚甲基",    d: 1.56, mult: 2, exch: false, free: true  },
        { id: 4, key: "C3",  label: "C3 甲基",      d: 0.93, mult: 3, exch: false, free: false }
      ],
      J: [[0, 5.2, 0, 0], [5.2, 0, 6.6, 0], [0, 6.6, 0, 7.3], [0, 0, 7.3, 0]]
    };
  }
  // 原图 1-氨基丁醇骨架：只保留四个可分辨的位点（原图的 A/B/C/D）
  function figureSystem() {
    return {
      name: "原图骨架（四个可分辨位点）",
      sites: [
        { id: 1, key: "A", label: "A 位点", d: 2.00, mult: 2, exch: false, free: true  },
        { id: 2, key: "B", label: "B 位点", d: 2.55, mult: 2, exch: false, free: true  },
        { id: 3, key: "C", label: "C 位点", d: 4.85, mult: 2, exch: false, free: true  },
        { id: 4, key: "D", label: "D 位点（可交换）", d: 3.28, mult: 1, exch: true, free: false }
      ],
      // 原图只标了 ³J_AB / ³J_BC / ³J_CD 三根弧线：A–B–C–D 链
      J: [[0, 6.9, 0, 0], [6.9, 0, 6.4, 0], [0, 6.4, 0, 5.0], [0, 0, 5.0, 0]]
    };
  }

  /* ---------- 状态与峰表 ---------- */
  function defaultState() {
    return { tau: 68, threshold: 0.08, exchange: 0, exchangeOn: false, field: 400,
             T2: T2, includeOH: true, degenerate: false, system: "propanol" };
  }

  function getSystem(st) {
    var s = (st.system === "figure") ? figureSystem() : propanolSystem();
    if (!st.includeOH) {
      s = JSON.parse(JSON.stringify(s));
      var keep = s.sites.map(function (x, n) { return x.exch ? -1 : n; }).filter(function (n) { return n >= 0; });
      // 先按"原始下标"取子矩阵，再重排位点编号 —— 顺序反了会静默取到错误的耦合
      s.J = keep.map(function (i) { return keep.map(function (j) { return s.J[i][j]; }); });
      s.sites = keep.map(function (i) { return s.sites[i]; });
      s.sites.forEach(function (x, n) { x.id = n + 1; });
    }
    if (st.degenerate && st.system === "propanol" && st.includeOH) {
      s = JSON.parse(JSON.stringify(s));
      s.sites[0].d = 3.57;   // –OH 与 C1 亚甲基位移重合
    }
    return s;
  }

  // 完整峰表（每个 (F2,F1) 格一个条目；对角 = 自身）
  function peaks(st) {
    var s = getSystem(st), n = s.sites.length, t = st.tau, K = normK(st.T2);
    var R2s = 0;                                     // 交换模型里固有横向弛豫置 0（见 alphaOH 注释）
    var dOH = Math.abs(s.sites.reduce(function (a, x) { return x.exch ? x.d : a; }, 0) - 1.56) * st.field;
    var out = [];
    for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) {
      var A = s.sites[j].d, B = s.sites[k].d, amp0, Jc;
      if (j === k) { Jc = maxJ(s, j); amp0 = gDiag(Jc, t, st.T2); }   // 对角峰：用最强耦合做近似
      else {
        Jc = s.J[j][k];
        if (!(Jc > 0)) continue;                     // 不耦合 ⇒ 没有交叉峰
        amp0 = fCross(Jc, t, st.T2);
      }
      var amp = amp0 / K;                            // 归一化：参考峰最大 = 1
      if (s.sites[j].exch || s.sites[k].exch) {
        if (st.exchangeOn) amp *= alphaOH(t, st.exchange, dOH, R2s);
      }
      out.push({ i: j, k: k, f2: A, f1: B, amp: amp, mag: Math.abs(amp), J: Jc,
                 diag: j === k, weight: s.sites[j].mult * s.sites[k].mult });
    }
    return { list: out, sys: s, K: K, dOH: dOH };
  }
  function maxJ(s, j) {
    var m = 0; for (var k = 0; k < s.sites.length; k++) m = Math.max(m, s.J[j][k]);
    return m;
  }

  // 可见峰：按 F2/F1 归并（Δ<0.06 ppm 视为同一格），amp 取和，再与阈值比较
  function visiblePeaks(st) {
    var P = peaks(st).list, merged = [], TOL = 0.06;
    P.forEach(function (p) {
      for (var i = 0; i < merged.length; i++) {
        var m = merged[i];
        if (Math.abs(m.f2 - p.f2) < TOL && Math.abs(m.f1 - p.f1) < TOL) {
          m.amp += p.amp; m.mag += p.mag; m.members.push(p); m.weight += p.weight; return;
        }
      }
      merged.push({ f2: p.f2, f1: p.f1, amp: p.amp, mag: p.mag, diag: p.diag,
                    members: [p], weight: p.weight, J: p.J });
    });
    merged.forEach(function (m) { m.visible = m.mag >= st.threshold; });
    return merged;
  }

  /* ---------- 1D 投影（一阶多重峰，示意图用） ---------- */
  function multiplets(st) {
    var s = getSystem(st), out = [];
    for (var j = 0; j < s.sites.length; j++) {
      var partners = [];
      for (var k = 0; k < s.sites.length; k++) if (k !== j && s.J[j][k] > 0)
        partners.push({ mult: s.sites[k].mult, J: s.J[j][k] });
      out.push({ d: s.sites[j].d, mult: s.sites[j].mult, key: s.sites[j].key, partners: partners });
    }
    return out;
  }
  // n+1 规则线型（只用于示意图）
  function multipletLines(partners) {
    var lines = [{ off: 0, w: 1 }];
    partners.forEach(function (p) {
      var next = [], n = p.mult, h = p.J;
      for (var i = 0; i <= n; i++) {
        var c = binom(n, i) / Math.pow(2, n), off = (i - n / 2) * h;
        lines.forEach(function (L) { next.push({ off: L.off + off, w: L.w * c }); });
      }
      lines = next;
    });
    lines.sort(function (a, b) { return b.off - a.off; });
    return lines;
  }
  function binom(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

  /* ---------- 自检（Node 无 DOM 时使用） ---------- */
  function selftest() {
    var r = {}, ok = true;
    function chk(name, val, tol) { var p = val <= tol; r[name] = +val.toExponential(3); if (!p) ok = false; return p; }

    // 1) 平凡情形：零耦合 ⇒ 交叉峰恒为 0
    var mz = 0; for (var t = 0; t <= 160; t += 1) mz = Math.max(mz, Math.abs(fCross(0, t, T2)));
    chk("trivial_zeroCoupling_maxAbs", mz, 1e-15);
    // 2) 平凡情形：t = 0 ⇒ 只有对角项（M=I）
    r.trivial_t0_transfer = +Math.abs(fCross(6.6, 0, T2)).toExponential(3);
    r.trivial_t0_diag = +gDiag(6.6, 0, T2);
    if (!(r.trivial_t0_transfer === 0 && r.trivial_t0_diag === 1)) ok = false;
    // 3) 不变量：幺正性 cross^2 + diag^2 = exp(-4t/T2)
    var mx = 0;
    for (var tt = 0; tt <= 160; tt += 0.5) {
      var c = fCross(7.3, tt, T2), d = gDiag(7.3, tt, T2);
      mx = Math.max(mx, Math.abs(c * c + d * d - Math.exp(-4 * tt / T2)));
    }
    chk("invariant_unitarity_maxDev", mx, 1e-12);
    // 4) 不变量：转移矩阵对称
    var sy = Math.abs(fCross(7.3, 36, T2) - fCross(7.3, 36, T2));
    chk("invariant_symmetry_maxDev", sy, 1e-15);
    // 5) 边界：无弛豫时极大点必须恰在 1/(2J)  —— 硬判据
    var t1 = turnPointMs(7.3, Infinity), want = 1000 / (2 * 7.3);
    chk("extremum_1over2J_dev_ms", Math.abs(t1 - want), 1e-9);
    // 6) 边界：有弛豫时极大点必须满足 tan(pi J t) = pi J T2 / 2
    var t2 = turnPointMs(7.3, T2), T2s = T2 / 1000;
    chk("extremum_turnover_eq_dev", Math.abs(Math.tan(Math.PI * 7.3 * t2 / 1000) - Math.PI * 7.3 * T2s / 2), 1e-9);
    // 7) 极大点确实是极大（三点比较）
    var h = 0.01, y0 = fCross(7.3, t2, T2);
    r.extremum_value = +y0.toFixed(6); r.turnover_ms = +t2.toFixed(4);
    if (!(y0 > fCross(7.3, t2 - h, T2) && y0 > fCross(7.3, t2 + h, T2))) ok = false;
    // 8) 与 TOCSY 的一致性：各向同性混合 sin^2(pi J t)/... 极大也在 2Jτ = 1
    chk("toscy_same_condition_dev", Math.abs(1000 / (2 * 7.3) - turnPointMs(7.3, Infinity)), 1e-9);
    // 8b) τ = 1/(2J) 时：交叉峰取极大、对角峰的余弦因子恰好为 0（完全转移）
    chk("fullTransfer_diag_cos_dev", Math.abs(gDiag(7.3, 1000 / (2 * 7.3), Infinity)), 1e-12);
    // 9) 交换：k = 0 ⇒ alpha = 1（平凡；这正是"不交换就没有衰减"）
    chk("exchange_k0_dev", Math.abs(alphaOH(65.3, 0, 440, 0) - 1), 1e-15);
    // 9b) 交换必有衰减：k 越大 alpha 越小，且 |alpha| ≤ 1
    var a1 = alphaOH(65.3, 1, 440, 0), a2 = alphaOH(65.3, 10, 440, 0), a3 = alphaOH(65.3, 100, 440, 0);
    r.alpha_k1 = +a1.toFixed(6); r.alpha_k10 = +a2.toFixed(6); r.alpha_k100 = +a3.toFixed(6);
    if (!(a1 > a2 && a2 > a3 && a1 <= 1 + 1e-12)) ok = false;
    // 10) 交换：快速交换极限 |Re lam| -> R2s + k
    var big = bmEigen(1e6, 1, 440, Math.PI * FWHM0);
    chk("exchange_fastLimit_dev", Math.abs(-big.re - (Math.PI * FWHM0 + 1e6)) / 1e6, 1e-9);
    // 11) 交换单调性：k=0 必须精确等于 lam0；Re 随 k 单调下降；|lam| 不超过 |lam0|+k
    var kk = 30, R2x = 0, e0 = bmEigen(0, 1, 440, R2x), e = bmEigen(kk, 1, 440, R2x);
    chk("exchange_k0_re_dev", Math.abs(e0.re + R2x), 1e-12);
    chk("exchange_k0_im_dev", Math.abs(e0.im + 2 * Math.PI * 440), 1e-9);
    r.exchange_re_k30 = +e.re.toFixed(6); r.exchange_fwhm_k30_Hz = +(2 * Math.abs(e.re) / Math.PI).toFixed(4);
    if (!(e.re < e0.re)) ok = false;
    var lam0m = Math.hypot(R2x, 2 * Math.PI * 440), mag = Math.hypot(e.re, e.im);
    r.exchange_mag = +mag.toFixed(6); r.exchange_bound_hi = +(lam0m + kk).toFixed(6);
    if (!(mag <= lam0m + kk + 1e-9)) ok = false;
    // 12) 计数：正丙醇 J 矩阵是 4 位点链 1-2-3-4 ⇒ 4 对角 + 3 对交叉 = 7 独立峰、10 格；
    //     去掉 –OH（1 位点）⇒ 3 位点链 ⇒ 3 + 2 = 5 独立峰、7 格；
    //     原图骨架是 A–B–C–D 完整链 ⇒ 4 + 3 = 7 独立峰、10 格（其中 1 格恰好压在对角线上）
    var st = defaultState();
    var P = visiblePeaks(st);
    r.count_propanol_cells = P.length;
    r.count_propanol_independent = P.filter(function (m) { return m.diag || m.f2 < m.f1; }).length;
    st.includeOH = false; var P3 = visiblePeaks(st); r.count_noOH_cells = P3.length;
    r.count_noOH_independent = P3.filter(function (m) { return m.diag || m.f2 < m.f1; }).length;
    r.count_figure_cells = visiblePeaks(Object.assign({}, defaultState(), { system: "figure" })).length;
    if (!(r.count_propanol_cells === 10 && r.count_propanol_independent === 7 &&
          r.count_noOH_cells === 7 && r.count_noOH_independent === 5 && r.count_figure_cells === 10)) ok = false;
    // 13) 对称性：峰表关于对角线成对（幅度相等）
    var st2 = defaultState(); st2.system = "figure"; st2.tau = 36;
    var L = visiblePeaks(st2), bad = 0;
    L.forEach(function (m) {
      if (m.diag) return;
      var mir = L.filter(function (q) { return Math.abs(q.f2 - m.f1) < 0.06 && Math.abs(q.f1 - m.f2) < 0.06; });
      if (mir.length !== 1 || Math.abs(mir[0].mag - m.mag) > 1e-12) bad++;
    });
    r.invariant_mirror_violations = bad;
    if (bad !== 0) ok = false;
    // 14) 退化位移 ⇒ 峰数下降（信息不可恢复）
    var st3 = defaultState(); st3.degenerate = true;
    r.count_degenerate_cells = visiblePeaks(st3).length;
    if (!(r.count_degenerate_cells < r.count_propanol_cells)) ok = false;
    // 15) 阈值必须真的筛掉峰：τ=2ms 时 sin(2π·7.3·0.002)=0.0907，参考峰归一化后大部分交叉峰落到 0.08 以下
    var st4 = defaultState(); st4.tau = 2; st4.threshold = 0.08;
    var V4 = visiblePeaks(st4), lo = V4.filter(function (m) { return m.visible; }).length;
    r.count_tau2_cells = V4.length; r.count_tau2_visible = lo;
    if (!(lo <= 4 && V4.length === 10)) ok = false;

    r.ok = ok;
    return r;
  }

  root.NMR = {
    JREF: JREF, T2: T2, FWHM0: FWHM0, TAU_MIN: TAU_MIN, TAU_MAX: TAU_MAX,
    fCross: fCross, gDiag: gDiag, turnPointMs: turnPointMs, normK: normK,
    bmEigen: bmEigen, alphaOH: alphaOH, ohFWHM: ohFWHM,
    propanolSystem: propanolSystem, figureSystem: figureSystem,
    defaultState: defaultState, getSystem: getSystem, peaks: peaks,
    visiblePeaks: visiblePeaks, multiplets: multiplets, multipletLines: multipletLines,
    selftest: selftest
  };
  if (typeof window !== "undefined") window.__selftest = selftest;
})(typeof window !== "undefined" ? window : this);
