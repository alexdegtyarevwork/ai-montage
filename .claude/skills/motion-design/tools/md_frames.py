# Покадровые метрики: яркость, насыщенность, разница с прошлым кадром, оптический поток (движение, сдвиг, наезд),
# кандидаты склеек. Вход: <папка>/f30/*.jpg (все кадры). Выход: <папка>/frames.json.
#   python -I md_frames.py <папка разбора>
import sys, os, json, glob
import numpy as np, cv2
FPS = float(os.environ.get('FPS', '30'))  # частота кадров исходника
d = sys.argv[1]  # dir with f30
files = sorted(glob.glob(os.path.join(d, 'f30', '*.jpg')))
prev = None; prevh = None; out = []
for i, f in enumerate(files):
    img = cv2.imread(f)
    h, w = img.shape[:2]
    s = 320 / w
    sm = cv2.resize(img, (320, int(h * s)))
    g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
    lum = float(g.mean()); sat = float(hsv[..., 1].mean())
    hist = cv2.calcHist([hsv], [0, 1], None, [18, 8], [0, 180, 0, 256]); cv2.normalize(hist, hist)
    rec = {'f': i, 't': round(i / FPS, 3), 'lum': round(lum, 1), 'sat': round(sat, 1)}
    if prev is not None:
        rec['diff'] = round(float(np.abs(g.astype(int) - prev.astype(int)).mean()), 2)
        rec['hcorr'] = round(float(cv2.compareHist(prevh, hist, cv2.HISTCMP_CORREL)), 3)
        flow = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag = np.linalg.norm(flow, axis=2)
        rec['mot'] = round(float(mag.mean()), 3)
        rec['dx'] = round(float(flow[..., 0].mean()), 3); rec['dy'] = round(float(flow[..., 1].mean()), 3)
        # divergence -> zoom: radial component
        yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
        cx, cy = g.shape[1] / 2, g.shape[0] / 2
        rx, ry = xx - cx, yy - cy; rn = np.sqrt(rx**2 + ry**2) + 1e-6
        rec['zoom'] = round(float(((flow[..., 0] * rx + flow[..., 1] * ry) / rn).mean()), 3)
    # active area: fraction of pixels differing from frame median (content occupancy)
    rec['edge'] = round(float((cv2.Canny(g, 60, 150) > 0).mean() * 100), 2)
    out.append(rec); prev = g; prevh = hist
json.dump(out, open(os.path.join(d, 'frames.json'), 'w'))
# cut candidates
cuts = [r for r in out[1:] if r['hcorr'] < 0.6 or r['diff'] > 25]
print(d, 'frames', len(out))
for r in cuts: print('  cut?', r['f'], r['t'], 'diff', r['diff'], 'hcorr', r['hcorr'])
