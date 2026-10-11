// Журнал команд набора: каждая команда npm run … дописывает одну строку в engine/logs/ai-montage.log (только на этом компьютере,
// в облако ничего не уходит). Журнал не растёт больше ~300 КБ: старая половина отрезается.
// Строка: время, команда, аргументы, код выхода, секунды; у ошибки — код вида E-1a2b3c и последние строки сообщения.
// При ошибке команда печатает код: ученик пишет в чат «разбери ошибку E-1a2b3c», агент находит строку в журнале.
// Отчёт для автора курса — npm run report (scripts/report.mjs).
import {appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOG_DIR = path.join(ENGINE, 'logs');
export const LOG_FILE = path.join(LOG_DIR, 'ai-montage.log');
const MAX = 300 * 1024;
const t0 = Date.now();
const errs = [];

// последние строки ошибок, которые печатает команда (console.error и падения). Строки стека «at …» и предупреждения
// Node об устаревших функциях не берём: они вытесняли само сообщение. Первую строку с «Error»/«ошибк» помним отдельно.
let head = '';
const noise = (l) => /^\s+at\s|^\s*\(Use `node --trace|DeprecationWarning|ExperimentalWarning/.test(l);
const keep = (s) => {
  for (const l of String(s).split('\n').filter((x) => x.trim() && !noise(x))) {
    if (!head && /error|ошибк|не удалось|failed/i.test(l)) head = l.trim();
    errs.push(l);
    if (errs.length > 12) errs.shift();
  }
};
const origError = console.error.bind(console);
// Предупреждения Node об устаревших функциях (DEP0205 из Remotion) печатались под каждой командой — глушим и у дочерних процессов.
process.noDeprecation = true;
if (!/--no-deprecation/.test(process.env.NODE_OPTIONS ?? '')) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-deprecation`.trim();
console.error = (...a) => { keep(a.map((x) => (x instanceof Error ? x.stack ?? x.message : String(x))).join(' ')); origError(...a); };
process.on('uncaughtException', (e) => { keep(e?.stack ?? String(e)); origError(e?.stack ?? e); process.exitCode = 1; process.exit(1); });
process.on('unhandledRejection', (e) => { keep(e?.stack ?? String(e)); origError(e?.stack ?? e); process.exitCode = 1; process.exit(1); });

// AI_MONTAGE_NO_LOG=1 — не писать (тесты и вложенные вызовы из отчёта)
let written = process.env.AI_MONTAGE_NO_LOG === '1';
process.on('exit', (code) => {
  if (written) return;
  written = true;
  try {
    mkdirSync(LOG_DIR, {recursive: true});
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX) {
      const s = readFileSync(LOG_FILE, 'utf8');
      writeFileSync(LOG_FILE, s.slice(s.indexOf('\n', s.length / 2) + 1));
    }
    // 130 и 143 — команду остановили (Ctrl+C, закрыли окно): это не ошибка, кода не даём
    const stopped = code === 130 || code === 143;
    const id = code && !stopped ? 'E-' + (Date.now() % 0xffffff).toString(16).padStart(6, '0') : undefined;
    const tail = errs.slice(-6), err = [...(head && !tail.some((l) => l.includes(head)) ? [head] : []), ...tail].join(' | ').slice(0, 900);
    const row = {t: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' '), id, cmd: path.basename(process.argv[1] ?? ''), args: process.argv.slice(2).join(' ').slice(0, 300),
      code, sec: Math.round((Date.now() - t0) / 100) / 10, ...(stopped ? {stopped: true} : code ? {err} : {})};
    appendFileSync(LOG_FILE, JSON.stringify(row) + '\n');
    // подсказку печатаем, только если команда упала с сообщением об ошибке (проверки вроде cut:check выходят с кодом 1 молча)
    if (id && errs.length) origError(`\nКод ошибки ${id}: напиши в чат «разбери ошибку ${id}» (журнал engine/logs/ai-montage.log, отчёт для автора — npm run report).`);
  } catch { /* журнал никогда не мешает работе */ }
});
