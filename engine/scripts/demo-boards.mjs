// Картинки стилей и образцов на записи владельца набора (public/demo): node scripts/demo-boards.mjs [styles] [formats] [patterns]
// Все кадры рендерятся с входным параметром {demoRec: true}: стили движка идут по ролику владельца (src/template/ownerDemo.ts),
// новые образцы — с его записью вместо заглушки. Без аргументов делает всё.
//   styles   → public/style-previews/styles.jpg   доска всех стилей 1–21 по порядку (ПРАВИЛА/6 Стили.md), кадры выбрал владелец 11.10.2026
//   formats  → public/style-previews/formats.jpg  раскладки кадра (плитки 2 и 5 — готовые картинки tiles/format-2.jpg и format-5.jpg)
//   patterns → patterns/reels/<образец>/frames.jpg  6 кадров ролика в том же стиле (только образцы из списка PATTERNS)
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

const want = process.argv.slice(2);
const doIt = (k) => !want.length || want.includes(k);
// [подпись, композиция, момент]: момент — секунда или {n}: кадр n из 10 на выбор (4–97 % длины, как на листах выбора);
// композиция null — готовая плитка public/style-previews/tiles/<файл> (кадр готового ролика владельца: у стиля нет композиции).
const MD = 'src/entries/md-styles.tsx';
const STYLES = [
  ['1 КАНВАС', 'Template-Reels', {n: 10}], ['2 СТЕКЛО', 'LIQUID-Reels', {n: 1}], ['3 ПОСТЕР', null, '03.jpg'], ['4 СЦЕНЫ', null, '04.jpg'],
  ['5 PRISM', 'PRISM-Reels', {n: 1}], ['6 ORBIT', 'ORBIT-Reels', {n: 1}], ['7 TRACE', 'TRACE-Reels', {n: 2}], ['8 PULSE', 'PULSE-Reels', {n: 3}],
  ['9 ЭКСП. СТЕКЛО', 'GLASS-Reels', {n: 4}], ['10 ПОРТРЕТ', 'PORTRAIT-Reels', {n: 7}], ['11 APPLE DEPTH', 'APPLE-Reels', {n: 5}], ['12 ПОДКАСТ', 'PODCAST-Reels', {n: 4}],
  ['13 ЭКСПЕРТ', 'EXPERT-Reels', {n: 1}], ['14 ЛИНЗА', 'Lens-Artemis', {n: 1}], ['15 ЛИСТ', null, '15.jpg'], ['16 ПЛЁНКА', 'MD-Plenka', {n: 2}, MD],
  ['17 СЛОВА', 'MD-Slova', {n: 8}, MD], ['18 ТОЧКА', 'MD-Tochka', {n: 2}, MD], ['19 СИМБИОЗ', 'Symbiosis-Swap', {n: 1}], ['20 ЭСТАФЕТА', 'Relay-GhTricks', {n: 9}],
  ['21 ИСТОРИЯ С ГЕРОЕМ', null, '21.jpg'],
];
const FORMATS = [
  ['1 Половина экрана', 'Expert2-Money', 20], ['2 Половина + окно в углу', null, 'format-2.jpg'], ['3 Карточка спикера', 'Lens-GhTricks', 12],
  ['4 Спикер внизу, графика сверху', 'PRISM-Reels', 11.0], ['5 Без лица, на весь кадр', null, 'format-5.jpg'], ['6 Подкаст', 'PODCAST-Reels', 5.0],
];
// образец → композиция того же стиля; 6 кадров равными долями его длины (у стилей движка — длина ролика владельца)
const PATTERNS = {
  'r02-effort-expert': 'EXPERT-Reels', 'r11-claude-sales-glass': 'PORTRAIT-Reels', 'r13-google-orbit': 'ORBIT-Reels', 'r16-deepseek-orbit': 'ORBIT-Reels',
  'r14-codebase-prism': 'PRISM-Reels', 'r27-connectors-half': 'PRISM-Reels', 'r15-otdel-trace': 'TRACE-Reels', 'pulse-narrator': 'PULSE-Reels',
  'liquid-glass-expert': 'GLASS-Reels', 'podcast-split': 'PODCAST-Reels', 'apple-depth': 'APPLE-Reels', 'r22-live-canvas': 'Template-Reels',
  'expert2-money': 'Expert2-Money', 'expert2-unlazy': 'Expert2-Unlazy', 'lens-artemis': 'Lens-Artemis', 'lens-ghtricks': 'Lens-GhTricks',
  'lens-laya': 'Lens-Laya', 'relay-ghtricks': 'Relay-GhTricks', 'symbiosis-swap': 'Symbiosis-Swap', 'r21-liquid-glass': 'LIQUID-Reels',
};

