# -*- coding: utf-8 -*-
"""交互回归测试：把测试探针注入已构建的页面，用无头 Chrome + --dump-dom 跑一遍。
   覆盖：位点选择（按钮/骨架/2D 峰/矩阵/键盘）、τm、OH 开关、COSY 对照、阈值、
        位移打乱与重置、原图放大、错误条、外链检查、多重峰随耦合开关的变化。

   注意 1：无头 --dump-dom 模式下 requestAnimationFrame 可能完全不触发，
           所以测试等待一律用 setTimeout（页面侧也有 setTimeout 兜底）。
   注意 2：Chrome 无头窗口最小宽度约 500px；要测手机版式请用 iframe 包一层，
           见 _shots.sh 里的 wrap390.html 做法。
"""
import os, re, subprocess, sys, tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'TOCSY正丙醇-可视化讲解.html'

PROBE = r"""
<script>
(function(){
  var LOG = [];
  function ok(n,c,e){ LOG.push((c?'PASS':'FAIL')+' :: '+n+(e!==undefined?(' :: '+e):'')); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function frames(n){ return new Promise(function(res){ setTimeout(res, 30*n); }); }
  function setRange(id,v){ var e=document.getElementById(id); e.value=String(v); e.dispatchEvent(new Event('input',{bubbles:true})); }
  function setCheck(id,v){ var e=document.getElementById(id); e.checked=v; e.dispatchEvent(new Event('change',{bubbles:true})); }
  function visRows(){ return Array.prototype.filter.call(document.querySelectorAll('#tblAll tbody tr'),
      function(tr){ return tr.children[9].textContent.trim()==='可见'; }).length; }
  function rows(){ return document.querySelectorAll('#tblAll tbody tr').length; }
  function title(){ return document.getElementById('roTitle').textContent; }
  function ct(){ return document.getElementById('tblCount').textContent.replace(/\s+/g,''); }
  function peaks(){ return (document.getElementById('cv2d')._peaks||[]).length; }
  window.addEventListener('load', async function(){
   try{
    await sleep(400); await frames(4);
    ok('T1 归属表 16 行', rows()===16, 'rows='+rows());
    ok('T1 初始 16/16 方块', ct().indexOf('谱图方块数（含镜像）1616')>=0);
    ok('T1 默认选中 C1', title().indexOf('C1')>=0, title());
    ok('T1 页内自检全部通过', document.getElementById('selftestBox').textContent.indexOf('全部通过')>=0);

    document.getElementById('sb3').click(); await frames(3);
    ok('T2 位点按钮切到 C3', title().indexOf('C3')>=0, title());

    setRange('sTau',25); await frames(3);
    ok('T3 tau=25ms 可见峰变少', visRows()<12 && visRows()>=6, 'vis='+visRows());
    setRange('sTau',80); await frames(3);
    ok('T4 tau=80ms 全部可见', visRows()===16, 'vis='+visRows());

    setCheck('cbOH',false); await frames(3);
    ok('T5 OH 去耦 -> 9 行', rows()===9, 'rows='+rows());
    ok('T5 OH 去耦 -> 9/9 方块', ct().indexOf('谱图方块数（含镜像）99')>=0);
    setCheck('cbOH',true); await frames(3);
    ok('T6 恢复 16 行', rows()===16, 'rows='+rows());

    setCheck('cbMode',true); await frames(2);
    ok('T7 COSY 对照 -> 10/16 方块', ct().indexOf('谱图方块数（含镜像）1610')>=0);
    ok('T7b COSY 画布 10 峰', peaks()===10, 'peaks='+peaks());
    setCheck('cbMode',false); await frames(2);
    ok('T7c TOCSY 画布 16 峰', peaks()===16, 'peaks='+peaks());

    setRange('sThr',0.45); await frames(3);
    ok('T8 阈值 0.45 -> 少于 16', ct().indexOf('谱图方块数（含镜像）1616')<0);
    setRange('sThr',0.05); await frames(3);

    var cv=document.getElementById('cv2d'), r=cv.getBoundingClientRect(), ps=cv._peaks||[], t=null;
    for(var i=0;i<ps.length;i++) if(ps[i].k===0&&ps[i].j===3) t=ps[i];
    ok('T9 画布暴露 16 峰', ps.length===16, 'peaks='+ps.length);
    if(t){ cv.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,
        clientX:r.left+t.x*(r.width/cv._w), clientY:r.top+t.y*(r.height/cv._h)})); await frames(3);
      ok('T9 点 (OH,C3) 峰', title().indexOf('–OH')>=0&&title().indexOf('C3')>=0, title()); }

    var cs=document.getElementById('cvStruct'), rs=cs.getBoundingClientRect(), nd=cs._nodes;
    cs.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,
      clientX:rs.left+nd[2].x*(rs.width/cs._w), clientY:rs.top+nd[2].y*(rs.height/cs._h)}));
    await frames(3);
    ok('T10 点骨架 C2 方块', title().indexOf('C2')>=0, title());

    var cell=document.querySelector('#tblM td.cell[data-k="0"][data-j="3"]');
    ok('T11 矩阵有 (0,3) 格', !!cell);
    if(cell){ cell.click(); await frames(3);
      ok('T11 点矩阵格切选中对', title().indexOf('OH')>=0&&title().indexOf('C3')>=0, title()); }

    document.dispatchEvent(new KeyboardEvent('keydown',{key:'2',bubbles:true})); await frames(3);
    ok('T12 键 2 -> 第 2 个位点 C1', title().indexOf('C1')>=0, title());
    var a=document.getElementById('vTau').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); await frames(3);
    ok('T12 键 ↑ 增加 2ms', parseInt(document.getElementById('vTau').textContent)-parseInt(a)===2);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); await frames(3);
    ok('T12 键 → 轮换位点', title()!=='', title());

    setRange('sTau',80); await frames(3);
    var b4=ct();
    document.getElementById('bScramble').click(); await frames(3);
    ok('T13 打乱位移后拓扑不变', b4===ct());
    ok('T13 位移确实变了', document.getElementById('vd0').textContent!=='2.20 ppm',
       document.getElementById('vd0').textContent);
    document.getElementById('bResetD').click(); await frames(3);
    ok('T14 重置回 2.20', document.getElementById('vd0').textContent==='2.20 ppm');

    document.querySelector('[data-zoom="struct"]').click(); await frames(2);
    ok('T15 结构式区域放大', parseFloat(document.getElementById('vZoom').textContent)>2,
       document.getElementById('vZoom').textContent);
    ok('T15 原图是内嵌 data URI',
       document.getElementById('origimg').getAttribute('src').indexOf('data:image/webp;base64,')===0);
    document.querySelector('[data-zoom="page"]').click(); await frames(2);

    ok('T16 无 JS 错误条', document.getElementById('errbar').style.display!=='block',
       document.getElementById('errbar').textContent);
    ok('T16 无 <img> 外链',
       Array.prototype.every.call(document.images,function(im){return im.src.indexOf('data:')===0;}));

    document.getElementById('sb1').click(); await frames(3);
    var n1=document.getElementById('roBox').textContent;
    setCheck('cbOH',false); await frames(3);
    var n2=document.getElementById('roBox').textContent;
    ok('T17 C1 多重峰 6 线 -> 3 线',
       n1.replace(/\s+/g,'').indexOf('多重峰线数6')>=0 && n2.replace(/\s+/g,'').indexOf('多重峰线数3')>=0);
    setCheck('cbOH',true); await frames(3);

    /* ---------- T18 工作台：三栏各自滚动 ---------- */
    var bench = document.getElementById('bench'), colL = document.getElementById('colL'), colM = document.getElementById('colM');
    var bh = bench.getBoundingClientRect().height;
    ok('T18 工作台固定高度', bh > 400 && bh <= window.innerHeight, 'benchH=' + Math.round(bh) + ' win=' + window.innerHeight);
    ok('T18 左栏可独立滚动', colL.scrollHeight > colL.clientHeight + 5, 'sh=' + colL.scrollHeight + ' ch=' + colL.clientHeight);
    ok('T18 中栏可独立滚动', colM.scrollHeight > colM.clientHeight + 5, 'sh=' + colM.scrollHeight + ' ch=' + colM.clientHeight);

    /* ---------- T19 步骤引导 ---------- */
    var g0 = document.getElementById('gPos').textContent;
    document.getElementById('gNext').click(); await frames(3);
    ok('T19 下一步换题', document.getElementById('gPos').textContent !== g0,
       g0 + ' -> ' + document.getElementById('gPos').textContent);
    document.getElementById('gReveal').click(); await frames(2);
    ok('T19 看答案显示', document.getElementById('gAns').hidden === false &&
       document.getElementById('gAns').textContent.length > 20);
    var navb = document.querySelectorAll('#gNav [data-st]');
    ok('T19 步骤导航 7 个', navb.length === 7, 'n=' + navb.length);
    navb[4].click(); await frames(3);
    ok('T19 第5步自动去耦 OH', document.getElementById('cbOH').checked === false);
    ok('T19 第5步归属表 9 行', rows() === 9, 'rows=' + rows());
    navb[5].click(); await frames(3);
    ok('T19 第6步自动开 COSY 并复原 OH',
       document.getElementById('cbMode').checked === true && document.getElementById('cbOH').checked === true);
    ok('T19 第6步 10 个方块', ct().indexOf('谱图方块数（含镜像）1610') >= 0,
       ct().slice(-46) + ' | oh=' + document.getElementById('cbOH').checked + ' cosy=' + document.getElementById('cbMode').checked);
    navb[0].click(); await frames(3);
    ok('T19 回到第 1 步', document.getElementById('gPos').textContent.indexOf('1 /') === 0);

    /* ---------- T20 官能团卡 ---------- */
    var gc = document.querySelectorAll('#gcards .gcard');
    ok('T20 四张官能团卡', gc.length === 4, 'n=' + gc.length);
    ok('T20 每张都有结构小图', document.querySelectorAll('#gcards svg').length === 4);
    var gt = document.getElementById('gcards').textContent;
    ok('T20 卡片有中英文名', gt.indexOf('羟基') >= 0 && gt.indexOf('methyl') >= 0 && gt.indexOf('亚甲基') >= 0);
    gc[3].click(); await frames(3);
    ok('T20 点卡片选中甲基', title().indexOf('C3') >= 0, title());
    gc[0].click(); await frames(3);
    ok('T20 点卡片选中羟基', title().indexOf('OH') >= 0, title());

    /* ---------- T21 术语提示 ---------- */
    var nTerm = document.querySelectorAll('.term[data-def]').length;
    ok('T21 术语自动标注 > 20 处', nTerm > 20, 'n=' + nTerm);
    var term = document.querySelector('.col .term[data-def]') || document.querySelector('.term[data-def]');
    if (term) {
      term.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await frames(2);
      var tip = document.getElementById('tip');
      ok('T21 悬停弹解释', tip.style.display === 'block' && tip.textContent.length > 5, tip.textContent.slice(0, 24));
      term.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      await frames(2);
      ok('T21 移开收起', tip.style.display === 'none');
    } else ok('T21 找到术语节点', false);

    /* ---------- T22 官能团标注开关 ---------- */
    var cbG = document.getElementById('cbGroup');
    ok('T22 有官能团标注开关', !!cbG);
    if (cbG) {
      setCheck('cbGroup', false); await frames(2);
      ok('T22 可关闭', cbG.checked === false);
      setCheck('cbGroup', true); await frames(2);
      ok('T22 可再打开', cbG.checked === true);
    }
   }catch(err){ LOG.push('FAIL :: 测试脚本异常 :: '+(err&&err.message)); }
   var d=document.createElement('div'); d.id='TESTLOG';
   d.textContent='TESTSTART'+'%%'+LOG.join(' ;; ')+'%%'+'TESTEND';
   document.body.insertBefore(d,document.body.firstChild);
  });
})();
</script>
</body>"""


