// 独立数值核对：计数、不饱和度、像素定标、估读一致性、编辑延迟模型、单位换算、裂分模型。
// 运行：node source/verify-numbers.mjs   （或 deno run -A source/verify-numbers.mjs）
// 结果写入 ../numerical-verification.json；任何一项不通过都会以非零状态退出。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// 直接执行页面内嵌的同一份 model.js，保证“被核对的代码”就是“网页里运行的代码”
const M = new Function(fs.readFileSync(path.join(here, "model.js"), "utf8") + "\nreturn HSQCModel;")();
const measure = JSON.parse(fs.readFileSync(path.join(here, "measure.json"), "utf8"));

const checks = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function check(group, name, pass, detail) { checks.push({ group, name, pass: !!pass, detail }); }

// ---------- 1. 理论计数 ----------
const c = M.counts();
check("理论计数", "碳数 = 7", c.carbons === 7 && c.carbons === M.FORMULA.C, c.carbons);
check("理论计数", "氢数 2×3 + 4×2 = 14，等于分子式 H 数", c.hydrogens === 14 && 2 * 3 + 4 * 2 === 14 && c.hydrogens === M.FORMULA.H, c.hydrogens);
check("理论计数", "CH₃ 2 个、CH₂ 4 个、CH 0 个、无氢碳 1 个", c.ch3 === 2 && c.ch2 === 4 && c.ch === 0 && c.noH === 1, c);
check("理论计数", "带氢碳 = 7 − 1 = 6 = 预期 HSQC 交叉峰数", c.protonated === 6 && c.expectedHsqcPeaks === 6 && c.carbons - c.noH === 6, c.protonated);
check("理论计数", "各类碳之和等于总碳数（不变量）", c.ch3 + c.ch2 + c.ch + c.noH === c.carbons, null);
check("理论计数", "不饱和度 (2×7 + 2 − 14)/2 = 1", M.dbe(M.FORMULA) === 1, M.dbe(M.FORMULA));
check("理论计数", "简单情形：乙烷 0、丙酮 1、苯 4", M.dbe({ C: 2, H: 6 }) === 0 && M.dbe({ C: 3, H: 6 }) === 1 && M.dbe({ C: 6, H: 6 }) === 4, null);
const empty = M.counts([]);
check("理论计数", "边界情形：空结构全部为 0", empty.carbons === 0 && empty.hydrogens === 0 && empty.expectedHsqcPeaks === 0, empty);
check("理论计数", "只有季碳的结构预期 0 个 HSQC 峰", M.counts([{ id: 1, h: 0 }]).expectedHsqcPeaks === 0, null);

// ---------- 2. 结构关系与经验加和 ----------
const n2 = M.neighbours(2), n4 = M.neighbours(4);
check("结构关系", "C2 的 α/β/γ 位碳数 = 2/1/1", n2.alpha === 2 && n2.beta === 1 && n2.gamma === 1, n2);
check("结构关系", "C4 的 α/β/γ 位碳数 = 2/2/2", n4.alpha === 2 && n4.beta === 2 && n4.gamma === 2, n4);
check("结构关系", "键距对称：d(C1,C7) = d(C7,C1) = 6，d(C3,C3) = 0", M.bondDistance(1, 7) === 6 && M.bondDistance(7, 1) === 6 && M.bondDistance(3, 3) === 0, null);
const extra = { beta: n4.beta - n2.beta, gamma: n4.gamma - n2.gamma, alpha: n4.alpha - n2.alpha };
const inc = M.incrementDelta(extra);
check("结构关系", "C4 比 C2 多 1 个 β、1 个 γ 位碳 → 经验增量 9.4 − 2.5 = +6.9 ppm", near(inc, 6.9, 1e-9), inc);
const S = Object.fromEntries(measure.summary.map((r) => [r.site, r]));
const predictedC4 = S.C2.dC + inc;
check("结构关系", "经验估算 δC(C4) ≈ δC(C2) + 6.9 与估读值相差 < 1.5 ppm", Math.abs(predictedC4 - S.C4.dC) < 1.5, { predicted: +predictedC4.toFixed(1), estimated: S.C4.dC, diff: +(predictedC4 - S.C4.dC).toFixed(1) });

// ---------- 3. 原图测量 ----------
const [pa, pb] = measure.images.original.panels;
check("原图观测", "常规 HSQC 面板恰好 6 个峰", pa.peaks.length === 6, pa.peaks.length);
check("原图观测", "编辑 HSQC 面板恰好 6 个峰", pb.peaks.length === 6, pb.peaks.length);
check("原图观测", "常规 HSQC 的峰全部为黑色", pa.peaks.every((p) => p.color === "black"), pa.peaks.map((p) => p.color));
const colors = pb.peaks.map((p) => p.color);
check("原图观测", "编辑 HSQC：2 黑 4 红", colors.filter((x) => x === "black").length === 2 && colors.filter((x) => x === "red").length === 4, colors);
check("原图观测", "编辑 HSQC：¹³C 最低的两个峰是黑色，其余四个是红色", colors.join() === "black,black,red,red,red,red", colors);
check("原图观测", "黑/红个数与理论 CH₃/CH₂ 个数一致（2/4）", colors.filter((x) => x === "black").length === c.ch3 + c.ch && colors.filter((x) => x === "red").length === c.ch2, null);

