// Новый ролик: npm run new -- <slug> <стиль>
//   стиль: custom — свой ролик по шаблону «половина экрана + окно в углу»; geroy — шаблон стиля 21 ИСТОРИЯ С ГЕРОЕМ;
//          CANVAS (1 КАНВАС), LIQUID (2 СТЕКЛО), PRISM, ORBIT, TRACE, PULSE, GLASS, PORTRAIT, APPLE, PODCAST, EXPERT (5–13) — движок стилей.
// Создаёт work/<slug>/ (бриф, карта монтажа, пакет на выкладку), public/work/<slug>/ для записей и код ролика в src/mine/<slug>/
// (Reel.tsx или project.ts). Студия находит ролик сама: общие файлы набора не правятся, обновление их не задевает.
// slug — любое имя латиницей, цифрами и дефисами (можно с цифры: 5-oshibok); пробелы и прочее заменяются дефисом.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {cpSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {linkProject} from './link-project.mjs';

const [rawSlug, styleArg] = process.argv.slice(2);
const ENGINE = ['CANVAS', 'LIQUID', 'PRISM', 'ORBIT', 'TRACE', 'PULSE', 'GLASS', 'PORTRAIT', 'APPLE', 'PODCAST', 'EXPERT'];
const TEMPLATES = {CUSTOM: '_template', GEROY: '_geroy'};
const slug = String(rawSlug ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
if (slug === 'styles') { console.error('имя «styles» занято: в src/mine/styles лежат свои стили ученика — выбери другое'); process.exit(1); }
if (!slug || !styleArg) {
  console.error('Использование: npm run new -- <slug латиницей> <стиль>\nСтили: custom, geroy, ' + ENGINE.join(', '));
  process.exit(1);
}
const style = styleArg.toUpperCase();
if (!TEMPLATES[style] && !ENGINE.includes(style)) { console.error(`Неизвестный стиль ${styleArg}. Есть: custom, geroy, ${ENGINE.join(', ')}`); process.exit(1); }
const mine = path.join('src', 'mine', slug);
if (existsSync(mine)) { console.error(`Ролик уже есть: ${mine}`); process.exit(1); }
const work = path.join('work', slug);
mkdirSync(work, {recursive: true});
mkdirSync(path.join('public', 'work', slug), {recursive: true});
for (const f of ['brief.json', 'DIRECTION.md', 'PUBLISH.md']) if (!existsSync(path.join(work, f))) cpSync(path.join('templates', f), path.join(work, f));
if (!existsSync(path.join(work, 'SCRIPT.md'))) cpSync(path.join('templates', 'SCRIPT.md'), path.join(work, 'SCRIPT.md'));
mkdirSync(mine, {recursive: true});

if (TEMPLATES[style]) {
  cpSync(path.join('src', 'reels', TEMPLATES[style]), mine, {recursive: true});
  console.log(`Свой ролик: ${mine}/Reel.tsx (${style === 'GEROY' ? 'шаблон стиля 21 ИСТОРИЯ С ГЕРОЕМ' : 'шаблон «половина экрана + окно в углу»'}), композиция «${slug}» в папке Reels.`);
} else {
  writeFileSync(path.join(mine, 'project.ts'), `import type {ProjectData} from '../../template/demo';
import {DEMO} from '../../template/demo';

// Проект «${slug}» на движке стилей. Сменить стиль — поменять STYLE: CANVAS (1 КАНВАС), LIQUID (2 СТЕКЛО),
// PRISM, ORBIT, TRACE, PULSE, GLASS, PORTRAIT, APPLE, PODCAST, EXPERT (5–13).
// Заполни по карте монтажа work/${slug}/DIRECTION.md: blocks — смысловые блоки (hook, list, stat, logos, flow, cta)
// с временем начала at по словам речи; plan — смены окна спикера по времени. Голос, запись, слова и частоту подставляет блок ниже.
export const STYLE = '${style}';

// >>> файлы проекта: дописывают npm run prep, cut и transcribe (руками не править)
const LINK: Partial<ProjectData> = {};
// <<<

export const PROJECT: ProjectData = {...DEMO, ...LINK, blocks: DEMO.blocks, plan: DEMO.plan};
`);
  console.log(`Проект на движке стилей: ${mine}/project.ts, стиль ${style}, композиция «${slug}» в папке Projects.`);
}
linkProject(slug);
console.log(`Материалы проекта: ${work}/ (бриф, карта монтажа, пакет на выкладку). Записи и картинки: public/work/${slug}/.`);
console.log(JSON.stringify({ok: true, slug}));
