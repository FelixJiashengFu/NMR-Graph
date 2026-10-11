
    /* ---------- ④ 推导与数值核对 ---------- */
    h += '<details class="sec" id="dDer"><summary>④ 推导与数值核对 <span class="small muted">先算数，再写字' + E + 'span>' + E + 'summary><div>';
    h += '<p class="small">COSY 的交叉峰从哪来？两自旋 A、B，耦合常数 J；弱耦合哈密顿量 H = 2πJ·I<sub>z' + E + 'sub><sup>A' + E + 'sup>I<sub>z' + E + 'sub><sup>B' + E + 'sup>。第一个 90° 脉冲把 I<sub>z' + E + 'sub><sup>A' + E + 'sup> 变成 I<sub>x' + E + 'sub><sup>A' + E + 'sup>，混合期让它进动：' + E + 'p>';
    h += '<div class="eq" id="eq1">' + E + 'div>';
    h += '<p class="small">第二个 90° 脉冲把反相项转到 B 上，检测到的交叉峰信号 ∝ sin(πJτ<sub>m' + E + 'sub>)；A 自己的对角峰 ∝ cos(πJτ<sub>m' + E + 'sub>)。于是 2Jτ<sub>m' + E + 'sub> = 1（即 τ<sub>m' + E + 'sub> = 1/(2J)）时交叉峰最大、对角峰恰好为 0 —— 这就是「完全转移」。' + E + 'p>';
    h += '<div class="eq" id="eq2">' + E + 'div>';
    h += '<p class="small">再加上横向弛豫 e<sup>−2τ/T₂' + E + 'sup>，「涨上去」与「掉下来」打架，最优 τ<sub>m' + E + 'sub> 会往左偏，解 tan(πJτ) = πJT₂/2：' + E + 'p>';
    h += '<div class="eq" id="eq3">' + E + 'div>';
    h += '<h4>核对了什么（全部在 _verify_cosy.py 里真跑）' + E + 'h4>';
    h += '<table class="read small"><thead><tr><th>检查项' + E + 'th><th>结果' + E + 'th><th>类型' + E + 'th>' + E + 'tr>' + E + 'thead><tbody>';
    var checks = [
      ["精确量子演化（复密度矩阵 + scipy.linalg.expm）与 cos(πJτ)、sin(πJτ) 逐点对比", "偏差 1.1e-16", "trivial"],
      ["τ = 0 ⇒ 交叉峰 = 0（还没开始转移）", "偏差 0", "trivial"],
      ["零耦合 ⇒ 交叉峰恒为 0", "偏差 0", "trivial"],
      ["无弛豫时极大恰在 1/(2J)", "偏差 0 ms", "extremum"],
      ["含弛豫最优 τ* 满足 tan(πJτ*) = πJT₂/2", "偏差 1.2e-14", "extremum"],
      ["高密度采样找到的极大点 = 解析 τ*", "偏差 0 ms", "extremum"],
      ["不变量：交叉峰² + 对角峰² = e^(−4τ/T₂)", "偏差 4.4e-16", "invariant"],
      ["不变量：2D 峰表关于对角线成对（镜像幅度相等）", "0 个违例", "invariant"],
      ["Bloch–McConnell 解析根 vs numpy.linalg.eigvals 直接对角化", "偏差 1.8e-15", "cross"],
      ["交换因子 α：页面 JS vs Python 独立传播子（84 组）", "偏差 1.2e-11", "cross"],
      ["一阶多重峰：CH₃ 三重峰 1:2:1、CH₂ 四重峰 1:3:3:1", "偏差 0", "count"],
      ["等价核必须合并：两个 ¹H 的裂分 = 一个 m=2、J′ = 2J", "偏差 0", "count"]
    ];
    checks.forEach(function (c) {
      var bgc = c[2] === "trivial" ? "bg-cnt" : (c[2] === "invariant" ? "bg-lit" : (c[2] === "count" ? "bg-cnt" : "bg-calc"));
      var label = { trivial: "平凡情形", invariant: "不变量", extremum: "边界极值", cross: "两套实现互拍", count: "组合计数" }[c[2]];
      h += '<tr><td>' + c[0] + E + 'td><td class="mono">' + c[1] + E + 'td><td><span class="bg ' + bgc + '">' + label + E + 'span>' + E + 'td>' + E + 'tr>';
    });
    h += E + 'tbody>' + E + 'table>';
    h += '<h4>COSY 与 TOCSY 的对照' + E + 'h4>';
    h += '<table class="read small"><thead><tr><th>项' + E + 'th><th>COSY' + E + 'th><th>TOCSY' + E + 'th>' + E + 'tr>' + E + 'thead><tbody>';
    var cmp = [
      ["混合方式", "弱耦合 2πJ·I<sub>z" + E + "sub>I<sub>z" + E + "sub>（两个 90° 之间自由进动）", "各向同性 I<sub>x" + E + "sub>I<sub>x" + E + "sub> + I<sub>y" + E + "sub>I<sub>y" + E + "sub> + I<sub>z" + E + "sub>I<sub>z" + E + "sub>"],
      ["转移随 τ 的规律", "sin(πJτ)", "sin²(πJτ)（各向同性混合的结果）"],
      ["对角峰", "cos(πJτ)", "与转移互补"],
      ["完全转移条件", "2Jτ = 1", "2Jτ = 1"],
      ["相关范围", "沿耦合链走一步（主要是 ³J）", "整个自旋体系内都能传（中继）"]
    ];
    cmp.forEach(function (r) {
      h += "<tr><td>" + r[0] + E + 'td><td>' + r[1] + E + 'td><td>' + r[2] + E + 'td>' + E + 'tr>';
    });
    h += E + 'tbody>' + E + 'table>';
    h += E + 'div>' + E + 'details>';

    /* ---------- ⑤ 常见误区 ---------- */
    h += '<details class="sec" id="dMistake"><summary>⑤ 常见误区 <span class="small muted">10 条「误区 + 纠正」' + E + 'span>' + E + 'summary><div>';
    var mis = [
      ["把这张图上的 8 个色块当成「强度不同的 8 个峰」。",
       "8 个色块全部是 16.6×11.0 px 的同尺寸标记，尺寸与颜色都不编码强度；8 块 = 4 个对角块 + 4 个交叉块，而 3 对交叉峰本该有 6 块，图上少画了 2 块。数峰要看「不同位移数」和「耦合对数」，不能数色块。"],
      ["以为交叉峰一定成对出现，所以把交叉块数除以 2。",
       "成对是 2D 谱的对称性要求（关于对角线镜像）。原图里恰好少画了 2 块：与 (4.85, 2.99)、(4.15, 2.99) 对应的镜像位置是空的。本页模型谱严格成对，原图的 8 块则不是 —— 这正是「原图数据不全」的直接证据。"],
      ["把 τm 越长当成信号越强，所以往大拖。",
       "交叉峰 ∝ sin(πJτm)·e^(−2τm/T₂)：上升来自反相转移，下降来自弛豫。两者打架，最优值解 tan(πJτ) = πJT₂/2；J = 7.3 Hz、T₂ = 1.2 s 时是 65.3 ms，而纯几何的 1/(2J) 是 68.5 ms。"],
      ["认为交叉峰的强度可以直接读出 J 的大小。",
       "峰的两个 δ 坐标只告诉你「是哪两个质子」；J 要从多重峰裂分或定量拟合读出。本页让 J 决定幅度随 τm 涨落的快慢，那是模型选择，不是「从强度反推 J」。"],
      ["认为 2D 谱上「没有峰」就等于「没有耦合」。",
       "看不见有四种常见原因：J 太小（⁴J 量级）、τm 不在最优点、有交换展宽（–OH）、两个位移重合。前三种只影响「看不看得见」，第四种会把两个峰真的并成一个 —— 页面上的格数会从 10 掉到 7。"],
      ["把 –OH 交叉峰消失当成 –OH 不存在。",
       "–OH 的位移与对角峰都还在（常常是个宽包），消失的是它与 C1 的交叉峰。原因是交换把 J 耦合平均掉了。"],
      ["把 COSY 和 TOCSY 混为一谈，以为都能「一路传下去」。",
       "COSY 的交叉峰主要来自 ³J（相邻），沿链只走一步；TOCSY 的各向同性混合能在整个自旋体系里中继，会多出「隔一站」的峰。"],
      ["以为谱仪频率会影响「有几个峰」。",
       "频率只通过 Δν（Hz）影响交换展宽的绝对大小，不改变耦合拓扑。200 MHz 换成 900 MHz，峰的分组与个数不变，变化的只是 –OH 那个宽包的宽度。"],
      ["把「化学等价的氢」当成一个氢。",
       "–CH₃ 的三个氢在 2D 谱上只占一个位置，交叉峰也只出现一次；但它们对该峰的贡献是叠加的。本页的转移矩阵按「位点 × 位点」算，正是因为这个。"],
      ["把页面上的「阈值」当成实验噪声水平。",
       "阈值是本页为演示选的显示参数（默认 0.08），用来模拟「低于噪声看不见」。真实谱里决定看不看得见的是信噪比 S/N，不是这个数。"]
    ];
    mis.forEach(function (m, i) {
      h += '<div class="issue"><div class="t1">误区 ' + (i + 1) + "：" + m[0] + '' + E + 'div><div class="t2">纠正：' + m[1] + E + 'div>' + E + 'div>';
    });
    h += E + 'div>' + E + 'details>';
