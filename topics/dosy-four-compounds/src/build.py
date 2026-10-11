# -*- coding: utf-8 -*-
"""
构建脚本：把 src/ 下的样式、脚本与 base64 图片内联成**单个离线可打开的 HTML**。
用法：  python build.py
产出：  ../index.html
"""
import base64
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.abspath(os.path.join(HERE, ".."))
IMG = os.path.join(OUT_DIR, "assets", "original_dosy_slide.png")
TARGET = os.path.join(OUT_DIR, "index.html")


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def main():
    if not os.path.exists(IMG):
        sys.exit("缺少原图：" + IMG)

    html = read(os.path.join(HERE, "index.html"))
    css = read(os.path.join(HERE, "styles.css"))
    js = read(os.path.join(HERE, "app.js"))

    with open(IMG, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    data_uri = "data:image/png;base64," + b64

    # 1) 样式
    html = html.replace("/*__STYLES__*/", css)
    # 2) 数据 + 逻辑（合并为一个 script，避免加载顺序问题）
    html = html.replace("/*__DATA__*/", "/* ---- data & logic (inlined) ---- */")
    html = html.replace("/*__APP__*/", js)
    # 3) 图片
    html = html.replace("__IMAGE_DATA_URI__", data_uri)

    # 自检：不应残留占位符
    left = re.findall(r"__(?:STYLES|DATA|APP|IMAGE_DATA_URI)__", html)
    if left:
        sys.exit("仍有未替换的占位符：%r" % left)

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(html)

    kb = os.path.getsize(TARGET) / 1024.0
    print("已生成 %s  (%.1f KB)" % (TARGET, kb))
    print("  - 内联样式 %d 字符" % len(css))
    print("  - 内联脚本 %d 字符" % len(js))
    print("  - 内联图片 %d 字符 (base64)" % len(data_uri))
    print("  - 外部依赖：无（可离线直接打开）")


if __name__ == "__main__":
    main()
