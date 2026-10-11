/* =============================================================================
 * 数据与模型  —  ¹H–¹⁵N 二维核磁教学页
 * -----------------------------------------------------------------------------
 * 所有数值均带来源等级标记：
 *   'obs'  原图观测   —— 原图文字/标注中直接可见的内容
 *   'read' 坐标估读   —— 按原图坐标轴刻度估读，附不确定度
 *   'infer' 结构推断  —— 由化学结构或理论关系辅助推断，非原图给出
 *   'demo' 演示模型   —— 为教学演示构造的插值/阈值模型，非原始数据
 * ========================================================================== */

/* ---------- 1. 图 1：齐拉西酮降解产物 ¹H–¹⁵N HMBC ------------------------- */

/* 坐标框像素测量值（见 verify/analyze_images.py 输出）：
   框 x∈[646,1009] px, y∈[396,639] px
   x 刻度：7→698, 6→750, 5→802, 4→854, 3→905.5, 2→957, 1→1009   (51.833 px/ppm)
   y 刻度：-320→445.5, -310→467.5, ... -240→623.0                (2.219 px/ppm)
   换算：δH = 7 - (x-698)/51.833      δN = -320 + (y-445.5)/2.219             */

export const HMBC = {
  id: 'hmbc',
  slideTitle: 'Additional Nuclei',
  title: '齐拉西酮降解产物 · ¹H–¹⁵N HMBC',
  subtitle: '原图：Additional Nuclei（第 1 张幻灯片）',
  axis: {
    x: { label: 'δH (ppm)', min: 8.0, max: 1.0, reversed: true, ticks: [7, 6, 5, 4, 3, 2, 1] },
    y: { label: 'δN (ppm)', min: -342, max: -233, ticks: [-320, -310, -300, -290, -280, -270, -260, -250, -240] },
    xUnc: 0.02,
    yUnc: 0.3,
  },
  /* 交叉峰：位置为按坐标轴估读（'read'） */
  peaks: [
    { id: 'R1', dH: 6.86, dN: -309.4, h: 21, mark: 'red', src: 'read',
      zone: '红圈', name: '红圈强调峰' },
    { id: 'D1', dH: 7.37, dN: -271.1, h: 29, mark: 'dash', src: 'read', zone: '蓝虚线框', name: '芳香/杂环区峰 1' },
    { id: 'D2', dH: 7.18, dN: -272.2, h: 30, mark: 'dash', src: 'read', zone: '蓝虚线框', name: '芳香/杂环区峰 2' },
    { id: 'D3', dH: 6.76, dN: -270.0, h: 22, mark: 'dash', src: 'read', zone: '蓝虚线框', name: '芳香/杂环区峰 3' },
    { id: 'D4', dH: 6.59, dN: -271.8, h: 18, mark: 'dash', src: 'read', zone: '蓝虚线框', name: '芳香/杂环区峰 4' },
    { id: 'S1', dH: 4.56, dN: -270.4, h: 18, mark: 'plain', src: 'read', zone: '孤立峰', name: '中部孤立峰' },
    { id: 'B1', dH: 1.75, dN: -271.1, h: 43, mark: 'solid', src: 'read', zone: '蓝实线框', name: '脂肪链区峰 1' },
    { id: 'B2', dH: 1.45, dN: -277.6, h: 10, mark: 'solid', src: 'read', zone: '蓝实线框', name: '脂肪链区峰 2' },
    { id: 'T1', dH: 1.75, dN: -316.6, h: 9, mark: 'plain', src: 'read', zone: '右上角', name: '右上弱峰' },
  ],
  /* 原图上的手工标注框（同样为估读） */
  boxes: [
    { id: 'redoval', kind: 'ellipse', dH0: 7.02, dH1: 6.67, dN0: -318.9, dN1: -300.4,
      label: '红圈', src: 'read' },
    { id: 'dash', kind: 'dashed', dH0: 7.66, dH1: 6.25, dN0: -281.5, dN1: -261.2,
      label: '蓝虚线框', src: 'read' },
    { id: 'solid', kind: 'solid', dH0: 1.95, dH1: 1.58, dN0: -284.6, dN1: -257.6,
      label: '蓝实线框', src: 'read' },
  ],
  /* 1D ¹H 投影：峰位按原图顶部迹线估读（'read'）；重绘曲线本身为示意 */
  trace1d: [
    { dH: 7.56, a: 0.20 }, { dH: 7.48, a: 0.62 }, { dH: 7.27, a: 0.18 },
    { dH: 7.17, a: 0.08 }, { dH: 6.85, a: 0.66 }, { dH: 6.67, a: 0.22 },
    { dH: 5.32, a: 0.06 }, { dH: 3.68, a: 0.06 }, { dH: 3.57, a: 0.28 },
    { dH: 3.41, a: 0.86 }, { dH: 3.30, a: 0.86 }, { dH: 3.06, a: 0.18 },
    { dH: 2.87, a: 0.28 }, { dH: 2.51, a: 0.86 }, { dH: 2.00, a: 0.14 },
    { dH: 1.75, a: 0.86 }, { dH: 1.46, a: 0.08 }, { dH: 1.23, a: 0.82 },
  ],
  /* 原图整幅尺寸（像素），用于局部放大定位 */
  img: { file: 'original-hmbc.png', w: 1034, h: 807 },
  /* 局部放大预设区域（原图像素框） */
  zooms: [
    { id: 'hmbc-red', name: '红圈区（δN ≈ −309）', box: [678, 436, 60, 70] },
    { id: 'hmbc-dash', name: '蓝虚线框（芳香/杂环区）', box: [655, 518, 95, 70] },
    { id: 'hmbc-solid', name: '蓝实线框（脂肪链区）', box: [940, 512, 62, 86] },
    { id: 'hmbc-axis', name: '纵轴刻度（δN）', box: [560, 420, 130, 220] },
  ],
};

