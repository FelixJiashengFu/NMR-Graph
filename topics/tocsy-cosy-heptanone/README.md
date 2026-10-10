# 3‑庚酮：TOCSY 与 COSY 对照

面向大学课程初学者的中文交互教学页。输入为用户上传的一张 `TOCSY vs COSY` 课程截图，保留原图，区分观测、结构理论、网络推算与教学模型。

双击 `index.html` 即可离线打开。脚本、样式、原图、KaTeX 0.16.11 和公式字体全部内嵌；参考来源链接仅在点击时访问网络。

## 如何操作

- 默认 4↔7：查看 4–5–6–7 三步接力，比较 COSY 与 TOCSY。
- 选择起点/终点，或点击结构位置、谱图标记、归属表和完整组对矩阵，同步更新路径与解释。
- 调整 0–120 ms 的演示混合时间和 0–0.8 的显示阈值，观察教学权重与可见标记变化。
- 点击 2↔4 理解忽略跨羰基弱长程耦合时的有效分组。
- 展开完整原图，复习局部放大、完整归属、计数、推理、误区与自测。
- Tab 定位控件，方向键调整滑块，Enter/空格激活按钮和 SVG 图形。

## 证据边界

截图可辨认标题、3‑庚酮编号结构、ppm 单位、主要刻度和相关斑点。峰位仅为粗略估读。δ2、δ4 接近约 2.4 ppm，无法确认精确位置或原实验分辨情况。没有 PDF、数值谱、FID、积分、J、采集频率、溶剂、温度或混合时间。

给定结构理论上为 C₇H₁₄O，14 H，DBE=1。近邻模型设四条有效边：1–2、4–5、5–6、6–7，得到两组有效网络。COSY 4 对、理想 TOCSY 7 对、新增 3 对均为组级理论计数，不是逐个确认的实测峰数。弱跨羰基长程耦合被忽略，不声称它严格为零；CH₂ 未展开单个质子磁不等价。

演示权重采用泊松累计概率类比：对路径长度 d≥1，w=1−exp(−u)Σ(k=0…d−1)uᵏ/k!，u=t/(30 ms)。它不是量子自旋动力学、不模拟弛豫或相干、不保证总磁化守恒、不拟合真实实验强度。精确重绘坐标与峰形是人为教学设置。

## 文件与重建

```text
index.html                  完整单文件 HTML
preview.png                 1440 px 宽整页默认预览
verification.json           实际浏览器验收记录
numerical-verification.json 独立 Python 与 JS 数值核对
source/
  template.html             可编辑中文正文与布局
  styles.css                响应式样式
  core.js                   组级网络模型与自检
  app.js                    SVG 与联动交互
  original-slide.png        原始截图，像素未修改
  build.py                  离线构建程序，Python 标准库
  verify_model.py            独立数值验证，需要 Node.js
  qa-browser.cjs             浏览器验证，需要 Playwright 与 Chrome
  vendor/                   KaTeX 0.16.11、WOFF2 字体与 MIT 许可
```

在此专题目录执行：

```sh
python3 source/build.py
python3 source/verify_model.py
PLAYWRIGHT_PACKAGE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chrome node source/qa-browser.cjs
```

`NODE_BINARY` 可指定 Node 可执行文件。浏览器脚本默认使用当前 Codex 的 bundled Playwright 路径与 macOS Chrome，其他环境需通过变量设置。数值脚本检查 4,356 个值与解析导数；网页提供 13 项模型自检。浏览器验收包含全部 36 个组对、6 个结构位置、默认全部可见标记、预设、滑块边界、键盘、原图、自测、公式、零外部请求与 1440/1280/390/320 px 布局。

## 来源

- 原图：本次用户上传的课程截图；课件原作者、页码与实验来源未知。
- [Columbia University NMR Core Facility · TOCSY](https://nmr.chem.columbia.edu/content/tocsy)
- [University of Oxford NMR Facility · TOCSY](https://nmr.chem.ox.ac.uk/tocsy)

机制参考不是原图实验出处。KaTeX MIT 许可见 `source/vendor/LICENSE-katex.txt`。
