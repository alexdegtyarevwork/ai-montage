import type {StyleDef, StyleProps} from './engine';
import {StyleReel} from './engine';
import {PRISM} from './prism';
import {ORBIT} from './orbit';
import {TRACE} from './trace';
import {PULSE} from './pulse';
import {GLASS} from './glass';
import {PORTRAIT} from './portrait';
import {APPLE} from './apple';
import {PODCAST} from './podcast';
import {EXPERT, expertDemo} from './expert';
import {LIQUID} from './liquid';
import {DEMO, type ProjectData} from '../template/demo';
import {demoOn} from '../demoRec';
import {ownerProject} from '../template/ownerDemo';

// Реестр стилей режима «сцены» (паттерны 2 и 5–13 каталога patterns/README.md, перенесённые на Remotion).
// demo — свои демо-данные стиля, если ему нужно то, чего нет в общем демо (у ЭКСПЕРТА — снимок сервиса).
const ALL: {id: string; def: StyleDef; demo?: ProjectData}[] = [
  {id: 'PRISM', def: PRISM},
  {id: 'ORBIT', def: ORBIT},
  {id: 'TRACE', def: TRACE},
  {id: 'PULSE', def: PULSE},
  {id: 'GLASS', def: GLASS},
  {id: 'PORTRAIT', def: PORTRAIT},
  {id: 'APPLE', def: APPLE},
  {id: 'PODCAST', def: PODCAST},
  {id: 'EXPERT', def: EXPERT, demo: expertDemo(DEMO)},
  {id: 'LIQUID', def: LIQUID},     // 2 СТЕКЛО
  ...mineStyles(),
];
// стиль ученика с тем же id стоит в списке позже и заменяет стиль набора
export const STYLES = [...new Set(ALL.map((s) => s.id))].map((id) => ALL.filter((s) => s.id === id).pop()!);

// Свои стили ученика: src/mine/styles/<ID>.tsx с `export const ID = 'LIQUID'` и `export const STYLE: StyleDef`.
// ID — латиница, цифры и дефис (APPLE-AI); другие знаки движок выбросит.
// Тот же id, что у стиля набора, — версия ученика заменяет стиль набора (копия, которую он поправил под себя);
// новый id — новый стиль. Файлы набора при этом не правятся, поэтому обновление с GitHub их не задевает.
function mineStyles(): {id: string; def: StyleDef; demo?: ProjectData}[] {
  const ctx = require.context('../mine', true, /^\.\/styles\/[^/]+\.tsx$/);
  return ctx.keys().map((key) => {
    const m = ctx(key);
    // id композиции Remotion — только латиница, цифры и дефис: 'APPLE_AI' → 'APPLEAI' (иначе студия падает)
    return {id: String(m.ID ?? key.replace(/^.*\/|\.tsx$/g, '')).toUpperCase().replace(/[^A-Z0-9-]/g, ''), def: m.STYLE, demo: m.DEMO};
  }).filter((s) => s.def);
}
// Превью стилей (demoRec): демо стиля идёт по ролику владельца, подобранному по смыслу (ownerDemo.ts, STYLE_DEMO).
const withDemoRec = (id: string, demo?: ProjectData): ProjectData | undefined => (demoOn() && id ? ownerProject(id) : demo);
export const reelOf = (def: StyleDef, demo?: ProjectData, id = ''): React.FC<StyleProps> => (p) => <StyleReel {...p} project={withDemoRec(id, p.project ?? demo ?? DEMO)} style={def} />;
