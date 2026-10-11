/* ============================================================
   DOSY 交互教学页 — 数据与逻辑
   所有观测数值来自对原图的像素标定（见 analysis/extract_final.py）
   ============================================================ */
'use strict';

/* ---------------- 观测数据（原图量出，估读） ---------------- */
const OBS = {
  calibration: {
    X_5_0: 651.5, X_0_0: 984.7, Y_0: 398.5, Y_20: 603.7,
    px_per_ppm: 66.64, px_per_D: 10.26,
    plot_box: [653, 399, 1014, 604]
  },
  points: {
    black: [{ ppm: 4.77, D: 15.89, area: 26 }],
    red:   [{ ppm: 2.22, D: 8.66,  area: 44 }],
    green: [{ ppm: 4.03, D: 6.40, area: 30 },
            { ppm: 3.50, D: 6.52, area: 27 },
            { ppm: 3.19, D: 6.66, area: 23 }],
    blue:  [{ ppm: 2.91, D: 4.48, area: 30 },
            { ppm: 1.78, D: 4.42, area: 47 },
            { ppm: 0.66, D: 4.50, area: 34 },
            { ppm: 0.16, D: 4.40, area: 9  },
            { ppm: 0.05, D: 4.60, area: 26 },
            { ppm: -0.07, D: 4.63, area: 6 }]
  },
  /* 顶部一维谱：按原图可见峰位与相对高度重绘（示意，非原始数据） */
  spectrum: {
    note: '依据原图可见峰位与相对高度重绘，示意性曲线，非原始数据',
    peaks: [[4.89, 26], [4.77, 73], [3.19, 19], [2.23, 17], [0.06, 34]]
  }
};

/* ---------------- 化合物定义 ---------------- */
const COMPOUNDS = {
  blue: {
    cn: 'TSP（参照物）', en: 'TSP · sodium 3-(trimethylsilyl)propionate-2,2,3,3-d4',
    origEn: 'TSP (ref solvent) - Blue',
    color: '#5b8cff', shape: 'diamond', shapeCn: '菱形 ◆', order: 4,
    formulaHtml: 'C<sub>6</sub>H<sub>9</sub>D<sub>4</sub>NaO<sub>2</sub>Si',
    mw: '≈172.27', mwNum: 172.27,
    species: '(CH₃)₃Si–CD₂–CD₂–COO⁻（阴离子）', speciesMw: 149.28,
    nH: 1, nHtxt: '1 种（三甲基硅基 9 个等价氢）',
    basis: '原图标注蓝色为 TSP 参照物；三甲基硅基在 δ<sub>H</sub> ≈ 0 ppm 出单峰，用作化学位移零点。',
    conf: '高（≈0 ppm 参照峰）/ <b>待确认</b>（≈2.91、1.78 ppm）',
    readout: 'TSP 是内标：其三甲基硅基的 9 个等价氢被规定在 0.00 ppm，是整张图横轴的"原点"。它在四个对象中 <i>D</i> 最小、在图上也最靠上——分子最大、跑得最慢。',
    warn: '原图所画为 TSP-<i>d</i><sub>4</sub>（丙酸链上两个碳被氘代），理论上 <sup>1</sup>H 只剩三甲基硅基一组，预期只在 ≈0 ppm 出现一个信号。但实测蓝点分布在 ≈2.91、1.78、0.66、0.05 ppm 等多处，其中 ≈2.91 与 ≈1.78 ppm 两点<b>无法从原材料确认归属</b>。'
  },
  green: {
    cn: '胆碱', en: 'Choline chloride · [(CH₃)₃N⁺–CH₂–CH₂–OH]·Cl⁻',
    origEn: 'Choline - green',
    color: '#4ad07c', shape: 'circle', shapeCn: '圆形 ●', order: 3,
    formulaHtml: 'C<sub>5</sub>H<sub>14</sub>ClNO',
    mw: '139.62', mwNum: 139.62,
    species: '胆碱阳离子 (CH₃)₃N⁺–CH₂–CH₂–OH', speciesMw: 104.17,
    nH: 3, nHtxt: '3 种（N(CH₃)₃ / N–CH₂ / HO–CH₂）',
    basis: '季铵阳离子有三种不等价氢：3.19（N(CH₃)₃）、3.50（N–CH₂）、4.03 ppm（HO–CH₂），与图上 3 个绿点一一对应。',
    conf: '高（与结构式氢数目吻合）',
    readout: '胆碱是季铵盐，在水溶液中以带正电的阳离子形式扩散。它有 <b>3 种</b>不等价氢，所以横坐标上有 3 个绿点；三点纵坐标几乎相同，说明它们确实属于同一个分子。',
    warn: '末端 –OH 上的氢与溶剂交换很快，其峰可能变宽甚至消失，因此绿点位置在不同 pH / 温度下会略有漂移。原图未给出 pH 与温度。'
  },
  red: {
    cn: '丙酮', en: 'Acetone · (CH₃)₂C=O',
    origEn: 'Acetone - red',
    color: '#ff5f5f', shape: 'triangle', shapeCn: '三角 ▲', order: 2,
    formulaHtml: 'C<sub>3</sub>H<sub>6</sub>O',
    mw: '58.08', mwNum: 58.08,
    species: '(CH₃)₂C=O（中性分子）', speciesMw: 58.08,
    nH: 1, nHtxt: '1 种（两个甲基共 6 个等价氢）',
    basis: '两个甲基等价 → 只有一种氢，在 ≈2.2 ppm 出单峰，对应图上唯一的红点。',
    conf: '高（与结构式氢数目吻合）',
    readout: '丙酮两个甲基上的 6 个氢完全等价，因此只有<b>一个</b>信号，图上只有 1 个红点。它是四者中第二小的分子，<i>D</i> 也第二大。',
    warn: '原图上红点看起来是<b>两个紧邻的小点</b>（主点在 ≈2.16 ppm、副点在 ≈2.23 ppm，<i>D</i> 分别约 8.6 与 9.0），可能是同一个信号在扩散维上的展宽或两点重合。原图未说明原因，此处标为"估读"。'
  },
  black: {
    cn: '水', en: 'Water · H₂O',
    origEn: 'Water – black',
    color: '#eef3f9', shape: 'square', shapeCn: '方形 ■', order: 1,
    formulaHtml: 'H<sub>2</sub>O',
    mw: '18.02', mwNum: 18.02,
    species: 'H₂O / HDO（中性分子）', speciesMw: 18.02,
    nH: 1, nHtxt: '1 种（两个氢等价）',
    basis: '水的两个氢等价，只给一个信号，位于 ≈4.77 ppm（黑点），是四个对象中 <i>D</i> 最大者。',
    conf: '高（位置唯一、最易识别）',
    readout: '水是四者中最小的分子，扩散最快，<i>D</i> ≈ 15.9 最大，因此落在图上最<b>靠下</b>的位置（因为纵轴向下递增）。',
    warn: '若样品为 D₂O 溶剂，此处实际主要是残余 HDO 的信号；其化学位移随温度变化（约 −0.01 ppm/K）。原图未说明溶剂。'
  }
};
const ORDER = ['black', 'red', 'green', 'blue'];  // 按 D 由大到小（分子由小到大）

