# -*- coding: utf-8 -*-
"""
原材料谱图几何测量：定位坐标框、刻度线、交叉峰斑点。
只测量，不修改原图。
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")


def gray(path):
    return np.asarray(Image.open(path).convert("L"), dtype=np.float64)


def longest_run(vec, thr):
    idx = np.flatnonzero(vec < thr)
    if idx.size == 0:
        return 0, None, None
    sp = np.flatnonzero(np.diff(idx) > 1)
    st = np.concatenate(([0], sp + 1))
    en = np.concatenate((sp, [idx.size - 1]))
    best = max(zip(st, en), key=lambda t: idx[t[1]] - idx[t[0]])
    return int(idx[best[1]] - idx[best[0]] + 1), int(idx[best[0]]), int(idx[best[1]])


def find_hlines(g, x0, x1, thr=170, minlen=200):
    out = []
    for y in range(g.shape[0]):
        L, a, b = longest_run(g[y, x0:x1], thr)
        if L >= minlen:
            out.append({"y": y, "len": L, "x_start": x0 + a, "x_end": x0 + b})
    return out


def find_vlines(g, y0, y1, thr=170, minlen=150):
    out = []
    for x in range(g.shape[1]):
        L, a, b = longest_run(g[y0:y1, x], thr)
        if L >= minlen:
            out.append({"x": x, "len": L, "y_start": y0 + a, "y_end": y0 + b})
    return out


def ticks_h(g, y0, y1, x0, x1, thr=170):
    """在水平带内找竖直刻度线（返回每个刻度的中心 x）。"""
    cols = []
    for x in range(x0, x1):
        seg = g[y0:y1, x]
        if (seg < thr).sum() >= max(3, int((y1 - y0) * 0.5)):
            cols.append(x)
    return group(cols)


def ticks_v(g, x0, x1, y0, y1, thr=170):
    rows = []
    for y in range(y0, y1):
        seg = g[y, x0:x1]
        if (seg < thr).sum() >= max(3, int((x1 - x0) * 0.5)):
            rows.append(y)
    return group(rows)


def group(vals):
    if not vals:
        return []
    out, cur = [], [vals[0]]
    for v in vals[1:]:
        if v - cur[-1] <= 2:
            cur.append(v)
        else:
            out.append(float(np.mean(cur)))
            cur = [v]
    out.append(float(np.mean(cur)))
    return out


def blobs(g, box, thr=150, min_px=3, max_px=4000):
    x0, y0, x1, y1 = box
    sub = g[y0:y1, x0:x1]
    mask = sub < thr
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    res = []
    for j in range(h):
        for i in range(w):
            if not mask[j, i] or seen[j, i]:
                continue
            stack = [(j, i)]
            seen[j, i] = True
            pts = []
            while stack:
                cy, cx = stack.pop()
                pts.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            if min_px <= len(pts) <= max_px:
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                res.append({"x": round(x0 + float(np.mean(xs)), 1),
                            "y": round(y0 + float(np.mean(ys)), 1),
                            "n": len(pts),
                            "w": int(max(xs) - min(xs) + 1),
                            "h": int(max(ys) - min(ys) + 1)})
    res.sort(key=lambda d: -d["n"])
    return res


if __name__ == "__main__":
    rep = {}

    # ---------- HMBC ----------
    g = gray(os.path.join(ASSETS, "original-hmbc.png"))
    hl = find_hlines(g, 646, 1010, minlen=300)
    vl = find_vlines(g, 300, 660, minlen=200)
    print("HMBC 水平长线:", [(d["y"], d["len"], d["x_start"], d["x_end"]) for d in hl])
    print("HMBC 垂直长线:", [(d["x"], d["len"], d["y_start"], d["y_end"]) for d in vl])
    rep["hmbc_hlines"] = hl
    rep["hmbc_vlines"] = vl

    # ---------- HSQC ----------
    g2 = gray(os.path.join(ASSETS, "original-hsqc.png"))
    hl2 = find_hlines(g2, 636, 956, minlen=250)
    vl2 = find_vlines(g2, 118, 416, minlen=200)
    print("HSQC 水平长线:", [(d["y"], d["len"], d["x_start"], d["x_end"]) for d in hl2])
    print("HSQC 垂直长线:", [(d["x"], d["len"], d["y_start"], d["y_end"]) for d in vl2])
    rep["hsqc_hlines"] = hl2
    rep["hsqc_vlines"] = vl2

    with open(os.path.join(ROOT, "verify", "image_geometry.json"), "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False)
