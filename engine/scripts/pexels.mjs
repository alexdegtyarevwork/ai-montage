// Поиск и загрузка стоковых видео/фото Pexels (ключ PEXELS_API_KEY в .env, в git не идёт).
//   node scripts/pexels.mjs video "<запрос>" <out.mp4> [--orientation portrait] [--pick 0] [--minw 1080]
//   node scripts/pexels.mjs photo "<запрос>" <out.jpg> [--orientation portrait] [--pick 0]
//   node scripts/pexels.mjs list-video "<запрос>"   — показать варианты (id, длительность, размер, автор)
// Рядом пишется <out>.source.txt: ссылка на страницу Pexels и автор (для ASSET_SOURCES.md).
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
if (existsSync('.env')) for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.error('нет PEXELS_API_KEY в .env'); process.exit(2); }
const [mode, query, out, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const orientation = opt('orientation', 'portrait'), pick = +opt('pick', 0), minw = +opt('minw', 1080);
const api = async (u) => { const r = await fetch(u, {headers: {Authorization: KEY}}); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const q = encodeURIComponent(query);
if (mode === 'list-video' || mode === 'video') {
  const j = await api(`https://api.pexels.com/videos/search?query=${q}&orientation=${orientation}&per_page=15&size=medium`);
  if (mode === 'list-video') { j.videos.forEach((v, i) => console.log(i, v.id, `${v.duration}s`, `${v.width}x${v.height}`, v.user.name, v.url)); process.exit(0); }
  const v = j.videos[pick]; if (!v) { console.error('нет результата'); process.exit(1); }
  const files = v.video_files.filter((f) => f.file_type === 'video/mp4' && f.width).sort((a, b) => a.width - b.width);
  const f = files.find((f) => Math.min(f.width, f.height) >= minw) ?? files[files.length - 1];
  const buf = Buffer.from(await (await fetch(f.link)).arrayBuffer());
  mkdirSync(path.dirname(out), {recursive: true}); writeFileSync(out, buf);
  writeFileSync(out + '.source.txt', `Pexels video ${v.id} by ${v.user.name}\n${v.url}\nquery: ${query}\nfile: ${f.width}x${f.height} ${v.duration}s\n`);
  console.log(`готово: ${out} ${f.width}x${f.height} ${v.duration}s — ${v.url}`);
} else if (mode === 'photo' || mode === 'list-photo') {
  const j = await api(`https://api.pexels.com/v1/search?query=${q}&orientation=${orientation}&per_page=15`);
  if (mode === 'list-photo') { j.photos.forEach((p, i) => console.log(i, p.id, `${p.width}x${p.height}`, p.photographer, p.alt, p.url)); process.exit(0); }
  const p = j.photos[pick]; if (!p) { console.error('нет результата'); process.exit(1); }
  const buf = Buffer.from(await (await fetch(p.src.large2x)).arrayBuffer());
  mkdirSync(path.dirname(out), {recursive: true}); writeFileSync(out, buf);
  writeFileSync(out + '.source.txt', `Pexels photo ${p.id} by ${p.photographer}\n${p.url}\nquery: ${query}\n`);
  console.log(`готово: ${out} — ${p.url}`);
} else { console.error('режим: video | photo | list-video | list-photo'); process.exit(2); }