/* ---------------- 术语 ---------------- */
const TERMS = {
  dosy:        ['DOSY（扩散排序谱）', 'Diffusion-Ordered SpectroscopY', '一种二维核磁方法。它在常规 ¹H 化学位移之外，再增加一个"扩散系数"维度，按分子大小把混合物中的信号分开——即使一维谱上峰重叠，也能区分不同大小的分子。'],
  diffusion:   ['扩散系数 D', 'Diffusion coefficient', '描述分子在溶液中随机（布朗）运动快慢的物理量，单位 m²·s⁻¹。分子越大、介质越黏，D 越小。DOSY 的纵轴就是它。'],
  chem_shift:  ['化学位移 δH', 'Chemical shift', '原子核在磁场中的共振频率相对于标准参照物的偏移，单位 ppm。它反映氢所处的化学环境（邻近官能团、电子密度）。'],
  ppm:         ['ppm（百万分之一）', 'parts per million', '化学位移的常用单位，1 ppm = 百万分之一的相对频率偏移。它是无量纲量，与磁场强度无关，因此不同仪器上的数值可直接比较。'],
  stokes:      ['Stokes–Einstein 方程', 'Stokes–Einstein equation', 'D = kBT / (6πηr)。把扩散系数与温度 T、溶剂黏度 η、分子流体力学半径 r 联系起来，是"用扩散系数估计分子尺寸"的理论基础；前提是球体、稀溶液、无相互作用。'],
  rh:          ['流体力学半径 r', 'Hydrodynamic radius', '把分子近似成球体后，等效于其扩散行为的球半径。它包含溶剂化层，通常大于分子的范德华尺寸。'],
  tsp:         ['TSP（参照物/内标）', 'TSP · sodium 3-(trimethylsilyl)propionate', '3-(三甲基硅基)丙酸钠，水溶性核磁内标。其三甲基硅基的 9 个等价氢被规定在 δH = 0.00 ppm，用作化学位移零点。氘代版本（TSP-d4）可减少干扰信号。'],
  deuterated:  ['氘代', 'deuterated / deuteration', '用氘（D，氢-2）替换分子中的氢。氘在 ¹H 核磁中不产生信号，因此可"抹掉"不需要的氢信号，或配制不含 ¹H 的溶剂。'],
  projection:  ['投影', 'projection', '把二维谱沿某一维度加和，得到一维谱。DOSY 图上方的一维 ¹H 谱理论上应是其沿扩散维的投影；但本原图中两者并不完全对应。'],
  chem_env:    ['化学环境', 'chemical environment', '一个氢原子周围的电子结构与邻近官能团。环境不同 → 化学位移不同。分子中"等价"的氢（如三个甲基上的 9 个氢）只给一个信号。'],
  quaternary:  ['季铵盐', 'quaternary ammonium salt', '氮原子与四个碳相连、带正电荷的化合物（R₄N⁺），需配一个阴离子（如 Cl⁻）保持电中性。胆碱就是季铵盐。'],
  carbonyl:    ['羰基', 'carbonyl group', 'C=O 官能团。丙酮与 TSP 的羧酸根都含羰基。羰基碳上不连氢，因此在 ¹H 谱上不出峰。'],
  tms:         ['三甲基硅基', 'trimethylsilyl (TMS)', '–Si(CH₃)₃ 基团。三个甲基等价，9 个氢在 ≈0 ppm 给一个单峰，是核磁中经典的化学位移参照。'],
  pfgnmr:      ['脉冲梯度场', 'pulsed field gradient (PFG)', 'DOSY 的实现手段：在脉冲序列中施加强度可变的磁场梯度，使信号强度随扩散快慢而衰减，再经反演得到 D。'],
  nmr2d:       ['二维核磁', '2D NMR', '由两个参数轴构成的核磁实验（如 COSY、HSQC）。DOSY 的第二个轴是扩散系数而非另一个频率轴，因此常被称为"伪二维"。'],
  hydroxyl:    ['羟基', 'hydroxyl group, –OH', '–O–H 官能团。胆碱末端 –OH 上的氢与溶剂交换很快，其化学位移会随 pH、温度变化，峰可能变宽。'],
  internal_std:['内标', 'internal standard', '直接加入样品中的已知物质，用于标定化学位移零点或作定量参照。TSP 在本样品中充当此角色。'],
  viscosity:   ['黏度 η', 'viscosity', '流体内部摩擦的度量，单位 Pa·s（常用 mPa·s）。黏度越大，分子扩散越慢（D ∝ 1/η）。'],
  lorentzian:  ['洛伦兹线型', 'Lorentzian lineshape', '核磁共振峰常见的理想线型，由弛豫过程决定。本页重绘一维谱时用它作示意。'],
  eq_proton:   ['等价氢', 'equivalent protons', '分子中通过对称操作可互换、化学环境完全相同的氢。它们给出同一个信号，强度按个数叠加。']
};

/* ---------------- 术语表（完整） ---------------- */
const GLOSSARY = [
  ['DOSY 扩散排序谱', 'Diffusion-Ordered SpectroscopY', '以扩散系数为第二维的核磁方法，用于按分子大小分离混合物中的信号。'],
  ['扩散系数 D', 'Diffusion coefficient', '分子布朗运动快慢的度量，单位 m²·s⁻¹。本页纵轴单位为其 10⁻¹⁰ 倍。'],
  ['化学位移 δH', 'Chemical shift', '氢核共振位置相对参照物的偏移，单位 ppm，反映化学环境。'],
  ['ppm', 'parts per million', '百万分之一，化学位移的无量纲单位，与磁场强度无关。'],
  ['Stokes–Einstein 方程', 'Stokes–Einstein equation', 'D = kBT/(6πηr)，联系扩散系数、温度、黏度与流体力学半径。'],
  ['流体力学半径 r', 'Hydrodynamic radius', '把分子视为等效球时的半径，含溶剂化层，通常大于范德华尺寸。'],
  ['TSP', 'sodium 3-(trimethylsilyl)propionate', '水溶性核磁内标，三甲基硅基信号定在 δH = 0.00 ppm。'],
  ['内标 / 参照物', 'internal standard / reference', '加入样品中用于标定化学位移或定量的已知物质。'],
  ['氘代', 'deuteration', '用氘（²H）替换氢，使该位置在 ¹H 谱中不出信号。'],
  ['三甲基硅基', 'trimethylsilyl (TMS)', '–Si(CH₃)₃，9 个等价氢在 ≈0 ppm 出单峰，是经典参照。'],
  ['季铵盐', 'quaternary ammonium salt', 'R₄N⁺ 型带正电的氮化合物，需配阴离子，如胆碱氯化物。'],
  ['羰基', 'carbonyl group', 'C=O 官能团，其碳上不连氢，故 ¹H 谱不出峰。'],
  ['羟基', 'hydroxyl group, –OH', 'O–H 官能团，其氢易与溶剂交换，峰位随 pH/温度变化。'],
  ['等价氢', 'equivalent protons', '通过对称性可互换、化学环境相同的氢，共用一个信号。'],
  ['化学环境', 'chemical environment', '氢原子周围的电子结构与邻近官能团，决定其化学位移。'],
  ['脉冲梯度场', 'pulsed field gradient (PFG)', 'DOSY 中施加的强度可变磁场梯度，使信号按扩散快慢衰减。'],
  ['二维核磁', '2D NMR', '由两个参数轴构成的核磁实验；DOSY 的第二个轴是扩散系数。'],
  ['投影', 'projection', '把二维数据沿一个维度加和得到的一维谱。'],
  ['黏度 η', 'viscosity', '流体内部摩擦度量，单位 Pa·s 或 mPa·s；D ∝ 1/η。'],
  ['洛伦兹线型', 'Lorentzian lineshape', '核磁峰的理想线型，本页重绘一维谱时用作示意。'],
  ['化学位移试剂', 'chemical shift reference', '规定 δH = 0 位置的物质，本图为 TSP。'],
  ['横轴 / 纵轴', 'abscissa / ordinate', '本图横轴为 δH、纵轴为 D；注意纵轴数值向下递增。'],
  ['估读值', 'estimated reading', '由像素标定从图上量出的数值，非仪器导出的原始数据。'],
  ['相对分子质量', 'relative molecular mass', '按化学式计算的质量（无量纲），本页按标准原子量算出。']
];

