
  /* ======================= 右栏读数 ======================= */
  var GROUPS = [
    { key: "OH", name: "羟基 –OH", en: "hydroxyl / exchangeable", nH: 1,
      J: "³J(OH,C1) ≈ 5.2 Hz", mul: "宽单峰（交换快时）或双峰（交换慢时）",
      note: "活泼氢：与溶剂/水交换。交换够快时与 C1 的耦合被平均掉，交叉峰消失，只剩一个宽包。" },
    { key: "C1", name: "亚甲基 –CH₂–", en: "methylene", nH: 2,
      J: "³J(C1,C2) = 6.6 Hz；³J(C1,OH) ≈ 5.2 Hz", mul: "三重峰（1:2:1）",
      note: "接在氧上：先去屏蔽。两个氢化学等价，互相不裂分，只被 C2 的两个氢裂分成三重峰。" },
    { key: "C2", name: "亚甲基 –CH₂–", en: "methylene", nH: 2,
      J: "³J(C2,C1) = 6.6 Hz；³J(C2,C3) = 7.3 Hz", mul: "五重峰（1:4:6:4:1）",
      note: "夹在两个亚甲基之间，两侧都裂分它。" },
    { key: "C3", name: "甲基 –CH₃", en: "methyl", nH: 3,
      J: "³J(C3,C2) = 7.3 Hz", mul: "三重峰（1:2:1）",
      note: "三个氢磁等价，互相不裂分；只被 C2 的两个氢裂分成三重峰。" }
  ];
  var T = {
    open: function (name, attrs) { return "<" + name + (attrs || "") + ">"; },
    close: function (name) { return E + name + ">"; },
    box: function (name, attrs, inner) { return T.open(name, attrs) + inner + T.close(name); }
  };
  function renderRead() {
    var sys = N.getSystem(st()), P = N.visiblePeaks(st());
    var i = (ST.sel.type === "site") ? ST.sel.i : 1;
    if (!(i >= 1 && i <= sys.sites.length)) i = 1;
    var s = sys.sites[i - 1];
    var h = T.box("h3", "", "当前选中的对象");
    h += T.open("div", ' class="chips"');
    sys.sites.forEach(function (x) {
      h += T.open("button", ' class="chip" data-site="' + x.id + '" aria-pressed="' +
        (ST.sel.type === "site" && ST.sel.i === x.id) + '"') + "(" + x.id + ") " + x.key + T.close("button");
    });
    h += T.close("div");
    h += T.open("div", ' class="kv"');
    h += T.box("span", ' class="k"', "位点") + T.box("span", ' class="v"', "(" + s.id + ") " + s.label);
    h += T.box("span", ' class="k"', "氢数") + T.box("span", ' class="v"', s.mult + "H");
    h += T.box("span", ' class="k"', "δ") + T.box("span", ' class="v"',
      s.d.toFixed(2) + " ppm " + T.box("span", ' class="bg bg-lit"', "文献近似"));
    h += T.box("span", ' class="k"', "对角峰") + T.box("span", ' class="v"',
      "(" + s.d.toFixed(2) + ", " + s.d.toFixed(2) + ")");
    h += T.box("span", ' class="k"', "可见") + T.box("span", ' class="v"',
      isVisSite(P, s.d) ? "是" : T.box("span", ' style="color:#e2645f"', "否（低于阈值）"));
    var nb = [];
    for (var k = 0; k < sys.sites.length; k++) if (k + 1 !== s.id && sys.J[i - 1][k] > 0)
      nb.push(sys.sites[k].key + " (³J = " + sys.J[i - 1][k].toFixed(1) + " Hz)");
    h += T.box("span", ' class="k"', "与谁耦合") + T.box("span", ' class="v"', nb.length ? nb.join("、") : "无");
    if (s.exch) h += T.box("span", ' class="k"', "交换") + T.box("span", ' class="v"',
      ST.exOn ? ST.ex + " s⁻¹" : "关（视为不交换）");
    h += T.close("div");
    $("readCard").innerHTML = h;
  }
  function isVisSite(P, d) {
    for (var i = 0; i < P.length; i++) if (P[i].diag && Math.abs(P[i].f2 - d) < 0.05) return P[i].visible;
    return false;
  }
  function renderPair() {
    var P = N.visiblePeaks(st());
    var h = T.box("h3", "", "峰明细（交叉峰总览）");
    h += T.open("table", ' class="read"') + T.open("thead") + T.open("tr") +
         T.box("th", "", "峰 (F2,F1)") + T.box("th", "", "类型") + T.box("th", "", "J/Hz") +
         T.box("th", "", "幅度") + T.box("th", "", "可见") + T.close("tr") + T.close("thead") + T.open("tbody");
    var cross = P.filter(function (p) { return !p.diag; });
    cross.sort(function (a, b) { return b.mag - a.mag; });
    cross.forEach(function (p) {
      h += T.open("tr", p.visible ? "" : ' class="dim"') +
        T.box("td", "", "(" + p.f2.toFixed(2) + ", " + p.f1.toFixed(2) + ")") +
        T.box("td", "", "交叉") + T.box("td", "", p.J.toFixed(1)) + T.box("td", "", fmt(p.mag, 4)) +
        T.box("td", "", p.visible ? "是" : T.box("span", ' style="color:#e2645f"', "否")) + T.close("tr");
    });
    h += T.close("tbody") + T.close("table");
    h += T.box("div", ' class="small muted" style="margin-top:5px"',
      "只列交叉峰；对角线上的 " + P.filter(function (p) { return p.diag; }).length + " 个对角峰见下方归属表。");
    $("pairCard").innerHTML = h;
  }
  function renderSum() {
    var P = N.visiblePeaks(st()), sys = N.getSystem(st());
    var vis = P.filter(function (p) { return p.visible; }).length;
    var pairs = P.filter(function (p) { return !p.diag; }).length / 2;
    var indep = P.filter(function (p) { return p.diag || p.f2 < p.f1; }).length;
    var tp = N.turnPointMs(7.3, 1200);
    var h = T.box("h3", "", "一句话结论");
    h += T.box("p", ' style="margin:2px 0 6px"', "不同位移数 " + T.box("b", ' class="mono"', String(sys.sites.length)) +
      " ⇒ 对角峰 " + sys.sites.length + " 个；耦合对 " + T.box("b", ' class="mono"', String(pairs)) +
      " ⇒ 交叉峰 " + (pairs * 2) + " 个（关于对角线成对）。");
    h += T.box("p", ' class="big" style="text-align:center"', P.length + " 格 · " + vis + " 可见");
    h += T.open("div", ' class="kv"');
    h += T.box("span", ' class="k"', "独立峰") + T.box("span", ' class="v"', indep + "（对角 + 上三角）");
    h += T.box("span", ' class="k"', "交叉峰配对") + T.box("span", ' class="v"', pairs + " 对");
    h += T.box("span", ' class="k"', "最优 τm（J = 7.3）") + T.box("span", ' class="v"', fmt(tp, 1) + " ms");
    h += T.box("span", ' class="k"', "1/(2J)") + T.box("span", ' class="v"', fmt(1000 / 14.6, 1) + " ms");
    h += T.box("span", ' class="k"', "–OH 残留因子 α") + T.box("span", ' class="v"',
      ST.exOn ? fmt(N.alphaOH(ST.tau, ST.ex, Math.abs(2.20 - 1.56) * FIELDS[ST.fieldIdx], 0), 4) : "1.0000");
    h += T.close("div");
    h += T.box("div", ' class="small muted" style="margin-top:6px"',
      "格数、独立峰数、耦合对数都是" + T.box("b", "", "组合计数") + "；幅度与 α 是" + T.box("b", "", "模型计算") +
      "；δ 与 J 是" + T.box("b", "", "文献近似") + "。");
    $("sumCard").innerHTML = h;
  }
  function renderGrp() {
    var h, sys = N.getSystem(st());
    if (ST.system === "figure") {
      h = T.box("h3", "", "原图骨架的四个位点");
      h += T.box("div", ' class="small muted"', "原图只画出球棍结构与四个字母标记，没有给出 δ 与 J。" +
        "这里用原图 2D 图上量到的三个位移，外加一个「无法确认」的位点来建模。");
      sys.sites.forEach(function (s) {
        h += T.open("div", ' class="termcard"') + "<b>(" + s.id + ") " + s.label + "<\/b> " +
          T.box("span", ' class="en"', s.mult + "H") +
          T.box("p", "", "δ = " + s.d.toFixed(2) + " ppm" + (s.key === "D" ?
            "（" + T.box("b", "", "无法确认") + "：原图 2D 图上量不到 D 的位移，只能从「D 与 C 耦合」倒推它确实存在）" :
            "（估读自原图 2D 图，±0.05 ppm）")) + T.close("div");
      });
      $("grpCard").innerHTML = h; return;
    }
    h = T.box("h3", "", "分子解剖：每个基团一张卡");
    GROUPS.forEach(function (G) {
      var s = null;
      for (var i = 0; i < sys.sites.length; i++) if (sys.sites[i].key === G.key) s = sys.sites[i];
      if (!s) return;
      h += T.open("div", ' class="termcard"');
      h += "<b>" + G.name + "<\/b> " + T.box("span", ' class="en"', G.en + " · " + G.nH + "H");
      h += T.box("div", ' class="mono small" style="margin:3px 0"', explicitH(G.key));
      h += T.box("p", "", "δ = " + s.d.toFixed(2) + " ppm " + T.box("span", ' class="bg bg-lit"', "文献近似") +
        "　氢数 " + s.mult + "H");
      h += T.box("p", "", "耦合：" + G.J);
      h += T.box("p", "", "多重峰：" + G.mul);
      h += T.box("p", "", G.note);
      h += T.close("div");
    });
    $("grpCard").innerHTML = h;
  }
  function explicitH(key) {
    if (key === "OH") return "R–O–<u>H' + E + 'u>   ← 一个氢，标「活泼氢」";
    if (key === "C1") return "–C<u>H' + E + 'u>₂–   两个 H 画在同一个碳上";
    if (key === "C2") return "–C<u>H' + E + 'u>₂–   两个 H 画在同一个碳上";
    if (key === "C3") return "–C<u>H' + E + 'u>₃    三个 H 画在同一个碳上";
    return "–C<u>H' + E + 'u>–";
  }

  /* ======================= 术语标注 ======================= */
  var ESC_RE = new RegExp(String.fromCharCode(91) + ".*+?^" + String.fromCharCode(36) + "()|" +
    String.fromCharCode(92, 92, 91, 92, 92, 93) + "{}" + String.fromCharCode(93), "g");
  function termify(html) {
    var keys = Object.keys(TERMS).sort(function (a, b) { return b.length - a.length; });
    var out = html;
    keys.forEach(function (k) {
      var re = new RegExp("(" + k.replace(ESC_RE, String.fromCharCode(92) + "$&") + ")(?![^<]*>)", "g");
      out = out.replace(re, function (m) {
        return T.open("span", ' class="t" data-term="' + k + '" tabindex="0"') + m + T.close("span");
      });
    });
    return out;
  }
  function bindTerms(root) {
    (root || document).querySelectorAll(".t").forEach(function (n) {
      if (n.dataset.bound) return; n.dataset.bound = "1";
      var show = function () {
        var Tm = TERMS[n.dataset.term]; if (!Tm) return;
        var tip = $("tip");
        tip.innerHTML = "<b>" + Tm[0] + "<\/b> " + T.box("span", ' class="en"', Tm[1]);
        tip.style.display = "block";
        var r = n.getBoundingClientRect();
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left));
        var top = r.top - th - 8; if (top < 8) top = r.bottom + 8;
        tip.style.left = left + "px"; tip.style.top = top + "px";
      };
      var hide = function () { $("tip").style.display = "none"; };
      n.addEventListener("mouseenter", show); n.addEventListener("focus", show);
      n.addEventListener("mouseleave", hide); n.addEventListener("blur", hide);
    });
  }
