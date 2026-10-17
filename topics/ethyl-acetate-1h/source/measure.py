#!/usr/bin/env python3
"""从题图 original.webp 的像素估读：主谱刻度定标、单峰位置、积分台阶高度、放大区峰高。

运行：python3 measure.py  → 写出同目录下的 measure.json（需要 Pillow、NumPy）。
谱线频率（Hz）是题图上的文字标注，不在这里估读；这里只用它们检查定标。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
NU0 = 250.13  # MHz
QUARTET_HZ = [1045.29, 1038.14, 1030.99, 1023.86]
TRIPLET_HZ = [325.60, 318.48, 311.31]

img = np.asarray(Image.open(HERE / "original.webp").convert("RGB")).astype(int)
H, W, _ = img.shape
R, G, B = img[..., 0], img[..., 1], img[..., 2]
orange = (R > 200) & (G > 90) & (G < 200) & (B < 110) & (R - B > 120)  # 积分曲线
blue = (B > 150) & (R < 120) & (B - R > 70)                             # 四重峰
green = (G > 120) & (R < 130) & (G - R > 40) & (G - B > 10)             # 三重峰
black = (R < 90) & (G < 90) & (B < 90)                                  # 单峰
dark = (R < 140) & (G < 140) & (B < 140)                                # 刻度线


def centres(xs):
    runs = []
    for x in xs:
        if runs and x - runs[-1][-1] <= 1:
            runs[-1].append(int(x))
        else:
            runs.append([int(x)])
    return [float(np.mean(r)) for r in runs]


# 1. 主刻度：轴线下方的长刻度线，自左向右依次是 4.5, 4.0, …, 1.0 ppm（去掉图框右边线）
ticks = [x for x in centres(np.nonzero(dark[1020, :])[0]) if x < W - 10]
labels = [4.5 - 0.5 * i for i in range(len(ticks))]
k, b = np.polyfit(ticks, labels, 1)  # δ = k·x + b
resid = float(np.max(np.abs(np.polyval([k, b], ticks) - labels)))


def ppm(x):
    return float(k * x + b)


# 2. 主谱峰顶的横坐标
def apexes(mask, x0, x1, y0, y1, n):
    tops = []
    for c in range(x0, x1):
        ys = np.nonzero(mask[y0:y1, c])[0]
        tops.append(int(ys.min()) + y0 if len(ys) else 10**6)
    found = []
    for i in np.argsort(tops, kind="stable"):
        x = int(i) + x0
        if all(abs(x - f[0]) > 6 for f in found):
            found.append((x, tops[int(i)]))
        if len(found) == n:
            break
    return sorted(found)


singlet = apexes(black, 1150, 1260, 230, 1000, 1)[0]
quartet = apexes(blue, 160, 240, 700, 960, 4)
triplet = apexes(green, 1560, 1630, 500, 960, 3)
q_px = float(np.mean([a[0] for a in quartet]))
t_px = float(np.mean([a[0] for a in triplet]))


# 3. 积分台阶：每段橙色曲线左端（下平台）与右端（上平台）的高度差
def step(x0, x1):
    sub = orange[300:1000, x0:x1]
    cols = [c for c in range(sub.shape[1]) if sub[:, c].any()]
    low = float(np.median([np.nonzero(sub[:, c])[0].max() for c in cols[:6]]))
    high = float(np.median([np.nonzero(sub[:, c])[0].min() for c in cols[-6:]]))
    return low - high


steps = {"a": step(100, 240), "b": step(1120, 1240), "c": step(1500, 1620)}


# 4. 放大区峰高：基线取左侧平坦段，峰顶取各线附近的最高像素
def inset(mask, approx, base_cols):
    base = float(np.median([np.nonzero(mask[800:900, c])[0].max() + 800 for c in base_cols if mask[800:900, c].any()]))
    heights = []
    for ax in approx:
        top = min(int(np.nonzero(mask[380:900, c])[0].min()) + 380 for c in range(ax - 12, ax + 13) if mask[380:900, c].any())
        heights.append(base - top)
    return base, heights


qb, qh = inset(blue, [326, 393, 460, 525], range(285, 300))
tb, th = inset(green, [1727, 1793, 1860], range(1668, 1685))
q_outer = (qh[0] + qh[-1]) / 2
t_outer = (th[0] + th[-1]) / 2

out = {
    "image": {"width": W, "height": H},
    "axis": {
        "tick_px": ticks,
        "tick_ppm": labels,
        "px_per_ppm": round(-1 / k, 2),
        "max_residual_ppm": round(resid, 4),
    },
    "calibration_check": {
        "quartet_centre_ppm_from_px": round(ppm(q_px), 4),
        "quartet_centre_ppm_from_hz": round(float(np.mean(QUARTET_HZ)) / NU0, 4),
        "triplet_centre_ppm_from_px": round(ppm(t_px), 4),
        "triplet_centre_ppm_from_hz": round(float(np.mean(TRIPLET_HZ)) / NU0, 4),
    },
    "singlet": {"apex_px": list(singlet), "delta_ppm": round(ppm(singlet[0]), 4)},
    "integral_steps_px": steps,
    "integral_ratio_min1": {s: round(v / min(steps.values()), 3) for s, v in steps.items()},
    "inset_quartet": {"baseline_px": qb, "heights_px": qh, "relative": [round(h / q_outer, 3) for h in qh]},
    "inset_triplet": {"baseline_px": tb, "heights_px": th, "relative": [round(h / t_outer, 3) for h in th]},
}
(HERE / "measure.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(out, ensure_ascii=False, indent=1))