/* ---------------- 原图英文 → 中文 ---------------- */
const EN_MAP = [
  ['DOSY', '扩散排序谱', 'Diffusion-Ordered SpectroscopY 的缩写，本幻灯片标题。'],
  ['Here there are four compounds', '这里共有四种化合物', '原图要点第一行。'],
  ['TSP (ref solvent) - Blue', 'TSP（参照溶剂/内标）—— 蓝色', '原图要点第二行。"ref" = reference，参照物。'],
  ['Choline - green', '胆碱 —— 绿色', '原图要点第三行。'],
  ['Acetone - red', '丙酮 —— 红色', '原图要点第四行。'],
  ['Water – black', '水 —— 黑色', '原图要点第五行。'],
  ['The bigger the compound the higher on the scale', '分子越大，在标尺上位置越高', '原图要点第六行。注意本图纵轴向下递增，故"位置越高"= D 越小 = 分子越大。'],
  ['D / 10⁻¹⁰ m² s⁻¹', '扩散系数 D，单位 10⁻¹⁰ 平方米每秒', '原图纵轴标题。'],
  ['δH / ppm', '氢化学位移 δH，单位 ppm', '原图横轴标题。δ 读作 delta。'],
  ['Cl⁻', '氯离子', '胆碱的平衡阴离子。'],
  ['Na⁺', '钠离子', 'TSP 的平衡阳离子。'],
  ['OH', '羟基', '胆碱末端的 –O–H。'],
  ['CH₃ / H₃C', '甲基', '一个碳连三个氢。'],
  ['D', '氘（氢-2）', '氢的同位素，¹H 谱中不出信号。'],
  ['O', '氧原子', '此处指羰基氧。'],
  ['Si', '硅原子', '三甲基硅基的中心原子。'],
  ['N⁺', '带正电的氮', '季铵氮，与四个碳成键。'],
  ['O⁻', '带负电的氧', '羧酸根的负电荷中心。']
];

/* ---------------- 结构式（示意重绘，仅画原子与连接键） ---------------- */
const STRUCTS = {
  blue: `<svg viewBox="0 0 340 176" role="img" aria-label="TSP 示意结构：三甲基硅基经两个氘代亚甲基连到羧酸根，并配钠离子">
    <!-- Si 上的三个甲基 -->
    <line class="bond" x1="62" y1="88"  x2="44" y2="68"  stroke="#5b8cff"/>
    <line class="bond" x1="62" y1="104" x2="44" y2="128" stroke="#5b8cff"/>
    <line class="bond" x1="74" y1="110" x2="74" y2="134" stroke="#5b8cff"/>
    <text class="atom" x="26" y="56"  fill="#5b8cff" text-anchor="middle">H₃C</text>
    <text class="atom" x="26" y="140" fill="#5b8cff" text-anchor="middle">H₃C</text>
    <text class="atom" x="74" y="148" fill="#5b8cff" text-anchor="middle">CH₃</text>
    <text class="atom" x="74" y="100" fill="#5b8cff" text-anchor="middle">Si</text>
    <!-- Si—C1 -->
    <line class="bond" x1="84" y1="90" x2="110" y2="74" stroke="#5b8cff"/>
    <!-- C1 上的两个 D -->
    <line class="bond" x1="118" y1="60" x2="118" y2="46" stroke="#5b8cff"/>
    <line class="bond" x1="110" y1="64" x2="98"  y2="52" stroke="#5b8cff"/>
    <text class="atom" x="118" y="36" fill="#5b8cff" text-anchor="middle">D</text>
    <text class="atom" x="90"  y="44" fill="#5b8cff" text-anchor="middle">D</text>
    <!-- C1—C2 -->
    <line class="bond" x1="126" y1="74" x2="146" y2="88" stroke="#5b8cff"/>
    <!-- C2 上的两个 D -->
    <line class="bond" x1="146" y1="100" x2="136" y2="116" stroke="#5b8cff"/>
    <line class="bond" x1="162" y1="100" x2="172" y2="116" stroke="#5b8cff"/>
    <text class="atom" x="130" y="128" fill="#5b8cff" text-anchor="middle">D</text>
    <text class="atom" x="180" y="128" fill="#5b8cff" text-anchor="middle">D</text>
    <!-- C2—C3 -->
    <line class="bond" x1="162" y1="90" x2="182" y2="74" stroke="#5b8cff"/>
    <!-- 羰基双键 -->
    <line class="bond" x1="186" y1="56" x2="186" y2="38" stroke="#5b8cff"/>
    <line class="bond" x1="194" y1="56" x2="194" y2="38" stroke="#5b8cff"/>
    <text class="atom" x="190" y="28" fill="#5b8cff" text-anchor="middle">O</text>
    <!-- 羧酸根 O⁻ 与 Na⁺ -->
    <line class="bond" x1="196" y1="72" x2="220" y2="88" stroke="#5b8cff"/>
    <text class="atom" x="238" y="96" fill="#5b8cff" text-anchor="middle">O⁻</text>
    <text class="atom" x="292" y="52" fill="#5b8cff" text-anchor="middle">Na⁺</text>
  </svg>`,
  green: `<svg viewBox="0 0 268 164" role="img" aria-label="胆碱示意结构：季铵氮连三个甲基和一条羟乙基链，并配氯离子">
    <line class="bond" x1="86" y1="62" x2="86" y2="40" stroke="#4ad07c"/>
    <line class="bond" x1="74" y1="72" x2="48" y2="54" stroke="#4ad07c"/>
    <line class="bond" x1="78" y1="88" x2="56" y2="116" stroke="#4ad07c"/>
    <text class="atom" x="86" y="32" fill="#4ad07c" text-anchor="middle">CH₃</text>
    <text class="atom" x="28" y="50" fill="#4ad07c" text-anchor="middle">H₃C</text>
    <text class="atom" x="40" y="132" fill="#4ad07c" text-anchor="middle">H₃C</text>
    <text class="atom" x="86" y="78" fill="#4ad07c" text-anchor="middle">N⁺</text>
    <text class="atom" x="152" y="46" fill="#4ad07c" text-anchor="middle">Cl⁻</text>
    <line class="bond" x1="98" y1="84" x2="126" y2="102" stroke="#4ad07c"/>
    <line class="bond" x1="126" y1="102" x2="154" y2="78" stroke="#4ad07c"/>
    <line class="bond" x1="154" y1="78" x2="182" y2="102" stroke="#4ad07c"/>
    <text class="atom" x="198" y="108" fill="#4ad07c" text-anchor="middle">OH</text>
  </svg>`,
  red: `<svg viewBox="0 0 224 136" role="img" aria-label="丙酮示意结构：羰基碳连一个双键氧和两个甲基">
    <line class="bond" x1="105" y1="62" x2="105" y2="40" stroke="#ff5f5f"/>
    <line class="bond" x1="115" y1="62" x2="115" y2="40" stroke="#ff5f5f"/>
    <text class="atom" x="110" y="30" fill="#ff5f5f" text-anchor="middle">O</text>
    <line class="bond" x1="110" y1="74" x2="58"  y2="108" stroke="#ff5f5f"/>
    <line class="bond" x1="110" y1="74" x2="162" y2="108" stroke="#ff5f5f"/>
    <text class="atom" x="40"  y="122" fill="#ff5f5f" text-anchor="middle">CH₃</text>
    <text class="atom" x="180" y="122" fill="#ff5f5f" text-anchor="middle">CH₃</text>
  </svg>`,
  black: `<svg viewBox="0 0 224 104" role="img" aria-label="水示意结构：氧原子两侧各连一个氢">
    <line class="bond" x1="62" y1="54" x2="90" y2="54" stroke="#eef3f9"/>
    <line class="bond" x1="116" y1="54" x2="144" y2="54" stroke="#eef3f9"/>
    <text class="atom" x="103" y="54" fill="#eef3f9" text-anchor="middle" dominant-baseline="central">O</text>
    <text class="atom" x="48"  y="54" fill="#eef3f9" text-anchor="middle" dominant-baseline="central">H</text>
    <text class="atom" x="158" y="54" fill="#eef3f9" text-anchor="middle" dominant-baseline="central">H</text>
  </svg>`
};

