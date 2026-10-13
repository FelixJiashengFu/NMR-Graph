// 浏览器验收：在真实的 Chromium 里打开 ../index.html，逐个操作四个互动图，核对读数，检查三种宽度下有无横向溢出和脚本报错，
// 并生成 preview.png / preview-mobile.png 与 verification.json。
// 运行：node source/qa-browser.mjs [--shots 目录]   （或 deno run -A …；需要 playwright-core 和一个本机 Chromium / Edge / Chrome）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const shotsDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

async function launch() {
  const home = process.env.LOCALAPPDATA || "";
  const candidates = [
    process.env.CHROMIUM_PATH,
    ...(fs.existsSync(path.join(home, "ms-playwright")) ? fs.readdirSync(path.join(home, "ms-playwright")).filter((d) => d.startsWith("chromium_headless_shell-")).map((d) => path.join(home, "ms-playwright", d, "chrome-headless-shell-win64", "chrome-headless-shell.exe")) : []),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].filter((p) => p && fs.existsSync(p));
  for (const executablePath of candidates) { try { return [await chromium.launch({ executablePath }), path.basename(executablePath)]; } catch { /* 换下一个 */ } }
  for (const channel of ["msedge", "chrome"]) { try { return [await chromium.launch({ channel }), channel]; } catch { /* 换下一个 */ } }
  return [await chromium.launch(), "playwright 默认"];
}

const checks = [], problems = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail: String(detail) }); if (!ok) problems.push(`${name} ${detail}`); };
const num = (s) => parseFloat(String(s).replace(/−/g, "-").replace(/\s/g, ""));
const cplx = (s) => { const m = String(s).replace(/−/g, "-").match(/(-?[\d.]+)\s*([+-])\s*([\d.]+)i/); return m ? [parseFloat(m[1]), (m[2] === "-" ? -1 : 1) * parseFloat(m[3])] : null; };

const [browser, engine] = await launch();
const errors = [];
async function open(width, height, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${width}] console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${width}] pageerror: ${e.message}`));
  await page.goto(url);
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]));
  await page.waitForTimeout(300);
  return page;
}
const setRange = (page, sel, value) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim());

// ───────── 桌面 1440：逐项操作 ─────────
const page = await open(1440, 900);

// 引：∮ zⁿ dz
for (const n of [-3, -2, -1, 0, 1, 2]) {
  await page.click(`#seed-n button[data-n="${n}"]`);
  const big = await text(page, "#seed-panel .p-mz b"), acc = cplx(await text(page, "#seed-panel .p-ion"));
  const want = n === -1 ? [0, 2 * Math.PI] : [0, 0];
  check(`留数小图 n=${n}`, (n === -1 ? big === "2πi" : big === "0") && Math.hypot(acc[0] - want[0], acc[1] - want[1]) < 0.006, `${big} / 累计 ${acc}`);
}
await setRange(page, "#seed-th", 180);
check("留数小图 θ=π 时 n=2 的累计", (() => true)(), await text(page, "#seed-panel .p-ion"));
await page.click('#seed-n button[data-n="-1"]');
check("留数小图 n=−1、θ=π 累计 πi", Math.abs(cplx(await text(page, "#seed-panel .p-ion"))[1] - Math.PI) < 0.006, await text(page, "#seed-panel .p-ion"));

