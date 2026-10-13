// 数值核对：把正文里写下的每个结论（圈数、零点个数、留数、积分值、估计式）用 cx.js 独立算一遍，写入 ../numerical-verification.json。
// 运行：node source/verify-numbers.mjs（或 deno run -A source/verify-numbers.mjs）。有一项对不上就以非零状态退出。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CX = new Function(fs.readFileSync(path.join(here, "cx.js"), "utf8") + "\nreturn CX;")();
const { TAU, add, sub, mul, div, scale, abs, arg, exp, polar, powi, wrap, polyEval, polyRoots, turns, integrate } = CX;
const PI = Math.PI, one = [1, 0];

const checks = [];
const near = (name, got, want, tol) => { const g = [].concat(got), w = [].concat(want); const err = Math.hypot(...g.map((x, i) => x - w[i])); checks.push({ name, got, want, tol, ok: err <= tol }); };
const truthy = (name, ok, detail) => checks.push({ name, got: detail, want: true, tol: 0, ok: !!ok });
const circle = (c, r) => ({ type: "arc", c, r, t0: 0, t1: TAU });
const overTwoPiI = (z) => div(z, [0, TAU]);

// ── 引：∮ zⁿ dz ──
for (let n = -3; n <= 2; n++) near(`∮ z^${n} dz 沿单位圆`, integrate((z) => powi(z, n), circle([0, 0], 1), 2000), n === -1 ? [0, TAU] : [0, 0], 1e-10);
near("∮ (z−a)^(−1) dz，a = 0.3+0.2i，r = 0.5", integrate((z) => div(one, sub(z, [0.3, 0.2])), circle([0.3, 0.2], 0.5), 2000), [0, TAU], 1e-10);

// ── 圈：幅角原理 ──
// 有理函数 f = ∏(z − a)^m / ∏(z − b)^m；圈数由采样点幅角增量累加，另用 (1/2πi)∮ f'/f dz 再算一遍
const evalF = (pts, z) => pts.reduce((w, [kind, x, y, m]) => { const f = powi(sub(z, [x, y]), m); return kind === "z" ? mul(w, f) : div(w, f); }, [1, 0]);
const logDeriv = (pts, z) => pts.reduce((s, [kind, x, y, m]) => add(s, scale(div(one, sub(z, [x, y])), kind === "z" ? m : -m)), [0, 0]);
const windOf = (pts, c, r, n = 4000) => { const w = []; for (let i = 0; i < n; i++) w.push(evalF(pts, add(c, polar(r, TAU * i / n)))); return turns(w); };
const NP = (pts, c, r) => pts.reduce((s, [kind, x, y, m]) => s + (abs(sub([x, y], c)) < r ? (kind === "z" ? m : -m) : 0), 0);
const r3 = Math.sqrt(3) / 2;
const PRESETS = {
  "一个零点": [[0, 0], 1.5, [["z", 0.6, 0.5, 1]], 1],
  "z³−1": [[0.3, 0.2], 1.8, [["z", 1, 0, 1], ["z", -0.5, r3, 1], ["z", -0.5, -r3, 1]], 3],
  "一零一极相抵": [[0, 0], 1.6, [["z", 0.8, 0.4, 1], ["p", -0.7, -0.5, 1]], 0],
  "两内一外加一极": [[0.2, 0], 1.8, [["z", 1.1, 0.7, 1], ["z", -0.7, 0.9, 1], ["z", 2.6, -1.4, 1], ["p", -0.3, -0.9, 1]], 1],
  "二重零点": [[0, 0], 1.4, [["z", 0, 0, 2], ["p", 2.3, 1, 1]], 2],
  "正文例题 (z−1)²/(z(z+3))，|z|=2": [[0, 0], 2, [["z", 1, 0, 2], ["p", 0, 0, 1], ["p", -3, 0, 1]], 1],
  "小题一 z²(z−3)/((z−1)(z+i))，|z|=2": [[0, 0], 2, [["z", 0, 0, 2], ["z", 3, 0, 1], ["p", 1, 0, 1], ["p", 0, -1, 1]], 0],
};
for (const [name, [c, r, pts, want]] of Object.entries(PRESETS)) {
  near(`幅角原理 ${name}：像曲线圈数`, windOf(pts, c, r), want, 1e-9);
  truthy(`幅角原理 ${name}：N − P`, NP(pts, c, r) === want, NP(pts, c, r));
  near(`幅角原理 ${name}：(1/2πi)∮ f'/f dz`, overTwoPiI(integrate((z) => logDeriv(pts, z), circle(c, r), 6000)), [want, 0], 1e-7);
}
{ // 随机摆 300 组零点、极点和圆，圈数都应等于 N − P
  let seed = 20261013; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let tried = 0, agree = 0, skipped = 0;
  while (tried < 300) {
    const c = [rnd() * 2 - 1, rnd() * 2 - 1], r = 0.5 + rnd() * 2, pts = [];
    for (let k = 0, n = 1 + Math.floor(rnd() * 6); k < n; k++) pts.push([rnd() < 0.6 ? "z" : "p", rnd() * 6 - 3, rnd() * 6 - 3, 1 + Math.floor(rnd() * 3)]);
    if (pts.some(([, x, y]) => Math.abs(abs(sub([x, y], c)) - r) < 0.08)) { skipped++; continue; }
    tried++; if (Math.abs(windOf(pts, c, r, 6000) - NP(pts, c, r)) < 1e-6) agree++;
  }
  truthy("幅角原理：随机 300 组，圈数 = N − P", agree === 300, `${agree}/300 一致（另有 ${skipped} 组因点贴近围道而跳过）`);
}

