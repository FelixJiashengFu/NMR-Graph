// 浏览器验收：逐项实际操作页面并断言结果，覆盖对象联动、键盘、滑块、术语注释、官能团小图、
// 原图展开、公式字体、桌面 / 平板 / 两种手机宽度的布局；最后生成整页预览图。
// 运行：node source/qa-browser.mjs   （或 deno run -A source/qa-browser.mjs）
// 浏览器：优先用环境变量 CHROME_PATH；否则依次尝试 Playwright 缓存和系统 Chrome / Edge。
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pageUrl = pathToFileURL(path.join(root, "index.html")).href;

function findBrowser() {
  const list = [process.env.CHROME_PATH];
  const cache = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), "AppData/Local/ms-playwright"), path.join(os.homedir(), ".cache/ms-playwright"), path.join(os.homedir(), "Library/Caches/ms-playwright")].filter(Boolean);
  for (const c of cache) {
    if (!fs.existsSync(c)) continue;
    for (const d of fs.readdirSync(c).filter((n) => n.startsWith("chromium")).sort().reverse()) {
      list.push(path.join(c, d, "chrome-headless-shell-win64/chrome-headless-shell.exe"), path.join(c, d, "chrome-win64/chrome.exe"), path.join(c, d, "chrome-win/chrome.exe"), path.join(c, d, "chrome-linux/chrome"), path.join(c, d, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"));
    }
  }
  list.push("C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser");
  const hit = list.find((p) => p && fs.existsSync(p));
  if (!hit) throw new Error("找不到 Chromium / Chrome，请设置 CHROME_PATH");
  return hit;
}

const results = [];
let current = "";
const ok = (name, cond, detail) => { results.push({ group: current, name, pass: !!cond, ...(cond ? {} : { detail }) }); if (!cond) console.log(`  ✗ ${name}  ${detail === undefined ? "" : JSON.stringify(detail)}`); };
const group = (g) => { current = g; console.log("· " + g); };
const near = (a, b, t) => Math.abs(a - b) <= t;

const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
const errors = [], external = [];
async function open(width, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  page.on("request", (r) => { if (!/^(file|data|blob|about):/.test(r.url())) external.push(r.url()); });
  await page.goto(pageUrl);
  await page.waitForSelector("body[data-ready='1']");
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const sel = (page) => page.evaluate(() => window.__state.sel);
// 页面内的通用检查函数
const helpers = () => {
  window.__qa = {
    syncState(id) {
      const q = (s) => document.querySelector(s), all = (s) => [...document.querySelectorAll(s)];
      return {
        pressed: all("#objList .obj[aria-pressed='true']").map((b) => +b.dataset.id),
        atom: all("#structure .atom.sel").map((g) => +g.dataset.id),
        hsqc: all("#specHsqc .pk.sel").map((g) => +g.dataset.id),
        edited: all("#specEdited .pk.sel").map((g) => +g.dataset.id),
        ringHsqc: !!q("#specHsqc .selring"), ringEdited: !!q("#specEdited .selring"),
        noteHsqc: q("#specHsqc .overlay").textContent, valtags: all("#specHsqc .valtag").map((t) => t.textContent),
        row: all("#assignRows tr.sel").map((r) => +r.dataset.id),
        readout: q("#readout").innerText, explain: q("#explain").innerText, now: q("#nowText").innerText,
        barSel: all("#editBars .bar.sel").length, body: document.body.dataset.sel,
        viewer: { ...q("#viewer").dataset, ringHidden: q("#zoomRing").hidden, ringLeft: parseFloat(q("#zoomRing").style.left), ringTop: parseFloat(q("#zoomRing").style.top), tag: q("#zoomTag").textContent, info: q("#zoomInfo").innerText },
      };
    },
    layout() {
      const vw = document.documentElement.clientWidth, out = { vw, scrollW: document.documentElement.scrollWidth, overflowing: [], svgClipped: [], svgOverlap: [], svgSmall: [], fgOverflow: [], katexOverflow: [], images: [...document.images].every((i) => i.complete && i.naturalWidth > 0) };
      const inScroller = (el) => el.closest(".origscroll,.tablewrap,.stick,.katex-display,details:not([open]),[hidden]");
      for (const el of document.querySelectorAll("body *")) {
        if (inScroller(el) || el.closest("svg") && el.tagName !== "svg") continue;
        const st = getComputedStyle(el); if (st.display === "none" || st.position === "fixed" || st.clipPath !== "none") continue;
        if (el.classList.contains("skip") || el.closest(".katex-mathml") || (el.id === "zoomImg")) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.right > vw + 1 || r.left < -1) out.overflowing.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className.baseVal ?? el.className).split(" ")[0]} [${r.left.toFixed(0)},${r.right.toFixed(0)}]`);
      }
      for (const svg of document.querySelectorAll("svg.chart, svg.struct")) {
        const sb = svg.getBoundingClientRect(), k = sb.width / svg.viewBox.baseVal.width;
        const ts = [...svg.querySelectorAll("text")].map((t) => ({ t: t.textContent, r: t.getBoundingClientRect(), fs: parseFloat(getComputedStyle(t).fontSize) * k })).filter((x) => x.r.width > 0);
        for (const x of ts) {
          if (x.r.left < sb.left - 2 || x.r.right > sb.right + 2 || x.r.top < sb.top - 2 || x.r.bottom > sb.bottom + 2) out.svgClipped.push(`${svg.id}: “${x.t}”`);
          if (x.fs < 9.5) out.svgSmall.push(`${svg.id}: “${x.t}” ${x.fs.toFixed(1)}px`);
        }
        for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i].r, b = ts[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 2.5 && h > 4) out.svgOverlap.push(`${svg.id}: “${ts[i].t}” × “${ts[j].t}” (${w.toFixed(0)}×${h.toFixed(0)})`);
        }
      }
      for (const fg of document.querySelectorAll(".fg")) { if (fg.closest("[hidden],details:not([open])")) continue; const r = fg.getBoundingClientRect(), p = fg.parentElement.getBoundingClientRect(), s = fg.querySelector("svg").getBoundingClientRect(); if (r.right > p.right + 1 || r.right > vw || s.width < +fg.querySelector("svg").getAttribute("width") - 0.5) out.fgOverflow.push(fg.getAttribute("aria-label")); }
      for (const d of document.querySelectorAll(".katex-display")) if (d.scrollWidth > d.clientWidth + 1) out.katexOverflow.push(d.textContent.slice(0, 30));
      return out;
    },
  };
};

// ============ 1. 桌面 1440：加载与默认状态 ============
let page = await open(1440);
await page.evaluate(helpers);
group("加载与默认状态");
ok("页面就绪且默认选中 C2", (await sel(page)) === 2);
const st = await page.evaluate(() => window.__selftest());
ok("页面内自检 14 项全部通过", st.ok && st.list.length === 14, st.list.filter((x) => !x.pass));
ok("自检结果已显示在页面上", await page.locator("#selftest li .ok").count() === 14 && await page.locator("#selftest li .bad").count() === 0);
ok("十一个内容区块都在", (await page.evaluate(() => ["conclusion", "intuition", "dashboard", "zoom", "table", "steps", "checks", "pitfalls", "bilingual", "glossary", "sources"].every((id) => document.getElementById(id)))));
ok("内容顺序：结论 → 解释 → 推理 → 核对 → 误区 → 来源", await page.evaluate(() => { const y = (id) => document.getElementById(id).getBoundingClientRect().top; const o = ["conclusion", "intuition", "steps", "checks", "pitfalls", "sources"].map(y); return o.every((v, i) => i === 0 || v > o[i - 1]); }));
ok("标题、一句话目标、读前必读在顶部", await page.evaluate(() => !!document.querySelector("header h1") && !!document.querySelector("header .goal") && document.querySelector("header .mustread h2").textContent === "读前必读"));
ok("四种证据标签都出现，且带形状符号", await page.evaluate(() => ["obs", "inf", "cnt", "mod"].every((k) => document.querySelectorAll(".ev." + k).length >= 2 && document.querySelector(".ev." + k + " i").textContent.trim().length === 1)));
ok("重绘图形都标了“示意”或“演示模型”", await page.evaluate(() => document.querySelectorAll(".badge.sketch").length >= 2 && [...document.querySelectorAll(".badge.sketch")].every((b) => b.textContent.includes("示意")) && !!document.querySelector("#model1 h2 .ev.mod") && !!document.querySelector("#model2 h2 .ev.mod")));
ok("三栏布局：左（选择 + 参数）、中（结构 + 谱图）、右（读数 + 解释）", await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = r(".col.left"), b = r(".col.center"), c = r(".col.right"); return a.right <= b.left && b.right <= c.left && Math.abs(a.top - b.top) < 2 && Math.abs(b.top - c.top) < 2 && !!document.querySelector(".col.left #objList") && !!document.querySelector(".col.left #sDelay") && !!document.querySelector(".col.center #structure") && !!document.querySelector(".col.center #specEdited") && !!document.querySelector(".col.right #readout"); }));
ok("配色：背景 #0e1116、面板 #151a21、边界 #303a47、强调 #5fd0a8", await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return ["--bg:#0e1116", "--panel:#151a21", "--line:#303a47", "--acc:#5fd0a8"].every((p) => { const [k, v] = p.split(":"); return cs.getPropertyValue(k).trim() === v; }) && getComputedStyle(document.body).backgroundColor === "rgb(14, 17, 22)" && getComputedStyle(document.querySelector(".panel")).backgroundColor === "rgb(21, 26, 33)"; }));
ok("没有渐变、阴影和动画", await page.evaluate(() => [...document.querySelectorAll("body *")].every((el) => { const s = getComputedStyle(el); return !s.backgroundImage.includes("gradient") && (s.boxShadow === "none" || s.boxShadow.includes("inset")) && s.animationName === "none" && s.transitionDuration.split(",").every((d) => parseFloat(d) === 0); })));

group("公式与字体");
const fonts = await page.evaluate(() => ({ status: document.fonts.status, faces: [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ""), status: f.status })), n: document.querySelectorAll(".katex").length, mathml: document.querySelectorAll(".katex-mathml math").length, sizes: [...document.querySelectorAll(".katex-html")].map((k) => k.getBoundingClientRect()).every((r) => r.width > 10 && r.height > 8), main: document.fonts.check("16px KaTeX_Main"), math: document.fonts.check("italic 16px KaTeX_Math") }));
ok("8 处公式都已渲染，且各有 MathML 备份", fonts.n === 8 && fonts.mathml === 8 && fonts.sizes, fonts.n);
ok("内嵌公式字体没有加载失败", fonts.faces.length === 8 && fonts.faces.every((f) => f.status !== "error") && fonts.main && fonts.math, fonts.faces.filter((f) => f.status === "error"));
ok("公式实际使用的 KaTeX 字体都已加载", await page.evaluate(() => { const used = new Set(); for (const el of document.querySelectorAll(".katex-html *")) { if (!el.childElementCount && el.textContent.trim()) used.add(getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "").trim()); } const loaded = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""))); return [...used].filter((f) => f.startsWith("KaTeX")).every((f) => loaded.has(f)); }));

// ============ 2. 对象选择联动 ============
group("对象选择联动");
const est = await page.evaluate(() => Object.fromEntries(MEASURE.summary.map((r) => [r.site.slice(1), r])));
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  await page.locator(`#objList .obj[data-id="${id}"]`).click();
  const s = await page.evaluate((i) => window.__qa.syncState(i), id), e = est[id];
  const common = s.pressed.join() === String(id) && s.atom.join() === String(id) && s.row.join() === String(id) && s.body === String(id) && s.readout.includes("C" + id) && s.now.includes("C" + id) && s.explain.length > 40;
  if (e) {
    const vx = s.viewer.ringLeft / +s.viewer.scale + +s.viewer.x0, vy = s.viewer.ringTop / +s.viewer.scale + +s.viewer.y0;
    ok(`选 C${id}：列表、结构、两张谱、读数、解释、表格、原图定位圈同步`, common && s.hsqc.join() === String(id) && s.edited.join() === String(id) && s.ringHsqc && s.ringEdited && s.valtags.join() === `${e.dH.toFixed(2)},${e.dC.toFixed(1)}` && s.readout.includes(e.dH.toFixed(2)) && s.readout.includes(e.dC.toFixed(1)) && s.barSel === 1 && !s.viewer.ringHidden && near(vx, e.hsqc.px[0], 0.6) && near(vy, e.hsqc.px[1], 0.6) && s.viewer.tag === "C" + id, s);
  } else {
    ok("选 C3：各处同步显示“无交叉峰”，谱图不画选中圈", common && s.hsqc.length === 0 && s.edited.length === 0 && !s.ringHsqc && !s.ringEdited && s.noteHsqc.includes("无交叉峰") && s.noteHsqc.includes("不带氢") && s.readout.includes("无") && s.readout.includes("无法从原图确认") && s.viewer.ringHidden && s.barSel === 0, s);
  }
}
const explains = new Set();
for (const id of [1, 2, 3, 4, 5, 6, 7]) { await page.evaluate((i) => window.__select(i), id); explains.add(await page.locator("#explain").innerText()); }
ok("七个对象的解释各不相同", explains.size === 7);
await page.locator('#structure .atom[data-id="5"]').click(); ok("点结构上的 C5 → 选中 C5", (await sel(page)) === 5);
await page.locator('#specEdited .pk[data-id="7"]').click(); ok("点编辑谱上的 C7 峰 → 选中 C7", (await sel(page)) === 7);
await page.locator('#specHsqc .pk[data-id="1"]').click(); ok("点常规谱上的 C1 峰 → 选中 C1", (await sel(page)) === 1);
await page.locator('#assignRows tr[data-id="6"] td').first().click(); ok("点归属表 C6 行 → 选中 C6", (await sel(page)) === 6);
await page.locator('#editBars .barg[data-id="4"]').click(); ok("点模型符号条 C4 → 选中 C4", (await sel(page)) === 4);
ok("编辑谱：2 个菱形黑峰 + 4 个圆圈红峰；常规谱 6 个同样的实心点", await page.evaluate(() => document.querySelectorAll("#specEdited .pk.black path.mark").length === 2 && document.querySelectorAll("#specEdited .pk.red circle.mark").length === 4 && document.querySelectorAll("#specHsqc .pk.plain").length === 6));
ok("重绘峰位与估读坐标一致（由图上像素反算）", await page.evaluate(() => { const g = document.getElementById("specEdited")._geom; return MEASURE.summary.every((r) => { const el = document.querySelector(`#specEdited .pk[data-id="${r.site.slice(1)}"]`), m = el.getAttribute("transform").match(/translate\(([\d.]+) ([\d.]+)\)/); const h = 3 - (m[1] - g.m.l) / g.pw * 2.5, c = (m[2] - g.m.t) / g.ph * 50; return Math.abs(h - r.dH) < 0.005 && Math.abs(c - r.dC) < 0.05; }); }));

// ============ 3. 键盘操作 ============
group("键盘操作");
await page.locator('#structure .atom[data-id="4"]').focus(); await page.keyboard.press("Enter"); ok("结构原子：聚焦后按 Enter 选中", (await sel(page)) === 4);
await page.locator('#specEdited .pk[data-id="7"]').focus(); await page.keyboard.press("Space"); ok("谱图峰：聚焦后按空格选中", (await sel(page)) === 7);
ok("选中后焦点仍留在原来的峰上（图形没有被整体重建）", await page.evaluate(() => document.activeElement.matches('#specEdited .pk[data-id="7"]')));
await page.locator('#assignRows tr[data-id="2"]').focus(); await page.keyboard.press("Enter"); ok("表格行：聚焦后按 Enter 选中", (await sel(page)) === 2);
await page.locator('#objList .obj[data-id="2"]').focus(); await page.keyboard.press("ArrowDown"); ok("对象列表：↓ 移到下一个并保持焦点", (await sel(page)) === 3 && await page.evaluate(() => document.activeElement.dataset.id === "3"));
await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp"); ok("对象列表：↑ 可以往回", (await sel(page)) === 1);
await page.keyboard.press("ArrowUp"); ok("对象列表：到头后循环到 C7", (await sel(page)) === 7);
ok("所有交互对象都能用 Tab 到达", await page.evaluate(() => ["#objList .obj", "#structure .atom", "#specHsqc .pk", "#specEdited .pk", "#assignRows tr", "input[type=range]", "#viewBtns button", "button.term", "summary", "#origScroll"].every((s) => { const els = [...document.querySelectorAll(s)]; return els.length > 0 && els.every((el) => el.tabIndex >= 0); })));
await page.locator(".skip").focus(); ok("“跳到交互区”链接在获得焦点时可见", await page.evaluate(() => document.querySelector(".skip").getBoundingClientRect().top >= 0));
await page.locator("#sDelay").focus(); const d0 = await page.evaluate(() => window.__state.delay); await page.keyboard.press("ArrowRight");
ok("滑块：方向键每次改变一个步长，读数同步", near(await page.evaluate(() => window.__state.delay), d0 + 0.1, 1e-9) && (await page.locator("#oDelay").textContent()) === (d0 + 0.1).toFixed(1) + " ms");
await page.keyboard.press("ArrowLeft");
ok("焦点样式可见（2px 轮廓）", await page.evaluate(() => { const el = document.querySelector("#resetBtn"); el.focus(); const s = getComputedStyle(el); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2; }));

// ============ 4. 滑块 ============
group("滑块与演示模型");
await page.evaluate(() => window.__select(2));
const snapshot = () => page.evaluate(() => ({ curve: document.getElementById("editCurve").innerHTML, bars: document.getElementById("editBars").innerHTML, mult: document.getElementById("multiplet").innerHTML, barsDesc: document.getElementById("editBarsDesc").textContent, status: document.getElementById("editStatus").dataset.state, statusText: document.getElementById("editStatus").innerText, kv: document.getElementById("editKv").innerText, mStatus: document.getElementById("multStatus").dataset.state, mKv: document.getElementById("multKv").innerText, factor: document.getElementById("roFactor")?.textContent, est: document.getElementById("assignRows").innerText, peaks: [...document.querySelectorAll("#specEdited .pk")].map((p) => p.getAttribute("transform")).join("|"), outs: ["oDelay", "oJ", "oField", "oZoom"].map((i) => document.getElementById(i).textContent) }));
const base = await snapshot();
ok("默认 Δ = 8.0 ms、J = 125 Hz：CH₂ +1.00、CH₃ −1.00，状态为“反号”", base.status === "opposite" && base.barsDesc.includes("C1 −1.00") && base.barsDesc.includes("C2 +1.00") && base.barsDesc.includes("C7 −1.00") && base.barsDesc.includes("C3 无峰") && base.factor === "+1.00", base.barsDesc);
ok("滑块读数带单位", base.outs.join("|") === "8.0 ms|125 Hz|400 MHz|2.0×", base.outs);
await page.locator("#sDelay").fill("0"); let s1 = await snapshot();
ok("Δ = 0（边界）：全部 +1.00，状态“同号”，图形改变", s1.status === "same" && ["C1", "C2", "C4", "C5", "C6", "C7"].every((c) => s1.barsDesc.includes(c + " +1.00")) && s1.curve !== base.curve && s1.bars !== base.bars && s1.outs[0] === "0.0 ms", s1.barsDesc);
await page.locator("#sDelay").fill("4"); s1 = await snapshot();
ok("Δ = 4.0 ms = 1/(2J)：全部 0.00，状态“接近零点”", s1.status === "null" && ["C1", "C2", "C7"].every((c) => s1.barsDesc.includes(c + " +0.00")), s1.barsDesc);
await page.locator("#sDelay").fill("12"); s1 = await snapshot();
const exp12 = await page.evaluate(() => [HSQCModel.editFactor(2, 125, 12), HSQCModel.editFactor(3, 125, 12)]);
ok("Δ = 12 ms（上限）：显示值等于 cosⁿ(π·J·Δ)", s1.barsDesc.includes("C2 +" + exp12[0].toFixed(2)) && near(exp12[0], 0, 1e-9) && s1.status === "null", [s1.barsDesc, exp12]);
await page.locator("#sDelay").fill("6.9"); s1 = await snapshot();
ok("失配：Δ = 6.9 ms、J = 125 Hz → CH₂ +0.82、CH₃ −0.75，仍“反号”并提示强度下降", s1.status === "opposite" && s1.barsDesc.includes("C2 +0.82") && s1.barsDesc.includes("C1 −0.75") && s1.statusText.includes("强度下降") && s1.factor === "+0.82", s1.barsDesc);
await page.locator("#sDelay").fill("8"); await page.locator("#sJ").fill("170"); s1 = await snapshot();
const exp170 = await page.evaluate(() => HSQCModel.editFactor(2, 170, 8));
ok("J = 170 Hz：匹配延迟显示 5.88 ms，曲线与读数随之改变", s1.kv.includes("5.88 ms") && s1.kv.includes("2.94 ms") && s1.curve !== base.curve && s1.factor === (exp170 >= 0 ? "+" : "−") + Math.abs(exp170).toFixed(2) && s1.outs[1] === "170 Hz", [s1.kv, s1.factor]);
await page.locator("#sJ").fill("110"); s1 = await snapshot(); ok("J = 110 Hz（下限）：匹配延迟 9.09 ms", s1.kv.includes("9.09 ms"), s1.kv);
ok("改 Δ 和 J 不影响“模型 ②”，也不改变估读峰位和归属表", s1.mult === base.mult && s1.est === base.est && s1.peaks === base.peaks);
await page.locator("#sField").fill("100"); s1 = await snapshot();
ok("场强 100 MHz（下限）：氢维 2.0 Hz，两组裂分交叠", s1.mStatus === "overlap" && s1.mKv.includes("2.0 Hz") && s1.mKv.includes("交叠 16.5 Hz") && s1.mult !== base.mult, s1.mKv);
await page.locator("#sField").fill("1000"); s1 = await snapshot();
ok("场强 1000 MHz（上限）：氢维 20.0 Hz，刚好分开 1.5 Hz", s1.mStatus === "apart" && s1.mKv.includes("20.0 Hz") && s1.mKv.includes("分开 1.5 Hz") && s1.outs[2] === "1000 MHz", s1.mKv);
ok("棒图：四重峰 4 条线、三重峰 3 条线", await page.evaluate(() => document.querySelectorAll("#multiplet .stick-q").length === 4 && document.querySelectorAll("#multiplet .stick-t").length === 3));
ok("改场强不影响“模型 ①”，也不改变估读峰位", s1.est === base.est && s1.peaks === base.peaks);
await page.locator("#resetBtn").click(); s1 = await snapshot();
ok("“恢复默认参数”还原三个模型滑块和所有图形", s1.curve === base.curve && s1.bars === base.bars && s1.mult === base.mult && s1.outs.slice(0, 3).join() === base.outs.slice(0, 3).join());
ok("每个滑块旁都写明它改变的是演示模型还是原图显示", await page.evaluate(() => ["ctlDelay", "ctlJ", "ctlField"].every((i) => document.querySelector(`#${i} .what`).textContent.includes("演示模型")) && document.querySelector("#sZoom").closest(".control").querySelector(".what").textContent.includes("来自原始材料")));

// ============ 5. 原图局部放大 ============
group("原图局部放大");
const viewer = () => page.evaluate(() => { const v = document.getElementById("viewer"), img = document.getElementById("zoomImg"); return { w: v.clientWidth, h: v.clientHeight, x0: +v.dataset.x0, y0: +v.dataset.y0, scale: +v.dataset.scale, imgW: parseFloat(img.style.width), pix: v.classList.contains("pix"), ringHidden: document.getElementById("zoomRing").hidden, caption: document.getElementById("zoomCaption").textContent, info: document.getElementById("zoomInfo").innerText, natural: img.naturalWidth + "x" + img.naturalHeight }; });
await page.evaluate(() => window.__select(2));
let v = await viewer();
ok("局部放大用的是同一张原图（1888 × 935）", v.natural === "1888x935");
await page.locator("#sZoom").fill("1"); v = await viewer();
ok("1×：显示整个面板区域（含投影与刻度）", near(v.w / v.scale, 503, 1.5) && near(v.x0, 804, 1) && v.caption.includes("常规 HSQC 面板"), v);
await page.locator("#sZoom").fill("8"); const v8 = await viewer();
ok("8×：视野缩小为 1/8，并以所选峰为中心", near(v8.scale / v.scale, 8, 0.01) && near(v8.x0 + v8.w / v8.scale / 2, est[2].hsqc.px[0], 0.6) && near(v8.y0 + v8.h / v8.scale / 2, est[2].hsqc.px[1], 0.6) && v8.pix, v8);
await page.locator("#sZoom").fill("2");
await page.locator('#viewBtns button[data-view="edited"]').click(); v = await viewer();
ok("切到“编辑 HSQC 面板”：区域与定位随之改变，并报告原图颜色", v.caption.includes("编辑 HSQC 面板") && v.x0 > 1250 && v.info.includes("红色") && await page.locator('#viewBtns button[data-view="edited"]').getAttribute("aria-pressed") === "true", v);
await page.locator('#viewBtns button[data-view="struct"]').click(); v = await viewer();
ok("切到“结构式”：定位圈落在原图骨架式的对应顶点", v.caption.includes("结构式") && !v.ringHidden && v.info.includes("人工标注"), v);
await page.locator('#viewBtns button[data-view="hsqc"]').click();
await page.locator("#showRing").uncheck(); ok("取消“显示定位圈”后原图上没有任何叠加标记", (await viewer()).ringHidden && await page.locator("#zoomTag").isHidden());
await page.locator("#showRing").check();
ok("放大与切换不改变估读数值", (await snapshot()).est === base.est);

// ============ 6. 术语注释与官能团小图 ============
group("术语注释与官能团小图");
const termInfo = await page.evaluate(() => ({ n: document.querySelectorAll("button.term").length, keys: [...new Set([...document.querySelectorAll("button.term")].map((b) => b.dataset.term))], gloss: document.querySelectorAll("#glossaryList > div").length, all: TERMS.length, missing: [...new Set([...document.querySelectorAll("button.term")].map((b) => b.dataset.term))].filter((k) => !document.getElementById("term-" + k)), zhOnly: TERMS.every((t) => /[\u4e00-\u9fff]/.test(t.def) && t.en) }));
ok(`正文中有 ${termInfo.n} 处可点术语，覆盖 ${termInfo.keys.length} 个不同术语`, termInfo.n >= 80 && termInfo.keys.length >= 36, termInfo);
ok(`术语表完整（${termInfo.gloss} 条），正文里每个术语都能在表中找到`, termInfo.gloss === termInfo.all && termInfo.all >= 40 && termInfo.missing.length === 0 && termInfo.zhOnly, termInfo.missing);
const term = page.locator('#conclusion button.term[data-term="crosspeak"]').first();
await term.scrollIntoViewIfNeeded(); await term.click();
ok("点按术语：弹出中文注释，aria-expanded 变为 true", await page.locator("#termPop").isVisible() && (await page.locator("#termPopTitle").textContent()) === "交叉峰" && (await term.getAttribute("aria-expanded")) === "true" && (await page.locator("#termPopBody").innerText()).includes("直接相连"));
await page.keyboard.press("Escape");
ok("Esc 关闭注释并把焦点还给术语", await page.locator("#termPop").isHidden() && (await term.getAttribute("aria-expanded")) === "false" && await page.evaluate(() => document.activeElement.dataset.term === "crosspeak"));
await page.keyboard.press("Enter");
ok("键盘：术语上按 Enter 打开注释，焦点进入注释框", await page.locator("#termPop").isVisible() && await page.evaluate(() => document.activeElement.id === "termPop"));
await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
ok("注释框内 Tab 可到“关闭”和“在术语表中查看”", await page.evaluate(() => document.activeElement.id === "termPopMore" && document.activeElement.getAttribute("href") === "#term-crosspeak"));
await page.keyboard.press("Tab");
ok("继续 Tab 离开注释框：自动关闭并回到术语", await page.locator("#termPop").isHidden() && await page.evaluate(() => document.activeElement.dataset.term === "crosspeak"));
await term.click(); await page.locator("header h1").click({ position: { x: 5, y: 5 } });
ok("点注释框外的空白处关闭", await page.locator("#termPop").isHidden());
const ch3 = page.locator('#conclusion button.term[data-term="ch3"]').first(); await ch3.click();
const popFg = await page.evaluate(() => { const s = document.querySelector("#termPopBody .fg svg"); return s ? { bonds: s.querySelectorAll("line.bond").length, atoms: [...s.querySelectorAll("text")].map((t) => t.textContent).join("") } : null; });
ok("甲基的注释里附带结构小图：1 个 C、3 个 H、4 根键", popFg && popFg.bonds === 4 && popFg.atoms === "RCHHH", popFg);
await page.locator("#termPopMore").click();
ok("“在术语表中查看”跳到对应条目", await page.evaluate(() => location.hash === "#term-ch3" && document.getElementById("term-ch3").getBoundingClientRect().top < innerHeight) && await page.locator("#termPop").isHidden());
await page.evaluate(() => window.__select(5));
const rowTerm = page.locator('#assignRows tr[data-id="1"] button.term').first(); await rowTerm.scrollIntoViewIfNeeded(); await rowTerm.click();
ok("点表格行里的术语只打开注释，不改变选中的对象", (await sel(page)) === 5 && await page.locator("#termPop").isVisible());
await page.keyboard.press("Escape");
await rowTerm.focus(); await page.keyboard.press("Enter");
ok("键盘打开表格行里的术语同样不改变选中对象", (await sel(page)) === 5 && await page.locator("#termPop").isVisible());
await page.keyboard.press("Escape");
ok("读数区每次重写后术语仍可点（动态内容重新加注释）", await page.evaluate(() => { window.__select(4); return document.querySelectorAll("#explain button.term").length >= 3 && document.querySelectorAll("#readout button.term").length >= 1; }));
const fgs = await page.evaluate(() => { const kinds = {}; for (const [k, g] of Object.entries(FG)) kinds[k] = { atoms: g.atoms.length, bonds: g.bonds.length }; const dom = [...document.querySelectorAll(".fg")].filter((f) => !f.closest("[hidden]")).map((f) => ({ label: f.getAttribute("aria-label"), role: f.getAttribute("role"), lines: f.querySelectorAll("line.bond").length, texts: f.querySelectorAll("text").length, cap: f.querySelector(".cap").textContent, w: f.querySelector("svg").getBoundingClientRect().width })); return { kinds, n: dom.length, bad: dom.filter((d) => d.role !== "img" || !d.label || d.lines < 3 || d.texts < 4 || !d.cap || d.w < 60) }; });
ok(`官能团小结构图共 ${fgs.n} 处，每张都画出原子和键，并有文字说明`, fgs.n >= 25 && fgs.bad.length === 0, fgs.bad.slice(0, 3));
ok("小结构图的原子与键数正确：甲基 5/4、亚甲基 5/4、羰基 4/3（含 1 根双键）、乙基 8/7、丁基 14/13", fgs.kinds.ch3.atoms === 5 && fgs.kinds.ch3.bonds === 4 && fgs.kinds.ch2.bonds === 4 && fgs.kinds.co.atoms === 4 && fgs.kinds.co.bonds === 3 && fgs.kinds.ethyl.atoms === 8 && fgs.kinds.ethyl.bonds === 7 && fgs.kinds.butyl.atoms === 14 && fgs.kinds.butyl.bonds === 13 && await page.evaluate(() => { const s = document.querySelector('.fg[aria-label^="酮羰基"] svg'); return s.querySelectorAll("line.bond").length === 4; }), fgs.kinds);
ok("结构图：7 个碳、14 个氢、1 个氧，6 根碳–碳键和 1 根双键都画出", await page.evaluate(() => { const s = document.getElementById("structure"); return s.querySelectorAll(".atom").length === 7 && s.querySelectorAll(".htext").length === 14 && s.querySelectorAll(".otext").length === 1 && s.querySelectorAll("line.bond").length === 8 && s.querySelectorAll(".hbond").length === 14; }));
ok("中英文对照表 12 行，原图英文逐条对应中文", await page.evaluate(() => { const rows = [...document.querySelectorAll("#biRows tr")]; return rows.length === 12 && rows.every((r) => r.children[0].textContent.trim() && /[\u4e00-\u9fff]/.test(r.children[1].textContent)) && rows.some((r) => r.children[0].textContent.includes("multiplicity")); }));

// ============ 7. 原图 ============
group("原图保留与展开");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const b64 = html.match(/id="origFull" src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/)[1];
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const shaEmbedded = sha(Buffer.from(b64, "base64")), shaFile = sha(fs.readFileSync(path.join(here, "original.png")));
ok("内嵌原图与 source/original.png 逐字节相同（未改动）", shaEmbedded === shaFile, [shaEmbedded, shaFile]);
ok("原图只内嵌一份（其余位置在运行时复用）", html.split("data:image/png;base64,").length === 2);
ok("完整原图默认可见，等比例显示", await page.evaluate(() => { const i = document.getElementById("origFull"), r = i.getBoundingClientRect(); return i.naturalWidth === 1888 && i.naturalHeight === 935 && r.width > 300 && Math.abs(r.width / r.height - 1888 / 935) < 0.01; }));
await page.locator("#origDetails summary").focus(); await page.keyboard.press("Enter");
ok("键盘展开“按原始尺寸查看”：原图 1888 px 宽，在框内滚动", await page.evaluate(() => { const d = document.getElementById("origDetails"), i = document.getElementById("origNative"), s = document.getElementById("origScroll"); return d.open && i.getBoundingClientRect().width === 1888 && s.scrollWidth > s.clientWidth && document.documentElement.scrollWidth <= innerWidth; }));
const popupP = page.waitForEvent("popup"); await page.locator("#openOriginal").click(); const popup = await popupP; await popup.waitForLoadState("domcontentloaded");
ok("“在新窗口打开原图”可用", await popup.locator("img").count() === 1 && await popup.evaluate(() => document.images[0].naturalWidth === 1888));
await popup.close();
await page.locator("#origDetails summary").click(); ok("再次点击可以收起", await page.evaluate(() => !document.getElementById("origDetails").open));
ok("外部链接只在点击时访问（都是普通 <a>，新标签打开）", await page.evaluate(() => [...document.querySelectorAll('a[href^="http"]')].length === 2 && [...document.querySelectorAll('a[href^="http"]')].every((a) => a.target === "_blank" && a.rel.includes("noopener"))));
await page.close();

// ============ 8. 多种宽度的布局 ============
const layouts = [];
for (const width of [1440, 1100, 900, 390, 320]) {
  group(`布局 ${width} px`);
  page = await open(width, width > 760 ? 900 : 780);
  await page.evaluate(helpers);
  for (const pick of [2, 7, 3]) {
    await page.evaluate((i) => window.__select(i), pick);
    const L = await page.evaluate(() => window.__qa.layout());
    if (pick === 2) layouts.push({ width, scrollWidth: L.scrollW, structure: await page.locator("#structure").getAttribute("data-layout"), controls: await page.evaluate(() => document.body.dataset.controls), pageHeight: await page.evaluate(() => document.documentElement.scrollHeight) });
    ok(`选 C${pick}：页面无横向溢出`, L.scrollW <= width && L.overflowing.length === 0, L.overflowing.slice(0, 5));
    ok(`选 C${pick}：图中文字没有被裁切`, L.svgClipped.length === 0, L.svgClipped.slice(0, 5));
    ok(`选 C${pick}：图中文字互不重叠`, L.svgOverlap.length === 0, L.svgOverlap.slice(0, 6));
    ok(`选 C${pick}：图中文字不小于 9.5 px`, L.svgSmall.length === 0, L.svgSmall.slice(0, 5));
    if (pick === 2) { ok("官能团小图完整显示、没有被压缩", L.fgOverflow.length === 0, L.fgOverflow.slice(0, 4)); ok("公式不超出容器", L.katexOverflow.length === 0, L.katexOverflow); ok("图片全部加载", L.images); }
  }
  // 滑块两端时图中文字同样不能重叠或裁切
  for (const [id, val] of [["sDelay", "0"], ["sDelay", "12"], ["sJ", "170"], ["sField", "100"], ["sField", "1000"]]) { await page.locator("#" + id).fill(val); }
  for (const combo of [{ sDelay: "0", sJ: "110", sField: "100" }, { sDelay: "5.9", sJ: "170", sField: "1000" }]) {
    for (const [id, val] of Object.entries(combo)) await page.locator("#" + id).fill(val);
    const L = await page.evaluate(() => window.__qa.layout());
    ok(`滑块取 ${JSON.stringify(combo)} 时图中文字不裁切、不重叠`, L.svgClipped.length === 0 && L.svgOverlap.length === 0 && L.scrollW <= width, [...L.svgClipped, ...L.svgOverlap].slice(0, 6));
  }
  await page.locator("#resetBtn").click();
  const mobile = width <= 760;
  ok(mobile ? "手机：单列纵向排列，结构改为竖排" : "结构排布与可用宽度匹配（不足 640 px 时竖排，且竖排不超过 400 px 宽）", await page.evaluate((m) => { const svg = document.getElementById("structure"), s = svg.dataset.layout, avail = svg.parentElement.clientWidth - 34; if (!m) return s === (avail < 640 ? "narrow" : "wide") && (s === "wide" || svg.getBoundingClientRect().width <= 400); const r = (q) => document.querySelector(q).getBoundingClientRect(); return s === "narrow" && r(".col.center").top >= r(".col.left").bottom - 1 && r(".col.right").top >= r(".col.center").bottom - 1; }, mobile));
  ok(mobile ? "手机：模型滑块移到对应图形上方，仍可操作" : "模型滑块在左栏参数面板内", await page.evaluate((m) => m ? !!document.querySelector("#slotEdit #sDelay") && !!document.querySelector("#slotEdit #sJ") && !!document.querySelector("#slotField #sField") && document.querySelector("#slotEdit").getBoundingClientRect().bottom <= document.querySelector("#editCurve").getBoundingClientRect().top + 1 : document.querySelectorAll("#paramsHome input[type=range]").length === 3, mobile));
  if (mobile) {
    await page.locator("#sDelay").fill("0");
    ok("手机：移动后的滑块仍然驱动模型", await page.evaluate(() => document.getElementById("editStatus").dataset.state === "same"));
    await page.locator("#resetBtn").click();
    await page.locator("#nextBtn").click(); await page.locator("#nextBtn").click();
    ok("手机：顶部“当前对象”条可用 ‹ › 切换", (await sel(page)) === 5 && (await page.locator("#nowText").innerText()).includes("C5") && await page.locator("#nowbar").isVisible());
    ok("手机：归属表改为卡片，每个单元格带栏目名", await page.evaluate(() => getComputedStyle(document.querySelector("#assignRows td")).display === "grid" && [...document.querySelectorAll("#assignRows td")].every((td) => td.dataset.label)));
    // 页面右缘附近的术语：注释框不得超出屏幕
    const edge = await page.evaluate(() => { let best = null; for (const b of document.querySelectorAll("main button.term")) { const r = b.getBoundingClientRect(); if (r.width && (!best || r.right > best.r)) best = { r: r.right, key: b.dataset.term, i: [...document.querySelectorAll("main button.term")].indexOf(b) }; } return best; });
    const eb = page.locator("main button.term").nth(edge.i); await eb.scrollIntoViewIfNeeded(); await eb.click();
    const pr = await page.evaluate(() => { const r = document.getElementById("termPop").getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, fg: [...document.querySelectorAll("#termPop .fg")].every((f) => f.getBoundingClientRect().right <= r.right) }; });
    ok("手机：靠近屏幕右缘的术语，其注释框完整留在屏幕内", pr.l >= 0 && pr.r <= pr.vw && pr.sw <= width && pr.fg, pr);
    await page.keyboard.press("Escape");
    const ab = page.locator('main button.term[data-term="alpha"]').first(); await ab.scrollIntoViewIfNeeded(); await ab.click();
    const pa = await page.evaluate(() => { const r = document.getElementById("termPop").getBoundingClientRect(), f = document.querySelector("#termPop .fg svg").getBoundingClientRect(); return { ok: r.left >= 0 && r.right <= document.documentElement.clientWidth && f.right <= r.right && f.width >= 110, f: f.width }; });
    ok("手机：带结构小图的注释（α 位）清晰且不溢出", pa.ok, pa);
    await page.keyboard.press("Escape");
    await page.locator("#origDetails summary").click();
    ok("手机：展开原始尺寸原图后页面仍无横向溢出", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById("origScroll").scrollWidth > document.getElementById("origScroll").clientWidth));
    await page.locator("#origDetails summary").click();
    ok("手机：原图局部放大可用", await page.evaluate(() => { const v = document.getElementById("viewer"); return v.clientWidth > 200 && v.clientHeight > 180 && !document.getElementById("zoomRing").hidden; }));
  } else {
    ok("桌面 / 平板：粘性面板内容没有被视口截断（900 px 高）", await page.evaluate(() => [...document.querySelectorAll(".stick")].every((s) => getComputedStyle(s).position !== "sticky" || s.scrollHeight <= s.clientHeight + 1 || getComputedStyle(s).overflowY === "auto")));
  }
  // 整页预览：把视口拉到整页高度再截图，粘性面板显示完整
  if ([1440, 390, 320].includes(width)) {
    await page.evaluate(() => window.__select(2));
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height: Math.min(h, 16000) });
    await page.waitForTimeout(150);
    const file = width === 1440 ? "preview.png" : `preview-${width}.png`;
    await page.screenshot({ path: path.join(root, file), fullPage: true });
    ok(`已生成整页预览 ${file}`, fs.statSync(path.join(root, file)).size > 100000);
  }
  await page.close();
}

