#!/usr/bin/env python3
"""由 page.html 生成上一级的单文件 index.html，并核对正文里写死的数字。

运行：python3 build.py
谱线频率取自题图标注；单峰位置、积分台阶和放大区峰高取自 measure.json（先运行 measure.py）。
任何一处数字对不上就拒绝构建。
"""
import json
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
NU0 = 250.13
QUARTET_HZ = [1045.29, 1038.14, 1030.99, 1023.86]
TRIPLET_HZ = [325.60, 318.48, 311.31]
m = json.loads((HERE / "measure.json").read_text(encoding="utf-8"))
page = (HERE / "page.html").read_text(encoding="utf-8")


def rnd(v, places):
    return str(Decimal(str(v)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def gaps(lines):
    return [lines[i] - lines[i + 1] for i in range(len(lines) - 1)]


g = gaps(QUARTET_HZ) + gaps(TRIPLET_HZ)
J = sum(g) / len(g)
dnu = sum(QUARTET_HZ) / 4 - sum(TRIPLET_HZ) / 3
steps = m["integral_steps_px"]
qh, th = m["inset_quartet"]["heights_px"], m["inset_triplet"]["heights_px"]

expect = {
    "相邻差值": [rnd(v, 2) for v in g],
    "平均 J": [rnd(J, 3), rnd(J, 2)],
    "外线法": [rnd((QUARTET_HZ[0] - QUARTET_HZ[-1]) / 3, 3), rnd((TRIPLET_HZ[0] - TRIPLET_HZ[-1]) / 2, 3)],
    "δ = ν/ν0": [rnd(v / NU0, 4) for v in QUARTET_HZ + TRIPLET_HZ],
    "两组中心间距": [rnd(dnu, 1)],
    "单峰位置": [rnd(m["singlet"]["delta_ppm"], 2)],
    "积分台阶": [rnd(steps[s], 0) for s in "abc"],
    "积分比": [rnd(steps["b"] / steps["a"], 2), rnd(steps["c"] / steps["a"], 2)],
    "四重峰峰高比": [" : ".join(rnd(v, 2) for v in m["inset_quartet"]["relative"])],
    "三重峰峰高比": [" : ".join(rnd(v, 2) for v in m["inset_triplet"]["relative"])],
    "屋顶效应": [f"{rnd(qh[-1], 0)} px 对 {rnd(qh[0], 0)} px", f"{rnd(th[0], 0)} px 对 {rnd(th[-1], 0)} px"],
    "刻度": [rnd(m["axis"]["px_per_ppm"], 1) + " px/ppm"],
}
assert expect["相邻差值"] == ["7.15", "7.15", "7.13", "7.12", "7.17"], expect
assert expect["平均 J"] == ["7.144", "7.14"], expect
assert expect["外线法"] == ["7.143", "7.145"], expect
assert expect["单峰位置"] == ["2.06"], expect
assert expect["积分台阶"] == ["359", "538", "541"], expect
assert round(dnu / J) == 100, "Δν/J 应约为 100"
for check, key in (("quartet", "四重峰中心"), ("triplet", "三重峰中心")):
    c = m["calibration_check"]
    err = abs(c[f"{check}_centre_ppm_from_px"] - c[f"{check}_centre_ppm_from_hz"])
    assert err < 0.003, f"{key}的像素定标误差 {err:.4f} ppm 超过页面声明的 ±0.003"
for name, values in expect.items():
    for v in values:
        assert v in page, f"正文里找不到 {name} 的数值 {v}"

marker = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">'
assert page.count(marker) == 1, "模板里应当正好有一处滤镜定义"
head, body = page.split(marker)
# 独立网页：去掉只对 Claude Artifact 有意义的 meta，标题补上专题说明
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "")
assert head.count("<title>观谱识物</title>") == 1
head = head.replace("<title>观谱识物</title>", "<title>观谱识物 · C₄H₈O₂ 的氢谱与耦合常数</title>")
html = (
    "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
    + head.strip() + "\n</head>\n<body>\n" + marker + body.rstrip() + "\n</body>\n</html>\n"
)
out = HERE.parent / "index.html"
out.write_text(html, encoding="utf-8")
print(f"built {out.name}: {len(html.encode('utf-8')) / 1024:.0f} KB; 核对 {sum(len(v) for v in expect.values())} 处数字")
