// Общее для распознавания речи: огибающая громкости, куски речи по паузам, расшифровка куска по словам.
// Метод «Нарезки» (ПРАВИЛА/3): окна 10 мс, порог речи −42 dB (в шумной комнате шум + 6 dB), куски по паузам ≥ 0,35 с.
// Каждый кусок расшифровывается отдельно: время слов по целому файлу врёт после длинных пауз.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {downloadWhisperModel, installWhisperCpp, transcribe} from '@remotion/install-whisper-cpp';
import {MODEL_BYTES, WHISPER_DIR, WHISPER_EXE, WHISPER_MODEL, WHISPER_VERSION, WHISPER_WIN_ARM64_URL} from './whisper-config.mjs';

// chunkPause — паузы между кусками для расшифровки; takePause — мельче, для таблицы дублей: перезапуск фразы часто сидит
// на паузе 0,2–0,35 с. keepPause — сколько тишины оставить после куска с отметкой «+» (смысловая пауза).
export const C = {threshold: -42, noiseGap: 6, thresholdMax: -18, chunkPause: 0.35, takePause: 0.2, keepPause: 0.4, padBefore: 0.06, padAfter: 0.08,
  innerGap: 0.16, mergeGap: 0.10, fadeIn: 0.008, fadeOut: 0.012, minSpeech: 0.04};
const WIN = 0.01, SR = 16000;
export const r3 = (x) => Math.round(x * 1000) / 1000;
export const HALLU = [/редактор субтитров/i, /корректор\s/i, /продолжение следует/i, /субтитры (сделал|создавал|подготовил|делал)/i,
  /спасибо за (субтитры|просмотр)/i, /подписывайтесь на канал/i, /amara\.org/i, /dimatorzok/i];
const NOISE = /^[*([].*[*)\]]$/; // *смех*, [музыка], (аплодисменты) — не речь

