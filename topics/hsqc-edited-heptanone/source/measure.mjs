// 从课程截图中估读 HSQC / 编辑 HSQC 的坐标轴与交叉峰中心。
// 这是“像素估读”，不是原始谱数据：结果写入 source/measure.json，供页面与数值核对脚本使用。
// 运行：node source/measure.mjs   （或 deno run -A source/measure.mjs）
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// 每张截图给出两个谱图面板的粗略搜索范围（像素）；精确边框、刻度和峰中心都由下面的代码自动寻找。
const IMAGES = [
  {
    key: "original",
    file: "original.png",
    note: "本专题页面内嵌的原图（用户上传截图，1888 × 935）",
    panels: [
      { name: "HSQC", roi: [810, 440, 1290, 900] },
      { name: "Edited HSQC", roi: [1270, 440, 1770, 900] },
    ],
  },
  {
    key: "earlier",
    file: "earlier-capture.png",
    note: "同一张幻灯片的早期截图（2218 × 1398，底色偏黄），只用于交叉核对估读是否稳定",
    panels: [
      { name: "HSQC", roi: [980, 610, 1545, 1200] },
      { name: "Edited HSQC", roi: [1560, 610, 2140, 1200] },
    ],
  },
];

// 刻度数字是人工从图上读出的：横轴 3.0 / 2.5 / 2.0 / 1.5 / 1.0，纵轴只有 20 与 40 带数字。
const H_MAJOR_LABELS = [3.0, 2.5, 2.0, 1.5, 1.0];
const C_MAJOR_LABELS = [20, 40];

