// Громкость после рендера: два прохода loudnorm до −14 LUFS, пик ≤ −1 dBTP; видео копируется без перекодирования.
// Финал без метаданных: теги, даты, имя кодировщика и служебная строка x264 внутри видео вычищаются.
//   node scripts/master.mjs <raw.mp4> <final.mp4>
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

// Имена обработчиков дорожек (VideoHandler, SoundHandler) ffmpeg пишет всегда: зануляем их байты на месте, размеры коробок не меняются.
function blankHandlers(file) {
  const b = readFileSync(file);
  // Только внутри коробки moov: в самих кадрах (mdat) те же 4 буквы могут встретиться случайно.
  let pos = 0, moov = null;
  while (pos + 8 <= b.length) {
    let size = b.readUInt32BE(pos); const type = b.toString('latin1', pos + 4, pos + 8);
    if (size === 1) size = Number(b.readBigUInt64BE(pos + 8)); else if (size === 0) size = b.length - pos;
    if (size < 8) break;
    if (type === 'moov') { moov = [pos, Math.min(b.length, pos + size)]; break; }
    pos += size;
  }
  if (!moov) return;
  for (let i = b.indexOf('hdlr', moov[0]); i >= 4 && i < moov[1]; i = b.indexOf('hdlr', i + 4)) {
    const size = b.readUInt32BE(i - 4), end = i - 4 + size;
    if (size >= 33 && end <= moov[1]) b.fill(0, i + 28, end);
  }
  writeFileSync(file, b);
}

export function master(raw, out) {
  const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const NORM = 'loudnorm=I=-14:TP=-1:LRA=11';
  const p1 = ff(['-i', raw, '-af', `${NORM}:print_format=json`, '-f', 'null', '-']);
  const m = (p1.stderr || '').match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (p1.status !== 0 || !m) throw new Error('громкость не замерилась: ' + (p1.stderr || '').slice(-400));
  const j = JSON.parse(m[0]);
  const codec = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', raw], {encoding: 'utf8'}).stdout.trim().split(/[,\s]/)[0]; // ffprobe может дописать «,»
  const CLEAN = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact',
    '-metadata:s:v:0', 'handler_name=', '-metadata:s:a:0', 'handler_name=', '-metadata:s:v:0', 'encoder=', '-metadata:s:a:0', 'encoder=',
    // h264: вырезать служебную строку кодировщика (SEI); пометки цвета остаются как у исходного файла
    ...(codec === 'h264' ? ['-bsf:v', 'filter_units=remove_types=6'] : [])];
  const p2 = ff(['-y', '-v', 'error', '-i', raw, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', ...CLEAN,
    '-af', `${NORM}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`,
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out]);
  if (p2.status !== 0) throw new Error('громкость не выровнялась: ' + (p2.stderr || '').slice(-400));
  blankHandlers(out);
  const p3 = ff(['-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const lufs = [...(p3.stderr || '').matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop()?.[1];
  const peak = [...(p3.stderr || '').matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop()?.[1];
  return {lufs: lufs ? Number(lufs) : null, peak: peak ? Number(peak) : null};
}

if (process.argv[1] && process.argv[1].endsWith('master.mjs')) {
  const [raw, out] = process.argv.slice(2);
  if (!raw || !out) { console.error('Использование: node scripts/master.mjs <raw.mp4> <final.mp4>'); process.exit(2); }
  const r = master(raw, out);
  console.log(`громкость ${r.lufs} LUFS, пик ${r.peak} dBFS → ${out}`);
}