const font = 'public/fonts/Manrope-Variable.ttf'; // относительный путь: на Windows ffmpeg не открывает абсолютный в drawtext
const tmp = path.join('out', 'boards');
mkdirSync(tmp, {recursive: true});
const inputProps = {demoRec: true};
const jobs = []; // [точка входа, композиция, момент, файл]
const shot = (id, at, entry = 'src/index.ts') => {
  const f = path.join(tmp, `${id}_${typeof at === 'number' ? at : `n${at.n}`}.png`);
  jobs.push([entry, id, at, f]);
  return f;
};

const plan = {styles: [], formats: [], patterns: []};
if (doIt('styles')) plan.styles = STYLES.map(([label, id, at, entry]) => [label, id ? shot(id, at, entry) : path.join('public', 'style-previews', 'tiles', at)]);
if (doIt('formats')) plan.formats = FORMATS.map(([label, id, sec]) => [label, id ? shot(id, sec) : path.join('public', 'style-previews', 'tiles', sec)]);
// готовые плитки проверяются до долгого рендера
for (const [, f] of [...plan.styles, ...plan.formats]) if (!f.startsWith(tmp) && !existsSync(f)) { console.error(`нет готовой плитки ${f}`); process.exit(1); }
const SHARES = [0.06, 0.24, 0.42, 0.6, 0.78, 0.94];
if (doIt('patterns')) for (const [dir, id] of Object.entries(PATTERNS)) {
  const ats = SHARES.map((share) => ({n: `s${share}`, share}));
  plan.patterns.push([dir, id, ats, ats.map((at) => shot(id, at))]);
}

// 3D-образцы рисуют WebGL: без gl: 'angle' безголовый браузер не создаёт контекст
const chromiumOptions = {gl: 'angle'};
for (const entry of [...new Set(jobs.map((j) => j[0]))]) {
  await withBundle(entry, async (serveUrl) => {
    const browser = await openBrowser('chrome', {chromiumOptions});
    try {
      const comps = new Map();
      const comp = async (id) => comps.get(id) ?? comps.set(id, await selectComposition({serveUrl, id, puppeteerInstance: browser, inputProps})).get(id);
      const done = new Set();
      for (const [e, id, at, f] of jobs) {
        if (e !== entry) continue;
        const c = await comp(id);
        const len = c.durationInFrames / c.fps;
        const sec = typeof at === 'number' ? at : at.share !== undefined ? len * at.share : len * (0.04 + (0.93 * (at.n - 1)) / 9);
        if (typeof at !== 'number') at.sec = Math.round(sec * 10) / 10;
        if (done.has(f)) continue;
        done.add(f);
        const frame = Math.min(c.durationInFrames - 1, Math.round(sec * c.fps));
        await renderStill({serveUrl, composition: c, frame, scale: 360 / c.width, puppeteerInstance: browser, inputProps, chromiumOptions, output: f});
        console.log(`кадр: ${id} ${sec.toFixed(1)} с`);
      }
    } finally {
      await browser.close({silent: true});
    }
  });
}

// доска: плитки 360×640 с подписью сверху
const board = (tiles, out, cols, h = 60, size = 26) => {
  const args = [], parts = [];
  tiles.forEach(([label, f], i) => {
    args.push('-i', f);
    const safe = String(label).replace(/:/g, '\\:').replace(/'/g, '');
    parts.push(`[${i}:v]scale=360:640,pad=360:${640 + h}:0:${h}:color=0x111316,drawtext=fontfile='${font}':text='${safe}':fontcolor=white:fontsize=${size}:x=12:y=${Math.round((h - size) / 2)}[c${i}]`);
  });
  const term = (n, v) => (n === 0 ? '0' : Array(n).fill(v).join('+'));
  const lay = tiles.map((_, i) => `${term(i % cols, 'w0')}_${term(Math.floor(i / cols), 'h0')}`).join('|');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex',
    `${parts.join(';')};${tiles.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${tiles.length}:layout=${lay}:fill=0x111316[o]`, '-map', '[o]', '-q:v', '3', out]);
  console.log(`готово: ${out}`);
};
if (plan.styles.length) {
  board(plan.styles, 'public/style-previews/styles.jpg', 7);
  // каждый стиль отдельной картинкой (команда /info показывает их ученику): public/style-previews/styles/01.jpg … 21.jpg
  mkdirSync('public/style-previews/styles', {recursive: true});
  plan.styles.forEach((_, i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 'public/style-previews/styles.jpg', '-vf',
    `crop=360:700:${(i % 7) * 360}:${Math.floor(i / 7) * 700}`, '-q:v', '3', `public/style-previews/styles/${String(i + 1).padStart(2, '0')}.jpg`]));
}
if (plan.formats.length) {
  board(plan.formats, 'public/style-previews/formats.jpg', 6, 60, 22);
}
for (const [dir, , secs, files] of plan.patterns) {
  const out = path.join('patterns', 'reels', dir, 'frames.jpg');
  if (!existsSync(path.dirname(out))) continue;
  board(secs.map((s, i) => [`${String(s.sec).replace('.', ',')} с`, files[i]]), out, 6, 40, 24);
}
