# Палитра кадра k-means (6 цветов с долями): md_palette.py <папка> <кадр,кадр,…> [crop x0,y0,x1,y1]
import sys, numpy as np, cv2
from sklearn.cluster import KMeans
d = sys.argv[1]; frames = [int(x) for x in sys.argv[2].split(',')]
crop = tuple(map(int, sys.argv[3].split(','))) if len(sys.argv) > 3 else None
for f in frames:
    img = cv2.imread(f'{d}/f30/{f+1:04d}.jpg')[..., ::-1]
    if crop: img = img[crop[1]:crop[3], crop[0]:crop[2]]
    px = img.reshape(-1, 3)[::7].astype(float)
    km = KMeans(6, n_init=3, random_state=0).fit(px)
    cnt = np.bincount(km.labels_); order = np.argsort(-cnt)
    s = ' '.join(f'#{int(c[0]):02X}{int(c[1]):02X}{int(c[2]):02X}:{100*cnt[i]/cnt.sum():.0f}%' for i, c in ((i, km.cluster_centers_[i]) for i in order))
    print(f'f{f:4d} {s}')
