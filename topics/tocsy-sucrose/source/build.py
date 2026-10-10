"""Build self-contained HTML. Python 3 + Pillow; supply a local KaTeX dist directory."""
from pathlib import Path
from PIL import Image
import base64,re,sys,subprocess,tempfile
root=Path(__file__).resolve().parent
out=root.parent
katex=Path(sys.argv[1]) if len(sys.argv)>1 else root/'vendor'/'katex'
def data(path):return 'data:image/png;base64,'+base64.b64encode(Path(path).read_bytes()).decode()
image=Image.open(root/'original.png')
crops={'SPECTRUM_CROP':(995,222,2160,1039),'RED_CROP':(1780,255,2135,435),'F1_CROP':(1880,235,2010,520)}
html=(root/'template.html').read_text()
with tempfile.TemporaryDirectory() as temp:
    for name,box in crops.items():
        p=Path(temp)/(name+'.png');image.crop(box).save(p)
        html=html.replace('__'+name+'__',data(p))
html=html.replace('__ORIGINAL__',data(root/'original.png'))
# Reuse the supplied skill builder, then embed its offline font files into one HTML.
builder=Path('/Users/baobei/.agents/skills/math-visual-explainer/scripts/build_katex_page.py')
if builder.exists():
    with tempfile.TemporaryDirectory() as temp:
        t=Path(temp)/'template.html';t.write_text(html)
        subprocess.run([sys.executable,str(builder),str(t),temp,'--dist',str(katex),'--name','index.html'],check=True,capture_output=True)
        html=(Path(temp)/'index.html').read_text()
        html=re.sub(r'url\(katex-fonts/([^)]*)\)',lambda m:'url(data:font/woff2;base64,'+base64.b64encode((Path(temp)/'katex-fonts'/m[1]).read_bytes()).decode()+')',html)
else:
    css=(katex/'katex.min.css').read_text()
    css=re.sub(r',url\(fonts/[^)]+\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)','',css)
    css=re.sub(r'url\(fonts/([^)]*)\)',lambda m:'url(data:font/woff2;base64,'+base64.b64encode((katex/'fonts'/m[1]).read_bytes()).decode()+')',css)
    html=html.replace('<!--KATEX_CSS-->','<style>'+css+'</style>').replace('<!--KATEX_JS-->','<script>'+(katex/'katex.min.js').read_text()+'</script>')
assert '__ORIGINAL__' not in html and '__SPECTRUM_CROP__' not in html
(out/'index.html').write_text(html)
print('Built',out/'index.html','bytes:',(out/'index.html').stat().st_size)
