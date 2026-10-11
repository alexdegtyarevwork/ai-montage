// Подключает файлы ролика к его коду: node scripts/link-project.mjs <slug>  (сам вызывается из prep, cut и transcribe).
// В src/mine/<slug>/Reel.tsx или project.ts переписывает блок между строками «// >>> файлы проекта» и «// <<<»:
// частота из public/work/<slug>/meta.json (без видео — 30), нарезанные запись и голос (speaker-cut.mp4, voice-cut.wav;
// до нарезки — speaker.mp4 и voice.wav), слова work/<slug>/words.json и длительность по голосу, музыка music-bed.wav
// (npm run music) и цвет выделения субтитров из ПРАВИЛА/1 Настройки.txt («Цвет выделения»).
// Агенту не нужно помнить, какие файлы куда вписать: после каждого шага код ролика уже смотрит на свежие файлы.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const START = '// >>> файлы проекта', END = '// <<<';

const duration = (file) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'});
  const d = Number(r.stdout.trim());
  return Number.isFinite(d) ? d : 0;
};

// «Цвет выделения: #FBB931» в настройках ученика; нет строки или файла — #FBB931
const SETTINGS = path.join('..', 'ПРАВИЛА', '1 Настройки.txt');
export const accentOf = () => {
  try { return readFileSync(SETTINGS, 'utf8').match(/^\s*Цвет выделения[^:\n]*:\s*(#[0-9a-f]{6})\b/im)?.[1]?.toUpperCase() ?? '#FBB931'; } catch { return '#FBB931'; }
};

export function linkProject(slug) {
  const mine = path.join('src', 'mine', slug);
  const reel = path.join(mine, 'Reel.tsx'), proj = path.join(mine, 'project.ts');
  const target = existsSync(reel) ? reel : existsSync(proj) ? proj : null;
  if (!target) return null;
  const pub = path.join('public', 'work', slug), work = `work/${slug}`;
  const has = (f) => existsSync(path.join(pub, f));
  const meta = has('meta.json') ? JSON.parse(readFileSync(path.join(pub, 'meta.json'), 'utf8')) : {};
  const fps = meta.fps ?? 30;
  const speaker = has('speaker-cut.mp4') ? `${work}/speaker-cut.mp4` : has('speaker.mp4') ? `${work}/speaker.mp4` : null;
  const voice = has('voice-cut.wav') ? `${work}/voice-cut.wav` : has('voice.wav') ? `${work}/voice.wav` : null;
  const wordsFile = path.join('work', slug, 'words.json');
  const words = existsSync(wordsFile) ? JSON.parse(readFileSync(wordsFile, 'utf8')) : null;
  let dur = voice ? duration(path.join('public', voice)) : 0;
  if (words?.length) dur = Math.max(dur, words[words.length - 1].end + 0.4);
  dur = Math.round(dur * 100) / 100;
  const music = has('music-bed.wav') ? `${work}/music-bed.wav` : null;
  const accent = accentOf();
  const q = (s) => (s ? `'${s}'` : 'null');
  let body;
  if (target === reel) {
    body = [
      words ? `import WORDS_JSON from '../../../work/${slug}/words.json';` : dur ? `import {WORDS} from './words';` : `import {END, WORDS} from './words';`,
      ...(words ? ['const WORDS = WORDS_JSON;'] : []),
      ...(dur ? [`const END = ${dur};`] : []),
      `export const FPS = ${fps};`,
      `const WORK = '${work}';`,
      `const SPEAKER: string | null = ${q(speaker)};`,
      `const VOICE: string | null = ${q(voice)};`,
      `const MUSIC_BED: string | null = ${q(music)};`,
      `const CAPTION_ACCENT = '${accent}';`,
    ];
  } else {
    const link = [`fps: ${fps}`];
    if (dur) link.push(`duration: ${dur}`);
    if (words) link.push('words: WORDS');
    if (speaker) link.push(`speaker: {src: '${speaker}', w: 1440, h: 2560, muted: true}`);
    if (voice) link.push(`voice: '${voice}'`);
    if (music) link.push(`music: '${music}'`);
    link.push(`accent: '${accent}'`);
    body = [...(words ? [`import WORDS from '../../../work/${slug}/words.json';`] : []), `const LINK: Partial<ProjectData> = {${link.join(', ')}};`];
  }
  const src = readFileSync(target, 'utf8');
  const a = src.indexOf(START), b = src.indexOf(END, a);
  if (a < 0 || b < 0) { console.error(`в ${target} нет блока «${START}» … «${END}» — файлы не подключены`); return null; }
  const head = src.slice(0, src.indexOf('\n', a) + 1);
  const out = head + body.join('\n') + '\n' + src.slice(b);
  if (out !== src) writeFileSync(target, out);
  return {file: target, fps, speaker, voice, words: !!words, duration: dur, music, accent};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const slug = process.argv[2];
  if (!slug) { console.error('Использование: node scripts/link-project.mjs <slug>'); process.exit(2); }
  const r = linkProject(slug);
  console.log(r ? `подключено: ${JSON.stringify(r)}` : `нет кода ролика src/mine/${slug}/`);
}
