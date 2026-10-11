# Каденция движения: сколько кадров в секунду «держатся» (повтор предыдущего). ≈ fps/2 — анимация на двойках.
#   python -I md_twos.py <папка разбора>   (нужен frames.json от md_frames.py)
import json, sys
fr = json.load(open(f'{sys.argv[1]}/frames.json'))
d = [r.get('diff', 0) for r in fr]
out = []
for s in range(0, len(d) - 30, 30):
    w = d[s:s + 30]
    mov = [x for x in w if x > 0.8]
    held = sum(1 for i in range(s + 1, s + 29) if d[i] < 0.35 * max(d[i - 1], d[i + 1]) and max(d[i - 1], d[i + 1]) > 1.0)
    out.append(f'{s // 30:02d}s:{held:2d}/{len(mov):2d}')
print('повторённых кадров / кадров с движением по секундам:')
print(' '.join(out))
