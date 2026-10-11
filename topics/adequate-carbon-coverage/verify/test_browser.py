#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
浏览器端验证脚本（Playwright + 系统 Edge/Chrome，不下载额外浏览器）

覆盖：
  A. 加载与错误        控制台错误、页面异常、外部请求
  B. 结构完整性        SVG 碳节点数、信号行数、表格行数、术语条目数
  C. 交互             对象选择、碳原子点击、实验切换、两个滑块、术语注释、原图缩放
  D. 键盘可访问性      Tab 聚焦、Enter 激活、Esc 关闭
  E. 响应式与溢出      1440 / 390 / 360 三种宽度下横向溢出、标签裁切
  F. 理论自检          用页面暴露的 API 复核可观测性判定与计数
  G. 截图              整页 preview.png

用法：
    python verify/test_browser.py
"""

from __future__ import annotations

import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
SHOT = ROOT / "preview.png"
REPORT = ROOT / "verify" / "test_report.json"

RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  | " + str(detail)) if detail else ""))


def main() -> int:
    console_errors: list[str] = []
    page_errors: list[str] = []
    external: list[str] = []

    with sync_playwright() as p:
        browser = None
        for channel in ("msedge", "chrome"):
            try:
                browser = p.chromium.launch(channel=channel)
                print(f"[test] 使用系统浏览器: {channel}")
                break
            except Exception as exc:  # noqa: BLE001
                print(f"[test] {channel} 不可用: {exc}")
        if browser is None:
            browser = p.chromium.launch()
            print("[test] 使用 Playwright 自带 Chromium")

        ctx = browser.new_context(viewport={"width": 1440, "height": 1000},
                                  device_scale_factor=1.5)
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("request", lambda r: external.append(r.url)
                if not r.url.startswith(("file:", "data:", "blob:")) else None)

        page.goto(URL, wait_until="load")
        page.wait_for_timeout(700)

        # ---------------- A. 加载与错误 ----------------
        print("\n[A] 加载与错误")
        check("页面标题正确", "ADEQUATE" in page.title(), page.title())
        check("无控制台错误", not console_errors, "; ".join(console_errors[:3]))
        check("无未捕获异常", not page_errors, "; ".join(page_errors[:3]))
        check("无外部网络请求（可离线）", not external, "; ".join(external[:3]))

        # ---------------- B. 结构完整性 ----------------
        print("\n[B] 结构完整性")
        n_carbons = page.locator("#mol .cnode").count()
        check("分子图含 15 个可点击碳原子", n_carbons == 15, f"实际 {n_carbons}")
        n_bonds = page.locator("#mol line").count()
        check("分子图含键线（≥18 条）", n_bonds >= 18, f"实际 {n_bonds}")
        n_sig = page.locator("#siglist .sigrow").count()
        check("信号示意含 13 行", n_sig == 13, f"实际 {n_sig}")
        n_rows = page.locator("#asg tbody tr").count()
        check("归属表含 15 行", n_rows == 15, f"实际 {n_rows}")
        n_gl = page.locator("#glossary-list .gl").count()
        check("术语表条目 ≥ 15", n_gl >= 15, f"实际 {n_gl}")
        n_term = page.locator(".term").count()
        check("正文术语注释按钮 ≥ 8", n_term >= 8, f"实际 {n_term}")
        check("顶部读前必读存在", page.locator(".preread").count() == 1)
        check("原图完整保留（img 元素）", page.locator("#origin img").count() == 1)
        src_attr = page.locator("#origin img").get_attribute("src") or ""
        check("原图以内嵌 data URI 呈现", src_attr.startswith("data:image/png;base64,"),
              src_attr[:40])
        check("分子图 viewBox 已收紧留白",
              page.locator("#mol").get_attribute("viewBox") == "118 66 470 312",
              page.locator("#mol").get_attribute("viewBox"))

        # ---------------- F. 理论自检（用页面 API） ----------------
        print("\n[F] 理论自检")
        theory = page.evaluate("""() => {
            const A = window.__ADEQ__;
            const v = (n, k) => A.api.reachable(n, A.experiments[k].hops, A.experiments[k].needH);
            const carbons = A.carbons;
            return {
              nC: carbons.length,
              nQ: carbons.filter(c => c.nH === 0).length,
              nP: carbons.filter(c => c.nH > 0).length,
              nSig: A.signals.length,
              nCC: A.bonds.filter(b => typeof b.a === 'number' && typeof b.b === 'number').length,
              inad13: v(13,'inad'), inad15: v(15,'inad'),
              adeq13: v(13,'adeq11'), adeq15: v(15,'adeq11'),
              adeq1:  v(1,'adeq11'),  adeq4:  v(4,'adeq11'), adeq14: v(14,'adeq11'),
              adeq2:  v(2,'adeq11'),  adeq7:  v(7,'adeq11'), adeq8:  v(8,'adeq11'),
              adeqCount: carbons.filter(c => v(c.n,'adeq11')).length,
              inadCount: carbons.filter(c => v(c.n,'inad')).length,
              adeq1n13: v(13,'adeq1n'), adeq1n15: v(15,'adeq1n'),
              eff34_55: A.api.transferEff(34, 55),
              eff57_55: A.api.transferEff(57, 55),
              eff34_34: A.api.transferEff(34, 34),
              pair: A.api.pairProb(),
              jAr: A.api.jccOf({a:1,b:2,t:'ar'}),
              jSp3: A.api.jccOf({a:9,b:10,t:'single'})
            };
        }""")
        check("碳原子总数 = 15", theory["nC"] == 15, theory["nC"])
        check("季碳数 = 3", theory["nQ"] == 3, theory["nQ"])
        check("质子化碳数 = 12", theory["nP"] == 12, theory["nP"])
        check("质子化 + 季碳 = 总数", theory["nP"] + theory["nQ"] == theory["nC"])
        check("独立信号数 = 13", theory["nSig"] == 13, theory["nSig"])
        check("C–C 键数 = 14", theory["nCC"] == 14, theory["nCC"])
        check("INADEQUATE: C13 出现", theory["inad13"] is True)
        check("INADEQUATE: C15 不出现", theory["inad15"] is False)
        check("1,1-ADEQUATE: C13 不出现", theory["adeq13"] is False)
        check("1,1-ADEQUATE: C15 不出现", theory["adeq15"] is False)
        check("1,1-ADEQUATE: 三个季碳均出现 (C1/C4/C14)",
              theory["adeq1"] and theory["adeq4"] and theory["adeq14"],
              f"C1={theory['adeq1']} C4={theory['adeq4']} C14={theory['adeq14']}")
        check("1,1-ADEQUATE 可见碳数 = 13", theory["adeqCount"] == 13, theory["adeqCount"])
        check("INADEQUATE 可见碳数 = 14", theory["inadCount"] == 14, theory["inadCount"])
        check("1,n-ADEQUATE: C13 出现、C15 不出现",
              theory["adeq1n13"] is True and theory["adeq1n15"] is False,
              f"C13={theory['adeq1n13']} C15={theory['adeq1n15']}")
        check("效率模型 J=34,Jset=55 约 0.218", abs(theory["eff34_55"] - 0.2178) < 0.01,
              round(theory["eff34_55"], 4))
        check("效率模型 J=Jset 时为 0.5", abs(theory["eff34_34"] - 0.5) < 1e-6,
              round(theory["eff34_34"], 6))
        check("天然丰度成对概率 ≈ 1.21e-4", abs(theory["pair"] - 1.21e-4) < 1e-8,
              theory["pair"])
        check("芳环 ¹J(CC) = 57 Hz", theory["jAr"] == 57, theory["jAr"])
        check("sp³–sp³ ¹J(CC) = 34 Hz", theory["jSp3"] == 34, theory["jSp3"])

        # ---------------- C. 交互 ----------------
        print("\n[C] 交互")

        # C1 点击碳原子
        page.locator('#mol .cnode[data-n="13"]').click()
        page.wait_for_timeout(120)
        detail = page.locator("#detail").inner_text()
        check("点击 C13 → 右侧显示其判定", "C13" in detail and "不出现" in detail,
              detail[:60].replace("\n", " "))
        sel13 = page.locator('#mol .cnode[data-n="13"]').get_attribute("data-sel")
        check("点击 C13 → 分子图出现选中态", sel13 == "1", sel13)

        # C2 片段选择
        page.locator('#groups .chip[data-g="ring"]').click()
        page.wait_for_timeout(120)
        pressed = page.locator('#groups .chip[data-g="ring"]').get_attribute("aria-pressed")
        check("选择苯环片段 → 按钮按下态", pressed == "true", pressed)
        check("选择苯环 → 明细列出 6 个碳", "C6" in page.locator("#detail").inner_text())
        hl = page.locator('#asg tbody tr[data-hl="1"]').count()
        check("选择苯环 → 归属表高亮 6 行", hl == 6, hl)
        # 取消
        page.locator('#groups .chip[data-g="ring"]').click()
        page.wait_for_timeout(100)
        check("再次点击可取消选择",
              page.locator('#groups .chip[data-g="ring"]').get_attribute("aria-pressed") == "false")

        # C3 实验切换
        page.locator('#exps button[data-e="inad"]').click()
        page.wait_for_timeout(150)
        st13 = page.locator('#mol .cnode[data-n="13"]').get_attribute("data-st")
        check("切到 INADEQUATE → C13 变为出现", st13 == "obs", st13)
        readout = page.locator("#readout").inner_text()
        check("切到 INADEQUATE → 读数更新为 14/15", "14" in readout, readout[:50].replace("\n", " "))
        sig13 = page.locator('#siglist .sigrow').nth(8).inner_text()
        check("切到 INADEQUATE → C13 信号行显示出现", "出现" in sig13 and "不出现" not in sig13,
              sig13.replace("\n", " "))
        page.locator('#exps button[data-e="adeq11"]').click()
        page.wait_for_timeout(150)
        st13b = page.locator('#mol .cnode[data-n="13"]').get_attribute("data-st")
        check("切回 1,1-ADEQUATE → C13 变回不出现", st13b == "miss", st13b)

        # C4 富集度滑块
        before = page.locator("#readout").inner_text()
        page.locator("#enrich").fill("100")
        page.locator("#enrich").dispatch_event("input")
        page.wait_for_timeout(150)
        after = page.locator("#readout").inner_text()
        check("富集度滑块 → 数值标签更新",
              page.locator("#enrich-v").inner_text().strip() == "100.0 %",
              page.locator("#enrich-v").inner_text())
        check("富集度 100% → 读数发生变化", before != after)
        check("富集度 100% → 成对概率显示 100%", "100.0" in after, after[:70].replace("\n", " "))
        page.locator("#enrich").fill("1.1")
        page.locator("#enrich").dispatch_event("input")
        page.wait_for_timeout(120)

        # C5 J 滑块
        page.locator("#jset").fill("34")
        page.locator("#jset").dispatch_event("input")
        page.wait_for_timeout(150)
        check("J 滑块 → 数值标签更新",
              page.locator("#jset-v").inner_text().strip() == "34 Hz",
              page.locator("#jset-v").inner_text())
        eff34 = page.locator("#readout").inner_text()
        page.locator("#jset").fill("57")
        page.locator("#jset").dispatch_event("input")
        page.wait_for_timeout(150)
        eff57 = page.locator("#readout").inner_text()
        check("改变 J 设定 → 平均效率读数变化", eff34 != eff57)
        bar = page.locator('#siglist .sigrow').nth(0).locator(".s-fill").get_attribute("style")
        check("信号条宽度随效率变化", "width" in (bar or ""), bar)
        page.locator("#jset").fill("55")
        page.locator("#jset").dispatch_event("input")
        page.wait_for_timeout(120)

        # C6 术语注释
        page.locator(".term").first.click()
        page.wait_for_timeout(150)
        check("点击术语 → 弹出中文注释", page.locator("#popover").is_visible())
        pop_text = page.locator("#popover").inner_text()
        check("注释含中文释义", len(pop_text) > 20 and any("\u4e00" <= ch <= "\u9fff" for ch in pop_text),
              pop_text[:40].replace("\n", " "))
        check("注释按钮 aria-expanded=true",
              page.locator(".term").first.get_attribute("aria-expanded") == "true")
        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        check("Esc 关闭注释", not page.locator("#popover").is_visible())

        # C7 原图缩放
        z0 = page.locator("#zoomer").evaluate("el => getComputedStyle(el).getPropertyValue('--z')")
        page.locator('#zoombtns button[data-r="mol"]').click()
        page.wait_for_timeout(150)
        z1 = page.locator("#zoomer").evaluate("el => getComputedStyle(el).getPropertyValue('--z')")
        check("点击预设区域 → 放大倍数变化", z0 != z1, f"{z0.strip()} → {z1.strip()}")
        check("放大倍数标签同步",
              page.locator("#zoom-v").inner_text().strip() == "2.4×",
              page.locator("#zoom-v").inner_text())
        page.locator("#zoomrange").fill("3.5")
        page.locator("#zoomrange").dispatch_event("input")
        page.wait_for_timeout(120)
        check("缩放滑块生效",
              page.locator("#zoom-v").inner_text().strip() == "3.5×",
              page.locator("#zoom-v").inner_text())
        page.locator('#zoombtns button[data-r="full"]').click()
        page.wait_for_timeout(120)

        # C8 展开区域
        d = page.locator("details.acc").nth(1)
        d.locator("summary").click()
        page.wait_for_timeout(150)
        check("可展开原图区域能打开", d.get_attribute("open") is not None)
        n_z2 = page.locator(".zoomer2").count()
        check("含 3 个可展开放大区域", n_z2 == 3, n_z2)

        # ---------------- D. 键盘可访问性 ----------------
        print("\n[D] 键盘可访问性")
        page.locator('#mol .cnode[data-n="7"]').focus()
        page.wait_for_timeout(100)
        focused = page.evaluate("() => document.activeElement && document.activeElement.getAttribute('data-n')")
        check("碳原子可被聚焦", focused == "7", focused)
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        check("Enter 激活碳原子选择",
              page.locator('#mol .cnode[data-n="7"]').get_attribute("data-sel") == "1")
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(100)
        focused2 = page.evaluate("() => document.activeElement && document.activeElement.getAttribute('data-n')")
        check("方向键在碳原子间移动", focused2 == "8", focused2)
        # 术语键盘激活
        page.locator(".term").first.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        check("键盘可打开术语注释", page.locator("#popover").is_visible())
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        # 控件键盘可达
        page.locator("#enrich").focus()
        check("滑块可获得焦点",
              page.evaluate("() => document.activeElement.id") == "enrich")

        # ---------------- E. 响应式与溢出 ----------------
        print("\n[E] 响应式与溢出")
        for w, h, label in ((1440, 1000, "桌面 1440"), (390, 844, "手机 390"), (360, 780, "手机 360")):
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(450)
            m = page.evaluate("""() => {
                const de = document.documentElement;
                const over = [];
                document.querySelectorAll('body *').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && (r.right > de.clientWidth + 1.5 || r.left < -1.5)) {
                        const cs = getComputedStyle(el);
                        if (cs.position === 'fixed') return;
                        if (el.closest('.tw')) return;         // 表格容器允许横向滚动
                        if (el.closest('.zoomer')) return;     // 原图窗口按设计裁切
                        over.push((el.tagName.toLowerCase()) + '.' + (el.className || '').toString().slice(0,26));
                    }
                });
                return {
                    docW: de.scrollWidth,
                    cliW: de.clientWidth,
                    overflow: over.slice(0, 6),
                    molW: document.querySelector('#mol').getBoundingClientRect().width,
                    dashCols: getComputedStyle(document.querySelector('.dash')).gridTemplateColumns.split(' ').length
                };
            }""")
            no_scroll = m["docW"] <= m["cliW"] + 1
            check(f"{label}: 无横向溢出", no_scroll, f"scrollW={m['docW']} clientW={m['cliW']}")
            check(f"{label}: 无元素越界", len(m["overflow"]) == 0, m["overflow"])
            check(f"{label}: 分子图宽度自适应", 0 < m["molW"] <= w, round(m["molW"], 1))
            if w >= 1150:
                check(f"{label}: 三栏布局", m["dashCols"] == 3, m["dashCols"])
            else:
                check(f"{label}: 单栏纵向布局", m["dashCols"] == 1, m["dashCols"])

        # 还原桌面尺寸并截图
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOT), full_page=True)
        check("整页截图已生成", SHOT.exists() and SHOT.stat().st_size > 50000,
              f"{SHOT.stat().st_size if SHOT.exists() else 0} 字节")

        browser.close()

    # ---------------- 汇总 ----------------
    passed = sum(1 for r in RESULTS if r["ok"])
    total = len(RESULTS)
    print(f"\n==== 结果: {passed}/{total} 通过 ====")
    for r in RESULTS:
        if not r["ok"]:
            print("  未通过:", r["name"], "|", r["detail"])

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(
        {"passed": passed, "total": total, "results": RESULTS},
        ensure_ascii=False, indent=2), encoding="utf-8")
    print("[test] 报告写入:", REPORT)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
