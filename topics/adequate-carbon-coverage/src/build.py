#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
构建脚本：把 src/ 下的可编辑源码打包成一个可离线打开的单文件 index.html。

做三件事：
  1. 把 src/styles.css 内联成 <style>
  2. 把 src/app.js     内联成 <script>
  3. 把 ../assets/original.png 替换为 base64 data URI（出现在 <img src> 与 CSS url() 两处）

用法：
    python src/build.py
"""

from __future__ import annotations

import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
ASSETS = ROOT / "assets"

PAGE = SRC / "page.html"
CSS = SRC / "styles.css"
JS = SRC / "app.js"
IMG = ASSETS / "original.png"
OUT = ROOT / "index.html"

IMG_REF = "../assets/original.png"


def main() -> int:
    for p in (PAGE, CSS, JS, IMG):
        if not p.exists():
            print(f"[build] 缺少文件: {p}", file=sys.stderr)
            return 1

    html = PAGE.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    js = JS.read_text(encoding="utf-8")

    img_bytes = IMG.read_bytes()
    digest = hashlib.sha256(img_bytes).hexdigest()
    b64 = base64.b64encode(img_bytes).decode("ascii")
    data_uri = "data:image/png;base64," + b64

    # 1) 内联 CSS
    link_tag = '<link rel="stylesheet" href="styles.css">'
    if link_tag not in html:
        print("[build] 未找到样式表引用标签", file=sys.stderr)
        return 1
    html = html.replace(link_tag, "<style>\n" + css + "\n</style>")

    # 2) 内联 JS
    script_tag = '<script src="app.js"></script>'
    if script_tag not in html:
        print("[build] 未找到脚本引用标签", file=sys.stderr)
        return 1
    html = html.replace(script_tag, "<script>\n" + js + "\n</script>")

    # 3) 内联图片
    n_ref = html.count(IMG_REF)
    if n_ref == 0:
        print("[build] 未找到图片引用", file=sys.stderr)
        return 1
    html = html.replace(IMG_REF, data_uri)

    # 保险：确认没有残留的外部引用
    leftovers = re.findall(r'(?:src|href)="(?!data:|#)[^"]+"', html)
    OUT.write_text(html, encoding="utf-8")

    print("[build] 输出 :", OUT)
    print("[build] 大小 : %.1f KB" % (OUT.stat().st_size / 1024))
    print("[build] 图片 : %d 字节, sha256=%s" % (len(img_bytes), digest[:16]))
    print("[build] 内联图片引用 %d 处" % n_ref)
    print("[build] 残留外部引用:", leftovers if leftovers else "无")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
