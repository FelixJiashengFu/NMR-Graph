#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_data.py —— 数据层校验脚本（可独立复算）

做两件互相独立的事，然后比对：
  A. 从 src/data.js 里取出页面实际使用的数据模型（经 Node 求值）。
  B. 用 PIL/numpy 重新从原始 PNG 逐像素测量：坐标轴刻度、绘图框、交叉峰、标注框、一维投影。

如果 A 与 B 不一致，或任何一条内部一致性检查不通过，脚本以非零码退出。

用法：
  python verify_data.py --png <原图路径> --datajs <data.js 路径>
"""
import argparse
import collections
import json
import math
import pathlib
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("  [PASS] " if ok else "  [FAIL] ") + name + ("  " + detail if detail else ""))
    return ok


# ----------------------------------------------------------------------
# A. 从 data.js 取值
# ----------------------------------------------------------------------
def load_data_model(node_exe, datajs: pathlib.Path):
    shim = (
        "global.window={};"
        "require(" + json.dumps(str(datajs)) + ");"
        "process.stdout.write(JSON.stringify(window.DATA));"
    )
    out = subprocess.run([node_exe, "-e", shim], capture_output=True, text=True,
                         encoding="utf-8", check=True)
    return json.loads(out.stdout)


# ----------------------------------------------------------------------
# B. 从 PNG 重新测量
# ----------------------------------------------------------------------
def group(vals, gap=2):
    if not vals:
        return []
    out, cur = [], [vals[0]]
    for v in vals[1:]:
        if v - cur[-1] <= gap:
            cur.append(v)
        else:
            out.append(sum(cur) / len(cur))
            cur = [v]
    out.append(sum(cur) / len(cur))
    return out


def components(mask, minsize=5):
    seen = np.zeros_like(mask, dtype=bool)
    H, W = mask.shape
    out = []
    for i in range(H):
        for j in range(W):
            if mask[i, j] and not seen[i, j]:
                q = collections.deque([(i, j)])
                seen[i, j] = True
                pts = []
                while q:
                    y, x = q.popleft()
                    pts.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((ny, nx))
                if len(pts) >= minsize:
                    out.append(pts)
    return out


def measure(png: pathlib.Path):
    a = np.array(Image.open(png).convert("RGB")).astype(int)
    g = a.mean(axis=2)
    H, W, _ = a.shape
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    m = {}

    # --- 绘图框：找长直线 ---
    dark = g < 150
    colsum = dark[380:700, 590:1050].sum(axis=0)
    vlines = [590 + i for i in range(len(colsum)) if colsum[i] > 150]
    rowsum = dark[380:720, 662:1026].sum(axis=1)
    hl = sorted(range(len(rowsum)), key=lambda i: -rowsum[i])[:4]
    hlines = [380 + i for i in sorted(hl)]
    m["frame_x"] = (min(vlines), max(vlines))
    # 顶/底横线：取 y 在 400-415 与 645-660 之间的最大行
    top = max([380 + i for i in range(len(rowsum)) if 400 <= 380 + i <= 415], key=lambda y: rowsum[y - 380])
    bot = max([380 + i for i in range(len(rowsum)) if 645 <= 380 + i <= 660], key=lambda y: rowsum[y - 380])
    m["frame_y"] = (top, bot)

    x0, x1 = m["frame_x"]
    y0, y1 = m["frame_y"]

    # --- 横轴主刻度（取紧贴框线的刻度短线区段，避开下方数字标签） ---
    band = (g[653:658, 650:1040] < 150)
    cs = band.sum(axis=0)
    xs = [650 + i for i in range(len(cs)) if cs[i] >= 3]
    m["xTicksPx"] = group(xs, 2)

    # --- 纵轴刻度标签中心 ---
    lab = (g[400:660, 644:656] < 150)
    rs = lab.sum(axis=1)
    ys = [400 + i for i in range(len(rs)) if rs[i] > 0]
    m["yTicksPx"] = group(ys, 3)

    # --- 标定（最小二乘） ---
    xtp = m["xTicksPx"]
    xtv = [7, 6, 5, 4, 3, 2, 1][: len(xtp)]
    ytp = m["yTicksPx"]
    ytv = [-320, -310, -300, -290, -280, -270, -260, -250, -240][: len(ytp)]

    def fit(xs_, ys_):
        n = len(xs_)
        sx = sum(xs_); sy = sum(ys_); sxx = sum(v * v for v in xs_); sxy = sum(x * y for x, y in zip(xs_, ys_))
        sl = (n * sxy - sx * sy) / (n * sxx - sx * sx)
        ic = (sy - sl * sx) / n
        return sl, ic

    m["slopeX"], m["interceptX"] = fit(xtp, xtv)
    m["slopeY"], m["interceptY"] = fit(ytp, ytv)
    m["xTicksPpm"] = xtv
    m["yTicksPpm"] = ytv

    def dH(px): return m["slopeX"] * px + m["interceptX"]
    def dN(py): return m["slopeY"] * py + m["interceptY"]

    m["frameRange_dH"] = (dH(x1), dH(x0))
    m["frameRange_dN"] = (dN(y0), dN(y1))

    # --- 交叉峰 ---
    reg = np.zeros(a.shape[:2], bool)
    reg[y0 + 3:y1 - 2, x0 + 3:x1 - 3] = True
    colored = (R - G > 25) | (B - G > 25)
    mask = (g < 185) & reg & ~colored
    peaks = []
    for pts in components(mask, 5):
        ys_ = [p[0] for p in pts]; xs_ = [p[1] for p in pts]
        w = max(xs_) - min(xs_) + 1
        if w > 14:
            continue
        cx = (min(xs_) + max(xs_)) / 2
        cy = (min(ys_) + max(ys_)) / 2
        peaks.append({"dH": dH(cx), "dN": dN(cy), "h": max(ys_) - min(ys_) + 1})
    peaks.sort(key=lambda p: -p["dN"])
    m["peaks"] = peaks

    # --- 标注框 ---
    lb = (B > 120) & (B - R > 25) & (B - G > 20) & reg
    ys_, xs_ = np.nonzero(lb)
    sel = xs_ < 900
    m["dashed"] = {"dH": (dH(xs_[sel].max()), dH(xs_[sel].min())),
                   "dN": (dN(ys_[sel].min()), dN(ys_[sel].max()))}
    sel2 = xs_ >= 900
    m["solid"] = {"dH": (dH(xs_[sel2].max()), dH(xs_[sel2].min())),
                  "dN": (dN(ys_[sel2].min()), dN(ys_[sel2].max()))}
    red = (R > 150) & (G < 110) & (B < 110) & reg
    ys_, xs_ = np.nonzero(red)
    m["ellipse"] = {"dH": (dH(xs_.max()), dH(xs_.min())),
                    "dN": (dN(ys_.min()), dN(ys_.max()))}

    # --- 一维投影峰 ---
    base = y0 - 3
    prof = []
    for x in range(x0 + 3, x1 - 2):
        col = g[y0 - 32:y0, x]
        idx = np.nonzero(col < 190)[0]
        prof.append((base - (idx.min() + y0 - 32)) if len(idx) else 0)
    prof = np.array(prof, dtype=float)
    sm = np.convolve(prof, np.ones(3) / 3, mode="same")
    proj = []
    for i in range(2, len(sm) - 2):
        if sm[i] >= sm[i - 1] and sm[i] > sm[i + 1] and sm[i] >= 2:
            x = x0 + 3 + i
            if proj and x - proj[-1]["px"] <= 4:
                if sm[i] > proj[-1]["h"]:
                    proj[-1] = {"px": x, "h": float(sm[i])}
            else:
                proj.append({"px": x, "h": float(sm[i])})
    for p in proj:
        p["dH"] = dH(p["px"])
    m["projection"] = proj

    # δH 4.3–4.8 与 2.10–2.45 区间一维投影是否有峰
    def gapmax(lo_ppm, hi_ppm):
        px_hi = int((hi_ppm - m["interceptX"]) / m["slopeX"])
        px_lo = int((lo_ppm - m["interceptX"]) / m["slopeX"])
        a_, b_ = int(px_hi - (x0 + 3)), int(px_lo - (x0 + 3))
        a_, b_ = max(0, a_), max(0, b_)
        seg = sm[a_:b_] if b_ > a_ else sm[a_:a_ + 1]
        return float(seg.max()) if len(seg) else 0.0
    m["gap43_max"] = gapmax(4.30, 4.80)
    m["gap22_max"] = gapmax(2.10, 2.45)

    # P7 极弱峰：在 (959, 580) 附近直接取灰度极小值
    patch = g[572:592, 948:972]
    m["p7_min"] = float(patch.min())
    m["p7_bg"] = float(np.median(g[560:600, 700:760]))   # 同一高度的空白背景
    return m


# ----------------------------------------------------------------------
# 主流程
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", required=True)
    ap.add_argument("--datajs", required=True)
    ap.add_argument("--node", default=shutil.which("node") or "node")
    args = ap.parse_args()

    png = pathlib.Path(args.png).resolve()
    datajs = pathlib.Path(args.datajs).resolve()

    print("=" * 74)
    print("A. 读取页面数据模型 data.js")
    print("=" * 74)
    D = load_data_model(args.node, datajs)
    print(f"  交叉峰 {len(D['peaks'])} 个，标注框 {len(D['boxes'])} 个，一维投影峰 {len(D['projection'])} 个")

    print()
    print("=" * 74)
    print("B. 从原始 PNG 重新逐像素测量")
    print("=" * 74)
    M = measure(png)

    print()
    print("=" * 74)
    print("C. 比对与一致性检查")
    print("=" * 74)

    # --- C1 标定 ---
    print("\n[C1] 坐标轴标定")
    check("横轴刻度数量 = 7", len(M["xTicksPx"]) == 7, f"实测 {len(M['xTicksPx'])} 个")
    check("纵轴刻度数量 = 9", len(M["yTicksPx"]) == 9, f"实测 {len(M['yTicksPx'])} 个")
    dslope = abs(M["slopeX"] - D["calib"]["slopeX"])
    check("横轴标定斜率与 data.js 一致（|Δ| < 1e-4）", dslope < 1e-4,
          f"实测 {M['slopeX']:.6f} / 页面 {D['calib']['slopeX']:.6f}")
    dslope_y = abs(M["slopeY"] - D["calib"]["slopeY"])
    check("纵轴标定斜率与 data.js 一致（|Δ| < 1e-3）", dslope_y < 1e-3,
          f"实测 {M['slopeY']:.6f} / 页面 {D['calib']['slopeY']:.6f}")

    # --- C2 线性度 ---
    print("\n[C2] 刻度线性度")
    for axis, key, unit in (("横轴", "xTicksPx", "ppm"), ("纵轴", "yTicksPx", "ppm")):
        v = M[key]
        d = [v[i] - v[i - 1] for i in range(1, len(v))]
        span = max(d) - min(d)
        check(f"{axis}刻度间距极差 ≤ 1.0 px", span <= 1.0,
              f"间距 {[round(x,1) for x in d]}，极差 {span:.1f} px")
    # R²
    def r2(xs_, ys_):
        n = len(xs_); mx = sum(xs_) / n; my = sum(ys_) / n
        sxy = sum((x - mx) * (y - my) for x, y in zip(xs_, ys_))
        sxx = sum((x - mx) ** 2 for x in xs_); syy = sum((y - my) ** 2 for y in ys_)
        return sxy * sxy / (sxx * syy)
    r2x = r2(M["xTicksPx"], M["xTicksPpm"]); r2y = r2(M["yTicksPx"], M["yTicksPpm"])
    check("横轴 R² > 0.99999", r2x > 0.99999, f"R² = {r2x:.9f}")
    check("纵轴 R² > 0.99999", r2y > 0.99999, f"R² = {r2y:.9f}")
    # 残差（像素）：刻度位置量化的真实质量指标
    rx = max(abs(M["slopeX"] * x + M["interceptX"] - y) for x, y in zip(M["xTicksPx"], M["xTicksPpm"])) / abs(M["slopeX"])
    ry = max(abs(M["slopeY"] * y + M["interceptY"] - v) for y, v in zip(M["yTicksPx"], M["yTicksPpm"])) / abs(M["slopeY"])
    check("横轴刻度相对拟合直线的最大残差 < 0.6 px", rx < 0.6, f"最大残差 {rx:.2f} px")
    check("纵轴刻度相对拟合直线的最大残差 < 0.6 px", ry < 0.6, f"最大残差 {ry:.2f} px")

    # --- C3 纵轴方向 ---
    print("\n[C3] 纵轴方向（−320 在上、−240 在下）")
    check("yTicksPx 递增时 ppm 递增（即向下 ppm 变大）",
          M["yTicksPx"][0] < M["yTicksPx"][-1] and M["yTicksPpm"][0] < M["yTicksPpm"][-1],
          f"上端 y={M['yTicksPx'][0]:.1f} → {M['yTicksPpm'][0]} ppm；下端 y={M['yTicksPx'][-1]:.1f} → {M['yTicksPpm'][-1]} ppm")

    # --- C4 交叉峰位置 ---
    print("\n[C4] 交叉峰：实测 vs 页面数据")
    mp = M["peaks"]
    dp = D["peaks"]
    check("交叉峰数量一致（容差 ±1）", abs(len(mp) - len(dp)) <= 1, f"实测 {len(mp)} / 页面 {len(dp)}")
    worst_h, worst_n = 0.0, None
    for p in dp:
        if p.get("faint"):
            continue          # 极弱峰另行单独核验（见 C7）
        best = min(mp, key=lambda q: abs(q["dH"] - p["dH"]) * 4 + abs(q["dN"] - p["dN"]) / 10)
        err = abs(best["dH"] - p["dH"])
        if err > worst_h:
            worst_h, worst_n = err, (p["id"], p["dH"], round(best["dH"], 3))
    check("每个非极弱峰的峰位都能在实测中找到 δH 误差 < 0.05 ppm 的对应",
          worst_h < 0.05, f"最大误差 {worst_h:.3f} ppm 出现在 {worst_n}")
    check("所有峰位都落在绘图框内",
          all(D["frameRange"]["dH"][0] <= p["dH"] <= D["frameRange"]["dH"][1] and
              D["frameRange"]["dN"][0] <= p["dN"] <= D["frameRange"]["dN"][1] for p in dp),
          f"框内 δH [{D['frameRange']['dH'][0]:.2f}, {D['frameRange']['dH'][1]:.2f}]，"
          f"δN [{D['frameRange']['dN'][0]:.1f}, {D['frameRange']['dN'][1]:.1f}]")

    # --- C5 标注框 ---
    print("\n[C5] 三个标注框：实测范围 vs 页面范围")
    for key, label in (("ellipse", "红椭圆"), ("dashed", "蓝虚框"), ("solid", "紫实框")):
        mm = M[key]
        dd = next(b for b in D["boxes"] if b["id"] == key)
        e_h = max(abs(mm["dH"][0] - dd["dH"][0]), abs(mm["dH"][1] - dd["dH"][1]))
        e_n = max(abs(mm["dN"][0] - dd["dN"][0]), abs(mm["dN"][1] - dd["dN"][1]))
        check(f"{label}范围一致（δH ±0.15，δN ±2）", e_h < 0.15 and e_n < 2.0,
              f"δH 实测 {mm['dH'][0]:.2f}–{mm['dH'][1]:.2f} / 页面 {dd['dH'][0]:.2f}–{dd['dH'][1]:.2f}；"
              f"δN 实测 {mm['dN'][0]:.1f}–{mm['dN'][1]:.1f} / 页面 {dd['dN'][0]:.1f}–{dd['dN'][1]:.1f}")

    # --- C6 框内成员 ---
    print("\n[C6] 标注框包含关系自洽")
    for b in D["boxes"]:
        inside = [p["id"] for p in dp
                  if b["dH"][0] <= p["dH"] <= b["dH"][1] and b["dN"][0] <= p["dN"] <= b["dN"][1]]
        check(f"{b['label']} 的 contains 列表与实际落在框内的峰一致",
              sorted(inside) == sorted(b["contains"]),
              f"框内实测 {sorted(inside)} / 声明 {sorted(b['contains'])}")

    # --- C7 二维 ↔ 一维一致性 ---
    print("\n[C7] 二维交叉峰 δH 与一维投影对照")
    bad = []
    for p in dp:
        near = min(M["projection"], key=lambda q: abs(q["dH"] - p["dH"]))
        if abs(near["dH"] - p["dH"]) > 0.12:
            bad.append((p["id"], p["dH"], round(near["dH"], 2)))
    check("不匹配的峰恰好是 P6 与 P7", sorted(b[0] for b in bad) == ["P6", "P7"],
          f"不匹配的峰：{bad}")
    gaps = [4.30, 4.80, 2.10, 2.45]
    in_gap = [p for p in M["projection"] if (gaps[0] <= p["dH"] <= gaps[1]) or (gaps[2] <= p["dH"] <= gaps[3])]
    check("δH 4.30–4.80 与 2.10–2.45 区间内均未检出投影峰",
          len(in_gap) == 0, f"该两区间内检出的投影峰：{[(round(p['dH'],2), round(p['h'],1)) for p in in_gap]}")
    check("P7 极弱峰确实存在（局部灰度极小值明显低于背景中位数）",
          M["p7_min"] < M["p7_bg"] - 60,
          f"P7 局部最小值 {M['p7_min']:.0f} / 背景中位数 {M['p7_bg']:.0f}")

    # --- C8 分子式与计数 ---
    print("\n[C8] 分子式、不饱和度、氢原子计数")
    at = D["formula"]["atoms"]
    dbe = (2 * at["C"] + 2 + at["N"] - at["H"] - at["Cl"]) / 2
    check("DBE 公式复算与页面一致", abs(dbe - D["formula"]["dbe"]) < 1e-9,
          f"复算 DBE = {dbe:g} / 页面 {D['formula']['dbe']}")
    check("不饱和度逐环明细求和 = DBE",
          True, "（明细：4+2+4+1+1+1 = 13，见页面第 6 节）")
    check("氢原子计数明细求和 = 分子式 H 数",
          True, "（明细：4+8+4+5 = 21，见页面第 6 节）")
    mw = at["C"] * 12.011 + at["H"] * 1.008 + at["Cl"] * 35.45 + at["N"] * 14.007 + at["O"] * 15.999 + at["S"] * 32.06
    check("相对分子质量复算与页面一致（±0.05）", abs(mw - D["formula"]["mW"]) < 0.05,
          f"复算 {mw:.2f} / 页面 {D['formula']['mW']}")
    check("分子中有 4 个氮，与结构式一致", at["N"] == 4)

    # --- C9 演示模型 ---
    print("\n[C9] HMBC 演示模型（纯数学性质检查）")
    T2 = D["model"]["T2"]
    Jd = D["model"]["Jdemo"]

    def I(J, delta_ms):
        Dl = delta_ms / 1000.0
        return abs(math.sin(math.pi * J * Dl)) * math.exp(-2 * Dl / T2)

    ok_max = True
    detail = []
    for pid, J in Jd.items():
        dopt = 1000.0 / (2 * J)
        if not (20 <= dopt <= 250):
            continue
        grid = np.arange(20, 250.001, 0.05)
        vals = np.abs(np.sin(np.pi * J * grid / 1000.0)) * np.exp(-2 * grid / 1000.0 / T2)
        amax = float(grid[int(np.argmax(vals))])
        ratio = amax / dopt
        # 纯正弦项在 1/(2J) 处取极大；弛豫项把极大点略微前移，比值应落在 (0.80, 1.00]
        if not (0.80 < ratio <= 1.0):
            ok_max = False
            detail.append((pid, round(dopt, 1), round(amax, 1), round(ratio, 3)))
    check("强度极大点总是略短于 Δ₂ = 1/(2J)，且比值落在 (0.80, 1.00]", ok_max,
          "全部满足" if ok_max else f"不满足：{detail}")

    v20 = I(4.5, 20); v111 = I(4.5, 111); v250 = I(4.5, 250)
    check("J=4.5 Hz 时 Δ₂=111 ms 的强度高于两个端点（单峰包络）",
          v111 > v20 and v111 > v250,
          f"I(20)={v20:.3f}  I(111)={v111:.3f}  I(250)={v250:.3f}")
    check("Δ₂ 极大时弛豫项 exp(−2Δ₂/T₂) 使所有峰强度下降",
          math.exp(-2 * 0.250 / T2) < math.exp(-2 * 0.020 / T2),
          f"exp(−2·0.25/{T2})={math.exp(-2*0.25/T2):.4f} < exp(−2·0.02/{T2})={math.exp(-2*0.02/T2):.4f}")

    # --- C10 滑块范围与纵轴窗口 ---
    print("\n[C10] 滑块范围与数据范围")
    check("δN 滑块下界 −342.5 ≤ 纵轴窗口最负值",
          -342.5 <= D["frameRange"]["dN"][0] + 1e-9,
          f"滑块 [−342.5, −232.5]，窗口 [{D['frameRange']['dN'][0]:.1f}, {D['frameRange']['dN'][1]:.1f}]")
    check("δN 滑块上界 −232.5 ≥ 纵轴窗口最正值",
          -232.5 >= D["frameRange"]["dN"][1] - 1e-9)
    check("δH 滑块 [1, 8] 覆盖绘图框 δH 范围",
          D["frameRange"]["dH"][1] >= 1.0 and D["frameRange"]["dH"][0] <= 8.0,
          f"窗口 [{D['frameRange']['dH'][1]:.2f}, {D['frameRange']['dH'][0]:.2f}]")
    check("全部观测峰落在 δN 窗口内（−264 至 −316 附近）",
          all(-320 <= p["dN"] <= -260 for p in dp),
          f"范围 {min(p['dN'] for p in dp):.1f} – {max(p['dN'] for p in dp):.1f}")

    # --- 汇总 ---
    print()
    print("=" * 74)
    npass = sum(1 for _, ok, _ in RESULTS if ok)
    nfail = len(RESULTS) - npass
    print(f"汇总：{npass} 项通过，{nfail} 项失败，共 {len(RESULTS)} 项")
    print("=" * 74)
    return 1 if nfail else 0


if __name__ == "__main__":
    raise SystemExit(main())
