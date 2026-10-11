# Трекинг красного предмета (точки) по кадрам: центр, ширина/высота, площадь, эквивалентный радиус.
# Поменять порог цвета в строке m = … под свой предмет.  md_track.py <папка> <кадр от> <до>
import sys, numpy as np, cv2
d = sys.argv[1]; a, b = int(sys.argv[2]), int(sys.argv[3])
for f in range(a, b + 1):
    img = cv2.imread(f'{d}/f30/{f+1:04d}.jpg').astype(int)
    B, G, R = img[..., 0], img[..., 1], img[..., 2]
    m = (R > 170) & (G < 120) & (B < 90) & (R - G > 90)
    ys, xs = np.nonzero(m)
    if len(xs) < 3: print(f'f{f} none'); continue
    area = len(xs); w = xs.max() - xs.min() + 1; h = ys.max() - ys.min() + 1
    print(f'f{f:3d} t={f/30:.3f} cx={xs.mean():6.1f} cy={ys.mean():6.1f} w={w:4d} h={h:4d} area={area:7d} r_eq={np.sqrt(area/np.pi):6.1f}')
