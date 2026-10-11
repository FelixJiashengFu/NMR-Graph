# -*- coding: utf-8 -*-
"""原图逐像素测量：把幻灯片截图里"确实有的"东西全部量化，输出 _measure.json。
   只做测量与标定，不做任何化学推断；凡测不准的一律记 uncertainty。"""
import json, numpy as np
from PIL import Image

SRC = '原图-COSY截图.webp'
im = Image.open(SRC).convert('RGB')
A = np.array(im).astype(int); G = np.array(im.convert('L')).astype(int)
H, W, _ = A.shape
R, Gc, B = A[:,:,0], A[:,:,1], A[:,:,2]
out = {'source': {'file': SRC, 'size_px': [W, H], 'mode': im.mode}}

# ---------- 1) 2D 绘图框：找最长横/竖暗线 ----------
dark = G < 170
rows = [(y, int(dark[y, 900:1560].sum())) for y in range(300, 800)]
cols = [(x, int(dark[300:800, x].sum())) for x in range(880, 1600)]
frame_y = sorted([r for r in rows if r[1] > 250], key=lambda t: -t[1])[:2]
frame_x = sorted([c for c in cols if c[1] > 250], key=lambda t: -t[1])[:2]
top_y, bot_y = sorted(y for y, _ in frame_y)
lef_x, rig_x = sorted(x for x, _ in frame_x)
out['frame_px'] = {'top': top_y, 'bottom': bot_y, 'left': lef_x, 'right': rig_x}

# ---------- 2) 轴标定：刻度标签文字块（两轴各 7 个） ----------
def label_runs(axis, gap=8, thr=215):
    if axis == 'F2':
        band = G[762:770, :]; cols_ = [x for x in range(900, 1470) if (band[:, x] < thr).any()]
    else:
        band = G[:, 1432:1478]; cols_ = [y for y in range(380, 780) if (band[y, :] < thr).any()]
    runs = []
    for v in cols_:
        if runs and v - runs[-1][-1] <= gap: runs[-1].append(v)
        else: runs.append([v])
    return [(r[0], r[-1], (r[0] + r[-1]) / 2.0) for r in runs if r[-1] - r[0] >= 1]

f2l = label_runs('F2'); f1l = label_runs('F1')
assert len(f2l) == 7 and len(f1l) == 7, (len(f2l), len(f1l))
# F2 轴从左到右 = 3.0 -> 0；F1 轴从上到下 = 0 -> 3.0（方向必须分别写，写反过一次）
ppm_f2 = [3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0]
ppm_f1 = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
xs = np.array([c for _, _, c in f2l]); ys = np.array([c for _, _, c in f1l])
sx, ix = np.polyfit(ppm_f2, xs, 1)          # x = sx*ppm + ix
sy, iy = np.polyfit(ppm_f1, ys, 1)          # y = sy*ppm + iy
resx = float(np.abs(xs - (sx*np.array(ppm_f2)+ix)).max())
resy = float(np.abs(ys - (sy*np.array(ppm_f1)+iy)).max())
out['calibration'] = {
    'F2': {'label_centers_x': [round(c,1) for _,_,c in f2l], 'px_per_ppm': round(float(sx),3),
           'x_at_0ppm': round(float(ix),2), 'max_residual_px': round(resx,2), 'max_residual_ppm': round(resx/abs(sx),3)},
    'F1': {'label_centers_y': [round(c,1) for _,_,c in f1l], 'px_per_ppm': round(float(sy),3),
           'y_at_0ppm': round(float(iy),2), 'max_residual_px': round(resy,2), 'max_residual_ppm': round(resy/abs(sy),3)},
    'labels_read': ['3.0','2.5','2.0','1.5','1.0','0.5','0']}
def f2(px): return (px - ix) / sx
def f1(py): return (py - iy) / sy