def main():
    src = open(PAGE, encoding='utf-8').read()
    assert '</body>' in src, '页面里找不到 </body>'
    tmp_html = os.path.join(tempfile.gettempdir(), '_itest.html')
    open(tmp_html, 'w', encoding='utf-8').write(src.replace('</body>', PROBE, 1))
    dom = os.path.join(tempfile.gettempdir(), '_itest_dom.html')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
           '--user-data-dir=' + os.path.join(tempfile.gettempdir(), 'chrome-itest'),
           '--window-size=1560,900', '--virtual-time-budget=30000',
           '--dump-dom', 'file://' + tmp_html]
    # Chrome 写完 DOM 后经常不退出（headless=new 的已知行为）：
    # 直接写文件 + 轮询等待结果出现 + 到点强杀，避免 subprocess.run 白等或丢输出。
    fh = open(dom, 'w', encoding='utf-8')
    proc = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.DEVNULL)
    import time
    deadline = time.time() + 120
    got = False
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        time.sleep(0.5)
        fh.flush()
        try:
            with open(dom, encoding='utf-8', errors='replace') as g:
                if 'TESTLOG' in g.read():
                    got = True
                    break
        except OSError:
            pass
    if proc.poll() is None:
        proc.kill(); proc.wait()
    fh.close()
    print('DOM 已写出:', got)
    s = open(dom, encoding='utf-8', errors='replace').read()
    m = re.search(r'<div id="TESTLOG">(.*?)</div>', s, re.S)
    if not m:
        print('NO TESTLOG —— 页面可能在测试完成前就 dump 了'); return 1
    import html as _h
    parts = [p.strip() for p in _h.unescape(m.group(1)).split(' ;; ') if p.strip()]
    for p in parts:
        print(p[:200])
    npass = sum(p.startswith('PASS') for p in parts)
    nfail = sum(p.startswith('FAIL') for p in parts)
    print('----')
    print('PASS=%d FAIL=%d' % (npass, nfail))
    print('KaTeX 已渲染的公式块:', s.count('katex-html'))
    return 0 if nfail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
