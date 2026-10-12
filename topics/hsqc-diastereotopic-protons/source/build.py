#!/usr/bin/env python3
"""由 page.html、ink.css、hsqc.js、measure.json 和 original.png 生成上一级的单文件 index.html。

运行：python3 build.py
正文里写死的数字会和 measure.json 核对，对不上就拒绝构建。
"""
import base64
import json
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
m = json.loads((HERE / "measure.json").read_text(encoding="utf-8"))
page = (HERE / "page.html").read_text(encoding="utf-8")


def rnd(v, places):
    return str(Decimal(str(v)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


peaks = m["peaks"]  # 已按氢位移从大到小排好
assert len(peaks) == 5, "应当正好量出五个交叉峰"
# 哪些点同在一个碳上：按纵坐标分行（推断，见 README）
groups = {"甲": [0, 2], "乙": [3, 4], "丙": [1]}
rows = {}
for key, idx in groups.items():
    cs = [peaks[i]["c"] for i in idx]
    assert max(cs) - min(cs) < 0.15, f"碳{key} 的两个点纵坐标不齐：{cs}"
    c = sum(cs) / len(cs)
    rows[key] = {"c": round(c, 3), "cs": rnd(c, 1)}
assert 0.3 < rows["乙"]["c"] - rows["甲"]["c"] < 0.6, "甲、乙两行应相差约 0.4 ppm"

data = {
    "h": m["frame_ppm"]["h"],
    "peaks": [{"h": p["h"], "c": p["c"], "hs": rnd(p["h"], 2), "px": p["px"]} for p in peaks],
    "rows": rows,
    "top": m["top_trace"][::2],
    "left": m["left_trace"][::2],
}

# 正文里出现的数字必须和估读值一致
h = [p["h"] for p in peaks]
expect = {
    "五个氢位移": [rnd(v, 2) for v in h],
    "三个碳位移": [rows[k]["cs"] for k in ("甲", "乙", "丙")],
    "碳甲两氢之差": [rnd(h[0] - h[2], 2)],
    "碳乙两氢之差": [rnd(h[3] - h[4], 2)],
    "2.88 与 2.82 之差": [rnd(h[2] - h[3], 2)],
}
assert expect["五个氢位移"] == ["3.47", "2.94", "2.88", "2.82", "2.69"], expect
assert expect["三个碳位移"] == ["49.7", "50.2", "59.8"], expect
assert expect["碳甲两氢之差"] == ["0.58"] and expect["碳乙两氢之差"] == ["0.13"], expect
assert expect["2.88 与 2.82 之差"] == ["0.07"], expect
for name, values in expect.items():
    for v in values:
        assert v in page, f"正文里找不到 {name} 的数值 {v}"
assert abs((rows["丙"]["c"] - rows["甲"]["c"]) - 10) < 0.6, "碳丙应比碳甲高约 10 ppm"

png = base64.b64encode((HERE / "original.png").read_bytes()).decode("ascii")
parts = {
    "/*__CSS__*/": (HERE / "ink.css").read_text(encoding="utf-8").strip(),
    "/*__JS__*/": (HERE / "hsqc.js").read_text(encoding="utf-8").strip(),
    "/*__MEASURE__*/null": json.dumps(data, ensure_ascii=False, separators=(",", ":")),
    "/*__ORIGINAL__*/": "data:image/png;base64," + png,
}
for mark, text in parts.items():
    assert page.count(mark) == 1, f"模板里应当正好有一处 {mark}"
    page = page.replace(mark, text)

out = HERE.parent / "index.html"
out.write_text(page, encoding="utf-8")
print(f"built {out.name}: {len(page.encode('utf-8')) / 1024:.0f} KB")
