# NOESY / ROESY：交叉峰怎样提示空间邻近

打开 `index.html` 即可离线使用。页面嵌入原始截图、局部裁切图、样式和脚本。化学术语带可点按注释，官能团旁绘有结构小图，底部有完整术语表。

## 来源与边界

来源是用户上传的 “NOESY/ROESY - Interpretation” 教学截图，原文件保存在 `source/original.png`。截图上的二维谱坐标和颜色点为估读；未提供原始峰表、积分、混合时间、温度、实验相位或处理参数。页面按香草醛骨架给出结构辅助的候选归属，芳香区具体交叉峰归属不能确定。重绘谱图是定位示意，距离滑块的曲线是独立的 (I/I_0=(r_0/r)^6) 演示模型，不是实验重建。

外部理论参考：

- UCSB NMR Theory: https://nmr.chem.ucsb.edu/education/part5.html
- Chemical Science (2020), reference-free NOE analysis: https://pubs.rsc.org/en/content/articlehtml/2020/sc/d0sc02970j

## 编辑与验证

编辑 `source/template.html`、`source/style.css`、`source/terms.js`、`source/app.js` 后，运行 `node source/build.cjs` 重新生成单文件网页。运行 `node source/verify.cjs` 核对模型公式、单位示例与离线资源。`preview.png` 为整页桌面预览。
