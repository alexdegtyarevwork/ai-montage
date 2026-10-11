// Музыка на фон под голос (правила: ПРАВИЛА/5 Звук.md). Только для фоновой музыки, звуки-эффекты так не обрабатываются.
//   node scripts/music.mjs <трек> <slug> [--start 12.5] [--level -13]
// 1) из музыки вырезается полоса, где живёт разборчивость голоса (≈300 Гц – 4 кГц, сильнее всего 1–4 кГц): низ и самый верх остаются;
// 2) громкость музыки ставится на --level дБ ниже голоса (по умолчанию −13 LU: голос −14 LUFS → музыка ≈ −27 LUFS);
// 3) пока звучит голос, музыка мягко приседает (sidechain, порог 0,1, ratio 2: голос в записях сжат, сильнее давить нельзя);
// 4) длина = голос + 1,5 с, трек зацикливается, если короче; вход 0,5 с, затухание 1,5 с.
// Вход: public/work/<slug>/voice-cut.wav. Выход: public/work/<slug>/music-bed.wav — команда сама подключает его к ролику
// (project.ts: music, Reel.tsx: MUSIC_BED), громкость в коде 1.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {linkProject} from './link-project.mjs';

const [trackArg, slug, ...rest] = process.argv.slice(2);
// Трек можно назвать путём или просто именем: ищется в «Музыка» ученика, в паке public/music и в «Загрузках»
// (точное имя файла, затем имя без расширения, затем часть имени без учёта регистра).
const AUDIO = /\.(mp3|wav|m4a|aac|flac|ogg|aiff?)$/i;
const findTrack = (name) => {
  if (!name) return null;
  const p = name.replace(/^~(?=$|[\\/])/, os.homedir());
  if (existsSync(p)) return p;
  const dirs = [path.join('..', 'Музыка'), path.join('public', 'music'), path.join(os.homedir(), 'Downloads'), path.join(os.homedir(), 'Загрузки')].filter((d) => existsSync(d));
  const want = path.basename(p).toLowerCase(), stem = want.replace(AUDIO, '');
  for (const test of [(f) => f.toLowerCase() === want, (f) => f.toLowerCase().replace(AUDIO, '') === stem, (f) => f.toLowerCase().includes(stem)]) {
    for (const d of dirs) {
      const hit = readdirSync(d).find((f) => AUDIO.test(f) && test(f));
      if (hit) return path.join(d, hit);
    }
  }
  return null;
};
const track = findTrack(trackArg);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? Number(rest[i + 1]) : d; };
if (!trackArg || !slug) { console.error('Использование: npm run music -- <трек> <slug> [--start сек] [--level -13]'); process.exit(2); }
const dir = path.join('public', 'work', slug), voice = path.join(dir, 'voice-cut.wav'), out = path.join(dir, 'music-bed.wav');
if (!track) { console.error(`не нашёл трек «${trackArg}» ни по пути, ни в «Музыка», public/music и «Загрузках»`); process.exit(1); }
console.log(`трек: ${track}`);
if (!existsSync(voice)) { console.error(`нет ${voice}: сначала нарезка (npm run cut)`); process.exit(1); }
const start = opt('start', 0), level = opt('level', -13);
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
const lufs = (file) => {
  const r = ff(['-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const v = [...(r.stderr || '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1];
  if (v == null) throw new Error(`громкость не замерилась: ${file}`);
  return Number(v);
};
const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice], {encoding: 'utf8'}).stdout.trim());
const len = dur + 1.5;
const vL = lufs(voice);
mkdirSync('tmp', {recursive: true});
const tmp = path.join('tmp', `music-${slug}.wav`);
// Полоса голоса в музыке: широкий провал вместо срезания всего верха — музыка остаётся живой, голос читается.
const CARVE = ['highpass=f=35', 'equalizer=f=350:t=q:w=1.2:g=-3', 'equalizer=f=1200:t=q:w=1:g=-7',
  'equalizer=f=2500:t=q:w=1:g=-9', 'equalizer=f=4000:t=q:w=1:g=-6'].join(',');
let r = ff(['-y', '-v', 'error', '-stream_loop', '-1', '-ss', String(start), '-i', track, '-t', String(len), '-ac', '2', '-ar', '48000', '-af', CARVE, tmp]);
if (r.status !== 0) { console.error('музыка не обработалась:', (r.stderr || '').slice(-400)); process.exit(1); }
const gain = (vL + level) - lufs(tmp);
const fadeAt = Math.max(0, len - 1.5);
r = ff(['-y', '-v', 'error', '-i', tmp, '-i', voice, '-filter_complex',
  `[0:a]volume=${gain.toFixed(2)}dB[m];[1:a]aformat=channel_layouts=stereo,aresample=48000,apad[k];` +
  `[m][k]sidechaincompress=threshold=0.1:ratio=2:attack=20:release=350[d];[d]afade=t=in:d=0.5,afade=t=out:st=${fadeAt.toFixed(2)}:d=1.5[o]`,
  '-map', '[o]', '-t', String(len), '-c:a', 'pcm_s16le', out]);
rmSync(tmp, {force: true});
if (r.status !== 0) { console.error('музыка не свелась с голосом:', (r.stderr || '').slice(-400)); process.exit(1); }
console.log(`готово: ${out} — ${len.toFixed(1)} с; голос ${vL} LUFS, музыка ≈ ${(vL + level).toFixed(1)} LUFS до приседания под голос`);
linkProject(slug); // подложка сразу подключена к коду ролика
