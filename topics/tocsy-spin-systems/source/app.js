(() => {
'use strict';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const state={example:'slide',mode:'tocsy',mix:80,nh:true,weak:false,source:1,target:3};
const colors={acc:'#5fd0a8',blue:'#88bfff',amber:'#f0bc70',text:'#edf2f7',muted:'#b6c1ce',line:'#303a47'};
function el(tag,attrs={},content=''){const x=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,v);if(content)x.textContent=content;return x;}
function text(svg,x,y,content,attrs={}){svg.append(el('text',{x,y,fill:colors.muted,'font-size':16,...attrs},content));}
function line(svg,x1,y1,x2,y2,attrs={}){svg.append(el('line',{x1,y1,x2,y2,stroke:colors.line,'stroke-width':1,...attrs}));}
function config(){const ex=TOCSY.examples[state.example],edges=ex.edges(state.example==='slide'?state.nh:state.weak),n=ex.nodes.length;return {ex,edges,n,groups:TOCSY.components(n,edges),M:state.mode==='tocsy'?TOCSY.transfer(n,edges,state.mix):TOCSY.identity(n).map((row,i)=>row.map((v,j)=>i===j?1:edges.some(([a,b])=>a===i&&b===j||a===j&&b===i)?.35:0))};}
function marker(svg,x,y,value,type,selected=false){
  const color=type==='对角峰'?colors.acc:type==='直接相关'?colors.blue:colors.amber;
  if(value<1e-7){svg.append(el('circle',{cx:x,cy:y,r:1.5,fill:colors.line}));return;}
  const r=3+11*Math.sqrt(Math.min(1,value));
  const attrs={fill:type==='对角峰'?'none':color,stroke:selected?colors.text:color,'stroke-width':selected?2.5:1.6};
  if(type==='对角峰')svg.append(el('circle',{cx:x,cy:y,r,...attrs}));
  else if(type==='直接相关')svg.append(el('rect',{x:x-r,y:y-r,width:r*2,height:r*2,rx:2,...attrs}));
  else svg.append(el('polygon',{points:`${x},${y-r*1.15} ${x+r*1.15},${y} ${x},${y+r*1.15} ${x-r*1.15},${y}`,...attrs}));
}
function drawMatrix(c){
 const svg=$('matrix');svg.replaceChildren();svg.setAttribute('viewBox',state.example==='slide'?'0 0 440 425':'0 0 460 430');
 const left=62,top=38,size=state.example==='slide'?310:338;
 const xy=state.example==='slide'?c.ex.nodes.map(n=>({x:left+(3.6-n.delta)/1.7*size,y:top+(n.delta-1.9)/1.7*size})):c.ex.nodes.map((_,i)=>({x:left+(i+.5)*size/c.n,y:top+(i+.5)*size/c.n}));
 svg.append(el('rect',{x:left,y:top,width:size,height:size,fill:'#10161e',stroke:colors.line}));
 for(const p of xy){line(svg,p.x,top,p.x,top+size);line(svg,left,p.y,left+size,p.y);}
 line(svg,state.example==='slide'?left:left, state.example==='slide'?top+size:top,left+size,state.example==='slide'?top:top+size,{'stroke-dasharray':'5 5',stroke:'#738190'});
 line(svg,left,xy[state.source].y,left+size,xy[state.source].y,{stroke:colors.acc,'stroke-width':1.7});
 line(svg,xy[state.target].x,top,xy[state.target].x,top+size,{stroke:colors.acc,'stroke-width':1.7});
 if(state.example==='slide'){
   for(const d of [2,2.5,3,3.5]){const x=left+(3.6-d)/1.7*size,y=top+(d-1.9)/1.7*size;text(svg,x,top+size+25,d.toFixed(1),{'text-anchor':'middle','font-size':15});text(svg,left-10,y+5,d.toFixed(1),{'text-anchor':'end','font-size':15});}
   text(svg,left+size/2,top+size+62,'F₂ · ¹H 化学位移 / ppm',{'text-anchor':'middle','font-size':16});
   text(svg,15,15,'F₁ / ppm',{'font-size':13});
 }else{
   xy.forEach((p,i)=>{text(svg,p.x,top+size+22,c.ex.nodes[i].id,{'text-anchor':'middle','font-size':14});text(svg,left-7,p.y+4,c.ex.nodes[i].id,{'text-anchor':'end','font-size':14});});
   text(svg,left+size/2,top+size+48,'F₂ · 氢组编号（无原始 ppm）',{'text-anchor':'middle','font-size':15});text(svg,6,19,'F₁ · 氢组',{'font-size':12});
 }
 for(let i=0;i<c.n;i++)for(let j=0;j<c.n;j++){
   const x=xy[j].x,y=xy[i].y,type=TOCSY.classify(c.edges,i,j),g=el('g',{role:'gridcell',tabindex:i===state.source&&j===state.target?'0':'-1','data-i':i,'data-j':j,'aria-selected':String(i===state.source&&j===state.target),'aria-label':`${c.ex.nodes[i].id} 与 ${c.ex.nodes[j].id}，${c.M[i][j]>1e-7?type:'当前无可见模型峰'}，示意权重 ${c.M[i][j].toFixed(4)}`});
   g.append(el('title',{},`${c.ex.nodes[i].id} ↔ ${c.ex.nodes[j].id}`));
   const hit=c.n===4?40:34;
   g.append(el('rect',{x:x-hit/2,y:y-hit/2,width:hit,height:hit,fill:'transparent',class:'hit',stroke:i===state.source&&j===state.target?colors.acc:'none','stroke-width':1.5}));
   marker(g,x,y,c.M[i][j],type,i===state.source&&j===state.target);svg.append(g);
   g.addEventListener('click',()=>choose(i,j,true));
   g.addEventListener('keydown',e=>{
     let ni=i,nj=j;
     const xOrder=xy.map((_,k)=>k).sort((a,b)=>xy[a].x-xy[b].x),yOrder=xy.map((_,k)=>k).sort((a,b)=>xy[a].y-xy[b].y);
     const step=(order,k,d)=>order[(order.indexOf(k)+d+c.n)%c.n];
     if(e.key==='ArrowRight')nj=step(xOrder,j,1);else if(e.key==='ArrowLeft')nj=step(xOrder,j,-1);else if(e.key==='ArrowDown')ni=step(yOrder,i,1);else if(e.key==='ArrowUp')ni=step(yOrder,i,-1);else if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i,j,true);return;}else return;
     e.preventDefault();choose(ni,nj,true);
   });
 }
 if(state.example==='slide')xy.forEach((p,i)=>text(svg,p.x+12,p.y-14,c.ex.nodes[i].id,{'font-size':17,fill:colors.text,'font-weight':700,'paint-order':'stroke',stroke:'#10161e','stroke-width':4}));
 $('plotTitle').textContent=state.mode==='tocsy'?'TOCSY 相关图':'COSY 直接相关图';
 $('matrixCaption').textContent=state.example==='slide'?'坐标沿用截图估读值；点形、大小和有无来自当前模型。对角线从左下到右上；白色边框标出选中峰。':'仅用 G 编号排列相关矩阵；不是化学位移轴。位置代表含氢碳组，不模拟重叠、CH₂ 不等价或真实二维等高线。';
}
function drawStructure(c){
 const container=$('structure');container.replaceChildren();
 const formula=document.createElement('div');formula.className='structure-formula';formula.textContent=state.example==='slide'?'A:CH₃–C(=O)–B:CH₂–C:CH₂–D:NH₂':'C1–C2–C3–C4=C5(–C10)–C6–C7–C8–C9';container.append(formula);
 const svg=el('svg',{viewBox:state.example==='slide'?'0 0 480 160':'0 0 840 260',class:'structure-svg',role:'img','aria-label':'结构示意与氢组编号；选中氢组以方框显示'});
 if(state.example==='slide'){
   line(svg,48,48,425,48,{stroke:'#8694a4','stroke-width':2});
   text(svg,126,54,'C',{'text-anchor':'middle','font-size':19,fill:colors.text});line(svg,121,35,121,17);line(svg,130,35,130,17);text(svg,126,13,'O',{'text-anchor':'middle','font-size':17});
   const xs=[45,220,315,425],labels=['CH₃','CH₂','CH₂','NH₂'];
   xs.forEach((x,i)=>{svg.append(el('rect',{x:x-28,y:31,width:56,height:36,rx:5,fill:'#151a21',stroke:i===state.source||i===state.target?colors.acc:colors.line,'stroke-width':2}));text(svg,x,55,labels[i],{'text-anchor':'middle','font-size':18,fill:colors.text});text(svg,x,91,c.ex.nodes[i].id,{'text-anchor':'middle','font-size':16,fill:colors.acc});});
   for(const[a,b,k]of c.edges){line(svg,xs[a],119,xs[b],119,{stroke:k===20?colors.amber:colors.blue,'stroke-width':3});}
   text(svg,10,149,'下方线：可用耦合边；不是新的化学键',{'font-size':14});
 }else{
   const coords=[[48,122],[132,66],[216,122],[300,66],[468,66],[552,122],[636,66],[720,122],[384,202]],c5=[384,122];
   const carbonChain=[coords[0],coords[1],coords[2],coords[3],c5,coords[4],coords[5],coords[6],coords[7]];
   for(let i=0;i<8;i++)line(svg,...carbonChain[i],...carbonChain[i+1],{stroke:'#9facbb','stroke-width':2});
   line(svg,306,77,378,126,{stroke:'#9facbb','stroke-width':2});line(svg,...c5,...coords[8],{stroke:'#9facbb','stroke-width':2});
   svg.append(el('circle',{cx:c5[0],cy:c5[1],r:6,fill:colors.amber}));text(svg,399,148,'C5 · 无 H',{'font-size':16,fill:colors.amber});
   coords.forEach(([x,y],i)=>{svg.append(el('rect',{x:x-25,y:y-17,width:50,height:34,rx:5,fill:'#151a21',stroke:i===state.source||i===state.target?colors.acc:colors.line,'stroke-width':2}));text(svg,x,y+5,c.ex.nodes[i].id,{'text-anchor':'middle','font-size':17,fill:colors.text});text(svg,x,y-26,c.ex.nodes[i].h===3?'CH₃':c.ex.nodes[i].h===2?'CH₂':'CH',{'text-anchor':'middle','font-size':17});});
   if(state.weak){line(svg,300,45,468,45,{stroke:colors.amber,'stroke-width':2,'stroke-dasharray':'7 5'});line(svg,320,83,363,180,{stroke:colors.amber,'stroke-width':2,'stroke-dasharray':'7 5'});}
 }
 container.append(svg);
 const grid=document.createElement('div');grid.className='node-grid';
 c.ex.nodes.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=n.label;b.id=`structure-node-${i}`;b.setAttribute('aria-pressed',String(i===state.source||i===state.target));b.addEventListener('click',()=>choose(i,state.target));grid.append(b);});container.append(grid);
 const p=TOCSY.path(c.n,c.edges,state.source,state.target);
 $('pathText').textContent=p.length?`可用路径：${p.map(i=>c.ex.nodes[i].id).join(' → ')}${p.length===1?'（同一氢组）':''}`:'无可用路径：当前假设把两端分在不同网络。';
}
function drawReadout(c){
 const a=c.ex.nodes[state.source],b=c.ex.nodes[state.target],p=TOCSY.path(c.n,c.edges,state.source,state.target),v=c.M[state.source][state.target],type=TOCSY.classify(c.edges,state.source,state.target),same=state.source===state.target;
 $('pairName').textContent=`${a.id} ↔ ${b.id}`;
 $('pairType').textContent=!p.length?'不同网络':state.mode==='cosy'&&type==='接力相关'?'COSY 模式未画此峰':type;
 $('coordinates').textContent=state.example==='slide'?`(F₂ ≈ ${b.delta.toFixed(1)}, F₁ ≈ ${a.delta.toFixed(1)}) ppm · 估读`:`(F₂ = ${b.id}, F₁ = ${a.id}) · 无 ppm 数据`;
 $('weight').textContent=`${v.toFixed(4)}${state.mode==='cosy'?' · 固定符号权重':' · 无量纲类比权重'}`;
 $('distance').textContent=p.length?`${p.length-1} 条边${same?' · 自相关':''}`:'无法到达';
 $('groups').textContent=c.groups.map(g=>`{${g.map(i=>c.ex.nodes[i].id).join(', ')}}`).join(' / ');
 let explanation='';
 if(same)explanation='这是对角位置。它表示同一氢组与自己的坐标对应，不能提供新的邻接关系；模型中的对角权重会随分散程度变化。';
 else if(!p.length)explanation='当前网络没有连接两端的路径，模型权重严格为零。这个结果来自勾选的假设；真实谱图中一个峰缺失，还可能来自弱信号、交换、重叠或传递不足。';
 else if(state.mode==='cosy'&&type==='接力相关')explanation='这两端通过中间节点可达，但当前基线没有设置它们的直接 J 耦合边。因此 COSY 示意不画此峰；切换 TOCSY 可观察接力传递。真实实验仍须核对实际 J 耦合。';
 else if(state.mode==='tocsy'&&state.mix===0)explanation='混合时间为零时，模型还没有把信息传出去，所有非对角权重为零。可用的耦合路径仍然存在；拖动滑块才启动示意传递。';
 else if(type==='直接相关')explanation='当前假设中，两端共享一条可用的耦合边。COSY 与 TOCSY 示意都能显示该关联。图中的边是解释条件，不能反推截图已经测定了 J 的数值。';
 else explanation=`两端可沿 ${p.map(i=>c.ex.nodes[i].id).join(' → ')} 接力，因此 TOCSY 可画出远端相关；这个峰不要求两端直接耦合，不能单凭它确定连接顺序。`;
 $('pairExplanation').textContent=explanation;
 $('evidence').textContent=state.example==='slide'?'A–D 标记和大致坐标来自课程截图；假设耦合边、模式切换与峰权重来自本页模型。D 涉及 NH，实际可见性未知。':'分子骨架来自截图；C/G 编号和氢数来自结构计数。全部相关峰与弱通路都是教学假设，没有该分子的实验谱图。';
 $('currentConclusion').textContent=state.example==='slide'?(state.nh?'原图示意把 B、C、D 画成一块，A 独立。B↔D 的来源仍可有多种路径。':'关闭 NH 路径后为 A、B–C、D 三组；展示路径缺失的可能结果。'):(state.weak?'弱通路假设使九个含氢碳组连通；这只证明模型有路径，未证明实际会检测到全部相关。':'只保留常规近邻路径时：左段 G1–G4、右段 G6–G9、支链 G10，共三组。');
}
function drawZoom(c){
 const svg=$('pairZoom');svg.replaceChildren();const a=c.ex.nodes[state.source],b=c.ex.nodes[state.target],p=TOCSY.path(c.n,c.edges,state.source,state.target),type=TOCSY.classify(c.edges,state.source,state.target);
 const w=c.M[state.source][state.target];
 for(const[x,title,coord]of [[105,'选中峰',state.example==='slide'?`(${b.delta.toFixed(1)}, ${a.delta.toFixed(1)}) ppm`:`(${b.id}, ${a.id})`],[315,'镜像位置',state.example==='slide'?`(${a.delta.toFixed(1)}, ${b.delta.toFixed(1)}) ppm`:`(${a.id}, ${b.id})`]]){
   svg.append(el('rect',{x:x-86,y:24,width:172,height:157,fill:'#10161e',stroke:colors.line}));text(svg,x,48,title,{'text-anchor':'middle','font-size':15});marker(svg,x,91,w,type,true);text(svg,x,131,coord,{'text-anchor':'middle','font-size':15,fill:colors.text});text(svg,x,157,w>1e-7?type:'模型权重为零',{'text-anchor':'middle','font-size':13});
 }
 line(svg,196,89,224,89,{stroke:colors.acc});
 $('sliceTitle').textContent=`${a.id} 行的相关对象`;
 const slice=$('slice');slice.replaceChildren();
 c.ex.nodes.forEach((n,j)=>{const b=document.createElement('button');b.type='button';b.className='slice-row';b.id=`slice-node-${j}`;b.setAttribute('aria-pressed',String(j===state.target));b.setAttribute('aria-label',`${a.id} 与 ${n.id}，模型权重 ${c.M[state.source][j].toFixed(4)}`);b.innerHTML=`<span>${a.id} ↔ ${n.id}</span><span class="bar-track"><span style="width:${c.M[state.source][j]*100}%;background:${j===state.source?colors.acc:TOCSY.classify(c.edges,state.source,j)==='直接相关'?colors.blue:colors.amber}"></span></span><code>${c.M[state.source][j].toFixed(4)}</code>`;b.addEventListener('click',()=>choose(state.source,j));slice.append(b);});
}
function updateControls(){
 const ex=TOCSY.examples[state.example];$('example').value=state.example;$('mix').value=state.mix;$('mixValue').textContent=`${state.mix} ms`;$('mix').disabled=state.mode==='cosy';
 $('mixNote').textContent=state.mode==='cosy'?'COSY 模式只画假设的直接边，混合滑块暂时停用。切回 TOCSY 可继续操作。':'改变扩散类比模型中的传递程度；不是原图采集参数，也不是实际脉冲模拟。';
 $('tocsyMode').setAttribute('aria-pressed',String(state.mode==='tocsy'));$('cosyMode').setAttribute('aria-pressed',String(state.mode==='cosy'));
 $('nhControl').hidden=state.example!=='slide';$('weakControl').hidden=state.example!=='alkene';$('nh').checked=state.nh;$('weak').checked=state.weak;
 const buttonHost=$('nodeButtons');
 if(buttonHost.dataset.example!==state.example){buttonHost.replaceChildren();ex.nodes.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=n.label;b.dataset.source=i;b.addEventListener('click',()=>choose(i,state.target));buttonHost.append(b);});buttonHost.dataset.example=state.example;
 $('target').replaceChildren();ex.nodes.forEach((n,i)=>{const o=document.createElement('option');o.value=i;o.textContent=n.label;$('target').append(o);});}
 for(const b of buttonHost.children)b.setAttribute('aria-pressed',String(+b.dataset.source===state.source));$('target').value=state.target;
}
function render(){const active=document.activeElement,activeId=active?.id,c=config();updateControls();drawMatrix(c);drawStructure(c);drawReadout(c);drawZoom(c);if(activeId&&!active.isConnected)$(activeId)?.focus({preventScroll:true});}
function choose(i,j,focus=false){state.source=i;state.target=j;render();if(focus)$('matrix').querySelector('[tabindex="0"]').focus();}
$('example').addEventListener('change',e=>{state.example=e.target.value;state.source=state.example==='slide'?1:0;state.target=3;render();});
$('tocsyMode').addEventListener('click',()=>{state.mode='tocsy';render();});$('cosyMode').addEventListener('click',()=>{state.mode='cosy';render();});
$('mix').addEventListener('input',e=>{state.mix=+e.target.value;render();});$('nh').addEventListener('change',e=>{state.nh=e.target.checked;render();});$('weak').addEventListener('change',e=>{state.weak=e.target.checked;render();});$('target').addEventListener('change',e=>choose(state.source,+e.target.value));
$('reset').addEventListener('click',()=>{Object.assign(state,{example:'slide',mode:'tocsy',mix:80,nh:true,weak:false,source:1,target:3});render();});
$('runTest').addEventListener('click',()=>{const r=TOCSY.selftest();$('testResult').textContent=`${r.ok?'通过':'失败'} · ${Object.keys(r.checks).length} 项检查\n对称性最大误差：${r.maxSymmetry.toExponential(2)}\n每行守恒最大误差：${r.maxRowError.toExponential(2)}\n双节点解析值：${r.twoSpin20ms.toFixed(6)}`;});
$('openOriginal').addEventListener('click',()=>$('sourceDialog').showModal());$('closeOriginal').addEventListener('click',()=>$('sourceDialog').close());
const alkeneRows=TOCSY.examples.alkene.nodes.map((n,i)=>`<tr><td>${n.id}</td><td>C${n.id.slice(1)} · ${n.h===3?'CH₃':n.h===2?'CH₂':'烯 CH'}</td><td>${n.h}</td><td>${i<4?'I · 左段':i<8?'II · 右段':'III · 支链'}</td><td>无法确认 · 原图未提供</td></tr>`).join('');
$('alkeneTable').innerHTML=alkeneRows+'<tr><td>—</td><td>C5 · 无氢烯碳</td><td>0</td><td>无质子节点</td><td>不产生直接的 ¹H 信号；仍可参与跨越它的长程键路。</td></tr>';
for(const node of document.querySelectorAll('[data-math]'))katex.render(node.dataset.math,node,{throwOnError:true,displayMode:true,strict:'ignore'});
window.__teachingState=()=>({...state});render();
})();