function load(file) {
  const png = PNG.sync.read(fs.readFileSync(path.join(here, file)));
  const { width: W, height: H, data: D } = png;
  const px = (x, y) => { const i = (y * W + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
  const lum = (x, y) => { const [r, g, b] = px(x, y); return 0.299 * r + 0.587 * g + 0.114 * b; };
  return { W, H, px, lum };
}

function median(a) { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; }

// 一组相邻像素（连续的列或行）合并成一个刻度，取加权中心。
function clusterRuns(items, gap = 1) {
  const out = []; let cur = null;
  for (const it of items) {
    if (cur && it.pos - cur.last <= gap) { cur.members.push(it); cur.last = it.pos; }
    else { cur = { members: [it], last: it.pos }; out.push(cur); }
  }
  return out.map((c) => {
    const w = c.members.reduce((s, m) => s + m.len, 0);
    return { center: c.members.reduce((s, m) => s + m.pos * m.len, 0) / w, len: Math.max(...c.members.map((m) => m.len)) };
  });
}

function linearFit(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const resid = xs.map((x, i) => ys[i] - (slope * x + intercept));
  return { slope, intercept, maxResid: Math.max(...resid.map(Math.abs)) };
}

function measurePanel(img, panel) {
  const { lum, px } = img; const [x0, y0, x1, y1] = panel.roi;
  const sample = []; for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) sample.push(lum(x, y));
  const bg = median(sample);
  const ink = (x, y) => lum(x, y) < bg - 45;

  // 1) 边框：最长的水平 / 垂直连续墨迹
  const longRows = [], longCols = [];
  for (let y = y0; y < y1; y++) { let best = 0, bs = 0, run = 0, rs = 0; for (let x = x0; x < x1; x++) { if (ink(x, y)) { if (!run) rs = x; run++; if (run > best) { best = run; bs = rs; } } else run = 0; } if (best > (x1 - x0) * 0.45) longRows.push({ y, xs: bs, xe: bs + best - 1 }); }
  for (let x = x0; x < x1; x++) { let best = 0, bs = 0, run = 0, rs = 0; for (let y = y0; y < y1; y++) { if (ink(x, y)) { if (!run) rs = y; run++; if (run > best) { best = run; bs = rs; } } else run = 0; } if (best > (y1 - y0) * 0.45) longCols.push({ x, ys: bs, ye: bs + best - 1 }); }
  if (longRows.length < 2 || longCols.length < 2) throw new Error(`${panel.name}: 未找到完整边框`);
  const left = Math.min(...longCols.map((c) => c.x)), right = Math.max(...longCols.map((c) => c.x));
  const top = Math.min(...longRows.map((r) => r.y)), bottom = Math.max(...longRows.map((r) => r.y));

  // 2) 刻度：沿边框外侧累加“墨迹深度”得到一维剖面，剖面上的局部极大就是刻度（对抗锯齿的浅色刻度也有效）
  const depth = (x, y) => Math.max(0, bg - lum(x, y));
  const tickProfile = (n, at, reach) => { const p = new Array(n).fill(0), len = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let k = 2; k <= reach; k++) { const d = at(i, k); p[i] += d; if (d > 25) len[i] = k; } return { p, len }; };
  const findTicks = ({ p, len }, origin) => {
    const noise = median(p), out = [];
    const at = (i) => (i < 0 || i >= p.length ? -1 : p[i]); // 端点也允许成为极大（3.0 ppm 的刻度就在边框左下角）
    for (let i = 0; i < p.length; i++) {
      if (p[i] < noise + 60 || p[i] < at(i - 1) || p[i] <= at(i + 1)) continue;
      let sw = 0, sx = 0; for (let j = Math.max(0, i - 2); j <= Math.min(p.length - 1, i + 2); j++) { const w = Math.max(0, p[j] - noise); sw += w; sx += w * j; }
      const tick = { center: origin + sx / sw, len: Math.max(len[i - 1] ?? 0, len[i], len[i + 1] ?? 0), strength: p[i] };
      const prev = out[out.length - 1];
      if (prev && tick.center - prev.center < 4) { if (tick.strength > prev.strength) out[out.length - 1] = tick; } // 同一刻度的双峰只留较强者
      else out.push(tick);
    }
    return out;
  };
  const hTicks = findTicks(tickProfile(right - left + 1, (i, k) => depth(left + i, bottom + k), 16), left);
  const cTicksAll = findTicks(tickProfile(bottom - top + 1, (i, k) => depth(right + k, top + i), 13), top).filter((t) => t.center > top + 3 && t.center < bottom - 3);
  if (process.env.MEASURE_DEBUG) console.log(panel.name, "底部刻度", JSON.stringify(hTicks.map((t) => [+t.center.toFixed(1), t.len])), "右侧刻度", JSON.stringify(cTicksAll.map((t) => [+t.center.toFixed(1), t.len])));
  const hMaxLen = Math.max(...hTicks.map((t) => t.len)), cMaxLen = Math.max(...cTicksAll.map((t) => t.len));
  const hMajor = hTicks.filter((t) => t.len >= hMaxLen * 0.7).sort((p, q) => p.center - q.center);
  const hMinor = hTicks.filter((t) => t.len < hMaxLen * 0.7);
  const cMajor = cTicksAll.filter((t) => t.len >= cMaxLen * 0.7).sort((p, q) => p.center - q.center);
  const cMinor = cTicksAll.filter((t) => t.len < cMaxLen * 0.7).sort((p, q) => p.center - q.center);

  if (hMajor.length !== H_MAJOR_LABELS.length) throw new Error(`${panel.name}: 横轴主刻度数 ${hMajor.length} ≠ ${H_MAJOR_LABELS.length}`);
  if (cMajor.length !== C_MAJOR_LABELS.length) throw new Error(`${panel.name}: 纵轴主刻度数 ${cMajor.length} ≠ ${C_MAJOR_LABELS.length}`);
  const hFit = linearFit(hMajor.map((t) => t.center), H_MAJOR_LABELS);
  // 纵轴先用带数字的 20 / 40 两点定标；再把落在 10、30 附近（±1.5 ppm）的无数字副刻度并入拟合，降低单个刻度 ±1 px 的影响。
  // “副刻度 = 10 与 30”是等间隔刻度的推断，原图没有标数字。
  const cFit2 = linearFit(cMajor.map((t) => t.center), C_MAJOR_LABELS);
  const cPts = cMajor.map((t, i) => ({ px: t.center, ppm: C_MAJOR_LABELS[i] }));
  for (const target of [10, 30]) {
    const hit = cMinor.map((t) => ({ t, v: cFit2.slope * t.center + cFit2.intercept })).filter((o) => Math.abs(o.v - target) < 1.5).sort((p, q) => Math.abs(p.v - target) - Math.abs(q.v - target))[0];
    if (hit) cPts.push({ px: hit.t.center, ppm: target });
  }
  const cFit = linearFit(cPts.map((p) => p.px), cPts.map((p) => p.ppm));
  const toH = (x) => hFit.slope * x + hFit.intercept, toC = (y) => cFit.slope * y + cFit.intercept;

  // 4) 交叉峰：边框内部的连通墨迹块（排除蓝色标题字）
  const m = Math.round((right - left) * 0.03), seen = new Set(), peaks = []; // 贴边的投影噪声不算峰
  const isBlue = (x, y) => { const [r, g, b] = px(x, y); return b - r > 50 && b - g > 30; };
  const key = (x, y) => y * 100000 + x;
  for (let y = top + m; y <= bottom - m; y++) for (let x = left + m; x <= right - m; x++) {
    if (seen.has(key(x, y)) || !ink(x, y)) continue;
    const stack = [[x, y]], comp = []; seen.add(key(x, y));
    while (stack.length) {
      const [cx, cy] = stack.pop(); comp.push([cx, cy]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < left + m || nx > right - m || ny < top + m || ny > bottom - m) continue;
        if (seen.has(key(nx, ny)) || !ink(nx, ny)) continue;
        seen.add(key(nx, ny)); stack.push([nx, ny]);
      }
    }
    if (comp.length < 8 || comp.length > 600) continue;
    if (comp.filter(([a, b]) => isBlue(a, b)).length > comp.length * 0.3) continue;
    let sw = 0, sx = 0, sy = 0, red = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (const [a, b] of comp) {
      const w = bg - lum(a, b); const [r, g, bl] = px(a, b);
      sw += w; sx += w * a; sy += w * b; red += w * (r - (g + bl) / 2);
      minX = Math.min(minX, a); maxX = Math.max(maxX, a); minY = Math.min(minY, b); maxY = Math.max(maxY, b);
    }
    const cx = sx / sw, cy = sy / sw;
    peaks.push({ px: +cx.toFixed(2), py: +cy.toFixed(2), bbox: [minX, minY, maxX, maxY], area: comp.length, redness: +(red / sw).toFixed(1), color: red / sw > 40 ? "red" : "black", dH: toH(cx), dC: toC(cy) });
  }
  peaks.sort((a, b) => a.dC - b.dC);

  // 5) 顶部一维 ¹H 投影：边框上方有墨迹“竖起”的列，聚成信号簇（只取中心，不恢复线形）
  let base = top; while (base > y0 && !ink(Math.round((left + right) / 2), base - 1) && top - base < 8) base--; // 投影基线通常紧贴边框
  const projCols = [];
  for (let x = left + 2; x <= right - 2; x++) { let h = 0; for (let y = top - 4; y > y0; y--) { if (ink(x, y)) h = top - 4 - y + 1; else if (top - 4 - y > h + 3) break; } if (h >= 3) projCols.push({ pos: x, len: h }); }
  const proj = clusterRuns(projCols, 4).map((c) => ({ px: +c.center.toFixed(1), height: c.len, dH: +toH(c.center).toFixed(3) }));

  return {
    name: panel.name, background: +bg.toFixed(1),
    frame: { left, right, top, bottom, width: right - left, height: bottom - top },
    hAxis: { majorTicksPx: hMajor.map((t) => +t.center.toFixed(2)), labels: H_MAJOR_LABELS, pxPerPpm: +(1 / Math.abs(hFit.slope)).toFixed(3), maxResidualPpm: +hFit.maxResid.toFixed(4), minorTickCount: hMinor.length, atLeft: +toH(left).toFixed(3), atRight: +toH(right).toFixed(3), slope: hFit.slope, intercept: hFit.intercept },
    cAxis: { majorTicksPx: cMajor.map((t) => +t.center.toFixed(2)), labels: C_MAJOR_LABELS, pxPerPpm: +(1 / Math.abs(cFit.slope)).toFixed(3), minorTicksPx: cMinor.map((t) => +t.center.toFixed(2)), minorTicksPpm: cMinor.map((t) => +toC(t.center).toFixed(2)), fitPoints: cPts.map((p) => ({ px: +p.px.toFixed(2), ppm: p.ppm })), maxResidualPpm: +cFit.maxResid.toFixed(3), twoPointSlopePxPerPpm: +(1 / Math.abs(cFit2.slope)).toFixed(3), atTop: +toC(top).toFixed(2), atBottom: +toC(bottom).toFixed(2), slope: cFit.slope, intercept: cFit.intercept },
    peaks: peaks.map((p) => ({ ...p, dH: +p.dH.toFixed(3), dC: +p.dC.toFixed(2) })),
    projection1H: proj,
  };
}