export function envelope(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {maxBuffer: 1024 * 1024 * 1024});
  if (r.status !== 0) throw new Error('звук не читается: ' + String(r.stderr).slice(-300));
  const s = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  const n = SR * WIN, db = new Float32Array(Math.floor(s.length / n));
  for (let w = 0; w < db.length; w++) {
    let sum = 0;
    for (let i = w * n; i < (w + 1) * n; i++) sum += s[i] * s[i];
    const rms = Math.sqrt(sum / n) / 32768;
    db[w] = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
  }
  return db;
}
export function threshold(db) {
  const a = Float32Array.from(db).sort();
  const noise = a[Math.floor(0.1 * a.length)] ?? -100;
  return Math.round(Math.min(C.thresholdMax, Math.max(C.threshold, noise + C.noiseGap)));
}
export function segments(db, thr) {
  const raw = [];
  let st = -1;
  for (let i = 0; i <= db.length; i++) {
    const on = i < db.length && db[i] > thr;
    if (on && st < 0) st = i;
    if (!on && st >= 0) { raw.push({start: st * WIN, end: i * WIN}); st = -1; }
  }
  const merged = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < C.mergeGap) last.end = s.end; else merged.push({...s});
  }
  return merged.filter((s) => s.end - s.start >= C.minSpeech);
}
export function chunksOf(segs, gap = C.chunkPause) {
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && s.start - last.end < gap) { last.end = s.end; last.segs.push(s); } else out.push({start: s.start, end: s.end, segs: [s]});
  }
  return out;
}
// Повтор шага до 4 раз с паузой 5, 10, 20 с: обрыв связи на закачке не должен останавливать установку.
export async function retry(label, fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw new Error(`${label}: не получилось за ${tries} попытки — ${e.message}. Проверь интернет или VPN и запусти снова`);
      const wait = 5 * 2 ** (i - 1);
      console.log(`${label}: ${e.message} — пробую ещё раз через ${wait} с (попытка ${i + 1} из ${tries})`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}
// Windows: официальная сборка whisper.cpp (zip с GitHub) → .whisper/build/bin/, распаковка встроенным tar.exe.
async function installWindowsWhisper() {
  if (existsSync(WHISPER_EXE)) return;
  // Windows на ARM (Snapdragon, Parallels на Mac): своя сборка, иначе x64-версия идёт через эмуляцию в десятки раз медленнее.
  const reg = spawnSync('reg', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'PROCESSOR_ARCHITECTURE'], {encoding: 'utf8'});
  const arm = /ARM64/i.test(reg.stdout || '');
  const url = arm ? WHISPER_WIN_ARM64_URL : `https://github.com/ggml-org/whisper.cpp/releases/download/v${WHISPER_VERSION}/whisper-bin-x64.zip`;
  mkdirSync('tmp', {recursive: true});
  const tmp = mkdtempSync(path.resolve('tmp', 'whisper-'));
  const zip = path.join(tmp, 'whisper.zip');
  // закачка и распаковка с повтором: на домашнем интернете и VPN соединение иногда обрывается на середине архива
  await retry('whisper.cpp', async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`whisper.cpp не скачался (${res.status}): ${url}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const x = spawnSync('tar', ['-xf', zip, '-C', tmp], {encoding: 'utf8'});
    if (x.status !== 0) throw new Error('архив whisper.cpp не распаковался (оборвалась закачка?): ' + (x.stderr || '').slice(-300));
  });
  // папка с программой внутри архива у разных сборок называется по-разному (Release, bin…): ищем whisper-cli.exe
  const find = (d) => {
    for (const e of readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isFile() && e.name.toLowerCase() === 'whisper-cli.exe') return d;
      if (e.isDirectory()) { const r = find(p); if (r) return r; }
    }
    return null;
  };
  const rel = find(tmp);
  if (!rel) throw new Error('в архиве whisper.cpp нет whisper-cli.exe');
  const bin = path.dirname(WHISPER_EXE);
  mkdirSync(bin, {recursive: true});
  for (const f of readdirSync(rel)) renameSync(path.join(rel, f), path.join(bin, f));
  rmSync(tmp, {recursive: true, force: true});
  if (!existsSync(WHISPER_EXE)) throw new Error('в архиве whisper.cpp нет whisper-cli.exe');
}
export async function ensureWhisper(model = WHISPER_MODEL) {
  if (process.platform === 'win32') await installWindowsWhisper();
  else await retry('whisper.cpp', async () => {
    // Недостроенная прошлая установка (нет программы, но есть папка): модель сохранить, остальное собрать заново
    const keep = existsSync(WHISPER_DIR) && !existsSync(WHISPER_EXE) ? readdirSync(WHISPER_DIR).filter((f) => f.endsWith('.bin')) : null;
    let stash = null;
    if (keep) {
      mkdirSync('tmp', {recursive: true});
      stash = mkdtempSync(path.resolve('tmp', 'whisper-keep-'));
      for (const f of keep) renameSync(path.join(WHISPER_DIR, f), path.join(stash, f));
      rmSync(WHISPER_DIR, {recursive: true, force: true});
    }
    try {
      await installWhisperCpp({to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false});
      if (!existsSync(WHISPER_EXE)) throw new Error('whisper.cpp не собрался');
    } finally {
      if (stash) { mkdirSync(WHISPER_DIR, {recursive: true}); for (const f of keep) renameSync(path.join(stash, f), path.join(WHISPER_DIR, f)); rmSync(stash, {recursive: true, force: true}); }
    }
  });
  // оборванная закачка модели проходит проверки «файл есть», но ломает расшифровку: удалить и скачать заново
  const file = path.join(WHISPER_DIR, `ggml-${model}.bin`);
  const whole = () => existsSync(file) && (!MODEL_BYTES[model] || statSync(file).size === MODEL_BYTES[model]);
  await retry('модель речи', async () => {
    if (existsSync(file) && !whole()) rmSync(file, {force: true});
    await downloadWhisperModel({model, folder: WHISPER_DIR, printOutput: false});
    if (!whole()) { rmSync(file, {force: true}); throw new Error(`модель речи скачалась не целиком (${file})`); }
  });
}
// Кусок звука в 16 кГц моно WAV (whisper.cpp принимает только такой).
export function cutWav(src, from, dur, out) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-t', String(dur), '-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error('кусок звука не вырезался: ' + r.stderr.slice(-300));
}
// Слова одного WAV: токен с пробелом в начале открывает новое слово; offset прибавляется ко времени.
// Словарь написания: «клод, клауд → Claude» из ПРАВИЛА/2 Субтитры.md и work/<slug>/hint.txt (строки того же вида;
// агент пишет туда имена и бренды из сценария). Применяется ПОСЛЕ распознавания. В само распознавание (--prompt whisper)
// подсказку не подаём: проверено 11.10.2026 — список имён заставляет whisper повторять их вместо речи («Киркоров, Киркоров…»).
export function loadDict(slug) {
  const lines = [];
  const dict = path.resolve('..', 'ПРАВИЛА', '2 Субтитры.md');
  if (existsSync(dict)) lines.push(...readFileSync(dict, 'utf8').split('\n'));
  const own = slug ? path.join('work', slug, 'hint.txt') : null;
  if (own && existsSync(own)) lines.push(...readFileSync(own, 'utf8').split('\n'));
  const map = new Map();
  for (const l of lines) {
    const m = l.match(/^\s*-?\s*([^→]+?)\s*→\s*(.+?)\s*$/);
    if (m) for (const from of m[1].split(',')) if (from.trim()) map.set(from.trim().toLowerCase().replace(/ё/g, 'е'), m[2]);
  }
  return map;
}
// Слово с пунктуацией по краям → то же слово из словаря (регистр и знаки сохраняются вокруг)
export function fixWord(text, map) {
  const m = String(text).match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}-]+)([^\p{L}\p{N}]*)$/u);
  if (!m) return text;
  const to = map.get(m[2].toLowerCase().replace(/ё/g, 'е'));
  return to ? m[1] + to + m[3] : text;
}
export async function wordsOf(wav, offset = 0, {model = WHISPER_MODEL, lang = 'ru'} = {}) {
  const {transcription} = await transcribe({inputPath: wav, whisperPath: WHISPER_DIR, whisperCppVersion: WHISPER_VERSION, model, language: lang,
    tokenLevelTimestamps: true, printOutput: false, splitOnWord: true});
  const words = [];
  for (const seg of transcription) {
    // галлюцинации whisper на тишине и шуме («Редактор субтитров …», «Продолжение следует») — целой фразой
    if (HALLU.some((re) => re.test(String(seg.text ?? '')))) continue;
    for (const tok of seg.tokens ?? []) {
      const text = tok.text;
      if (!text || /^\[_/.test(text) || /^\s*$/.test(text)) continue;
      const s = offset + tok.offsets.from / 1000, e = offset + tok.offsets.to / 1000;
      if (text.startsWith(' ') || !words.length) words.push({text: text.trim(), start: s, end: e});
      else { const w = words[words.length - 1]; w.text += text; w.end = e; }
    }
  }
  // пометки whisper о звуках (*смех*, [музыка], «*звук храпа*» из нескольких слов) — не речь
  const out = [];
  let inNote = false;
  for (const w of words) {
    if (!inNote && /^[*([]/.test(w.text) && !NOISE.test(w.text)) { inNote = true; continue; }
    if (inNote) { if (/[*)\]][.,!?]*$/.test(w.text)) inNote = false; continue; }
    if (w.text && !NOISE.test(w.text) && !HALLU.some((re) => re.test(w.text))) out.push(w);
  }
  return out;
}
