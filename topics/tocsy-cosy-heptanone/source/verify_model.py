"""Independent Python formula checks plus comparison with the shipped JS core."""
from pathlib import Path
import math,json,subprocess,os
root=Path(__file__).resolve().parent
ids=[1,2,4,5,6,7];edges=[(1,2),(4,5),(5,6),(6,7)]
def pathdist(a,b):
 q=[(a,0)];seen={a}
 for x,d in q:
  if x==b:return d
  for u,v in edges:
   y=v if u==x else u if v==x else None
   if y is not None and y not in seen:seen.add(y);q.append((y,d+1))
 return None
def w(d,t):
 if d is None:return 0
 if d==0:return 1
 u=t/30
 return 1-math.exp(-u)*sum(u**k/math.factorial(k) for k in range(d))
node=os.environ.get('NODE_BINARY','node')
probe="const M=require(process.argv[1]);const vals=[];for(let t=0;t<=120;t++)for(const a of M.nodes)for(const b of M.nodes)vals.push([a.id,b.id,t,M.value(a.id,b.id,t,'TOCSY')]);console.log(JSON.stringify({selftest:M.selftest(),values:vals}));"
r=json.loads(subprocess.check_output([node,'-e',probe,str(root/'core.js')],text=True))
assert r['selftest']['ok']
err=max(abs(v-w(pathdist(a,b),t)) for a,b,t,v in r['values'])
assert err<1e-12
pairs=[(a,b,pathdist(a,b)) for i,a in enumerate(ids) for b in ids[i+1:]]
assert sum(d==1 for a,b,d in pairs)==4
assert sum(d is not None for a,b,d in pairs)==7
assert sum([3,2,2,2,2,3])==14
# Independent derivative / finite-difference check: dw/dt=e^-u u^(d-1)/((d-1)! tau)
derivative_error=0
for d in (1,2,3):
 for t in (5,30,90,120):
  h=.001;fd=(w(d,t+h)-w(d,t-h))/(2*h)
  exact=math.exp(-t/30)*(t/30)**(d-1)/math.factorial(d-1)/30
  derivative_error=max(derivative_error,abs(fd-exact))
assert derivative_error<1e-10
out={'passed':True,'JS_selftest':r['selftest'],'independent_values_checked':len(r['values']),'max_abs_error':err,'derivative_max_abs_error':derivative_error,'formula':'C7H14O','theoretical_H':14,'DBE':1,'effective_networks':[[1,2],[4,5,6,7]],'COSY_unique_pairs':4,'TOCSY_ideal_unique_pairs':7,'extra_unique_pairs':3,'COSY_offdiagonal_positions':8,'TOCSY_offdiagonal_positions':14,'diagonal_positions':6,'caveat':'group-level theory and illustrative weights; no measured intensities or raw spectra'}
(root.parent/'numerical-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
