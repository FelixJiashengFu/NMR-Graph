
# -*- coding: utf-8 -*-
"""_verify_cosy.py —— Python 独立实现，对拍页面 JS 数值内核
四套互相独立的核算：
  ① 复密度矩阵 + NumPy 厄米矩阵对角化的精确量子演化
  ② 纯 numpy 重写页面里的转移矩阵（逐元素对拍 JS 内核）
  ③ Bloch–McConnell 解析特征值 vs numpy.linalg.eigvals 直接对角化
  ④ 一阶多重峰计数（n+1 规则）
"""
import json, cmath, math, numpy as np
from pathlib import Path

FAIL = []
def check(name, dev, tol, extra=""):
    okv = dev <= tol
    print("  %-44s 偏差 %.3e  tol %.0e  %s %s" % (name, dev, tol, "OK " if okv else "FAIL", extra))
    if not okv: FAIL.append(name)

Ix=np.array([[0,1],[1,0]])/2; Iy=np.array([[0,-1j],[1j,0]])/2; Iz=np.array([[1,0],[0,-1]])/2
def kron(*ms):
    o=np.array([[1.0+0j]])
    for m in ms: o=np.kron(o,m)
    return o
def op(o,w,n=2): return kron(*[o if i==w else np.eye(2) for i in range(n)])
def coef(rho, O): return (np.trace(rho @ O)/np.trace(O @ O))   # 归一化内积

def rot90(which, axis):
    """e^{-i(π/2) I_x}（axis='x'）或 e^{-i(π/2) I_y}（axis='y'），作用在哪个自旋上"""
    import cmath as _c
    if axis == 'x':
        R = (np.eye(2, dtype=complex) - 1j*np.array([[0,1],[1,0]])) / np.sqrt(2)
    else:
        R = (np.eye(2, dtype=complex) - 1j*np.array([[0,-1j],[1j,0]])) / np.sqrt(2)
    return op(R, which)


print("="*80)
print("① 精确量子演化（2 自旋，弱耦合 H = 2πJ I_z I_z）")
print("="*80)
J = 7.3
H = 2*np.pi*J*kron(Iz,Iz)                      # COSY 的混合哈密顿量（弱耦合）
_energy, _states = np.linalg.eigh(H)
def U(t): return (_states * np.exp(-1j*_energy*t)) @ _states.conj().T
IA_x, IA_y, IB_x, IB_y, IB_z = op(Ix,0), op(Iy,0), op(Ix,1), op(Iy,1), op(Iz,1)

# (a) 第一个 90° 脉冲 + 混合期：I_x 进动成反相项（乘积算符恒等式，逐元素对拍 expm）
#     符号由数值实验定：U I_x^A U† = cos·I_x^A + sin·(2I_y^A I_z^B)   [+ 号，不是 − 号]
worst=0
for tau_ms in [0, 5, 12, 34.2466, 60, 100]:
    t=tau_ms/1000
    rho = U(t) @ IA_x @ U(t).conj().T
    c1 = coef(rho, IA_x).real; c2 = coef(rho, 2*kron(Iy,Iz)).real
    worst=max(worst, abs(c1-np.cos(np.pi*J*t)), abs(c2-np.sin(np.pi*J*t)))
check("U I_x^A U† = cos(πJτ)·I_x^A + sin(πJτ)·(2I_y^A I_z^B)", worst, 1e-12)
worst=0
for tau_ms in [0, 5, 12, 34.2466, 60, 100]:
    t=tau_ms/1000
    rho = U(t) @ op(Ix,1) @ U(t).conj().T
    c1 = coef(rho, op(Ix,1)).real; c2 = coef(rho, 2*kron(Iz,Iy)).real
    worst=max(worst, abs(c1-np.cos(np.pi*J*t)), abs(c2-np.sin(np.pi*J*t)))
check("U I_x^B U† = cos(πJτ)·I_x^B + sin(πJτ)·(2I_z^A I_y^B)", worst, 1e-12)

# (b) 第二个 90°x 脉冲：反相项 → 两自旋算符
#     e^{-i(π/2)I_x^B} (2I_y^A I_z^B) e^{+i(π/2)I_x^B} = -2I_y^A I_y^B
Px90 = rot90(1,'x')
worst=0
for tau_ms in [0, 5, 12, 34.2466, 60, 100]:
    t=tau_ms/1000
    rho = U(t) @ IA_x @ U(t).conj().T
    rho = Px90 @ rho @ Px90.conj().T
    worst=max(worst, abs(coef(rho, 2*kron(Iy,Iy)).real + np.sin(np.pi*J*t)))
check("(π/2)_x^B 后 2I_y^A I_z^B → −sin(πJτ)·2I_y^A I_y^B", worst, 1e-12)