// ============ 9. 仓库目录 ============
group("仓库目录");
const rootIndex = path.resolve(root, "../../index.html");
if (fs.existsSync(rootIndex)) {
  page = await open(1440); await page.goto(pathToFileURL(rootIndex).href);
  ok("仓库目录页链接到本专题", await page.locator('a[href="./topics/hsqc-edited-heptanone/index.html"]').count() === 1);
  await page.locator('a[href="./topics/hsqc-edited-heptanone/index.html"]').click(); await page.waitForSelector("body[data-ready='1']");
  ok("从目录页点进来能打开本页", (await page.title()).includes("3-庚酮"));
  await page.close();
}

group("全程");
ok("没有脚本错误或控制台警告", errors.length === 0, errors.slice(0, 5));
ok("没有任何网络请求（完全离线）", external.length === 0, external.slice(0, 5));

const failed = results.filter((r) => !r.pass);
// 同一份 index.html 若已被别的浏览器版本验收通过，把那次的浏览器也记下来
const pageSha256 = sha(Buffer.from(html, "utf8")), thisBrowser = "Chromium " + await browser.version() + " (" + path.basename(findBrowser()) + ")";
let browsersPassed = [];
try { const prev = JSON.parse(fs.readFileSync(path.join(root, "verification.json"), "utf8")); if (prev.pageSha256 === pageSha256 && prev.status === "passed") browsersPassed = prev.browsersPassed || []; } catch { /* 没有旧记录 */ }
if (!failed.length && !browsersPassed.includes(thisBrowser)) browsersPassed.push(thisBrowser);
const report = { status: failed.length ? "failed" : "passed", total: results.length, passed: results.length - failed.length, browser: thisBrowser, browsersPassed, pageSha256, viewportsTested: [1440, 1100, 900, 390, 320], originalSha256: shaFile, selftest: st, layouts, errors, external, results };
fs.writeFileSync(path.join(root, "verification.json"), JSON.stringify(report, null, 2) + "\n");
await browser.close();
console.log(`\n${report.passed}/${report.total} 项通过（${report.browser}）`);
if (failed.length) { console.log("未通过：\n" + failed.map((f) => `  [${f.group}] ${f.name}`).join("\n")); process.exit(1); }
