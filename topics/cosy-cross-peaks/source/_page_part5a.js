
  /* ======================= 底部折叠区 ======================= */
  function renderDetails() {
    var E = String.fromCharCode(60, 47);   // 60 与 47 就是小于号与斜杠
    var h = "";
    var host = $("detailsHost"); if (host.dataset.built) return;
    host.dataset.built = "1";
    var stt = st(), P = N.visiblePeaks(stt), tp = N.turnPointMs(7.3, 1200);
    var h = "";

    /* ---------- ① 原始材料与局部放大 ---------- */
    h += '<details class="sec" id="dSrc"><summary>① 原始材料与局部放大 <span class="small muted">原图 + 逐像素读数' + E + 'span>' + E + 'summary><div>';
    h += '<div class="small">原图 = 幻灯片截图（1488 × 862 px）。左侧四条要点、右上球棍结构、左上 2D COSY 示意方块、右下 COSY 示意图。本页把它拆成「能测的」与「不能测的」两张清单。' + E + 'div>';
    h += '<div class="eq" id="eqCalib">' + E + 'div>';
    h += '<div class="grid2" style="margin-top:8px">';
    h += '<div><h4>原图里确实有的' + E + 'h4><ul class="tight small">';
    h += '<li>球棍结构：4 个 C（蓝 <span class="mono">#5865EA' + E + 'span>）、1 个 O（红 <span class="mono">#E4566D" + E + "span>）、1 个 N（品红 <span class="mono">#EE59E7" + E + "span>）、9 个 H（黄 <span class="mono">#EBE84E" + E + "span>）<span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>原子球心像素坐标（O 在 (1247, 201)、N 在 (1334, 279) 等），球直径约 30 px <span class="bg bg-src">原图' + E + 'span>' + E + 'li>';
    h += '<li>四个氢位标记 A / B / C / D 与一条标着 ³J<sub>HH' + E + 'sub> 的弧线 <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>四条文字要点、标题 “2-D ¹H-¹H COSY”、两轴标题 “¹H Chemical Shift (ppm)”、说明句 “A liquid-state experiment identifying ¹H-¹H correlations between neighboring protons.” <span class="bg bg-src">原图' + E + 'span>' + E + 'li>';
    h += '<li>2D 框内 8 个红色色块（<span class="mono">#D77D7E' + E + 'span>），约 16.6 × 11.0 px，<b>全部同尺寸' + E + 'b> <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>右下示意图：两条轴上的双线、δ<sub>X' + E + 'sub> 与 δ<sub>A' + E + 'sub> 标记、一个方框、一条对角虚线、两组各 4 个方点 <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>底色 <span class="mono">#FFFFFF' + E + 'span>、个别面板底 <span class="mono">#F2F2F2" + E + "span> <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += E + 'ul>' + E + 'div>';
    h += '<div><h4>原图里没有的' + E + 'h4><ul class="tight small">';
    h += '<li><b>任何实测谱数据' + E + 'b>：框内是 8 个等尺寸色块，不是等高线；尺寸与颜色都不编码强度或位移 <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>框边的刻度线与刻度值：框边几乎全白，量不到可靠刻度。本页的 ppm 是用<b>色块中心坐标' + E + 'b>配合对称性反推的 <span class="bg bg-src">原图" + E + "span>' + E + 'li>';
    h += '<li>化学位移 δ、耦合常数 J、溶剂、温度、谱仪频率、混合时间 τ<sub>m' + E + 'sub>、相位、噪声、峰强 —— 一个都没有。本页出现的这些数字全部来自文献近似或模型' + E + 'li>';
    h += '<li>四个字母 A/B/C/D 与球棍结构上氢的一一对应：字母位置与 2D 色块的对应存在歧义，本页只采用可证的那一条 —— A–B–C–D 构成一条耦合链' + E + 'li>';
    h += '<li>分子的完整结构：球棍图能看出 4 个碳、1 个 O、1 个 N 及连接方式，但基团朝向、立体化学等无法确认' + E + 'li>';
    h += E + 'ul>' + E + 'div>' + E + 'div>';
    h += '<div class="warn small">凡涉及实测谱线的地方本页只能建模：<b>不存在可以从这张图恢复的真实谱曲线' + E + 'b>。' + E + 'div>';
    h += E + 'div>' + E + 'details>';

    /* ---------- ② 完整归属表 ---------- */
    h += '<details class="sec" id="dTab"><summary>② 完整归属表 <span class="small muted">每个数字挂一个来源徽章' + E + 'span>' + E + 'summary><div>';
    h += '<div class="eq" id="eqTable">' + E + 'div>';
    h += '<table class="read small" style="margin-top:6px"><thead><tr><th>量' + E + 'th><th>取值' + E + 'th><th>来源' + E + 'th>' + E + 'tr>' + E + 'thead><tbody>';
    var rows = [
      ["结构式（球棍）", "4×C、1×O、1×N、9×H，链状", "bg-src", "原图"],
      ["色块颜色 / 尺寸", "#D77D7E / 16.6×11.0 px，8 个全同", "bg-src", "原图"],
      ["色块中心（像素）", "(1009,223) (887,262) (960,262) (887,300) (917,300) (961,325) (887,325) (918,325)", "bg-src", "原图"],
      ["色块中心（ppm）", "δ = 2.00 / 2.55 / 3.12 / 3.28 / 4.09 / 4.77", "bg-src", "原图（估读 ±0.05 ppm）"],
      ["耦合拓扑", "A–B–C–D 一条链；A 与 C 之间没有交叉峰", "bg-src", "原图（关于对角线镜像）"],
      ["δ 与 J（正丙醇）", "δ 2.20 / 3.57 / 1.56 / 0.93 ppm；J 5.2 / 6.6 / 7.3 Hz", "bg-lit", "文献近似"],
      ["1/(2J)", fmt(1000 / 14.6, 4) + " ms（J = 7.3 Hz）", "bg-cnt", "理论计数"],
      ["模型最优 τm（含 T₂ = 1.2 s）", fmt(tp, 3) + " ms", "bg-calc", "计算"],
      ["对角峰 / 交叉峰数", "N 个对角峰；链状耦合时 N−1 对交叉峰", "bg-cnt", "理论计数"],
      ["谱仪频率、T₂、阈值", "400 MHz、1200 ms、0.08", "bg-par", "模型参数"]
    ];
    rows.forEach(function (r) {
      h += "<tr><td>" + r[0] + E + 'td><td class="mono">' + r[1] + E + 'td><td><span class="bg ' + r[2] + '">' + r[3] + E + 'span>' + E + 'td>' + E + 'tr>';
    });
    h += E + 'tbody>' + E + 'table>';
    h += '<h4>当前参数下的峰表' + E + 'h4><table class="read small"><thead><tr><th>峰 (F2,F1)' + E + 'th><th>类型' + E + 'th><th>J/Hz' + E + 'th><th>幅度' + E + 'th><th>来源' + E + 'th>' + E + 'tr>' + E + 'thead><tbody>';
    P.forEach(function (p) {
      h += "<tr><td>(" + p.f2.toFixed(2) + ", " + p.f1.toFixed(2) + ")" + E + 'td><td>' + (p.diag ? "对角" : "交叉") +
        E + 'td><td class="mono">' + (p.J ? p.J.toFixed(1) : "—") + E + 'td><td class="mono">' + fmt(p.amp, 4) +
        E + 'td><td><span class="bg bg-calc">计算' + E + 'span>' + E + 'td>' + E + 'tr>';
    });
    h += E + 'tbody>' + E + 'table>';
    h += E + 'div>' + E + 'details>';

    /* ---------- ③ 术语与官能团速查 ---------- */
    h += '<details class="sec" id="dTerm"><summary>③ 术语与官能团速查 <span class="small muted">全部 ' + Object.keys(TERMS).length + ' 条' + E + 'span>' + E + 'summary><div>';
    h += '<div class="grid2">';
    Object.keys(TERMS).forEach(function (k) {
      h += '<div class="termcard"><b>' + k + '' + E + 'b> <span class="en">' + TERMS[k][0] + '' + E + 'span><p>' + TERMS[k][1] + E + 'p>' + E + 'div>';
    });
    h += E + 'div>' + E + 'div>' + E + 'details>';