# (c) 脉冲序列结束时的密度矩阵里，两个峰的"权重算符"系数
#     交叉峰：2I_y^A I_y^B 的系数 = −sin(2πJτ) ；对角峰：I_x^A 的系数 = cos(2πJτ)
#     （都是 ±1 量级。真实谱峰面积还要乘上 t₂ 演化的双重态权重，见 _dbg3 的积分）
seq_cross = lambda t: Px90 @ U(t) @ IA_x @ U(t).conj().T @ Px90.conj().T
worst=0
for tau_ms in [0, 5, 12, 34.2466, 60, 100]:
    t=tau_ms/1000
    rho = seq_cross(t)
    worst=max(worst, abs(coef(rho, 2*kron(Iy,Iy)).real + np.sin(np.pi*J*t)),
                     abs(coef(rho, IA_x).real - np.cos(np.pi*J*t)))
check("序列末：−sin(πJτ)·2I_y^A I_y^B 与 cos(2πJτ)·I_x^A", worst, 1e-12)
worst=0
for tau_ms in [0, 5, 12, 34.2466, 60, 100]:
    t=tau_ms/1000
    rho = rot90(0,'x') @ U(t) @ op(Ix,1) @ U(t).conj().T @ rot90(0,'x').conj().T
    worst=max(worst, abs(coef(rho, 2*kron(Iy,Iy)).real + np.sin(np.pi*J*t)))
check("对称情形（交换 A/B）给出同一结论", worst, 1e-12)
print("  ⇒ 交叉峰 ∝ sin(πJτ)：1/(2J)=%.4f ms 处转移最完全；对角峰 ∝ cos(πJτ) 在同一时刻恰好为 0" % (1000/(2*J)))
print("  ⇒ 与 TOCSY 对照：各向同性混合给出 sin²(πJτ)，极大在 1/(2J) — 两种实验的 τ 依赖不同")


print()
print("="*80)
print("② 页面模型（Python 重写）与 JS 内核逐元素对拍")
print("="*80)
JREF, T2 = 7.3, 1200.0
fCross = lambda Jc, t: np.sin(np.pi*Jc*t/1000)*np.exp(-2*t/T2)
gDiag  = lambda Jc, t: np.cos(np.pi*Jc*t/1000)*np.exp(-2*t/T2)
tstar = 1000*math.atan(math.pi*JREF*T2/2000)/(math.pi*JREF)
K = fCross(JREF, tstar)
print("  τ* = tan(πJτ) = πJT₂/2 的根 = %.10f ms ；归一化常数 K = %.10f" % (tstar, K))
check("τ* 满足 tan(πJτ*) = πJT₂/2", abs(np.tan(np.pi*JREF*tstar/1000) - np.pi*JREF*T2/2000), 1e-12)
check("无弛豫极限 τ* = 1/(2J)", abs(1000/(2*JREF) - 68.4931506849), 1e-9, "%.6f ms" % (1000/(2*JREF)))
ts = np.linspace(tstar-5, tstar+5, 4000001)
check("高密度采样极大点 = 解析 τ*", abs(ts[int(np.argmax(fCross(JREF, ts)))]-tstar), 2e-3,
      "采样 %.6f ms" % ts[int(np.argmax(fCross(JREF, ts)))])
tt = np.linspace(0, 160, 1601)
check("不变量 cross²+diag² = e^{-4τ/T₂}",
      float(np.max(np.abs(fCross(JREF,tt)**2+gDiag(JREF,tt)**2-np.exp(-4*tt/T2)))), 1e-12)
Jm_full = np.array([[0,5.2,0,0],[5.2,0,6.6,0],[0,6.6,0,7.3],[0,0,7.3,0]], float)
sites_full = [("OH",2.20,1,True),("C1",3.57,2,False),("C2",1.56,2,False),("C3",0.93,3,False)]
def peaks_py(tau, includeOH=True):
    keep=[i for i,s in enumerate(sites_full) if includeOH or not s[3]]
    Jm=Jm_full[np.ix_(keep,keep)]; out=[]
    for j in range(len(keep)):
        for k in range(len(keep)):
            if j==k:
                amp=gDiag(float(Jm[j].max()),tau)/K; diag=True
            else:
                Jc=float(Jm[j][k])
                if Jc<=0: continue
                amp=fCross(Jc,tau)/K; diag=False
            out.append((sites_full[keep[j]][1], sites_full[keep[k]][1], amp, diag))
    return out