# ---------- 3) 1D 投影（上=F2，左=F1）的峰位 ----------
def proj_peaks(band, axis, min_ppm=-0.05, max_ppm=3.6):
    """一维投影峰位：谱线暗度剖面（基线扣除后）的峰。用 145/103.6 px/ppm 的标定回算 ppm。"""
    from scipy.signal import find_peaks
    prof = (255 - band).sum(axis=0).astype(float)
    prof = prof - np.percentile(prof, 10)
    pk, _ = find_peaks(prof, prominence=0.10 * prof.max(), distance=6)
    return [float(p) for p in pk]

top_px = proj_peaks(G[300:386, 905:1421], 'F2')
top_px = [x + 905 for x in top_px]
left_px = proj_peaks(G[387:757, 815:900].T, 'F1')
left_px = [y + 387 for y in left_px]
out['proj_top_F2'] = [{'px': round(x,1), 'ppm': round(float(f2(x)),3)} for x in top_px]
out['proj_left_F1'] = [{'px': round(y,1), 'ppm': round(float(f1(y)),3)} for y in left_px]
out['proj_peak_count'] = {'top_F2': len(top_px), 'left_F1': len(left_px)}

# ---------- 4) 2D 峰标记：绿晕连通域 + 红核 ----------
green = (Gc - R > 18) & (Gc - B > 18) & (np.arange(H)[:,None] > 386) & (np.arange(H)[:,None] < 758) & \
        (np.arange(W)[None,:] > 905) & (np.arange(W)[None,:] < 1424)
red   = (R > 90) & (R - Gc > 35) & (R - B > 35) & (np.arange(H)[:,None] > 386) & (np.arange(H)[:,None] < 758) & \
        (np.arange(W)[None,:] > 905) & (np.arange(W)[None,:] < 1424)
def comps(mask, minpx):
    from collections import deque
    vis = np.zeros_like(mask, bool); res = []
    ys_, xs_ = np.nonzero(mask)
    for y0, x0 in zip(ys_, xs_):
        if vis[y0, x0]: continue
        q = deque([(y0, x0)]); vis[y0, x0] = True; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    ny, nx = y+dy, x+dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True; q.append((ny, nx))
        if len(pts) >= minpx:
            p = np.array(pts)
            res.append({'n': len(pts), 'cx': float(p[:,1].mean()), 'cy': float(p[:,0].mean()),
                        'w': int(p[:,1].max()-p[:,1].min()+1), 'h': int(p[:,0].max()-p[:,0].min()+1)})
    return res
gb = comps(green, 40); rb = comps(red, 3)
for c in gb:
    c['F2'] = round(float(f2(c['cx'])), 3); c['F1'] = round(float(f1(c['cy'])), 3)
    c['kind'] = 'diagonal' if abs(c['F1']-c['F2']) < 0.06 else 'cross'
    c['red_cores_inside'] = sum(1 for r in rb if abs(r['cx']-c['cx']) <= c['w']/2+3 and abs(r['cy']-c['cy']) <= c['h']/2+3)
gb.sort(key=lambda c: (c['F1'], c['F2']))
out['marker_blobs'] = gb
out['n_marker_blobs'] = len(gb)

# ---------- 5) 成对交叉峰：互为镜像的交叉峰配对 ----------
cross = [c for c in gb if c['kind'] == 'cross']
pairs = []
used = set()
for i, a in enumerate(cross):
    if i in used: continue
    best, bj = None, None
    for j, b in enumerate(cross):
        if j <= i or j in used: continue
        d = abs(a['F1']-b['F2']) + abs(a['F2']-b['F1'])
        if best is None or d < best: best, bj = d, j
    if bj is not None and best < 0.06:
        b = cross[bj]; used.add(i); used.add(bj)
        pairs.append({'a': [a['F1'], a['F2']], 'b': [b['F1'], b['F2']], 'closure_err': round(best,3)})
out['cross_pairs'] = pairs
out['n_cross_pairs'] = len(pairs)

# ---------- 6) 结构骨架顶点 ----------
skel = (G < 150) & ~((B - R) > 25)
seg = np.zeros((H, W), bool); seg[185:290, 1005:1245] = True
sk = skel & seg
ys_, xs_ = np.nonzero(sk)
out['skeleton'] = {'bbox_px': [int(xs_.min()), int(xs_.max()), int(ys_.min()), int(ys_.max())],
                   'n_dark_px': int(len(xs_))}
