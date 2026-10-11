import type {ProjectData} from '../template/demo';
import {DEMO} from '../template/demo';

// Реестр проектов на движке стилей: ролик = данные (слова из расшифровки + смысловые блоки) + выбранный стиль.
// Проекты ученика лежат в src/mine/<slug>/project.ts (их создаёт npm run new -- <slug> <СТИЛЬ>) и подключаются сами.
// id композиции = slug; стиль — CANVAS (1 КАНВАС), LIQUID (2 СТЕКЛО) или PRISM, ORBIT, TRACE, PULSE, GLASS, PORTRAIT,
// APPLE, PODCAST, EXPERT (5–13).
export type ProjectEntry = {id: string; style: string; project: ProjectData};

function mineProjects(): ProjectEntry[] {
  const ctx = require.context('../mine', true, /^\.\/[^/]+\/project\.ts$/);
  return ctx.keys().map((key) => {
    const m = ctx(key);
    return {id: key.split('/')[1], style: String(m.STYLE).toUpperCase(), project: m.PROJECT};
  });
}

export const PROJECTS: ProjectEntry[] = [
  {id: 'example-prism', style: 'PRISM', project: DEMO},
  ...mineProjects(),
];
