(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const pairs = {
    aldehyde: {
      title: '醛氢 ↔ 芳香峰区', x: 9.9, y: 7.3, color: '#fa7081', letter: 'A',
      summary: '截图可见约 9.9 / 7.3 ppm 的离对角线小轮廓及其对应位置。两轴均为 ¹H 化学位移。',
      explain: '约 9.9 ppm 可与醛氢对应；约 7.3 ppm 是相邻芳香信号密集区。这个相关支持空间邻近的候选判断，但无法凭截图区分它来自 H2 还是 H6。',
      structure: '红色醛氢与橙色 H2、青色 H6 均被标出；芳香侧具体归属待原始峰表确认。',
      active: ['CHO', 'H2', 'H6']
    },
    methoxy: {
      title: '甲氧基 ↔ 芳香峰区', x: 3.8, y: 7.3, color: '#40d99b', letter: 'B',
      summary: '截图在约 3.8 / 7.3 ppm 一带可辨交叉轮廓。它靠近绿色甲氧基与芳香峰区的投影。',
      explain: '甲氧基与邻近的芳香氢出现空间相关是合理解释；约 7.3 ppm 的 H2 / H6 具体对应还需更高分辨率谱图核对。',
      structure: '绿色甲氧基和橙色 H2 是结构上的近邻候选；青色 H6 也留作峰位重叠提醒。',
      active: ['OMe', 'H2', 'H6']
    },
    aromatic: {
      title: '两个芳香峰区', x: 7.0, y: 7.3, color: '#9689ff', letter: 'C',
      summary: '约 7.0 / 7.3 ppm 处有靠近对角线的弱小轮廓，截图难以可靠分离。',
      explain: '这可作为芳香氢之间相关的观察练习；因贴近强对角峰且彼此拥挤，独立交叉峰和具体 H 位点均无法确认。',
      structure: '紫色 H5 与橙、青芳香 H 是结构位置参考；此处不做确定的 NOE 归属。',
      active: ['H2', 'H5', 'H6']
    }
  };
  const $ = id => document.getElementById(id);
  function svgEl(name, attrs = {}, text) {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, String(v)));
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function add(parent, name, attrs, content) { const e = svgEl(name, attrs, content); parent.appendChild(e); return e; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  let selected = 'aldehyde';
  let distance = 3;

  function renderPlot() {
    const svg = $('spectrum'); clear(svg);
    const small=window.innerWidth<=740;
    const W=small?380:650,H=small?400:500;
    const L=small?42:57,R=small?352:615,T=small?25:32,B=small?336:436;
    const px=ppm=>L+(11.2-ppm)/8.2*(R-L);
    const py=ppm=>T+(ppm-3)/8*(B-T);
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    add(svg,'rect',{x:0,y:0,width:W,height:H,fill:'#111820'});
    (small?[4,6,8,10]:[4,5,6,7,8,9,10,11]).forEach(t => {
      const x=px(t), y=py(t);
      add(svg,'line',{x1:x,y1:T,x2:x,y2:B,stroke:'#27323d','stroke-width':1});
      add(svg,'line',{x1:L,y1:y,x2:R,y2:y,stroke:'#27323d','stroke-width':1});
      add(svg,'text',{x,y:B+21,fill:'#b9c8ce','font-size':small?12:11,'text-anchor':'middle'},String(t));
      add(svg,'text',{x:L-12,y:y+4,fill:'#b9c8ce','font-size':small?12:11,'text-anchor':'end'},String(t));
    });
    add(svg,'rect',{x:L,y:T,width:R-L,height:B-T,fill:'none',stroke:'#52616c','stroke-width':1});
    add(svg,'line',{x1:px(11),y1:py(11),x2:px(3),y2:py(3),stroke:'#44616a','stroke-width':1.5,'stroke-dasharray':'5 6'});
    add(svg,'text',{x:small?195:335,y:small?382:490,fill:'#c2d0d4','font-size':small?12:12,'text-anchor':'middle'},'f₂  化学位移 / ppm（向右减小）');
    add(svg,'text',{x:small?12:14,y:small?181:237,fill:'#c2d0d4','font-size':small?11:12,'text-anchor':'middle',transform:`rotate(-90 ${small?12:14} ${small?181:237})`},'f₁  化学位移 / ppm');
    [[9.9,'CHO'],[7.4,'Ar'],[7.0,'Ar'],[3.8,'OCH₃']].forEach(([ppm,label])=>{
      const x=px(ppm), y=py(ppm);
      add(svg,'ellipse',{cx:x,cy:y,rx:13,ry:7,fill:'none',stroke:'#80dce8','stroke-width':2,transform:`rotate(-36 ${x} ${y})`});
      add(svg,'circle',{cx:x,cy:y,r:3,fill:'#80dce8'});
    });
    Object.entries(pairs).forEach(([id,p])=>{
      [[p.x,p.y],[p.y,p.x]].forEach(([a,b],i)=>{
        const x=px(a), y=py(b), active=id===selected;
        const g=add(svg,'g',{role:'button',tabindex:'0','aria-label':`选择${p.title}，位置约 ${a} / ${b} ppm`,'data-pair':id,style:'cursor:pointer'});
        add(g,'circle',{cx:x,cy:y,r:active?18:15,fill:'transparent'});
        add(g,'ellipse',{cx:x,cy:y,rx:active?14:10,ry:active?9:6,fill:active?p.color:'#b19c59','fill-opacity':active?.25:.12,stroke:active?p.color:'#e3bb70','stroke-width':active?2.6:1.6});
        add(g,'circle',{cx:x,cy:y,r:active?3.5:2.4,fill:active?p.color:'#e3bb70'});
        g.addEventListener('click',()=>select(id));
        g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(id);}});
        if(i===0&&!small) add(svg,'text',{x:x+(a>7?14:-14),y:y-12,fill:active?p.color:'#b9a779','font-size':11,'font-weight':800,'text-anchor':a>7?'start':'end'},p.letter);
      });
    });
    add(svg,'text',{x:R-6,y:T+15,fill:'#8e9fa8','font-size':small?10:10,'text-anchor':'end'},'轮廓为教学定位示意');
  }

  function renderStructure() {
    const svg=$('structure'); clear(svg);
    const active=pairs[selected].active;
    const line=(x1,y1,x2,y2,w=2)=>add(svg,'line',{x1,y1,x2,y2,stroke:'#a6b5ba','stroke-width':w,'stroke-linecap':'round'});
    const ring=[[210,67],[264,98],[264,158],[210,189],[156,158],[156,98]];
    for(let i=0;i<6;i++)line(...ring[i],...ring[(i+1)%6],2.2);
    line(210,78,253,104,1.4);line(253,151,210,177,1.4);line(166,152,166,105,1.4);
    line(210,67,210,36);line(264,98,301,78);line(264,158,300,178);line(210,189,210,214);line(156,158,121,178);line(156,98,121,78);
    const nodes=[
      {id:'CHO',x:210,y:23,t:'CHO',c:'#fa7081',w:54},
      {id:'H2',x:321,y:69,t:'H2',c:'#ffc66f',w:45},
      {id:'OMe',x:339,y:189,t:'OCH₃',c:'#40d99b',w:65},
      {id:'OH',x:210,y:224,t:'OH',c:'#c3d0d3',w:46},
      {id:'H5',x:100,y:189,t:'H5',c:'#9689ff',w:45},
      {id:'H6',x:100,y:69,t:'H6',c:'#80dce8',w:45}
    ];
    nodes.forEach(n=>{
      const is=active.includes(n.id), group=add(svg,'g',{role:'button',tabindex:'0','aria-label':`选择${n.t}相关观察`,'data-atom':n.id,style:'cursor:pointer'});
      add(group,'rect',{x:n.x-n.w/2,y:n.y-16,width:n.w,height:32,rx:16,fill:is?n.c:'#26313a','fill-opacity':is?.28:1,stroke:is?n.c:'#52636a','stroke-width':is?2:1});
      add(group,'text',{x:n.x,y:n.y+5,fill:is?'#fff':'#c7d3d7','font-size':n.id==='OMe'?12:13,'font-weight':800,'text-anchor':'middle'},n.t);
      group.addEventListener('click',()=>select(n.id==='CHO'?'aldehyde':n.id==='OMe'?'methoxy':'aromatic'));
      group.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(n.id==='CHO'?'aldehyde':n.id==='OMe'?'methoxy':'aromatic');}});
    });
    add(svg,'text',{x:6,y:233,fill:'#94a5ad','font-size':10},'编号以 CHO 所连芳环碳为 C1');
  }

  function renderCurve() {
    const svg=$('curve'); clear(svg);
    const left=27,right=270,top=9,bottom=96,logMax=Math.log10(12),logMin=-2;
    const x=r=>left+(r-2)/4*(right-left);
    const y=i=>top+(logMax-Math.log10(i))/(logMax-logMin)*(bottom-top);
    [10,1,.1,.01].forEach(v=>{
      const yy=y(v);add(svg,'line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#2f4148','stroke-width':1});
      add(svg,'text',{x:22,y:yy+3,fill:'#93aab0','font-size':9,'text-anchor':'end'},String(v));
    });
    let d='';for(let i=0;i<=100;i++){const r=2+i*.04;d+=(i?' L':'M')+x(r).toFixed(2)+' '+y(Math.pow(3/r,6)).toFixed(2);}
    add(svg,'path',{d,fill:'none',stroke:'#5fd0a8','stroke-width':2.5});
    const intensity=Math.pow(3/distance,6),cx=x(distance),cy=y(intensity);
    add(svg,'line',{x1:cx,y1:cy,x2:cx,y2:bottom,stroke:'#aac5b8','stroke-dasharray':'3 3'});
    add(svg,'circle',{cx,cy,r:5.5,fill:'#5fd0a8',stroke:'#fff','stroke-width':1.4});
    [2,3,4,5,6].forEach(r=>add(svg,'text',{x:x(r),y:112,fill:'#93aab0','font-size':9,'text-anchor':'middle'},String(r)));
    add(svg,'text',{x:156,y:12,fill:'#91a7ab','font-size':9},'纵轴对数刻度 · 横轴 Å');
  }
  function renderModel() {
    const ratio=Math.pow(3/distance,6);
    $('distance-value').textContent=distance.toFixed(1)+' Å';
    $('intensity').textContent=ratio>=1?ratio.toFixed(2):ratio.toFixed(3);
    $('model-sentence').textContent=`r = ${distance.toFixed(1)} Å 时，(3.0 / ${distance.toFixed(1)})⁶ = ${ratio.toFixed(3)}。该数值不是原图积分。`;
    $('distance').setAttribute('aria-valuetext',distance.toFixed(1)+' 埃');
    renderCurve();
    window.annotateTerms?.($('model-sentence'));
    window.annotateTerms?.($('distance-value'));
  }
  function select(id) {
    selected=id;
    const p=pairs[id];
    document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pair===id)));
    $('pair-title').textContent=p.title;
    $('pair-summary').textContent=p.summary;
    $('pair-explain').textContent=p.explain;
    $('structure-caption').textContent=p.structure;
    $('x-read').textContent=`约 ${p.x.toFixed(1)} ppm`;
    $('y-read').textContent=`约 ${p.y.toFixed(1)} ppm`;
    $('pair-count').textContent=id==='aromatic'?'理论 2；图中无法确认':'理论 2；图中约 2';
    $('pair-status').textContent=id==='aromatic'?'原图弱轮廓 · 待确认':'原图估读';
    renderPlot();renderStructure();
    ['pair-title','pair-summary','pair-explain','structure-caption','x-read','y-read'].forEach(id=>window.annotateTerms?.($(id)));
  }
  document.querySelectorAll('.choice').forEach(b=>b.addEventListener('click',()=>select(b.dataset.pair)));
  $('distance').addEventListener('input',ev=>{distance=Number(ev.target.value);renderModel();});
  window.addEventListener('resize',renderPlot);
  select('aldehyde');renderModel();
  window.NOESY_LESSON={getState:()=>({selected,distance,ratio:Math.pow(3/distance,6)})};
})();
