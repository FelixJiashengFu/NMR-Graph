# NMR Graph

交互式核磁共振谱图判读专题库。打开根目录的 [专题目录](./index.html)，再选择实验。各专题均为单文件网页，可以单独下载并在浏览器中打开。

## 专题

| 分类 | 专题 | 入口 |
| --- | --- | --- |
| 碳骨架连接 | INADEQUATE：1-辛醇碳峰归属练习 | [打开](./topics/inadequate-octanol/index.html) |
| 碳骨架连接 | 1,1-ADEQUATE：4-甲基伞形酮交叉峰判读 | [打开](./topics/adequate-methylumbelliferone/index.html) |
| 异核长程相关 | H2BC × HMBC：两键与三键相关判读 | [打开](./topics/h2bc-hmbc/index.html) |

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
    └── h2bc-hmbc/
        └── index.html                 # H2BC / HMBC 互动图解
```

## 今后新增专题

1. 在 `topics/` 下新建一个简短、稳定、全小写的专题目录，例如 `topics/cosy-basics/`。
2. 将网页保存为该目录的 `index.html`；如有图片或数据文件，只放在该专题目录里，并使用相对路径引用。
3. 在根目录 `index.html` 的对应分类加入一张专题卡片，同时更新上面的专题表。
4. 在专题页面注明真实实验数据与教学示意的区别，并列出必要来源。

原有的 INADEQUATE 练习已从仓库根目录移至 `topics/inadequate-octanol/`，内容保留。该练习的谱图和相关关系根据题目截图重绘；ppm 为估读值，不宜作为精确化学位移参考。H2BC / HMBC 页面中的相关峰为概念示意，不对应原始苯乙烯实验峰位或峰强。
