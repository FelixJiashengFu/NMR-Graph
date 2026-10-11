
/* 注入式测试驱动：只在 _itest 生成的临时页面里存在，正式页面不含这段代码 */
(function () {
  var R = [], errors = [];
  window.addEventListener("error", function (e) { errors.push(String(e.message)); });
  function ok(name, cond, extra) { R.push({ n: name, p: !!cond, e: extra === undefined ? "" : String(extra) }); }
  function S() { return window.__api.state; }
  function K() { return window.__api.kernel; }
  function stt() {
    var s = S();
    return { tau: s.tau, threshold: s.th, exchange: s.ex, exchangeOn: s.exOn,
             field: [200,300,400,600,900][s.fieldIdx], T2: 1200,
             includeOH: s.includeOH, degenerate: s.degenerate, system: s.system };
  }
  function cells() { return K().visiblePeaks(stt()); }
  function vis() { var c = cells(), n = 0; for (var i = 0; i < c.length; i++) if (c[i].visible) n++; return n; }
  function fire(el, ev) { el.dispatchEvent(new Event(ev, { bubbles: true })); }
  function click(el, x, y) { el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y })); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms === undefined ? 60 : ms); }); }

  async function run() {
    try {
      ok("启动完成 __ready", window.__ready === true);
      ok("初始格数 = 10（4 位点链）", cells().length === 10, cells().length);
      ok("初始对角峰 4 个", cells().filter(function (p) { return p.diag; }).length === 4);
      ok("初始可见峰 >= 7", vis() >= 7, vis());

      for (var n = 1; n <= 4; n++) { document.dispatchEvent(new KeyboardEvent("keydown", { key: String(n), bubbles: true })); await wait(20);
        ok("按键 " + n + " 选中位点 " + n, S().sel.type === "site" && S().sel.i === n, JSON.stringify(S().sel)); }
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await wait(20);
      ok("→ 轮换（4→1）", S().sel.i === 1, S().sel.i);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); await wait(20);
      ok("← 轮换（1→4）", S().sel.i === 4, S().sel.i);
      var t0 = S().tau;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); await wait(20);
      ok("↓ 让 τm 减 2ms", S().tau === Math.max(0, t0 - 2), S().tau);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); await wait(20);
      ok("↑ 让 τm 加 2ms", S().tau === t0, S().tau);

      var tau = document.getElementById("tau");
      tau.value = 5; fire(tau, "input"); await wait();
      ok("τm 滑块 -> 5ms", S().tau === 5, S().tau);
      ok("τm=5ms 时拓扑不变（仍 10 格）", cells().length === 10, cells().length);
      var th0 = S().th;
      tau.value = 68; fire(tau, "input"); await wait();
      ok("τm 滑块 -> 68ms", S().tau === 68, S().tau);
      ok("改 τm 不动阈值（组合 A）", S().th === th0, S().th);

      var th = document.getElementById("th");
      th.value = 0.9; fire(th, "input"); await wait();
      var vHi = vis();
      th.value = 0.05; fire(th, "input"); await wait();
      ok("阈值 0.9 -> 0.05 可见峰变多", vis() > vHi, vHi + " -> " + vis());
      ok("改阈值不动 τm（组合 B）", S().tau === 68, S().tau);
      th.value = 0.08; fire(th, "input"); await wait();
      ok("阈值回到 0.08 后可见峰 >= 7", vis() >= 7, vis());

      document.getElementById("opt").click(); await wait();
      ok("最优按钮把 τm 设到 65±2 ms", Math.abs(S().tau - 65.3) <= 2, S().tau);
      ok("最优 τm 下可见峰 >= 8", vis() >= 8, vis());

      var oh = document.getElementById("ohOn");
      oh.checked = false; fire(oh, "change"); await wait();
      ok("取消 –OH 后格数 = 7", cells().length === 7, cells().length);
      ok("取消 –OH 不动 τm", S().tau >= 60, S().tau);
      oh.checked = true; fire(oh, "change"); await wait();
      ok("恢复 –OH 后格数 = 10", cells().length === 10, cells().length);
      var deg = document.getElementById("degOn");
      deg.checked = true; fire(deg, "change"); await wait();
      ok("位移重合后格数降到 7", cells().length === 7, cells().length);
      ok("位移重合不动 –OH 开关", S().includeOH === true);
      deg.checked = false; fire(deg, "change"); await wait();

      var ex = document.getElementById("ex");
      var a0 = K().alphaOH(S().tau, 0, 440, 0);
      ex.value = 30; fire(ex, "input"); await wait();
      ok("交换滑块打开 exOn", S().exOn === true && S().ex === 30, S().ex);
      var a30 = K().alphaOH(S().tau, 30, 440, 0);
      ok("k=30 的 –OH 残留因子 < k=0", a30 < a0, a0.toFixed(4) + " -> " + a30.toFixed(4));
      ex.value = 0; fire(ex, "input"); await wait();
      ok("交换拖回 0 时 exOn 关闭", S().exOn === false);

      var fd = document.getElementById("fd"), c400 = cells().length;
      fd.value = 4; fire(fd, "input"); await wait();
      ok("频率 400->900MHz 格数不变", cells().length === c400, cells().length);
      ok("频率改变不动 τm（组合 C）", S().tau >= 60, S().tau);
      fd.value = 2; fire(fd, "input"); await wait();

      var btns = document.querySelectorAll("#sysSeg button");
      for (var i = 0; i < btns.length; i++) if (btns[i].dataset.sys === "figure") btns[i].click();
      await wait();
      ok("切到原图骨架体系", S().system === "figure");
      ok("骨架体系格数 = 10", cells().length === 10, cells().length);
      ok("骨架体系峰成对镜像", window.__api.invariants().mirrorViolations === 0);
      for (var j = 0; j < btns.length; j++) if (btns[j].dataset.sys === "propanol") btns[j].click();
      await wait();
      ok("切回正丙醇体系", S().system === "propanol");

      var exp = [{tau:68,oh:true},{tau:68},{tau:5},{tau:68},{exOn:true},{tau:68},{tau:68}];
      for (var stp = 1; stp <= 7; stp++) {
        var b = document.querySelector('[data-step="' + (stp - 1) + '"]');
        ok("步骤按钮 " + stp + " 存在", !!b);
        if (b) b.click();
        await wait(80);
        var e = exp[stp - 1];
        ok("切到步骤 " + stp + " 后状态符合预期",
           S().step === stp - 1 && (e.tau === undefined || S().tau === e.tau) && (e.oh === undefined || S().includeOH === e.oh),
           JSON.stringify({ step: S().step, tau: S().tau, oh: S().includeOH }));
        var ans = document.querySelector("#guide .gans");
        ok("步骤 " + stp + " 答案默认收起", !!ans && !ans.classList.contains("on"));
        document.getElementById("showAns").click();
        await wait(80);
        ok("步骤 " + stp + " 点「看答案」后展开", document.querySelector("#guide .gans").classList.contains("on"));
      }
      document.getElementById("nextStep").click(); await wait(120);
      ok("步骤 7 再按「下一步」绕回步骤 1", S().step === 0, S().step);   // 循环导航
      document.getElementById("prevStep").click(); await wait(120);
      ok("步骤 1 按「上一步」绕到步骤 7", S().step === 6, S().step);
      document.getElementById("prevStep").click(); await wait(80);
      ok("再按一次「上一步」到步骤 6", S().step === 5, S().step);

      window.__api.step(0); await wait(80);
      var cv = document.getElementById("cv2d"); cv.focus();
      cv.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); await wait(80);
      ok("空格 > 展开本步答案", S().answerOpen === true, String(S().answerOpen));
      cv.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); await wait(80);
      ok("空格再按 > 收起答案", S().answerOpen === false, String(S().answerOpen));

      window.__api.render();
      var r2 = cv.getBoundingClientRect(), MAP = window.__api.MAP, hit = 0, miss = 0;
      for (var h = 0; h < Math.min(8, MAP.hits.length); h++) {
        click(cv, r2.left + MAP.hits[h].cx, r2.top + MAP.hits[h].cy);
        await wait(30);
        if (S().sel.type === "pair") hit++; else miss++;
      }
      ok("点 2D 峰能选中（8 次里 >= 6 次命中）", hit >= 6, "命中 " + hit + " 未命中 " + miss);
      var cm = document.getElementById("cvMol"), rm2 = cm.getBoundingClientRect();
      click(cm, rm2.left + 60, rm2.top + 60); await wait(30);
      ok("点结构区不会崩", ["site", "pair"].indexOf(S().sel.type) >= 0);
      var chips = document.querySelectorAll("#readCard .chip");
      ok("右栏位点 chip 数量 = 位点数", chips.length === K().getSystem(stt()).sites.length, chips.length);
      if (chips.length) { chips[chips.length - 1].click(); await wait(30);
        ok("点 chip 能改选中位点", S().sel.type === "site", JSON.stringify(S().sel)); }

      document.getElementById("reset").click(); await wait(80);
      ok("恢复默认：τm=68、阈值=0.08、正丙醇、–OH 参与",
         S().tau === 68 && Math.abs(S().th - 0.08) < 1e-9 && S().system === "propanol" && S().includeOH === true,
         JSON.stringify({ tau: S().tau, th: S().th, sys: S().system, oh: S().includeOH }));

      var st = K().selftest();
      ok("__selftest().ok === true", st.ok === true, JSON.stringify(st).slice(0, 160));
      var inv = window.__api.invariants();
      ok("页面自洽检查 ok", inv.ok === true, JSON.stringify(inv));
      ok("KaTeX 真的渲染了（.katex-html > 0）", document.querySelectorAll(".katex-html").length > 0,
         document.querySelectorAll(".katex-html").length);
      ok("没有把 LaTeX 源码当纯文本", document.body.innerText.indexOf(String.fromCharCode(92) + "frac") < 0);
      ok("术语自动标注 >= 20 处", document.querySelectorAll("[data-term]").length >= 20,
         document.querySelectorAll("[data-term]").length);
      var ds = document.querySelectorAll("details.sec");
      for (var d = 0; d < ds.length; d++) ds[d].open = true;
      await wait(30);
      ok("折叠区 >= 6 个", ds.length >= 6, ds.length);
      document.getElementById("runSelf").click(); await wait(30);
      ok("页内自检按钮输出 JSON", document.getElementById("selfOut").textContent.indexOf("ok") >= 0);
      document.getElementById("runSelf2").click(); await wait(30);
      ok("页内自洽按钮输出 JSON", document.getElementById("selfOut").textContent.indexOf("mirrorViolations") >= 0);
      var L = document.getElementById("colL"), M = document.getElementById("colM");
      ok("左栏真的独立滚动", L.scrollHeight > L.clientHeight, L.scrollHeight + ">" + L.clientHeight);
      ok("中栏真的独立滚动", M.scrollHeight > M.clientHeight, M.scrollHeight + ">" + M.clientHeight);
      ok("无横向溢出", document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
         document.documentElement.scrollWidth + " vs " + document.documentElement.clientWidth);
      ok("页面无 JS 错误", errors.length === 0, JSON.stringify(errors).slice(0, 240));
    } catch (err) {
      ok("测试驱动本身没有抛错", false, String(err && err.stack || err));
    }
    var pre = document.createElement("pre");
    pre.id = "testout";
    pre.textContent = "@@RESULT@@" + JSON.stringify(R) + "@@EARLY@@" + JSON.stringify(window.__earlyErrors || []);
    document.body.appendChild(pre);
  }
  setTimeout(run, 400);
})();
