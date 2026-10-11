# -*- coding: utf-8 -*-
"""生成 preview.png：折叠区默认收起、三栏内部各有滚动条，直接截图看不到大部分内容。
   预览时临时展开所有 <details>、取消工作台固定高度与内部滚动，一张图看全版式。"""
import os, subprocess, tempfile, sys
import numpy as np
from PIL import Image
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'COSY解读-可视化讲解.html'
W, H = 1560, 14000

src = open(PAGE, encoding='utf-8').read()
inject = """<script>
setTimeout(function(){
  document.querySelectorAll('details').forEach(function(d){ d.open = true; });
  var b = document.getElementById('bench');
  if (b){ b.style.height = 'auto'; b.style.minHeight = '0'; }
  document.querySelectorAll('.col').forEach(function(c){
    c.style.overflow = 'visible'; c.style.height = 'auto'; c.style.maxHeight = 'none';
  });
  document.querySelectorAll('.col h2').forEach(function(h){ h.style.position = 'static'; });
  if (window.__redraw) window.__redraw();
}, 900);
</script>
</body>"""
tmp = os.path.join(tempfile.gettempdir(), '_cosy_preview.html')
open(tmp, 'w', encoding='utf-8').write(src.replace('</body>', inject, 1))

shot = os.path.join(tempfile.gettempdir(), '_cosy_preview_raw.png')
if os.path.exists(shot): os.remove(shot)
cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
       '--user-data-dir=' + os.path.join(tempfile.gettempdir(), 'chrome-cosy-prev'),
       '--force-device-scale-factor=1', '--window-size=%d,%d' % (W, H),
       '--virtual-time-budget=20000', '--screenshot=' + shot, 'file://' + tmp]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try: p.wait(timeout=120)
except subprocess.TimeoutExpired: p.kill(); p.wait()
assert os.path.exists(shot), '截图失败'

im = Image.open(shot).convert('RGB'); a = np.array(im)
bg = np.array([14, 17, 22])
d = np.abs(a.astype(int) - bg).sum(axis=2)
rows = np.nonzero((d > 12).any(axis=1))[0]
cols = np.nonzero((d > 12).any(axis=0))[0]
y1 = min(a.shape[0], rows[-1] + 26)
x0 = max(0, cols[0] - 8); x1 = min(a.shape[1], cols[-1] + 9)
out = im.crop((x0, 0, x1, y1))
out.save('preview.png')
print('preview.png', out.size, '| 内容底部', rows[-1])