/* ---------------- 物理常量与模型 ---------------- */
const KB = 1.380649e-23;      // J/K
const T_REF = 298.15;         // K   —— 假设值（演示模型）
const ETA_REF = 1.10;         // mPa·s —— 假设值（演示模型，D₂O @ 25 °C）

/* ---------------- 状态 ---------------- */
const state = {
  sel: 'all',
  T: T_REF,
  eta: ETA_REF,
  r: 0.30,
  showModel: true,
  showSpec: true,
  lensRegion: 'full',
  lensZoom: 1
};

/* ---------------- 工具 ---------------- */
const $  = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const fmt = (v, n) => Number(v).toFixed(n === undefined ? 2 : n);

function modelScale(T, eta) { return (T / T_REF) * (ETA_REF / eta); }

/** Stokes–Einstein 预测的 D（单位 1e-10 m²·s⁻¹） */
function dPredict(T, eta, rNm) {
  return KB * T / (6 * Math.PI * (eta * 1e-3) * (rNm * 1e-9)) * 1e10;
}
/** 由 D 反解流体力学半径（nm） */
function radiusFromD(T, eta, Dunit) {
  return KB * T / (6 * Math.PI * (eta * 1e-3) * (Dunit * 1e-10)) * 1e9;
}

/* ---------------- 绘图几何（桌面 / 窄屏两套布局） ---------------- */
const DOM = { x0: 5.0, x1: -0.5, y0: 0, y1: 20 };
let LAY = null;
function makeLayout() {
  const wrap = document.querySelector('.plot-wrap');
  const w = wrap ? (wrap.clientWidth || 0) : 700;
  const narrow = w > 0 && w < 540;
  LAY = narrow
    ? { narrow: true,  w: 430, h: 396, L: 58, T: 56, R: 416, B: 302,
        specBase: 50, specMax: 26, fs: 13, fsAx: 14, fsNote: 12, fsTag: 11.5,
        mk: 8.6, hit: 15, xLabDy: 19, xTitleDy: 38, yLabDx: 7, labelStep: 1.0 }
    : { narrow: false, w: 700, h: 430, L: 76, T: 64, R: 668, B: 366,
        specBase: 58, specMax: 32, fs: 11, fsAx: 12, fsNote: 10.5, fsTag: 10.5,
        mk: 6.4, hit: 11, xLabDy: 19, xTitleDy: 40, yLabDx: 9, labelStep: 0.5 };
  return LAY;
}
const X = ppm => LAY.L + (DOM.x0 - ppm) / (DOM.x0 - DOM.x1) * (LAY.R - LAY.L);
const Y = D   => LAY.T + (D - DOM.y0) / (DOM.y1 - DOM.y0) * (LAY.B - LAY.T);

function marker(cx, cy, c, shape, r, opts) {
  opts = opts || {};
  const fill = opts.fill || 'none';
  const op = opts.opacity === undefined ? 1 : opts.opacity;
  const cls = opts.cls || '';
  const sw = opts.sw || 1.8;
  const st = `fill="${fill}" stroke="${c}" stroke-width="${sw}" opacity="${op}"`;
  let g;
  if (shape === 'circle') {
    g = `<circle cx="${fmt(cx,1)}" cy="${fmt(cy,1)}" r="${r}" ${st}/>`;
  } else if (shape === 'square') {
    g = `<rect x="${fmt(cx - r,1)}" y="${fmt(cy - r,1)}" width="${2*r}" height="${2*r}" rx="1" ${st}/>`;
  } else if (shape === 'triangle') {
    g = `<polygon points="${fmt(cx,1)},${fmt(cy-r*1.15,1)} ${fmt(cx+r*1.15,1)},${fmt(cy+r*0.85,1)} ${fmt(cx-r*1.15,1)},${fmt(cy+r*0.85,1)}" ${st}/>`;
  } else {
    g = `<polygon points="${fmt(cx,1)},${fmt(cy-r*1.2,1)} ${fmt(cx+r*1.2,1)},${fmt(cy,1)} ${fmt(cx,1)},${fmt(cy+r*1.2,1)} ${fmt(cx-r*1.2,1)},${fmt(cy,1)}" ${st}/>`;
  }
  return cls ? `<g class="${cls}">${g}</g>` : g;
}

