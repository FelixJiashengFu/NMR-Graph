#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py —— 把 src/ 下的 HTML / CSS / JS / PNG 内联成单个可离线打开的 HTML。
用法： python build.py
输出： ../index.html
"""
import base64
import pathlib
import re
import sys

SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent / "index.html"


def main() -> int:
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    data_js = (SRC / "data.js").read_text(encoding="utf-8")
    app_js = (SRC / "app.js").read_text(encoding="utf-8")
    png = (SRC / "assets" / "original.png").read_bytes()
    b64 = base64.b64encode(png).decode("ascii")
    data_uri = "data:image/png;base64," + b64

    # 1) 内联 CSS
    html = html.replace('<link rel="stylesheet" href="styles.css">',
                        "<style>\n" + css + "\n</style>")

    # 2) 内联脚本
    html = html.replace('<script src="data.js"></script>',
                        "<script>\n" + data_js + "\n</script>")
    html = html.replace('<script src="app.js"></script>',
                        "<script>\n" + app_js + "\n</script>")

    # 3) 内联图片
    html = html.replace('src="assets/original.png"', 'src="' + data_uri + '"')

    # 4) 校验：不得残留任何外部引用
    leftovers = re.findall(r'(?:src|href)="(?!data:)([^"]+)"', html)
    if leftovers:
        print("[FAIL] 仍存在外部引用：", sorted(set(leftovers)), file=sys.stderr)
        return 2

    OUT.write_text(html, encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"[OK] 已生成 {OUT}")
    print(f"     体积 {kb:.1f} KB（内联图片 {len(png)/1024:.1f} KB）")
    print(f"     外部引用残留：0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
