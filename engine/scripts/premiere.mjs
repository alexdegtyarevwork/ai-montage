// Нарезка для ручной правки в Adobe Premiere Pro (Mac и Windows): XML-проект (формат FCP7, Premiere его импортирует).
//   node scripts/premiere.mjs <slug> [--out <файл.xml>] [--open]
//   --open: открыть Premiere Pro с этим файлом — только по просьбе ученика и только если Premiere установлен
//   (нет программы — файл всё равно сохранён, в ответе premiere: false; взамен ничего не открывать).
// На таймлайне — те же куски, что в нарезке (work/<slug>/cut.json), но каждый ссылается на ПОЛНУЮ запись
// (public/work/<slug>/speaker.mp4 и voice.wav): стыки можно растягивать (Ripple Edit, клавиши Q/W/B).
// Запись уже повёрнута и обрезана до 9:16 при приёме (prep), поэтому поворот iPhone Premiere не ломает.
// Открыть: Premiere → Файл → Импорт (Ctrl/⌘+I) → этот XML. Если файл «не в сети» — указать speaker.mp4 из той же папки.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';

const [slug, ...rest] = process.argv.slice(2);
if (!slug) { console.error('Использование: npm run cut:premiere -- <slug> [--out файл.xml]'); process.exit(2); }
const oi = rest.indexOf('--out');
const dir = path.join('public', 'work', slug), cutFile = path.join('work', slug, 'cut.json');
const out = oi >= 0 ? rest[oi + 1] : path.join('work', slug, `${slug}-premiere.xml`);
const video = path.resolve(dir, 'speaker.mp4'), audio = path.resolve(dir, 'voice.wav');
for (const f of [cutFile, video, audio]) if (!existsSync(f)) { console.error(`нет ${f}: сначала npm run prep и npm run cut`); process.exit(1); }
const {intervals} = JSON.parse(readFileSync(cutFile, 'utf8'));
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,channels,sample_rate:format=duration', '-of', 'json', video], {encoding: 'utf8'}).stdout);
const v = probe.streams.find((s) => s.codec_type === 'video');
const [fa, fb] = v.r_frame_rate.split('/').map(Number), fps = fa / (fb || 1);
const ntsc = Math.abs(fps - Math.round(fps)) > 0.01, tb = Math.round(fps);
const aProbe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=channels,sample_rate', '-of', 'json', audio], {encoding: 'utf8'}).stdout).streams[0];
const fileDur = Math.round(Number(probe.format.duration) * fps);
const url = (p) => pathToFileURL(p).href.replace(/^file:\/\/\//, 'file://localhost/');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rate = `<rate><timebase>${tb}</timebase><ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
let pos = 0;
const vClips = [], aClips = [];
intervals.forEach(({start, end}, i) => {
  const inF = Math.round(start * fps), outF = Math.max(inF + 1, Math.round(end * fps)), len = outF - inF, n = i + 1;
  const link = `<link><linkclipref>v${n}</linkclipref><mediatype>video</mediatype></link><link><linkclipref>a${n}</linkclipref><mediatype>audio</mediatype></link>`;
  const vFile = i === 0
    ? `<file id="fv"><name>speaker.mp4</name><pathurl>${esc(url(video))}</pathurl>${rate}<duration>${fileDur}</duration><media><video><samplecharacteristics>${rate}<width>${v.width}</width><height>${v.height}</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></video></media></file>`
    : '<file id="fv"/>';
  const aFile = i === 0
    ? `<file id="fa"><name>voice.wav</name><pathurl>${esc(url(audio))}</pathurl>${rate}<duration>${fileDur}</duration><media><audio><samplecharacteristics><depth>16</depth><samplerate>${aProbe.sample_rate}</samplerate></samplecharacteristics><channelcount>${aProbe.channels}</channelcount></audio></media></file>`
    : '<file id="fa"/>';
  vClips.push(`<clipitem id="v${n}"><name>кусок ${n}</name><duration>${fileDur}</duration>${rate}<start>${pos}</start><end>${pos + len}</end><in>${inF}</in><out>${outF}</out>${vFile}${link}</clipitem>`);
  aClips.push(`<clipitem id="a${n}"><name>кусок ${n}</name><duration>${fileDur}</duration>${rate}<start>${pos}</start><end>${pos + len}</end><in>${inF}</in><out>${outF}</out>${aFile}<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>${link}</clipitem>`);
  pos += len;
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
<sequence id="seq"><name>${esc(slug)} — нарезка</name><duration>${pos}</duration>${rate}
<media>
<video><format><samplecharacteristics>${rate}<width>${v.width}</width><height>${v.height}</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>
<track>
${vClips.join('\n')}
</track></video>
<audio><numOutputChannels>2</numOutputChannels>
<track>
${aClips.join('\n')}
</track></audio>
</media>
</sequence>
</xmeml>
`;
mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
writeFileSync(out, xml);
console.log(`готово: ${out} — кусков: ${intervals.length}, ${(pos / fps).toFixed(2)} с, ${tb} к/с. Premiere → Файл → Импорт → этот файл.`);

// Premiere Pro на этом компьютере: самая новая установленная версия или null
function findPremiere() {
  if (process.platform === 'darwin') {
    const dirs = existsSync('/Applications') ? readdirSync('/Applications').filter((d) => /^Adobe Premiere Pro/.test(d)).sort().reverse() : [];
    for (const d of dirs) {
      const app = path.join('/Applications', d, `${d}.app`);
      if (existsSync(app)) return app;
    }
    return null;
  }
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramW6432']].filter(Boolean)) {
      const adobe = path.join(root, 'Adobe');
      if (!existsSync(adobe)) continue;
      for (const d of readdirSync(adobe).filter((x) => /^Adobe Premiere Pro/.test(x)).sort().reverse()) {
        const exe = path.join(adobe, d, 'Adobe Premiere Pro.exe');
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}
if (rest.includes('--open')) {
  const app = findPremiere();
  if (!app) {
    console.log(JSON.stringify({ok: true, premiere: false, xml: out, hint: 'Premiere Pro нет: молча пропусти, ученику ничего не говорить'}));
  } else {
    const xml = path.resolve(out);
    // программа открывается отдельно и живёт дальше без этой команды
    const p = process.platform === 'darwin' ? spawn('open', ['-a', app, xml], {detached: true, stdio: 'ignore'}) : spawn(app, [xml], {detached: true, stdio: 'ignore'});
    p.unref();
    console.log(JSON.stringify({ok: true, premiere: true, app, xml, hint: 'Premiere открывается; если нарезка не появилась сама — Файл → Импорт → этот XML'}));
  }
}