/* ---------------- 一维谱（示意重绘） ---------------- */
function spectrumPath() {
  const BASE = LAY.specBase, MAXH = LAY.specMax, w = 0.018;
  const pk = OBS.spectrum.peaks, hmax = Math.max.apply(null, pk.map(p => p[1]));
  const N = 900, pts = [];
  for (let i = 0; i <= N; i++) {
    const ppm = DOM.x0 + (DOM.x1 - DOM.x0) * i / N;
    let I = 0;
    for (let k = 0; k < pk.length; k++) {
      const d = ppm - pk[k][0];
      I += pk[k][1] * (w * w) / (w * w + d * d);
    }
    const y = BASE - (I / hmax) * MAXH;
    pts.push(fmt(X(ppm), 1) + ',' + fmt(y, 1));
  }
  return pts.join(' ');
}

/* ---------------- 渲染：主图 ---------------- */
function renderPlot() {
  const svgEl = $('#plot');
  makeLayout();
  svgEl.setAttribute('viewBox', `0 0 ${LAY.w} ${LAY.h}`);
  const BOX = { L: LAY.L, T: LAY.T, R: LAY.R, B: LAY.B };
  const s = [];
  const sel = state.sel;
  const scale = modelScale(state.T, state.eta);
  const FS = `font-size:${LAY.fs}px`;
  const XT = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0];

  /* 网格 */
  for (let d = 0; d <= 20; d += 4) {
    s.push(`<line class="svg-grid" x1="${BOX.L}" y1="${fmt(Y(d),1)}" x2="${BOX.R}" y2="${fmt(Y(d),1)}"/>`);
  }
  XT.forEach(p => {
    s.push(`<line class="svg-grid" x1="${fmt(X(p),1)}" y1="${BOX.T}" x2="${fmt(X(p),1)}" y2="${BOX.B}"/>`);
  });

  /* 外框 */
  s.push(`<rect class="svg-axis" x="${BOX.L}" y="${BOX.T}" width="${BOX.R-BOX.L}" height="${BOX.B-BOX.T}"/>`);

  /* 刻度与标签 */
  XT.forEach(p => {
    const x = fmt(X(p), 1);
    s.push(`<line class="svg-tick" x1="${x}" y1="${BOX.B}" x2="${x}" y2="${BOX.B+5}"/>`);
    if (Math.abs(p / LAY.labelStep - Math.round(p / LAY.labelStep)) < 1e-9) {
      s.push(`<text class="svg-lbl" style="${FS}" x="${x}" y="${BOX.B+LAY.xLabDy}" text-anchor="middle">${p.toFixed(1)}</text>`);
    }
  });
  for (let d = 0; d <= 20; d += 4) {
    const y = fmt(Y(d), 1);
    s.push(`<line class="svg-tick" x1="${BOX.L-5}" y1="${y}" x2="${BOX.L}" y2="${y}"/>`);
    s.push(`<text class="svg-lbl" style="${FS}" x="${BOX.L-LAY.yLabDx}" y="${y}" text-anchor="end" dominant-baseline="central">${d}</text>`);
  }
  s.push(`<text class="svg-lbl ax" style="font-size:${LAY.fsAx}px" x="${(BOX.L+BOX.R)/2}" y="${BOX.B+LAY.xTitleDy}" text-anchor="middle">δ_H / ppm</text>`);
  s.push(`<text class="svg-lbl ax" style="font-size:${LAY.fsAx}px" transform="translate(${LAY.narrow ? 14 : 20},${(BOX.T+BOX.B)/2}) rotate(-90)" text-anchor="middle">D / 10⁻¹⁰ m²·s⁻¹</text>`);

  /* 一维谱条带 */
  if (state.showSpec) {
    s.push(`<polyline points="${spectrumPath()}" fill="none" stroke="#7b8899" stroke-width="${LAY.narrow ? 1.3 : 1.1}"/>`);
    s.push(`<line x1="${BOX.L}" y1="${LAY.specBase}" x2="${BOX.R}" y2="${LAY.specBase}" stroke="#303a47" stroke-width="1"/>`);
    s.push(`<text class="svg-lbl" x="${BOX.L}" y="${LAY.narrow ? 13 : 15}" text-anchor="start" style="font-size:${LAY.fsTag}px">1D ¹H 谱（示意重绘，非原始数据）</text>`);
  }

  /* 参照虚线（选中化合物的 D 均值） */
  if (sel !== 'all' && COMPOUNDS[sel]) {
    const dmean = mean(OBS.points[sel].map(p => p.D)) * scale;
    s.push(`<line class="svg-guide" x1="${BOX.L}" y1="${fmt(Y(dmean),1)}" x2="${BOX.R}" y2="${fmt(Y(dmean),1)}"/>`);
    s.push(`<text class="svg-lbl" style="font-size:${LAY.fsTag}px" x="${BOX.L+6}" y="${fmt(Y(dmean)-6,1)}" text-anchor="start" fill="#5fd0a8">${COMPOUNDS[sel].cn}　D̄ = ${fmt(dmean)}</text>`);
  }

  /* 演示模型预测线 */
  if (state.showModel) {
    const dp = dPredict(state.T, state.eta, state.r);
    if (dp >= 0 && dp <= 20) {
      s.push(`<line class="svg-model-line" x1="${BOX.L}" y1="${fmt(Y(dp),1)}" x2="${BOX.R}" y2="${fmt(Y(dp),1)}"/>`);
      s.push(`<polygon class="star" points="${starPts(BOX.R-12, Y(dp), LAY.narrow ? 8 : 7)}"/>`);
      s.push(`<text class="svg-lbl" style="font-size:${LAY.fsTag}px" x="${BOX.R-6}" y="${BOX.T+14}" text-anchor="end" fill="#5fd0a8">演示模型 r = ${fmt(state.r)} nm → D ≈ ${fmt(dp)}</text>`);
    } else {
      s.push(`<text class="svg-lbl" x="${BOX.L+6}" y="${BOX.T+14}" fill="#5fd0a8" style="font-size:${LAY.fsTag}px">演示模型预测 D ≈ ${fmt(dp)}（超出纵轴 0–20 范围）</text>`);
    }
  }

  /* 数据点 */
  ORDER.forEach(cid => {
    const cp = COMPOUNDS[cid];
    const isDim = (sel !== 'all' && sel !== cid);
    const g = [];
    OBS.points[cid].forEach((p, i) => {
      const cx = X(p.ppm), cy = Y(p.D);
      /* 演示模型点（实心，较小） */
      if (state.showModel) {
        const dm = p.D * scale;
        g.push(marker(X(p.ppm), Y(dm), cp.color, cp.shape, LAY.mk * 0.66,
          { fill: cp.color, opacity: isDim ? 0.18 : 0.55, cls: '' }));
      }
      /* 原图观测点（空心） */
      g.push(`<g class="pt${sel === cid ? ' sel' : ''}" data-c="${cid}" data-i="${i}" tabindex="0" role="button"
        aria-label="${cp.cn}，第 ${i+1} 个点，化学位移 ${p.ppm} ppm，扩散系数 ${p.D}">
        <title>${cp.cn} · 第 ${i+1} 点 · δH = ${p.ppm} ppm · D = ${p.D} ×10⁻¹⁰ m²·s⁻¹</title>
        <circle class="hit" cx="${fmt(cx,1)}" cy="${fmt(cy,1)}" r="${LAY.hit}"/>${marker(cx, cy, cp.color, cp.shape, LAY.mk, { cls: 'mk' })}
        </g>`);
    });
    s.push(`<g${isDim ? ' class="dim"' : ''}>${g.join('')}</g>`);
  });

  svgEl.innerHTML = s.join('');

  /* 提示与图例 */
  const scaleTxt = `演示模型缩放因子 = (T/298.15) × (1.10/η) = <b>${fmt(scale, 3)}</b>`;
  $('#plotHint').innerHTML =
    `<b>图例：</b>空心<span style="color:#e6edf3">■</span>水 · ` +
    `<span style="color:#ff5f5f">▲</span>丙酮 · <span style="color:#4ad07c">●</span>胆碱 · ` +
    `<span style="color:#5b8cff">◆</span>TSP（形状 + 颜色双重编码，便于色觉障碍读者）；` +
    `实心小点为<span class="tag model">演示模型</span>位置。当前 ${scaleTxt}。` +
    (sel !== 'all' ? ` 虚线为选中化合物的 <i>D</i> 均值。` : '');
}

