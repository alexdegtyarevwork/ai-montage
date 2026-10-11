# Спектрограмма с отметками слов, энергией движения и разницей кадров по 7,5 с на строку.
#   md_spec.py <файл.wav> <out.png> <слова.json или -> <frames.json>
import sys, json, numpy as np, librosa
from PIL import Image, ImageDraw, ImageFont
p, out, words, fj = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
y, sr = librosa.load(p, sr=22050, mono=True)
dur = len(y) / sr
fr = json.load(open(fj)); w = json.load(open(words)) if words != '-' else []
S = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=110, n_mels=128, fmax=11000)
D = librosa.power_to_db(S, ref=np.max)
D = np.clip((D + 80) / 80, 0, 1)
pps = 200  # px per second
seg = 7.5
n = int(np.ceil(dur / seg))
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 11)
rowH = 256 + 70 + 70 + 24
W = int(seg * pps) + 40
canvas = Image.new('RGB', (W, rowH * n), (12, 12, 12))
dr = ImageDraw.Draw(canvas)
cols = (np.array([[0,0,0],[60,0,90],[180,30,80],[255,140,0],[255,255,180]]))
def cmap(v):
    x = v * (len(cols) - 1); i = np.clip(x.astype(int), 0, len(cols) - 2); f = (x - i)[..., None]
    return (cols[i] * (1 - f) + cols[i + 1] * f).astype(np.uint8)
ft = np.array([r['t'] for r in fr]); mot = np.array([r.get('mot', 0) for r in fr]); dif = np.array([r.get('diff', 0) for r in fr]); lum = np.array([r['lum'] for r in fr])
fpt = S.shape[1] / dur
for k in range(n):
    a = k * seg; b = min(dur, a + seg); y0 = k * rowH
    c0, c1 = int(a * fpt), int(b * fpt)
    rgb = cmap(D[::-1, c0:c1])
    im = Image.fromarray(rgb).resize((int((b - a) * pps), 256))
    canvas.paste(im, (40, y0 + 24))
    for tt in np.arange(np.ceil(a * 4) / 4, b, 0.25):
        x = 40 + int((tt - a) * pps)
        major = abs(tt - round(tt)) < 1e-6
        dr.line([(x, y0 + 20), (x, y0 + rowH - 4)], fill=(90, 90, 90) if major else (40, 40, 40))
        if major or abs(tt*2 - round(tt*2)) < 1e-6: dr.text((x + 2, y0 + 4), f'{tt:.1f}', fill=(200, 200, 200), font=font)
    for x_ in w:
        if a <= x_['start'] < b:
            x = 40 + int((x_['start'] - a) * pps)
            dr.line([(x, y0 + 24), (x, y0 + 60)], fill=(0, 255, 255)); dr.text((x + 2, y0 + 26), x_['text'], fill=(0, 255, 255), font=font)
    m = (ft >= a) & (ft < b)
    def plot(arr, top, h, color, mx):
        pts = [(40 + int((t - a) * pps), top + h - int(min(v, mx) / mx * h)) for t, v in zip(ft[m], arr[m])]
        if len(pts) > 1: dr.line(pts, fill=color, width=2)
    dr.text((2, y0 + 290), 'mot', fill=(255, 160, 0), font=font); plot(mot, y0 + 284, 66, (255, 160, 0), max(1, mot.max()))
    dr.text((2, y0 + 360), 'diff', fill=(255, 60, 60), font=font); plot(dif, y0 + 354, 66, (255, 60, 60), max(1, np.percentile(dif, 99)))
    plot(lum, y0 + 354, 66, (160, 160, 160), 255)
canvas.save(out)
