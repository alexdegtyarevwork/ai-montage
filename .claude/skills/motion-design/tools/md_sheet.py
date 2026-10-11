# sheet.py dir out_prefix start_f end_f step cols thumbW [crop x0,y0,x1,y1]
import sys, os
from PIL import Image, ImageDraw, ImageFont
FPS = float(os.environ.get('FPS', '30'))  # частота кадров исходника
d, pre, a, b, step, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), int(sys.argv[7])
crop = tuple(map(int, sys.argv[8].split(','))) if len(sys.argv) > 8 else None
per = int(sys.argv[9]) if len(sys.argv) > 9 else 30
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 13)
idx = list(range(a, b + 1, step))
pages = [idx[i:i + per] for i in range(0, len(idx), per)]
for pn, pg in enumerate(pages):
    ims = []
    for f in pg:
        p = os.path.join(d, 'f30', f'{f + 1:04d}.jpg')
        if not os.path.exists(p): continue
        im = Image.open(p)
        if crop: im = im.crop(crop)
        th = int(im.height * tw / im.width); im = im.resize((tw, th)); ims.append((f, im))
    th = ims[0][1].height
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * (tw + 4), rows * (th + 4)), (70, 70, 70))
    dr = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(ims):
        x, y = (i % cols) * (tw + 4), (i // cols) * (th + 4)
        S.paste(im, (x, y)); lab = f'{f/FPS:.2f}s f{f}'
        dr.rectangle([x, y, x + 8 * len(lab) + 4, y + 16], fill=(0, 0, 0)); dr.text((x + 2, y + 1), lab, fill=(255, 255, 0), font=font)
    S.save(f'{pre}_{pn + 1:02d}.jpg', quality=88)
    print(f'{pre}_{pn + 1:02d}.jpg', pg[0], pg[-1])