function starPts(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    p.push(fmt(cx + rr * Math.cos(a), 1) + ',' + fmt(cy + rr * Math.sin(a), 1));
  }
  return p.join(' ');
}

/* ---------------- 渲染：结构式卡片 ---------------- */
function renderStructs() {
  $('#structGrid').innerHTML = ORDER.slice().reverse().map(cid => {
    const c = COMPOUNDS[cid];
    return `<div class="struct-card" data-c="${cid}" data-active="${state.sel === cid ? 1 : 0}">
      <div class="cap"><span class="nm"><span class="cdot c-${cid}" style="color:${c.color}"></span>${c.cn}</span><span class="badge">示意</span></div>
      ${STRUCTS[cid]}
      <div class="note">${c.formulaHtml} · M ${c.mw}</div>
    </div>`;
  }).join('');
}

/* ---------------- 渲染：右栏读数 ---------------- */
function renderReadout() {
  const el = $('#readout');
  const scale = modelScale(state.T, state.eta);

  if (state.sel === 'all') {
    const rows = ORDER.map(cid => {
      const c = COMPOUNDS[cid];
      const ds = OBS.points[cid].map(p => p.D);
      return `<tr><td><span class="cdot" style="color:${c.color}"></span>${c.cn}</td>
        <td class="num">${OBS.points[cid].length}</td>
        <td class="num">${fmt(Math.min.apply(null, ds))} – ${fmt(Math.max.apply(null, ds))}</td></tr>`;
    }).join('');
    el.innerHTML = `
      <div class="readout-head"><span class="dot" style="color:var(--accent)"></span><span class="nm">四种化合物对比</span><span class="en">ALL</span></div>
      <dl class="kv">
        <dt>化合物</dt><dd class="plain">4 种</dd>
        <dt>测量点</dt><dd>11 个</dd>
        <dt>D 总范围</dt><dd>4.40 – 15.89</dd>
        <dt>单位</dt><dd>10⁻¹⁰ m²·s⁻¹</dd>
        <dt>模型因子</dt><dd>${fmt(scale, 3)}</dd>
      </dl>
      <div class="tbl-scroll" style="margin-top:6px">
        <table style="min-width:0"><thead><tr><th>对象</th><th>点数</th><th>D 范围</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="readout-note"><span class="h">如何读这张图</span>
        点左侧任一化合物，可高亮它在图上的点、定位对应结构式并显示详细读数。鼠标悬停或 Tab 聚焦图上的点，也能看到该点的数值。</div>`;
    return;
  }

  const c = COMPOUNDS[state.sel];
  const pts = OBS.points[state.sel];
  const ds = pts.map(p => p.D);
  const dmean = mean(ds);
  const rEst = radiusFromD(state.T, state.eta, dmean);
  el.innerHTML = `
    <div class="readout-head"><span class="dot" style="color:${c.color}"></span>
      <span class="nm">${c.cn}</span><span class="en">${state.sel.toUpperCase()}</span></div>
    <dl class="kv">
      <dt>原图标注</dt><dd class="plain">${c.origEn}</dd>
      <dt>颜色 / 形状</dt><dd class="plain" style="color:${c.color}">${c.shapeCn}</dd>
      <dt>点数</dt><dd>${pts.length} 个</dd>
      <dt>δ<sub>H</sub></dt><dd>${pts.map(p => p.ppm.toFixed(2)).join(' / ')} ppm</dd>
      <dt>D</dt><dd>${ds.map(d => d.toFixed(2)).join(' / ')}</dd>
      <dt>D 均值</dt><dd>${fmt(dmean)} ×10⁻¹⁰</dd>
      <dt>分子式</dt><dd class="plain">${c.formulaHtml}</dd>
      <dt>相对分子质量</dt><dd>${c.mw}</dd>
      <dt>扩散物种</dt><dd class="plain">${c.species}</dd>
      <dt>氢的种类</dt><dd class="plain">${c.nHtxt}</dd>
      <dt>归属依据</dt><dd class="plain">${c.basis}</dd>
      <dt>置信度</dt><dd class="plain">${c.conf}</dd>
    </dl>
    <div class="readout-note"><span class="h">当前解释</span>${c.readout}</div>
    <div class="readout-note" style="border-left:3px solid #ffd479;padding-left:9px;margin-left:-9px">
      <span class="h" style="color:#ffd479">注意 / 无法确认之处</span>${c.warn}</div>
    <div class="readout-note"><span class="h">演示模型换算</span>
      按当前 <i>T</i> = ${fmt(state.T,2)} K、<i>η</i> = ${fmt(state.eta,2)} mPa·s，
      由 <i>D̄</i> 反解流体力学半径 <i>r</i> ≈ <b>${fmt(rEst,3)} nm</b>。
      <span class="tag model">演示模型</span>（球体假设，<i>T</i>、<i>η</i> 为本页假设值，原图未给出）</div>`;
}

/* ---------------- 渲染：归属表 ---------------- */
function renderTable() {
  const tb = $('#assignTable tbody');
  const rows = [];
  ORDER.forEach(cid => {
    const c = COMPOUNDS[cid], pts = OBS.points[cid], n = pts.length;
    pts.forEach((p, i) => {
      rows.push('<tr data-c="' + cid + '" data-i="' + i + '" tabindex="0" role="button" aria-selected="false">' +
        (i === 0 ? `<td rowspan="${n}"><span class="cdot" style="color:${c.color}"></span>${c.cn}</td>
          <td rowspan="${n}" style="color:${c.color}">${c.shapeCn}<br><span class="hint">原图：${cid === 'black' ? '黑' : cid === 'red' ? '红' : cid === 'green' ? '绿' : '蓝'}</span></td>` : '') +
        `<td class="num">${p.ppm.toFixed(2)}</td>
         <td class="num">${p.D.toFixed(2)}</td>` +
        (i === 0 ? `<td rowspan="${n}" class="plain">${c.formulaHtml}</td>
          <td rowspan="${n}" class="num">${c.mw}</td>
          <td rowspan="${n}" class="plain">${c.species}<br><span class="hint">M ≈ ${c.speciesMw}</span></td>
          <td rowspan="${n}" class="plain">${c.basis}</td>
          <td rowspan="${n}" class="plain">${c.conf}</td>` : '') +
        '</tr>');
    });
  });
  tb.innerHTML = rows.join('');
}

