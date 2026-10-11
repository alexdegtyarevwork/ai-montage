// Пословная расшифровка: node scripts/transcribe.mjs <запись.mp4|wav> <out.json> [--model medium] [--lang ru]
// Звук делится на куски речи по паузам; куски склеиваются в окна до 24 с с паузой 0,5 с между ними и расшифровываются
// по окну за раз, затем время слов переносится обратно на исходную запись. Так время точное даже после долгих пауз
// (по целому файлу whisper ставит слова не туда), а работа в разы быстрее, чем по одному куску.
// Выход — [{text, start, end}] в секундах, по слову. Первый запуск сам ставит whisper.cpp и модель (если не было npm run setup).
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {linkProject} from './link-project.mjs';
import {chunksOf, cutWav, ensureWhisper, envelope, fixWord, loadDict, r3, segments, threshold, wordsOf} from './asr.mjs';
import {WHISPER_MODEL} from './whisper-config.mjs';

const [src, out, ...rest] = process.argv.slice(2);
if (!src || !out) { console.error('укажи запись и файл результата'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const model = opt('model', WHISPER_MODEL), lang = opt('lang', 'ru');
const PAD = 0.15, GAP = 0.5, WINDOW = 24;
// словарь написания: ПРАВИЛА/2 Субтитры.md + work/<slug>/hint.txt (slug — папка файла результата)
const dict = loadDict(path.basename(path.dirname(path.resolve(out))));
await ensureWhisper(model);
// Временные файлы — в папке проекта, а не в системной TEMP: русские буквы в имени пользователя Windows ломают whisper.
mkdirSync('tmp', {recursive: true});
const tmp = mkdtempSync(path.resolve('tmp', 'asr-'));
const db = envelope(src);
const chunks = chunksOf(segments(db, threshold(db))).filter((c) => c.end - c.start >= 0.2);
// окна: подряд идущие куски, пока звук окна не длиннее WINDOW секунд
const groups = [];
for (const c of chunks) {
  const len = c.end - c.start + 2 * PAD, g = groups[groups.length - 1];
  if (g && g.len + GAP + len <= WINDOW) { g.items.push(c); g.len += GAP + len; } else groups.push({items: [c], len});
}
const silence = path.join(tmp, 'gap.wav');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', String(GAP), '-c:a', 'pcm_s16le', silence]);
const words = [];
for (const [gi, g] of groups.entries()) {
  const parts = [], map = [];
  let pos = 0;
  for (const [ci, c] of g.items.entries()) {
    const from = Math.max(0, c.start - PAD), len = c.end + PAD - from, wav = path.join(tmp, `g${gi}c${ci}.wav`);
    cutWav(src, from, len, wav);
    if (ci) { parts.push(silence); pos += GAP; }
    parts.push(wav);
    map.push({pos, len, from});
    pos += len;
  }
  const list = path.join(tmp, `g${gi}.txt`), wav = path.join(tmp, `g${gi}.wav`);
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', wav], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error('окно звука не склеилось: ' + r.stderr.slice(-300));
  // время в окне → время в исходной записи: кусок определяется по началу слова (паузу — к ближайшему),
  // конец слова считается в том же куске и не выходит за его край — иначе слово «растягивается» на паузу
  const pieceOf = (t) => { let m = map[0]; for (const x of map) if (t >= x.pos - GAP / 2) m = x; return m; };
  const inPiece = (m, t) => m.from + Math.min(Math.max(0, t - m.pos), m.len);
  for (const w of await wordsOf(wav, 0, {model, lang})) {
    const m = pieceOf(w.start);
    words.push({text: w.text, start: inPiece(m, w.start), end: inPiece(m, Math.max(w.end, w.start))});
  }
}
rmSync(tmp, {recursive: true, force: true});
words.sort((a, b) => a.start - b.start);
let prevEnd = 0;
const clean = words.map((w) => {
  const start = Math.max(w.start, prevEnd), end = Math.max(w.end, start + 0.05);
  prevEnd = end;
  return {text: fixWord(w.text, dict), start: r3(start), end: r3(end)};
});
mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
writeFileSync(out, JSON.stringify(clean, null, 1));
console.log(`готово: ${clean.length} слов, кусков речи ${chunks.length}, окон ${groups.length} → ${out}`);
// расшифровка ролика (work/<slug>/words.json) — код ролика сразу переключается на настоящие слова
const rel = path.relative(path.resolve('work'), path.resolve(out)).split(path.sep);
if (rel.length === 2 && rel[1] === 'words.json') linkProject(rel[0]);