for (const p of [pa, pb]) {
  check("坐标定标", `${p.name}：¹H 五个主刻度线性残差 ≤ 0.01 ppm`, p.hAxis.maxResidualPpm <= 0.01, p.hAxis.maxResidualPpm);
  check("坐标定标", `${p.name}：¹³C 四点拟合残差 ≤ 0.2 ppm`, p.cAxis.maxResidualPpm <= 0.2, p.cAxis.maxResidualPpm);
  check("坐标定标", `${p.name}：边框左/右 ≈ 3.0 / 0.5 ppm（±0.02）`, near(p.hAxis.atLeft, 3.0, 0.02) && near(p.hAxis.atRight, 0.5, 0.02), [p.hAxis.atLeft, p.hAxis.atRight]);
  check("坐标定标", `${p.name}：边框上/下 ≈ 0 / 50 ppm（±0.5）`, near(p.cAxis.atTop, 0, 0.5) && near(p.cAxis.atBottom, 50, 0.5), [p.cAxis.atTop, p.cAxis.atBottom]);
  check("坐标定标", `${p.name}：向右 ¹H 变小、向下 ¹³C 变大（斜率符号）`, p.hAxis.slope < 0 && p.cAxis.slope > 0, [p.hAxis.slope, p.cAxis.slope]);
  const redo = p.peaks.every((q) => near(M.pixelToPpm(q.px, p.hAxis.slope, p.hAxis.intercept), q.dH, 1e-3) && near(M.pixelToPpm(q.py, p.cAxis.slope, p.cAxis.intercept), q.dC, 1e-2));
  check("坐标定标", `${p.name}：用斜率与截距重算每个峰，与记录值一致`, redo, null);
  check("坐标定标", `${p.name}：主刻度像素换回 ppm 得到 3.0/2.5/2.0/1.5/1.0`, p.hAxis.majorTicksPx.every((x, i) => near(M.pixelToPpm(x, p.hAxis.slope, p.hAxis.intercept), p.hAxis.labels[i], 0.01)), null);
}
check("估读一致性", "两个面板的 ¹H 估读相差 ≤ 0.02 ppm", measure.spread.maxPanelDiffH <= 0.02, measure.spread.maxPanelDiffH);
check("估读一致性", "两个面板的 ¹³C 估读相差 ≤ 0.8 ppm", measure.spread.maxPanelDiffC <= 0.8, measure.spread.maxPanelDiffC);
if (measure.images.earlier) {
  check("估读一致性", "与早期截图相比 ¹H 相差 ≤ 0.01 ppm", measure.spread.maxCaptureDiffH <= 0.01, measure.spread.maxCaptureDiffH);
  check("估读一致性", "与早期截图相比 ¹³C 相差 ≤ 0.3 ppm", measure.spread.maxCaptureDiffC <= 0.3, measure.spread.maxCaptureDiffC);
}
check("估读一致性", "页面采用值 = 两面板平均后取整（¹H 0.01，¹³C 0.1）", measure.summary.every((r) => near(r.dH, (r.hsqc.dH + r.edited.dH) / 2, 0.0051) && near(r.dC, (r.hsqc.dC + r.edited.dC) / 2, 0.051)), null);
check("估读一致性", "页面声明的不确定度（¹H ±0.03、¹³C ±0.5）覆盖面板间差异的一半", measure.spread.maxPanelDiffH / 2 <= 0.03 && measure.spread.maxPanelDiffC / 2 <= 0.5, null);
check("归属合理性", "丁基链上离羰基越远 ¹H 越小：C4 > C5 > C6 > C7", S.C4.dH > S.C5.dH && S.C5.dH > S.C6.dH && S.C6.dH > S.C7.dH, [S.C4.dH, S.C5.dH, S.C6.dH, S.C7.dH]);
check("归属合理性", "乙基一侧 C2 > C1（¹H）", S.C2.dH > S.C1.dH, [S.C2.dH, S.C1.dH]);
check("归属合理性", "两个 α-CH₂：¹H 相差 ≤ 0.05 ppm，¹³C 相差 > 5 ppm", Math.abs(S.C2.dH - S.C4.dH) <= 0.05 && Math.abs(S.C2.dC - S.C4.dC) > 5, { dH: +(S.C2.dH - S.C4.dH).toFixed(2), dC: +(S.C4.dC - S.C2.dC).toFixed(1) });
check("归属合理性", "六个峰的 (δH, δC) 两两不同", new Set(measure.summary.map((r) => r.dH + "/" + r.dC)).size === 6, null);

