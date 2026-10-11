/* ============================================================
   数据层：全部数值来自对原图的逐像素估读 + 明确标注来源
   原图尺寸 1053 x 811 px
   标定：由原图坐标轴主刻度反解得到
   ============================================================ */
window.DATA = (function () {

  /* ---------- 1. 像素 → ppm 标定（原图观测，可复核） ---------- */
  // 横轴：主刻度像素位置（检测值）与对应 ppm
  const xTicksPx = [714.0, 766.0, 818.0, 870.0, 921.0, 973.0, 1025.0];
  const xTicksPpm = [7, 6, 5, 4, 3, 2, 1];
  // 最小二乘拟合
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = xTicksPx.length;
  for (let i = 0; i < n; i++) { sx += xTicksPx[i]; sy += xTicksPpm[i]; sxx += xTicksPx[i] * xTicksPx[i]; sxy += xTicksPx[i] * xTicksPpm[i]; }
  const slopeX = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const interceptX = (sy - slopeX * sx) / n;           // dH = slopeX*px + interceptX

  // 纵轴：标签中心像素位置（检测值）与对应 ppm
  const yTicksPx = [457.5, 479.5, 501.5, 524.0, 546.5, 568.5, 590.5, 613.0, 635.0];
  const yTicksPpm = [-320, -310, -300, -290, -280, -270, -260, -250, -240];
  let tx = 0, ty = 0, txx = 0, txy = 0, m = yTicksPx.length;
  for (let i = 0; i < m; i++) { tx += yTicksPx[i]; ty += yTicksPpm[i]; txx += yTicksPx[i] * yTicksPx[i]; txy += yTicksPx[i] * yTicksPpm[i]; }
  const slopeY = (m * txy - tx * ty) / (m * txx - tx * tx);
  const interceptY = (ty - slopeY * tx) / m;           // dN = slopeY*py + interceptY

  const calib = {
    slopeX, interceptX, slopeY, interceptY,
    pxPerPpmH: 1 / slopeX,          // ≈ +51.75 px / ppm (δH 向右减小)
    pxPerPpmN: 1 / slopeY,          // ≈ +2.219 px / ppm (δN 向下增大)
    xTicksPx, xTicksPpm, yTicksPx, yTicksPpm
  };

  const px2dH = px => slopeX * px + interceptX;
  const px2dN = py => slopeY * py + interceptY;

  /* ---------- 2. 谱图绘图框（原图观测） ---------- */
  const frame = { x0: 662, x1: 1025, y0: 408, y1: 651 };
  const frameRange = {
    dH: [px2dH(frame.x1), px2dH(frame.x0)],   // [0.99, 8.01]
    dN: [px2dN(frame.y0), px2dN(frame.y1)]    // [-342.3, -232.8]
  };

  /* ---------- 3. 交叉峰（原图观测，估读） ---------- */
  // h = 原图竖直方向像素高度，仅作"相对强弱"的估读代理，不是积分值
  // dH 估读不确定度 ±0.05 ppm；dN 估读不确定度 ±1.5 ppm
  const peaks = [
    { id: 'P1', dH: 7.37, dN: -271.3, h: 30, group: 'dashed', tag: '芳香区 · 蓝虚框内' },
    { id: 'P2', dH: 7.20, dN: -272.2, h: 32, group: 'dashed', tag: '芳香区 · 蓝虚框内' },
    { id: 'P3', dH: 6.86, dN: -309.1, h: 22, group: 'ellipse', tag: '红椭圆圈出（原图重点标注）' },
    { id: 'P4', dH: 6.76, dN: -270.0, h: 22, group: 'dashed', tag: '芳香区 · 蓝虚框内' },
    { id: 'P5', dH: 6.60, dN: -271.8, h: 18, group: 'dashed', tag: '芳香区 · 蓝虚框内' },
    { id: 'P6', dH: 4.56, dN: -270.2, h: 19, group: 'free', tag: '孤立峰（一维投影无对应峰）' },
    { id: 'P7', dH: 2.26, dN: -264.6, h: 4, group: 'free', faint: true, tag: '极弱峰 · 目视估读（自动阈值未捕获）' },
    { id: 'P8', dH: 1.75, dN: -271.3, h: 44, group: 'solid', tag: '脂肪区 · 紫实框内（最强）' },
    { id: 'P9', dH: 1.76, dN: -316.3, h: 10, group: 'free', tag: '弱峰 · 纵轴最高处' },
    { id: 'P10', dH: 1.45, dN: -278.1, h: 12, group: 'free', tag: '弱峰 · 紫框右侧' }
  ];

  /* ---------- 4. 原图三个手工标注框（原图观测） ---------- */
  const boxes = [
    { id: 'ellipse', kind: 'ellipse', label: '红色椭圆', color: '#e2686a',
      dH: [6.68, 7.04], dN: [-318.8, -300.4], contains: ['P3'],
      note: '圈出 δH≈6.86 / δN≈−309 的单个交叉峰' },
    { id: 'dashed', kind: 'rect', label: '蓝色虚线框', color: '#7ab6f5',
      dH: [6.25, 7.68], dN: [-281.9, -260.7], contains: ['P1', 'P2', 'P4', 'P5'],
      note: '圈出芳香区 4 个交叉峰' },
    { id: 'solid', kind: 'rect', label: '紫色实线框', color: '#b48ef0',
      dH: [1.56, 1.96], dN: [-285.1, -257.1], contains: ['P8'],
      note: '圈出 δH≈1.75 / δN≈−271 的最强脂肪区交叉峰' }
  ];

  /* ---------- 5. 顶部一维 ¹H 投影峰（原图观测，估读） ---------- */
  // h = 投影峰在原始像素中的高度（基线至峰顶），仅作相对强弱代理
  const projection = [
    { dH: 7.56, h: 7, w: 'w' },
    { dH: 7.47, h: 19, w: 's' },
    { dH: 7.27, h: 8, w: 'w' },
    { dH: 7.16, h: 4, w: 'vw' },
    { dH: 6.85, h: 16, w: 'm' },
    { dH: 6.66, h: 8, w: 'w' },
    { dH: 5.30, h: 3, w: 'vw' },
    { dH: 3.57, h: 13, w: 'm' },
    { dH: 3.43, h: 26, w: 's' },
    { dH: 3.28, h: 26, w: 's' },
    { dH: 3.06, h: 8, w: 'w' },
    { dH: 2.87, h: 11, w: 'm' },
    { dH: 2.50, h: 29, w: 's' },
    { dH: 2.00, h: 7, w: 'w' },
    { dH: 1.75, h: 29, w: 's' },
    { dH: 1.46, h: 3, w: 'vw' },
    { dH: 1.23, h: 25, w: 's' }
  ];
  // 一维投影中"无可见峰"的区间（用于一致性核对）
  const projGaps = [
    { dH: [4.30, 4.80], note: 'δH 4.30–4.80 区间一维投影无可见峰' },
    { dH: [2.10, 2.45], note: 'δH 2.10–2.45 区间一维投影无可见峰（两侧最近的投影峰在 2.00 与 2.50）' }
  ];

  /* ---------- 6. 分子式与计数（结构辅助推断 + 理论计数） ---------- */
  const formula = {
    hill: 'C21H21ClN4OS',
    atoms: { C: 21, H: 21, Cl: 1, N: 4, O: 1, S: 1 },
    mW: 412.94,
    dbe: 13,
    dbeDetail: [
      '苯并异噻唑的苯环：1 环 + 3 π = 4',
      '异噻唑五元环（新增）：1 环 + 1 π（N=C）= 2',
      '氧化吲哚的苯环：1 环 + 3 π = 4',
      '氧化吲哚内酰胺五元环：1 环',
      '内酰胺 C=O：1 π',
      '哌嗪六元环：1 环',
      '合计 = 4+2+4+1+1+1 = 13'
    ],
    hCount: [
      '苯并异噻唑芳氢 4 个（H4–H7）',
      '哌嗪 4 个 CH₂ = 8 个 H',
      '乙基连接链 2 个 CH₂ = 4 个 H',
      '氧化吲哚芳氢 2 个 + C3-H₂ 2 个 + N–H 1 个 = 5 个 H',
      '合计 4+8+4+5 = 21'
    ]
  };

  /* ---------- 7. 结构单元（对象选择） ---------- */
  const units = [
    {
      id: 'benziso', name: '1,2-苯并异噻唑', en: '1,2-benzisothiazol-3-yl',
      atoms: ['S1', 'N2', 'C3', 'C3a', 'C7a', 'ar1'],
      dHexp: '7.3 – 7.9（苯环 H4–H7）',
      dNexp: 'sp² 杂环氮，落在本图纵轴窗口的偏负一侧（无直接相连 H）',
      related: ['P1', 'P2', 'P3', 'P4', 'P5'],
      src: 'infer',
      text: '这个双环是分子的左端：苯环与一个含 S、N 的五元环稠合。环内氮没有直接相连的氢，因此它只能通过 ²J 或 ³J 与苯环上的氢产生相关。原图用红椭圆重点圈出的那个峰（δH≈6.86 / δN≈−309）就落在芳香区，是本页最值得注意的观测；但原图并未给出它的归属。'
    },
    {
      id: 'pipA', name: '哌嗪 N（连芳杂环）', en: 'piperazine N-aryl',
      atoms: ['pipN1', 'pipC', 'pipC2', 'pipC3', 'pipN4'],
      dHexp: '2.4 – 3.7（哌嗪 4 个 CH₂）',
      dNexp: 'N-芳基哌嗪氮，通常比 N-烷基氮更"正"（更接近 0）',
      related: ['P9'],
      src: 'infer',
      text: '哌嗪的两个氮化学环境并不等价：一个连着苯并异噻唑（N-芳基），另一个连着乙基（N-烷基）。N-芳基氮的孤对电子与芳环共轭，¹⁵N 化学位移通常明显区别于 N-烷基氮，这也是本图纵轴能把它们分开的物理基础。'
    },
    {
      id: 'pipB', name: '哌嗪 N（连烷基）', en: 'piperazine N-alkyl',
      atoms: ['pipN4', 'pipC3', 'pipC2', 'pipN1'],
      dHexp: '2.3 – 2.7（N–CH₂）',
      dNexp: '叔胺氮（N-烷基），通常落在较负的位置',
      related: ['P10'],
      src: 'infer',
      text: '连烷基的叔胺氮没有 π 共轭，屏蔽更强，¹⁵N 位移一般比 N-芳基氮更负。原图在纵轴最负侧（δN≈−316）确实有一个弱交叉峰（δH≈1.75），但原图没有标注，本页不作归属断言。'
    },
    {
      id: 'lactam', name: '氧化吲哚内酰胺 N–H', en: 'oxindole lactam N–H',
      atoms: ['lacN1', 'lacH', 'lacC2', 'lacO'],
      dHexp: 'N–H 质子约 9 – 11（DMSO-d₆ 中）',
      dNexp: '内酰胺/酰胺氮，文献范围约 −250 至 −270（以液氨为参照）',
      related: [],
      src: 'infer',
      text: '关键限制：本图横轴只画到 δH ≈ 8.0 ppm，而内酰胺 N–H 的 ¹H 信号通常出现在 9–11 ppm，落在窗口之外。因此本图看不到 N–H 自身的 ²J(N–H) 自相关峰——这属于"图上没有"而非"分子里没有"。'
    },
    {
      id: 'aryl', name: '芳环 C–H（全部分子）', en: 'aromatic C–H',
      atoms: ['ar1', 'ar2'],
      dHexp: '6.5 – 7.6',
      dNexp: '—（氢与氮之间为 ²J/³J 远程相关）',
      related: ['P1', 'P2', 'P3', 'P4', 'P5'],
      src: 'observe',
      text: '原图在 δH 6.5–7.6 之间一共可辨 5 个交叉峰（估读），全部落在 δN −270 至 −310 的窄带里。它们对应分子中两个芳环上的氢与某个氮之间的远程相关。'
    }
  ];

  /* ---------- 8. HMBC 演示模型参数（明确属于演示，不是原材料数据） ---------- */
  const model = {
    Jdemo: { P1: 4.5, P2: 4.5, P3: 4.0, P4: 4.5, P5: 4.0, P6: 5.0, P7: 6.0, P8: 5.5, P9: 5.0, P10: 6.0 },
    T2: 1.0,       // s，演示取值（小分子在溶液中的典型量级）
    deltaRange: [20, 250],  // ms
    deltaDefault: 111
  };

  /* ---------- 9. 术语表 ---------- */
  const glossary = [
    { id: 'HMBC', t: '¹H–¹⁵N HMBC', e: 'proton–nitrogen heteronuclear multiple-bond correlation',
      d: '一种二维核磁实验：横轴是氢的化学位移，纵轴是氮的化学位移，图上出现"点"表示某个氢与某个氮之间存在跨越 2–3 根键的耦合。原图文字 "proton nitrogen HMBC" 即指此实验。' },
    { id: 'cross', t: '交叉峰', e: 'cross peak',
      d: '二维谱上的一个信号点，其横坐标来自一个氢、纵坐标来自一个氮，代表这两个原子之间存在相关。' },
    { id: 'delta', t: '化学位移 δ', e: 'chemical shift',
      d: '核磁信号相对参照物偏移的相对量，δ =(ν_sample − ν_ref)/ν_ref × 10⁶，单位 ppm，是无量纲的。' },
    { id: 'ppm', t: 'ppm', e: 'parts per million',
      d: '百万分之一，核磁化学位移的通用单位。数值本身无单位量纲，写法上读作"ppm"。' },
    { id: 'proj', t: '一维投影 / 一维谱', e: '1D projection',
      d: '二维谱上方（或侧方）那条曲线，一般由二维数据沿氢维投影得到，也常直接放一张一维 ¹H 谱作对照。本页称"顶部一维 ¹H 投影"。' },
    { id: 'abund', t: '¹⁵N 自然丰度', e: 'natural abundance of ¹⁵N',
      d: '约 0.37 %，远低于 ¹³C 的 1.1 %，所以 ¹⁵N 实验灵敏度低、纵向（氮维）分辨率通常较差，峰看起来"胖"。' },
    { id: 'J', t: '偶合常数 J', e: 'coupling constant',
      d: '两个核之间通过化学键传递的相互作用强度，单位 Hz。HMBC 的强度随 J 与实验延迟的匹配程度而变化。' },
    { id: 'delay', t: '演化延迟 Δ₂', e: 'evolution delay',
      d: 'HMBC 脉冲序列中让远程耦合演化的时间，最佳值 Δ₂ = 1/(2J)。它决定实验对哪个 J 区间最敏感。' },
    { id: 'benziso', t: '1,2-苯并异噻唑', e: '1,2-benzisothiazole',
      d: '苯环与含硫、氮的五元环稠合的双环体系。本分子左端即该基团（通过其 3 位与哌嗪相连）。' },
    { id: 'pip', t: '哌嗪', e: 'piperazine',
      d: '含两个氮的六元饱和环，两个氮处于 1,4 位。本分子中它是连接左右两端的桥。' },
    { id: 'oxindole', t: '氧化吲哚', e: 'oxindole / 1,3-dihydro-2H-indol-2-one',
      d: '苯环与一个含 N–H 和 C=O 的五元内酰胺环稠合的双环体系。' },
    { id: 'lactam', t: '内酰胺', e: 'lactam',
      d: '环状的酰胺。氧化吲哚中的五元环即为内酰胺，含 –C(=O)–NH– 结构。' },
    { id: 'fg', t: '官能团', e: 'functional group',
      d: '分子中决定化学性质与波谱特征的原子团，如 C=O、N–H、C–Cl、叔胺氮等。' },
    { id: 'amine', t: '叔胺', e: 'tertiary amine',
      d: '氮上连有三个碳取代基的胺。哌嗪的两个氮在本分子中都是叔胺氮。' },
    { id: 'lcms', t: 'LC-MS', e: 'liquid chromatography–mass spectrometry',
      d: '液相色谱-质谱联用。原图的背景文献提到最初用 LC-MS 推断降解产物为环状磺酰胺，后被 NMR 推翻。' },
    { id: 'degradant', t: '降解产物', e: 'degradation product',
      d: '原料药在储存或强制降解条件（如碱水解、氧化）下生成的杂质。原图讨论的正是齐拉西酮的一个降解产物。' },
    { id: 'isomer', t: '异构体', e: 'isomer',
      d: '分子式相同而连接方式或空间排布不同的化合物。背景文献指出该降解产物是异构体，需要逐步排除多个候选结构。' },
    { id: 'est', t: '估读', e: 'estimated reading',
      d: '本页用于标记"从位图图像上读出的数值"。因为原图是截图、刻度为整数网格，这类数值存在不可消除的不确定度，本页统一给出 ±0.05 ppm（氢）与 ±1.5 ppm（氮）。' },
    { id: 'hydro', t: '碱水解', e: 'alkaline hydrolysis',
      d: '在碱性条件下使化学键（常见为酯、酰胺、磺酰胺）断裂的反应。背景文献中该降解产物正是齐拉西酮碱水解得到的。' },
    { id: 'forced', t: '强制降解', e: 'forced degradation',
      d: '在强化条件（酸、碱、氧化、光照、高温）下加速原料药降解，用以发现并鉴定潜在杂质的规范性实验手段。' }
  ];

  /* ---------- 10. 原图文字（原文 + 中英对照） ---------- */
  const sourceText = {
    title: { en: 'Additional Nuclei', zh: '其他核（除 ¹H、¹³C 之外的核）' },
    bullets: [
      { en: 'Here is a rather interesting proton nitrogen HMBC helping elucidate a degradation product of Ziprasidone',
        zh: '这里有一个相当有意思的"氢–氮 HMBC"，它帮助阐明了齐拉西酮的一个降解产物。',
        terms: { 'proton nitrogen HMBC': '氢–氮 HMBC（即 ¹H–¹⁵N HMBC）', 'elucidate': '阐明、解析', 'degradation product': '降解产物', 'Ziprasidone': '齐拉西酮（抗精神病药）' } },
      { en: 'This is a drug used to treat mental disorders',
        zh: '这是一种用于治疗精神障碍的药物。',
        terms: { 'mental disorders': '精神障碍' } }
    ]
  };

  /* ---------- 11. 外部背景来源（非原图内容） ---------- */
  const externalRef = {
    cite: 'Szakács, Z.; Kóti, J. "An Elusive Degradation Product of Ziprasidone". In Anthropic Awareness: The Human Aspects of Scientific Thinking in NMR Spectroscopy and Mass Spectrometry; Elsevier, 2015; Chapter 12, pp 377–389.',
    points: [
      '齐拉西酮（一种抗精神病原料药）经碱水解得到一个未见报道的降解产物。',
      '最初依据 LC-MS 推断其结构为环状磺酰胺衍生物。',
      '波谱表征表明拿到的是异构体；有多个可能的结构候选需要被系统排除。',
      '由于溶解度有限、共振信号变宽，且样品中乙酰胺污染严重，¹H 与 ¹³C NMR 无法对其做完全表征。',
      '该降解物在酸性条件下化学不稳定，其酸性分解产物结构明确，反过来为所提结构提供了旁证。',
      '关键词含：Impurity B、Oxindole、Isatin hydrate、Geminal diol、Forced degradation、Oxidation product。'
    ]
  };

  /* ---------- 12. 无法从原材料确认的事项 ---------- */
  const unknowns = [
    '¹⁵N 化学位移的参照标准（液氨 / 硝基甲烷 / 其他）——原图未标注，因此纵轴数值只能在"原图坐标系内"使用。',
    '每个交叉峰对应哪个氮、哪个氢——原图未给出任何归属标注。',
    '实验条件：氘代溶剂、温度、磁场强度、脉冲序列、演化延迟 Δ₂、扫描次数——原图均未给出。',
    '降解产物的确切化学结构——原图只画出了骨架与一句文字描述。',
    '纵轴刻度为 −240 至 −320 的整数网格，读出值只能估读（氮 ±1.5 ppm）。',
    'δH≈4.56 的交叉峰（P6）与 δH≈2.26 的极弱峰（P7）在一维投影上都找不到对应峰，原因无法从原图判断。',
    'P7（δH≈2.26 / δN≈−264.6）只有约 2×4 个像素、灰度仅略深于背景，无法排除它是噪声或图像压缩伪影。',
    '原图未标注内标、浓度、样品纯度，也未说明图中是否含溶剂或杂质峰；δH≈5.30 与 2.50 处的投影峰无法判定归属。'
  ];

  return {
    meta: {
      imgW: 1053, imgH: 811,
      title: 'Additional Nuclei',
      titleZh: '其他核：¹H–¹⁵N HMBC',
      goal: '看懂一张 ¹H–¹⁵N HMBC 二维谱：它长什么样、纵轴为什么是负的、原图标了哪三个区域、以及这张图能证明什么、不能证明什么。'
    },
    calib, frame, frameRange, peaks, boxes, projection, projGaps,
    formula, units, model, glossary, sourceText, externalRef, unknowns,
    px2dH, px2dN,
    dH2px: dH => (dH - interceptX) / slopeX,
    dN2px: dN => (dN - interceptY) / slopeY
  };
})();