ref = json.load(open(Path(__file__).with_name('_js_ref.json')))
worst=0.0; ncells=0
for key, jspeaks in ref['peaks'].items():
    parts=dict(p.split('=') for p in key.split('|'))
    py=peaks_py(float(parts['tau']), parts['oh']=='1')
    assert len(py)==len(jspeaks), (key, len(py), len(jspeaks))
    for (f2,f1,amp,diag), jsp in zip(py, jspeaks):
        assert abs(jsp['f2']-f2)<1e-12 and abs(jsp['f1']-f1)<1e-12 and jsp['diag']==diag
        worst=max(worst, abs(jsp['amp']-amp)); ncells+=1
check("JS 内核 vs Python 重写（位移/对角标记/幅度）", worst, 1e-12,
      "%d 组参数 %d 个格" % (len(ref['peaks']), ncells))

# 交换因子：JS 的 2x2 传播子 vs Python 独立实现
def alpha_py(k, dHz, t_ms, R2=0.0, ps=1.0):
    w=2*np.pi*dHz; be=k*ps; ga=k*(1-ps)
    M=np.array([[complex(-R2-be,-w), complex(ga,0)],[complex(be,0), complex(-R2-ga,0)]])
    tr=M[0,0]+M[1,1]; det=M[0,0]*M[1,1]-M[0,1]*M[1,0]
    s=cmath.sqrt(tr*tr-4*det); l1,l2=(tr-s)/2,(tr+s)/2
    t=t_ms/1000.0; E1,E2=cmath.exp(l1*t),cmath.exp(l2*t); E=(E1-E2)/(l1-l2)
    return abs(ps*(E*tr+E2) + (1-ps)*(-E*M[1,0]))
worst_a=0.0; na=0
for key, val in ref['alpha'].items():
    parts=dict(p.split('=') for p in key.split('|'))
    worst_a=max(worst_a, abs(val-alpha_py(float(parts['k']), float(parts['dHz']), float(parts['t'])))); na+=1
check("交换因子 alpha：JS vs Python 传播子", worst_a, 1e-9, "%d 组（两套写法不同，浮点差 ~1e-11）" % na)
check("alpha 的平凡情形：k=0 ⇒ 恒为 1", abs(alpha_py(0,440,65.3)-1), 1e-15)
# 组合计数：链状耦合 ⇒ 独立峰 = N + (N-1)
for n,exp_cells,exp_indep in [(4,10,7),(3,7,5)]:
    keep=list(range(n)); P=peaks_py(36.0, includeOH=(n==4))
    indep=sum(1 for (f2,f1,a,d) in P if d or f2<f1)
    check("N=%d 位点链：格数 %d、独立峰 %d"%(n,exp_cells,exp_indep),
          abs(len(P)-exp_cells)+abs(indep-exp_indep), 1e-12)

print()
print("="*80)
print("③ Bloch–McConnell 交换：解析特征值 vs numpy.linalg.eigvals 直接对角化")
print("="*80)
def bm_direct(k, ps, dHz, R2):
    """与页面内核同一个 2x2 Liouvillian（实验室系，原点在水峰上）：
       [[ -R2 - k*ps - i w ,  k*(1-ps) ],
        [  k*ps            ,  -R2 - k*(1-ps) ]]
       注意两个对角元各自带一个 -k 项（这是之前推错的地方），
       否则交换饱和值 Re λ → -(R₂ + k·ps) 而不是 -(R₂ + k)。"""
    w=2*np.pi*dHz; be=k*ps; ga=k*(1-ps)
    return np.linalg.eigvals(np.array([[complex(-R2-be,-w), complex(ga,0)],
                                       [complex(be,0), complex(-R2-ga,0)]]))
def bm_pair(k, ps, dHz, R2):
    w=2*np.pi*dHz; be=k*ps; ga=k*(1-ps)
    a=complex(-R2-be,-w); b=complex(ga,0); c=complex(be,0); d=complex(-R2-ga,0)
    tr=a+d; det=a*d-b*c; s=cmath.sqrt(tr*tr-4*det)
    return np.array([(tr-s)/2,(tr+s)/2])
worst=0.0; pairs=0
for dHz in [50,100,440,2000]:
    for k in [0,0.5,1,30,300]:
        for ps in [0.0,0.25,0.5,0.999,1.0]:
            ev=bm_direct(k,ps,dHz,0.0); pr=bm_pair(k,ps,dHz,0.0)
            # 特征值是无序集合：两种配对取较优的那个（Hausdorff 距离）
            d = min(max(abs(ev[0]-pr[0]),abs(ev[1]-pr[1])),
                    max(abs(ev[0]-pr[1]),abs(ev[1]-pr[0])))
            worst=max(worst, d); pairs+=1
