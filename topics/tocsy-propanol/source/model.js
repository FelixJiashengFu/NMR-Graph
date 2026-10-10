/* Group-level graph diffusion analogy. No physical spin simulation or measured intensities. */
const Model = (() => {
  const ids = ['A','B','C','D'];
  function graph(oh='omit', ab=true, bc=true) {
    const n = ['fast','slow'].includes(oh) ? 4 : 3;
    const edges = [];
    if (ab) edges.push([0,1]);
    if (bc) edges.push([1,2]);
    if (oh === 'slow') edges.push([0,3]);
    return {n,edges};
  }
  const eye = n => Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
  function mul(a,b) {return a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)));}
  function transfer(g,tau) {
    const {n,edges} = g, L = Array.from({length:n},()=>Array(n).fill(0));
    edges.forEach(([i,j])=>{L[i][i]++;L[j][j]++;L[i][j]--;L[j][i]--;});
    const q = Math.max(...L.map((r,i)=>r[i]));
    if (!q || !tau) return eye(n);
    const U = eye(n).map((r,i)=>r.map((v,j)=>v-L[i][j]/q));
    let power=eye(n), w=Math.exp(-q*tau), P=power.map(r=>r.map(v=>w*v));
    for (let k=1;k<180;k++) {
      power=mul(power,U); w*=q*tau/k;
      P=P.map((r,i)=>r.map((v,j)=>v+w*power[i][j]));
      if (k>q*tau+20 && w<1e-16) break;
    }
    return P;
  }
  function path(g,from,to) {
    let queue=[[from]], seen=new Set([from]);
    while(queue.length){const p=queue.shift(),v=p.at(-1);if(v===to)return p;
      for(const [a,b] of g.edges){const w=a===v?b:b===v?a:null;if(w!==null&&!seen.has(w)){seen.add(w);queue.push([...p,w]);}}
    }return null;
  }
  function allowed(g,mode,i,j) {return i===j || (mode==='cosy' ? g.edges.some(e=>e.includes(i)&&e.includes(j)) : !!path(g,i,j));}
  function count(g,mode='tocsy') {let total=0;for(let i=0;i<g.n;i++)for(let j=0;j<g.n;j++)total+=+allowed(g,mode,i,j);return {diagonal:g.n,cross:total-g.n,pairs:(total-g.n)/2,total};}
  function selftest(){
    let error=0, conservation=0, symmetry=0,negative=0,checks=0;
    for(const oh of ['omit','fast','slow','d2o'])for(const ab of [true,false])for(const bc of [true,false])for(const t of [0,.001,.1,1.5,3,20]){
      const g=graph(oh,ab,bc), P=transfer(g,t);checks++;
      P.forEach((r,i)=>{conservation=Math.max(conservation,Math.abs(r.reduce((a,b)=>a+b,0)-1));r.forEach((v,j)=>{symmetry=Math.max(symmetry,Math.abs(v-P[j][i]));negative=Math.max(negative,-v);if(!path(g,i,j))error=Math.max(error,Math.abs(v));if(t===0)error=Math.max(error,Math.abs(v-+(i===j)));});});
    }
    // Independent analytic endpoint transfer for three equally weighted sites.
    let analyticError=0;
    for(const t of [0,.001,.1,1,3,20])analyticError=Math.max(analyticError,Math.abs(transfer(graph(),t)[0][2]-(1/3-Math.exp(-t)/2+Math.exp(-3*t)/6)));
    const countsOK=count(graph()).total===9&&count(graph(),'cosy').total===7&&count(graph('slow')).total===16&&count(graph('fast')).total===10&&count(graph('omit',true,false)).total===5;
    const hCountOK=2+2+3+1===8;
    return {checks,analyticError,conservation,symmetry,negative,zeroAndDisconnectedError:error,countsOK,hCountOK,ok:Math.max(error,conservation,symmetry,negative,analyticError)<1e-12&&countsOK&&hCountOK};
  }
  return {ids,graph,transfer,path,allowed,count,selftest};
})();
if(typeof window!=='undefined'){window.Model=Model;window.__selftest=Model.selftest;}
if(typeof module!=='undefined')module.exports=Model;