/* ---------------- 渲染：不变量与单调性 ---------------- */
function renderChecks() {
  /* 不变量：同组内 D 极差 */
  const inv = $('#invTable tbody');
  const rows = [];
  ORDER.forEach(cid => {
    const c = COMPOUNDS[cid], ds = OBS.points[cid].map(p => p.D);
    const rng = Math.max.apply(null, ds) - Math.min.apply(null, ds);
    const px = rng * OBS.calibration.px_per_D;
    const ok = cid === 'red' || cid === 'black' ? true : (px < 4);
    rows.push(`<tr><td><span class="cdot" style="color:${c.color}"></span>${c.cn}</td>
      <td class="num">${ds.length}</td>
      <td class="num">${fmt(Math.min.apply(null, ds))}</td>
      <td class="num">${fmt(Math.max.apply(null, ds))}</td>
      <td class="num">${fmt(rng)}</td>
      <td class="num">${fmt(px,1)} px</td>
      <td class="plain">${ok ? '✔ 同一水平线（在估读误差内）' : '⚠ 存在偏离'}</td></tr>`);
  });
  inv.innerHTML = rows.join('');
  $('#invNote').innerHTML =
    `判据：纵轴 ${OBS.calibration.px_per_D} px 对应 1 个单位。蓝、绿两组点的极差都小于 4 px（约 0.4 个单位），` +
    `即"同一化合物的点落在同一水平线"这一<b>应保持不变的关系成立</b>，偏差在像素估读误差范围内。` +
    `红、黑各只有 1 个点，极差为 0。`;

  /* 单调性 */
  const mono = $('#monoTable tbody');
  const list = ORDER.map(cid => ({
    cid: cid, c: COMPOUNDS[cid],
    mw: COMPOUNDS[cid].speciesMw,
    D: mean(OBS.points[cid].map(p => p.D))
  }));
  const byMw = list.slice().sort((a, b) => a.mw - b.mw).map(o => o.cid);
  const byD  = list.slice().sort((a, b) => b.D - a.D).map(o => o.cid);
  const monoOk = byMw.join() === byD.join();
  mono.innerHTML = list.map(o => {
    return `<tr><td><span class="cdot" style="color:${o.c.color}"></span>${o.c.cn}</td>
      <td class="plain">${o.c.species.replace(/（.*?）/, '')}</td>
      <td class="num">${fmt(o.mw)}</td>
      <td class="num">${fmt(o.D)}</td>
      <td class="num">${byMw.indexOf(o.cid) + 1}（按质量）</td>
      <td class="plain">${byD.indexOf(o.cid) + 1}（按 D）</td></tr>`;
  }).join('') +
  `<tr><td colspan="6" class="plain"><b>结论：</b>质量顺序与 <i>D</i> 顺序完全相反——` +
  `${monoOk ? '✔ 单调反序成立' : '⚠ 不成立'}。这符合"分子越大扩散越慢"的预期，是数据自洽的关键证据。</td></tr>`;
}

/* ---------------- 渲染：实时验算框 ---------------- */
function renderCalc() {
  const scale = modelScale(state.T, state.eta);
  const dp = dPredict(state.T, state.eta, state.r);
  const rows = [
    ['k_B', '1.380649×10⁻²³ J·K⁻¹', '物理常量'],
    ['T（当前滑块）', fmt(state.T, 2) + ' K', '演示模型假设'],
    ['η（当前滑块）', fmt(state.eta, 2) + ' mPa·s', '演示模型假设'],
    ['r（当前滑块）', fmt(state.r, 2) + ' nm', '演示模型假设'],
    ['缩放因子 f', fmt(scale, 3), 'f = (T/298.15)×(1.10/η)'],
    ['预测 D = k_BT/(6πηr)', fmt(dp) + ' ×10⁻¹⁰ m²·s⁻¹', '演示模型'],
  ];
  ORDER.forEach(cid => {
    const c = COMPOUNDS[cid];
    const d0 = mean(OBS.points[cid].map(p => p.D));
    const rEst = radiusFromD(state.T, state.eta, d0);
    rows.push([c.cn + '：D̄(观测) → 模型 D̄ → r', fmt(d0) + ' → ' + fmt(d0 * scale) + ' → ' + fmt(rEst, 3) + ' nm', '演示模型']);
  });
  $('#calcOut').innerHTML = rows.map(r =>
    `<div class="row"><span class="k">${r[0]}<br><span class="hint" style="font-size:11px">${r[2]}</span></span><span>${r[1]}</span></div>`
  ).join('');
}

/* ---------------- 渲染：术语表 / 中英对照 ---------------- */
function renderGlossary() {
  $('#glossaryTable tbody').innerHTML = GLOSSARY.map(g =>
    `<tr><td>${g[0]}</td><td class="plain" style="color:var(--muted)">${g[1]}</td><td class="plain">${g[2]}</td></tr>`).join('');
  $('#enTable tbody').innerHTML = EN_MAP.map(g =>
    `<tr><td class="num">${g[0]}</td><td>${g[1]}</td><td class="plain">${g[2]}</td></tr>`).join('');
}

/* ---------------- 术语注释气泡 ---------------- */
let lastTerm = null;
function showPop(term, anchor) {
  const pop = $('#popover');
  const t = TERMS[term];
  if (!t) return;
  pop.innerHTML = `<span class="p-title">${t[0]}</span><span class="p-en">${t[1]}</span>${t[2]}`;
  pop.classList.add('on');
  const r = anchor.getBoundingClientRect();
  const sc = window.scrollX || window.pageXOffset;
  const sy = window.scrollY || window.pageYOffset;
  pop.style.left = '0px'; pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left + sc + r.width / 2 - pw / 2;
  left = Math.max(8 + sc, Math.min(left, sc + document.documentElement.clientWidth - pw - 8));
  let top = r.bottom + sy + 8;
  if (r.bottom + ph + 24 > document.documentElement.clientHeight) top = r.top + sy - ph - 8;
  pop.style.left = left + 'px';
  pop.style.top = Math.max(8 + sy, top) + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  lastTerm = anchor;
}
function hidePop() {
  $('#popover').classList.remove('on');
  if (lastTerm) lastTerm.setAttribute('aria-expanded', 'false');
  lastTerm = null;
}

