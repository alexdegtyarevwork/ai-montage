// Поиск и загрузка стоковых видео/фото Pixabay — сток по умолчанию (ключ PIXABAY_API_KEY в .env, в git не идёт).
// Pexels — scripts/pexels.mjs, только если ученик сам попросил Pexels и дал ключ.
//   node scripts/pixabay.mjs list-video "<запрос>"              показать варианты (номер, id, длительность, размер, автор)
//   node scripts/pixabay.mjs video "<запрос>" <out.mp4> [--pick 0] [--minw 1080]
//   node scripts/pixabay.mjs list-photo "<запрос>"
//   node scripts/pixabay.mjs photo "<запрос>" <out.jpg> [--pick 0] [--orientation vertical|horizontal|all]
// Рядом пишется <out>.source.txt: ссылка на страницу Pixabay и автор.
// Pixabay ищет лучше по-английски. Вертикальные видео в выдаче идут первыми.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
if (existsSync('.env')) for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) { console.error('нет PIXABAY_API_KEY в engine/.env: бесплатный ключ — pixabay.com/api/docs (после входа на сайт)'); process.exit(2); }
const [mode, query, out, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const pick = +opt('pick', 0), minw = +opt('minw', 1080), orientation = opt('orientation', 'vertical');
if (!query) { console.error('режим: video | photo | list-video | list-photo, затем "<запрос>"'); process.exit(2); }
const q = encodeURIComponent(query.slice(0, 100));
const api = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Pixabay ответил ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); };
const save = async (url, file) => {
  const r = await fetch(url); if (!r.ok) throw new Error(`файл не скачался: ${r.status}`);
  mkdirSync(path.dirname(file), {recursive: true}); writeFileSync(file, Buffer.from(await r.arrayBuffer()));
};

if (mode === 'list-video' || mode === 'video') {
  const j = await api(`https://pixabay.com/api/videos/?key=${KEY}&q=${q}&per_page=30&safesearch=true`);
  const best = (v) => Object.values(v.videos).filter((f) => f && f.url && f.width);
  const tall = (v) => { const f = best(v)[0]; return f && f.height > f.width ? 0 : 1; };
  const hits = [...j.hits].sort((a, b) => tall(a) - tall(b));
  if (mode === 'list-video') {
    hits.forEach((v, i) => { const f = best(v)[0]; console.log(i, v.id, `${v.duration}s`, f ? `${f.width}x${f.height}` : '?', v.user, v.pageURL); });
    process.exit(0);
  }
  const v = hits[pick]; if (!v) { console.error('нет результата'); process.exit(1); }
  const files = best(v).sort((a, b) => a.width - b.width);
  const f = files.find((f) => Math.min(f.width, f.height) >= minw) ?? files[files.length - 1];
  await save(f.url, out);
  writeFileSync(out + '.source.txt', `Pixabay video ${v.id} by ${v.user}\n${v.pageURL}\nquery: ${query}\nfile: ${f.width}x${f.height} ${v.duration}s\n`);
  console.log(`готово: ${out} ${f.width}x${f.height} ${v.duration}s — ${v.pageURL}`);
} else if (mode === 'list-photo' || mode === 'photo') {
  const j = await api(`https://pixabay.com/api/?key=${KEY}&q=${q}&image_type=photo&orientation=${orientation}&per_page=30&safesearch=true`);
  if (mode === 'list-photo') { j.hits.forEach((p, i) => console.log(i, p.id, `${p.imageWidth}x${p.imageHeight}`, p.user, p.tags, p.pageURL)); process.exit(0); }
  const p = j.hits[pick]; if (!p) { console.error('нет результата'); process.exit(1); }
  await save(p.largeImageURL, out);
  writeFileSync(out + '.source.txt', `Pixabay photo ${p.id} by ${p.user}\n${p.pageURL}\nquery: ${query}\n`);
  console.log(`готово: ${out} — ${p.pageURL}`);
} else { console.error('режим: video | photo | list-video | list-photo'); process.exit(2); }