// ---------- 4. 演示模型 ①：编辑延迟 ----------
let okZero = true, okNull = true, okMatch = true, okBound = true, okEven = true, okOdd = true, okPeriod = true;
for (const J of [110, 125, 145, 170]) for (const n of [1, 2, 3]) {
  if (!near(M.editFactor(n, J, 0), 1, 1e-12)) okZero = false;
  if (!near(M.editFactor(n, J, M.nullDelayMs(J)), 0, 1e-12)) okNull = false;
  if (!near(M.editFactor(n, J, M.matchedDelayMs(J)), n % 2 ? -1 : 1, 1e-12)) okMatch = false;
  for (let d = 0; d <= 12; d += 0.05) {
    const f = M.editFactor(n, J, d);
    if (Math.abs(f) > 1 + 1e-12) okBound = false;
    if (n === 2 && f < -1e-12) okEven = false;
    if (n === 3 && Math.sign(f) !== Math.sign(M.editFactor(1, J, d)) && Math.abs(f) > 1e-9) okOdd = false;
    if (!near(M.editFactor(n, J, d + 2000 / J), f, 1e-9)) okPeriod = false;
  }
}
check("编辑延迟模型", "Δ = 0：CH、CH₂、CH₃ 因子都是 +1（退化为不编辑）", okZero, null);
check("编辑延迟模型", "Δ = 1/(2J)：三类因子都为 0", okNull, null);
check("编辑延迟模型", "Δ = 1/J：因子 = (−1)ⁿ → CH −1、CH₂ +1、CH₃ −1", okMatch, null);
check("编辑延迟模型", "|因子| ≤ 1", okBound, null);
check("编辑延迟模型", "CH₂ 因子 cos² 永不为负", okEven, null);
check("编辑延迟模型", "CH 与 CH₃ 始终同号", okOdd, null);
check("编辑延迟模型", "周期性：Δ 增加 2/J 后因子不变", okPeriod, null);
check("编辑延迟模型", "状态判定：Δ=1/J 反号、Δ=0 同号、Δ=1/(2J) 接近零", M.editState(125, 8) === "opposite" && M.editState(125, 0) === "same" && M.editState(125, 4) === "null", null);
const mis = { f2: M.editFactor(2, 125, 1000 / 145), f3: M.editFactor(3, 125, 1000 / 145) };
check("编辑延迟模型", "失配示例：实际 J = 125 Hz、Δ 按 145 Hz 设定 → CH₂ +0.82、CH₃ −0.75，仍然反号", near(mis.f2, 0.824, 0.002) && near(mis.f3, -0.749, 0.002), { f2: +mis.f2.toFixed(3), f3: +mis.f3.toFixed(3) });

// ---------- 5. 单位换算 ----------
check("单位换算", "1/(125 Hz) = 8.00 ms；1/(145 Hz) = 6.90 ms", near(M.matchedDelayMs(125), 8, 1e-12) && near(M.matchedDelayMs(145), 6.897, 0.001), [M.matchedDelayMs(125), +M.matchedDelayMs(145).toFixed(3)]);
check("单位换算", "1/(2 × 125 Hz) = 4.00 ms", near(M.nullDelayMs(125), 4, 1e-12), M.nullDelayMs(125));
check("单位换算", "0.02 ppm × 400 MHz = 8 Hz", near(M.ppmToHz(0.02, 400), 8, 1e-12), M.ppmToHz(0.02, 400));
check("单位换算", "ppm → Hz → ppm 往返不变", [0.02, 1, 6.4].every((x) => near(M.hzToPpm(M.ppmToHz(x, 500), 500), x, 1e-12)), null);
check("单位换算", "¹H 400 MHz 时 ¹³C 频率 ≈ 100.6 MHz", near(M.carbonMHz(400), 100.58, 0.01), +M.carbonMHz(400).toFixed(2));
const dH24 = +(S.C2.dH - S.C4.dH).toFixed(2), dC24 = +(S.C4.dC - S.C2.dC).toFixed(1);
const hz1H = M.ppmToHz(dH24, 400), hz13C = M.ppmToHz(dC24, M.carbonMHz(400));
check("单位换算", "C2/C4：¹H 相差约 8 Hz，¹³C 相差约 640 Hz（假设 400 MHz）", near(hz1H, 8, 0.5) && near(hz13C, 644, 15), { hz1H: +hz1H.toFixed(1), hz13C: +hz13C.toFixed(0), ratio: +(hz13C / hz1H).toFixed(0) });
check("单位换算", "原图 1 像素 ≈ 0.008 ppm（¹H）、≈ 0.16 ppm（¹³C）", near(measure.spread.onePixelH, 0.0077, 0.0005) && near(measure.spread.onePixelC, 0.156, 0.005), [measure.spread.onePixelH, measure.spread.onePixelC]);

