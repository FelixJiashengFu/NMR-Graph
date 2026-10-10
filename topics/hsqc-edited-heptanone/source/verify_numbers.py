"""Independent chemistry/count and visual-coordinate checks for the lesson."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
# Approximate peak centers visually read from the supplied screenshot.
peaks = [(1, 1.06, 8.5, 3), (2, 2.43, 36.0, 2),
         (4, 2.40, 43.0, 2), (5, 1.56, 26.5, 2),
         (6, 1.32, 22.5, 2), (7, .91, 14.5, 3)]
ids = [p[0] for p in peaks]
assert len(peaks) == len(set(ids)) == 6
assert 3 not in ids
assert sum(p[3] for p in peaks) == 14
assert sum(p[3] == 3 for p in peaks) == 2
assert sum(p[3] == 2 for p in peaks) == 4
assert (2*7 + 2 - 14)//2 == 1
pair = [p for p in peaks if p[0] in (2, 4)]
assert round(abs(pair[0][1]-pair[1][1]), 2) == .03
assert abs(pair[0][2]-pair[1][2]) == 7
assert all(.5 <= p[1] <= 3 and 0 <= p[2] <= 50 for p in peaks)
assert all(abs(a[1]-b[1]) > 0 for i,a in enumerate(peaks) for b in peaks[i+1:])
result = {
    'status': 'passed',
    'counts': {'carbon': 7, 'hydrogen': 14, 'oxygen': 1,
               'protonated_carbons': 6, 'methyl_sites': 2,
               'methylene_sites': 4, 'carbonyl_carbons': 1, 'DBE': 1},
    'approximate_visual_pair': {'C2_C4_delta_H_ppm': .03,
                                'C2_C4_delta_C_ppm': 7},
    'precision_warning': 'All ppm values are visual estimates from the screenshot.'
}
(root/'numerical-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