// ── 绳：儒歇定理 ──
const POLYS = { "z⁵+3z+1": [1, 3, 0, 0, 0, 1], "z⁴−6z+3": [3, -6, 0, 0, 1], "z⁷−5z³+12": [12, 0, 0, -5, 0, 0, 0, 1], "2z⁵−6z²+z+1": [1, 1, -6, 0, 0, 2] };
const split = (coef, ks) => [coef.map((c, k) => (ks.includes(k) ? c : 0)), coef.map((c, k) => (ks.includes(k) ? 0 : c))];
const onCircle = (coef, R, n = 3600) => { let lo = Infinity, hi = 0; for (let i = 0; i < n; i++) { const m = abs(polyEval(coef, polar(R, TAU * i / n))); lo = Math.min(lo, m); hi = Math.max(hi, m); } return [lo, hi]; };
const inside = (coef, R) => polyRoots(coef).filter((z) => abs(z) < R).length;
for (const [name, coef] of Object.entries(POLYS)) {
  const roots = polyRoots(coef);
  truthy(`求根 ${name}：个数与残差`, roots.length === coef.length - 1 && roots.every((z) => abs(polyEval(coef, z)) < 1e-9), `${roots.length} 个根，最大残差 ${Math.max(...roots.map((z) => abs(polyEval(coef, z)))).toExponential(2)}`);
}
const rouche = (name, coefName, ks, R, wantMinF, wantMaxG, wantN) => {
  const coef = POLYS[coefName], [fc, gc] = split(coef, ks), [minF] = onCircle(fc, R), [, maxG] = onCircle(gc, R);
  near(`儒歇 ${name}：圈上 min|f|`, minF, wantMinF, 1e-6); near(`儒歇 ${name}：圈上 max|g|`, maxG, wantMaxG, 1e-4);
  truthy(`儒歇 ${name}：条件成立，f 与 f+g 圈内零点数都是 ${wantN}`, maxG < minF && inside(fc, R) === wantN && inside(coef, R) === wantN, `f ${inside(fc, R)} 个，f+g ${inside(coef, R)} 个`);
};
rouche("z⁵+3z+1，|z|=1，f=3z", "z⁵+3z+1", [1], 1, 3, 2, 1);
rouche("z⁵+3z+1，|z|=2，f=z⁵", "z⁵+3z+1", [5], 2, 32, 7, 5);
rouche("z⁴−6z+3，|z|=1，f=−6z（小题二）", "z⁴−6z+3", [1], 1, 6, 4, 1);
rouche("z⁴−6z+3，|z|=2，f=z⁴（小题二）", "z⁴−6z+3", [4], 2, 16, 15, 4);
rouche("z⁷−5z³+12，|z|=1，f=12", "z⁷−5z³+12", [0], 1, 12, 6, 0);
rouche("z⁷−5z³+12，|z|=2，f=z⁷", "z⁷−5z³+12", [7], 2, 128, 52, 7);
rouche("2z⁵−6z²+z+1，|z|=1，f=−6z²", "2z⁵−6z²+z+1", [2], 1, 6, 4, 2);
truthy("小题三：|z|=1 上 |g|=|f| 时，f=z 圈内 1 个零点而 f+g=z−1 的零点在圈上", abs([1, 0]) === 1 && inside([0, 1], 1) === 1 && inside([-1, 1], 1) === 0, "z−1 的根模长恰为 1");
{ // 条件不成立时：N(f+g) − N(f) = 曲线 1 + g/f 绕原点的圈数
  let n = 0, agree = 0;
  for (const coef of Object.values(POLYS)) for (let k = 0; k < coef.length; k++) {
    if (!coef[k]) continue; const [fc, gc] = split(coef, [k]);
    for (let R = 0.35; R <= 2.45; R += 0.1) {
      if (polyRoots(coef).concat(polyRoots(fc)).some((z) => Math.abs(abs(z) - R) < 0.03)) continue;
      const w = []; for (let i = 0; i < 4000; i++) { const z = polar(R, TAU * i / 4000); w.push(add(one, div(polyEval(gc, z), polyEval(fc, z)))); }
      n++; if (Math.round(turns(w)) === inside(coef, R) - inside(fc, R)) agree++;
    }
  }
  truthy("儒歇：任取主项和半径，N(f+g) − N(f) = 1+g/f 的圈数", agree === n && n > 200, `${agree}/${n}`);
}
{ // 形变 f + t·g：t 从 0 到 1，圈内零点个数不变（z⁵+3z+1，|z|=1，f=3z）
  const [fc, gc] = split(POLYS["z⁵+3z+1"], [1]); const counts = [];
  for (let t = 0; t <= 1.0001; t += 0.01) { const c = fc.map((v, k) => v + t * gc[k]); const rs = polyRoots(c); if (rs.some((z) => abs(polyEval(c, z)) > 1e-8)) counts.push(NaN); else counts.push(rs.filter((z) => abs(z) < 1).length); }
  truthy("儒歇：f + t·g 在 t ∈ [0,1] 上圈内零点恒为 1 个", counts.every((c) => c === 1), `${counts.length} 个 t 值`);
}

