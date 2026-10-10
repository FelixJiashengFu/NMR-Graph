# -*- coding: utf-8 -*-
import numpy as np, json
exec(open('_verify_tocsy.py').read().split("if __name__")[0])

L=['OH','C1H2','C2H2','C3H3']
def full(includeOH=True,tms=80,T1rho=None,JHOC=5.2):
    N,J=propanol(includeOH,JHOC=JHOC)
    M=transfer(N,J,tms/1000.0)
    if T1rho: M=M*np.exp(-(tms/1000.0)/T1rho)
    return M

print("== 4x4 全矩阵 @ tau=80 ms (含 OH) ==")
M=full(True,80); print(np.array2string(M,precision=4))
print("  min over 16 entries = %.4f" % M.min())
print("== 4x4 @ tau=40 ms =="); M=full(True,40); print(np.array2string(M,precision=4)); print("  min=%.4f"%M.min())
print("== 4x4 @ tau=25 ms =="); M=full(True,25); print(np.array2string(M,precision=4)); print("  min=%.4f"%M.min())

print("== 计数：阈值 0.05，含 OH ==")
for tms in (15,20,25,30,40,60,80,100,120,140):
    M=full(True,tms)
    grid=sum(1 for a in range(4) for b in range(4) if abs(M[a,b])>=0.05)
    off =sum(1 for a in range(4) for b in range(4) if a!=b and abs(M[a,b])>=0.05)
    print("  tau=%3dms  可见方块=%2d/16  非对角=%2d/12  唯一相关对=%d/6"%(tms,grid,off,off//2))
print("== 计数：不含 OH（快交换）阈值 0.05 ==")
for tms in (15,20,25,30,40,60,80,100,120):
    N,J=propanol(False); M=transfer(N,J,tms/1000.0)
    sub=M[1:,1:]
    grid=sum(1 for a in range(3) for b in range(3) if abs(sub[a,b])>=0.05)
    off =sum(1 for a in range(3) for b in range(3) if a!=b and abs(sub[a,b])>=0.05)
    print("  tau=%3dms  可见方块=%2d/9  非对角=%2d/6  唯一相关对=%d/3"%(tms,grid,off,off//2))

print("== 弛豫后的最优混合时间 (T1rho=600ms, 含 OH) ==")
N,J=propanol(True); ts=np.arange(0.001,0.30,0.0005)
for (k,j) in [(0,1),(0,2),(0,3),(1,2),(1,3),(2,3)]:
    best=(0,0)
    for t in ts:
        v=transfer(N,J,t)[j,k]*np.exp(-t/0.6)
        if v>best[1]: best=(t,v)
    print("   %-5s -> %-5s  tau_opt=%5.1f ms  I=%.4f"%(L[k],L[j],best[0]*1000,best[1]))

print("== 关键闭式核对：两自旋 J=5.2Hz 时 tau_opt=1/(2J)=%.1f ms; J=6.6->%.1f; J=7.4->%.1f"%(1000/(2*5.2),1000/(2*6.6),1000/(2*7.4)))

print("== 不含 OH 时 3 自旋的转移矩阵 @ tau=80ms ==")
N,J=propanol(False); M=transfer(N,J,0.08); print(np.array2string(M[1:,1:],precision=4))

print("== 对称性/守恒在 OH 关闭时仍成立 ==")
N,J=propanol(False)
print("   cons dev=%.2e  sym dev=%.2e"%(np.abs(transfer(N,J,0.077).sum(axis=0)-1).max(),
      np.abs(transfer(N,J,0.077)-transfer(N,J,0.077).T).max()))

# 导出给 JS 自检对照的参考值
ref={'M_80ms_withOH':full(True,80).round(6).tolist(),
     'M_80ms_noOH':np.round(transfer(*propanol(False),0.08),6).tolist(),
     'twoSpin_J7_tau71428us':round(float(transfer(2,np.array([[0,7.0],[7.0,0]]),1/14.0)[1,0]),9),
     'twoSpin_J7_tau30ms':round(float(transfer(2,np.array([[0,7.0],[7.0,0]]),0.030)[1,0]),9),
     'sin2_30ms':round(float(np.sin(np.pi*7.0*0.030)**2),9)}
open('_ref.json','w').write(json.dumps(ref,indent=1))
print("REF:",json.dumps(ref))