const result = { generatedBy: "source/measure.mjs", warning: "全部数值为截图像素估读，不是原始谱数据；纵轴只有 20 与 40 两个带数字的刻度。", images: {} };
for (const im of IMAGES) {
  if (!fs.existsSync(path.join(here, im.file))) { console.log(`跳过 ${im.file}（文件不存在）`); continue; }
  const img = load(im.file);
  result.images[im.key] = { file: im.file, note: im.note, width: img.W, height: img.H, panels: im.panels.map((p) => measurePanel(img, p)) };
}

// 汇总：以页面内嵌原图的两个面板取平均，作为页面使用的估读值
const SITES = ["C1", "C7", "C6", "C5", "C2", "C4"]; // 按 ¹³C 从小到大排序后的归属（结构辅助推断，见页面说明）
const [pa, pb] = result.images.original.panels;
if (pa.peaks.length !== 6 || pb.peaks.length !== 6) throw new Error(`峰数应为 6：HSQC=${pa.peaks.length}，Edited=${pb.peaks.length}`);
result.summary = SITES.map((site, i) => {
  const a = pa.peaks[i], b = pb.peaks[i];
  const row = { site, dH: +((a.dH + b.dH) / 2).toFixed(2), dC: +((a.dC + b.dC) / 2).toFixed(1), hsqc: { dH: a.dH, dC: a.dC, px: [a.px, a.py], color: a.color }, edited: { dH: b.dH, dC: b.dC, px: [b.px, b.py], color: b.color }, panelDiff: { dH: +Math.abs(a.dH - b.dH).toFixed(3), dC: +Math.abs(a.dC - b.dC).toFixed(2) } };
  if (result.images.earlier) {
    const [ea, eb] = result.images.earlier.panels;
    if (ea.peaks.length === 6 && eb.peaks.length === 6) {
      const eH = (ea.peaks[i].dH + eb.peaks[i].dH) / 2, eC = (ea.peaks[i].dC + eb.peaks[i].dC) / 2;
      row.earlierCapture = { dH: +eH.toFixed(3), dC: +eC.toFixed(2), color: eb.peaks[i].color, diffFromOriginal: { dH: +Math.abs(eH - (a.dH + b.dH) / 2).toFixed(3), dC: +Math.abs(eC - (a.dC + b.dC) / 2).toFixed(2) } };
    }
  }
  return row;
});
result.spread = {
  maxPanelDiffH: Math.max(...result.summary.map((r) => r.panelDiff.dH)),
  maxPanelDiffC: Math.max(...result.summary.map((r) => r.panelDiff.dC)),
  maxCaptureDiffH: Math.max(...result.summary.map((r) => r.earlierCapture?.diffFromOriginal.dH ?? 0)),
  maxCaptureDiffC: Math.max(...result.summary.map((r) => r.earlierCapture?.diffFromOriginal.dC ?? 0)),
  onePixelH: +(1 / pa.hAxis.pxPerPpm).toFixed(4),
  onePixelC: +(1 / pa.cAxis.pxPerPpm).toFixed(3),
};

