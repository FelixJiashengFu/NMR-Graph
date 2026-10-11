# NMR Graph

交互式核磁共振谱图判读专题库。打开根目录的 [专题目录](./index.html)，再选择实验。各专题均为单文件网页，可以单独下载并在浏览器中打开。

## 专题

| 分类 | 专题 | 入口 |
| --- | --- | --- |
| 碳骨架连接 | INADEQUATE：1-辛醇碳峰归属练习 | [打开](./topics/inadequate-octanol/index.html) |
| 碳骨架连接 | 1,1-ADEQUATE：4-甲基伞形酮交叉峰判读 | [打开](./topics/adequate-methylumbelliferone/index.html) |
| 碳骨架连接 | ADEQUATE：相邻季碳为何无法关联 | [打开](./topics/adequate-adjacent-quaternary-carbons/index.html) |
| 碳骨架连接 | ADEQUATE：能否完成全部碳归属？ | [打开](./topics/adequate-carbon-coverage/index.html) |
| 异核长程相关 | H2BC × HMBC：两键与三键相关判读 | [打开](./topics/h2bc-hmbc/index.html) |
| 结构解析 | 苯佐卡因：¹H NMR 与 ¹³C APT 拼结构 | [打开](./topics/benzocaine-structure/index.html) |
| 异核单键相关 | 3-庚酮：HSQC 与编辑 HSQC 峰归属 | [打开](./topics/hsqc-edited-heptanone/index.html) |
| 同核相关 | TOCSY × COSY：接力相关与自旋系统 | [打开](./topics/tocsy-spin-systems/index.html) |
| 同核相关 | 蔗糖 TOCSY：H1′ 的近邻耦合中断 | [打开](./topics/tocsy-sucrose/index.html) |
| 同核相关 | 3-庚酮：TOCSY 与 COSY 对照 | [打开](./topics/tocsy-cosy-heptanone/index.html) |
| 同核相关 | 正丙醇 TOCSY：三个氢组的接力相关 | [打开](./topics/tocsy-propanol/index.html) |
| 同核相关 | 正丙醇 TOCSY：自旋混合模型与画谱练习 | [打开](./topics/tocsy-propanol-spin-dynamics/index.html) |
| 空间相关 | NOESY / ROESY：交叉峰怎样提示空间邻近 | [打开](./topics/noesy-roesy-vanillin/index.html) |
| 扩散排序 | DOSY：四种化合物的扩散排序 | [打开](./topics/dosy-four-compounds/index.html) |

## 仓库结构

```text
NMR-Graph/
├── index.html                         # 全部专题的目录入口
├── README.md                          # 专题索引与维护规则
└── topics/
    ├── inadequate-octanol/
    │   └── index.html                 # 原有 INADEQUATE 练习
    ├── adequate-methylumbelliferone/
    │   ├── index.html                 # ADEQUATE 交互示意与判读讲解
    │   └── README.md                  # 本专题的范围与来源
    ├── adequate-adjacent-quaternary-carbons/
    │   ├── index.html                 # 相邻季碳的 ADEQUATE 局限
    │   ├── preview.png                # 桌面整页预览
    │   ├── preview-mobile.png         # 手机整页预览
    │   └── source/                    # 原图与浏览器验证脚本
    ├── adequate-carbon-coverage/
    │   ├── index.html                 # ADEQUATE 全碳归属交互教学页
    │   ├── README.md                  # 逐碳结论、操作与来源说明
    │   ├── assets/                    # 课程原图
    │   ├── src/                       # 可编辑源码与构建脚本
    │   └── verify/                    # 静态与浏览器验证
    ├── h2bc-hmbc/
    │   └── index.html                 # H2BC / HMBC 互动图解
    ├── hsqc-edited-heptanone/
    │   ├── index.html                 # 3-庚酮 HSQC/编辑 HSQC 离线练习
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 原图、源码、构建与验证脚本
    ├── tocsy-spin-systems/
    │   ├── index.html                 # TOCSY 接力相关与分组图解
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与验证脚本
    ├── tocsy-propanol/
    │   ├── index.html                 # 正丙醇 TOCSY 画谱与 OH 条件比较
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与离线公式资源
    ├── tocsy-propanol-spin-dynamics/
    │   ├── index.html                 # 正丙醇 TOCSY 自旋混合模型
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 原图、源码、公式字体与验证脚本
    ├── tocsy-cosy-heptanone/
    │   ├── index.html                 # 3-庚酮 COSY / TOCSY 对照
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与验证脚本
    ├── noesy-roesy-vanillin/
    │   ├── index.html                 # 单文件离线教学网页
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与局部放大
    ├── dosy-four-compounds/
    │   ├── index.html                 # DOSY 四种化合物交互教学页
    │   ├── README.md                  # 页面范围与数据限制
    │   ├── preview.png                # 整页预览
    │   ├── assets/                    # 原始幻灯片截图
    │   ├── src/                       # 可编辑源码与核验脚本
    │   └── verify/                    # 数据、核验报告与截图
    └── benzocaine-structure/
        └── index.html                 # 苯佐卡因氢谱与 APT 结构解析
```