/* ---------- 2. 图 2：磷酸化蛋白 ¹⁵N HSQC ---------------------------------- */

/* 坐标框像素测量值：
   框 x∈[636,955] px, y∈[117,415] px
   x 刻度：9.0→639, 8.5→770.5, 8.0→901.5   (262.5 px/ppm)
   y 刻度：110→179, 112→245.5, 114→311.5, 116→377.5  (33.083 px/ppm)
   换算：δH = 9.0 - (x-639)/262.5      δN = 110 + (y-179)/33.083              */

export const HSQC = {
  id: 'hsqc',
  slideTitle: 'Additional Nuclei',
  title: '磷酸化蛋白 · ¹⁵N HSQC',
  subtitle: '原图：Additional Nuclei（第 2 张幻灯片）',
  axis: {
    x: { label: '¹H (ppm)', min: 9.0, max: 8.0, reversed: true, ticks: [9.0, 8.5, 8.0] },
    y: { label: 'δN (ppm)', min: 108.1, max: 117.1, ticks: [110, 112, 114, 116] },
    xUnc: 0.02,
    yUnc: 0.3,
  },
  /* 每个标注对应一组峰：state 'a' = 黑色（原图 (a) 组），'b' = 蓝色（原图 (b) 组）
     partner = 该 (b) 峰在“未磷酸化”状态下所对应的 (a) 峰标签（演示模型插值用） */
  peaks: [
    { label: 'Gly2', state: 'a', dH: 8.413, dN: 108.91, src: 'read' },
    { label: 'Gly5', state: 'a', dH: 8.274, dN: 109.71, src: 'read' },
    { label: 'Gly5', state: 'b', dH: 8.181, dN: 109.73, src: 'read', partner: 'Gly5' },
    { label: 'Gly4', state: 'a', dH: 8.554, dN: 111.15, src: 'read' },
    { label: 'Gly4', state: 'b', dH: 8.617, dN: 111.24, src: 'read', partner: 'Gly4' },
    { label: 'Gly1', state: 'a', dH: 8.347, dN: 114.37, src: 'read' },
    { label: 'Gly1', state: 'b', dH: 8.364, dN: 114.50, src: 'read', partner: 'Gly1' },
    { label: 'Ser3', state: 'a', dH: 8.392, dN: 115.88, src: 'read' },
    { label: 'pSer3', state: 'b', dH: 8.710, dN: 115.85, src: 'read', partner: 'Ser3' },
  ],
  /* 原图箭头：由 Ser3 指向 pSer3（向左，即向高 ppm 方向） */
  arrow: { from: 'Ser3', to: 'pSer3', src: 'obs' },
  /* 图例：原图右上角 (b)、左上角 (a) */
  legend: [
    { key: 'a', text: '黑色 —— 原图 (a) 组', src: 'obs' },
    { key: 'b', text: '蓝色 —— 原图 (b) 组', src: 'obs' },
  ],
  img: { file: 'original-hsqc.png', w: 1043, h: 704 },
  zooms: [
    { id: 'hsqc-ser', name: 'Ser3 → pSer3（箭头区）', box: [700, 348, 135, 45] },
    { id: 'hsqc-top', name: 'Gly2 / Gly5 顶部区', box: [770, 120, 120, 70] },
    { id: 'hsqc-axis', name: '右侧纵轴（δN）', box: [940, 110, 105, 310] },
  ],
};

