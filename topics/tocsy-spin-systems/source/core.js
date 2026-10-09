/* Teaching graph model. No fitted J, pulse sequence, exchange or relaxation. */
const TOCSY = (() => {
  const examples = {
    slide: {
      name:'原图 A–D 小谱图',
      nodes:[
        {id:'A',label:'A · COCH₃',h:3,delta:2.1,desc:'羰基左侧甲基；在原图小谱图中独立。'},
        {id:'B',label:'B · COCH₂',h:2,delta:3.0,desc:'羰基右侧 CH₂；与 C 之间存在可用的近邻耦合路径。'},
        {id:'C',label:'C · CH₂N',h:2,delta:3.3,desc:'邻氮 CH₂；原图将其与 B、D 放在同一相关块。'},
        {id:'D',label:'D · NH₂',h:2,delta:2.6,desc:'原图右下 NH₂ 标签；交换可能削弱或消除含 NH 的相关。'}
      ],
      edges: nh => nh ? [[1,2,40],[2,3,20]] : [[1,2,40]]
    },
    alkene: {
      name:'原图下方烯烃练习',
      nodes:[
        {id:'G1',label:'G1 · C1–CH₃',h:3},
        {id:'G2',label:'G2 · C2–CH₂',h:2},
        {id:'G3',label:'G3 · C3–CH₂',h:2},
        {id:'G4',label:'G4 · C4–CH',h:1},
        {id:'G6',label:'G6 · C6–CH₂',h:2},
        {id:'G7',label:'G7 · C7–CH₂',h:2},
        {id:'G8',label:'G8 · C8–CH₂',h:2},
        {id:'G9',label:'G9 · C9–CH₃',h:3},
        {id:'G10',label:'G10 · C10–CH₃',h:3}
      ],
      edges: weak => [[0,1,40],[1,2,40],[2,3,40],[4,5,40],[5,6,40],[6,7,40],...(weak?[[3,4,4],[3,8,4]]:[])]
    }
  };
  function identity(n){return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));}
  function multiply(A,B){return A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));}
  function transfer(n,edges,tms){
    const L=Array.from({length:n},()=>Array(n).fill(0));
    for(const [i,j,k] of edges){L[i][i]+=k;L[j][j]+=k;L[i][j]-=k;L[j][i]-=k;}
    const q=Math.max(...L.map((r,i)=>r[i]));
    if(!q || !tms)return identity(n);
    const P=L.map((r,i)=>r.map((v,j)=>+(i===j)-v/q));
    const z=q*tms/1000;
    let power=identity(n),weight=Math.exp(-z),out=power.map(r=>r.map(v=>v*weight));
    for(let m=1;m<=100;m++){
      power=multiply(power,P);weight*=z/m;
      out=out.map((r,i)=>r.map((v,j)=>v+weight*power[i][j]));
      if(m>z+20 && weight<1e-16)break;
    }
    return out;
  }
  function path(n,edges,s,t){
    const queue=[[s]],seen=new Set([s]);
    while(queue.length){const p=queue.shift(),i=p[p.length-1];if(i===t)return p;
      for(const [a,b]of edges){const j=a===i?b:b===i?a:-1;if(j>=0&&!seen.has(j)){seen.add(j);queue.push([...p,j]);}}
    }return [];
  }
  function components(n,edges){const groups=[],seen=new Set();for(let i=0;i<n;i++)if(!seen.has(i)){const g=[];for(let j=0;j<n;j++)if(path(n,edges,i,j).length){g.push(j);seen.add(j);}groups.push(g);}return groups;}
  function classify(edges,i,j){return i===j?'对角峰':edges.some(([a,b])=>a===i&&b===j||a===j&&b===i)?'直接相关':'接力相关';}
  function idealCount(sizes){return {diagonal:sizes.reduce((a,b)=>a+b,0),pairs:sizes.reduce((a,b)=>a+b*(b-1)/2,0),cross:sizes.reduce((a,b)=>a+b*(b-1),0),total:sizes.reduce((a,b)=>a+b*b,0)};}
  function selftest(){
    const checks={};let maxSymmetry=0,maxRowError=0,min=1;
    for(const [n,edges]of [[4,examples.slide.edges(true)],[9,examples.alkene.edges(false)],[9,examples.alkene.edges(true)]])
      for(const t of [0,1,20,80,120]){const M=transfer(n,edges,t);for(let i=0;i<n;i++){maxRowError=Math.max(maxRowError,Math.abs(M[i].reduce((a,b)=>a+b,0)-1));for(let j=0;j<n;j++){min=Math.min(min,M[i][j]);maxSymmetry=Math.max(maxSymmetry,Math.abs(M[i][j]-M[j][i]));}}}
    const two=transfer(2,[[0,1,40]],20),exact=(1-Math.exp(-2*40*.020))/2;
    checks.two_spin_exact=Math.abs(two[0][1]-exact)<1e-12;
    checks.zero_time_identity=JSON.stringify(transfer(4,examples.slide.edges(true),0))===JSON.stringify(identity(4));
    checks.disconnected_zero=transfer(4,examples.slide.edges(true),120)[0].slice(1).every(x=>x===0);
    checks.symmetry=maxSymmetry<1e-12;checks.row_conservation=maxRowError<1e-12;checks.nonnegative=min>=-1e-15;
    checks.slide_groups=components(4,examples.slide.edges(true)).length===2;
    checks.nh_off_groups=components(4,examples.slide.edges(false)).length===3;
    checks.alkene_groups=components(9,examples.alkene.edges(false)).length===3;
    checks.weak_join_groups=components(9,examples.alkene.edges(true)).length===1;
    checks.proton_count=examples.alkene.nodes.reduce((a,b)=>a+b.h,0)===20;
    checks.carbon_count=examples.alkene.nodes.length+1===10;
    checks.DBE=(2*10+2-20)/2===1;
    checks.slide_peak_count=idealCount([1,3]).total===10&&idealCount([1,3]).cross===6;
    checks.alkene_peak_count=idealCount([4,4,1]).total===33&&idealCount([4,4,1]).cross===24;
    return {ok:Object.values(checks).every(Boolean),checks,maxSymmetry,maxRowError,twoSpin20ms:two[0][1],alkeneFormula:'C10H20'};
  }
  return {examples,identity,transfer,path,components,classify,idealCount,selftest};
})();
if(typeof window!=='undefined')window.__selftest=TOCSY.selftest;
if(typeof module!=='undefined')module.exports=TOCSY;
