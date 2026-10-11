# -*- coding: utf-8 -*-
"""交互回归测试：把探针注入已构建页面，用无头 Chrome + --dump-dom 真跑一遍。
   覆盖：候选分子切换、三个滑块、CH2 开关、打乱/复位、画布点击（骨架/2D）、峰清单点行、
         官能团卡、键盘、步骤自动设状态、术语提示、原图缩放、错误条、外链、组合测试。
   注意：无头 --dump-dom 下 requestAnimationFrame 可能不触发，等待一律用 setTimeout。"""
import os, re, subprocess, sys, tempfile, time, html as _h

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'COSY解读-可视化讲解.html'

PROBE = r"""
<script>
(function(){
  var LOG = [];
  function ok(n,c,e){ LOG.push((c?'PASS':'FAIL')+' :: '+n+(e!==undefined?(' :: '+e):'')); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function F(n){ return sleep(30*(n||3)); }
  function setRange(id,v){ var e=document.getElementById(id); e.value=String(v); e.dispatchEvent(new Event('input',{bubbles:true})); }
  function setCheck(id,v){ var e=document.getElementById(id); e.checked=v; e.dispatchEvent(new Event('change',{bubbles:true})); }
  function rows(){ return document.querySelectorAll('#tblPeaks tbody tr').length; }
  function visRows(){ return Array.prototype.filter.call(document.querySelectorAll('#tblPeaks tbody tr'),
      function(tr){ return tr.children[5].textContent.trim()==='可见'; }).length; }
  function title(){ return document.getElementById('roTitle').textContent; }
  function sum(){ return document.getElementById('peakSummary').textContent.replace(/\s+/g,''); }
  function f1col(i){ return document.querySelectorAll('#tblPeaks tbody tr')[i].children[1].textContent; }
  window.addEventListener('load', async function(){
   try{
    await sleep(500); await F(4);
    ok('T1 峰清单 16 行（含 2 个低于阈值的 4J 峰）', rows()===16, 'rows='+rows());
    ok('T1 可见 14 个（= 原图实测）', visRows()===14, 'vis='+visRows());
    ok('T1 摘要里写着原图实测 14', sum().indexOf('原图实测14')>=0, sum().slice(-40));
    ok('T1 默认选中位点 1', title().indexOf('C1H3')>=0, title());
    ok('T1 页内自检全部通过', document.getElementById('selftestBox').textContent.indexOf('全部通过')>=0);
    document.getElementById('bMolA').click(); await F(3);
    ok('T2 候选 A -> 11 行', rows()===11, 'rows='+rows());
    ok('T2 候选 A 提示不符', document.getElementById('molNote').textContent.indexOf('不符')>=0);
    document.getElementById('bMolB').click(); await F(3);
    ok('T3 回到候选 B -> 16 行', rows()===16, 'rows='+rows());
    ok('T3 候选 B 提示相符', document.getElementById('molNote').textContent.indexOf('相符')>=0);
    setRange('sJ4', 0); await F(3);
    ok('T4 4J=0 -> 14 行（那条边消失）', rows()===14, 'rows='+rows());
    setRange('sJ4', 3); await F(3);
    ok('T5 4J=3Hz -> 16 行且全可见', rows()===16 && visRows()===16, 'rows='+rows()+' vis='+visRows());
    setRange('sJ4', 0.5); await F(3);
    ok('T6 4J=0.5Hz -> 16 行但只 14 个可见', rows()===16 && visRows()===14, 'rows='+rows()+' vis='+visRows());
    var v0 = document.getElementById('vDW').textContent;
    setRange('sDW', 6); await F(3);
    ok('T7 线宽读数跟着变', document.getElementById('vDW').textContent!==v0, document.getElementById('vDW').textContent);
    setRange('sDW', 1.5); setRange('sThr', 0.25); await F(3);
    ok('T8 阈值降到 0.25 -> 16 个全可见', visRows()===16, 'vis='+visRows());
    setRange('sThr', 0.5); setRange('sDW', 1.5); await F(3);
    ok('T9 复位阈值/线宽 -> 14 可见', visRows()===14, 'vis='+visRows());
    setCheck('cbCH2', true); await F(3);
    ok('T10 打开假想 CH2 -> 19 行', rows()===19, 'rows='+rows());
    setCheck('cbCH2', false); await F(3);
    ok('T11 关掉 -> 16 行', rows()===16, 'rows='+rows());
    var before = f1col(0), cnt = rows();
    document.getElementById('bScramble').click(); await F(3);
    ok('T12 打乱位移：行数不变', rows()===cnt, 'rows='+rows());
    ok('T12 打乱位移：δ 真的变了', f1col(0)!==before, before+' -> '+f1col(0));
    document.getElementById('bReset').click(); await F(3);
    ok('T13 复位后 δ 回到初始', f1col(0)===before, f1col(0));


    setRange('sDW', 4.0); await F(2);
    ok('T14 只改线宽：候选/4J/阈值不变', document.getElementById('bMolB').className.indexOf('on')>=0 &&
       Math.abs(parseFloat(document.getElementById('sJ4').value)-0.5)<1e-9 &&
       Math.abs(parseFloat(document.getElementById('sThr').value)-0.5)<1e-9);
    var f1a = f1col(1);
    setRange('sThr', 0.7); await F(2);
    ok('T15 只改阈值：峰位一列不变', f1col(1)===f1a, f1a+' -> '+f1col(1));
    document.getElementById('bMolA').click(); await F(2);
    ok('T16 只换候选：线宽/4J/阈值不变', Math.abs(parseFloat(document.getElementById('sDW').value)-4.0)<1e-9 &&
       Math.abs(parseFloat(document.getElementById('sJ4').value)-0.5)<1e-9 && Math.abs(parseFloat(document.getElementById('sThr').value)-0.7)<1e-9);
    document.getElementById('bReset').click(); await F(3);
    var cs = document.getElementById('cvStruct'), rs = cs.getBoundingClientRect(), nd = cs._nodes || [];
    ok('T17 骨架暴露 6 个位点命中区', nd.length===6, 'n='+nd.length);
    if (nd.length>=4){
      cs.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,
        clientX:rs.left+nd[3].x*(rs.width/cs._w), clientY:rs.top+nd[3].y*(rs.height/cs._h)}));
      await F(3);
      ok('T17 点骨架第 4 个方块 -> 选中 C5H2', title().indexOf('C5H2')>=0, title());
    }
    var c2 = document.getElementById('cv2d'), r2 = c2.getBoundingClientRect(), ps = c2._peaks || [];
    ok('T18 2D 画布暴露 16 个峰', ps.length===16, 'n='+ps.length);
    var tgt = null;
    for (var i=0;i<ps.length;i++) if (ps[i].k===0 && ps[i].j===1) tgt = ps[i];
    if (tgt){
      c2.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,
        clientX:r2.left+tgt.x*(r2.width/c2._w), clientY:r2.top+tgt.y*(r2.height/c2._h)}));
      await F(3);
      ok('T18 点交叉峰 -> 右栏显示交叉峰', title().indexOf('交叉峰')>=0, title());
    } else ok('T18 找到 (0,1) 交叉峰', false);
    var tr = document.querySelectorAll('#tblPeaks tbody tr')[3];
    tr.click(); await F(3);
    ok('T19 点峰清单第 4 行 -> 选中某个峰', title().length>2, title());
    var gc = document.querySelectorAll('#gcards .gcard');
    ok('T20 六张官能团卡', gc.length===6, 'n='+gc.length);
    ok('T20 每张都有画着氢的小结构图', document.querySelectorAll('#gcards svg').length===6);
    if (gc.length>=2){ gc[1].click(); await F(3); ok('T20 点第 2 张卡 -> 选中 C2H2', title().indexOf('C2H2')>=0, title()); }
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'5',bubbles:true})); await F(2);
    ok('T21 键 5 -> 第 5 个位点 C6H2', title().indexOf('C6H2')>=0, title());
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); await F(2);
    ok('T21 键右键 -> 轮换位点', title().indexOf('C7H3')>=0, title());
    var dwv = parseFloat(document.getElementById('sDW').value);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); await F(2);
    ok('T21 键上 -> 线宽 +0.1', Math.abs(parseFloat(document.getElementById('sDW').value)-dwv-0.1)<1e-9,
       dwv+' -> '+document.getElementById('sDW').value);
    var nav = document.querySelectorAll('#gNav [data-st]');
    ok('T22 步骤导航 7 个', nav.length===7, 'n='+nav.length);


    document.querySelectorAll('#gNav [data-st]')[4].click(); await F(3);
    ok('T23 第 5 步自动打开假想 CH2', document.getElementById('cbCH2').checked===true);
    ok('T23 第 5 步 -> 19 行', rows()===19, 'rows='+rows());
    document.querySelectorAll('#gNav [data-st]')[2].click(); await F(3);
    ok('T24 第 3 步自动设 4J=0.5 并选中 4J 交叉峰', Math.abs(parseFloat(document.getElementById('sJ4').value)-0.5)<1e-9 &&
       title().indexOf('交叉峰')>=0, document.getElementById('sJ4').value+' / '+title());
    document.querySelectorAll('#gNav [data-st]')[1].click(); await F(3);
    ok('T25 第 2 步选中交叉峰且候选回到 B', title().indexOf('交叉峰')>=0 &&
       document.getElementById('bMolB').className.indexOf('on')>=0, title());
    document.getElementById('gReveal').click(); await F(2);
    ok('T25 看答案展开', document.getElementById('gAns').hidden===false && document.getElementById('gAns').textContent.length>40);
    document.getElementById('gNext').click(); await F(3);
    ok('T26 下一步换题面', document.getElementById('gPos').textContent.indexOf('3 /')===0, document.getElementById('gPos').textContent);
    document.querySelectorAll('#gNav [data-st]')[0].click(); await F(3);
    var nTerm = document.querySelectorAll('.term[data-def]').length;
    ok('T27 术语自动标注 > 20 处', nTerm>20, 'n='+nTerm);
    var tm = document.querySelector('.col .term[data-def]');
    if (tm){
      tm.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); await F(2);
      var tip = document.getElementById('tip');
      ok('T27 悬停弹出解释', tip.style.display==='block' && tip.textContent.length>5, tip.textContent.slice(0,20));
      tm.dispatchEvent(new MouseEvent('mouseout',{bubbles:true})); await F(2);
      ok('T27 移开收起', tip.style.display==='none');
    } else ok('T27 找到术语节点', false);
    document.querySelector('[data-zoom="struct"]').click(); await F(2);
    ok('T28 结构式区域放大', parseFloat(document.getElementById('vZoom').textContent)>2, document.getElementById('vZoom').textContent);
    ok('T28 原图是内嵌 data URI', document.getElementById('origimg').getAttribute('src').indexOf('data:image/webp;base64,')===0);
    ok('T28 核对图也是内嵌', document.querySelector('img[alt="像素核对图"]').getAttribute('src').indexOf('data:image/webp;base64,')===0);
    document.querySelector('[data-zoom="page"]').click(); await F(2);
    var bench = document.getElementById('bench'), colL=document.getElementById('colL'), colM=document.getElementById('colM');
    var bh = bench.getBoundingClientRect().height;
    ok('T29 工作台固定高度', bh>400 && bh<=window.innerHeight, 'benchH='+Math.round(bh)+' win='+window.innerHeight);
    ok('T29 左栏可独立滚动', colL.scrollHeight>colL.clientHeight+5, colL.scrollHeight+'>'+colL.clientHeight);
    ok('T29 中栏可独立滚动', colM.scrollHeight>colM.clientHeight+5, colM.scrollHeight+'>'+colM.clientHeight);
    setRange('sThr',0.5); setRange('sDW',1.5); setRange('sJ4',0.5); await F(3);
    ok('T30 可见峰数 = 原图实测 14', visRows()===14, 'vis='+visRows());
    ok('T31 无 JS 错误条', document.getElementById('errbar').style.display!=='block',
       document.getElementById('errbar').textContent);
    ok('T31 页面里没有外链图片', Array.prototype.every.call(document.images,function(im){return im.src.indexOf('data:')===0;}));
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
    assert '</body>' in src
    tmp_html = os.path.join(tempfile.gettempdir(), '_cosy_itest.html')
    open(tmp_html, 'w', encoding='utf-8').write(src.replace('</body>', PROBE, 1))
    dom = os.path.join(tempfile.gettempdir(), '_cosy_itest_dom.html')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
           '--user-data-dir=' + os.path.join(tempfile.gettempdir(), 'chrome-cosy-itest'),
           '--window-size=1560,900', '--virtual-time-budget=40000', '--dump-dom', 'file://' + tmp_html]
    fh = open(dom, 'w', encoding='utf-8')
    proc = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.DEVNULL)
    deadline = time.time() + 180
    got = False
    while time.time() < deadline:
        if proc.poll() is not None: break
        time.sleep(0.5); fh.flush()
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
    print('DOM written:', got)
    s = open(dom, encoding='utf-8', errors='replace').read()
    m = re.search(r'<div id="TESTLOG">(.*?)</div>', s, re.S)
    if not m:
        print('NO TESTLOG - page may have dumped before tests finished'); return 1
    parts = [p.strip() for p in _h.unescape(m.group(1)).split(' ;; ') if p.strip()]
    for p in parts: print(p[:220])
    npass = sum(p.startswith('PASS') for p in parts)
    nfail = sum(p.startswith('FAIL') for p in parts)
    print('----')
    print('PASS=%d FAIL=%d' % (npass, nfail))
    print('KaTeX rendered blocks:', s.count('katex-html'))
    return 0 if nfail == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