/* ---------- 3. 对象（可切换的教学对象） ----------------------------------- */

export const OBJECTS = [
  { id: 'hmbc', label: '① 齐拉西酮降解产物', sub: '¹H–¹⁵N HMBC（小分子）', kind: 'small' },
  { id: 'hsqc', label: '② 磷酸化蛋白', sub: '¹⁵N HSQC（蛋白主链）', kind: 'protein' },
];

/* ---------- 4. 结构辅助推断：氮位点 ↔ 交叉峰 ------------------------------ */
/* 原图未给出逐峰归属，以下为按结构推断的“候选对应”，标记为 'infer'，不得当作已确认归属。 */

export const HMBC_SITES = [
  { id: 'N-btz', name: '苯并异噻唑 N（S–N=）', zone: '芳香/杂环区',
    peaks: ['D1', 'D2', 'D3', 'D4'], src: 'infer' },
  { id: 'N-pip', name: '哌嗪 两个 N', zone: '脂肪链区',
    peaks: ['B1', 'B2', 'S1'], src: 'infer' },
  { id: 'N-lactam', name: '羟吲哚 N–H（内酰胺 N）', zone: '红圈 / 芳香区',
    peaks: ['R1', 'D1', 'D2', 'D3', 'D4'], src: 'infer' },
  { id: 'N-new', name: '降解产物新增氮环境（未确认）', zone: '红圈',
    peaks: ['R1'], src: 'infer' },
];

/* ---------- 5. 理论换算常数 ---------------------------------------------- */
/* ¹⁵N 参考物：液氨 NH₃（IUPAC 推荐，0 ppm）与硝基甲烷 CH₃NO₂ 之差约 380.5 ppm
   δ(NH₃ 标度) = δ(CH₃NO₂ 标度) + 380.5                                   */
export const REF_OFFSET_NH3_CH3NO2 = 380.5;

/* ---------- 6. 纯函数（供页面与验证脚本共用） ----------------------------- */

/** 线性插值 */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** 限制到区间 */
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** ppm → Hz（给定观测频率，单位 MHz） */
export function ppmToHz(ppm, freqMHz) { return ppm * freqMHz; }

/** ¹⁵N 参考物标度换算：from/to ∈ {'NH3','CH3NO2'} */
export function convertN15(delta, from, to) {
  if (from === to) return delta;
  if (from === 'CH3NO2' && to === 'NH3') return delta + REF_OFFSET_NH3_CH3NO2;
  if (from === 'NH3' && to === 'CH3NO2') return delta - REF_OFFSET_NH3_CH3NO2;
  throw new Error('unknown reference scale: ' + from + ' -> ' + to);
}

/** 在 δH/δN 光标附近（容差内）找出交叉峰，按距离升序 */
export function peaksNear(peaks, dH, dN, tolH, tolN) {
  return peaks
    .map(p => {
      const ddH = Math.abs(p.dH - dH);
      const ddN = Math.abs(p.dN - dN);
      const hit = ddH <= tolH && ddN <= tolN;
      return { ...p, ddH, ddN, hit, dist: Math.hypot(ddH / tolH, ddN / tolN) };
    })
    .filter(p => p.hit)
    .sort((a, b) => a.dist - b.dist);
}

/** HMBC：按演示模型强度阈值过滤（阈值仅作用于演示模型的显示，不改变真实峰位） */
export function hmbcVisible(peaks, thr) {
  return peaks.map(p => ({ ...p, shown: (p.h / 43) >= thr }));
}

