#!/usr/bin/env python3
"""从课件截图 original.png 估读 HSQC 交叉峰的坐标，写入 measure.json。

做法：
1. 在谱图下边和右边找刻度线，用带数字的主刻度做直线定标（像素 → ppm）。
2. 取蓝紫色等高线像素，填实每个小圈后求重心；连在一起的两个圈用二均值拆开。
3. 顺带描出顶部和左侧两条一维曲线，供页面重绘。

运行：python3 measure.py   （需要 Pillow、NumPy、SciPy）
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
im = np.array(Image.open(HERE / "original.png").convert("RGB")).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
total = r + g + b

# 谱图边框（灰色长线），由行列暗像素计数得到
LEFT, RIGHT, TOP, BOTTOM = 826, 1485, 317, 694


def runs(mask, offset):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append((start + i - 1) / 2 + offset)
            start = None
    return out


# 主刻度比次刻度长：在离边框 4 px 处仍然存在的就是主刻度
x_major = runs(total[BOTTOM + 4, LEFT - 6:RIGHT + 10] < 690, LEFT - 6)
y_major = runs(total[TOP - 7:BOTTOM + 6, RIGHT + 4] < 690, TOP - 7)
# 截图上的数字：横轴 3.6 … 2.6（最右一个被轴名盖住，按等间隔是 2.4）；纵轴 40 … 65（最上一个按等间隔是 35）
x_ppm = [3.6, 3.4, 3.2, 3.0, 2.8, 2.6, 2.4]
y_ppm = [35, 40, 45, 50, 55, 60, 65]
assert len(x_major) == len(x_ppm), x_major
assert len(y_major) == len(y_ppm), y_major
kx, bx = np.polyfit(x_major, x_ppm, 1)
ky, by = np.polyfit(y_major, y_ppm, 1)
res_x = float(np.abs(np.polyval([kx, bx], x_major) - x_ppm).max())
res_y = float(np.abs(np.polyval([ky, by], y_major) - y_ppm).max())
H = lambda x: kx * x + bx
C = lambda y: ky * y + by

# 等高线：偏蓝紫的像素（边框和刻度是中性灰，不会被选中）
ink = (b - r > 8) & (total < 720)
inside = np.zeros_like(ink)
inside[TOP + 3:BOTTOM - 2, LEFT + 3:RIGHT - 2] = True
blob = ndi.binary_fill_holes(ndi.binary_closing(ink & inside, structure=np.ones((3, 3)), iterations=2))
lab, n = ndi.label(blob)

peaks = []
for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    if len(ys) < 120:
        continue
    pts = np.column_stack([xs, ys]).astype(float)
    width = xs.max() - xs.min()
    groups = [pts]
    if width > 45:  # 两个圈连在一起：沿横向做二均值
        c = np.array([xs.min() + width * 0.25, xs.min() + width * 0.75])
        for _ in range(50):
            which = np.abs(pts[:, :1] - c[None, :]).argmin(1)
            c = np.array([pts[which == k, 0].mean() for k in (0, 1)])
        groups = [pts[which == 0], pts[which == 1]]
    for gp in groups:
        cx, cy = gp.mean(0)
        peaks.append({
            "px": [round(float(cx), 1), round(float(cy), 1)],
            "h": round(float(H(cx)), 3),
            "c": round(float(C(cy)), 2),
            "merged": len(groups) > 1,
        })
peaks.sort(key=lambda p: -p["h"])

# 顶部曲线：每一列里最靠上的蓝紫像素；左侧曲线：每一行里最靠左的蓝紫像素
top_trace = []
for x in range(LEFT + 2, RIGHT - 16):  # 右上角有一个蓝色小方块，不属于曲线
    col = np.where(ink[250:TOP - 1, x])[0]
    if len(col):
        top_trace.append([round(float(H(x)), 4), int(TOP - 4 - (250 + col.min()))])
left_trace = []
for y in range(TOP + 2, BOTTOM - 16):  # 左下角的小方框同理
    row = np.where(ink[y, 775:LEFT - 3])[0]
    if len(row):
        left_trace.append([round(float(C(y)), 3), int(LEFT - 4 - (775 + row.min()))])

out = {
    "source": "original.png",
    "frame_px": {"left": LEFT, "right": RIGHT, "top": TOP, "bottom": BOTTOM},
    "x_ticks_px": [round(v, 1) for v in x_major],
    "y_ticks_px": [round(v, 1) for v in y_major],
    "px_per_ppm": {"h": round(abs(1 / kx), 2), "c": round(abs(1 / ky), 3)},
    "calibration_residual_ppm": {"h": round(res_x, 4), "c": round(res_y, 3)},
    "frame_ppm": {"h": [round(float(H(LEFT)), 3), round(float(H(RIGHT)), 3)],
                  "c": [round(float(C(TOP)), 2), round(float(C(BOTTOM)), 2)]},
    "peaks": peaks,
    "top_trace": top_trace,
    "left_trace": left_trace,
}
(HERE / "measure.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: v for k, v in out.items() if "trace" not in k}, ensure_ascii=False, indent=1))
print("top_trace", len(top_trace), "left_trace", len(left_trace))
