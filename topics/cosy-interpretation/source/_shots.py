# -*- coding: utf-8 -*-
import os, re, subprocess, tempfile, json, time
from PIL import Image
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL = 'file://' + os.path.abspath('COSY解读-可视化讲解.html')
UD = os.path.join(tempfile.gettempdir(), 'chrome-cosy-lean')

def shot(url, w, h, out, budget=9000):
    if os.path.exists(out): os.remove(out)
    p = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--user-data-dir=' + UD, '--force-device-scale-factor=1', '--window-size=%d,%d' % (w, h),
        '--virtual-time-budget=%d' % budget, '--screenshot=' + out, url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: p.wait(timeout=70)
    except subprocess.TimeoutExpired: p.kill(); p.wait()
    print(out, Image.open(out).size if os.path.exists(out) else 'FAILED')

wrap = os.path.join(tempfile.gettempdir(), '_wrap390b.html')
open(wrap, 'w', encoding='utf-8').write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
  'html,body{margin:0;background:#0e1116}iframe{width:390px;height:3000px;border:0;display:block}'
  '</style></head><body><iframe src="' + URL + '"></iframe></body></html>')
shot('file://' + wrap, 520, 3000, '_probe/w390.png')
shot(URL, 1280, 900, '_probe/w1280.png')

probe = """<script>window.addEventListener('load',function(){setTimeout(function(){
 var d=document.documentElement, cols=document.querySelectorAll('.col'); var o={sw:d.scrollWidth, cw:d.clientWidth,
 bench:Math.round(document.getElementById('bench').getBoundingClientRect().height), win:window.innerHeight,
 colScroll:[].map.call(cols,function(c){return c.scrollHeight>c.clientHeight;}), wide:[]};
 [].forEach.call(document.querySelectorAll('.wrap *'),function(e){var r=e.getBoundingClientRect();
   if(r.width>0&&(r.left<-2||r.right>d.clientWidth+2)) o.wide.push((e.className||e.tagName)+':'+Math.round(r.left)+'..'+Math.round(r.right));});
 var x=document.createElement('div'); x.id='PROBEJSON'; x.textContent=JSON.stringify(o);
 document.body.insertBefore(x,document.body.firstChild);},600);});</script></body>"""
src = open('COSY解读-可视化讲解.html', encoding='utf-8').read()
tp = os.path.join(tempfile.gettempdir(), '_cosy_probe2.html')
open(tp, 'w', encoding='utf-8').write(src.replace('</body>', probe, 1))
for w in (1560, 1280, 760):
    dom = os.path.join(tempfile.gettempdir(), '_cosy_p2_%d.html' % w)
    fh = open(dom, 'w', encoding='utf-8')
    p = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--user-data-dir=' + UD,
        '--window-size=%d,900' % w, '--virtual-time-budget=5000', '--dump-dom', 'file://' + tp],
        stdout=fh, stderr=subprocess.DEVNULL)
    t0 = time.time()
    while time.time() - t0 < 35:
        if p.poll() is not None: break
        time.sleep(0.3); fh.flush()
        try:
            if 'PROBEJSON' in open(dom, encoding='utf-8', errors='replace').read(): break
        except OSError: pass
    if p.poll() is None: p.kill(); p.wait()
    fh.close()
    s = open(dom, encoding='utf-8', errors='replace').read()
    m = re.search(r'<div id="PROBEJSON">(.*?)</div>', s, re.S)
    if m:
        o = json.loads(m.group(1).replace('&quot;', '"'))
        print('宽度 %4d : scrollWidth=%d clientWidth=%d -> %s | 三栏独立滚动 %s | bench=%d win=%d | 越界 %d %s'
              % (w, o['sw'], o['cw'], '无横向溢出' if o['sw'] <= o['cw']+1 else '有横向溢出!',
                 o['colScroll'], o['bench'], o['win'], len(o['wide']), o['wide'][:3]))
    else:
        print('宽度 %4d : 探针未跑出' % w)