/** 相对强度（演示模型）：以最强峰 B1(h=43px) 归一 */
export function relIntensity(h) { return h / 43; }

/** HSQC 演示模型：按“磷酸化程度 p∈[0,1]”把 (b) 组峰从 (a) 位置线性插值到观测 (b) 位置
 *  p = 0 时蓝峰与对应黑峰完全重合；p = 1 时回到原图观测位置。 */
export function hsqcBlueSeries(p) {
  const t = clamp(p, 0, 1);
  return HSQC.peaks
    .filter(k => k.state === 'b')
    .map(k => {
      const a = HSQC.peaks.find(x => x.label === (k.partner || k.label) && x.state === 'a');
      if (!a) return { ...k, dH: k.dH, dN: k.dN, opacity: 1, moved: false };
      return {
        ...k,
        dH: lerp(a.dH, k.dH, t),
        dN: lerp(a.dN, k.dN, t),
        opacity: 1,
        deltaH: k.dH - a.dH,
        deltaN: k.dN - a.dN,
        moved: t > 0 && t < 1,
      };
    });
}

/** HSQC：黑峰（(a) 组）恒定不变 —— 用于“不变量”检查 */
export function hsqcBlackSeries() {
  return HSQC.peaks.filter(k => k.state === 'a');
}

/* ---------- 7. 预计算：原图标注的位移差（数值核对用） --------------------- */

export function serShift() {
  const a = HSQC.peaks.find(k => k.label === 'Ser3');
  const b = HSQC.peaks.find(k => k.label === 'pSer3');
  return {
    dH: b.dH - a.dH,
    dN: b.dN - a.dN,
    serH: a.dH, serN: a.dN, pserH: b.dH, pserN: b.dN,
  };
}

/* ---------- 8. 术语表 ---------------------------------------------------- */

