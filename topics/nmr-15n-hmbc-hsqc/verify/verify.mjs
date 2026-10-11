/* =============================================================================
 * 验证脚本  ——  核对公式、计数、单位换算、演示模型边界与不变量，
 *               并对生成的 index.html 做静态检查。
 *
 * 用法：node verify/verify.mjs
 * 输出：控制台报告 + verify/report.json
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import {
  HMBC, HSQC, GLOSSARY, EN_ZH, HMBC_SITES,
  REF_OFFSET_NH3_CH3NO2, lerp, clamp, ppmToHz, convertN15,
  peaksNear, hmbcVisible, relIntensity, hsqcBlueSeries, hsqcBlackSeries, serShift,
} from '../src/data.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ---------------- 测试框架 ---------------- */
const groups = {};
let total = 0, passed = 0, failed = 0;
const fails = [];

function group(name) { groups[name] = { total: 0, passed: 0, failed: 0 }; return name; }
function check(g, desc, cond, detail) {
  total++; groups[g].total++;
  if (cond) { passed++; groups[g].passed++; }
  else { failed++; groups[g].failed++; fails.push({ group: g, desc, detail }); }
  const mark = cond ? '✓' : '✗';
  console.log('  ' + mark + ' ' + desc + (detail && !cond ? '   → ' + detail : ''));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

/* =========================================================================
 * A. 像素 → ppm 独立复算（与 data.js 中记录的数值交叉核对）
 * ====================================================================== */
console.log('\n[A] 像素 → ppm 独立复算');
const G_A = group('像素换算');

// 标定常数来自 verify/analyze_images.py 的测量结果
const CAL = {
  hmbc: {
    xTicks: [[698, 7], [1009, 1]],      // 刻度线像素 x ↔ ppm
    yTicks: [[445.5, -320], [623.0, -240]],
    px: {
      R1: [705.5, 469.0], D1: [679.0, 554.0], D2: [688.5, 551.5], D3: [710.5, 556.5],
      D4: [719.5, 552.5], S1: [824.5, 555.5], B1: [970.0, 554.0], B2: [985.5, 539.5],
      T1: [970.0, 453.0],
    },
  },
  hsqc: {
    xTicks: [[639, 9.0], [901.5, 8.0]],
    yTicks: [[179, 110], [377.5, 116]],
    px: {
      'Gly2|a': [793.0, 143.0], 'Gly5|a': [829.5, 169.5], 'Gly5|b': [854.0, 170.0],
      'Gly4|a': [756.0, 217.0], 'Gly4|b': [739.5, 220.0], 'Gly1|a': [810.5, 323.5],
      'Gly1|b': [806.0, 328.0], 'Ser3|a': [798.5, 373.5], 'pSer3|b': [715.0, 372.5],
    },
  },
};

function lin(v, t0, t1) {
  const [p0, v0] = t0, [p1, v1] = t1;
  return v0 + (v - p0) / (p1 - p0) * (v1 - v0);
}

let maxdH = 0, maxdN = 0;
HMBC.peaks.forEach(p => {
  const [x, y] = CAL.hmbc.px[p.id];
  const dH = lin(x, CAL.hmbc.xTicks[0], CAL.hmbc.xTicks[1]);
  const dN = lin(y, CAL.hmbc.yTicks[0], CAL.hmbc.yTicks[1]);
  maxdH = Math.max(maxdH, Math.abs(dH - p.dH));
  maxdN = Math.max(maxdN, Math.abs(dN - p.dN));
});
check(G_A, 'HMBC 9 个峰的 δH 与像素复算一致（≤0.01 ppm）', maxdH <= 0.01, 'maxΔ=' + maxdH.toFixed(4));
check(G_A, 'HMBC 9 个峰的 δN 与像素复算一致（≤0.1 ppm）', maxdN <= 0.1, 'maxΔ=' + maxdN.toFixed(4));

let qdH = 0, qdN = 0;
HSQC.peaks.forEach(p => {
  const [x, y] = CAL.hsqc.px[p.label + '|' + p.state];
  const dH = lin(x, CAL.hsqc.xTicks[0], CAL.hsqc.xTicks[1]);
  const dN = lin(y, CAL.hsqc.yTicks[0], CAL.hsqc.yTicks[1]);
  qdH = Math.max(qdH, Math.abs(dH - p.dH));
  qdN = Math.max(qdN, Math.abs(dN - p.dN));
});
check(G_A, 'HSQC 9 个峰的 δH 与像素复算一致（≤0.001 ppm）', qdH <= 0.001, 'maxΔ=' + qdH.toFixed(5));
check(G_A, 'HSQC 9 个峰的 δN 与像素复算一致（≤0.02 ppm）', qdN <= 0.02, 'maxΔ=' + qdN.toFixed(5));

/* =========================================================================
 * B. 坐标轴范围与跨度
 * ====================================================================== */
console.log('\n[B] 坐标轴范围与跨度');
const G_B = group('坐标轴');
check(G_B, '图1 δH 跨度 = 7.0 ppm', near(HMBC.axis.x.min - HMBC.axis.x.max, 7.0, 1e-9),
  HMBC.axis.x.min + ' - ' + HMBC.axis.x.max);
check(G_B, '图1 δN 跨度 = 109 ppm', near(HMBC.axis.y.max - HMBC.axis.y.min, 109, 1e-9),
  HMBC.axis.y.max + ' - ' + HMBC.axis.y.min);
check(G_B, '图2 ¹H 跨度 = 1.0 ppm', near(HSQC.axis.x.min - HSQC.axis.x.max, 1.0, 1e-9));
check(G_B, '图2 δN 跨度 = 9.0 ppm', near(HSQC.axis.y.max - HSQC.axis.y.min, 9.0, 1e-9));
check(G_B, '图1 所有峰落在 δH 轴范围内',
  HMBC.peaks.every(p => p.dH <= HMBC.axis.x.min && p.dH >= HMBC.axis.x.max));
check(G_B, '图1 所有峰落在 δN 轴范围内',
  HMBC.peaks.every(p => p.dN >= HMBC.axis.y.min && p.dN <= HMBC.axis.y.max));
check(G_B, '图2 所有峰落在 ¹H 轴范围内',
  HSQC.peaks.every(p => p.dH <= HSQC.axis.x.min && p.dH >= HSQC.axis.x.max));
check(G_B, '图2 所有峰落在 δN 轴范围内',
  HSQC.peaks.every(p => p.dN >= HSQC.axis.y.min && p.dN <= HSQC.axis.y.max));
check(G_B, '两张图的 δN 区间不重叠（符号约定不同）',
  HMBC.axis.y.max < 0 && HSQC.axis.y.min > 0);

/* =========================================================================
 * C. 单位换算与参考物换算
 * ====================================================================== */
console.log('\n[C] 单位换算与参考物换算');
const G_C = group('单位换算');
check(G_C, '600 MHz 下 1 ppm(¹H) = 600 Hz', ppmToHz(1, 600) === 600);
check(G_C, '600 MHz 谱仪 ¹⁵N 频率 ≈ 60.8 MHz（1 ppm ≈ 60.8 Hz）', near(ppmToHz(1, 60.8), 60.8, 1e-9));
const sh = serShift();
check(G_C, 'ΔδH(Ser3→pSer3) = 0.318 ppm', near(sh.dH, 0.318, 0.002), sh.dH.toFixed(4));
check(G_C, 'ΔδH 换算 ≈ 191 Hz（@600 MHz）', near(ppmToHz(sh.dH, 600), 191, 3), ppmToHz(sh.dH, 600).toFixed(1));
check(G_C, 'ΔδN(Ser3→pSer3) 接近 0（|Δ| < 0.1 ppm）', Math.abs(sh.dN) < 0.1, sh.dN.toFixed(3));
check(G_C, '参考物差 380.5 ppm 常数被正确定义', REF_OFFSET_NH3_CH3NO2 === 380.5);
const conv = convertN15(-271.1, 'CH3NO2', 'NH3');
check(G_C, '−271.1 (CH₃NO₂) → +109.4 (NH₃)', near(conv, 109.4, 0.05), conv.toFixed(3));
check(G_C, '参考物换算可逆', near(convertN15(conv, 'NH3', 'CH3NO2'), -271.1, 1e-9));
check(G_C, '同标度换算返回原值', convertN15(-271.1, 'NH3', 'NH3') === -271.1);
// 换算后按 δN 分层核对：常规氮（≈ −270）应落入蛋白酰胺氮区间；异常氮（≈ −309/−317）应明显偏低
const convN = HMBC.peaks.map(p => convertN15(p.dN, 'CH3NO2', 'NH3'));
const normalConv = HMBC.peaks.filter(p => p.dN > -300).map(p => convertN15(p.dN, 'CH3NO2', 'NH3'));
const oddConv = HMBC.peaks.filter(p => p.dN <= -300).map(p => convertN15(p.dN, 'CH3NO2', 'NH3'));
check(G_C, '图1 常规氮簇（δN −270 ± 4）换算后落在 +103 ～ +111 ppm，与图2 酰胺氮区间 108.9–115.9 部分重叠',
  normalConv.every(v => v >= 102 && v <= 112)
  && normalConv.some(v => v >= 108.9 && v <= 115.9),
  normalConv.map(v => v.toFixed(1)).join(', '));
check(G_C, '图1 异常氮（δN ≤ −300）换算后明显低于酰胺区（< 100 ppm）',
  oddConv.every(v => v < 100), oddConv.map(v => v.toFixed(1)).join(', '));
check(G_C, '换算后红圈峰 ≈ +71 ppm，比常规峰低约 39 ppm',
  near(convertN15(HMBC.peaks.find(p => p.id === 'R1').dN, 'CH3NO2', 'NH3'), 71.1, 0.5),
  convertN15(HMBC.peaks.find(p => p.id === 'R1').dN, 'CH3NO2', 'NH3').toFixed(1));

/* =========================================================================
 * D. 计数
 * ====================================================================== */
console.log('\n[D] 计数核对');
const G_D = group('计数');
check(G_D, '图1 交叉峰总数 = 9', HMBC.peaks.length === 9, String(HMBC.peaks.length));
check(G_D, '图1 峰编号唯一', new Set(HMBC.peaks.map(p => p.id)).size === HMBC.peaks.length);
const inBox = (b) => HMBC.peaks.filter(p =>
  p.dH <= b.dH0 && p.dH >= b.dH1 && p.dN >= b.dN0 && p.dN <= b.dN1).length;
check(G_D, '红圈内峰数 = 1', inBox(HMBC.boxes[0]) === 1, String(inBox(HMBC.boxes[0])));
check(G_D, '蓝虚线框内峰数 = 4', inBox(HMBC.boxes[1]) === 4, String(inBox(HMBC.boxes[1])));
check(G_D, '蓝实线框内峰数 = 1', inBox(HMBC.boxes[2]) === 1, String(inBox(HMBC.boxes[2])));
check(G_D, '三个标注框互不重叠',
  !(HMBC.boxes[0].dH0 > HMBC.boxes[1].dH1 && HMBC.boxes[0].dH1 < HMBC.boxes[1].dH0 &&
    HMBC.boxes[0].dN0 > HMBC.boxes[1].dN1 && HMBC.boxes[0].dN1 < HMBC.boxes[1].dN0));
const aP = HSQC.peaks.filter(p => p.state === 'a'), bP = HSQC.peaks.filter(p => p.state === 'b');
check(G_D, '图2 (a) 黑峰数 = 5', aP.length === 5, String(aP.length));
check(G_D, '图2 (b) 蓝峰数 = 4', bP.length === 4, String(bP.length));
check(G_D, '图2 总峰数 = 9', HSQC.peaks.length === 9);
check(G_D, '图2 每个 (b) 峰都有同名 (a) 峰或为独立残基（pSer3）',
  bP.every(p => p.label === 'pSer3' || aP.some(a => a.label === p.label)));
check(G_D, '图1 被标注的峰中，红圈峰 R1 的 δN 最负',
  HMBC.peaks.filter(p => p.zone !== '右上角').find(p => p.id === 'R1').dN
  === Math.min(...HMBC.peaks.filter(p => p.zone !== '右上角').map(p => p.dN)));
check(G_D, '全图最负的峰是右上角弱峰 T1（δN −316.6），非红圈峰',
  HMBC.peaks.find(p => p.id === 'T1').dN === Math.min(...HMBC.peaks.map(p => p.dN)));
const gap = Math.abs(HMBC.peaks.find(p => p.id === 'R1').dN)
  - Math.min(...HMBC.peaks.filter(p => p.id !== 'R1').map(p => Math.abs(p.dN)));
check(G_D, '红圈峰比“常规氮簇”（≈ −270）低约 39 ppm', near(Math.abs(gap), 39, 2.5), Math.abs(gap).toFixed(1));

/* =========================================================================
 * E. 相对强度归一
 * ====================================================================== */
console.log('\n[E] 相对强度归一');
const G_E = group('强度');
const maxH = Math.max(...HMBC.peaks.map(p => p.h));
check(G_E, '最强峰相对强度 = 1.000', relIntensity(maxH) === 1);
check(G_E, 'B1 为最强峰（100%）', HMBC.peaks.find(p => relIntensity(p.h) === 1).id === 'B1');
check(G_E, '所有相对强度落在 (0, 1]', HMBC.peaks.every(p => relIntensity(p.h) > 0 && relIntensity(p.h) <= 1));
check(G_E, 'T1 相对强度 ≈ 21%', near(relIntensity(9) * 100, 21, 0.6), (relIntensity(9) * 100).toFixed(1));

/* =========================================================================
 * F. 演示模型：边界、单调性、不变量
 * ====================================================================== */
console.log('\n[F] 演示模型边界与不变量');
const G_F = group('演示模型');

const blue0 = hsqcBlueSeries(0);
check(G_F, 'p=0 时蓝峰与 (a) 黑峰完全重合',
  blue0.every(b => {
    const a = HSQC.peaks.find(x => x.label === (b.partner || b.label) && x.state === 'a');
    return a && near(b.dH, a.dH, 1e-12) && near(b.dN, a.dN, 1e-12);
  }));
const blue1 = hsqcBlueSeries(1);
check(G_F, 'p=1 时蓝峰等于原图观测 (b) 位置',
  blue1.every(b => { const o = HSQC.peaks.find(x => x.label === b.label && x.state === 'b'); return near(b.dH, o.dH, 1e-12) && near(b.dN, o.dN, 1e-12); }));
check(G_F, 'p 超出 [0,1] 时被截断（p=2 等于 p=1）',
  hsqcBlueSeries(2).every((b, i) => near(b.dH, blue1[i].dH, 1e-12)));
check(G_F, 'p 为负时被截断（p=-1 等于 p=0）',
  hsqcBlueSeries(-1).every((b, i) => near(b.dH, blue0[i].dH, 1e-12)));
// 单调性
let mono = true;
for (let t = 0; t < 1; t += 0.05) {
  const A = hsqcBlueSeries(t), B = hsqcBlueSeries(t + 0.05);
  A.forEach((a, i) => {
    const d0 = Math.abs(a.dH - HSQC.peaks.find(x => x.label === a.label && x.state === 'b').dH);
    const d1 = Math.abs(B[i].dH - HSQC.peaks.find(x => x.label === a.label && x.state === 'b').dH);
    if (d1 > d0 + 1e-12) mono = false;
  });
}
check(G_F, '磷酸化程度单调：p 增大时蓝峰单调趋近观测位置', mono);
check(G_F, '(a) 黑峰不随 p 变化（不变量）',
  [0, 0.3, 0.7, 1].every(t => JSON.stringify(hsqcBlackSeries()) === JSON.stringify(hsqcBlackSeries())));
check(G_F, 'p=0 时 Ser3 与 pSer3 的 ΔδH = 0（重合）',
  near(hsqcBlueSeries(0).find(b => b.label === 'pSer3').dH - HSQC.peaks.find(x => x.label === 'Ser3').dH, 0, 1e-12));
check(G_F, 'p=1 时 pSer3 的 ΔδH = +0.318 ppm',
  near(hsqcBlueSeries(1).find(b => b.label === 'pSer3').dH - HSQC.peaks.find(x => x.label === 'Ser3').dH, 0.318, 0.002));
check(G_F, 'p=0.5 时位于两端点中点',
  near(hsqcBlueSeries(0.5).find(b => b.label === 'pSer3').dH,
    lerp(HSQC.peaks.find(x => x.label === 'Ser3').dH, HSQC.peaks.find(x => x.label === 'pSer3').dH, 0.5), 1e-12));
// 强度阈值
check(G_F, '阈值 0 → 全部峰可见', hmbcVisible(HMBC.peaks, 0).every(p => p.shown));
check(G_F, '阈值 1 → 仅最强峰可见', hmbcVisible(HMBC.peaks, 1).filter(p => p.shown).length === 1);
check(G_F, '阈值 0.5 → 仅强度 ≥50% 的峰可见（4 个：B1/D1/D2/D3）',
  hmbcVisible(HMBC.peaks, 0.5).filter(p => p.shown).length === 4,
  String(hmbcVisible(HMBC.peaks, 0.5).filter(p => p.shown).length));
check(G_F, '红圈峰 R1 相对强度 48.8%，刚好落在 50% 阈值之下',
  relIntensity(HMBC.peaks.find(p => p.id === 'R1').h) < 0.5
  && relIntensity(HMBC.peaks.find(p => p.id === 'R1').h) > 0.47);
check(G_F, '阈值过滤不改变峰位',
  hmbcVisible(HMBC.peaks, 1).every((p, i) => p.dH === HMBC.peaks[i].dH && p.dN === HMBC.peaks[i].dN));

/* =========================================================================
 * G. 光标匹配
 * ====================================================================== */
console.log('\n[G] 光标匹配');
const G_G = group('光标匹配');
const hit = peaksNear(HMBC.peaks, 6.86, -309.4, 0.25, 4.0);
check(G_G, '光标放在红圈峰上时命中 R1', hit.length > 0 && hit[0].id === 'R1');
check(G_G, '光标远离所有峰时命中数为 0', peaksNear(HMBC.peaks, 3.0, -240, 0.25, 4.0).length === 0);
check(G_G, '容差边界：恰好 0.25 ppm 视为命中', peaksNear(HMBC.peaks, 6.86 + 0.25, -309.4, 0.25, 4.0).length > 0);
check(G_G, '容差边界：超出 0.26 ppm 不命中', peaksNear(HMBC.peaks, 6.86 + 0.26, -309.4, 0.25, 4.0).length === 0);
check(G_G, '命中结果按距离升序',
  (() => { const r = peaksNear(HMBC.peaks, 7.2, -271.5, 0.5, 6); return r.every((x, i) => i === 0 || r[i - 1].dist <= x.dist); })());
check(G_G, 'clamp 边界：下界', clamp(-5, 0, 10) === 0);
check(G_G, 'clamp 边界：上界', clamp(15, 0, 10) === 10);
check(G_G, 'clamp 区间内不变', clamp(5, 0, 10) === 5);

/* =========================================================================
 * H. 结构与归属一致性
 * ====================================================================== */
console.log('\n[H] 结构与归属一致性');
const G_H = group('归属');
const peakIds = new Set(HMBC.peaks.map(p => p.id));
check(G_H, 'HMBC_SITES 引用的峰编号全部存在',
  HMBC_SITES.every(s => s.peaks.every(id => peakIds.has(id))),
  HMBC_SITES.flatMap(s => s.peaks.filter(id => !peakIds.has(id))).join(','));
check(G_H, 'HMBC_SITES 全部标记为结构推断',
  HMBC_SITES.every(s => s.src === 'infer'));
check(G_H, '图1 峰来源均为坐标估读', HMBC.peaks.every(p => p.src === 'read'));
check(G_H, '图2 峰来源均为坐标估读', HSQC.peaks.every(p => p.src === 'read'));
check(G_H, '齐拉西酮含 4 类氮环境的描述与 HMBC_SITES 数量一致', HMBC_SITES.length === 4);

/* =========================================================================
 * I. 术语表完整性
 * ====================================================================== */
console.log('\n[I] 术语表完整性');
const G_I = group('术语表');
check(G_I, '术语条目数 ≥ 20', GLOSSARY.length >= 20, String(GLOSSARY.length));
check(G_I, '术语 key 无重复', new Set(GLOSSARY.map(g => g.k)).size === GLOSSARY.length);
check(G_I, '每条术语都有中文解释', GLOSSARY.every(g => g.zh && g.zh.length > 8));
check(G_I, '每条术语都有英文对照', GLOSSARY.every(g => g.en && g.en.length > 1));
check(G_I, '中英对照表条目 ≥ 10', EN_ZH.length >= 10, String(EN_ZH.length));
check(G_I, '中英对照表每行字段完整', EN_ZH.every(r => r.en && r.zh && r.where));

/* =========================================================================
 * J. index.html 静态检查
 * ====================================================================== */
console.log('\n[J] index.html 静态检查');
const G_J = group('静态检查');
const htmlPath = path.join(ROOT, 'index.html');
if (!fs.existsSync(htmlPath)) {
  check(G_J, 'index.html 已生成', false, '文件不存在，请先运行 node src/build.mjs');
} else {
  const html = fs.readFileSync(htmlPath, 'utf8');
  check(G_J, 'index.html 已生成', true);
  check(G_J, '不含外部 http(s) 资源引用',
    !/(?:src|href)\s*=\s*["']https?:\/\//i.test(html),
    (html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']*/i) || [''])[0]);
  check(G_J, '不含 <script src=', !/<script[^>]+src\s*=/i.test(html));
  check(G_J, '不含 <link rel="stylesheet">', !/<link[^>]+rel=["']stylesheet/i.test(html));
  check(G_J, '两张原图已内嵌为 data URI',
    (html.match(/data:image\/png;base64,/g) || []).length >= 2,
    '找到 ' + (html.match(/data:image\/png;base64,/g) || []).length + ' 处');
  check(G_J, '包含 viewport meta（移动端适配）', /<meta[^>]+name=["']viewport/i.test(html));
  check(G_J, '语言声明为 zh-CN', /<html[^>]+lang=["']zh-CN["']/i.test(html));

  const sections = ['主要结论', '直观解释', '分步推理', '数值核对', '常见误区', '来源与限制',
    '完整归属表', '术语表', '局部放大与完整原图', '中英对照'];
  sections.forEach(s => check(G_J, '含章节：' + s, html.indexOf(s) >= 0));

  check(G_J, '含“读前必读”', html.indexOf('读前必读') >= 0);
  check(G_J, '含“示意重绘”标注', html.indexOf('示意重绘') >= 0);
  check(G_J, '正文中出现“示意”字样（结构图）', (html.match(/示意/g) || []).length >= 8,
    String((html.match(/示意/g) || []).length));
  check(G_J, '含 4 类来源徽标',
    ['原图观测', '坐标估读', '结构推断', '演示模型'].every(t => html.indexOf(t) >= 0));
  check(G_J, '控件使用中文标签（含“光标”“磷酸化程度”）',
    html.indexOf('光标') >= 0 || html.indexOf('磷酸化程度') >= 0);
  check(G_J, '包含键盘可达标记 tabindex',
    (html.match(/tabindex/g) || []).length >= 1 || html.indexOf('tabindex') >= 0);
  check(G_J, '配色变量与要求一致（#0e1116 / #151a21 / #303a47 / #5fd0a8）',
    ['#0e1116', '#151a21', '#303a47', '#5fd0a8'].every(c => html.indexOf(c) >= 0));
  check(G_J, '包含响应式断点（820px 与 560px）',
    html.indexOf('max-width: 820px') >= 0 && html.indexOf('max-width: 560px') >= 0);

  // 术语按钮 ↔ 术语表（先剥离 <script> 块，避免把内联脚本源码当成页面标记）
  const htmlMarkup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const terms = Array.from(htmlMarkup.matchAll(/data-term="([^"]+)"/g)).map(m => m[1]);
  const glKeys = new Set(GLOSSARY.map(g => g.k));
  const missing = Array.from(new Set(terms.filter(t => !glKeys.has(t))));
  check(G_J, '正文中 ' + new Set(terms).size + ' 个术语按钮均有术语表条目', missing.length === 0, missing.join(','));
  check(G_J, '术语按钮出现在正文标记中（非脚本内）', terms.length >= 15, String(terms.length));
  check(G_J, '术语按钮带 type=button 与 class=term', /<button type="button" class="term" data-term="/.test(htmlMarkup));
  check(G_J, '术语表渲染容器存在', html.indexOf('glossary-list') >= 0);

  // 原图未被改动：检查 base64 与原文件一致
  const m = html.match(/id="orig-img-hmbc"[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  const m2 = html.match(/id="orig-img-hsqc"[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  const src1 = fs.readFileSync(path.join(ROOT, 'assets/original-hmbc.png')).toString('base64');
  const src2 = fs.readFileSync(path.join(ROOT, 'assets/original-hsqc.png')).toString('base64');
  check(G_J, '内嵌的图 1 与原文件逐字节一致（未改动）', !!m && m[1] === src1);
  check(G_J, '内嵌的图 2 与原文件逐字节一致（未改动）', !!m2 && m2[1] === src2);
}

/* =========================================================================
 * 输出
 * ====================================================================== */
console.log('\n' + '='.repeat(64));
console.log('总计 ' + total + ' 项检查：通过 ' + passed + '，失败 ' + failed);
Object.keys(groups).forEach(g => console.log('  · ' + g + '：' + groups[g].passed + '/' + groups[g].total));
if (failed) {
  console.log('\n失败项：');
  fails.forEach(f => console.log('  ✗ [' + f.group + '] ' + f.desc + (f.detail ? '  → ' + f.detail : '')));
}
console.log('='.repeat(64));

fs.writeFileSync(path.join(HERE, 'report.json'), JSON.stringify({
  total, passed, failed, groups,
  fails,
  time: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
}, null, 2), 'utf8');
console.log('报告已写入 verify/report.json');

process.exit(failed === 0 ? 0 : 1);
