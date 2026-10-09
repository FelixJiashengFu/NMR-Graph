"""Build a self-contained editable HTML. Python standard library only."""
from pathlib import Path
import base64,re,sys
root=Path(__file__).resolve().parent
def data(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
html=(root/'template.html').read_text()
for marker,file in [('/*STYLES*/','styles.css'),('/*CORE*/','core.js'),('/*APP*/','app.js')]:html=html.replace(marker,(root/file).read_text())
html=html.replace('/*ORIGINAL_DATA*/',data(root/'original-slide.png','image/png'))
css=(root/'vendor/katex.min.css').read_text()
css=re.sub(r',url\(fonts/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)','',css)
css=re.sub(r'url\(fonts/([^)]*\.woff2)\)',lambda m:'url('+data(root/'vendor/fonts'/m[1],'font/woff2')+')',css)
html=html.replace('<!--KATEX_CSS-->','<style>'+css+'</style>')
html=html.replace('<!--KATEX_JS-->','<script>'+(root/'vendor/katex.min.js').read_text()+'</script>')
assert '/*ORIGINAL_DATA*/' not in html
assert not re.search(r'<(?:script|img|link)[^>]+(?:src|href)=["\']https?://',html)
assert not re.search(r'url\((?!data:)',css)
out=root.parent/(sys.argv[1] if len(sys.argv)>1 else 'tocsy.html');out.write_text(html)
print(f'{out}: {out.stat().st_size:,} bytes; image, scripts, styles and all formula fonts embedded.')
