# ADEQUATE：相邻季碳为何无法关联

打开 `index.html` 即可离线使用。页面讲解 ADEQUATE 对相邻季碳的局限，并通过可点击的结构、相关图和参数控件展示推理过程。原始教学幻灯片完整嵌入网页。

## 文件

- `index.html`：可独立打开、可编辑的完整教学网页。
- `preview.png`、`preview-mobile.png`：桌面和手机整页预览。
- `source/original.png`：未经修改的原始幻灯片。
- `source/verify.js`：Chromium 交互与版面验证脚本。

## 来源与边界

来源为用户提供的英文 ADEQUATE 教学幻灯片。原图没有给出实验磁场、耦合常数或化学位移；页面里的数值参数与峰强变化属于教学演示。结构标号是本页自设，不能当作原图编号。页面会分别标明原图内容、结构推断、理论计数与演示模型。

## 验证

在具备 Chrome 与 `puppeteer-core` 的环境中，从本目录运行 `node source/verify.js`。脚本会检查主要交互、键盘操作、桌面与手机布局，并重新生成两张预览图。
