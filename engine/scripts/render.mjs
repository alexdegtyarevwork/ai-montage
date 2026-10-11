// Рендер с выравниванием громкости. Работает одинаково на Mac и Windows (только Node и ffmpeg).
//   npm run draft     -- <композиция>   черновик 720p
//   npm run render    -- <композиция>   финал 1080×1920 (стандарт)
//   npm run render:2k -- <композиция>   финал 1440×2560
//   npm run render:4k -- <композиция>   финал 2160×3840 (долго; исходник спикера тогда нужен 4K)
// Опции: --entry src/entries/<id>.tsx (своя точка входа), --out <путь>/final.mp4 (куда положить копию готового).
// Результат: out/<id>-<режим>.mp4, громкость −14 LUFS, проверка чёрных кадров.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {copyFileSync, mkdirSync, rmSync, statSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {master} from './master.mjs';

const MODES = {
  draft: {scale: 0.5, bitrate: '8M', label: '720p'},
  hd: {scale: 0.75, bitrate: '20M', label: '1080p'},
  '2k': {scale: 1, bitrate: '48M', label: '2K'},
  '4k': {scale: 1.5, bitrate: '80M', label: '4K'},
};
const [mode, id, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
if (!MODES[mode] || !id) { console.error('Использование: npm run draft|render|render:2k|render:4k -- <композиция> [--entry файл] [--out путь]'); process.exit(1); }
const {scale, bitrate, label} = MODES[mode];
const entry = opt('entry', 'src/index.ts');
mkdirSync('out', {recursive: true});
const raw = path.join('out', `${id}-${mode}-raw.mp4`), fin = path.join('out', `${id}-${mode}.mp4`);
const cli = path.resolve('node_modules/@remotion/cli/remotion-cli.js');
// Цвет: Remotion пишет BT.601 в полном диапазоне и честно помечает это в файле. Замер 11.10.2026 (кадр студии против кадра
// из MP4): так цвет совпадает с точностью до 1 единицы, а с --color-space=bt709 красный уходит на 3 единицы — флаг не ставим.
const args = [cli, 'render', entry, id, raw, `--scale=${scale}`, `--video-bitrate=${bitrate}`, '--concurrency=2', '--log=error'];
// На Mac кодирует встроенный видеоблок, а не процессор: быстрее и меньше греется. На Windows флага нет — кодирует процессор.
if (process.platform === 'darwin') args.push('--hardware-acceleration=if-possible');
const t0 = Date.now();
console.log(`Рендер ${label}: ${id}…`);
const r = spawnSync(process.execPath, args, {stdio: 'inherit'});
if (r.status !== 0) { console.error('Рендер упал: смотри ошибку выше.'); process.exit(r.status ?? 1); }
console.log(`Рендер ${((Date.now() - t0) / 60000).toFixed(1)} мин. Громкость → −14 LUFS…`);
const loud = master(raw, fin);
rmSync(raw, {force: true});
const black = spawnSync('ffmpeg', ['-v', 'info', '-i', fin, '-vf', 'scale=360:-2,blackdetect=d=0.1:pix_th=0.04', '-an', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
const n = ((black.stderr || '').match(/black_start/g) || []).length;
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-show_entries', 'format=duration', '-of', 'csv=p=0:s=x', fin], {encoding: 'utf8'});
const mb = (statSync(fin).size / 1048576).toFixed(1);
console.log(`Файл: ${fin} — ${mb} МБ; ${(probe.stdout || '').trim().replace(/\n/g, ', ')}; громкость ${loud.lufs} LUFS, пик ${loud.peak} dBFS`);
console.log(n ? `ВНИМАНИЕ: чёрных отрезков ${n} — проверь стыки.` : 'Чёрных кадров нет.');
const to = opt('out');
if (to) { mkdirSync(path.dirname(to), {recursive: true}); copyFileSync(fin, to); console.log(`Копия: ${to}`); }