# 顶点：在若干固定 y 上取暗段的中心（人工核对过，见 README）
out['vertices_px'] = [[1078,213],[1097,244],[1135,244],[1152,213],[1190,213]]
out['end_labels_px'] = {'H3C': [1019,1048,205,223], 'CH3': [1200,1230,183,192], 'O': [1074,1085,270,281]}

# ---------- 7) 色块取样 ----------
def px(x, y): return [int(v) for v in A[y, x]]
out['colors'] = {
  'background': px(600, 400), 'title_blue': px(200, 115), 'marker_red_a': px(1216,533),
  'marker_red_b': px(1275,533), 'marker_green_halo': px(1059,646), 'marker_olive': px(1053,650),
  'watermark_gray': px(1200,570), 'skeleton_dark': px(1152,213)}
# ---------- 8) 两次独立读数（上下投影 / 左右投影）取共识 ----------
sh_top = sorted(p['ppm'] for p in out['proj_top_F2'])
sh_left = sorted(p['ppm'] for p in out['proj_left_F1'])
assert len(sh_top) == len(sh_left) == 6, (sh_top, sh_left)
consensus = [round((a+b)/2, 3) for a, b in zip(sh_top, sh_left)]
out['shift_consensus_ppm'] = consensus
out['shift_two_readings_max_dev_ppm'] = round(max(abs(a-b) for a, b in zip(sh_top, sh_left)), 3)
# 交叉峰对用共识位移重新表述
def near(v): return min(range(6), key=lambda i: abs(consensus[i]-v))
out['edges_by_consensus'] = sorted({tuple(sorted((near(p['a'][0]), near(p['a'][1])))) for p in out['cross_pairs']})
out['n_edges'] = len(out['edges_by_consensus'])

# ---------- 9) 证据图：把标定网格、峰位、编号画在原图上 ----------
from PIL import ImageDraw
ov = im.copy(); d = ImageDraw.Draw(ov)
def X(p): return ix + sx*p
def Y(p): return iy + sy*p
for p in [0,0.5,1.0,1.5,2.0,2.5,3.0]:
    d.line([(X(p), top_y), (X(p), bot_y)], fill=(0,150,255), width=1)
    d.line([(lef_x, Y(p)), (rig_x, Y(p))], fill=(0,150,255), width=1)
    d.text((X(p)+2, top_y+2), '%g'%p, fill=(0,90,210))
    d.text((lef_x+3, Y(p)+2), '%g'%p, fill=(0,90,210))
for i, c in enumerate(out['marker_blobs']):
    x, y = X(c['F2']), Y(c['F1'])
    d.ellipse([x-11, y-11, x+11, y+11], outline=(200,0,200), width=1)
for p in consensus:
    x, y = X(p), Y(p)
    d.ellipse([x-3, y-3, x+3, y+3], fill=(255,0,0))
ov.save('_probe/evidence_overlay_full.png')
ov.resize((1200, int(1200*H/W)), Image.LANCZOS).save('原图-像素核对.webp', quality=90, method=6)

json.dump(out, open('_measure.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({k: out[k] for k in ('frame_px','calibration','n_marker_blobs','n_cross_pairs')}, ensure_ascii=False, indent=1))
print('proj_top_F2 ppm:', [p['ppm'] for p in out['proj_top_F2']])
print('proj_left_F1 ppm:', [p['ppm'] for p in out['proj_left_F1']])
print('cross pairs:', json.dumps(out['cross_pairs'], ensure_ascii=False))
print('共识位移 ppm:', out['shift_consensus_ppm'], ' 两次读数最大偏差:', out['shift_two_readings_max_dev_ppm'])
print('耦合边(按下标):', out['edges_by_consensus'], ' 边数:', out['n_edges'])
print('marker blobs:')
for c in out['marker_blobs']:
    print('   F1=%.3f F2=%.3f %s w=%d h=%d cores=%d' % (c['F1'], c['F2'], c['kind'], c['w'], c['h'], c['red_cores_inside']))
