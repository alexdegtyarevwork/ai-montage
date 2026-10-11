// Иконка набора (или любой SVG-контур 24×24) → Lottie JSON: дорисовка контура (trim path) + выпрыгивание с перелётом.
// Тот же JSON играют lottie-android, lottie-ios, lottie-web и @remotion/lottie.
//   node .claude/skills/motion-design/tools/svg2lottie.mjs <имя из ICONS | "M…путь"> <out.json>
//        [--color #200B44] [--stroke 1.8] [--size 512] [--draw 14] [--pop 10] [--fps 30] [--hold 30] [--fill #RRGGBB]
// Кривые: дорисовка expo-out (.16,1,.3,1), выпрыгивание cubic-bezier(.34,1.56,.64,1) — как в src/kit/md.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePath, reduceInstructions} from '@remotion/paths';

const [src, out, ...rest] = process.argv.slice(2);
if (!src || !out) { console.error('укажи иконку и файл результата'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const here = path.dirname(fileURLToPath(import.meta.url));
const signs = readFileSync(path.resolve(here, '../../../../src/kit/md/signs.tsx'), 'utf8');
const icons = Object.fromEntries([...signs.matchAll(/^\s+([a-z]+): '([^']+)',$/gm)].map((m) => [m[1], m[2]]));
const d = /^[Mm]/.test(src) ? src : icons[src];
if (!d) { console.error(`нет иконки «${src}». Есть: ${Object.keys(icons).join(', ')}`); process.exit(2); }

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const color = hex(opt('color', '#200B44'));
const fill = opt('fill', null);
const stroke = Number(opt('stroke', 1.8));
const size = Number(opt('size', 512));
const fps = Number(opt('fps', 30));
const draw = Number(opt('draw', 14));
const pop = Number(opt('pop', 10));
const hold = Number(opt('hold', 30));
const op = Math.max(draw, pop) + hold;

// Контур → вершины Lottie: v — точки, i/o — ручки относительно точки, c — замкнут ли.
const subpaths = [];
let cur = null;
for (const ins of reduceInstructions(parsePath(d))) {
  if (ins.type === 'M') { cur = {v: [[ins.x, ins.y]], i: [[0, 0]], o: [[0, 0]], c: false}; subpaths.push(cur); continue; }
  const last = cur.v[cur.v.length - 1];
  if (ins.type === 'L') { cur.v.push([ins.x, ins.y]); cur.i.push([0, 0]); cur.o.push([0, 0]); }
  else if (ins.type === 'C' || ins.type === 'Q') {
    const [c1x, c1y, c2x, c2y] = ins.type === 'C' ? [ins.cp1x, ins.cp1y, ins.cp2x, ins.cp2y]
      : [last[0] + (2 / 3) * (ins.cpx - last[0]), last[1] + (2 / 3) * (ins.cpy - last[1]), ins.x + (2 / 3) * (ins.cpx - ins.x), ins.y + (2 / 3) * (ins.cpy - ins.y)];
    cur.o[cur.o.length - 1] = [c1x - last[0], c1y - last[1]];
    cur.v.push([ins.x, ins.y]); cur.i.push([c2x - ins.x, c2y - ins.y]); cur.o.push([0, 0]);
  } else if (ins.type === 'Z') {
    cur.c = true;
    const f = cur.v[0]; const l = cur.v[cur.v.length - 1];
    if (cur.v.length > 1 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) { cur.i[0] = cur.i.pop(); cur.v.pop(); cur.o.pop(); }
  }
}
const r = (n) => Math.round(n * 1000) / 1000;
const shapes = subpaths.map((s, k) => ({ty: 'sh', nm: `path ${k + 1}`, ks: {a: 0, k: {v: s.v.map((p) => p.map(r)), i: s.i.map((p) => p.map(r)), o: s.o.map((p) => p.map(r)), c: s.c}}}));
const outE = {x: [0.16], y: [1]}; const inE = {x: [0.3], y: [1]};
const items = [
  ...shapes,
  ...(fill ? [{ty: 'fl', nm: 'fill', c: {a: 0, k: hex(fill)}, o: {a: 0, k: 100}, r: 1}] : []),
  {ty: 'tm', nm: 'draw', s: {a: 0, k: 0}, o: {a: 0, k: 0}, m: 1,
    e: {a: 1, k: [{t: 0, s: [0], o: outE, i: inE}, {t: draw, s: [100]}]}},
  {ty: 'st', nm: 'stroke', c: {a: 0, k: color}, o: {a: 0, k: 100}, w: {a: 0, k: stroke}, lc: 2, lj: 2, ml: 4},
  {ty: 'tr', p: {a: 0, k: [0, 0]}, a: {a: 0, k: [0, 0]}, s: {a: 0, k: [100, 100]}, r: {a: 0, k: 0}, o: {a: 0, k: 100}},
];
const k = size / 24;
const json = {
  v: '5.7.4', fr: fps, ip: 0, op, w: size, h: size, nm: `icon-${/^[Mm]/.test(src) ? 'path' : src}`, ddd: 0, assets: [],
  layers: [{
    ddd: 0, ind: 1, ty: 4, nm: 'icon', sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
    ks: {
      o: {a: 0, k: 100}, r: {a: 1, k: [{t: 0, s: [-10], o: {x: [0.34], y: [1.56]}, i: {x: [0.64], y: [1]}}, {t: pop, s: [0]}]},
      p: {a: 0, k: [size / 2, size / 2, 0]}, a: {a: 0, k: [12, 12, 0]},
      s: {a: 1, k: [{t: 0, s: [0, 0, 100], o: {x: [0.34], y: [1.56]}, i: {x: [0.64], y: [1]}}, {t: pop, s: [k * 100, k * 100, 100]}]},
    },
    shapes: [{ty: 'gr', nm: 'icon', it: items}],
  }],
};
writeFileSync(out, JSON.stringify(json));
console.log(`готово: ${out} (${subpaths.length} контуров, ${op} кадров при ${fps} fps, ${size}×${size})`);
