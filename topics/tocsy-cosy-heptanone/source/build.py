from pathlib import Path
import re,base64,sys
root=Path(__file__).resolve().parent
out=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent/'index.html'
css=(root/'vendor/katex.min.css').read_text()
def font(m):
 p=root/'vendor'/m.group(1)
 mime='font/woff2' if p.suffix=='.woff2' else 'font/woff' if p.suffix=='.woff' else 'font/ttf'
 return 'url(data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()+')'
# Retain only WOFF2 to make a portable, compact single file.
css=re.sub(r',url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)','',css)
css=re.sub(r'url\((fonts/[^)]+)\)',font,css)
original='data:image/png;base64,'+base64.b64encode((root/'original-slide.png').read_bytes()).decode()
html=(root/'template.html').read_text()
for a,b in {'<!--KATEX_CSS-->':'<style>'+css+'</style>','<!--KATEX_JS-->':'<script>'+(root/'vendor/katex.min.js').read_text()+'</script>','<!--STYLE-->':'<style>'+(root/'styles.css').read_text()+'</style>','<!--CORE-->':(root/'core.js').read_text(),'<!--APP-->':(root/'app.js').read_text(),'<!--ORIGINAL-->':original}.items():html=html.replace(a,b)
assert not re.search(r'(?:src|href)="https?://[^" ]+"',html.replace('href="https://nmr.chem.columbia.edu/content/tocsy"','').replace('href="https://nmr.chem.ox.ac.uk/tocsy"',''))
assert '<!--CORE-->' not in html
out.write_text(html)
print(f'Built {out}: {out.stat().st_size:,} bytes. Images, scripts, CSS and math fonts embedded.')
