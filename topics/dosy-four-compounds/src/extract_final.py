# -*- coding: utf-8 -*-
"""数据提取（可复现）：对原图做像素标定 + 颜色连通域检测 + 一维谱峰检测。

用法：
    python extract_final.py [原图路径] [输出 json 路径]
默认读取  ../assets/original_dosy_slide.png
输出      ../verify/data_extracted.json
"""
import json
import os
import sys

import numpy as np
from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_HERE, "..", "assets", "original_dosy_slide.png")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(_HERE, "..", "verify", "data_extracted.json")
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)

a = np.asarray(Image.open(SRC).convert("RGB")).astype(int)
H, W, _ = a.shape
R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]

# ---------- 标定（由刻度标签中心拟合） ----------
X_50, X_00 = 651.5, 984.7        # 5.0 ppm 与 0.0 ppm 的像素 x
Y_0, Y_20 = 398.5, 603.7         # 0 与 20 的像素 y
PX_PER_PPM = (X_00 - X_50) / 5.0  # 66.64 px per ppm（δH 随 x 增大而减小）
PX_PER_D   = (Y_20 - Y_0) / 20.0  # 10.26 px per unit（D 随 y 增大而增大）
def ppm(x): return 5.0 - (x - X_50) / PX_PER_PPM
def D(y):   return (y - Y_0) / PX_PER_D

inner = np.zeros((H, W), bool); inner[404:600, 658:1011] = True

masks = {
    "blue":  (B > 170) & (R < 150) & (G < 150) & (np.abs(R - G) < 60),
    "green": (G > 170) & (R < 160) & (B < 160),
    "red":   (R > 170) & (G < 130) & (B < 130),
    "black": (R < 95) & (G < 95) & (B < 95),
}

def blobs(mask, min_px=3):
    m = mask.copy(); seen = np.zeros_like(m, bool); out = []
    ys, xs = np.where(m)
    for yy, xx in zip(ys.tolist(), xs.tolist()):
        if seen[yy, xx]: continue
        st = [(yy, xx)]; seen[yy, xx] = True; comp = []
        while st:
            cy, cx = st.pop(); comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; st.append((ny, nx))
        if len(comp) >= min_px:
            out.append((sum(p[1] for p in comp)/len(comp),
                        sum(p[0] for p in comp)/len(comp), len(comp)))
    return sorted(out)

pts = {}
for name, m in masks.items():
    pts[name] = [{"px": round(cx, 1), "py": round(cy, 1), "area": n,
                  "ppm": round(ppm(cx), 2), "D": round(D(cy), 2)}
                 for cx, cy, n in blobs(m & inner)]

# ---------- 一维谱峰 ----------
dark = (R < 140) & (G < 140) & (B < 140)
BASE, TOP, X0, X1 = 393, 320, 655, 1012
tr = []
for x in range(X0, X1):
    col = np.where(dark[TOP:BASE, x])[0]
    tr.append((BASE - (TOP + col.min())) if len(col) else 0)
peaks = []
for i in range(3, len(tr)-3):
    if tr[i] >= 6 and tr[i] == max(tr[i-4:i+5]):
        if peaks and abs(ppm(X0+i) - peaks[-1][0]) < 0.12:
            if tr[i] > peaks[-1][1]: peaks[-1] = (round(ppm(X0+i), 2), int(tr[i]))
        else:
            peaks.append((round(ppm(X0+i), 2), int(tr[i])))

data = {
    "source": "clipboard-2026-10-11T00-50-56-340Z-2df169a5.png",
    "source_size": [W, H],
    "calibration": {"X_5.0ppm": X_50, "X_0.0ppm": X_00, "Y_0": Y_0, "Y_20": Y_20,
                    "px_per_ppm": round(PX_PER_PPM, 3), "px_per_Dunit": round(PX_PER_D, 3),
                    "plot_box_px": [653, 399, 1014, 604]},
    "points": pts,
    "spectrum_1d_peaks": peaks,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(json.dumps(data, ensure_ascii=False, indent=2))
