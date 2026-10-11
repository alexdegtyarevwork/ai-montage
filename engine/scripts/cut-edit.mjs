// Ручная правка нарезки в Remotion Studio: node scripts/cut-edit.mjs <slug> [--reset] [--no-open]
// 1) из готовой нарезки (work/<slug>/cut.json + takes.json) делает work/<slug>/cut-edit.json — список кусков
//    {take, start, end, keep, text}; при повторном запуске файл не трогает, если нарезка не менялась (--reset — собрать заново);
// 2) пишет точку входа src/entries/cut-edit.tsx и открывает Remotion Studio (http://localhost:3000): нарезка со звуком,
//    у каждого куска подпись «Кусок N · дубль T · начало–конец», внизу шкала всех кусков.
// Правка: агент меняет start/end/keep в cut-edit.json по словам ученика — Studio обновляется сам.
// Готово: npm run cut -- <slug> edit (пересобирает speaker-cut.mp4, voice-cut.wav и превью из файла правки).
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

const [slug, ...rest] = process.argv.slice(2);
if (!slug) { console.error('Использование: npm run cut:edit -- <slug> [--reset] [--no-open]'); process.exit(2); }
const work = path.join('work', slug), dir = path.join('public', 'work', slug), file = path.join(work, 'cut-edit.json');
const cut = path.join(work, 'cut.json');
if (!existsSync(cut)) { console.error(`нет ${cut}: сначала нарезка (npm run cut)`); process.exit(1); }
let fps = 30;
const meta = path.join(dir, 'meta.json');
if (existsSync(meta)) fps = JSON.parse(readFileSync(meta, 'utf8')).fps;
else {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', path.join(dir, 'speaker.mp4')], {encoding: 'utf8'});
  const [a, b] = r.stdout.trim().split('/').map(Number); fps = Math.round(a / (b || 1));
}
// файл правки собирается заново и после новой нарезки (cut.json свежее файла правки)
if (!existsSync(file) || rest.includes('--reset') || statSync(cut).mtimeMs > statSync(file).mtimeMs) {
  const {intervals} = JSON.parse(readFileSync(cut, 'utf8'));
  const takesFile = path.join(work, 'takes.json');
  const takes = existsSync(takesFile) ? JSON.parse(readFileSync(takesFile, 'utf8')).chunks : [];
  const pieces = intervals.map((iv) => ({take: iv.take ?? 0, start: iv.start, end: iv.end, keep: true,
    text: takes.find((t) => t.n === iv.take)?.text ?? ''}));
  writeFileSync(file, JSON.stringify({slug, fps, pieces}, null, 1));
  console.log(`файл правки: ${file} — ${pieces.length} кусков`);
}
mkdirSync(path.join('src', 'entries'), {recursive: true});
writeFileSync(path.join('src', 'entries', 'cut-edit.tsx'), `// Создано scripts/cut-edit.mjs для ролика ${slug} — не правь руками, перезапусти npm run cut:edit.
import {Composition, registerRoot} from 'remotion';
import '../fonts';
import {CutEdit, cutEditDuration, type CutEditProps} from '../montage/CutEdit';
import data from '../../work/${slug}/cut-edit.json';

const props = data as CutEditProps;
registerRoot(() => (
  <Composition id="cut-edit" component={CutEdit} defaultProps={props} durationInFrames={cutEditDuration(props)}
    fps={props.fps} width={1440} height={2560} />
));
`);
if (rest.includes('--no-open')) { console.log('точка входа готова: src/entries/cut-edit.tsx'); process.exit(0); }
console.log('Открываю Remotion Studio: http://localhost:3000 (закрыть — Ctrl+C)');
const cli = path.resolve('node_modules/@remotion/cli/remotion-cli.js');
spawn(process.execPath, [cli, 'studio', 'src/entries/cut-edit.tsx'], {stdio: 'inherit'});
