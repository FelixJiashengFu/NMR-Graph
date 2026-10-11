#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_page.py —— 浏览器端交互测试（Playwright / Chromium，无头）

覆盖：
  1. 控制台错误与页面异常
  2. 术语注释：点按展开、键盘 Enter 展开、Escape 关闭、术语表条目齐全
  3. 图形点击：重建图上的交叉峰、结构式上的原子
  4. 四个滑块：拖动后读数与图形同步变化
  5. 原图展开（<details>）与局部放大区域切换
  6. 键盘操作：谱图面板方向键、Tab 可聚焦元素
  7. 三种视口宽度（1440 / 390 / 320）下的横向溢出、文字裁切、标签重叠
  8. 输出整页 preview.png 与移动端截图

用法： python verify_page.py --html <单文件 HTML 路径> --out <截图目录>
"""
import argparse
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("  [PASS] " if ok else "  [FAIL] ") + name + ("  " + detail if detail else ""))
    return ok


def overflow_info(page):
    """返回横向溢出与文字裁切的诊断信息（HTML 元素；SVG 另行检查）。"""
    return page.evaluate("""() => {
      const de = document.documentElement;
      const out = { scrollW: de.scrollWidth, clientW: de.clientWidth, offenders: [], clipped: [] };
      const inSvg = el => !!(el.ownerSVGElement || el.tagName.toLowerCase() === 'svg');
      const inScroller = el => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const cs = getComputedStyle(p);
          if (['auto','scroll'].includes(cs.overflowX)) return true;
          p = p.parentElement;
        }
        return false;
      };
      document.querySelectorAll('*').forEach(el => {
        if (el.closest('[hidden]')) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > de.clientWidth + 1.5 && !inScroller(el)) {
          out.offenders.push((el.tagName.toLowerCase()) + '.' + (el.className || '').toString().split(' ')[0]
                             + ' right=' + r.right.toFixed(1));
        }
        if (inSvg(el)) return;                       // SVG 文字由 viewBox 检查单独覆盖
        const cs = getComputedStyle(el);
        const scrollable = ['auto','scroll'].includes(cs.overflowX) || ['auto','scroll'].includes(cs.overflow);
        if (el.children.length === 0 && el.textContent && el.textContent.trim() && !scrollable &&
            el.scrollWidth > el.clientWidth + 2) {
          out.clipped.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]
                           + ' ' + el.clientWidth + '<' + el.scrollWidth);
        }
      });
      return out;
    }""")


def svg_diagnostics(page):
    """检查每个 SVG 的渲染尺寸，以及 SVG 内文字是否溢出 viewBox。"""
    return page.evaluate("""() => {
      const sizeBad = [], textBad = [];
      document.querySelectorAll('svg').forEach(s => {
        if (s.closest('[hidden]')) return;
        const r = s.getBoundingClientRect();
        if (r.width < 20 || r.height < 10) {
          sizeBad.push((s.parentElement ? s.parentElement.className : '?') + ' ' + r.width.toFixed(0) + 'x' + r.height.toFixed(0));
          return;
        }
        const sr = r;
        const vb = s.viewBox && s.viewBox.baseVal;
        if (!vb || !vb.width || !sr.width) return;
        const sx = sr.width / vb.width, sy = sr.height / vb.height;
        s.querySelectorAll('text').forEach(t => {
          const r = t.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          // 换算回 viewBox 用户单位（自动计入 transform 与缩放）
          const vx = vb.x + (r.left - sr.left) / sx;
          const vy = vb.y + (r.top - sr.top) / sy;
          const vw = r.width / sx, vh = r.height / sy;
          const pad = 1.5;
          if (vx < vb.x - pad || vy < vb.y - pad ||
              vx + vw > vb.x + vb.width + pad || vy + vh > vb.y + vb.height + pad) {
            textBad.push((t.textContent || '').slice(0, 14) + ' viewBox内位置=' +
              [vx, vy, vw, vh].map(v => v.toFixed(0)).join(',') +
              ' viewBox=' + [vb.x, vb.y, vb.width, vb.height].map(v => v.toFixed(0)).join(','));
          }
        });
      });
      return { sizeBad, textBad };
    }""")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    html = pathlib.Path(args.html).resolve()
    outdir = pathlib.Path(args.out).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    url = html.as_uri()

    console_errors, page_errors = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.type + ": " + m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        page.goto(url)
        page.wait_for_selector("html[data-ready='1']", timeout=15000)
        page.wait_for_timeout(400)

        print("=" * 74)
        print("1. 加载与运行时错误")
        print("=" * 74)
        check("页面加载完成（data-ready 已置位）", True)
        check("无控制台错误", not console_errors, "; ".join(console_errors[:4]))
        check("无未捕获异常", not page_errors, "; ".join(page_errors[:4]))

        n_terms = page.eval_on_selector_all(".term", "els => els.length")
        n_gloss = page.eval_on_selector_all("#glossTbl tbody tr", "els => els.length")
        n_pk = page.eval_on_selector_all("#reconHost .pkg", "els => els.length")
        n_rows = page.eval_on_selector_all("#peakTbl tbody tr", "els => els.length")
        undefined_keys = page.evaluate("""() => {
          const keys = new Set(Array.from(document.querySelectorAll('.term')).map(e => e.dataset.tkey));
          return Array.from(keys).filter(k => !document.getElementById('pop-' + k));
        }""")
        check("术语按钮已生成（>0）", n_terms > 0, f"{n_terms} 个")
        check("术语表条目数 = 术语定义总数（20 条）", n_gloss == 20, f"{n_gloss} 条")
        check("正文中每个术语都有对应定义（无未定义键）", len(undefined_keys) == 0, str(undefined_keys))
        check("每个术语按钮都有 aria-controls 指向的弹层",
              page.evaluate("""() => Array.from(document.querySelectorAll('.term'))
                 .every(b => document.getElementById(b.getAttribute('aria-controls')))"""))
        check("重建图上有 10 个交叉峰可点对象", n_pk == 10, f"{n_pk} 个")
        check("归属表有 10 行", n_rows == 10, f"{n_rows} 行")
        check("结构式已生成（含 S/N/O/Cl/H 原子标签）",
              page.eval_on_selector_all("#structHost .atom", "e => e.length") == 8,
              f"{page.eval_on_selector_all('#structHost .atom', 'e => e.length')} 个原子标签")
        check("官能团小结构图 4 个",
              page.eval_on_selector_all("#fgRow .fg svg", "e => e.length") == 4)

        print()
        print("=" * 74)
        print("2. 术语注释交互")
        print("=" * 74)
        t0 = page.locator(".term").first
        t0.scroll_into_view_if_needed()
        t0.click()
        page.wait_for_timeout(120)
        opened = page.eval_on_selector_all('.pop[data-open="1"]', "e => e.length")
        check("鼠标点按术语 → 弹出注释", opened == 1, f"当前展开 {opened} 个")
        check("按钮 aria-expanded 同步为 true",
              page.eval_on_selector(".term", "e => e.getAttribute('aria-expanded')") == "true")

        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        check("Escape 关闭注释",
              page.eval_on_selector_all('.pop[data-open="1"]', "e => e.length") == 0)

        t0.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
        check("键盘 Enter 可展开注释",
              page.eval_on_selector_all('.pop[data-open="1"]', "e => e.length") == 1)
        page.keyboard.press("Escape")

        # 术语表里的按钮也可用
        g = page.locator("#glossTbl .term").first
        g.scroll_into_view_if_needed()
        g.focus()
        page.keyboard.press(" ")
        page.wait_for_timeout(120)
        check("术语表内的术语也可用空格键展开",
              page.eval_on_selector_all('.pop[data-open="1"]', "e => e.length") == 1)
        page.keyboard.press("Escape")

        print()
        print("=" * 74)
        print("3. 图形点击")
        print("=" * 74)
        # 点击重建图上的 P3（红圈峰）
        page.locator('#reconHost .pkg[data-pid="P3"]').click(force=True)
        page.wait_for_timeout(150)
        main_txt = page.inner_text("#roMain")
        check("点击 P3 → 读数更新为 δH 6.86 / δN −309.1",
              "6.86" in main_txt and "309.1" in main_txt, main_txt.replace("\n", " "))

        page.locator('#reconHost .pkg[data-pid="P8"]').click(force=True)
        page.wait_for_timeout(150)
        main_txt = page.inner_text("#roMain")
        check("点击 P8 → 读数更新为 δH 1.75 / δN −271.3",
              "1.75" in main_txt and "271.3" in main_txt, main_txt.replace("\n", " "))

        # 键盘激活交叉峰
        page.locator('#reconHost .pkg[data-pid="P1"]').focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        check("键盘 Enter 激活交叉峰 P1",
              "7.37" in page.inner_text("#roMain"), page.inner_text("#roMain").replace("\n", " "))

        # 点击结构式原子 → 切换对象
        page.locator('#structHost .atomg[data-atom="lacN1"] .hit').click(force=True)
        page.wait_for_timeout(150)
        pressed = page.eval_on_selector_all('#objList .objbtn[aria-pressed="true"]', "e => e.length")
        check("点击内酰胺 N 原子 → 对象切换（恰好 1 个按钮被按下）", pressed == 1, f"{pressed} 个")
        check("对象切换为内酰胺",
              "内酰胺" in page.inner_text('#objList .objbtn[aria-pressed="true"]'),
              page.inner_text('#objList .objbtn[aria-pressed="true"]').replace("\n", " "))
        check("结构式高亮随对象更新（有 g.on 元素）",
              page.eval_on_selector_all("#structHost .atomg.on", "e => e.length") > 0)

        print()
        print("=" * 74)
        print("4. 滑块")
        print("=" * 74)

        def drag(slider_sel, value):
            page.eval_on_selector(slider_sel, """(el, v) => {
              el.value = v; el.dispatchEvent(new Event('input', {bubbles: true}));
            }""", value)
            page.wait_for_timeout(120)

        drag("#sldH", "3.28")
        check("δH 滑块 → 读数同步", "3.28" in page.inner_text("#vH"), page.inner_text("#vH"))
        check("δH 滑块 → 主读数同步", "3.28" in page.inner_text("#roMain"))
        check("δH 滑块 → 图形游标同步",
              page.eval_on_selector("#reconHost svg", "e => e.innerHTML").count("δH=3.28") >= 1)

        drag("#sldN", "-316.5")
        check("δN 滑块 → 读数同步（负号保留）", "316.5" in page.inner_text("#vN") and "−" in page.inner_text("#vN"),
              page.inner_text("#vN"))
        check("δN 滑块 → 主读数同步", "316.5" in page.inner_text("#roMain"))

        before = page.eval_on_selector_all("#reconHost .pkg polygon, #reconHost .pkg rect, #reconHost .pkg circle", "e => e.length")
        drag("#sldTh", "85")
        after = page.eval_on_selector("#reconHost svg", "e => e.innerHTML")
        check("阈值滑块 → 弱峰被压暗（存在 fill-opacity=\"0.10\"）", 'fill-opacity="0.10"' in after)
        check("阈值滑块未破坏图形结构", before == page.eval_on_selector_all("#reconHost .pkg polygon, #reconHost .pkg rect, #reconHost .pkg circle", "e => e.length"))
        check("阈值滑块 → 演示模型表同步更新显示状态",
              "已隐藏" in page.inner_text("#modelRead"))

        drag("#sldD", "20")
        check("Δ₂ 滑块 → 数值与 J 读数同步",
              "20 ms" in page.inner_text("#vD") and "25.0" in page.inner_text("#vJopt"),
              page.inner_text("#vD") + " / " + page.inner_text("#vJopt"))
        drag("#sldD", "250")
        check("Δ₂ = 250 ms → J ≈ 2.0 Hz", "2.0" in page.inner_text("#vJopt"), page.inner_text("#vJopt"))

        page.click("#btnReset")
        page.wait_for_timeout(150)
        check("恢复默认视图后 δH 回到 6.86", "6.86" in page.inner_text("#vH"), page.inner_text("#vH"))
        check("恢复默认视图后阈值回到 0 %", "0 %" in page.inner_text("#vTh"))
        check("恢复默认视图后 Δ₂ 回到 111 ms", "111 ms" in page.inner_text("#vD"))

        page.click("#btnSnap")
        page.wait_for_timeout(150)
        check("吸附到最近交叉峰后读数落在某个交叉峰上",
              any(k in page.inner_text("#roMain") for k in ["6.86", "7.37", "7.20", "6.76", "6.60", "4.56", "2.26", "1.75", "1.76", "1.45"]),
              page.inner_text("#roMain").replace("\n", " "))

        print()
        print("=" * 74)
        print("5. 原图与局部放大")
        print("=" * 74)
        page.locator("#segView button[data-view='orig']").click()
        page.wait_for_timeout(200)
        check("切换到原图叠加层视图", page.is_visible("#viewOrig"))
        check("原图叠加层已生成游标与选中标记",
              page.eval_on_selector("#origOvl", "e => e.innerHTML").count("line") >= 2)
        check("原图 <img> 未被修改（使用原始像素尺寸）",
              page.eval_on_selector("#origImg", "e => e.naturalWidth") == 1053 and
              page.eval_on_selector("#origImg", "e => e.naturalHeight") == 811)
        page.locator("#segView button[data-view='recon']").click()
        page.wait_for_timeout(150)

        page.locator("#segZoom button[data-rid='redpeak']").click()
        page.wait_for_timeout(250)
        st = page.eval_on_selector("#zoomImg", "e => ({l: e.style.left, t: e.style.top, w: e.style.width})")
        check("局部放大切换后图片被平移/缩放", st["l"] != "" and st["w"] != "", json.dumps(st))
        check("放大说明文字已更新", "红圈峰" in page.inner_text("#zoomCap"), page.inner_text("#zoomCap")[:40])
        page.locator("#segZoom button[data-rid='full']").click()
        page.wait_for_timeout(200)

        det = page.locator("#sec-zoom details").first
        det.locator("summary").click()
        page.wait_for_timeout(250)
        check("可展开查看完整原图（details 已打开）", det.evaluate("e => e.open"))
        check("原图文字中英对照表已填充",
              page.eval_on_selector_all("#srcTextTbl tr", "e => e.length") >= 3)

        print()
        print("=" * 74)
        print("6. 键盘可访问性")
        print("=" * 74)
        page.locator("#reconHost").focus()
        h0 = page.inner_text("#vH")
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(120)
        check("谱图面板获得焦点后方向键微调 δH", page.inner_text("#vH") != h0,
              f"{h0} → {page.inner_text('#vH')}")
        n0 = page.inner_text("#vN")
        page.keyboard.press("ArrowUp")
        page.wait_for_timeout(120)
        check("方向键微调 δN", page.inner_text("#vN") != n0, f"{n0} → {page.inner_text('#vN')}")

        focusable = page.evaluate("""() => {
          const sel = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
          return Array.from(document.querySelectorAll(sel)).filter(el => el.offsetParent !== null).length;
        }""")
        check("可聚焦元素数量充足（> 40）", focusable > 40, f"{focusable} 个")
        check("所有滑块都有 label 关联",
              page.evaluate("""() => ['sldH','sldN','sldTh','sldD'].every(id => {
                 const el = document.getElementById(id);
                 return el && document.querySelector('label[for="'+id+'"]');
              })"""))
        check("所有交叉峰对象都是可聚焦按钮",
              page.eval_on_selector_all('#reconHost .pkg[tabindex="0"][role="button"]', "e => e.length") == 10)

        print()
        print("=" * 74)
        print("7. 响应式：桌面 + 两种手机宽度")
        print("=" * 74)
        sizes = [("desktop-1440", 1440, 1000), ("mobile-390", 390, 844), ("mobile-320", 320, 720)]
        for name, w, h in sizes:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(450)
            info = overflow_info(page)
            check(f"[{name}] 无横向溢出（scrollWidth ≤ clientWidth）",
                  info["scrollW"] <= info["clientW"] + 1,
                  f"scrollW={info['scrollW']} clientW={info['clientW']} 越界元素={info['offenders'][:3]}")
            check(f"[{name}] 无文字被裁切（HTML 元素）", len(info["clipped"]) == 0, str(info["clipped"][:3]))
            # 三栏在窄屏应堆叠
            cols = page.eval_on_selector(".dash", "e => getComputedStyle(e).gridTemplateColumns")
            if w <= 1180:
                check(f"[{name}] 三栏纵向堆叠（单列）", len(cols.split(" ")) == 1, cols)
            else:
                check(f"[{name}] 桌面为三栏", len(cols.split(" ")) == 3, cols)
            d = svg_diagnostics(page)
            check(f"[{name}] 所有图形都有合理尺寸", len(d["sizeBad"]) == 0, str(d["sizeBad"][:3]))
            check(f"[{name}] SVG 内文字均未溢出 viewBox（标签不裁切）", len(d["textBad"]) == 0,
                  str(d["textBad"][:3]))
            page.screenshot(path=str(outdir / f"{name}.png"), full_page=(w == 1440))

        # 整页 preview.png
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.wait_for_timeout(500)
        page.screenshot(path=str(outdir / "preview.png"), full_page=True)
        check("已生成 preview.png", (outdir / "preview.png").exists())

        print()
        print("=" * 74)
        print("8. 再检查一次控制台")
        print("=" * 74)
        check("整轮交互后仍无控制台错误", not console_errors, "; ".join(console_errors[:4]))
        check("整轮交互后仍无未捕获异常", not page_errors, "; ".join(page_errors[:4]))

        browser.close()

    print()
    print("=" * 74)
    npass = sum(1 for _, ok, _ in RESULTS if ok)
    nfail = len(RESULTS) - npass
    print(f"汇总：{npass} 项通过，{nfail} 项失败，共 {len(RESULTS)} 项")
    print("=" * 74)
    return 1 if nfail else 0


if __name__ == "__main__":
    raise SystemExit(main())
