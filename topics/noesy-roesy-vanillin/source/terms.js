(() => {
  'use strict';
  // Definitions are local to this lesson. The uploaded screenshot remains untouched.
  const terms = [
    {key:'nmr',name:'NMR',cat:'实验与图谱',aliases:['NMR'],note:'核磁共振。利用原子核在磁场中的共振信号研究分子环境和结构。'},
    {key:'noesy',name:'NOESY',cat:'实验与图谱',aliases:['NOESY'],note:'核 Overhauser 效应二维谱；在混合期间观察可能由 NOE 产生的空间相关。'},
    {key:'roesy',name:'ROESY',cat:'实验与图谱',aliases:['ROESY'],note:'旋转坐标系 Overhauser 效应二维谱。与 NOESY 的实验条件、转移和相位判读不能直接混用。'},
    {key:'noe',name:'NOE / NOE 转移',cat:'实验与图谱',aliases:['NOE transfer','NOE 转移','NOE'],note:'核 Overhauser 效应；附近核之间的偶极交叉弛豫可改变信号强度。'},
    {key:'roe',name:'ROE',cat:'实验与图谱',aliases:['ROE'],note:'旋转坐标系中的 Overhauser 效应；ROESY 利用这种转移建立相关。'},
    {key:'twod',name:'二维谱',cat:'实验与图谱',aliases:['二维谱'],note:'用两个频率或化学位移轴表示信号相关的谱图；本页横纵轴都是 ¹H。'},
    {key:'crosspeak',name:'交叉峰',cat:'实验与图谱',aliases:['cross peak','交叉峰'],note:'离开 f₁=f₂ 对角线的二维信号，提示两个共振之间有某种相关；机制需另行核查。'},
    {key:'diagonal',name:'对角峰 / 对角线',cat:'实验与图谱',aliases:['对角峰','对角线'],note:'同一个共振在两个轴上对应的自相关位置，满足 f₁=f₂；通常强于交叉峰。'},
    {key:'shift',name:'化学位移',cat:'实验与图谱',aliases:['化学位移'],note:'共振位置相对参考频率的无量纲比值，常以 ppm 表示。'},
    {key:'ppm',name:'ppm',cat:'实验与图谱',aliases:['ppm'],note:'百万分之一；NMR 化学位移的单位。它不是原子之间的距离单位。'},
    {key:'axes',name:'f₁ / f₂',cat:'实验与图谱',aliases:['f₁','f₂'],note:'二维谱的两个频率轴。本图两个轴均标 ¹H 化学位移，单位 ppm。'},
    {key:'projection',name:'投影',cat:'实验与图谱',aliases:['投影'],note:'二维谱边缘的一维信号概览，可帮助对照化学位移；本截图未给可定量的积分。'},
    {key:'contour',name:'等高线 / 轮廓',cat:'实验与图谱',aliases:['等高线','轮廓'],note:'二维峰的强度层级线；显示颜色和面积还受绘图阈值影响。'},
    {key:'peakposition',name:'峰位 / 峰表',cat:'实验与图谱',aliases:['峰位','峰表'],note:'峰位是谱峰的坐标；峰表是列出峰位、归属等信息的记录。本截图未给原始峰表。'},
    {key:'intensity',name:'峰强',cat:'实验与图谱',aliases:['峰强'],note:'信号幅度或体积的大小；不能单凭截图颜色直接换算空间距离。'},
    {key:'integral',name:'积分',cat:'实验与图谱',aliases:['积分'],note:'对峰面积或体积的定量测量。推算距离通常还需参考峰和实验条件。'},
    {key:'phase',name:'相位',cat:'实验与图谱',aliases:['相位'],note:'谱峰正负及处理后的符号表现。NOESY 与 ROESY 的相位解释依赖实验设置。'},
    {key:'snr',name:'信噪比',cat:'实验与图谱',aliases:['信噪比'],note:'信号大小相对于背景噪声的比值；太低时弱峰可能看不见。'},
    {key:'resolution',name:'分辨率',cat:'实验与图谱',aliases:['分辨率'],note:'谱图区分邻近信号的能力；芳香区重叠使单一峰归属困难。'},

    {key:'proton',name:'质子 / ¹H',cat:'结构与官能团',aliases:['protons','质子','¹H'],note:'这里指氢核 ¹H。NOESY/ROESY 图中比较的是氢核信号。'},
    {key:'vanillin',name:'香草醛',cat:'结构与官能团',aliases:['香草醛'],note:'4-羟基-3-甲氧基苯甲醛；截图画出苯环、醛基、甲氧基和酚羟基。'},
    {key:'aromatic-ring',name:'芳香环',cat:'结构与官能团',aliases:['芳香环'],note:'本图是具有交替键表示的苯环；环上的取代位置用于标注 H2、H5、H6。',icon:'ring'},
    {key:'aromatic-h',name:'芳香氢 / 芳香峰区',cat:'结构与官能团',aliases:['芳香峰区','芳香氢'],note:'连在芳香环上的氢及其谱峰所在区域。截图中约 7 ppm 的多个信号拥挤，不能唯一指定交叉峰来源。',icon:'ring'},
    {key:'aldehyde',name:'醛基',cat:'结构与官能团',aliases:['醛基'],note:'–C(=O)H：含羰基碳和一个直接连在该碳上的氢。',icon:'aldehyde'},
    {key:'aldehyde-h',name:'醛氢',cat:'结构与官能团',aliases:['醛氢'],note:'醛基 –CHO 中连在羰基碳上的 H；截图中红色标记约在 9.9 ppm。',icon:'aldehyde'},
    {key:'methoxy',name:'甲氧基',cat:'结构与官能团',aliases:['甲氧基'],note:'–O–CH₃：氧连接一个甲基；截图中绿色标记约在 3.8 ppm。',icon:'methoxy'},
    {key:'phenol',name:'酚羟基',cat:'结构与官能团',aliases:['酚羟基'],note:'Ar–O–H：羟基直接连接芳香环。该 OH 的谱峰在截图中无法确认。',icon:'phenol'},
    {key:'hydroxyl',name:'羟基',cat:'结构与官能团',aliases:['羟基'],note:'–O–H 官能团；本分子中的羟基属于酚羟基。',icon:'phenol'},
    {key:'functional',name:'官能团',cat:'结构与官能团',aliases:['官能团'],note:'分子中具有典型连接形式和化学性质的原子组合，如醛基、甲氧基或羟基。'},
    {key:'h2',name:'H2',cat:'结构与官能团',aliases:['H2'],note:'截图结构中芳环 2 位的氢；橙色标注。其与约 7.3 ppm 交叉峰的具体对应仍待核验。'},
    {key:'h5',name:'H5',cat:'结构与官能团',aliases:['H5'],note:'截图结构中芳环 5 位的氢；紫色标注。'},
    {key:'h6',name:'H6',cat:'结构与官能团',aliases:['H6'],note:'截图结构中芳环 6 位的氢；青色标注。与 H2 峰区接近，归属需谨慎。'},

    {key:'spatial',name:'空间邻近 / 空间相关',cat:'机制与数值',aliases:['spatial proximity','空间邻近','空间相关'],note:'两个氢在三维空间中靠近，或谱图提示这种邻近；不等于只看平面结构中的键数。'},
    {key:'mixing',name:'混合时间',cat:'机制与数值',aliases:['混合时间'],note:'实验中允许磁化转移发生的时间；改变它会影响交叉峰强度和间接路径贡献。'},
    {key:'crossrelax',name:'交叉弛豫速率 σ',cat:'机制与数值',aliases:['交叉弛豫速率','σ'],note:'描述两个核之间通过弛豫进行磁化转移的速率；在适当条件下含有 r⁻⁶ 距离依赖。'},
    {key:'initial',name:'初始速率近似',cat:'机制与数值',aliases:['初始速率近似'],note:'混合时间足够短时，以交叉峰初期增长近似直接转移，减少多步路径的影响。'},
    {key:'spindiffusion',name:'自旋扩散',cat:'机制与数值',aliases:['自旋扩散'],note:'磁化经第三个或更多自旋间接传递，可能让并不直接接近的两氢出现相关。'},
    {key:'exchange',name:'化学交换',cat:'机制与数值',aliases:['化学交换'],note:'核在不同化学环境之间转换；某些二维实验中也会形成离对角线峰。'},
    {key:'indirect',name:'间接转移',cat:'机制与数值',aliases:['间接转移'],note:'磁化经过中间自旋或其他多步过程传递，不宜直接解释成两氢之间的单一步骤。'},
    {key:'zero',name:'零交叉区',cat:'机制与数值',aliases:['零交叉区'],note:'某些分子运动条件下 NOE 信号可能很弱或趋近零；未见峰不能直接证明距离远。'},
    {key:'sixth',name:'距离的负六次方',cat:'机制与数值',aliases:['inverse sixth power of distance','六次反比','负六次方','r⁻⁶'],note:'在适用的偶极弛豫模型下，交叉弛豫速率随距离 r 约按 r⁻⁶ 变化；这不是从截图直接测得的曲线。'},
    {key:'angstrom',name:'Å',cat:'机制与数值',aliases:['Å'],note:'埃，长度单位；1 Å = 0.1 纳米。页面滑块中的 Å 属于演示距离，不是截图测距。'},
    {key:'ratio',name:'I/I₀ 与 r₀',cat:'机制与数值',aliases:['I/I₀','r₀'],note:'I/I₀ 是相对强度，无单位；r₀ 是参考距离。本页设 r₀=3.0 Å，只用于模型演示。'}
  ];
  const byKey=new Map(terms.map(t=>[t.key,t]));
  const aliasMap=new Map();
  terms.forEach(t=>t.aliases.forEach(a=>aliasMap.set(a,t)));
  const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const alternatives=[...aliasMap.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex);
  const pattern=new RegExp(alternatives.join('|'),'g');

  function icon(type) {
    if(!type)return null;
    const box=document.createElement('span');box.className='group-icon icon-'+type;box.setAttribute('aria-hidden','true');
    const shared='fill="none" stroke="#8ce3c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if(type==='aldehyde')box.innerHTML=`<svg viewBox="0 0 83 32"><path ${shared} d="M2 17H21 M39 12L52 4 M41 15L54 7 M40 21L52 27"/><text x="23" y="22">C</text><text x="57" y="10">O</text><text x="56" y="31">H</text></svg>`;
    if(type==='methoxy')box.innerHTML=`<svg viewBox="0 0 86 32"><path ${shared} d="M2 17H17 M31 17H47"/><text x="19" y="22">O</text><text x="50" y="22">CH₃</text></svg>`;
    if(type==='phenol')box.innerHTML=`<svg viewBox="0 0 92 32"><path ${shared} d="M8 8L21 2L34 9V23L21 30L8 23Z M11 10L21 5 M31 10V21 M21 27L11 22 M34 16H49 M62 16H73"/><text x="51" y="21">O</text><text x="76" y="21">H</text></svg>`;
    if(type==='ring')box.innerHTML=`<svg viewBox="0 0 46 32"><path ${shared} d="M9 8L22 2L35 9V23L22 30L9 23Z M12 10L22 5 M32 10V21 M22 27L12 22"/></svg>`;
    return box;
  }
  function renderGlossary(){
    const host=document.getElementById('glossary-list');
    for(const cat of ['实验与图谱','结构与官能团','机制与数值']){
      const section=document.createElement('section');section.className='glossary-group';
      const h=document.createElement('h3');h.textContent=cat;section.append(h);
      const grid=document.createElement('div');grid.className='glossary-grid';
      terms.filter(t=>t.cat===cat).forEach(t=>{
        const card=document.createElement('article');card.className='glossary-item';card.id='term-'+t.key;
        const title=document.createElement('div');title.className='glossary-item-title';
        const b=document.createElement('b');b.textContent=t.name;title.append(b);
        const drawing=icon(t.icon);if(drawing)title.append(drawing);
        const p=document.createElement('p');p.textContent=t.note;
        card.append(title,p);grid.append(card);
      });
      section.append(grid);host.append(section);
    }
  }
  function annotate(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      if(!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
      const p=node.parentElement;
      if(!p||p.closest('script,style,svg,abbr,a,.glossary-panel,.term-popover,.topline,.skip,.formula'))return NodeFilter.FILTER_REJECT;
      pattern.lastIndex=0;
      return pattern.test(node.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.nodeValue,frag=document.createDocumentFragment();let last=0;pattern.lastIndex=0;let m;
      while((m=pattern.exec(text))){
        if(m.index>last)frag.append(document.createTextNode(text.slice(last,m.index)));
        const term=aliasMap.get(m[0]);
        const wrap=document.createElement('span');wrap.className='annotated-term';
        const abbr=document.createElement('abbr');abbr.className='term';abbr.textContent=m[0];abbr.dataset.term=term.key;
        abbr.setAttribute('aria-label',`${m[0]}：${term.note}`);
        abbr.setAttribute('aria-describedby','term-'+term.key);
        if(!node.parentElement.closest('button'))abbr.tabIndex=0;
        wrap.append(abbr);
        const drawing=icon(term.icon);if(drawing)wrap.append(drawing);
        frag.append(wrap);last=m.index+m[0].length;
      }
      if(last<text.length)frag.append(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    });
  }

  const popover=document.getElementById('term-popover');
  function close(){popover.hidden=true;}
  function show(abbr){
    const term=byKey.get(abbr.dataset.term);if(!term)return;
    const head=document.getElementById('term-popover-head');head.replaceChildren();
    const b=document.createElement('b');b.textContent=term.name;head.append(b);
    const drawing=icon(term.icon);if(drawing)head.append(drawing);
    document.getElementById('term-popover-text').textContent=term.note;
    document.getElementById('term-popover-link').href='#term-'+term.key;
    popover.hidden=false;
    if(window.innerWidth<=740){popover.style.left='12px';popover.style.right='12px';popover.style.top='auto';popover.style.bottom='12px';}
    else{
      popover.style.right='auto';popover.style.bottom='auto';
      const r=abbr.getBoundingClientRect(),w=popover.offsetWidth,h=popover.offsetHeight;
      popover.style.left=Math.max(12,Math.min(r.left,window.innerWidth-w-12))+'px';
      popover.style.top=Math.max(12,r.bottom+8+h>window.innerHeight?r.top-h-8:r.bottom+8)+'px';
    }
  }
  renderGlossary();annotate();
  document.addEventListener('click',event=>{
    const abbr=event.target.closest?.('abbr.term');
    if(abbr){show(abbr);return;}
    if(!popover.contains(event.target))close();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')close();
    if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('abbr.term')){event.preventDefault();show(event.target);}
  });
  document.getElementById('term-close').addEventListener('click',close);
  document.getElementById('term-popover-link').addEventListener('click',close);
  window.annotateTerms=annotate;
  window.NOESY_TERMS={count:terms.length};
})();
