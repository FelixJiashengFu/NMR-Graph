
    /* ---------- ⑥ 来源与限制 + 页面自检 ---------- */
    h += '<details class="sec" id="dLimit"><summary>⑥ 来源与限制 + 页面自检 <span class="small muted">点开跑一次自检' + E + 'summary><div>';
    h += '<h4>来源（每个数字都挂一枚徽章）' + E + 'h4><ul class="tight small">';
    h += '<li>结构式、色块颜色与坐标、文字条目：逐像素读自 <span class="mono">原图-COSY幻灯片.webp" + E + "span> <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>δ 与 J：教科书/文献常用量级，<b>不是' + E + 'b>原图数据，会随溶剂、温度、浓度漂移 <span class="bg bg-lit">文献近似" + E + "span>' + E + 'li>';
    h += '<li>峰数、耦合对数、1/(2J)：组合与代数推导 <span class="bg bg-cnt">理论计数" + E + "span>' + E + 'li>';
    h += '<li>T₂ = 1.2 s、谱仪 400 MHz、阈值 0.08、k<sub>ex' + E + 'sub> 量程：为讲解选定 <span class="bg bg-par">模型参数" + E + "span>' + E + 'li>';
    h += '<li>峰幅度、最优 τm、交换因子 α：数值模型输出 <span class="bg bg-calc">计算" + E + "span>' + E + 'li>';
    h += E + 'ul>';
    h += '<h4>限制（必须说清的「示意」）' + E + 'h4><ul class="tight small">';
    h += '<li>本页 2D 谱、1D 投影、曲线全部是<b>示意' + E + 'b>，由模型算出，不能拿去与实验比对。' + E + 'li>';
    h += '<li>模型简化：把化学等价的氢并成一个位点；对角峰的反相因子用「最强耦合」近似；1D 投影用一阶多重峰（等价核已合并、J 相加）与理想线型；弛豫用单一 e^(−2τ/T₂)。' + E + 'li>';
    h += '<li>–OH 交换用两位置 Bloch–McConnell 传播子算残留因子，是唯象模型：真实体系里交换对象是痕量水，其弛豫时间与浓度都会改变结果。' + E + 'li>';
    h += '<li>原图信息不足以唯一确定分子结构与归属（见 ① 的清单）。本页对原图只主张两组事实：8 个色块的坐标，以及 A–B–C–D 的耦合链拓扑。' + E + 'li>';
    h += '<li>页面读数的 ppm 给到 0.01 只是为了滑块连续，<b>那个小数位没有实验意义' + E + 'b>。' + E + 'li>';
    h += E + 'ul>';
    h += '<h4>页面自检（真跑，不是声称）' + E + 'h4>';
    h += '<div class="btns"><button id="runSelf">跑 window.__selftest()" + E + "button><button id="runSelf2">跑本页当前状态的自洽检查" + E + "button>' + E + 'div>';
    h += '<pre class="mono small" id="selfOut" style="white-space:pre-wrap;background:#0f141a;border:1px solid #232b35;border-radius:6px;padding:8px;margin-top:7px;max-height:340px;overflow:auto">未运行。" + E + "pre>';
    h += E + 'div>' + E + 'details>';

    host.innerHTML = h;
    // 术语自动标注：逐元素处理，避免整段 HTML 里嵌套替换破标签
    host.querySelectorAll("p, li, h4, .small, .termcard p, .issue .t1, .issue .t2, summary").forEach(function (n) {
      if (n.querySelector(".t")) return;
      var html = termify(n.innerHTML);
      if (html !== n.innerHTML) n.innerHTML = html;
    });
    renderMath();
    bindTerms(host);
    $("runSelf").addEventListener("click", function () {
      try { $("selfOut").textContent = JSON.stringify(N.selftest(), null, 1); }
      catch (e) { $("selfOut").textContent = "自检抛错：" + e.message; }
    });
    $("runSelf2").addEventListener("click", function () {
      try { $("selfOut").textContent = JSON.stringify(pageInvariants(), null, 1); }
      catch (e) { $("selfOut").textContent = "自洽检查抛错：" + e.message; }
    });
  }   // renderDetails 到此结束（函数体横跨 part5a/5b/5c）

  /* ---------- 静态公式与 KaTeX 渲染 ---------- */
  var BS = String.fromCharCode(92);
  var EQ = {
    eqCalib: "标定：x 轴 43.79 px/ppm（用 8 块关于对角线的镜像对称性定标，残差 < 0.03 ppm）；y 轴 87.00 px/ppm（用 “2.0” 与 “3.5” 两个刻度文字的行心定标）",
    eqTable: "N 个不同位移 ⇒ N 个对角峰；M 对耦合 ⇒ 2M 个交叉峰。链状耦合（N 个位点首尾相连）时 M = N − 1。",
    eq1: "U" + BS + "I_x^{A}" + BS + "U^{" + BS + "dagger} = " + BS + "cos(" + BS + "pi J" + BS + "tau)" + BS + "I_x^{A} + " + BS + "sin(" + BS + "pi J" + BS + "tau)" + BS + "bigl(2I_y^{A}I_z^{B}" + BS + "bigr), " + BS + "qquad U = e^{-i" + BS + ",2" + BS + "pi J" + BS + ",I_z^{A}I_z^{B}" + BS + "tau}",
    eq2: "S_{" + BS + "mathrm{cross}} " + BS + "propto " + BS + "sin(" + BS + "pi J" + BS + "tau_m), " + BS + "qquad S_{" + BS + "mathrm{diag}} " + BS + "propto " + BS + "cos(" + BS + "pi J" + BS + "tau_m), " + BS + "qquad " + BS + "tau_m = " + BS + "frac{1}{2J}",
    eq3: BS + "frac{d}{d" + BS + "tau_m}" + BS + "Bigl[" + BS + "sin(" + BS + "pi J" + BS + "tau_m)" + BS + ",e^{-2" + BS + "tau_m/T_2}" + BS + "Bigr] = 0 " + BS + "; " + BS + "Longleftrightarrow " + BS + "; " + BS + "tan(" + BS + "pi J" + BS + "tau_m) = " + BS + "frac{" + BS + "pi J T_2}{2}"
  };

  function renderMath() {
    if (typeof katex === "undefined") return;
    Object.keys(EQ).forEach(function (id) {
      var n = $(id); if (!n || n.dataset.done) return;
      try { katex.render(EQ[id], n, { throwOnError: false, displayMode: true }); n.dataset.done = "1"; } catch (e) { }
    });
    document.querySelectorAll(".katex-inline").forEach(function (n) {
      if (n.dataset.done) return;
      try { katex.render(n.textContent, n, { throwOnError: false, displayMode: false }); n.dataset.done = "1"; } catch (e) { }
    });
  }

  /* 当前状态的自洽检查：不看模型对不对，只看「页面显示与内核是否一致」 */
  function pageInvariants() {
    var P = N.visiblePeaks(st()), sys = N.getSystem(st());
    var bad = 0;
    P.forEach(function (p) {
      if (p.diag) return;
      var m = P.filter(function (q) { return Math.abs(q.f2 - p.f1) < 0.06 && Math.abs(q.f1 - p.f2) < 0.06; });
      if (m.length !== 1 || Math.abs(m[0].mag - p.mag) > 1e-9) bad++;
    });
    var pairs = 0;
    for (var i = 0; i < sys.sites.length; i++)
      for (var j = i + 1; j < sys.sites.length; j++) if (sys.J[i][j] > 0) pairs++;
    var expCells = sys.sites.length + 2 * pairs, visN = 0;
    P.forEach(function (p) { if (p.visible) visN++; });
    return { cells: P.length, expectedCells: expCells, visible: visN, sites: sys.sites.length,
             couplingPairs: pairs, mirrorViolations: bad, tau: ST.tau, threshold: ST.th,
             exchangeOn: ST.exOn, alpha_at_k0: N.alphaOH(ST.tau, 0, 440, 0),
             ok: (bad === 0 && P.length === expCells && Math.abs(N.alphaOH(ST.tau, 0, 440, 0) - 1) < 1e-12) };
  }
