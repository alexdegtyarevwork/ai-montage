import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
// Отчёт для автора курса: npm run report → engine/logs/отчёт-<дата>.txt (несколько КБ, только текст).
// Внутри: версия набора, система, программы, проверка движка, последние ошибки из журнала и конец журнала установки.
// Видео, голос, ключи и содержимое роликов в отчёт не попадают; папка пользователя заменена на «~».
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statfsSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {LOG_DIR, LOG_FILE} from './log.mjs';

const run = (cmd, args) => { try { return execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, env: {...process.env, AI_MONTAGE_NO_LOG: '1'}}).trim(); } catch (e) { return String(e.stdout ?? '').trim() || `нет (${String(e.message).split('\n')[0]})`; } };
const first = (s) => String(s).split('\n')[0];
const hide = (s) => String(s).split(os.homedir()).join('~');
const out = [];
const add = (title, body) => out.push(`== ${title}`, hide(body).trim(), '');

const kit = path.resolve('..');
add('Набор', [`версия: ${run('git', ['-C', kit, 'log', '-1', '--format=%h %cd', '--date=short'])}`,
  `своих изменённых файлов набора: ${run('git', ['-C', kit, 'status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean).length}`,
  `папка: ${kit}`].join('\n'));
let disk = '';
try { const s = statfsSync('.'); disk = `${((s.bavail * s.bsize) / 1e9).toFixed(0)} ГБ свободно`; } catch { /* старые Node */ }
add('Система', [`${os.type()} ${os.release()} ${os.arch()}`, `процессор: ${os.cpus()[0]?.model ?? '?'} × ${os.cpus().length}`,
  `память: ${(os.totalmem() / 1e9).toFixed(0)} ГБ, ${disk}`].join('\n'));
add('Программы', [`Node.js ${process.version}`, `npm ${run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['-v'])}`,
  first(run('ffmpeg', ['-version'])), first(run('git', ['--version'])),
  first(run(process.platform === 'win32' ? 'python' : 'python3', ['--version']))].join('\n'));
add('Проверка движка (npm run doctor)', run(process.execPath, ['scripts/doctor.mjs']));
const rows = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean) : [];
const errors = rows.filter((r) => { try { const j = JSON.parse(r); return j.code && !j.stopped && j.code !== 130 && j.code !== 143; } catch { return false; } });
add('Последние ошибки', errors.slice(-15).join('\n') || 'нет');
add('Последние команды', rows.slice(-10).join('\n') || 'журнал пуст');
const inst = path.join(kit, 'install.log');
if (existsSync(inst)) add('Конец журнала установки', readFileSync(inst, 'utf8').split('\n').slice(-60).join('\n'));

mkdirSync(LOG_DIR, {recursive: true});
const file = path.join(LOG_DIR, `отчёт-${new Date().toISOString().slice(0, 10)}.txt`);
writeFileSync(file, out.join('\n'));
console.log(out.join('\n'));
console.log(`\nОтчёт сохранён: ${hide(file)} — перешли этот файл автору курса.`);
