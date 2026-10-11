
  /* ======================= 统一刷新 ======================= */
  var pending = false;
  function renderAll() {
    if (pending) return; pending = true;
    var fire = function () { pending = false; renderStep(); draw2D(); drawMol(); drawTau(); renderRead(); renderPair(); renderSum(); renderGrp(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(fire);
    setTimeout(fire, 0);   // --dump-dom 等场景下 rAF 可能不触发，定时器兜底
  }
  window.__render = function () { renderStep(); draw2D(); drawMol(); drawTau(); renderRead(); renderPair(); renderSum(); renderGrp(); };

  /* ======================= 交互绑定 ======================= */
  function bind() {
    var seg = $("sysSeg");
    [["propanol", "正丙醇（教学例）"], ["figure", "原图骨架的位点"]].forEach(function (p) {
      var b = document.createElement("button");
      b.textContent = p[1]; b.dataset.sys = p[0];
      b.addEventListener("click", function () { ST.system = p[0]; syncInputs(); renderAll(); });
      seg.appendChild(b);
    });
    $("sysNote").textContent = "「正丙醇」是干净的教学例（δ、J 用文献常用值）；「原图骨架」用原图 2D 图上量到的位移，其中 D 位点的位移无法确认。";

    $("tau").addEventListener("input", function () { ST.tau = +this.value; $("tauVal").textContent = ST.tau + " ms"; renderAll(); });
    $("th").addEventListener("input", function () { ST.th = +this.value; $("thVal").textContent = fmt(ST.th, 3); renderAll(); });
    $("ex").addEventListener("input", function () {
      ST.ex = +this.value; ST.exOn = ST.ex > 0;
      $("exVal").textContent = ST.exOn ? ST.ex + " s⁻¹" : "关"; renderAll();
    });
    $("fd").addEventListener("input", function () {
      ST.fieldIdx = +this.value; $("fdVal").textContent = FIELDS[ST.fieldIdx] + " MHz"; renderAll();
    });
    $("ohOn").addEventListener("change", function () { ST.includeOH = this.checked; renderAll(); });
    $("degOn").addEventListener("change", function () { ST.degenerate = this.checked; renderAll(); });
    $("reset").addEventListener("click", function () {
      ST.tau = 68; ST.th = 0.08; ST.ex = 0; ST.exOn = false; ST.fieldIdx = 2;
      ST.includeOH = true; ST.degenerate = false; ST.system = "propanol"; ST.sel = { type: "site", i: 1 };
      syncInputs(); renderAll();
    });
    $("opt").addEventListener("click", function () {
      ST.tau = Math.round(N.turnPointMs(7.3, 1200)); syncInputs(); renderAll();
    });

    // 画布点击
    $("cv2d").addEventListener("click", function (ev) {
      var r = this.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      var best = -1, bd = 1e9;
      MAP.hits.forEach(function (h, i) {
        var d = Math.hypot(h.cx - x, h.cy - y);
        if (d < h.r + 6 && d < bd) { bd = d; best = i; }
      });
      if (best >= 0) { ST.sel = { type: "pair", i: Math.round(MAP.hits[best].f2 * 100), j: Math.round(MAP.hits[best].f1 * 100), p: MAP.hits[best].p }; renderAll(); }
    });
    $("cvMol").addEventListener("click", function (ev) {
      var r = this.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      var best = -1, bd = 1e9;
      MOLHITS.forEach(function (h, i) { var d = Math.hypot(h.x - x, h.y - y); if (d < h.r + 8 && d < bd) { bd = d; best = i; } });
      if (best >= 0) { ST.sel = { type: "site", i: MOLHITS[best].id }; renderAll(); }
    });

    // 键盘
    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      var sys = N.getSystem(st());
      if (ev.key >= "1" && ev.key <= String(Math.min(9, sys.sites.length))) {
        ST.sel = { type: "site", i: +ev.key }; renderAll(); ev.preventDefault(); return;
      }
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        var d = ev.key === "ArrowRight" ? 1 : -1;
        var cur = ST.sel.type === "site" ? ST.sel.i : 1;
        ST.sel = { type: "site", i: ((cur - 1 + d + sys.sites.length) % sys.sites.length) + 1 };
        renderAll(); ev.preventDefault(); return;
      }
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ST.tau = Math.max(0, Math.min(160, ST.tau + (ev.key === "ArrowUp" ? 2 : -2)));
        syncInputs(); renderAll(); ev.preventDefault(); return;
      }
      if (ev.key === " " || ev.key === "Enter") {
        if (ev.target === document.body || ev.target === $("cv2d") || ev.target === $("cvMol")) {
          ST.answerOpen = !ST.answerOpen; renderStep(); ev.preventDefault();
        }
      }
    });
    // 位点 chips（右栏，事件委托）
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-site]") : null;
      if (b) { ST.sel = { type: "site", i: +b.dataset.site }; renderAll(); }
    });
    window.addEventListener("resize", function () { renderAll(); });
    $("opt").setAttribute("title", "跳到模型最优混合时间 " + fmt(N.turnPointMs(7.3, 1200), 1) + " ms");
  }

  /* ======================= 启动 ======================= */
  function boot() {
    if (typeof document === "undefined" || !document.getElementById("cv2d")) return;
    bind();
    syncInputs();
    renderDetails();
    renderAll();
    window.__ready = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.__api = {
    state: ST, kernel: N, render: renderAll, invariants: pageInvariants,
    setTau: function (t) { ST.tau = t; syncInputs(); renderAll(); },
    step: applyStep, MAP: MAP
  };
})();