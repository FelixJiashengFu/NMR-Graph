/* ============================================================================
   COSY 教学页 · 交互与绘图
   数值内核见上方 #kernel 脚本块（纯函数，Node 侧可单独跑 __selftest）
   ========================================================================== */
(function () {
  "use strict";
  var N = window.NMR;
  // 拼 HTML 用的小工具：源码里不出现 "<" 加 "/"（否则 HTML 解析器会提前结束 script 块）

  /* ---------- 原图事实（逐像素从 原图-COSY幻灯片.webp 读出，见 README 与 _readimage.py） ---------- */
  var SRC = {
    img: "原图-COSY幻灯片.webp", size: [1488, 862],
    calib: { pxPerPpmX: 43.79, pxPerPpmY: 87.00, x0: 1009.0, ppmX0: 2.00, y0: 214.0, ppmY0: 2.00 },
    peaks: [
      { px: 1009.0, py: 223.0, f2: 2.00, f1: 2.10, kind: "diag" },
      { px: 887.5, py: 262.0, f2: 4.77, f1: 2.55, kind: "cross" },
      { px: 960.0, py: 262.0, f2: 3.12, f1: 2.55, kind: "cross" },
      { px: 887.5, py: 300.0, f2: 4.77, f1: 2.99, kind: "cross" },
      { px: 917.5, py: 300.0, f2: 4.09, f1: 2.99, kind: "cross" },
      { px: 961.5, py: 325.0, f2: 3.08, f1: 3.28, kind: "cross" },
      { px: 887.5, py: 325.5, f2: 4.77, f1: 3.28, kind: "cross" },
      { px: 918.0, py: 325.5, f2: 4.08, f1: 3.28, kind: "cross" }
    ],
    shifts: [2.00, 2.55, 3.12, 4.09, 4.77, 3.28],
    spot: { w: 16.62, h: 11.00, note: "8 个色块都是同一尺寸，尺寸不编码强度" },
    caption: "A liquid-state experiment identifying 1H-1H correlations between neighboring protons.",
    atoms: [
      { el: "C", x: 1201.8, y: 235.9 }, { el: "C", x: 1246.6, y: 235.8 },
      { el: "C", x: 1291.4, y: 235.7 }, { el: "C", x: 1335.4, y: 235.4 },
      { el: "O", x: 1247.5, y: 201.0 }, { el: "N", x: 1334.4, y: 278.5 },
      { el: "H", x: 1200.8, y: 202.4 }, { el: "H", x: 1165.5, y: 235.7 }, { el: "H", x: 1201.4, y: 267.0 },
      { el: "H", x: 1290.1, y: 202.5 }, { el: "H", x: 1290.8, y: 267.0 },
      { el: "H", x: 1334.4, y: 202.5 }, { el: "H", x: 1369.8, y: 235.4 },
      { el: "H", x: 1308.5, y: 304.1 }, { el: "H", x: 1357.9, y: 307.2 }
    ],
    colors: { C: "#5865EA", O: "#E4566D", N: "#EE59E7", H: "#EBE84E", peak: "#D77D7E" }
  };

  /* ---------- 术语表 ---------- */
  var TERMS = {
    "COSY": ["相关谱（Correlation Spectroscopy）", "同核二维实验：两个频率轴都是 ¹H，交叉峰表示两个质子之间存在标量耦合（J 耦合）。"],
    "相关谱": ["Correlation Spectroscopy (COSY)", "把「谁和谁耦合」画成一张二维图：横纵都是 ¹H 化学位移。"],
    "自旋体系": ["spin system", "一组通过标量耦合连在一起、能互相传递相干性的核。互相之间没有耦合的两组核属于不同自旋体系，COSY 里不会出现跨体系的交叉峰。"],
    "化学位移": ["chemical shift δ", "核在给定磁场下的共振频率相对参考物的偏移，单位 ppm。它决定峰在谱图的哪个位置，不决定峰有多少。"],
    "耦合常数": ["coupling constant J", "两个核之间标量耦合的强度，单位 Hz。它决定多重峰的裂分间距，也决定交叉峰随 τm 涨落的快慢。"],
    "混合时间": ["mixing time τm", "COSY 脉冲序列里两个 90° 脉冲之间的等待时间。它决定反相相干建立多少，也决定弛豫损失掉多少。"],
    "弛豫": ["relaxation", "自旋回到热平衡的过程，特征时间 T₁（纵向）、T₂（横向）。τm 越长，信号被弛豫吃掉越多。"],
    "对角峰": ["diagonal peak", "出现在 (δA, δA) 的峰，代表质子 A 自己。n 个不同位移就有 n 个对角峰。"],
    "交叉峰": ["cross peak", "出现在 (δA, δB) 的峰，表示 A 与 B 有标量耦合。它和关于对角线的镜像峰成对出现。"],
    "邻碳耦合": ["vicinal coupling ³J", "隔着三个化学键（H–C–C–H）的耦合，通常 5–8 Hz，是 COSY 最容易看见的。"],
    "同碳耦合": ["geminal coupling ²J", "同一个碳上两个氢之间的耦合，通常 −10…−18 Hz。化学等价的氢之间不产生可观测裂分。"],
    "远程耦合": ["long-range coupling ⁴J/⁵J", "隔四个以上化学键的耦合，通常 < 1–2 Hz，在常规 COSY 里基本看不见。"],
    "磁等价": ["magnetically equivalent", "化学位移相同且对其它核的耦合也相同的一组核，例如 –CH₃ 的三个氢。它们相互之间不产生裂分。"],
    "化学等价": ["chemically equivalent", "通过对称操作可以互换的核。化学等价不一定磁等价。"],
    "多重峰": ["multiplet", "一个化学位移处因为与邻近核耦合而裂分成多条线。n 个等价邻近氢给 n+1 条线。"],
    "三重峰": ["triplet", "被两个等价氢裂分成 3 条线，强度比 1:2:1。"],
    "四重峰": ["quartet", "被三个等价氢裂分成 4 条线，强度比 1:3:3:1。"],
    "活泼氢": ["exchangeable proton", "–OH、–NH 上的氢。它和溶剂/水里的氢交换，交换够快时与碳上氢的耦合被平均掉，交叉峰消失。"],
    "反相": ["antiphase", "同一个多重峰里相邻两条线符号相反。COSY 的交叉峰在 F1、F2 两个方向都是反相的，磁量模式下才显示成同号的斑块。"],
    "相敏": ["phase-sensitive", "保留信号正负的显示方式。反相信号在相敏模式下会看到正负交替的轮廓。"],
    "磁量模式": ["magnitude mode", "取复数信号的模来显示，丢掉正负号，只留强度。多数 COSY 谱用这种方式画。"],
    "投影": ["projection", "把 2D 谱沿一个轴求和得到的一维谱，通常贴在 2D 图的上方或右侧当坐标参考。"],
    "TOCSY": ["全相关谱（Total Correlation Spectroscopy）", "各向同性混合：同一个自旋体系内所有核都能互相传递，能给出隔着好几个键的相关峰。"],
    "各向同性混合": ["isotropic mixing", "TOCSY 用的混合方式，哈密顿量是 IxIx+IyIy+IzIz 之和，转移效率按 sin²(πJτ) 涨落。"],
    "弛豫时间": ["T₁ / T₂", "纵向弛豫时间 T₁ 管磁化恢复，横向弛豫时间 T₂ 管信号衰减。谱线宽度 ≈ 1/(πT₂)。"],
    "ppm": ["parts per million", "化学位移的单位。1 ppm = 谱仪频率 / 10⁶ Hz，所以同一 δ 差值在不同频率下对应的 Hz 数不同。"],
    "交换展宽": ["exchange broadening", "某个核在不同化学环境之间来回跳，跳得越快，它的谱线越宽、越矮，最后并成一个宽包。"],
    "位点": ["site", "本页把化学等价的氢并成一组，叫一个「位点」。一个位点的 2D 谱上只有一个对角峰。"],
    "转移矩阵": ["transfer matrix", "本页的模型量，元素 (j,k) = 质子 k 的磁化转移到质子 j 后、归一化后的可见幅度。"],
    "自检": ["self test", "页面里跑的一组可证否判据：平凡情形、边界极值、不变量、两套实现互拍。"],
    "核磁共振": ["NMR", "利用核自旋在磁场中的能级分裂来测结构的方法。"],
    "氢谱": ["¹H NMR", "观测质子的一维核磁共振谱。"],
    "极性": ["polarity", "分子内电荷分布不均的程度。它影响化学位移，不影响「谁和谁耦合」这个拓扑。"],
    "弛豫损失": ["relaxation loss", "τm 期间横向磁化按 e^(−2τm/T₂) 衰减，所以 τm 不能一味加长。"],
    "位阻": ["steric hindrance", "空间拥挤效应。它主要通过改变二面角来改变 ³J 的大小，不改变耦合的连通性。"],
    "二面角": ["dihedral angle φ", "Karplus 关系：³J 随 H–C–C–H 二面角变化，0° 与 180° 附近最大、90° 附近最小。"],
    "标量耦合": ["scalar coupling / J coupling", "两个核通过成键电子传递的相互作用，与空间距离无关，只与键的连通性和二面角有关。"],
    "阈值": ["threshold", "本页的显示参数：模型幅度低于它的峰不画出来，模拟「低于噪声看不见」。这是演示参数，不是实验噪声。"],
    "Bloch–McConnell": ["Bloch–McConnell 方程", "描述两个位置之间化学交换如何改变磁化演化的方程。本页用它算 –OH 交换对交叉峰的影响。"]
  };

  /* ---------- 状态 ---------- */
  var ST = {
    step: 0, sel: { type: "site", i: 1 }, tau: 68, th: 0.08, ex: 0, exOn: false,
    fieldIdx: 2, includeOH: true, degenerate: false, system: "propanol",
    answerOpen: false, hoverPk: -1
  };
  var FIELDS = [200, 300, 400, 600, 900];
  var TAUS = [5, 20, 34, 68, 120];

  function st() {   // 每帧现算，不留缓存键 —— 缓存是这类页面最容易静默出错的来源
    return { tau: ST.tau, threshold: ST.th, exchange: ST.ex, exchangeOn: ST.exOn,
             field: FIELDS[ST.fieldIdx], T2: 1200, includeOH: ST.includeOH,
             degenerate: ST.degenerate, system: ST.system };
  }
  var E = String.fromCharCode(60, 47);   // 60 与 47 就是小于号与斜杠
  var $ = function (id) { return document.getElementById(id); };
  function fmt(x, n) { return (Math.round(x * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n); }

  /* ---------- 步骤引导 ---------- */
  var STEPS = [
    { t: "认对象", q: "这张图里有几个「不同的氢」？",
      do_: "点中栏结构式上的圆球，或按 1–4。先在右栏把每个位点的氢数、位移认全。",
      a: ["四个位点：–OH（1H）、C1–H₂（2H）、C2–H₂（2H）、C3–H₃（3H）。",
          "化学等价的氢（比如 –CH₃ 的三个）在 2D 谱上只占一个位置，所以是「四个位点」而不是「八个氢」。"],
      set: { system: "propanol", includeOH: true, tau: 68, degenerate: false, ex: 0, exOn: false, sel: { type: "site", i: 1 } } },
    { t: "数关系", q: "谁会跟谁出现交叉峰？",
      do_: "看中栏结构式上的三条弧线：³J = 5.2 / 6.6 / 7.3 Hz。",
      a: ["耦合是一条链：–OH ↔ C1 ↔ C2 ↔ C3。链上相邻的一对给一对交叉峰，链上不相邻的（–OH 与 C3）没有。",
          "所以交叉峰对数是 3，不是 C(4,2)=6。"],
      set: { system: "propanol", includeOH: true, tau: 68 } },
    { t: "参数太小", q: "把 τm 拖到很小时，谱上还剩什么？",
      do_: "把中栏 τm 滑块拖到 5 ms 附近（或按 ↓ 键连按）。",
      a: ["交叉峰几乎全没了，只剩对角峰。",
          "因为反相相干按 sin(πJτm) 建立：τm 小的时候 sin(πJτm) ≈ πJτm 也很小。"],
      set: { tau: 5 } },
    { t: "参数够了", q: "τm 拖到哪里，交叉峰最亮？",
      do_: "点左栏「跳到最优 τm」，或者自己把滑块拖到 60–70 ms。",
      a: ["J = 7.3 Hz 时最亮点在 τm = 1/(2J) = 68.5 ms（模型里考虑弛豫后是 65.3 ms）。",
          "同时对角峰几乎消失——磁化几乎全转走了，这才是「完全转移」的样子。"],
      set: { tau: 68, includeOH: true } },
    { t: "岔路口", q: "哪个参数会真的改变峰的有无？",
      do_: "把 –OH 交换速率从 0 慢慢拖到 200 s⁻¹。",
      a: ["–OH 的交叉峰先变小、再消失，交叉峰对数从 3 掉到 2；对角峰也一起变矮变宽。",
          "判据是模型幅度 < 阈值（默认 0.08）。纯几何的推论（谁和谁耦合）没有变，变的是「还能不能看见」。"],
      set: { exOn: true, ex: 120, tau: 68 } },
    { t: "对比 TOCSY", q: "把同一件事交给 TOCSY，会多出什么？",
      do_: "看下方「推导与数值核对」里的对照表；再把阈值拖到 0.02 看 –OH 与 C3 那对「不该有」的格。",
      a: ["COSY 只连相邻（³J 为主），相关峰沿链只走一步；TOCSY 的各向同性混合沿整个自旋体系传递，会多出 –OH↔C3 这种「隔一站」的峰。",
          "两者对 τm 的依赖也不同：COSY 是 sin(πJτ)，TOCSY 是 sin²(πJτ)，但都在 2Jτ = 1 时达到完全转移。"],
      set: { tau: 68, system: "propanol", includeOH: true } },
    { t: "无关因素", q: "哪个因素算到最后其实不影响结论？",
      do_: "把谱仪频率 200↔900 MHz 来回切，再点「把 –OH 的位移挪到 C1 上」。",
      a: ["频率只改变交换展宽的绝对大小（Δν 随 ν₀ 线性变），不改变「谁和谁耦合」的连通性：耦合网络是拓扑，与磁场无关。",
          "位移重合会改变「能数出几个峰」——两个位点撞在一起，峰数从 10 格掉到 7 格，这是信息不可恢复的丢失；而耦合常数取 5.2 还是 7.3 Hz，只改变最优 τm 的位置，不改变峰的个数。"],
      set: { tau: 68 } }
  ];

  function applyStep(i) {
    var s = STEPS[i]; if (!s) return;
    var wasDeg = ST.degenerate, wasSys = ST.system;
    if (s.set) {
      var stt = s.set;
      if (stt.system !== undefined) ST.system = stt.system;
      if (stt.includeOH !== undefined) ST.includeOH = stt.includeOH;
      if (stt.tau !== undefined) ST.tau = stt.tau;
      if (stt.degenerate !== undefined) ST.degenerate = stt.degenerate;
      if (stt.ex !== undefined) { ST.ex = stt.ex; ST.exOn = stt.ex > 0; }
      if (stt.exOn !== undefined) ST.exOn = stt.exOn;
      if (stt.sel) ST.sel = stt.sel;
    }
    ST.step = i; ST.answerOpen = false;
    syncInputs();
    renderAll();
  }

  function syncInputs() {
    $("tau").value = ST.tau; $("th").value = ST.th; $("ex").value = ST.ex; $("fd").value = ST.fieldIdx;
    $("ohOn").checked = ST.includeOH; $("degOn").checked = ST.degenerate;
    $("tauVal").textContent = ST.tau + " ms";
    $("thVal").textContent = fmt(ST.th, 3);
    $("exVal").textContent = ST.exOn ? (ST.ex + " s⁻¹") : "关";
    $("fdVal").textContent = FIELDS[ST.fieldIdx] + " MHz";
    ["sysSeg"].forEach(function (id) { });
    var seg = $("sysSeg").children;
    for (var i = 0; i < seg.length; i++) seg[i].setAttribute("aria-pressed", String(seg[i].dataset.sys === ST.system));
  }

  function renderStep() {
    var s = STEPS[ST.step], h = "";
    h += '<div class="steps">';
    for (var i = 0; i < STEPS.length; i++)
      h += '<button data-step="' + i + '" aria-pressed="' + (i === ST.step) + '">' + (i + 1) + E + 'button>';
    h += E + 'div>';
    h += '<div class="ghead"><b>第 ' + (ST.step + 1) + "/" + STEPS.length + " 步 · " + s.t + E + 'b>' +
         '<span><button id="prevStep">← 上一步' + E + 'button> <button id="nextStep">下一步 →' + E + 'button>' + E + 'span>' + E + 'div>';
    h += '<div class="gq">' + s.q + E + 'div>';
    h += '<div class="gdo">操作：' + s.do_ + E + 'div>';
    h += '<button id="showAns" style="margin-top:6px">' + (ST.answerOpen ? "收起答案" : "看答案") + E + 'button>';
    h += '<div class="gans' + (ST.answerOpen ? " on" : "") + '">';
    s.a.forEach(function (p) { h += "<p>" + termify(p) + E + 'p>'; });
    h += E + 'div>';
    $("guide").innerHTML = h;
    $("guide").querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () { applyStep(+b.dataset.step); });
    });
    $("prevStep").addEventListener("click", function () { applyStep((ST.step + STEPS.length - 1) % STEPS.length); });
    $("nextStep").addEventListener("click", function () { applyStep((ST.step + 1) % STEPS.length); });
    $("showAns").addEventListener("click", function () { ST.answerOpen = !ST.answerOpen; renderStep(); });
  }
