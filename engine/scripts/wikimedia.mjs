// Фото героя истории со свободной лицензией (Wikimedia Commons). Автора и лицензию указать в описании ролика.
//   node scripts/wikimedia.mjs search "<имя или тема>"        — список файлов: номер, размер, лицензия, автор
//   node scripts/wikimedia.mjs get "<File:Название.jpg>" <out.jpg> — скачать (ширина до 1600) + <out>.source.txt
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const [mode, q, out] = process.argv.slice(2);
const UA = {'User-Agent': 'ai-montage-course/1.0 (video editing kit)'};
const API = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&';
const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const get = async (u) => { const r = await fetch(API + u, {headers: UA}); if (!r.ok) throw new Error(`${r.status}`); return r.json(); };
const info = (p) => { const ii = p.imageinfo?.[0] ?? {}, m = ii.extmetadata ?? {};
  return {title: p.title, w: ii.width, h: ii.height, license: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value), page: ii.descriptionurl, thumb: ii.thumburl || ii.url}; };
if (mode === 'search' && q) {
  const j = await get(`action=query&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index).map(info);
  if (!pages.length) { console.log('ничего не найдено'); process.exit(1); }
  pages.forEach((p, i) => console.log(`${i}  ${p.title}  ${p.w}x${p.h}  ${p.license}  ${p.author}`));
} else if (mode === 'get' && q && out) {
  const j = await get(`action=query&titles=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const p = info(Object.values(j.query.pages)[0]);
  if (!p.thumb) { console.error('файл не найден'); process.exit(1); }
  const buf = Buffer.from(await (await fetch(p.thumb, {headers: UA})).arrayBuffer());
  mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  writeFileSync(out, buf);
  writeFileSync(out + '.source.txt', `${p.title}\nАвтор: ${p.author}\nЛицензия: ${p.license}\n${p.page}\n`);
  console.log(`готово: ${out} — ${p.license}, ${p.author}`);
} else { console.error('режим: search "<запрос>" | get "<File:…>" <out.jpg>'); process.exit(2); }
