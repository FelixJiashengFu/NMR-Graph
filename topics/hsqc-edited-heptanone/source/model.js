// 纯计算部分：页面和 source/verify-numbers.mjs 共用同一份代码。
// 不访问 DOM；所有函数都可以单独调用和核对。
const HSQCModel = (() => {
  // 3-庚酮 CH3–CH2–C(=O)–CH2–CH2–CH2–CH3，按 IUPAC 编号；h = 直接连在该碳上的氢数
  const FORMULA = { C: 7, H: 14, O: 1 };
  const CARBONS = [
    { id: 1, h: 3 }, { id: 2, h: 2 }, { id: 3, h: 0 }, { id: 4, h: 2 },
    { id: 5, h: 2 }, { id: 6, h: 2 }, { id: 7, h: 3 },
  ];
  const BONDS = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]; // 碳–碳单键

  // ---- 理论计数 ----
  function counts(carbons = CARBONS) {
    const by = (n) => carbons.filter((c) => c.h === n).length;
    const hydrogens = carbons.reduce((s, c) => s + c.h, 0);
    const protonated = carbons.filter((c) => c.h > 0).length;
    return { carbons: carbons.length, hydrogens, ch3: by(3), ch2: by(2), ch: by(1), noH: by(0), protonated, expectedHsqcPeaks: protonated };
  }
  // 不饱和度（环 + π 键数）：DBE = (2C + 2 + N − H − X) / 2；氧不进入公式
  function dbe({ C, H, N = 0, X = 0 }) { return (2 * C + 2 + N - H - X) / 2; }
  // 图上两个碳之间隔几根键（用于 α / β / γ 位关系）
  function bondDistance(a, b, bonds = BONDS) {
    const adj = new Map();
    for (const [p, q] of bonds) { (adj.get(p) || adj.set(p, []).get(p)).push(q); (adj.get(q) || adj.set(q, []).get(q)).push(p); }
    const seen = new Map([[a, 0]]), queue = [a];
    while (queue.length) { const cur = queue.shift(); if (cur === b) return seen.get(cur); for (const nx of adj.get(cur) || []) if (!seen.has(nx)) { seen.set(nx, seen.get(cur) + 1); queue.push(nx); } }
    return Infinity;
  }
  // 某个碳的 α / β / γ 位各有几个碳（只数碳，不数氧）
  function neighbours(id, carbons = CARBONS, bonds = BONDS) {
    const out = { alpha: 0, beta: 0, gamma: 0 };
    for (const c of carbons) { const d = bondDistance(id, c.id, bonds); if (d === 1) out.alpha++; else if (d === 2) out.beta++; else if (d === 3) out.gamma++; }
    return out;
  }

  // ---- 像素 → ppm（线性定标）----
  function pixelToPpm(px, slope, intercept) { return slope * px + intercept; }

  // ---- 演示模型 ①：编辑延迟 ----
  // 碳磁化在总时长 Δ 的自旋回波里受 n 个直接相连氢的一键耦合调制：f_n = cosⁿ(π·J·Δ)
  function editFactor(n, jHz, delayMs) { return Math.pow(Math.cos(Math.PI * jHz * delayMs / 1000), n); }
  function matchedDelayMs(jHz) { return 1000 / jHz; }   // Δ = 1/J  → f_n = (−1)ⁿ
  function nullDelayMs(jHz) { return 500 / jHz; }        // Δ = 1/(2J) → f_n = 0
  function editState(jHz, delayMs, eps = 0.05) {
    const f2 = editFactor(2, jHz, delayMs), f3 = editFactor(3, jHz, delayMs);
    if (Math.abs(f3) < eps || Math.abs(f2) < eps) return "null";      // 信号接近消失
    return f2 * f3 < 0 ? "opposite" : "same";                          // CH₂ 与 CH₃ 反号 / 同号
  }

  // ---- 演示模型 ②：ppm ↔ Hz 与一级裂分 ----
  const GAMMA_RATIO_13C = 0.25145020; // ¹³C 与 ¹H 共振频率之比（Ξ = 25.145020 %）
  function ppmToHz(ppm, mhz) { return ppm * mhz; }       // 1 ppm = ν₀(MHz) Hz
  function hzToPpm(hz, mhz) { return hz / mhz; }
  function carbonMHz(protonMHz) { return protonMHz * GAMMA_RATIO_13C; }
  function binomial(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  // n 个等价邻位氢 → n+1 条线，强度比为二项式系数；返回每条线的 ppm、相对中心的 Hz 和归一化强度
  function multiplet(centerPpm, nNeighbours, jHz, mhz) {
    const total = Math.pow(2, nNeighbours), lines = [];
    for (let k = 0; k <= nNeighbours; k++) {
      const offsetHz = (nNeighbours / 2 - k) * jHz;
      lines.push({ ppm: centerPpm + hzToPpm(offsetHz, mhz), offsetHz, weight: binomial(nNeighbours, k) / total });
    }
    return lines;
  }
  function spanHz(nNeighbours, jHz) { return nNeighbours * jHz; }     // 最外两条线的间距
  // 两组裂分的“范围”是否交叠：正值 = 交叠的 Hz 数，负值 = 之间空出的 Hz 数
  function overlapHz(deltaPpm, mhz, nA, nB, jHz) { return (spanHz(nA, jHz) + spanHz(nB, jHz)) / 2 - Math.abs(ppmToHz(deltaPpm, mhz)); }
  function separationMHz(deltaPpm, nA, nB, jHz) { return (spanHz(nA, jHz) + spanHz(nB, jHz)) / 2 / Math.abs(deltaPpm); } // 刚好分开所需的 ¹H 频率

  // ---- 经验加和（Grant–Paul 烷烃增量，仅作量级核对）----
  const GRANT_PAUL = { alpha: 9.1, beta: 9.4, gamma: -2.5 };
  function incrementDelta(extra) { return (extra.alpha || 0) * GRANT_PAUL.alpha + (extra.beta || 0) * GRANT_PAUL.beta + (extra.gamma || 0) * GRANT_PAUL.gamma; }

  return { FORMULA, CARBONS, BONDS, counts, dbe, bondDistance, neighbours, pixelToPpm, editFactor, matchedDelayMs, nullDelayMs, editState, GAMMA_RATIO_13C, ppmToHz, hzToPpm, carbonMHz, binomial, multiplet, spanHz, overlapHz, separationMHz, GRANT_PAUL, incrementDelta };
})();
if (typeof globalThis !== "undefined") globalThis.HSQCModel = HSQCModel;