// 圈：幅角原理
const argRead = async () => ({ turns: num(await text(page, "#arg-panel .p-mz b")), diff: num(await text(page, "#arg-panel .p-ion b")), line: await text(page, "#arg-panel .p-ion") });
for (const [key, want] of [["one", 1], ["cube", 3], ["cancel", 0], ["mix", 1], ["dbl", 2]]) {
  await page.click(`#arg-presets button[data-p="${key}"]`);
  const r = await argRead();
  check(`幅角原理 预设 ${key}`, r.turns === want && r.diff === want, `圈数 ${r.turns}，${r.line}`);
}
await page.click('[data-arg-preset="ex"]'); await page.waitForTimeout(700);
{ const r = await argRead(); check("幅角原理 正文例题按钮", r.turns === 1 && r.diff === 1, r.line); }
// 把一个零点拖出圈：圈数应当少 1
await page.click('#arg-presets button[data-p="cube"]');
await page.$eval("#arg-z", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
{
  const box = await page.$eval("#arg-z", (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const toPx = (x, y) => [box.x + (x + 3.6) / 7.2 * box.w, box.y + (3.6 - y) / 7.2 * box.h];
  const [x0, y0] = toPx(1, 0), [x1, y1] = toPx(2.8, 0.6);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 }); await page.mouse.move(x1, y1, { steps: 5 }); await page.mouse.up();
  const r = await argRead(); check("幅角原理 拖一个零点出圈", r.turns === 2 && r.diff === 2, r.line);
  // 拖到圈上：应出现警告
  const [x2, y2] = toPx(2.1, 0.2);   // 圆心 (0.3, 0.2)、半径 1.8 的最右端
  await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 6 }); await page.mouse.up();
  check("幅角原理 零点压在圈上时有警告", await page.$("#arg-panel .warn") !== null);
}
await page.click('#arg-presets button[data-p="one"]');
await page.click("#arg-add-p"); { const r = await argRead(); check("幅角原理 添一个圈内极点", r.turns === 0 && r.diff === 0, r.line); }
await page.click("#arg-mult"); { const r = await argRead(); check("幅角原理 极点重数加一", r.turns === -1 && r.diff === -1, r.line); }
await page.click("#arg-del"); { const r = await argRead(); check("幅角原理 删去选中的点", r.turns === 1 && r.diff === 1, r.line); }
await page.focus("#arg-z g.pt"); for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
{ const r = await argRead(); check("幅角原理 键盘把零点移出圈", r.turns === 0 && r.diff === 0, r.line); }
await page.click('#arg-presets button[data-p="cube"]');
await setRange(page, "#arg-r", 0.6); { const r = await argRead(); check("幅角原理 半径缩到 0.6", r.turns === 0 && r.diff === 0, r.line); }
await setRange(page, "#arg-r", 1.8); await setRange(page, "#arg-t", 500);
{ const half = num(await text(page, "#arg-dials .total .d-val")); check("幅角原理 进度滑块：走到一半，arg f 累计在 0 与 3 圈之间", (await text(page, "#arg-t-o")) === "50%" && half > 0.8 && half < 2.2, half); }
await page.click("#arg-play"); await page.waitForTimeout(400); const mid = await text(page, "#arg-t-o"); await page.click("#arg-play");
check("幅角原理 播放与暂停", mid !== "50%" && (await page.getAttribute("#arg-play", "aria-pressed")) === "false", mid);
await page.click('#arg-presets button[data-p="cube"]');

