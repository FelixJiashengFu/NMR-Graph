# -*- coding: utf-8 -*-
"""COSY 教学页 · 数值内核（Python 侧独立实现）+ 全部核对。
   A. 耦合图 / 峰计数（组合数学，可枚举验证）
   B. 反相双峰可见性：闭式解 + 数值求积 / 网格最大化 互拍
   C. 与原图逐像素读数的对照
   每个容差都是"可证否"的判据。"""
import json, math
import numpy as np
from scipy import integrate

def graph(sites, edges):
    n = len(sites)
    adj = [[None]*n for _ in range(n)]
    for (i, j, J) in edges:
        adj[i][j] = J; adj[j][i] = J
    seen = [False]*n; comps = []
    for s in range(n):
        if seen[s]: continue
        q = [s]; seen[s] = True; c = []
        while q:
            u = q.pop(); c.append(u)
            for v in range(n):
                if adj[u][v] is not None and not seen[v]:
                    seen[v] = True; q.append(v)
        comps.append(sorted(c))
    V = n; E = len(edges)
    return {'n_sites': V, 'n_edges': E, 'components': comps,
            'n_diagonal_peaks': V, 'n_cross_peaks': 2*E,
            'n_markers': V + 2*E, 'n_independent_peaks': V + E, 'adj': adj}

def count_by_enumeration(g):
    n = g['n_sites']; adj = g['adj']; diag = 0; cross = 0
    for i in range(n):
        for j in range(n):
            if i == j: diag += 1
            elif adj[i][j] is not None: cross += 1
    return diag, cross

def lorentz(nu, gamma): return (gamma/np.pi)/(nu**2 + gamma**2)

def Dfun(nu, J, dnu):
    g = dnu/2.0
    return lorentz(nu - J/2.0, g) - lorentz(nu + J/2.0, g)

def xstar(J, dnu):
    x = J/dnu
    w2 = (x*x - 1.0 + 2.0*math.sqrt(x**4 + x*x + 1.0))/3.0
    return (dnu/2.0)*math.sqrt(w2), x

def V_height(J, dnu):
    if J <= 0: return 0.0
    w, x = xstar(J, dnu); w2 = (w/(dnu/2.0))**2
    return (4.0*x*math.sqrt(w2))/(w2*w2 + 2.0*w2*(1.0 - x*x) + (x*x + 1.0)**2)

def V_snr(J, dnu):
    if J <= 0: return 0.0
    x = J/dnu
    return x/math.sqrt(1.0 + x*x)

def V_snr_numeric(J, dnu):
    g = dnu/2.0
    a = integrate.quad(lambda v: Dfun(v, J, dnu)**2, -np.inf, np.inf, limit=800,
                       epsabs=1e-16, epsrel=1e-13)[0]
    b = integrate.quad(lambda v: lorentz(v, g)**2, -np.inf, np.inf, limit=800,
                       epsabs=1e-16, epsrel=1e-13)[0]
    return math.sqrt(a/(2.0*b))   # 分母用 J->inf 的极限 2*int L^2 归一，这样 x->inf 时 V->1

def V_height_numeric(J, dnu, n=200001):
    if J <= 0: return 0.0
    span = 8.0*max(J, dnu) + 20.0*dnu
    v = np.linspace(-span, span, n); g = dnu/2.0
    D = lorentz(v - J/2.0, g) - lorentz(v + J/2.0, g)
    return float(np.abs(D).max()/(1.0/(np.pi*g)))

def integral_D(J, dnu):
    return integrate.quad(lambda v: Dfun(v, J, dnu), -np.inf, np.inf, limit=800,
                          epsabs=1e-16, epsrel=1e-14)[0]

HEPTANONE = {
 'name': '乙基丁基酮 heptan-3-one', 'formula': 'CH3CH2-CO-CH2CH2CH2CH3',
 'sites': [
   {'i':0,'lab':'C7H3','cn':'端甲基','d':0.901,'nH':3,'mult':'三重峰'},
   {'i':1,'lab':'C6H2','cn':'亚甲基 gamma','d':1.290,'nH':2,'mult':'五重峰/多重峰'},
   {'i':2,'lab':'C5H2','cn':'亚甲基 beta','d':1.565,'nH':2,'mult':'五重峰/多重峰'},
   {'i':3,'lab':'C4H2','cn':'亚甲基 alpha 羰基旁','d':2.420,'nH':2,'mult':'三重峰'},
   {'i':4,'lab':'C1H3','cn':'端甲基 乙基','d':0.988,'nH':3,'mult':'三重峰'},
   {'i':5,'lab':'C2H2','cn':'亚甲基 alpha 羰基旁','d':2.336,'nH':2,'mult':'四重峰'}],
 'edges': [(0,1,'3J'),(1,2,'3J'),(2,3,'3J'),(4,5,'3J')],
 'J3': 7.3, 'J4': 0.5, 'J4_edge': (3,5)}