export const GLOSSARY = [
  { k: 'HMBC', zh: '异核多键相关谱（Heteronuclear Multiple Bond Correlation）。一种二维核磁实验，检测相隔 2–3 根化学键的 ¹H 与杂核（此处为 ¹⁵N）之间的相关信号，用于把碎片“连起来”。', en: 'Heteronuclear Multiple Bond Correlation' },
  { k: 'HSQC', zh: '异核单量子相关谱（Heteronuclear Single Quantum Coherence）。检测直接相连（¹J）的 ¹H–X 对，蛋白 ¹⁵N HSQC 常被称为主链“指纹图”。', en: 'Heteronuclear Single Quantum Coherence' },
  { k: 'ppm', zh: '百万分之一（parts per million）。化学位移的相对单位，δ = (ν样品 − ν参考)/ν参考 × 10⁶，无量纲。', en: 'parts per million' },
  { k: '化学位移 δ', zh: '原子核在磁场中感受到的有效场与裸核不同，导致共振频率偏移，用 ppm 表示。数值大小反映化学环境（电子云密度、邻接基团）。', en: 'chemical shift' },
  { k: '核素', zh: '具有确定质子数与中子数的原子种类。此处指 ¹H 与 ¹⁵N；两者自旋量子数 I = 1/2，适合高分辨核磁。', en: 'nuclide' },
  { k: '¹⁵N 天然丰度', zh: '¹⁵N 在自然界的丰度约 0.37%，远低于 ¹H（≈99.98%）。因此蛋白 ¹⁵N HSQC 通常需要用 ¹⁵N 标记（富集）样品。', en: 'natural abundance of ¹⁵N' },
  { k: '交叉峰', zh: '二维谱中同时满足两个频率条件的信号斑点。一个交叉峰代表一个 (δH, δN) 相关对。', en: 'cross peak' },
  { k: '等高线', zh: '二维谱用等高线（contour）绘制强度，同一峰的“层数”反映相对强度。', en: 'contour' },
  { k: '归属', zh: '把谱峰指派到分子中具体的原子/基团上。归属需要多种实验互相印证，单张谱图通常不足以定论。', en: 'assignment' },
  { k: '齐拉西酮', zh: 'Ziprasidone，一种非典型抗精神病药，用于治疗精神分裂症等精神疾病。分子含苯并异噻唑、哌嗪与羟吲哚三个片段。', en: 'Ziprasidone' },
  { k: '降解产物', zh: '原料药在储存或加工过程中因水解、氧化、光照等生成的杂质。结构解析常用 LC-MS 加二维核磁。', en: 'degradation product' },
  { k: '磷酸化', zh: '蛋白质翻译后修饰之一：激酶把磷酸基（–PO₃H₂）加到 Ser/Thr/Tyr 的羟基上。会改变局部电荷与化学环境，从而移动谱峰。', en: 'phosphorylation' },
  { k: '苯并异噻唑', zh: '1,2-benzisothiazole，苯环与含 S、N 的五元环稠合的双环杂环，是齐拉西酮的左侧片段。', en: '1,2-benzisothiazole' },
  { k: '哌嗪', zh: 'Piperazine，含两个对位氮原子的六元饱和杂环，齐拉西酮中间把它作为连接桥。', en: 'piperazine' },
  { k: '羟吲哚 / 2-吲哚酮', zh: 'Oxindole（1,3-dihydro-2H-indol-2-one），苯环与内酰胺五元环稠合，齐拉西酮右侧片段，含 N–H。', en: 'oxindole / 2-indolinone' },
  { k: '内酰胺', zh: '环状酰胺。其氮原子（N–H）在 ¹⁵N 谱中处于较特征的位置。', en: 'lactam' },
  { k: '官能团', zh: '决定分子化学性质的原子或原子团，如 –NH–、–C=O、–Cl、–OH、磷酸酯 –O–PO₃H₂。', en: 'functional group' },
  { k: 'Gly', zh: '甘氨酸（Glycine），侧链只有 H，是蛋白 ¹⁵N HSQC 中常见的清晰信号。', en: 'Glycine' },
  { k: 'Ser / pSer', zh: '丝氨酸（Serine）/ 磷酸化丝氨酸（phosphoserine）。Ser 的侧链为 –CH₂–OH；磷酸化后变为 –CH₂–O–PO₃H₂。', en: 'Serine / phosphoserine' },
  { k: '参考物', zh: '定义化学位移零点所用的化合物。¹⁵N 常用液氨（NH₃，IUPAC 推荐）或硝基甲烷（CH₃NO₂），两者标度相差约 380.5 ppm。', en: 'reference compound' },
  { k: '向低场位移', zh: '化学位移数值变大（ppm 增大）。在常规谱图中峰向左移动。', en: 'downfield shift' },
  { k: '自旋-自旋耦合 J', zh: '相邻核之间通过成键电子传递的相互作用。HMBC 利用 ²J/³J（远程），HSQC 利用 ¹J（单键）。', en: 'scalar coupling' },
];

/* ---------- 9. 中英对照（原图中的英文专业词） ----------------------------- */

export const EN_ZH = [
  { en: 'Additional Nuclei', zh: '额外核素（指 ¹H 之外的核）', where: '两张幻灯片的标题' },
  { en: 'proton nitrogen HMBC', zh: '¹H–¹⁵N 异核多键相关谱', where: '图 1 正文' },
  { en: 'degradation product', zh: '降解产物', where: '图 1 正文' },
  { en: 'Ziprasidone', zh: '齐拉西酮', where: '图 1 正文' },
  { en: 'mental disorders', zh: '精神疾病', where: '图 1 正文' },
  { en: 'nitrogen HSQC', zh: '¹⁵N 异核单量子相关谱', where: '图 2 正文' },
  { en: 'protein work', zh: '蛋白质研究', where: '图 2 正文' },
  { en: 'phosphorylation', zh: '磷酸化', where: '图 2 正文' },
  { en: 'δH (ppm) / δN (ppm)', zh: '¹H / ¹⁵N 化学位移（百万分之一）', where: '两图坐标轴' },
  { en: 'Gly1, Gly2, Gly4, Gly5', zh: '甘氨酸残基 1、2、4、5 号', where: '图 2 峰标注' },
  { en: 'Ser3 / pSer3', zh: '3 号丝氨酸 / 磷酸化 3 号丝氨酸', where: '图 2 峰标注' },
  { en: '(a) / (b)', zh: '(a)、(b) 两组数据系列（原图右上/左上角图例）', where: '图 2 图例' },
];
