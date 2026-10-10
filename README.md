# NMR Graph

交互式核磁共振谱图判读专题库。打开根目录的 [专题目录](./index.html)，再选择实验。各专题均为单文件网页，可以单独下载并在浏览器中打开。

## 专题

| 分类 | 专题 | 入口 |
| --- | --- | --- |
| 碳骨架连接 | INADEQUATE：1-辛醇碳峰归属练习 | [打开](./topics/inadequate-octanol/index.html) |
| 碳骨架连接 | 1,1-ADEQUATE：4-甲基伞形酮交叉峰判读 | [打开](./topics/adequate-methylumbelliferone/index.html) |
| 异核长程相关 | H2BC × HMBC：两键与三键相关判读 | [打开](./topics/h2bc-hmbc/index.html) |
| 结构解析 | 苯佐卡因：¹H NMR 与 ¹³C APT 拼结构 | [打开](./topics/benzocaine-structure/index.html) |
| 同核相关 | TOCSY × COSY：接力相关与自旋系统 | [打开](./topics/tocsy-spin-systems/index.html) |
| 同核相关 | 蔗糖 TOCSY：H1′ 的近邻耦合中断 | [打开](./topics/tocsy-sucrose/index.html) |
| 同核相关 | 3-庚酮：TOCSY 与 COSY 对照 | [打开](./topics/tocsy-cosy-heptanone/index.html) |

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
    ├── h2bc-hmbc/
    │   └── index.html                 # H2BC / HMBC 互动图解
    ├── tocsy-spin-systems/
    │   ├── index.html                 # TOCSY 接力相关与分组图解
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与验证脚本
    ├── tocsy-cosy-heptanone/
    │   ├── index.html                 # 3-庚酮 COSY / TOCSY 对照
    │   ├── preview.png                # 整页预览
    │   └── source/                    # 可编辑源码、原图与验证脚本
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
