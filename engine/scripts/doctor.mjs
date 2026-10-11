// Проверка рабочего места: npm run doctor. Всё должно быть OK до начала монтажа.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, statSync, statfsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {MODEL_BYTES, MODEL_FILE, WHISPER_EXE, WHISPER_MODEL, WHISPER_VERSION} from './whisper-config.mjs';

const checks = [];
// ok: без этого монтаж не начать (FAIL). advice: нужно дополнительным скриптам (замер референса), монтаж идёт и без этого (WARN)
const ok = (cond, label, fix = '') => checks.push({cond, label, fix});
const advice = (cond, label, fix = '') => checks.push({cond, label, fix, soft: true});
const has = (cmd, args = ['-version']) => { try { execFileSync(cmd, args, {stdio: 'ignore'}); return true; } catch { return false; } };
const win = process.platform === 'win32';
const reinstall = win ? 'запусти установщик: install\\install-windows.ps1' : 'запусти установщик: bash install/install-mac.sh';

// Версия Python как [major, minor] или null. На Windows настоящий Python зовётся python или py, на macOS и Linux python3.
// Заглушка Microsoft Store версии не печатает, поэтому она считается отсутствием Python.
const pythonVersion = () => {
  const variants = process.platform === 'win32'
    ? [['python', ['--version']], ['py', ['-3', '--version']]]
    : [['python3', ['--version']], ['python', ['--version']]];
  for (const [cmd, args] of variants) {
    try {
      const out = execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
      const m = /Python (\d+)\.(\d+)/.exec(out);
      if (m) return [Number(m[1]), Number(m[2])];
    } catch { /* пробуем следующий вариант */ }
  }
  return null;
};

// Git Bash на Windows ищем по обычным местам установки: bash из System32 это заглушка WSL, она не годится
const gitBashFound = () => {
  if (process.platform !== 'win32') return has('bash', ['--version']);
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs`].filter(Boolean);
  return roots.some((root) => existsSync(`${root}\\Git\\bin\\bash.exe`));
};

const major = Number(process.versions.node.split('.')[0]);
ok(major >= 20, `Node.js ${process.versions.node} (нужен 20+)`, reinstall);
if (win && os.arch() !== 'x64') ok(false, `Node.js для ${os.arch()}`, 'на Windows нужен Node.js x64 (Remotion работает только с ним): переустанови установщиком');
ok(existsSync('node_modules/remotion'), 'движок Remotion установлен', reinstall);
// после «Обнови набор» список зависимостей мог смениться: установщик помнит, по какому package-lock ставил (метка в node_modules)
const lockMark = 'node_modules/.ai-montage-lock';
if (existsSync(lockMark) && existsSync('package-lock.json')) {
  const sum = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  ok(readFileSync(lockMark, 'utf8').trim() === sum, 'зависимости движка свежие', 'список зависимостей обновился: ' + reinstall);
}
ok(existsSync('node_modules/.remotion/chrome-headless-shell'), 'браузер для рендера', 'npm run setup');
ok(has('ffmpeg'), 'ffmpeg', reinstall);
// Фильтры, без которых не работают нарезка, проверка чёрных кадров, громкость и листы кадров
const NEED_FILTERS = ['ebur128', 'loudnorm', 'blackdetect', 'afade', 'setpts', 'xstack', 'drawtext', 'pad', 'tile', 'fps', 'scale'];
if (has('ffmpeg')) {
  let list = '';
  try { list = execFileSync('ffmpeg', ['-hide_banner', '-filters'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch { /* ниже FAIL */ }
  const names = new Set(list.split('\n').map((l) => l.trim().split(/\s+/)[1]));
  const lack = NEED_FILTERS.filter((f) => !names.has(f));
  ok(lack.length === 0, lack.length ? `в ffmpeg нет фильтров: ${lack.join(', ')}` : 'фильтры ffmpeg', 'нужна полная сборка ffmpeg: ' + reinstall);
}
ok(has('ffprobe'), 'ffprobe', 'ставится вместе с ffmpeg');
ok(existsSync(WHISPER_EXE), `распознавание речи (whisper.cpp ${WHISPER_VERSION})`, 'npm run setup');
ok(existsSync(MODEL_FILE) && statSync(MODEL_FILE).size === MODEL_BYTES[WHISPER_MODEL], 'модель речи (скачана целиком)', 'npm run setup — оборванная модель скачается заново');
ok(existsSync('src/index.ts') && existsSync('src/Root.tsx'), 'студия Remotion (src/index.ts)');
ok(existsSync('../.claude/skills/ai-montage/SKILL.md'), 'навык агента ../.claude/skills/ai-montage/SKILL.md', 'набор распакован не целиком');
ok(existsSync('public/fonts') && readdirSync('public/fonts').length >= 10, 'шрифты public/fonts');
ok(existsSync('public/sfx') && readdirSync('public/sfx').filter((f) => f.endsWith('.wav')).length >= 20, 'звуки public/sfx');
ok(existsSync('public/apple'), 'пак Apple public/apple');
ok(existsSync('public/sfx/pack/КАТАЛОГ.md'), 'пак звуков public/sfx/pack', reinstall);
ok(existsSync('public/objects') && readdirSync('public/objects').some((f) => f.endsWith('.png')), 'предметы public/objects', reinstall);
ok(existsSync('public/music') && readdirSync('public/music').some((f) => /\.(mp3|wav|m4a)$/i.test(f)), 'музыка public/music', reinstall);
if (win) ok(!/[^\x00-\x7F]/.test(process.cwd()) && !/onedrive/i.test(process.cwd()), `путь без русских букв и OneDrive: ${process.cwd()}`, 'перенеси набор в C:\\ai-montage');
ok(has('git', ['--version']), 'Git', 'Windows: winget install Git.Git; macOS: xcode-select --install');
const py = pythonVersion();
advice(py !== null && (py[0] > 3 || (py[0] === 3 && py[1] >= 9)),
  py ? `Python ${py[0]}.${py[1]} (для дополнительных скриптов; на монтаж не влияет)` : 'Python (для дополнительных скриптов; на монтаж не влияет)',
  reinstall + ' (он ставит Python)');
try {
  // как в установщике: меньше 8 ГБ — монтаж не начать, 8–15 — впритык
  const s = statfsSync('.'); const gb = (s.bavail * s.bsize) / 1e9;
  if (gb > 8) advice(gb > 15, `свободно на диске ${gb.toFixed(0)} ГБ`, 'впритык: лучше освободить до 15 ГБ');
  else ok(false, `свободно на диске ${gb.toFixed(0)} ГБ (нужно от 8)`, 'освободи место: рендер и модель речи занимают несколько ГБ');
} catch { /* старые Node */ }

let failed = false;
let warned = false;
for (const c of checks) {
  const mark = c.cond ? 'OK  ' : c.soft ? 'WARN' : 'FAIL';
  console.log(`${mark}  ${c.label}${!c.cond && c.fix ? `  →  ${c.fix}` : ''}`);
  if (!c.cond) { if (c.soft) warned = true; else failed = true; }
}
if (failed) { console.error('\nИсправь FAIL и запусти npm run doctor ещё раз.'); process.exit(1); }
if (warned) console.log('\nWARN не мешает монтажу.');
console.log('\nВсё готово к монтажу.');