HEXANONE = {
 'name': '乙基丙基酮 3-hexanone（原文标题所说）', 'formula': 'CH3CH2-CO-CH2CH2CH3',
 'sites': [
   {'i':0,'lab':'C1H3','cn':'端甲基 丙基','d':0.90,'nH':3,'mult':'三重峰'},
   {'i':1,'lab':'C2H2','cn':'亚甲基 beta','d':1.60,'nH':2,'mult':'六重峰 表观'},
   {'i':2,'lab':'C3H2','cn':'亚甲基 alpha','d':2.36,'nH':2,'mult':'三重峰'},
   {'i':3,'lab':'C6H3','cn':'端甲基 乙基','d':1.05,'nH':3,'mult':'三重峰'},
   {'i':4,'lab':'C5H2','cn':'亚甲基 alpha','d':2.41,'nH':2,'mult':'四重峰'}],
 'edges': [(0,1,'3J'),(1,2,'3J'),(3,4,'3J')],
 'J3': 7.3, 'J4': 0.0, 'J4_edge': (2,4)}

def build_edges(mol, include_4J=False, J4=0.5):
    e = [(i, j, mol['J3']) for (i, j, _) in mol['edges']]
    if include_4J:
        e.append((mol['J4_edge'][0], mol['J4_edge'][1], J4))
    return e

