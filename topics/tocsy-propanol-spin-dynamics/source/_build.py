# -*- coding: utf-8 -*-
import re, base64, os, sys, shutil
DIST = '/tmp/katexprobe/package/dist'
OUT  = 'TOCSY正丙醇-可视化讲解.html'
tpl  = open('_template.html', encoding='utf-8').read()

# ---- 1) KaTeX CSS（只留 woff2，路径改为 katex-fonts/） ----
css = open(os.path.join(DIST, 'katex.min.css'), encoding='utf-8').read()
css = re.sub(r',url\(fonts/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)', '', css)
css = css.replace('url(fonts/', 'url(katex-fonts/')
js  = open(os.path.join(DIST, 'katex.min.js'), encoding='utf-8').read()

# ---- 2) 原图内嵌为 data URI ----
raw = open('原图-练习题.webp','rb').read()
uri = 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')

# ---- 3) 组装 ----
for ph in ('<!--KATEX_CSS-->', '<!--KATEX_JS-->', '__SLIDE_SRC__'):
    assert ph in tpl, '模板缺少占位符: ' + ph
out = tpl.replace('<!--KATEX_CSS-->', '<style>\n' + css + '\n</style>')
out = out.replace('<!--KATEX_JS-->',  '<script>\n' + js + '\n</script>')
assert '__SLIDE_SRC__' in out
out = out.replace('__SLIDE_SRC__', uri)

# ---- 4) 字体 ----
os.makedirs('katex-fonts', exist_ok=True)
n = 0
for f in sorted(os.listdir(os.path.join(DIST, 'fonts'))):
    if f.endswith('.woff2'):
        shutil.copyfile(os.path.join(DIST,'fonts',f), os.path.join('katex-fonts', f)); n += 1

# 将字体也内嵌，保证只下载 HTML 时公式仍能离线显示。
def inline_font(match):
    name = match.group(1)
    data = open(os.path.join('katex-fonts', name), 'rb').read()
    return 'url(data:font/woff2;base64,' + base64.b64encode(data).decode('ascii') + ')'

out, embedded = re.subn(r'url\(katex-fonts/([^)/]+\.woff2)\)', inline_font, out)
assert embedded == n, f'字体引用 {embedded} 个，字体文件 {n} 个'
open(OUT, 'w', encoding='utf-8').write(out)

# ---- 5) 自检：零外部加载 ----
# 只看真实的标签属性：先剔除 <script>/<style> 内容（内联的库源码里会有同形字符串）
_scan = re.sub(r'<script\b[^>]*>.*?</script>', '<S/>', out, flags=re.S)
_scan = re.sub(r'<style\b[^>]*>.*?</style>', '<S/>', _scan, flags=re.S)
ext = re.findall(r'(?:src|href)="(?!#)([^"]{0,120})"', _scan)
ext = [e for e in ext if not e.startswith('data:')]
print('外部加载引用（应为空）:', ext)
print('woff2 字体:', n, '个')
print('页面字节数:', len(out.encode('utf-8')))
print('data URI 长度:', len(uri))
print('残留占位符:', [p for p in ('<!--KATEX_CSS-->','<!--KATEX_JS-->','__SLIDE_SRC__') if p in out])
import re as _re
assert 'typeof katex' not in out or 'katex.render' not in out or out.count('katex') > 100, 'katex 未内联?'