fs.writeFileSync(path.join(here, "measure.json"), JSON.stringify(result, null, 2) + "\n");
for (const [k, im] of Object.entries(result.images)) for (const p of im.panels) {
  console.log(`\n[${k}] ${p.name}  边框 ${JSON.stringify(p.frame)}`);
  console.log(`  ¹H 轴: ${p.hAxis.pxPerPpm} px/ppm，主刻度残差 ≤ ${p.hAxis.maxResidualPpm} ppm，边框左/右 = ${p.hAxis.atLeft} / ${p.hAxis.atRight} ppm`);
  console.log(`  ¹³C 轴: ${p.cAxis.pxPerPpm} px/ppm（${p.cAxis.fitPoints.length} 点拟合，残差 ≤ ${p.cAxis.maxResidualPpm} ppm），副刻度落在 ${p.cAxis.minorTicksPpm.join(", ")} ppm，边框上/下 = ${p.cAxis.atTop} / ${p.cAxis.atBottom} ppm`);
  for (const q of p.peaks) console.log(`  峰 ${q.color.padEnd(5)} δH ${q.dH.toFixed(3)}  δC ${q.dC.toFixed(2)}  像素 (${q.px}, ${q.py})  面积 ${q.area}`);
  console.log(`  顶部 ¹H 投影信号簇: ${p.projection1H.map((s) => s.dH.toFixed(2)).join(", ")}`);
}
console.log("\n汇总:"); for (const r of result.summary) console.log(`  ${r.site}: δH ≈ ${r.dH.toFixed(2)}  δC ≈ ${r.dC.toFixed(1)}  编辑谱颜色 ${r.edited.color}  两面板差 ${r.panelDiff.dH}/${r.panelDiff.dC}` + (r.earlierCapture ? `  与早期截图差 ${r.earlierCapture.diffFromOriginal.dH}/${r.earlierCapture.diffFromOriginal.dC}` : ""));
console.log("离散程度:", JSON.stringify(result.spread));