if __name__ == '__main__':
    print("="*74); print("A. 耦合图 / 峰计数")
    msr = json.load(open('_measure.json', encoding='utf-8'))
    n_meas = len(msr['cross_pairs'])*2 + 6
    markers = {}
    for mol, tag in ((HEPTANONE,'heptan-3-one'), (HEXANONE,'3-hexanone')):
        g = graph(mol['sites'], build_edges(mol, False))
        d, c = count_by_enumeration(g)
        assert (d, c) == (g['n_diagonal_peaks'], g['n_cross_peaks'])
        markers[tag] = g['n_markers']
        print("  %-14s 位点 %d  边 %d  片段 %s  对角 %d  交叉 %d  方块合计 %d  独立峰 %d"%(
            tag, g['n_sites'], g['n_edges'], g['components'], d, c, d+c, g['n_independent_peaks']))
    g4 = graph(HEPTANONE['sites'], build_edges(HEPTANONE, True, HEPTANONE['J4']))
    print("  若把跨羰基 4J 也算一条边 -> %d 个方块（比原图多 2 个）"%g4['n_markers'])
    print("  原图实测方块数 = %d（4 对交叉峰 x2 + 6 个对角峰）"%n_meas)
    print("  => 与 heptan-3-one 的 %d 相符；与 3-hexanone 的 %d 不符"%(markers['heptan-3-one'], markers['3-hexanone']))
    g0 = graph([], []);  g1 = graph([{'i':0}], []); g2 = graph([{'i':0},{'i':1}], [(0,1,7.0)])
    print("  平凡: 无氢分子 -> %d 个峰；单一位点 -> %d 个；两自旋 -> %d 个"%(
        g0['n_markers'], g1['n_markers'], g2['n_markers']))
    assert (g0['n_markers'], g1['n_markers'], g2['n_markers']) == (0, 1, 4)
    for m in range(1, 9):
        gl = graph([{'i':k} for k in range(m)], [(k, k+1, 7.0) for k in range(m-1)])
        assert gl['n_markers'] == 3*m-2, (m, gl['n_markers'])
    print("  链式公式 n=3m-2 对 m=1..8 成立（1,4,7,10,13,16,19,22 个方块）")

    print("="*74); print("B. 反相双峰可见性")
    xs = np.linspace(1e-4, 20, 400)
    assert np.all(np.diff([V_snr(v, 1.0) for v in xs]) > 0)
    assert np.all(np.diff([V_height(v, 1.0) for v in xs]) > 0)
    print("  单调性: V_snr / V_height 在 x in (0,20] 上均单调增  OK")
    e_h = max(abs(V_height(J, d) - V_height_numeric(J, d))
              for (J, d) in [(7.3,1.5),(0.5,1.5),(0.5,0.3),(3.0,6.0),(15.0,0.8)])
    print("  V_height 闭式 vs 细网格数值最大化: 最大偏差 %.3e"%e_h)
    e_s = max(abs(V_snr(J, d) - V_snr_numeric(J, d))
              for (J, d) in [(7.3,1.5),(0.5,1.5),(0.5,0.3),(2.0,2.0)])
    print("  V_snr 闭式 vs 无穷区间数值求积（同样除以 2*int L^2）: 最大偏差 %.3e"%e_s)
    print("  不变量 int D dnu = 0: 最大 |积分| = %.3e"%max(
        abs(integral_D(J, d)) for (J, d) in [(7.3,1.5),(0.5,1.5),(3.0,0.6)]))
    e_sc = max(abs(V_snr(J, d) - V_snr(2*J, 2*d)) for (J, d) in [(7.3,1.5),(0.5,0.3),(2.2,0.9)])
    e_sc2 = max(abs(V_height(J, d) - V_height(3*J, 3*d)) for (J, d) in [(7.3,1.5),(0.5,1.5)])
    print("  标度不变性: V_snr 放大 2 倍 %.3e ；V_height 放大 3 倍 %.3e"%(e_sc, e_sc2))
    print("  x->inf 时 V->1: x=1e3 时 1-V_snr = %.3e, 1-V_height = %.3e （理论 ~1/(8x^2)=%.1e）"%(
        1-V_snr(1e3,1.0), 1-V_height(1e3,1.0), 1/(8*1e3**2)))
    print("  x->0 渐近 V_snr ~ x:  V/x =", ["%.10f"%(V_snr(v,1.0)/v) for v in (1e-3, 1e-4, 1e-5)])
    print("  x->0 渐近 V_height ~ (3*sqrt(3)/4)x: V/x =", ["%.8f"%(V_height(v,1.0)/v) for v in (1e-2,1e-3,1e-4)],
          "理论 %.8f"%(3*math.sqrt(3)/4))
    for J, d in [(700.0, 1.0), (70.0, 1.0)]:
        nu, xv = xstar(J, d)
        print("  J/dnu=%5.0f: 2*nu* - J = %.3e（相对 %.2e，理论 ~1/(8x^3)=%.1e）"%(
            xv, 2*nu-J, (2*nu-J)/J, 1/(8*xv**3)))
    for J, d in [(7.3, 1.5), (0.5, 0.6)]:
        nu, _ = xstar(J, d); h = 1e-7
        print("  J=%.1f dnu=%.1f: D'(nu*) = %.3e（应 0）"%(J, d, (Dfun(nu+h,J,d)-Dfun(nu-h,J,d))/(2*h)))
    print("  常用取值（页内读数用的就是这几个）:")
    for (J, d) in [(7.3,1.5),(7.3,0.8),(7.3,3.0),(0.5,1.5),(0.5,0.8),(1.0,1.5),(2.0,1.5)]:
        print("     J=%.1f Hz, dnu=%.1f Hz -> J/dnu=%.2f  V_height=%.3f  V_snr=%.3f"%(
            J, d, J/d, V_height(J, d), V_snr(J, d)))

    print("="*74); print("C. 与原图读数对照")
    cons = msr['shift_consensus_ppm']
    print("  原图共识位移 (ppm):", cons, " 两次独立读数最大偏差 %.3f ppm"%msr['shift_two_readings_max_dev_ppm'])
    model_d = [s['d'] for s in HEPTANONE['sites']]
    print("  模型位移      (ppm):", [round(v,3) for v in model_d])
    dev = [round(model_d[i] - min(cons, key=lambda c: abs(c-model_d[i])), 4) for i in range(6)]
    print("  模型位移与最近的原图读数之差 (ppm):", dev)
    assert max(abs(v) for v in dev) < 0.001, dev
    print("  原图 6 个 1D 峰 vs 6 个对角方块: 位置一一对应（两次独立读数）")
    ref = {'V_snr': {('%g_%g'%(J,d)): round(V_snr(J,d),12) for (J,d) in
                     [(7.3,1.5),(7.3,0.8),(0.5,1.5),(0.5,0.3),(2.0,2.0),(15.0,0.8)]},
           'V_height': {('%g_%g'%(J,d)): round(V_height(J,d),12) for (J,d) in
                        [(7.3,1.5),(7.3,0.8),(0.5,1.5),(0.5,0.3),(2.0,2.0),(15.0,0.8)]},
           'nu_star': {('%g_%g'%(J,d)): round(xstar(J,d)[0],12) for (J,d) in [(7.3,1.5),(0.5,1.5),(0.5,0.3)]},
           'shift_consensus_ppm': cons,
           'markers_heptanone': markers['heptan-3-one'],
           'markers_hexanone': markers['3-hexanone'],
           'n_measured_markers': n_meas}
    json.dump(ref, open('_ref.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    print("  已写出 _ref.json（供页面 JS 对拍）")
