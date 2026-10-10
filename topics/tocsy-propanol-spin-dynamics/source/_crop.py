# -*- coding: utf-8 -*-
"""裁掉整页截图底部的空白，输出 preview.png"""
import numpy as np, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.array(im)
bg = np.array([14, 17, 22])                     # --bg #0e1116
diff = np.abs(a.astype(int) - bg).sum(axis=2)
rows = np.nonzero((diff > 12).any(axis=1))[0]
cols = np.nonzero((diff > 12).any(axis=0))[0]
if len(rows) == 0:
    print('全空白?'); sys.exit(1)
y1 = min(a.shape[0], rows[-1] + 24)
x0 = max(0, cols[0] - 8); x1 = min(a.shape[1], cols[-1] + 9)
out = im.crop((x0, 0, x1, y1))
out.save(dst)
print('%s  %dx%d -> %s  %dx%d' % (src, a.shape[1], a.shape[0], dst, out.width, out.height))
