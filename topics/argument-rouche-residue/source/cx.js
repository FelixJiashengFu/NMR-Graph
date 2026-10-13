/* cx.js — 复数运算与数值工具。页面（app.js）和 verify-numbers.mjs 共用；无依赖。
   复数一律写成 [实部, 虚部]。 */
const CX = (() => {
  "use strict";
  const TAU = 2 * Math.PI;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const scale = (a, s) => [a[0] * s, a[1] * s];
  const abs = (a) => Math.hypot(a[0], a[1]);
  const arg = (a) => Math.atan2(a[1], a[0]);
  const exp = (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };
  const polar = (r, th) => [r * Math.cos(th), r * Math.sin(th)];
  const powi = (a, n) => { // 整数幂
    if (n < 0) return div([1, 0], powi(a, -n));
    let r = [1, 0], b = a;
    while (n) { if (n & 1) r = mul(r, b); b = mul(b, b); n >>= 1; }
    return r;
  };
  // 把角度差折回 (−π, π]：连续追踪幅角时，相邻两个采样点之间的增量就取这个值
  const wrap = (d) => { while (d > Math.PI) d -= TAU; while (d <= -Math.PI) d += TAU; return d; };

  // 多项式：coef[k] 是 z^k 的系数（实数，或复数对）
  const C = (x) => (typeof x === "number" ? [x, 0] : x);
  const polyEval = (coef, z) => { let r = [0, 0]; for (let k = coef.length - 1; k >= 0; k--) r = add(mul(r, z), C(coef[k])); return r; };

  // Aberth 迭代，同时求出全部根。首尾的零系数先剥掉（末尾的零系数对应 z = 0 处的重根）。
  function polyRoots(coefIn) {
    const c = coefIn.map(C);
    let hi = c.length - 1; while (hi >= 0 && abs(c[hi]) < 1e-14) hi--;
    if (hi <= 0) return [];
    let lo = 0; while (abs(c[lo]) < 1e-14) lo++;
    const roots = []; for (let i = 0; i < lo; i++) roots.push([0, 0]);
    const a = c.slice(lo, hi + 1), n = a.length - 1;
    if (n === 0) return roots;
    const d = a.slice(1).map((v, k) => scale(v, k + 1));
    const ev = (p, z) => { let r = [0, 0]; for (let k = p.length - 1; k >= 0; k--) r = add(mul(r, z), p[k]); return r; };
    const rad = Math.pow(abs(a[0]) / abs(a[n]), 1 / n); // 各根模长的几何平均
    let z = []; for (let k = 0; k < n; k++) z.push(polar(rad, TAU * k / n + 0.7));
    for (let it = 0; it < 500; it++) {
      let move = 0; const nz = [];
      for (let k = 0; k < n; k++) {
        const pv = ev(a, z[k]), dv = ev(d, z[k]);
        if (abs(pv) < 1e-300 || abs(dv) === 0) { nz.push(abs(dv) === 0 && abs(pv) > 0 ? add(z[k], [1e-3 * rad, 1e-3 * rad]) : z[k]); continue; }
        const ratio = div(pv, dv); let s = [0, 0];
        for (let j = 0; j < n; j++) { if (j === k) continue; const e = sub(z[k], z[j]); if (abs(e) > 1e-300) s = add(s, div([1, 0], e)); }
        const w = div(ratio, sub([1, 0], mul(ratio, s)));
        nz.push(sub(z[k], w)); move = Math.max(move, abs(w));
      }
      z = nz;
      if (move < 1e-14 * Math.max(1, rad)) break;
    }
    return roots.concat(z);
  }

  // 闭合折线绕原点的圈数：相邻点的幅角增量累加，再除以 2π
  function turns(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += wrap(arg(pts[(i + 1) % pts.length]) - arg(pts[i]));
    return s / TAU;
  }

  // 路径基元：{type:"line", a, b}，或 {type:"arc", c, r, t0, t1}（t1 < t0 表示顺时针）。s 从 0 到 1。
  const pathPoint = (p, s) => (p.type === "line"
    ? [p.a[0] + (p.b[0] - p.a[0]) * s, p.a[1] + (p.b[1] - p.a[1]) * s]
    : add(p.c, polar(p.r, p.t0 + (p.t1 - p.t0) * s)));
  const pathVel = (p, s) => {
    if (p.type === "line") return sub(p.b, p.a);
    const th = p.t0 + (p.t1 - p.t0) * s, k = p.r * (p.t1 - p.t0);
    return [-k * Math.sin(th), k * Math.cos(th)];
  };
  const pathLength = (p) => (p.type === "line" ? abs(sub(p.b, p.a)) : Math.abs(p.t1 - p.t0) * p.r);

  // 沿路径基元的复积分 ∫ F(z) dz，复合辛普森公式，n 个小段
  function integrate(F, p, n = 600) {
    n += n % 2;
    let re = 0, im = 0; const h = 1 / n;
    for (let j = 0; j <= n; j++) {
      const s = j * h, w = j === 0 || j === n ? 1 : j % 2 ? 4 : 2;
      const v = mul(F(pathPoint(p, s)), pathVel(p, s));
      re += w * v[0]; im += w * v[1];
    }
    return [re * h / 3, im * h / 3];
  }

  return { TAU, add, sub, mul, div, scale, abs, arg, exp, polar, powi, wrap, polyEval, polyRoots, turns, pathPoint, pathVel, pathLength, integrate };
})();
