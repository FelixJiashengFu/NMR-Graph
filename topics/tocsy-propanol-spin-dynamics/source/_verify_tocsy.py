# -*- coding: utf-8 -*-
"""TOCSY 各向同性混合：精确对角化验证 + 平凡情形自检
约定（关键，曾在此处错一个因子 2）：
   H = 2*pi * sum_{i<j} J_ij (IixIjx + IiyIjy + IizIjz)   [角频率单位]
   U(t) = exp(-i H t)
   => 两自旋闭式解  M_12(tau) = sin^2(pi J tau),  tau_max = 1/(2J)
"""
import numpy as np

sx = np.array([[0,1],[1,0]],dtype=complex)/2
sy = np.array([[0,-1j],[1j,0]],dtype=complex)/2
sz = np.array([[1,0],[0,-1]],dtype=complex)/2
EY = np.eye(2,dtype=complex)

def op(N,k,s):
    out=np.array([[1]],dtype=complex)
    for j in range(N): out=np.kron(out, s if j==k else EY)
    return out

def build(N,J):
    H=np.zeros((2**N,2**N),dtype=complex)
    S=[[op(N,k,s) for s in (sx,sy,sz)] for k in range(N)]
    for i in range(N):
        for j in range(i+1,N):
            if J[i][j]==0: continue
            for a in range(3): H = H + J[i][j]*(S[i][a]@S[j][a])
    return 2*np.pi*H          # 角频率单位

def transfer(N,J,t):
    w,V=np.linalg.eigh(build(N,J))
    U=(V*np.exp(-1j*w*t))@V.T
    P=np.abs(U)**2
    M=np.zeros((N,N))
    for j in range(N):
        dj=np.diag(op(N,j,sz)).real
        for k in range(N):
            dk=np.diag(op(N,k,sz)).real
            M[j,k]=(dj@P@dk)/(dk@dk)
    return M

def trivials():
    o={}
    N=4;J=np.zeros((N,N))
    o['zeroCoupling_maxDev']=float(np.abs(transfer(N,J,0.05)-np.eye(N)).max())
    J=np.zeros((N,N));J[0][1]=J[1][2]=J[2][3]=7.0
    o['t0_maxDev']=float(np.abs(transfer(N,J,0.0)-np.eye(N)).max())
    o['oneSpin_maxDev']=float(np.abs(transfer(1,np.zeros((1,1)),0.037)-np.eye(1)).max())
    for t in (0.005,0.037,0.0714,0.12):
        o['cons_%g'%t]=float(np.abs(transfer(4,J,t).sum(axis=0)-1).max())
    for t in (0.013,0.055,0.099):
        M=transfer(4,J,t);o['sym_%g'%t]=float(np.abs(M-M.T).max())
    # 负相检查：是否出现负转移（用于图上"虚线负峰"）
    o['minOffdiag']=float(min(transfer(4,J,t)[j,k] for t in np.linspace(0,0.15,301) for j in range(4) for k in range(4) if j!=k))
    return o

def twoSpin():
    J=np.zeros((2,2));J[0][1]=7.0
    err=0.0;tmax=0.0;mx=0.0;rows=[]
    for t in np.linspace(0,0.2,4001):
        v=transfer(2,J,t)[1,0]
        err=max(err,abs(v-np.sin(np.pi*7.0*t)**2))
        if v>mx: mx=v;tmax=t
    for tms in (0,15,30,45,60,71.4286,90,120):
        t=tms/1000.0; rows.append((tms, transfer(2,J,t)[1,0], np.sin(np.pi*7.0*t)**2))
    return {'closedForm_maxErr':err,'maxTransfer':mx,'t_at_max_ms':tmax*1000,'theory_1_over_2J_ms':1000/(2*7.0)},rows

def propanol(includeOH=True,JHOC=5.2,J12=6.6,J23=7.4):
    N=4;J=np.zeros((N,N))
    J[1][2]=J[2][1]=J12;J[2][3]=J[3][2]=J23
    if includeOH: J[0][1]=J[1][0]=JHOC
    return N,J

L={0:'OH',1:'C1H2',2:'C2H2',3:'C3H3'}
def sweep(includeOH=True,grid=0.0001):
    N,J=propanol(includeOH);ts=np.arange(0,0.16+grid,grid);best={}
    for k in range(4):
        for j in range(k+1,4):
            vals=np.array([transfer(N,J,t)[j,k] for t in ts])
            i=int(np.argmax(vals));best['%s-%s'%(L[k],L[j])]=(float(ts[i]*1000),float(vals[i]))
    return best

if __name__=='__main__':
    print("== 平凡情形自检 ==")
    for k,v in trivials().items(): print("  %-22s %.3e"%(k,v))
    d,rows=twoSpin()
    print("== 两自旋闭式解 M_12=sin^2(pi J tau), J=7.0 Hz ==")
    for k,v in d.items(): print("  %-22s %s"%(k,v))
    print("   tau/ms    M12(数值)   sin^2(pi J tau)")
    for tms,a,b in rows: print("   %8.4f   %.8f   %.8f"%(tms,a,b))
    print("== 中继极大值（含 OH；J=5.2/6.6/7.4）==")
    for k,v in sweep(True).items(): print("  %-12s tmax=%5.1f ms  eff=%.4f"%(k,v[0],v[1]))
    print("== 中继极大值（不含 OH，3 自旋）==")
    for k,v in sweep(False).items(): print("  %-12s tmax=%5.1f ms  eff=%.4f"%(k,v[0],v[1]))
    N,J=propanol(True)
    print("== M(tau)：行=被观测自旋 j，列=起始自旋 k（含 OH）==")
    print("   tau  " + "".join("%9s"%L[i] for i in range(4)) + "   ||  C3 行")
    for tms in (10,20,30,40,50,60,70,80,90,100,120,140):
        M=transfer(N,J,tms/1000.0)
        print("  %4dms"%tms + "".join("%+9.4f"%M[j,0] for j in range(4)) + "   || " + " ".join("%+.4f"%M[3,k] for k in range(4)))
    N,J=propanol(False)
    print("== M(tau)（不含 OH：OH 行/列恒 0）==")
    for tms in (10,20,30,40,50,60,70,80,90,100,120,140):
        M=transfer(N,J,tms/1000.0)
        print("  %4dms  OH列=%.1e  C1<-=%.4f C2<-=%.4f C3<-=%.4f"%(tms,abs(M[0,1]),M[1,1],M[2,1],M[3,1]))
    print("== 峰计数：阈值 0.05 下出现峰数（含 OH）==")
    N,J=propanol(True)
    for tms in (20,40,60,80,100,130):
        M=transfer(N,J,tms/1000.0)
        n=sum(1 for a in range(4) for b in range(4) if abs(M[a,b])>=0.05)
        nd=sum(1 for a in range(4) for b in range(4) if a!=b and abs(M[a,b])>=0.05)
        print("   tau=%3dms  总方块=%2d  非对角方块=%2d  唯一相关对=%d"%(tms,n,nd,nd//2))
    print("== 长混合时间极限（平均化）: tau=5 s ==")
    N,J=propanol(True);M=transfer(N,J,5.0)
    print("  M = \n"+np.array2string(M,precision=4,suppress_small=False))