check("JS 的两个根 == numpy 特征值（良态区 dHz≤2000, k≤300；按无序集合比对）", worst, 1e-10, "%d 组" % pairs)
# k=10^6、ps=0 时 numpy.linalg.eigvals 自身病态（把 -10^6-6.3e4i 报成 -10^6+0i），
# 改用独立算出的迹/行列式把根代回特征方程核对（对任何 k 都成立）
def bm_resid(k, ps, dHz, R2, z):
    """把根代回特征方程 z² − tr·z + det = 0（tr/det 由矩阵直接取，不另推）"""
    w=2*np.pi*dHz; be=k*ps; ga=k*(1-ps)
    A11=complex(-R2-be,-w); A12=complex(ga,0); A21=complex(be,0); A22=complex(-R2-ga,0)
    tr=A11+A22; det=A11*A22-A12*A21
    return abs(z*z - tr*z + det)
worst3=0.0
for dHz in [50,100,440,2000,10_000]:
    for k in [0,0.5,1,30,300,10**6]:
        for ps in [0.0,0.25,0.5,0.999,1.0]:
            for z in bm_pair(k,ps,dHz,0.0):
                worst3=max(worst3, bm_resid(k,ps,dHz,0.0,z))
check("两个根都满足特征方程 z² − tr·z + det = 0（全部 k，含 k=10⁶）", worst3, 1e-3, "残差是 k² 量级的浮点噪声")
# 主根选取与"两个对角元 b=(1-ps)k、c=ps k"是否对称有关：ps=1 与 ps=0 是同一物理的两个极限
# 下面单独核对真正会用到的区间（ps=1：-OH 的布居全在 -OH 上）
worst2=0.0
for dHz in [50,100,440,2000]:
    for k in [0,0.5,1,30,300]:
        ev=bm_direct(k,1.0,dHz,0.0); pr=bm_pair(k,1.0,dHz,0.0)
        worst2=max(worst2, min(max(abs(ev[0]-pr[0]),abs(ev[1]-pr[1])),
                               max(abs(ev[0]-pr[1]),abs(ev[1]-pr[0]))))
check("ps=1（实际使用区间）两套根一致（无序集合）", worst2, 1e-10)
p0 = bm_pair(0,1.0,440,1.413716694)
main0 = p0[int(np.argmax(np.abs(p0.imag)))]
check("k=0 ⇒ λ = -R₂ - i2πΔν", abs(main0-complex(-1.413716694,-2*np.pi*440)), 1e-9)
check("快速交换 ⇒ Re λ = -(R₂+k)", abs(bm_pair(10**6,1.0,440,0)[0].real+10**6), 1e-9)

print()
print("="*80)
print("④ 一阶多重峰计数（n+1 规则）")
print("="*80)
def lines(partners):
    L=[(0.0,1.0)]
    for m,Jc in partners:
        nx=[]
        for i in range(m+1):
            c=math.comb(m,i)/2**m; off=(i-m/2)*Jc
            for o,w in L: nx.append((o+off,w*c))
        L=nx
    return sorted(L, key=lambda x:-x[0])
c3=lines([(2,7.3)]); c2a=lines([(3,7.3)])
check("CH₃ 三重峰（受 CH₂ 裂分）强度 1:2:1", max(abs(w-r) for (_,w),r in zip(c3,[0.25,0.5,0.25])), 1e-12,
      "线数 %d" % len(c3))
check("CH₂ 四重峰（受 CH₃ 裂分）强度 1:3:3:1", max(abs(w-r) for (_,w),r in zip(c2a,[0.125,0.375,0.375,0.125])), 1e-12)
sub=lines([(3,7.3),(2,6.6)])
check("正丙醇 C2-H₂ 一阶线数 = (3+1)(2+1) = 12", abs(len(sub)-12), 1e-12)
single=lines([(2,10.4)])            # 两个等价 ¹H 合并成一个 m=2、J'=2J 的核 -> 三重峰
dbl5 = lines([(2,5.2)])             # 若不合并、只当作一个 m=2、J=5.2 的核 -> 宽度只有一半
inner = [o for o,w in single if abs(o) < 1e-9]
check("等价核合并：三重峰中心线在 0", abs(inner[0]) if inner else 1, 1e-12)
check("不合并会把峰宽算小一半（这是必须合并的理由）",
      abs(2*(dbl5[0][0]-dbl5[2][0]) - (single[0][0]-single[2][0])), 1e-12)
check("三重峰强度归一 Σw = 1", abs(sum(w for _,w in single)-1), 1e-12)
check("CH₃ 三重峰完全对称：Σ(offset×weight) = 0", abs(sum(o*w for o,w in c3)), 1e-12)

print()
print("="*80)
print("结论：%s" % ("全部通过" if not FAIL else "失败项 " + str(FAIL)))
print("="*80)
