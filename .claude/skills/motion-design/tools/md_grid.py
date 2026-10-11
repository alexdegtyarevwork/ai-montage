# Сетка из отрендеренных кадров (out/stills/<id>-NNNN.png) с подписью кадра и секунды: md_grid.py '<маска>' <out.jpg> <столбцов> [fps]
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
files = sorted(glob.glob(sys.argv[1])); out = sys.argv[2]; cols = int(sys.argv[3]); fps = int(sys.argv[4]) if len(sys.argv) > 4 else 60
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * (w + 4), rows * (h + 4)), (90, 90, 90)); d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * (w + 4), (i // cols) * (h + 4); S.paste(im, (x, y))
    n = int(os.path.basename(f).split('-')[-1].split('.')[0]); lab = f'{n} ({n/fps:.2f}s)'
    d.rectangle([x, y, x + 9 * len(lab), y + 18], fill=(0, 0, 0)); d.text((x + 3, y + 2), lab, fill=(255, 255, 0), font=font)
S.save(out, quality=85); print(out, S.size)
