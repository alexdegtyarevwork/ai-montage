// Нарезка «последний полный дубль» (правила: ПРАВИЛА/3 Нарезка.md).
//   node scripts/cut.mjs takes <slug>          куски речи по паузам ≥ 0,2 с (на мелких паузах сидят перезапуски фразы), каждый
//                                              расшифрован отдельно, написание имён — по словарю → work/<slug>/takes.json
//   node scripts/cut.mjs apply <slug> <список> склейка выбранных кусков: «1,3,5-7» (в этом порядке), all — все куски без пауз,
//                                              none — без нарезки. «4+» — после куска 4 оставить смысловую паузу 0,4 с
//                                              (после вопроса, перед выводом или панчлайном). Остальные паузы ≥ 0,16 с вырезаются,
//                                              на стыках микро-затухание. В конце печатает оставшиеся паузы длиннее 0,3 с.
//                                              edit — по ручной правке из work/<slug>/cut-edit.json (npm run cut:edit).
//   node scripts/cut.mjs check <slug> [--script <файл>]  повторы фраз в work/<slug>/words.json (расшифровка готовой нарезки);
//                                              со сценарием — ещё и расхождения: каких слов нет в речи и что сказано сверх сценария
//   node scripts/cut.mjs final <slug> --out <файл.mp4>   «просто нарежь»: готовый ролик из нарезки без графики —
//                                              1080×1920, частота исходника, громкость −14 LUFS, без метаданных
// Вход: public/work/<slug>/speaker.mp4 и voice.wav (их делает prep.mjs).
// Выход: speaker-cut.mp4, voice-cut.wav и лёгкий cut_preview.mp4 (показать ученику) в public/work/<slug>/.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {C, HALLU, chunksOf, cutWav, ensureWhisper, envelope, fixWord, loadDict, r3, segments, threshold, wordsOf} from './asr.mjs';
import {master} from './master.mjs';
import {linkProject} from './link-project.mjs';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, {maxBuffer: 1024 * 1024 * 1024, ...opts});
const [cmd, slug, list] = process.argv.slice(2);
if (!cmd || !slug) { console.error('Использование: node scripts/cut.mjs takes|apply|check <slug> [список]'); process.exit(2); }
const dir = path.join('public', 'work', slug), work = path.join('work', slug);
mkdirSync(work, {recursive: true});

// Плотная резка куска: паузы внутри ≥ innerGap убираются, по краям запас.
function trimPiece(segs, total) {
  const out = [];
  let cur = null;
  for (const s of segs) {
    if (cur && s.start - cur.e < C.innerGap) cur.e = s.end;
    else { if (cur) out.push(cur); cur = {s: s.start, e: s.end}; }
  }
  if (cur) out.push(cur);
  return out.map((c) => ({start: r3(Math.max(0, c.s - C.padBefore)), end: r3(Math.min(total, c.e + C.padAfter))}));
}