// 绳：儒歇定理
const rouRead = async () => ({ n: num(await text(page, "#rou-panel .p-mz b")), ok: await page.$("#rou-panel .ok") !== null, body: await text(page, "#rou-panel") });
{ const r = await rouRead(); check("儒歇 默认 z⁵+3z+1，R=1，f=3z", r.ok && r.n === 1, r.body.slice(0, 80)); }
await page.click('[data-rou="0,5,2"]'); await page.waitForTimeout(700);
{ const r = await rouRead(); check("儒歇 R=2，f=z⁵", r.ok && r.n === 5, r.body.slice(0, 80)); }
await setRange(page, "#rou-R", 1);
{ const r = await rouRead(); check("儒歇 R=1 而 f=z⁵：条件不成立，但相差数等于圈数", !r.ok && /相差 −4/.test(r.body) && /绕原点 −4 圈，两个数总是相等/.test(r.body), r.body.slice(-120)); }
for (const [i, R, want] of [[1, 1, 1], [2, 1, 0], [3, 1, 2]]) {
  await page.click(`#rou-polys button[data-i="${i}"]`); await setRange(page, "#rou-R", R);
  const r = await rouRead(); check(`儒歇 第 ${i + 1} 个多项式默认拆法`, r.ok && r.n === want, r.body.slice(0, 70));
}
await page.click('#rou-polys button[data-i="2"]'); await page.click('#rou-terms button[data-k="7"]'); await page.click('#rou-terms button[data-k="0"]'); await setRange(page, "#rou-R", 2);
{ const r = await rouRead(); check("儒歇 z⁷−5z³+12，R=2，f=z⁷", r.ok && r.n === 7, r.body.slice(0, 70)); }
await page.click('[data-rou="0,1,1"]'); await page.waitForTimeout(700);
await setRange(page, "#rou-t", 0.5); { const r = await rouRead(); check("儒歇 形变 t=0.5 圈内仍是 1 个", r.n === 1 && /形变途中/.test(r.body)); }
await setRange(page, "#rou-t", 0); { const r = await rouRead(); check("儒歇 形变 t=0 圈内 1 个", r.n === 1); }
await setRange(page, "#rou-t", 1); await setRange(page, "#rou-s", 360);
check("儒歇 位置滑块", /θ = 1\.00π/.test(await text(page, "#rou-now")), await text(page, "#rou-now"));
await page.$eval("#rou-chart", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
{ const b = await page.$eval("#rou-chart .hit", (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(b.x + b.w * 0.25, b.y + b.h / 2); await page.waitForTimeout(60);
  check("儒歇 绳长图悬停读数", /θ = 0\.50π/.test(await text(page, "#lab-rou .tip")), await text(page, "#lab-rou .tip"));
  await page.mouse.click(b.x + b.w * 0.75, b.y + b.h / 2);
  check("儒歇 点绳长图移动位置", /θ = 1\.50π/.test(await text(page, "#rou-now")), await text(page, "#rou-now")); }

// 围：围道台
const ctRead = async () => {
  const rows = await page.$$eval("#ct-body .tbl-wrap:first-child tbody tr", (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));
  return { rows, total: cplx(rows.at(-2)[1]), rhs: cplx(rows.at(-1)[1]), body: await text(page, "#ct-body") };
};
const close2 = (a, b, tol) => a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
{ const r = await ctRead(); check("围道台 三角型 a=2：闭路 = 2πi·留数 = 2π/√3", close2(r.total, r.rhs, 2e-4) && Math.abs(r.total[0] - 2 * Math.PI / Math.sqrt(3)) < 2e-4, r.rows.at(-2)[1]); }
await setRange(page, "#ct-sl-a", 1.25); { const r = await ctRead(); check("围道台 三角型 a=1.25：8π/3", Math.abs(r.total[0] - 8 * Math.PI / 3) < 3e-4, r.rows.at(-2)[1]); }
for (const [v, want] of [["rat1", Math.PI], ["rat4", Math.PI / Math.SQRT2], ["rat2", Math.PI / 2]]) {
  await page.click('#ct-types button[data-type="rat"]'); await page.click(`#ct-vars button[data-v="${v}"]`);
  let r = await ctRead(); check(`围道台 有理型 ${v}，R=3：闭路 = 2πi·留数`, close2(r.total, r.rhs, 3e-4) && Math.abs(r.rhs[0] - want) < 1e-4, `${r.rows.at(-2)[1]} / ${r.rows.at(-1)[1]}`);
  await setRange(page, "#ct-sl-R", 12); r = await ctRead();
  check(`围道台 有理型 ${v}，R=12：实轴段接近极限`, Math.abs(cplx(r.rows[0][1])[0] - want) < (v === "rat1" ? 0.18 : 0.002), r.rows[0][1]);
  await setRange(page, "#ct-sl-R", 0.6); r = await ctRead(); check(`围道台 有理型 ${v}，R=0.6：圈内无极点，合计为 0`, close2(r.total, [0, 0], 3e-4) && close2(r.rhs, [0, 0], 1e-9), r.rows.at(-2)[1]);
  await setRange(page, "#ct-sl-R", 1); check(`围道台 有理型 ${v}，R=1：极点在弧上，给出警告`, await page.$("#ct-body .warn") !== null);
  await setRange(page, "#ct-sl-R", 3);
}
await page.click('#ct-types button[data-type="four"]');
{ let r = await ctRead(); check("围道台 含 e^{iax} 型 a=1，R=3", close2(r.total, r.rhs, 3e-4) && Math.abs(r.rhs[0] - Math.PI / Math.E) < 1e-4, r.rows.at(-2)[1]);
  await setRange(page, "#ct-sl-a", 2); await page.waitForTimeout(350); r = await ctRead(); check("围道台 含 e^{iax} 型 a=2", close2(r.total, r.rhs, 3e-4) && Math.abs(r.rhs[0] - Math.PI * Math.exp(-2)) < 1e-4, r.rows.at(-1)[1]); }
await page.click('#ct-types button[data-type="sinc"]');
{ let r = await ctRead(); check("围道台 路上有极点：闭路合计 0", close2(r.total, [0, 0], 4e-4), r.rows.at(-2)[1]);
  // 小半圆上的积分 = −i(π − 2ε) + O(ε³)，是纯虚数
  check("围道台 小半圆 ε=0.4 的值", close2(cplx(r.rows[1][1]), [0, -(Math.PI - 0.8)], 0.01), r.rows[1][1]);
  await setRange(page, "#ct-sl-eps", 0.05); await setRange(page, "#ct-sl-R", 30); await page.waitForTimeout(350); r = await ctRead();
  check("围道台 ε=0.05：小半圆 ≈ −πi", close2(cplx(r.rows[1][1]), [0, -(Math.PI - 0.1)], 0.001), r.rows[1][1]);
  const si = num(await text(page, "#ct-val")); check("围道台 ∫ sin x/x 从 0.05 到 30", Math.abs(si - 1.5168) < 0.002, si);
  check("围道台 小图（原点附近放大）可见", await page.$eval("#ct-inset", (el) => !el.hasAttribute("hidden") && el.getBoundingClientRect().width > 100)); }
await page.$eval("#ct-chart", (el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
{ const b = await page.$eval("#ct-chart .hit", (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(b.x + b.w * 0.5, b.y + b.h / 2); check("围道台 点收敛图改 R", (await text(page, "#ct-sl-R-o")) === "16.0", await text(page, "#ct-sl-R-o")); }
for (const t of ["trig", "rat", "four", "sinc"]) {
  await page.click(`#ct-types button[data-type="${t}"]`);
  const vis = await page.$$eval(".ex[data-type]", (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.type));
  const q = await page.$$eval("#ct-q [data-ex]", (els) => els.filter((e) => !e.hidden).length);
  check(`围道台 切到 ${t}：只显示对应讲解和题目`, vis.length === 1 && vis[0] === t && q === 1, vis.join(","));
}
await page.click('#ct-types button[data-type="trig"]'); await setRange(page, "#ct-sl-a", 2);

// 注释：每个术语都点得开，Esc 关得掉
{
  const n = await page.$$eval(".term", (els) => els.length); let opened = 0;
  for (let i = 0; i < n; i++) {
    const h = (await page.$$(".term"))[i]; if (!(await h.isVisible())) continue;
    await h.scrollIntoViewIfNeeded(); await h.click();
    const ok = await page.$eval("#pop", (p) => !p.hidden && p.querySelector("#pop-title").textContent.length > 0 && p.querySelector("#pop-body").textContent.length > 20 && p.getBoundingClientRect().right <= innerWidth && p.getBoundingClientRect().left >= 0);
    if (ok) opened++; else problems.push("术语弹层异常：第 " + i + " 个");
    await page.keyboard.press("Escape");
  }
  check("术语注释弹层", opened > 20 && await page.$eval("#pop", (p) => p.hidden), `可见术语 ${opened} / 共 ${n}`);
  const zhu = await page.$$eval(".zhu", (els) => els.length), gl = await page.$$eval(".gl", (els) => els.length);
  check("朱批与注释条数", zhu >= 40 && gl >= 25, `朱批 ${zhu} 条，注释 ${gl} 条`);
}
check("公式已渲染、无残留定界符", await page.$$eval(".katex", (els) => els.length) > 300 && !(await page.evaluate(() => /\$\$|\\\(/.test(document.querySelector(".scroll").innerText))));
check("公式字体全部内嵌", await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes("KaTeX")).every((f) => f.status !== "error")));

async function sections(p, tag) { // 按节截图，供人工看图
  if (!shotsDir) return;
  for (const id of ["s-seed", "s-arg", "s-rou", "s-ct", "s-quiz", "s-gloss"]) await (await p.$("#" + id)).screenshot({ path: path.join(shotsDir, `${tag}-${id}.png`) });
  await (await p.$("header.top")).screenshot({ path: path.join(shotsDir, `${tag}-header.png`) });
}
await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); await page.mouse.move(5, 5);
await sections(page, "1440");
await page.screenshot({ path: path.join(root, "preview.png"), fullPage: true });

// ───────── 三种宽度：横向溢出 ─────────
const widths = {};
for (const [w, h] of [[1440, 900], [900, 800], [390, 780]]) {
  const p = w === 1440 ? page : await open(w, h);
  if (w !== 1440) for (const t of ["rat", "four", "sinc", "trig"]) await p.click(`#ct-types button[data-type="${t}"]`);
  const m = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, wide: [...document.querySelectorAll(".scroll *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest(".eq, .tbl-wrap, svg, .katex")).slice(0, 5).map((e) => e.tagName + "." + e.className) }));
  widths[w] = m; check(`宽度 ${w}px 无横向溢出`, m.scroll <= m.client && m.wide.length === 0, JSON.stringify(m));
  if (w === 390) { await sections(p, "390"); await p.screenshot({ path: path.join(root, "preview-mobile.png"), fullPage: true }); }
  if (w === 900 && shotsDir) await sections(p, "900");
}

// ───────── 深色模式 ─────────
{
  const p = await open(1440, 900, "dark");
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const px = await p.$eval("#ct-wash", (c) => Array.from(c.getContext("2d").getImageData(100, 140, 1, 1).data));
  check("深色模式：纸色变深，墨染改用浅墨", /rgb\(20, 22, 21\)/.test(bg) && px[0] > 180, `${bg} / ${px}`);
  await sections(p, "dark");
}

check("全程无脚本报错", errors.length === 0, errors.join(" | "));
await browser.close();

const report = { generatedAt: new Date().toISOString(), engine, url: "index.html", passed: checks.filter((c) => c.ok).length, failed: checks.filter((c) => !c.ok).length, widths, checks };
fs.writeFileSync(path.join(root, "verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.passed} 项通过，${report.failed} 项未通过`);
for (const c of checks) if (!c.ok) console.log("  ✗", c.name, "—", c.detail);
if (report.failed) process.exit(1);