/* ---------------- 放大镜 ---------------- */
const REGIONS = {
  full:  { box: [0, 0, 1038, 782],            cn: '整幅' },
  plot:  { box: [620, 300, 1035, 670],        cn: 'DOSY 绘图区' },
  xaxis: { box: [640, 590, 1010, 660],        cn: '横轴刻度' },
  yaxis: { box: [600, 340, 700, 640],         cn: '纵轴刻度' },
  struct:{ box: [600, 55, 1035, 320],         cn: '结构式' },
  title: { box: [30, 100, 530, 540],          cn: '标题与要点' }
};
function updateLens() {
  const el = $('#lens'), img = $('#origImg');
  if (!el || !img) return;
  const W = 1038, H = 782;
  const reg = REGIONS[state.lensRegion] || REGIONS.full;
  const b = reg.box;
  const cw = el.clientWidth || 600;
  const chh = el.clientHeight || 340;
  el.style.backgroundImage = 'url("' + img.src + '")';

  let s, how;
  if (state.lensRegion === 'full') {
    /* 整幅：等比缩放，保证整张图都看得见并居中 */
    s = Math.min(cw / W, chh / H) * state.lensZoom;
    el.style.backgroundSize = (W * s) + 'px ' + (H * s) + 'px';
    el.style.backgroundPosition = 'center center';
    how = '整幅等比缩放并居中';
  } else {
    /* 区域：按区域宽度贴合，再按倍率放大 */
    s = (cw / (b[2] - b[0])) * state.lensZoom;
    el.style.backgroundSize = (W * s) + 'px ' + (H * s) + 'px';
    el.style.backgroundPosition = (-b[0] * s) + 'px ' + (-b[1] * s) + 'px';
    how = `区域像素 x[${b[0]}–${b[2]}] y[${b[1]}–${b[3]}]（${b[2] - b[0]}×${b[3] - b[1]} px）`;
  }
  $('#lensMeta').textContent =
    `${reg.cn}　${how}　显示比例 ${fmt(s, 2)}×（1 个原图像素 = ${fmt(s, 2)} 个屏幕像素）　原图 ${W}×${H} px，未作修改`;
}

/* ---------------- 交互绑定 ---------------- */
function setSel(cid) {
  state.sel = cid;
  $$('#objList .obj-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === cid)));
  $$('#structGrid .struct-card').forEach(c => c.setAttribute('data-active', c.dataset.c === cid ? '1' : '0'));
  $$('#assignTable tbody tr').forEach(r => r.setAttribute('aria-selected', String(r.dataset.c === cid)));
  renderPlot(); renderReadout();
}

function bind() {
  /* 对象按钮 */
  $('#objList').addEventListener('click', e => {
    const b = e.target.closest('.obj-btn');
    if (b) setSel(b.dataset.c);
  });
  /* 结构卡片点击 */
  $('#structGrid').addEventListener('click', e => {
    const c = e.target.closest('.struct-card');
    if (c) setSel(c.dataset.c);
  });
  /* 图上点点击 / 键盘 */
  $('#plot').addEventListener('click', e => {
    const p = e.target.closest('.pt');
    if (p) setSel(p.dataset.c);
  });
  /* 指向 / 聚焦某一点 → 显示该点读数 */
  function ptRead(el) {
    const cid = el.dataset.c, i = parseInt(el.dataset.i, 10);
    const c = COMPOUNDS[cid], p = OBS.points[cid][i];
    if (!c || !p) return;
    $('#ptRead').innerHTML =
      `当前指向：<b style="color:${c.color}">${c.cn}</b> 第 ${i + 1} 点　δ<sub>H</sub> = <b>${p.ppm.toFixed(2)}</b> ppm　` +
      `<i>D</i> = <b>${p.D.toFixed(2)}</b> ×10⁻¹⁰ m²·s⁻¹（原图估读值）`;
  }
  ['mouseover', 'focusin'].forEach(ev =>
    $('#plot').addEventListener(ev, e => { const p = e.target.closest('.pt'); if (p) ptRead(p); }));
  $('#plot').addEventListener('keydown', e => {
    const p = e.target.closest('.pt');
    if (!p) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(p.dataset.c); ptRead(p); }
  });
  /* 表格行 */
  $('#assignTable').addEventListener('click', e => {
    const r = e.target.closest('tr[data-c]');
    if (r) setSel(r.dataset.c);
  });
  $('#assignTable').addEventListener('keydown', e => {
    const r = e.target.closest('tr[data-c]');
    if (!r) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(r.dataset.c); }
  });

  /* 开关 */
  $('#tgModel').addEventListener('click', function () {
    state.showModel = !state.showModel;
    this.setAttribute('aria-pressed', String(state.showModel));
    renderPlot(); renderCalc();
  });
  $('#tgSpec').addEventListener('click', function () {
    state.showSpec = !state.showSpec;
    this.setAttribute('aria-pressed', String(state.showSpec));
    renderPlot();
  });

  /* 滑块 */
  const sT = $('#sT'), sEta = $('#sEta'), sR = $('#sR');
  function onModelChange() {
    state.T = parseFloat(sT.value);
    state.eta = parseFloat(sEta.value);
    state.r = parseFloat(sR.value);
    $('#vT').textContent = fmt(state.T, 2) + ' K';
    $('#vEta').textContent = fmt(state.eta, 2) + ' mPa·s';
    $('#vR').textContent = fmt(state.r, 2) + ' nm';
    renderPlot(); renderReadout(); renderCalc();
  }
  [sT, sEta, sR].forEach(s => { s.addEventListener('input', onModelChange); s.addEventListener('change', onModelChange); });

  /* 放大镜 */
  $$('.lens-bar button').forEach(b => b.addEventListener('click', () => {
    state.lensRegion = b.dataset.region;
    $$('.lens-bar button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    updateLens();
  }));
  $('#sLens').addEventListener('input', function () {
    state.lensZoom = parseFloat(this.value);
    $('#vLens').textContent = fmt(state.lensZoom, 2) + ' ×';
    updateLens();
  });

  /* 术语气泡 */
  document.addEventListener('click', e => {
    const t = e.target.closest('.term');
    if (t) { showPop(t.dataset.term, t); return; }
    if (!e.target.closest('#popover')) hidePop();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hidePop(); return; }
    const t = e.target.closest && e.target.closest('.term');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showPop(t.dataset.term, t); }
  });

  window.addEventListener('resize', () => {
    updateLens();
    const prev = LAY ? LAY.narrow : null;
    makeLayout();
    if (LAY.narrow !== prev) renderPlot();   /* 跨过断点才重绘，避免频繁抖动 */
  });
}

/* ---------------- 启动 ---------------- */
function boot() {
  renderStructs();
  renderTable();
  renderChecks();
  renderGlossary();
  renderPlot();
  renderReadout();
  renderCalc();
  bind();
  updateLens();
  /* 原图加载后重算放大镜 */
  const img = $('#origImg');
  if (img && !img.complete) img.addEventListener('load', updateLens);
  /* 供自动验证读取 */
  window.__DOSY_READY__ = true;
  window.__DOSY_TERMS__ = TERMS;
  window.__DOSY__ = { state: state, OBS: OBS, COMPOUNDS: COMPOUNDS, TERMS: TERMS,
                      modelScale: modelScale, dPredict: dPredict, radiusFromD: radiusFromD };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