if (cmd === 'takes') {
  const voice = path.join(dir, 'voice.wav');
  if (!existsSync(voice)) { console.error(`нет ${voice}: сначала node scripts/prep.mjs`); process.exit(1); }
  await ensureWhisper();
  const db = envelope(voice), thr = threshold(db);
  const chunks = chunksOf(segments(db, thr), C.takePause);
  const dict = loadDict(slug);
  const tmp = path.resolve('tmp', `takes-${slug}`);
  mkdirSync(tmp, {recursive: true});
  const rows = [];
  for (const [i, c] of chunks.entries()) {
    const wav = path.join(tmp, `c${i + 1}.wav`);
    const from = Math.max(0, c.start - 0.1);
    cutWav(voice, from, c.end - from + 0.1, wav);
    let text = '';
    try { text = (await wordsOf(wav, 0)).map((w) => fixWord(w.text, dict)).join(' '); } catch (e) { text = `(не расшифровалось: ${e.message})`; }
    const hallucination = !text.trim() || HALLU.some((re) => re.test(text)); // пусто — дыхание, смех, шум
    rows.push({n: i + 1, start: r3(c.start), end: r3(c.end), text, hallucination, segs: c.segs.map((s) => ({start: r3(s.start), end: r3(s.end)}))});
    console.log(`${String(i + 1).padStart(3, ' ')}  ${c.start.toFixed(2)}–${c.end.toFixed(2)}  ${hallucination ? '[шум] ' : ''}${text}`);
  }
  rmSync(tmp, {recursive: true, force: true});
  writeFileSync(path.join(work, 'takes.json'), JSON.stringify({threshold: thr, chunks: rows}, null, 1));
  console.log(`кусков: ${rows.length}, порог речи ${thr} dB → ${path.join(work, 'takes.json')}`);
  console.log('Дальше: выбери последний полный дубль каждой фразы и запусти apply со списком номеров.');
} else if (cmd === 'apply') {
  const speaker = path.join(dir, 'speaker.mp4'), voice = path.join(dir, 'voice.wav');
  const vOut = path.join(dir, 'speaker-cut.mp4'), aOut = path.join(dir, 'voice-cut.wav'), prev = path.join(dir, 'cut_preview.mp4');
  if (!list) { console.error('укажи список кусков: «1,3,5-7», all или none'); process.exit(2); }
  if (!existsSync(voice)) { console.error(`нет ${voice}: сначала npm run prep`); process.exit(1); }
  const audioOnly = !existsSync(speaker); // прислали только озвучку
  if (list === 'none') {
    if (!audioOnly) copyFileSync(speaker, vOut);
    copyFileSync(voice, aOut);
    // без нарезки — один кусок на всю запись: Premiere и ручная правка не возьмут старую нарезку
    const total = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice], {encoding: 'utf8'}).stdout.trim());
    writeFileSync(path.join(work, 'cut.json'), JSON.stringify({pick: [], keep: [], none: true, intervals: [{start: 0, end: r3(total), take: 0}]}, null, 1));
  } else {
    const takes = JSON.parse(readFileSync(path.join(work, 'takes.json'), 'utf8')).chunks;
    const edit = list === 'edit' ? JSON.parse(readFileSync(path.join(work, 'cut-edit.json'), 'utf8')).pieces.filter((p) => p.keep) : null;
    const items = edit ? edit.map((p) => ({n: p.take, keep: false})) : list === 'all' ? takes.filter((t) => !t.hallucination).map((t) => ({n: t.n, keep: false}))
      : list.split(',').map((p) => p.trim()).filter(Boolean).flatMap((p) => {
        const keep = p.endsWith('+'), [a, b] = p.replace(/\+$/, '').split('-').map(Number);
        const ns = b ? Array.from({length: b - a + 1}, (_, k) => a + k) : [a];
        return ns.map((n, i) => ({n, keep: keep && i === ns.length - 1}));
      });
    const pick = items.map((x) => x.n);
    const pr = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate:format=duration', '-of', 'json', audioOnly ? voice : speaker], {encoding: 'utf8'}).stdout);
    const [fa, fb] = (pr.streams[0]?.r_frame_rate ?? '30/1').split('/').map(Number), fps = fa / (fb || 1), total = Number(pr.format.duration);
    const intervals = edit ? edit.map((p) => ({start: r3(Math.max(0, p.start)), end: r3(Math.min(total, p.end)), take: p.take})) : items.flatMap(({n, keep}) => {
      const t = takes.find((x) => x.n === n); if (!t) throw new Error(`нет куска ${n}`);
      const iv = trimPiece(t.segs, total).map((x) => ({...x, take: n}));
      if (keep) { // смысловая пауза: продлеваем кусок в его же тишину, но не до следующего звука
        const next = takes.find((x) => x.start > t.end - 0.001);
        const last = iv[iv.length - 1], limit = next ? next.start - C.padBefore : total;
        last.end = r3(Math.max(last.end, Math.min(limit, t.end + C.keepPause)));
      }
      return iv;
    });
    let cum = 0;
    const parts = [], labels = [];
    intervals.forEach(({start, end}, i) => {
      const f0 = Math.round(cum * fps); cum += end - start;
      const frames = Math.max(1, Math.round(cum * fps) - f0), vs = Math.round(start * fps), d = r3(end - start);
      if (!audioOnly) parts.push(`[0:v]trim=start_frame=${vs}:end_frame=${vs + frames},setpts=PTS-STARTPTS[v${i}]`);
      parts.push(`[${audioOnly ? 0 : 1}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${C.fadeIn},afade=t=out:st=${r3(Math.max(0, d - C.fadeOut))}:d=${C.fadeOut}[a${i}]`);
      labels.push(audioOnly ? `[a${i}]` : `[v${i}][a${i}]`);
    });
    const filter = `${parts.join(';')};${labels.join('')}concat=n=${intervals.length}:v=${audioOnly ? 0 : 1}:a=1${audioOnly ? '' : '[v]'}[a]`;
    mkdirSync('tmp', {recursive: true});
    const ff = path.resolve('tmp', `cut-${slug}.txt`);
    writeFileSync(ff, filter);
    // -filter_complex_script устарел в FFmpeg 7.1+ (пока работает и в 8.0); если очередная версия его уберёт — берём -/filter_complex
    const glue = (opt) => run('ffmpeg', ['-v', 'error', '-y', ...(audioOnly ? [] : ['-i', speaker]), '-i', voice, opt, ff,
      ...(audioOnly ? [] : ['-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', vOut]),
      '-map', '[a]', '-c:a', 'pcm_s16le', '-ar', '48000', aOut], {encoding: 'utf8'});
    let r = glue('-filter_complex_script');
    if (r.status !== 0 && /Unrecognized option|Option not found/i.test(String(r.stderr))) r = glue('-/filter_complex');
    rmSync(ff, {force: true});
    if (r.status !== 0) { console.error('склейка не получилась: ' + String(r.stderr).slice(-600)); process.exit(1); }
    writeFileSync(path.join(work, 'cut.json'), JSON.stringify({pick, keep: items.filter((x) => x.keep).map((x) => x.n), intervals}, null, 1));
  }
  // превью нарезки; у одной озвучки — на чёрном фоне
  const pin = audioOnly ? ['-f', 'lavfi', '-i', 'color=c=black:s=540x960:r=30', '-i', aOut] : ['-i', vOut, '-i', aOut];
  const p = run('ffmpeg', ['-v', 'error', '-y', ...pin, '-map', '0:v', '-map', '1:a', ...(audioOnly ? [] : ['-vf', 'scale=540:960']), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', prev], {encoding: 'utf8'});
  if (p.status !== 0) { console.error('превью не собралось: ' + String(p.stderr).slice(-400)); process.exit(1); }
  const dur = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', aOut], {encoding: 'utf8'}).stdout.trim();
  // оставшиеся паузы > 0,3 с: должны быть только смысловые («+»), остальное — недорезанная тишина
  const adb = envelope(aOut), segs = segments(adb, threshold(adb)), pauses = [];
  for (let i = 1; i < segs.length; i++) { const g = segs[i].start - segs[i - 1].end; if (g > 0.3) pauses.push({at: r3(segs[i - 1].end), sec: r3(g)}); }
  linkProject(slug);
  console.log(JSON.stringify({ok: true, speaker: audioOnly ? null : vOut, voice: aOut, preview: prev, duration: Number(Number(dur).toFixed(2)), pauses}));
} else if (cmd === 'check') {
  const words = JSON.parse(readFileSync(path.join(work, 'words.json'), 'utf8'));
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}-]+/gu, '');
  const w = words.map((x) => norm(x.text)).filter(Boolean);
  const seen = new Map(), found = [];
  for (let i = 0; i + 4 <= w.length; i++) {
    const key = w.slice(i, i + 4).join(' ');
    if (seen.has(key) && i - seen.get(key) >= 4) { if (!found.includes(key)) found.push(key); } else if (!seen.has(key)) seen.set(key, i);
  }
  console.log(found.length ? `ПОВТОРЫ (остался лишний дубль): ${found.join(' | ')}` : 'Повторов нет: каждая фраза один раз.');
  // Сверка со сценарием: общий порядок слов (LCS), расхождения — куски, которых нет в речи, и сказанное сверх сценария
  const si = process.argv.indexOf('--script');
  let diffs = 0;
  if (si > 0) {
    const s = readFileSync(process.argv[si + 1], 'utf8').split(/\s+/).map(norm).filter(Boolean);
    const n = s.length, m = w.length, L = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = s[i] === w[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const miss = [], extra = []; let i = 0, j = 0, cm = [], ce = [];
    const flush = () => { if (cm.length) miss.push(cm.join(' ')); if (ce.length) extra.push(ce.join(' ')); cm = []; ce = []; };
    while (i < n || j < m) {
      if (i < n && j < m && s[i] === w[j]) { flush(); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) ce.push(w[j++]);
      else cm.push(s[i++]);
    }
    flush();
    diffs = miss.length + extra.length;
    if (!diffs) console.log('Со сценарием совпадает слово в слово.');
    else {
      if (miss.length) console.log(`НЕТ В РЕЧИ (есть в сценарии): ${miss.join(' | ')}`);
      if (extra.length) console.log(`СВЕРХ СЦЕНАРИЯ (сказано, но нет в тексте): ${extra.join(' | ')}`);
      console.log('Перечисли ученику расхождения; если нужен текст дословно — предложи более ранний дубль.');
    }
  }
  process.exit(found.length ? 1 : 0);
} else if (cmd === 'final') {
  // «Просто нарежь»: нарезка без субтитров, музыки и графики, готовая к выкладке
  const oi = process.argv.indexOf('--out'), out = oi > 0 ? process.argv[oi + 1] : path.join('out', `${slug}-нарезка.mp4`);
  const vIn = path.join(dir, 'speaker-cut.mp4'), aIn = path.join(dir, 'voice-cut.wav');
  if (!existsSync(aIn)) { console.error('нет нарезки: сначала npm run cut'); process.exit(1); }
  if (!existsSync(vIn)) { console.error('прислана только озвучка — «просто нарежь» делает видео из записи; готовый голос: ' + aIn); process.exit(1); }
  mkdirSync('tmp', {recursive: true}); mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  const raw = path.resolve('tmp', `final-${slug}.mp4`);
  const r = run('ffmpeg', ['-v', 'error', '-y', '-i', vIn, '-i', aIn, '-map', '0:v', '-map', '1:a', '-vf', 'scale=1080:1920:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '320k', '-shortest', raw], {encoding: 'utf8'});
  if (r.status !== 0) { console.error('финал нарезки не собрался: ' + String(r.stderr).slice(-400)); process.exit(1); }
  const loud = master(raw, out);
  rmSync(raw, {force: true});
  const pr = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'csv=p=0', out], {encoding: 'utf8'}).stdout.trim().replace(/\n/g, ', ');
  console.log(`готово: ${out} — ${pr}; громкость ${loud.lufs} LUFS`);
} else { console.error('команда: takes | apply | check | final'); process.exit(2); }
