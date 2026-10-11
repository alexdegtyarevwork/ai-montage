import type {ProjectData, Word} from './demo';
import CHEREZ from './owner/cherez.json';
import FOTO from './owner/foto.json';
import GOLOS from './owner/golos.json';
import KONTAKT from './owner/kontakt.json';
import NALOZH from './owner/nalozh.json';
import SKORO from './owner/skoro.json';
import ZARUB from './owner/zarub.json';

// Демо-ролики владельца набора для превью стилей (npm run boards): его записи (public/demo/<id>.mp4), пословная
// расшифровка (owner/<id>.json) и смысловые блоки по речи. Каждому стилю — ролик по смыслу (STYLE_DEMO).
// В обычном монтаже не используются: только при входном параметре {demoRec: true}.
export type OwnerDemoId = 'nalozh' | 'foto' | 'cherez' | 'zarub' | 'golos' | 'kontakt' | 'skoro';

// написание имён, которые распознавание пишет на слух (словарь ПРАВИЛА/2 Субтитры.md)
const FIX: Record<string, string> = {chgpt: 'ChatGPT', clot: 'Claude', ee: 'ИИ', direct: 'Директ', капкад: 'CapCut', монтажерам: 'монтажёрам', монтажеры: 'монтажёры'};
const fix = (ws: Word[]): Word[] => ws.map((w) => {
  const m = w.text.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}-]+)([^\p{L}\p{N}]*)$/u);
  const to = m ? FIX[m[2].toLowerCase()] : undefined;
  return to && m ? {...w, text: m[1] + to + m[3]} : w;
});
const last = (ws: Word[]) => ws[ws.length - 1].end + 0.4;

// Запись: файл в public, размер и голова (центр лица по высоте, px исходника) — замер по кадрам 11.10.2026
export const DEMO_REC: Record<OwnerDemoId, {src: string; w: number; h: number; headY: number}> = {
  nalozh: {src: 'demo/nalozh.mp4', w: 720, h: 1280, headY: 545},
  foto: {src: 'demo/foto.mp4', w: 720, h: 1280, headY: 471},
  cherez: {src: 'demo/cherez.mp4', w: 1280, h: 720, headY: 237},
  zarub: {src: 'demo/zarub.mp4', w: 720, h: 1280, headY: 435},
  golos: {src: 'demo/golos.mp4', w: 720, h: 1280, headY: 636},
  kontakt: {src: 'demo/kontakt.mp4', w: 720, h: 1280, headY: 443},
  skoro: {src: 'demo/skoro.mp4', w: 720, h: 1280, headY: 605},
};

const W = {nalozh: fix(NALOZH), foto: fix(FOTO), cherez: fix(CHEREZ), zarub: fix(ZARUB), golos: fix(GOLOS), kontakt: fix(KONTAKT), skoro: fix(SKORO)};

