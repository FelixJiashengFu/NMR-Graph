# -*- coding: utf-8 -*-
"""两自旋 COSY 脉冲序列：显式密度矩阵模拟（独立于页面 JS 的第二套实现）
   90x - t1 - beta_x - t2(检测)；  H = Om1*I1z + Om2*I2z + 2*pi*J*(I1.I2)
   目的：验证"混合脉冲翻转角 beta 决定对角峰 / 交叉峰强弱"的解析律。
   踩过的坑：谱宽 SW = 1/dt 只有 500 Hz，而位移取 800/1100 Hz 会折叠（alias），
   于是所有"峰"都取到同一个边界点 ==> 四个峰幅度完全相同。位移必须落在 ±SW/2 内。"""
import numpy as np

sx = np.array([[0,1],[1,0]],dtype=complex)/2
sy = np.array([[0,-1j],[1j,0]],dtype=complex)/2
sz = np.array([[1,0],[0,-1]],dtype=complex)/2
E  = np.eye(2,dtype=complex)
def op(a,b): return np.kron(a,b)
I1x,I1y,I1z = op(sx,E),op(sy,E),op(sz,E)
I2x,I2y,I2z = op(E,sx),op(E,sy),op(E,sz)
Mdet = I1x + 1j*I1y + I2x + 1j*I2y

def Us(H, ts):
    w, V = np.linalg.eigh(H)
    ph = np.exp(-1j*np.outer(ts, w))
    return np.einsum('ij,nj,kj->nik', V, ph, V.conj())

def cosy_2d(beta, Om1=2*np.pi*120.0, Om2=2*np.pi*200.0, J=7.0, T2=0.6,
            n1=512, n2=1024, dt=2e-3, debug=False):
    H = Om1*I1z + Om2*I2z + 2*np.pi*J*(I1x@I2x + I1y@I2y + I1z@I2z)
    t1s = np.arange(n1)*dt; t2s = np.arange(n2)*dt
    U1 = Us(H, t1s); U2 = Us(H, t2s)
    R90 = Us((np.pi/2)*(I1x+I2x), np.array([1.0]))[0]
    Rb  = Us(beta*(I1x+I2x), np.array([1.0]))[0]
    rho1 = R90 @ (I1z+I2z) @ R90.conj().T
    A  = np.einsum('aij,jk,alk->ail', U1, rho1, U1.conj())
    R2 = np.einsum('ij,ajk,lk->ail', Rb, A, Rb.conj())
    W  = np.einsum('bji,jk,bkl->bil', U2.conj(), Mdet, U2)
    S  = np.einsum('aij,bji->ab', R2, W) * np.exp(-t1s/T2)[:,None] * np.exp(-t2s/T2)[None,:]
    F  = np.fft.fftshift(np.fft.fft2(S))
    f1 = np.fft.fftshift(np.fft.fftfreq(n1, dt)); f2 = np.fft.fftshift(np.fft.fftfreq(n2, dt))
    if debug:
        k = np.dstack(np.unravel_index(np.argsort(-np.abs(F).ravel())[:6], F.shape))[0]
        print('   top |F| @', [(round(float(f1[i]),1), round(float(f2[j]),1), round(float(abs(F[i,j])),3)) for i,j in k])
    def pk(fa, fb, half=8):
        i = int(np.argmin(abs(f1-fa))); j = int(np.argmin(abs(f2-fb)))
        return float(np.abs(F[max(0,i-half):i+half+1, max(0,j-half):j+half+1]).max())
    return pk(120,200), pk(200,120), pk(120,120), pk(200,200)

if __name__ == '__main__':
    print("单点自检 beta=90（应只在 120/200 Hz 附近出峰）:")
    cosy_2d(np.pi/2, debug=True)
    rows = []
    for bdeg in (5,15,30,45,60,75,90,105,120,135,150,175):
        b = np.deg2rad(bdeg); cx,cy,d1,d2 = cosy_2d(b); rows.append((bdeg,cx,cy,d1,d2))
    refx = max(r[1] for r in rows if r[0]==90)
    refd = max(r[3] for r in rows if r[0]==5)
    print(" beta   cross(120,200) cross(200,120)   diag(120)    diag(200)   cross/(ref*sin)  diag/(ref*cos)")
    rxs=[]; rds=[]
    for bdeg,cx,cy,d1,d2 in rows:
        b = np.deg2rad(bdeg)
        a = (cx/refx)/np.sin(b) if np.sin(b)>0.02 else float('nan')
        c = (d1/refd)/np.cos(b) if abs(np.cos(b))>0.02 else float('nan')
        if a==a: rxs.append(a)
        if c==c: rds.append(c)
        print("%5d  %11.4e %11.4e  %11.4e %11.4e   %10.5f      %10s"%(bdeg,cx,cy,d1,d2,a,("%.5f"%c) if c==c else "nan"))
    print("cross/(ref*sin b) 均值 %.4f 最大偏差 %.2e"%(np.mean(rxs), np.max(np.abs(np.array(rxs)-1))))
    print("diag/(ref*cos b)  均值 %.4f 最大偏差 %.2e"%(np.mean(rds), np.max(np.abs(np.array(rds)-1))))