## 今后新增专题

1. 在 `topics/` 下新建一个简短、稳定、全小写的专题目录，例如 `topics/cosy-basics/`。
2. 将网页保存为该目录的 `index.html`；如有图片或数据文件，只放在该专题目录里，并使用相对路径引用。
3. 在根目录 `index.html` 的对应分类加入一张专题卡片，同时更新上面的专题表。
4. 在专题页面注明真实实验数据与教学示意的区别，并列出必要来源。

原有的 INADEQUATE 练习已从仓库根目录移至 `topics/inadequate-octanol/`，内容保留。该练习的谱图和相关关系根据题目截图重绘；ppm 为估读值，不宜作为精确化学位移参考。H2BC / HMBC 页面中的相关峰为概念示意，不对应原始苯乙烯实验峰位或峰强。

TOCSY 专题使用用户课程截图：ppm 仅为估读，峰强为图扩散类比。下方烯烃按常规近邻耦合可分三组；弱长程通路可能改变分组，尚无原始谱图验证。

蔗糖 TOCSY 专题保留用户课程原图与局部放大，提供氢位点、示意相关矩阵、结构及解释联动。单文件包含离线公式字体。ppm 为截图估读，接力步数与峰形为教学示意；14 个碳上氢和 7/5/2 网络分组为结构理论计数。验证结果见专题中的 `verification.json`，可编辑源码与原图位于 `source/`。

3-庚酮专题保留 TOCSY vs COSY 课程原图与局部放大，提供六组氢、两组有效网络、4/7/3 对关联计数与 COSY/TOCSY 联动对照。峰位仅为粗略估读，精确重绘坐标、峰形和混合时间权重均为教学设置；跨羰基弱长程耦合被忽略。单文件含离线公式字体，数值和浏览器验收记录与可编辑源码随专题保存。

正丙醇 TOCSY 专题以用户练习截图为来源，默认展示 3 个碳上氢组与 9 个理想相关峰中心；可比较 COSY、耦合断路及 OH 条件。ppm、峰形与图扩散权重均为示意，OH 是否接入未由原图确认。单文件嵌入原图、脚本及公式字体；源码、手机预览和验证记录保存在专题目录。

3-庚酮 HSQC 专题以用户课程截图为来源，提供六个峰位、两种谱图、结构和相位类别联动。ppm 为粗略估读；C2/C4 细分是结构辅助推断；阈值和局部图为演示，不代表原始实验分辨率。完整原图、验证脚本与预览随专题保存。

正丙醇 TOCSY 自旋混合专题保留另一份独立教学实现，使用理想各向同性混合模型显示四组质子（含可选 OH）的磁化转移。默认化学位移、J、混合时间与峰强均属教学模型或文献近似；原练习截图不含实测谱图。

NOESY / ROESY 专题以用户上传的香草醛教学截图为来源。页面联动选中交叉峰、结构位置与估读值；芳香区具体归属无法凭截图独立确认。距离曲线只展示归一化 r⁻⁶ 模型，不对应截图实测峰强。原图、局部裁切、可编辑源码、数值检查和整页预览随专题保存。

ADEQUATE 全碳归属专题从课程分子骨架讨论 1,1-ADEQUATE 的观测范围。页面包含原图、逐碳判定与教学模型；无原始谱图，示意峰位和效率不代表实测值。源码及验证记录随专题保存。

DOSY 专题从课程截图估读四种化合物的化学位移与扩散系数，并将原图观测、结构推断和 Stokes–Einstein 演示模型分开标注。原图没有提供原始数据或实验条件；源码、原图和核验记录随专题保存。
