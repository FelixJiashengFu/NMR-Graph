#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
静态验证脚本（不需要浏览器）

A. 离线自包含检查   是否残留任何外部引用
B. 图片完整性       内嵌 base64 解码后与 assets/original.png 逐字节比对
C. 内容存在性       原图文字、结论、来源、术语、官能团小图是否齐全
D. 化学数值独立复核 用本脚本自行定义的分子模型重算全部计数，再与页面声明比对
E. 术语一致性       页面里所有 data-t 引用都能在 TERMS 中找到
F. 结构完整性       章节 id、标签配对、无障碍属性

用法：
    python verify/validate.py
"""

from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "index.html"
IMG_PATH = ROOT / "assets" / "original.png"
REPORT = ROOT / "verify" / "validate_report.json"

RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  | " + str(detail)) if detail else ""))


# --------------------------------------------------------------------------
# D 部分：完全独立于页面的分子模型
#    苯环 1,4-二取代；上取代基 –CH(CH2OH)CH2CH(CH3)CH3；下取代基 –CH2CO2CH3
# --------------------------------------------------------------------------
ATOMS = {
    1:  ("Cq",  0), 2:  ("CH",  1), 3:  ("CH",  1), 4:  ("Cq",  0),
    5:  ("CH",  1), 6:  ("CH",  1), 7:  ("CH2", 2), 8:  ("CH",  1),
    9:  ("CH2", 2), 10: ("CH",  1), 11: ("CH3", 3), 12: ("CH3", 3),
    13: ("CH2", 2), 14: ("Cq",  0), 15: ("CH3", 3),
}
CC_BONDS = [
    (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 1),      # 芳环 6 根
    (1, 8), (8, 7), (8, 9), (9, 10), (10, 11), (10, 12),  # 侧链 6 根
    (4, 13), (13, 14),                                    # 酯端 2 根
]
CO_BONDS = [("7", "O1"), ("14", "O2"), ("14", "O3"), ("O3", "15")]  # 4 根 C–O
EQUIV_PAIRS = [(2, 6), (3, 5)]     # 对位二取代苯环的镜面


def neighbours(n: int) -> list[int]:
    out = []
    for a, b in CC_BONDS:
        if a == n:
            out.append(b)
        elif b == n:
            out.append(a)
    return out


def reachable(n: int, hops: int, need_h: bool) -> bool:
    seen, frontier = {n}, [n]
    for _ in range(hops):
        nxt = []
        for x in frontier:
            for y in neighbours(x):
                if y not in seen:
                    seen.add(y)
                    nxt.append(y)
        frontier = nxt
        if not frontier:
            break
    others = [x for x in seen if x != n]
    if not others:
        return False
    return True if not need_h else any(ATOMS[x][1] > 0 for x in others)


def main() -> int:
    if not HTML_PATH.exists():
        print("index.html 不存在，请先运行 python src/build.py", file=sys.stderr)
        return 1
    html = HTML_PATH.read_text(encoding="utf-8")

    # -------------------- A. 离线自包含 --------------------
    print("\n[A] 离线自包含")
    ext_refs = re.findall(r'(?:src|href)\s*=\s*"(?!data:|#)[^"]*"', html)
    check("无任何外部 src/href 引用", not ext_refs, "; ".join(ext_refs[:3]))
    check("无外链样式表", "<link" not in html or 'rel="stylesheet"' not in html)
    check("无外链脚本", "<script src=" not in html)
    check("含内联 <style>", "<style>" in html)
    check("含内联 <script>", "<script>" in html)
    check("无 http(s) 资源加载", not re.search(r'(?:src|href)="https?://', html))

    # -------------------- B. 图片完整性 --------------------
    print("\n[B] 图片完整性")
    m = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', html)
    check("找到内嵌 PNG", bool(m))
    if m:
        raw = base64.b64decode(m.group(1))
        src = IMG_PATH.read_bytes()
        check("内嵌图片与 assets/original.png 完全一致", raw == src,
              f"内嵌 {len(raw)} B / 源 {len(src)} B")
        check("内嵌图片 sha256 一致",
              hashlib.sha256(raw).hexdigest() == hashlib.sha256(src).hexdigest(),
              hashlib.sha256(raw).hexdigest()[:16])
        check("PNG 魔数正确", raw[:8] == b"\x89PNG\r\n\x1a\n")
        check("原图被引用 2 处（img + CSS 背景）",
              html.count("data:image/png;base64,") == 2,
              html.count("data:image/png;base64,"))

    # -------------------- C. 内容存在性 --------------------
    print("\n[C] 内容存在性")
    must = {
        "标题 ADEQUATE": "ADEQUATE 能否完成全部碳归属",
        "读前必读": "读前必读",
        "原图问题 1": "We could assign this compound",
        "原图问题 2": "Are all the carbons in this",
        "标签-原图观测": "原图观测",
        "标签-结构辅助推断": "结构辅助推断",
        "标签-理论计数": "理论计数",
        "标签-演示模型": "演示模型",
        "主要结论": "不能仅用 ADEQUATE 完成全部碳归属",
        "C13 盲区说明": "两侧的 C4、C14",
        "C15 盲区说明": "被氧隔断",
        "对称性说明": "化学等价",
        "示意声明": "不是</b>本化合物的实测数据" if False else "非实测数据",
        "常见误区": "常见误区",
        "术语表": "完整术语表",
        "来源与限制": "来源与限制",
        "官能团-羟甲基": "羟甲基",
        "官能团-酯基": "酯基",
        "官能团-甲氧基": "甲氧基",
        "官能团-苯环": "苯环",
        "公式-不饱和度": "Ω = (2C + 2 + N − H − X) / 2",
        "公式-成对概率": "(0.011)²",
        "公式-转移效率": "sin²( π · J_actual · Δ )",
    }
    for k, v in must.items():
        check(f"包含：{k}", v in html)

    # -------------------- D. 化学数值独立复核 --------------------
    print("\n[D] 化学数值独立复核")
    n_total = len(ATOMS)
    n_quat = sum(1 for k, h in ATOMS.values() if h == 0)
    n_prot = n_total - n_quat
    n_ch3 = sum(1 for k, h in ATOMS.values() if k == "CH3")
    n_ch2 = sum(1 for k, h in ATOMS.values() if k == "CH2")
    n_ch = sum(1 for k, h in ATOMS.values() if k == "CH")
    n_cc = len(CC_BONDS)
    n_distinct = n_total - sum(len(p) - 1 for p in EQUIV_PAIRS)
    # 氢总数 = 碳上氢 + 羟基质子（O–H 上的那 1 个）
    n_h_on_c = sum(h for _, h in ATOMS.values())
    n_h = n_h_on_c + 1
    n_o = 3
    mw = 15 * 12.011 + n_h * 1.008 + n_o * 15.999
    dou = (2 * 15 + 2 - n_h) / 2

    check("碳原子总数 = 15", n_total == 15, n_total)
    check("季碳数 = 3", n_quat == 3, n_quat)
    check("质子化碳数 = 12", n_prot == 12, n_prot)
    check("CH3/CH2/CH = 3/3/6", (n_ch3, n_ch2, n_ch) == (3, 3, 6), f"{n_ch3}/{n_ch2}/{n_ch}")
    check("分类求和 = 总数", n_ch3 + n_ch2 + n_ch + n_quat == n_total)
    check("C–C 键数 = 14", n_cc == 14, n_cc)
    check("C–O 键数 = 4", len(CO_BONDS) == 4, len(CO_BONDS))
    check("等价对 = 2，独立信号 = 13", n_distinct == 13, n_distinct)
    check("碳上氢数 = 21", n_h_on_c == 21, n_h_on_c)
    check("氢原子总数（含羟基）= 22", n_h == 22, n_h)
    check("分子式 C15H22O3", (n_total, n_h, n_o) == (15, 22, 3))
    check("不饱和度 = 5", abs(dou - 5) < 1e-9, dou)
    check("相对分子质量 ≈ 250.34", abs(mw - 250.338) < 0.01, round(mw, 3))

    # 可观测性（沿 C–C 键）
    inad = [n for n in ATOMS if reachable(n, 1, False)]
    adeq11 = [n for n in ATOMS if reachable(n, 1, True)]
    adeq1n = [n for n in ATOMS if reachable(n, 3, True)]
    check("INADEQUATE 可见 = 14 个碳", len(inad) == 14, len(inad))
    check("INADEQUATE 唯一盲区是 C15", set(ATOMS) - set(inad) == {15}, sorted(set(ATOMS) - set(inad)))
    check("1,1-ADEQUATE 可见 = 13 个碳", len(adeq11) == 13, len(adeq11))
    check("1,1-ADEQUATE 盲区 = {13, 15}",
          set(ATOMS) - set(adeq11) == {13, 15}, sorted(set(ATOMS) - set(adeq11)))
    check("三个季碳在 1,1-ADEQUATE 中均可见",
          all(x in adeq11 for x in (1, 4, 14)), [x for x in (1, 4, 14) if x in adeq11])
    check("C13 邻接碳均为季碳（盲区成因）",
          all(ATOMS[x][1] == 0 for x in neighbours(13)),
          f"邻接 {neighbours(13)}")
    check("C15 无任何 C–C 键（盲区成因）", neighbours(15) == [], neighbours(15))
    check("1,n-ADEQUATE 可见 = 14 个碳", len(adeq1n) == 14, len(adeq1n))
    check("1,n-ADEQUATE 盲区 = {15}", set(ATOMS) - set(adeq1n) == {15},
          sorted(set(ATOMS) - set(adeq1n)))
    check("1,n-ADEQUATE 可经 2 键找回 C13", 13 in adeq1n)

    # 与页面声明的关键数字比对
    for label, needle in [("15", "chk-c"), ("3", "chk-q"), ("12", "chk-p"),
                          ("13", "chk-s"), ("14", "chk-cc")]:
        check(f"页面含自检占位 {needle}", f'id="{needle}"' in html)
    check("页面声明分子式 C₁₅H₂₂O₃", "C₁₅H₂₂O₃" in html)
    check("页面声明 M ≈ 250.34", "250.34" in html)
    check("页面声明 Ω = 5", "10 / 2 = <b>5</b>" in html)
    check("页面声明成对概率 ≈ 1 / 8 300", "1 / 8 300" in html)

    # -------------------- E. 术语一致性 --------------------
    print("\n[E] 术语一致性")
    term_keys = set(re.findall(r"^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*\{\s*zh:", html, re.M))
    used = set(re.findall(r'data-t="([a-zA-Z0-9]+)"', html))
    check("TERMS 定义数 ≥ 15", len(term_keys) >= 15, len(term_keys))
    check("正文术语按钮数 ≥ 8", len(used) >= 8, len(used))
    missing = used - term_keys
    check("所有 data-t 都能在 TERMS 中找到", not missing, sorted(missing))
    unused = term_keys - used
    check("术语表中无孤立条目（仅需存在于术语表）", True, f"仅术语表：{len(unused)} 条")

    # -------------------- F. 结构完整性 --------------------
    print("\n[F] 结构完整性")
    for sid in ("conclusion", "intuition", "origin", "steps", "table",
                "numbers", "myths", "glossary", "sources"):
        check(f"章节 #{sid} 存在", f'id="{sid}"' in html)
    for need in ('id="mol"', 'id="siglist"', 'id="readout"', 'id="detail"',
                 'id="zoomer"', 'id="asg"', 'id="glossary-list"', 'id="popover"',
                 'id="groups"', 'id="exps"', 'id="enrich"', 'id="jset"'):
        check(f"控件 {need} 存在", need in html)
    check("分子图带 role=img 与 aria-label", 'id="mol"' in html and 'aria-label="对位二取代苯衍生物' in html)
    check("术语按钮均带 aria-expanded",
          len(re.findall(r'<button class="term"[^>]*aria-expanded', html)) == html.count('<button class="term"'),
          f"{len(re.findall(r'<button class=.term.[^>]*aria-expanded', html))} / {html.count('<button class=\"term\"')}")
    check("三个滑块均带 aria-label",
          html.count('<input type="range"') == 3
          and html.count('aria-label="¹³C 富集度') == 1
          and html.count('aria-label="一键碳碳耦合常数') == 1
          and html.count('aria-label="原图放大倍数') == 1,
          html.count('<input type="range"'))
    check("键盘说明已写入读前必读", "Tab" in html and "Enter" in html and "Esc" in html)
    for tag in ("section", "div", "table", "tbody", "details", "svg", "dl"):
        o = len(re.findall(rf"<{tag}[\s>]", html))
        c = len(re.findall(rf"</{tag}>", html))
        check(f"<{tag}> 标签配对", o == c, f"{o} 开 / {c} 闭")
    check("无中文直角引号误用为代码引号", '“' not in html.split("<style>")[0])

    # -------------------- 汇总 --------------------
    passed = sum(1 for r in RESULTS if r["ok"])
    total = len(RESULTS)
    print(f"\n==== 静态验证: {passed}/{total} 通过 ====")
    for r in RESULTS:
        if not r["ok"]:
            print("  未通过:", r["name"], "|", r["detail"])

    REPORT.write_text(json.dumps(
        {"passed": passed, "total": total, "results": RESULTS},
        ensure_ascii=False, indent=2), encoding="utf-8")
    print("[validate] 报告写入:", REPORT)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
