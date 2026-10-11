# -*- coding: utf-8 -*-
"""组装单文件离线页面。
   顺序严格：先断言占位符存在 -> 再替换 -> 最后查零外部加载 + 裸 < 扫描。
   （踩过的坑：replace 了空气还报告"无残留占位符"，结果公式全以 LaTeX 源码显示。）"""
import re, base64, os, sys, json

DIST = 'vendor'
TPL  = '_template.html'
OUT  = '../index.html'
PH   = ('<!--KATEX_CSS-->', '<!--KATEX_JS-->', '__SLIDE_SRC__', '__EVIDENCE_SRC__',
        '__MEASURE_JSON__', '__REF_JSON__')

tpl = open(TPL, encoding='utf-8').read()
missing = [p for p in PH if p not in tpl]
assert not missing, '模板缺少占位符: ' + repr(missing)

def datauri(path, mime):
    raw = open(path, 'rb').read()
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')

css = open(os.path.join(DIST, 'katex.min.css'), encoding='utf-8').read()
css = re.sub(r',url\(fonts/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)', '', css)
def inline_font(match):
    raw = open(os.path.join(DIST, 'fonts', match.group(1)), 'rb').read()
    return 'url(data:font/woff2;base64,' + base64.b64encode(raw).decode('ascii') + ')'
css, n = re.subn(r'url\(fonts/([^)/]+\.woff2)\)', inline_font, css)
assert n == 20, '应内嵌 20 个 KaTeX 字体，实际为 ' + str(n)
js  = open(os.path.join(DIST, 'katex.min.js'), encoding='utf-8').read()

meas = open('_measure.json', encoding='utf-8').read()
ref  = open('_ref.json', encoding='utf-8').read()
json.loads(meas); json.loads(ref)          # 先验证是合法 JSON

out = tpl.replace('<!--KATEX_CSS-->', '<style>\n' + css + '\n</style>')
out = out.replace('<!--KATEX_JS-->', '<script>\n' + js + '\n</script>')
out = out.replace('__SLIDE_SRC__', datauri('原图-COSY截图.webp', 'image/webp'))
out = out.replace('__EVIDENCE_SRC__', datauri('原图-像素核对.webp', 'image/webp'))
out = out.replace('__MEASURE_JSON__', meas)
out = out.replace('__REF_JSON__', ref)
open(OUT, 'w', encoding='utf-8').write(out)

# ---- 自检 ----
scan = re.sub(r'<script\b[^>]*>.*?</script>', '<S/>', out, flags=re.S)
scan = re.sub(r'<style\b[^>]*>.*?</style>', '<S/>', scan, flags=re.S)
ext = [e for e in re.findall(r'(?:src|href)="(?!#)([^"]{0,140})"', scan) if not e.startswith('data:')]
leftover = [p for p in PH if p in out]
# 正文裸 < 扫描（只查 HTML 部分，脚本/样式已剔除）
bare = re.findall(r'<(?![a-zA-Z/!])', scan)
print('外部加载引用（应为空）:', ext)
print('残留占位符（应为空）:', leftover)
print('正文裸 < 个数（应为 0）:', len(bare))
print('woff2 字体:', n, '个')
print('页面字节数:', len(out.encode('utf-8')))
print('KaTeX 是否内联:', ('katex.min.js' in out) or ('.katex{font' in out.replace(' ', '')) or ('katex' in out and len(css) > 1000))
print('__selftest 存在:', 'window.__selftest' in out)
assert not ext and not leftover and not bare, '自检未通过'
print('BUILD OK ->', OUT)