// ── 围：留数与实积分 ──
const residueAt = (F, a, r = 0.05) => overTwoPiI(integrate(F, circle(a, r), 2000));
const half = (F, R, n = 6000) => { const seg = integrate(F, { type: "line", a: [-R, 0], b: [R, 0] }, n), arc = integrate(F, { type: "arc", c: [0, 0], r: R, t0: 0, t1: PI }, n); return { seg, arc, total: add(seg, arc) }; };
const realSimpson = (f, a, b, n) => { n += n % 2; const h = (b - a) / n; let s = f(a) + f(b); for (let j = 1; j < n; j++) s += (j % 2 ? 4 : 2) * f(a + j * h); return s * h / 3; };
const q = Math.SQRT1_2;

// 一 三角型
for (const a of [1.05, 1.25, 2, 2.5]) {
  const s = Math.sqrt(a * a - 1), want = TAU / s;
  near(`三角型 a=${a}：实积分直接算`, realSimpson((t) => 1 / (a + Math.cos(t)), 0, TAU, 20000), want, 1e-8);
  near(`三角型 a=${a}：(2/i)∮ dz/(z²+2az+1) 沿单位圆`, integrate((z) => div([0, -2], add(add(mul(z, z), scale(z, 2 * a)), one)), circle([0, 0], 1), 8000), [want, 0], 1e-7);
  near(`三角型 a=${a}：z₊ 处的留数 1/(2√(a²−1))`, residueAt((z) => div(one, add(add(mul(z, z), scale(z, 2 * a)), one)), [-a + s, 0], Math.min(0.05, s / 2)), [1 / (2 * s), 0], 1e-8);
  truthy(`三角型 a=${a}：z₊z₋ = 1 且 |z₊| < 1 < |z₋|`, Math.abs((-a + s) * (-a - s) - 1) < 1e-12 && Math.abs(-a + s) < 1 && Math.abs(-a - s) > 1, `${-a + s}, ${-a - s}`);
}
near("小题四：∫₀^{2π} dθ/(5+4cos θ) = 2π/3", realSimpson((t) => 1 / (5 + 4 * Math.cos(t)), 0, TAU, 20000), TAU / 3, 1e-9);

