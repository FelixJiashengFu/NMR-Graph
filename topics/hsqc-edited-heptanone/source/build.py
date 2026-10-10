"""Embed the original slide in the editable, dependency-free teaching page."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent
page = (root / 'template.html').read_text(encoding='utf-8')
image = base64.b64encode((root / 'original-slide.png').read_bytes()).decode('ascii')
page = page.replace('__ORIGINAL_IMAGE__', 'data:image/png;base64,' + image)
crop = base64.b64encode((root / 'spectra-crop.png').read_bytes()).decode('ascii')
page = page.replace('__SPECTRA_CROP__', 'data:image/png;base64,' + crop)
assert '__ORIGINAL_IMAGE__' not in page
assert '__SPECTRA_CROP__' not in page
target = root.parent / 'index.html'
target.write_text(page, encoding='utf-8')
print(f'{target} ({target.stat().st_size:,} bytes)')
