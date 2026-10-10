# 3‑庚酮：HSQC 与编辑 HSQC 峰归属

本专题根据用户上传的 “HSQC – Practice Problem” 课程截图制作。默认读者为大学核磁共振课程初学者。双击 `index.html` 即可离线打开；页面内嵌脚本、样式、完整原图和局部图，不依赖网络资源。

## 讲解范围

- 点击六个带氢碳位、结构圆点、谱图峰或归属表行，可同步查看两种 HSQC、估读坐标和结构辅助归属。
- 两个滑块分别改变局部图 ¹H 显示窗口与“氢位移接近”的教学判定阈值；它们不改变原图数据，也不代表仪器分辨率。
- 原图约有 6 个交叉峰。结构理论计数为 2 CH₃ + 4 CH₂ = 6 个带氢碳、14 个氢；C3 羰基碳没有普通直接 H–C 相关峰。编辑谱中 2 黑 + 4 红与理论类别相符。
- C2 与 C4 的 ¹H 估读值约 2.43、2.40 ppm；¹³C 约 36、43 ppm。两个具体碳位的细分依赖给定结构和化学环境，原图未逐峰标号。

## 证据边界

所有 ppm 均从低分辨率截图粗略估读，不是数字化原始谱或精确测量。页面中的峰圈大小、局部放大及阈值高亮是示意；没有恢复实验峰形、强度、积分或 J 耦合。截图没有独立 PDF、FID、峰表、采集参数、溶剂或课件出处。普通 HSQC 只提供直接 H–C 位置相关；编辑谱常用相反相位区分 CH₂ 与 CH／CH₃，本例图色的解释还依赖给定结构。

## 文件

```text
index.html                  可独立分发和编辑的完整离线网页
preview.png                 桌面整页预览
preview-390.png             390 px 手机整页验收图
preview-320.png             320 px 手机整页验收图
verification.json           浏览器交互与布局验收记录
numerical-verification.json 独立数值核对记录
source/template.html        可编辑页面源码
source/build.py             原图内嵌构建脚本
source/qa-browser.cjs       Chrome/Playwright 验收脚本
source/verify_numbers.py    独立 Python 数值检查
source/original-slide.png   完整上传截图，像素未修改
source/spectra-crop.png     供页面对照阅读的局部裁切
```

重建：在本目录执行 `python3 source/build.py`，再执行 `python3 source/verify_numbers.py` 和 `node source/qa-browser.cjs`。Chrome 与 Playwright 路径可在验收脚本中按环境修改。浏览器验收覆盖六个位点、图形与键盘选择、滑块边界、原图展开、1440/390/320 px 布局、页面错误与外部请求。

## 机制参考

- [University of Ottawa NMR Facility · HSQC and Edited HSQC Spectra](https://u-of-o-nmr-facility.blogspot.com/2007/11/hsqc-and-edited-hsqc-spectra.html)
- [Multiplicity-separated HSQC 原始研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC6057795/)
- [PubChem · 3-Heptanone](https://pubchem.ncbi.nlm.nih.gov/compound/7802)

这些资料用于核对机制和分子式，不是课程截图的来源。
