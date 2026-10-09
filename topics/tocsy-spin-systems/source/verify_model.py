"""Independent RK4 check against the JavaScript uniformization model; stdlib only."""
import math, json, subprocess, os, shutil
from pathlib import Path

root=Path(__file__).resolve().parent
node=os.environ.get('NODE_BINARY') or shutil.which('node')
if not node:raise RuntimeError('Install Node.js, or set NODE_BINARY to its executable.')
js="const t=require(process.argv[1]); console.log(JSON.stringify({selftest:t.selftest(),matrix:t.transfer(4,t.examples.slide.edges(true),80)}));"
actual=json.loads(subprocess.check_output([node,'-e',js,str(root/'core.js')]))
edges=[(1,2,40),(2,3,20)]
M=[[float(i==j) for j in range(4)] for i in range(4)]
def derivative(A):
    D=[[0.0]*4 for _ in range(4)]
    for r in range(4):
        for a,b,k in edges:
            flow=k*(A[r][b]-A[r][a]);D[r][a]+=flow;D[r][b]-=flow
    return D
def add(A,B,s):return [[A[i][j]+s*B[i][j] for j in range(4)] for i in range(4)]
dt=.00001
for _ in range(8000):
    a=derivative(M);b=derivative(add(M,a,dt/2));c=derivative(add(M,b,dt/2));d=derivative(add(M,c,dt))
    M=[[M[i][j]+dt*(a[i][j]+2*b[i][j]+2*c[i][j]+d[i][j])/6 for j in range(4)] for i in range(4)]
err=max(abs(M[i][j]-actual['matrix'][i][j]) for i in range(4) for j in range(4))
result={'independent_RK4_max_error':err,'RK4_step_seconds':dt,'selftest':actual['selftest'],'C10H20_hydrogen_sum':3*3+5*2+1,'DBE':1,'two_spin_20ms_exact':(1-math.exp(-1.6))/2,'ok':err<1e-10 and actual['selftest']['ok']}
print(json.dumps(result,ensure_ascii=False,indent=2))
assert result['ok']