// ---------- 6. 演示模型 ②：一级裂分 ----------
const q = M.multiplet(2.42, 3, 7.4, 400), t = M.multiplet(2.40, 2, 7.4, 400), s0 = M.multiplet(1, 0, 7.4, 400);
check("裂分模型", "n = 0 → 单线，位于中心", s0.length === 1 && s0[0].ppm === 1 && s0[0].weight === 1, s0);
check("裂分模型", "三重峰 1:2:1、四重峰 1:3:3:1", t.map((l) => l.weight * 4).join() === "1,2,1" && q.map((l) => l.weight * 8).join() === "1,3,3,1", null);
check("裂分模型", "强度之和 = 1，重心 = 中心位移", [q, t].every((m, i) => near(m.reduce((a, l) => a + l.weight, 0), 1, 1e-12) && near(m.reduce((a, l) => a + l.weight * l.ppm, 0), [2.42, 2.40][i], 1e-12)), null);
check("裂分模型", "相邻线间距 = J = 7.4 Hz = 0.0185 ppm（400 MHz）", near(q[0].offsetHz - q[1].offsetHz, 7.4, 1e-12) && near(q[0].ppm - q[1].ppm, 0.0185, 1e-12), null);
const q800 = M.multiplet(2.42, 3, 7.4, 800);
check("裂分模型", "换场强：Hz 间距不变，ppm 间距与频率成反比", near(q800[0].offsetHz, q[0].offsetHz, 1e-12) && near((q800[0].ppm - 2.42) * 2, q[0].ppm - 2.42, 1e-12), null);
check("裂分模型", "四重峰跨度 3J = 22.2 Hz，三重峰跨度 2J = 14.8 Hz", near(M.spanHz(3, 7.4), 22.2, 1e-9) && near(M.spanHz(2, 7.4), 14.8, 1e-9), null);
check("裂分模型", "400 MHz 时两组范围交叠 10.5 Hz；1000 MHz 时分开 1.5 Hz", near(M.overlapHz(0.02, 400, 3, 2, 7.4), 10.5, 1e-9) && near(M.overlapHz(0.02, 1000, 3, 2, 7.4), -1.5, 1e-9), [M.overlapHz(0.02, 400, 3, 2, 7.4), M.overlapHz(0.02, 1000, 3, 2, 7.4)]);
check("裂分模型", "刚好分开所需频率 = 18.5 Hz / 0.02 ppm = 925 MHz", near(M.separationMHz(0.02, 3, 2, 7.4), 925, 1e-9), M.separationMHz(0.02, 3, 2, 7.4));
check("裂分模型", "交叠量随场强单调减小", [100, 300, 500, 700, 900].every((f, i, a) => i === 0 || M.overlapHz(0.02, f, 3, 2, 7.4) < M.overlapHz(0.02, a[i - 1], 3, 2, 7.4)), null);

// ---------- 汇总 ----------
const failed = checks.filter((x) => !x.pass);
const report = {
  status: failed.length ? "failed" : "passed",
  total: checks.length, passed: checks.length - failed.length,
  keyNumbers: {
    formula: "C7H14O", counts: c, dbe: M.dbe(M.FORMULA),
    estimates: measure.summary.map((r) => ({ site: r.site, dH: r.dH, dC: r.dC, editedColor: r.edited.color })),
    spread: measure.spread,
    c2c4: { deltaH_ppm: dH24, deltaC_ppm: dC24, at400MHz_Hz: { h: +hz1H.toFixed(1), c: +hz13C.toFixed(0) }, incrementEstimate_ppm: +predictedC4.toFixed(1) },
    editModel: { matchedDelayMs_125Hz: 8, matchedDelayMs_145Hz: +M.matchedDelayMs(145).toFixed(2), mismatch: { f2: +mis.f2.toFixed(3), f3: +mis.f3.toFixed(3) } },
  },
  precisionWarning: "全部 ppm 都是截图像素估读（¹H 约 ±0.03、¹³C 约 ±0.5），不是原始谱数据；J、场强、Δ 属于演示模型的假设值。",
  checks,
};
fs.writeFileSync(path.join(here, "..", "numerical-verification.json"), JSON.stringify(report, null, 2) + "\n");
for (const x of checks) console.log(`${x.pass ? "✓" : "✗"} [${x.group}] ${x.name}${x.pass ? "" : "  → " + JSON.stringify(x.detail)}`);
console.log(`\n${report.passed}/${report.total} 项通过`);
if (failed.length) process.exit(1);
