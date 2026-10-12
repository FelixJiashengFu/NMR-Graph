# 3-庚酮：HSQC 与编辑 HSQC 峰归属

根据用户上传的课程幻灯片截图 “HSQC – Practice Problem” 制作的中文交互教学页，面向刚接触二维核磁的本科生。双击 `index.html` 即可离线打开：样式、脚本、原图和公式字体都已内嵌，页面不请求任何网络资源。

## 页面讲什么

- **主要结论**：3-庚酮（C₇H₁₄O）有 7 个碳，其中 6 个带氢，所以 HSQC 预期 6 个交叉峰；截图里两张谱各有 6 个峰，编辑谱为 2 黑 4 红，对应 2 个 CH₃ 和 4 个 CH₂。幻灯片问“多重性数据与预期相符吗”——相符。
- **最值得注意的一对峰**：羰基两侧的 C2、C4 在氢维只差约 0.02 ppm，在碳维相差约 6 ppm。
- **边界**：哪个红峰是 C2、哪个是 C4（以及 C5/C6、C1/C7）要借助给定结构和经验位移，单凭这两张谱定不下来。

页面按“主要结论 → 直观解释 → 交互区 → 原图放大 → 归属表 → 分步推理 → 数值核对 → 常见误区 → 中英对照 → 术语表 → 来源与限制”组织，并用四种标签区分证据：● 原图观测、◆ 结构辅助推断、■ 理论计数、▲ 演示模型。

## 怎么操作

- 点左侧列表、结构上的原子、任一谱图上的峰、归属表的一行或模型符号条，结构、两张重绘谱、读数、解释和原图定位圈同步更新。C3（羰基碳）也可以选：各处显示“无交叉峰”。
- 三个模型滑块（只改变演示模型，不改变原图和估读值）：编辑延迟 Δ（0–12 ms）、一键耦合常数 ¹J(C,H)（110–170 Hz）、谱仪 ¹H 频率（100–1000 MHz）。
- “原图局部放大”显示原图的真实像素：可切换常规面板、编辑面板、结构式，放大 1–8 倍，定位圈可关闭。
- 正文里带虚线下划线的术语可点按，或 Tab 选中后按 Enter 查看中文注释，Esc 关闭；完整术语表在第 15 节。甲基、亚甲基、羰基、乙基、丁基等基团旁配有画出原子和键的小结构图。
- 键盘：Tab 移动，Enter / 空格选择，对象列表可用 ↑↓ 切换，方向键调滑块。手机上模型滑块会移到对应图形上方，顶部有“当前对象”条。

## 数值从哪来

| 碳位 | 类型 | ¹H 估读 / ppm | ¹³C 估读 / ppm | 编辑谱颜色（原图） |
| --- | --- | --- | --- | --- |
| C1 | CH₃ | ≈ 1.06 | ≈ 8.2 | 黑 |
| C2 | CH₂ | ≈ 2.42 | ≈ 36.3 | 红 |
| C3 | C=O | — | 无法确认（不在图内） | 无峰 |
| C4 | CH₂ | ≈ 2.40 | ≈ 42.7 | 红 |
| C5 | CH₂ | ≈ 1.57 | ≈ 26.4 | 红 |
| C6 | CH₂ | ≈ 1.32 | ≈ 22.5 | 红 |
| C7 | CH₃ | ≈ 0.91 | ≈ 14.3 | 黑 |

这些数值由 `source/measure.mjs` 从截图像素估读：自动找出两个谱图的边框和刻度，做直线定标（横轴用 3.0–1.0 五个带数字的刻度；纵轴用 20、40 两个带数字的刻度，并入 10、30 处的无数字刻度），再取每个等高线小圈的墨迹重心。页面采用两个面板的平均值。

- 两个面板分别估读，同一峰最多相差 0.013 ppm（¹H）和 0.6 ppm（¹³C）；对同一张幻灯片的早期截图（`source/earlier-capture.png`）重复估读，最多相差 0.002 和 0.12 ppm。
- 顶部的一维 ¹H 投影与二维峰之间有约 0.03 ppm 的系统错位，页面以二维峰中心为准。
- 综合以上，页面声明的估读不确定度为 ¹H ±0.03 ppm、¹³C ±0.5 ppm。**它们不是实测化学位移。**

## 仍无法从原材料确认

精确化学位移；溶剂、温度、浓度、场强、脉冲序列与参数；峰的强度、积分、线宽和耦合常数；黑 / 红哪个是正相位；C2/C4、C5/C6、C1/C7 的逐峰细分；C3 的化学位移；¹H 投影上约 1.7 ppm（及更弱的约 2.1 ppm）小信号的来源；投影与二维峰错位的原因；幻灯片出自哪门课程。

