"""Build a self-contained offline lesson; vendor assets and source image stay editable."""
from pathlib import Path
import base64, re
from PIL import Image

ROOT=Path(__file__).resolve().parent
def data(path,mime):
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
im=Image.open(ROOT/'original.png')
im.crop((655,565,1075,738)).save(ROOT/'structure-crop.png')
css=(ROOT/'vendor/katex.min.css').read_text()
def fonts(match):
    f=match.group(1)
    if f.endswith('.woff2'):
        return 'url('+data(ROOT/'vendor'/f,'font/woff2')+')'
    return 'url('+data(ROOT/'vendor'/f,'font/woff' if f.endswith('.woff') else 'font/ttf')+')' if (ROOT/'vendor'/f).exists() else 'url(data:application/octet-stream;base64,)'
# Keep only woff2 font alternatives. The vendor CSS includes all three formats.
css=re.sub(r',url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)','',css)
css=re.sub(r'url\((fonts/[^)]+)\)',fonts,css)
page=(ROOT/'template.html').read_text()
for token,value in {
    '<!--STYLE-->':'<style>'+(ROOT/'style.css').read_text()+'</style>',
    '<!--KATEX_CSS-->':'<style>'+css+'</style>',
    '<!--KATEX_JS-->':'<script>'+(ROOT/'vendor/katex.min.js').read_text()+'</script>',
    '<!--MODEL-->':'<script>'+(ROOT/'model.js').read_text()+'</script>',
    '<!--APP-->':'<script>'+(ROOT/'app.js').read_text()+'</script>',
    '@@ORIGINAL@@':data(ROOT/'original.png','image/png'),
    '@@CROP@@':data(ROOT/'structure-crop.png','image/png')
}.items():
    page=page.replace(token,value)
assert '<!--APP-->' not in page and '@@ORIGINAL@@' not in page
assert not re.search(r'(?:src|url)=["\']https?://',page)
(ROOT.parent/'index.html').write_text(page)
print('Built',ROOT.parent/'index.html',len(page.encode()),'bytes')