// 二 有理型
const RAT = {
  "1/(1+x²)": { F: (z) => div(one, add(one, mul(z, z))), poles: [[[0, 1], [0, -0.5]]], want: PI, M: (R) => 1 / (R * R - 1) },
  "1/(1+x⁴)": { F: (z) => div(one, add(one, powi(z, 4))), poles: [[[q, q], [-q / 4, -q / 4]], [[-q, q], [q / 4, -q / 4]]], want: PI * q, M: (R) => 1 / (R ** 4 - 1) },
  "1/(1+x²)²": { F: (z) => { const d = add(one, mul(z, z)); return div(one, mul(d, d)); }, poles: [[[0, 1], [0, -0.25]]], want: PI / 2, M: (R) => 1 / (R * R - 1) ** 2 },
  "x²/(1+x⁴)（小题五）": { F: (z) => div(mul(z, z), add(one, powi(z, 4))), poles: [[[q, q], [q / 4, -q / 4]], [[-q, q], [-q / 4, -q / 4]]], want: PI * q, M: (R) => R * R / (R ** 4 - 1) },
};
for (const [name, { F, poles, want, M }] of Object.entries(RAT)) {
  let sum = [0, 0];
  for (const [a, res] of poles) { near(`有理型 ${name}：极点 ${a.map((x) => +x.toFixed(4))} 处的留数`, residueAt(F, a), res, 1e-8); sum = add(sum, res); }
  near(`有理型 ${name}：2πi × 上半平面留数之和`, mul([0, TAU], sum), [want, 0], 1e-12);
  for (const R of [3, 12]) {
    const v = half(F, R);
    near(`有理型 ${name}，R=${R}：实轴段 + 弧 = 2πi·Σ留数`, v.total, [want, 0], 1e-7);
    truthy(`有理型 ${name}，R=${R}：|弧| ≤ πR·max|f|（ML 估计）`, abs(v.arc) <= PI * R * M(R) + 1e-12, `${abs(v.arc).toExponential(3)} ≤ ${(PI * R * M(R)).toExponential(3)}`);
  }
  near(`有理型 ${name}：R=0.6 时圈内无极点，闭路合计为 0`, half(F, 0.6).total, [0, 0], 1e-9);
}
near("有理型 1/(1+x²)：实轴段 [−R,R] = 2 arctan R，R=3", half(RAT["1/(1+x²)"].F, 3).seg, [2 * Math.atan(3), 0], 1e-9);