export const OWNER_DEMOS: Record<OwnerDemoId, ProjectData> = {
  nalozh: {duration: last(W.nalozh), words: W.nalozh, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · наложения', at: 0, tone: 'light', lines: ['Не добавляй', 'наложения так'], strike: 'так', strikeAt: 3.0, object: 'scissors', kicker: 'наложения в CapCut'},
    {kind: 'list', id: 'old', label: '02 · устарело', at: 5.8, title: 'Так уже не делают', items: ['устарело', 'дешевит видео'], ticks: [6.8, 7.6]},
    {kind: 'flow', id: 'how', label: '03 · как надо', at: 14.9, title: 'Наложение под видео', nodes: [{label: 'картинка'}, {label: 'копия видео'}, {label: 'удалить фон'}]},
    {kind: 'list', id: 'mask', label: '04 · маска', at: 27.7, title: 'Для красоты', items: ['растушёвка краёв', 'затемнение', 'ключ в начале'], ticks: [30.5, 34.9, 39.0]},
    {kind: 'cta', id: 'cta', label: '05 · призыв', at: 44.0, note: 'Пиши в комменты', word: 'CapCut', typeAt: 44.6},
  ], plan: [{at: 14.9, to: 'compact'}, {at: 44.0, to: 'base'}]},
  foto: {duration: last(W.foto), words: W.foto, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · фото', at: 0, tone: 'light', lines: ['Все выкладывают', 'нейрофотосессии'], object: 'person', kicker: 'нейрофотосессия'},
    {kind: 'flow', id: 'site', label: '02 · сайт', at: 10.9, title: 'NeuroSphere', nodes: [{label: 'AI изображения'}, {label: 'фотостудия'}, {label: 'готовые идеи'}]},
    {kind: 'list', id: 'who', label: '03 · фото', at: 21.0, title: 'Загружаем своё фото', items: ['одному', 'с ребёнком', 'вместе с кем-то'], ticks: [22.4, 23.3, 24.4]},
    {kind: 'stat', id: 'fmt', label: '04 · формат', at: 25.3, value: 9, suffix: ' на 16', caption: 'нужный формат', countAt: 26.0},
    {kind: 'cta', id: 'cta', label: '05 · призыв', at: 31.9, note: 'Пиши в комменты', word: 'фотосессия', typeAt: 34.9},
  ], plan: [{at: 10.9, to: 'compact'}, {at: 31.9, to: 'base'}]},
  cherez: {duration: last(W.cherez), words: W.cherez, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · демо', at: 0, tone: 'light', lines: ['Возможности', 'монтажа нейросетей'], object: 'laptop', kicker: 'монтаж через ИИ'},
    {kind: 'logos', id: 'insta', label: '02 · профиль', at: 5.6, title: 'Мой профиль Instagram', logos: ['instagram']},
    {kind: 'list', id: 'split', label: '03 · презентация', at: 16.1, title: 'Экран на две части', items: ['презентация', 'фон слайда', 'motion графика'], ticks: [17.6, 19.3, 23.0]},
    {kind: 'flow', id: 'sound', label: '04 · звук', at: 24.3, title: 'Музыка и звук', nodes: [{label: 'музыка'}, {label: 'саунд-эффекты'}, {label: 'субтитры'}]},
    {kind: 'list', id: 'space', label: '05 · сцена', at: 34.6, title: 'Из комнаты в космос', items: ['Майнкрафт', 'камера вверх', 'планета в 3D'], ticks: [35.4, 38.4, 41.0]},
    {kind: 'cta', id: 'cta', label: '06 · призыв', at: 42.9, note: 'Пиши в комменты', word: 'нейронка', typeAt: 43.4},
  ], plan: [{at: 16.1, to: 'compact'}, {at: 42.9, to: 'base'}]},
  zarub: {duration: last(W.zarub), words: W.zarub, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · оплата', at: 0, tone: 'light', lines: ['Платить за', 'зарубежные сервисы'], object: 'coins', kicker: 'карты там не работают'},
    {kind: 'logos', id: 'tg', label: '02 · бот', at: 8.5, title: 'Telegram · заруб-робот', logos: ['telegram']},
    {kind: 'list', id: 'steps', label: '03 · шаги', at: 14.5, title: 'Карта с телефона', items: ['пополнить баланс', 'выпустить карту', 'оплатить сервис'], ticks: [16.0, 23.0, 39.5]},
    {kind: 'stat', id: 'price', label: '04 · цена', at: 25.1, value: 19, prefix: '$', caption: 'стоимость выпуска', countAt: 25.6},
    {kind: 'logos', id: 'store', label: '05 · App Store', at: 28.8, title: 'Работает даже в App Store', logos: ['apple']},
    {kind: 'cta', id: 'cta', label: '06 · итог', at: 39.0, note: 'Платёж проходит', word: 'пользуйся', typeAt: 42.3},
  ], plan: [{at: 14.5, to: 'compact'}, {at: 39.0, to: 'base'}]},
  golos: {duration: last(W.golos), words: W.golos, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · шум', at: 0, tone: 'light', lines: ['Посторонний шум', 'на записи'], object: 'mic', kicker: 'запись без петлички'},
    {kind: 'flow', id: 'easy', label: '02 · просто', at: 8.1, title: 'Убирается максимально просто', nodes: [{label: 'шум'}, {label: 'один тумблер'}, {label: 'чистый голос'}]},
    {kind: 'list', id: 'capcut', label: '03 · CapCut', at: 14.4, title: 'В CapCut', items: ['улучшение качества голоса', 'включаем тумблер'], ticks: [18.5, 22.1]},
    {kind: 'stat', id: 'hundred', label: '04 · до 100', at: 22.1, value: 100, caption: 'индикатор поднимаем до', countAt: 23.0},
    {kind: 'cta', id: 'cta', label: '05 · призыв', at: 25.8, note: 'Напиши в комменты', word: 'CapCut', typeAt: 26.2},
  ], plan: [{at: 8.1, to: 'compact'}, {at: 25.8, to: 'base'}]},
  kontakt: {duration: last(W.kontakt), words: W.kontakt, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · контракт', at: 0, tone: 'light', lines: ['Контракт', 'под давлением'], object: 'book', kicker: 'уважаемые родители'},
    {kind: 'list', id: 'son', label: '02 · что сказать', at: 8.1, title: 'Объясните сыну', items: ['не желает заключать контракт', 'не подписывать непонятное'], ticks: [16.5, 19.6]},
    {kind: 'flow', id: 'help', label: '03 · если давят', at: 23.7, title: 'Если давят', nodes: [{label: 'командование части'}, {label: 'военный прокурор'}, {label: 'военный адвокат'}]},
    {kind: 'list', id: 'early', label: '04 · чем раньше', at: 37.1, title: 'Чем раньше, тем лучше', items: ['отстаиваете права', 'с вами не связываются'], ticks: [40.3, 42.8]},
    {kind: 'cta', id: 'cta', label: '05 · призыв', at: 45.3, note: 'Остальное в описании', word: 'сохраняй', typeAt: 45.8},
  ], plan: [{at: 8.1, to: 'compact'}, {at: 45.3, to: 'base'}]},
  skoro: {duration: last(W.skoro), words: W.skoro, sfx: false, blocks: [
    {kind: 'hook', id: 'hook', label: '01 · монтажёры', at: 0, tone: 'light', lines: ['Монтажёры', 'будут не нужны'], object: 'scissors', kicker: 'нейронки научились'},
    {kind: 'stat', id: 'min', label: '02 · время', at: 2.6, value: 5, suffix: ' минут', caption: 'вместо нескольких часов', countAt: 3.2},
    {kind: 'logos', id: 'ai', label: '03 · нейронки', at: 8.0, title: 'ChatGPT и Claude', logos: ['openai', 'claude']},
    {kind: 'cta', id: 'cta', label: '04 · призыв', at: 13.5, note: 'Хочешь так же?', word: 'нейронка', typeAt: 16.4},
  ], plan: [{at: 8.0, to: 'compact'}, {at: 13.5, to: 'base'}]},
};

// стиль движка → ролик владельца по смыслу
export const STYLE_DEMO: Record<string, OwnerDemoId> = {
  TEMPLATE: 'nalozh', PRISM: 'foto', ORBIT: 'cherez', TRACE: 'zarub', PULSE: 'golos', GLASS: 'kontakt',
  PORTRAIT: 'skoro', APPLE: 'cherez', PODCAST: 'kontakt', EXPERT: 'zarub', LIQUID: 'golos',
};

// демо-проект стиля с записью владельца
export const ownerProject = (style: string): ProjectData => {
  const id = STYLE_DEMO[style] ?? 'skoro';
  const r = DEMO_REC[id];
  return {...OWNER_DEMOS[id], speaker: {src: r.src, w: r.w, h: r.h, headY: r.headY, muted: false}};
};
