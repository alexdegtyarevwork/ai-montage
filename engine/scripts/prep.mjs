// Приём записи ученика: node scripts/prep.mjs <видео или озвучка> <slug>
// Делает public/work/<slug>/speaker.mp4 (1440×2560, H.264, без звука) и voice.wav (голос, 48 кГц). Картинка и голос — отдельные
// файлы: так нарезка режет их одинаково, а громкость голоса выравнивается отдельно; код ролика подключает оба сам.
// Прислали только озвучку (аудиофайл) — делается один voice.wav, частота ролика 30 к/с.
// видео с iPhone в HDR переводит в обычный SDR (это не цветокор). Квадратное и горизонтальное не трогает — сначала спросить ученика.
// Печатает одну строку JSON: размер, fps ролика (как в исходнике), длительность, HDR. fps пишется и в public/work/<slug>/meta.json.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {linkProject} from './link-project.mjs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const [src, slug, ...rest] = process.argv.slice(2);
if (!src || !slug) { console.error('Использование: node scripts/prep.mjs <видео> <slug> [--crop-ok]'); process.exit(2); }
const run = (cmd, args) => spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
const pr = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,avg_frame_rate,color_transfer,disposition:stream_side_data=rotation', '-show_entries', 'format=duration', '-of', 'json', src]);
if (pr.status !== 0) { console.error('не читается файл: ' + pr.stderr); process.exit(1); }
const j = JSON.parse(pr.stdout);
// обложка внутри mp3/m4a — тоже «видеопоток», но это картинка, а не запись
const v = j.streams.find((s) => !s.disposition?.attached_pic);
const dir = path.join('public', 'work', slug);
if (!v) {
  mkdirSync(dir, {recursive: true});
  rmSync(path.join(dir, 'speaker.mp4'), {force: true});
  const a = run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '48000', path.join(dir, 'voice.wav')]);
  if (a.status !== 0) { console.error('звук не извлёкся: ' + a.stderr.slice(-400)); process.exit(1); }
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({fps: 30, audioOnly: true}, null, 1));
  linkProject(slug);
  console.log(JSON.stringify({ok: true, audioOnly: true, voice: path.join(dir, 'voice.wav'), fps: 30, duration: Number(Number(j.format.duration).toFixed(2))}));
  process.exit(0);
}
const rot = Math.abs(Number(v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0));
let [w, h] = [v.width, v.height];
if (rot === 90 || rot === 270) [w, h] = [h, w];
// Частота ролика — как в исходнике, округлённая до стандартной (29,97 → 30; запись iPhone с плавающей частотой → ближайшая;
// 120/240 к/с замедленной съёмки → 60). Запись приводится к ровной частоте: на «плавающей» Remotion сбивается при перемотке.
const rate = (s) => { const [a, b] = String(s).split('/').map(Number); return a / (b || 1); };
const fps = Math.round((rate(v.avg_frame_rate) || rate(v.r_frame_rate)) * 100) / 100;
const STD = [24, 25, 30, 50, 60];
const fpsOut = fps >= 60 ? 60 : STD.reduce((best, s) => (Math.abs(s - fps) < Math.abs(best - fps) ? s : best), 30);
const hdr = ['arib-std-b67', 'smpte2084'].includes(v.color_transfer);
const ratio = w / h;
// Вертикальное видео (9:16, 9:19 с телефона, 3:4, 4:5) обрезается до 9:16 по центру без вопросов.
// Квадратное и горизонтальное — только после «да» ученика (--crop-ok): иначе пропадёт половина кадра.
if (ratio > 0.81 && !rest.includes('--crop-ok')) {
  console.log(JSON.stringify({ok: false, reason: 'not-vertical', width: w, height: h, hint: 'Спроси ученика, можно ли обрезать до 9:16, затем добавь --crop-ok'}));
  process.exit(3);
}
mkdirSync(dir, {recursive: true});
const tone = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';
const fit = 'scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,setsar=1';
const enc = (filters) => run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', filters, '-fps_mode', 'cfr', '-r', String(fpsOut), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
  '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', path.join(dir, 'speaker.mp4')]);
let r = enc(hdr ? `${tone},${fit}` : `${fit},format=yuv420p`);
let toneMapped = hdr;
if (r.status !== 0 && hdr) { r = enc(`${fit},format=yuv420p`); toneMapped = false; }
if (r.status !== 0) { console.error('видео не перекодировалось: ' + r.stderr.slice(-400)); process.exit(1); }
const a2 = run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '48000', path.join(dir, 'voice.wav')]);
if (a2.status !== 0) { console.error('звук не извлёкся: ' + a2.stderr.slice(-400)); process.exit(1); }
writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({fps: fpsOut, source: {width: w, height: h, fps}}, null, 1));
linkProject(slug);
console.log(JSON.stringify({ok: true, speaker: path.join(dir, 'speaker.mp4'), voice: path.join(dir, 'voice.wav'), fps: fpsOut,
  source: {width: w, height: h, fps, duration: Number(Number(j.format.duration).toFixed(2)), hdr}, toneMapped}));
