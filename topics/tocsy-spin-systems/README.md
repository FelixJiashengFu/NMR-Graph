# TOCSY：沿耦合网络读懂相关

中文交互教学网页，面向大学课程初学者，依据用户上传的 TOCSY 截图制作。

## 打开与操作

双击 `index.html` 即可离线使用。原图、CSS、JavaScript、KaTeX 0.16.11 与全部公式字体已嵌入；点击外部来源链接才访问网络。

1. 默认选择 B↔D，切换 COSY / TOCSY，比较直接与接力相关。
2. 调整 0–120 ms 演示混合时间，观察模型权重变化。
3. 关闭含 NH 路径，观察 D 从 B–C 网络脱离。
4. 切换下方烯烃练习，查看三组基线分组；开启弱长程通路展示不同的假设。
5. 点击峰、氢组或横向读谱条目，同步查看结构、路径和解释。可用键盘操作控件和矩阵。
6. 展开完整原图，或按原像素尺寸滚动查看。

## 内容与证据边界

- 上方 A、B、C、D 位移分别约为 2.1、3.0、3.3、2.6 ppm，仅为截图估读。
- 上方截图画出的独立 A 峰与 B/C/D 相关块有 10 个峰斑位置；不能从这些点提取实验强度、积分、J 或 SNR。
- 下方结构读作 CH₃–CH₂–CH₂–CH=C(CH₃)–CH₂–CH₂–CH₂–CH₃，理论组成 C₁₀H₂₀、DBE = 1。
- 下方 G 编号是含氢碳组，未展开 CH₂ 不等价；基线三组与弱通路的合并均为有条件的解释，没有该分子的实测谱图。
- 权重采用图扩散类比 T(t) = exp(−tL)。速率是示意设定，不是 J，也不模拟实际脉冲、自旋相干、交换或弛豫。此页不能恢复真实实验曲线或给出最优混合时间。

## 文件与可编辑源码

```text
index.html                 完整单文件离线网页
preview.png               1440 像素宽度整页默认状态预览
validation.json           实际 Chromium 浏览器验收记录
numerical-verification.json 独立 RK4 与矩阵指数核对
source/
  template.html           中文正文与页面结构
  styles.css              响应式样式
  core.js                 可脱离 DOM 运行的图模型与自检
  app.js                  联动交互与 SVG 绘图
  build.py                标准库构建程序
  verify_model.py         独立算法数值核对
  qa-browser.cjs          实际浏览器交互与布局检查
  original-slide.png      原始截图，像素未经修改
  vendor/                 KaTeX 脚本、样式、字体与 MIT 许可
```

修改 `source/` 后，运行 `python3 source/build.py index.html` 即重新生成 `index.html`，可附加输出文件名参数。构建只需 Python 标准库，无须联网。数值验证需要 Node.js，可用 `NODE_BINARY` 指定可执行文件；浏览器验证需要 Playwright，可用 `PLAYWRIGHT_PACKAGE` 指定模块、`CHROME_EXECUTABLE` 指定 Chrome 可执行文件。`preview.png` 使用完整页面截图，保留全部教学内容。

浏览器已测试 1440、390、320 像素宽度的主要交互、全部 13 个氢组选项、键盘、原图、5 个公式、重置、数值自检与零外部请求。横向表格在手机局部滚动，页面本身无横向溢出。验证详情与参数见 JSON 文件。

## 参考来源

原材料来自本次用户上传；截图原作者、教材与实验条件未知。机制参考不是截图原始出处。

- [Columbia University NMR Core Facility · TOCSY](https://nmr.chem.columbia.edu/content/tocsy)
- [Northwestern IMSERC · 2D TOCSY](https://imserc.northwestern.edu/guide/eNMR/eNMR2D/index.html)
- [Northwestern IMSERC · 2D COSY](https://imserc.northwestern.edu/guide/eNMR/eNMR2D/cosy.html)

KaTeX 0.16.11 采用 MIT 许可，保留在 `source/vendor/LICENSE-katex.txt`。