两个演示模型里的 Δ、J（125 Hz 与 7.4 Hz）和场强都是假设值；重绘谱图的符号大小固定，不代表峰形或强度。

## 文件

```text
index.html                    单文件离线网页（由 source/ 构建，约 630 KB）
preview.png                   桌面 1440 px 整页预览
preview-390.png               手机 390 px 整页预览
preview-320.png               手机 320 px 整页预览
verification.json             浏览器验收记录（205 项）
numerical-verification.json   数值核对记录（69 项）
package.json                  依赖：katex、pngjs、playwright-core
source/original.png           本次上传的原图（1888 × 935，未改动；页面内嵌的就是它）
source/earlier-capture.png    同一幻灯片的早期截图（2218 × 1398），只用于交叉核对估读
source/measure.mjs            像素估读脚本 → source/measure.json
source/model.js               纯计算：计数、不饱和度、编辑延迟因子、ppm↔Hz、一级裂分
source/data.js                位点说明、术语表、官能团小图、中英对照
source/app.js                 页面交互
source/styles.css             样式
source/template.html          页面模板（公式用 $$…$$ 和 \(…\) 书写）
source/build.mjs              构建：渲染公式、内嵌字体 / 原图 / 脚本，生成 index.html
source/verify-numbers.mjs     数值核对
source/qa-browser.mjs         浏览器验收并生成三张预览图
```

## 重建与验证

Node ≥ 18 或 Deno ≥ 2 均可。

```bash
npm install                 # 或：deno install
npm run measure             # 或：deno run -A source/measure.mjs        从原图估读 → measure.json
npm run verify:numbers      # 或：deno run -A source/verify-numbers.mjs 69 项数值核对
npm run build               # 或：deno run -A source/build.mjs          生成 index.html
npm run verify:browser      # 或：deno run -A source/qa-browser.mjs     205 项浏览器验收 + 预览图
```

浏览器验收需要本机有 Chromium 或 Chrome；脚本会自动查找，也可用环境变量 `CHROME_PATH` 指定。`build.mjs` 会核对正文里写死的数字与 `measure.json` 是否一致，不一致时拒绝构建。

**数值核对**覆盖：碳氢计数与不饱和度（含乙烷、丙酮、苯和空结构等简单与边界情形）；坐标定标的线性残差与边框对应的 ppm；两个面板、两份截图之间的估读一致性；归属的位移递变趋势；编辑延迟模型在 Δ = 0、1/(2J)、1/J 处的取值、有界性、奇偶性和周期性；ms ↔ Hz、ppm ↔ Hz 换算；一级裂分的强度比、重心、跨度以及随场强的变化。

**浏览器验收**实际操作页面：七个对象逐个点选并检查各处同步；结构、谱图、表格、列表的键盘操作；每个滑块的默认值、两端和中间特征点；原图放大、区域切换和定位圈开关；术语注释的点按、键盘、Esc、焦点返回和手机上的越界；每张官能团小图的原子与键；内嵌原图与 `source/original.png` 逐字节一致；公式与字体加载；1440 / 1100 / 900 / 390 / 320 px 五种宽度下无横向溢出，图中文字不裁切、不重叠、不小于 9.5 px；全程没有脚本错误和网络请求。已分别用 Playwright 自带的 Chromium 和本机 Google Chrome 跑通。

## 来源

- 原始材料：用户上传的课程幻灯片截图，标题 “HSQC – Practice Problem”。
- 图的可能出处：幻灯片中的图题、化合物和两幅谱，与渥太华大学 NMR 设施博客 2007-11-14 的文章 [HSQC and Edited HSQC Spectra](https://u-of-o-nmr-facility.blogspot.com/2007/11/hsqc-and-edited-hsqc-spectra.html)（Glenn Facey）所述一致；该文说明编辑谱中 CH、CH₃ 为正（黑），CH₂ 为负（红）。截图本身没有注明出处，这一对应是制作者的判断。
- 分子信息：[PubChem CID 7802](https://pubchem.ncbi.nlm.nih.gov/compound/7802)（heptan-3-one，C₇H₁₄O）。
- 机制与经验值（教科书层面，非原图数据）：Claridge《High-Resolution NMR Techniques in Organic Chemistry》；Pretsch 等《Structure Determination of Organic Compounds》；Grant & Paul, *J. Am. Chem. Soc.* 1964, 86, 2984。