// 三 含 e^{iax} 型
for (const a of [0.5, 1, 2]) {
  const F = (z) => div(exp(mul([0, a], z)), add(one, mul(z, z))), want = PI * Math.exp(-a);
  near(`含 e^{iax} 型 a=${a}：z=i 处的留数 e^{−a}/(2i)`, residueAt(F, [0, 1]), [0, -Math.exp(-a) / 2], 1e-8);
  for (const R of [3, 12]) {
    const v = half(F, R, 12000), bound = PI / a / (R * R - 1);
    near(`含 e^{iax} 型 a=${a}，R=${R}：闭路 = π e^{−a}`, v.total, [want, 0], 1e-7);
    truthy(`含 e^{iax} 型 a=${a}，R=${R}：|弧| ≤ (π/a)·M(R)（若尔当引理）`, abs(v.arc) <= bound, `${abs(v.arc).toExponential(3)} ≤ ${bound.toExponential(3)}`);
    near(`含 e^{iax} 型 a=${a}，R=${R}：实轴段的虚部（sin 的积分）为 0`, v.seg[1], 0, 1e-9);
  }
}
truthy("若尔当不等式 sin θ ≥ 2θ/π 在 [0, π/2] 上成立", Array.from({ length: 1001 }, (_, i) => i * PI / 2000).every((t) => Math.sin(t) >= 2 * t / PI - 1e-15), "1001 个采样点");
{ // 小题六：∫ x sin x/(1+x²) dx = π/e
  const F = (z) => div(mul(z, exp([-z[1], z[0]])), add(one, mul(z, z)));
  near("小题六：z e^{iz}/(1+z²) 在 z=i 处的留数 1/(2e)", residueAt(F, [0, 1]), [1 / (2 * Math.E), 0], 1e-8);
  const v = half(F, 40, 40000);
  near("小题六，R=40：闭路 = πi/e", v.total, [0, PI / Math.E], 1e-6);
  truthy("小题六，R=40：|弧| ≤ π·R/(R²−1)", abs(v.arc) <= PI * 40 / (1600 - 1), `${abs(v.arc).toExponential(3)} ≤ ${(PI * 40 / 1599).toExponential(3)}`);
}

// 四 路上有极点
const Fs = (z) => div(exp([-z[1], z[0]]), z);
const Si = (x) => { let term = x, s = x; for (let k = 1; k < 200; k++) { term *= -x * x / ((2 * k) * (2 * k + 1)); s += term / (2 * k + 1); } return s; }; // 幂级数
for (const [R, eps] of [[8, 0.4], [30, 0.05]]) {
  const segL = integrate(Fs, { type: "line", a: [-R, 0], b: [-eps, 0] }, 20000), segR = integrate(Fs, { type: "line", a: [eps, 0], b: [R, 0] }, 20000);
  const small = integrate(Fs, { type: "arc", c: [0, 0], r: eps, t0: PI, t1: 0 }, 4000), big = integrate(Fs, { type: "arc", c: [0, 0], r: R, t0: 0, t1: PI }, 20000);
  near(`sin x/x，R=${R}、ε=${eps}：四段合计为 0`, add(add(segL, segR), add(small, big)), [0, 0], 1e-7);
  near(`sin x/x，R=${R}、ε=${eps}：小半圆 = −i(π − 2ε) + O(ε³)`, small, [0, -(PI - 2 * eps)], eps ** 3 / 5);
  truthy(`sin x/x，R=${R}：|大弧| ≤ π/R`, abs(big) <= PI / R, `${abs(big).toExponential(3)} ≤ ${(PI / R).toExponential(3)}`);
  near(`sin x/x，R=${R}、ε=${eps}：两段实轴 = 2i∫ sin x/x dx`, add(segL, segR), [0, 2 * realSimpson((x) => Math.sin(x) / x, eps, R, 40000)], 1e-7);
  if (R === 8) near("sin x/x：∫ 从 0.4 到 8 = Si(8) − Si(0.4)（幂级数）", (segL[1] + segR[1]) / 2, Si(8) - Si(0.4), 1e-8);
}
near("sin x/x：π/2 − ∫₀^R = 大弧贡献的一半，R=30 时误差 ≤ π/(2R)", Math.abs(PI / 2 - Si(30)) <= PI / 60 ? 1 : 0, 1, 0);

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(here, "..", "numerical-verification.json"), JSON.stringify({ generatedAt: new Date().toISOString(), passed: checks.length - failed.length, failed: failed.length, checks }, null, 2) + "\n");
console.log(`${checks.length - failed.length} 项通过，${failed.length} 项未通过`);
for (const c of failed) console.log("  ✗", c.name, "— 得到", JSON.stringify(c.got), "应为", JSON.stringify(c.want), "容差", c.tol);
if (failed.length) process.exit(1);
