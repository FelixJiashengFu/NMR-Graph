# 正丙醇 TOCSY：三个氢组的接力相关

中文交互教学页，面向大学课程初学者。根据用户上传的 `TOCSY - Practice Problem` 截图制作，未提供额外 PDF、实验谱图或 FID。

## 打开与操作

直接用浏览器打开 `index.html`。该文件已内嵌脚本、样式、原图、结构裁切与 KaTeX 公式字体，可单独离线使用。

1. 默认显示 A = CH₂OH、B = 中间 CH₂、C = CH₃，理想 TOCSY 共 9 个峰中心。
2. 点击氢组、分子位置、谱峰或矩阵格，联动查看坐标、路径、模型权重与解释。
3. 选择 COSY 对照，比较直接耦合与 A–C 接力相关。
4. 调节无量纲传递进程 τ、显示阈值 θ 和示意位移；取消 A–B / B–C 耦合边做断路思想实验。
5. 切换 OH 条件，比较省略、独立、接入和 D₂O 交换示意。
6. Tab 选择控件；方向键调节滑块；Enter / 空格选择相关峰。

## 证据与限制

- 原截图确定分子名称、题意、骨架及三个彩色碳位置。
- C₃H₈O、2 + 2 + 3 + 1 = 8 个氢为结构推算；三组完整相关有 3 个对角峰、6 个交叉峰中心，为理论计数。
- 3.60 / 1.60 / 0.90 ppm 及 OH 的 2.50 ppm 均为画图示意，并非原图估读或样品实测位移。
- 图扩散 P(τ) = exp(−τL) 为等权氢组网络类比，不是 TOCSY 量子动力学。τ 不对应 ms，权重不对应积分、实验峰强或氢数。
- OH 的归属与耦合取决于交换和实验条件；原图未提供这些条件。
- 以三个化学位移氢组为练习层次，忽略非等价、多重峰细结构、重叠、长程弱耦合、射频偏置与弛豫。

页面“来源与限制”列出 Columbia NMR Core、MSU William Reusch 教材及 UCSB NMR Facility 的核对链接。页面中无自动外部加载；链接仅在主动点击时联网。

## 文件

- `index.html`：完整离线网页。
- `preview.png`：1440 px 宽整页预览。
- `preview-320.png`、`preview-390.png`：手机布局预览。
- `verification.json`：数值、浏览器交互与布局检查结果。
- `source/template.html`、`source/style.css`、`source/app.js`：可编辑内容、样式及交互。
- `source/model.js`：模型与边界自检。
- `source/original.png`：完整原始截图；`source/structure-crop.png`：原图结构裁切。
- `source/vendor/`：KaTeX 离线资源及 MIT 许可。
- `source/build.py`：重建单文件网页；`source/verify.cjs`：自动交互、离线、布局与数值检查。

## 重建与复核

安装 Python 的 Pillow 后，在本专题目录执行：

```sh
python3 source/build.py
```

浏览器检查需要 Node.js、Playwright 和已安装的 Google Chrome：

```sh
npm install playwright
node source/verify.cjs
```

可用 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径，或用 `CHROME_BIN` 指定浏览器可执行文件。

当前检查包括 96 组数值边界组合、解析式对拍、主要控件及键盘操作，以及 1440 / 1024 / 768 / 390 / 320 px 布局。检查浏览器错误、外部请求、公式溢出、图形文字裁切和图片加载。桌面及手机图形已人工查看截图。
