import type React from 'react';
import '../kit/fonts';
import {FPS as TPL_FPS, SECONDS as TPL_SECONDS, TemplateReel} from './_template/Reel';
import {FPS as GEROY_FPS, SECONDS as GEROY_SECONDS, TemplateReel as GeroyReel} from './_geroy/Reel';
import {END31, FPS31, Reel31} from './laya31/Reel';
import {END32, FPS32, Reel32} from './artemis32/Reel';
import {DUR_RM_GH, FPS_RM_GH, ReelRmGhtricks} from './rm/ghtricks/Reel';
import {END_GH, FPS_GH, ReelGhTricks} from './ghtricks/Reel';
import {SwapSym, SYM_END} from './swap/Sym';
import {FPS_R20, FRAMES_R20, ReelRM20} from './rm/r20/Reel';
import {FPS as FPS_R39, FRAMES as FRAMES_R39, ReelRMr39} from './rm/r39/Reel';

// Реестр роликов «своим кодом» (когда формат не укладывается в движок стилей).
// Образцы набора перечислены здесь; ролики ученика лежат в src/mine/<slug>/Reel.tsx (их создаёт npm run new) и подключаются
// сами — этот файл при монтаже не правится. Кадр 1440×2560, частота — как в исходнике ученика, финал 1080p (2K и 4K по просьбе).
// Шаблоны: _template (половина экрана + окно в углу) и _geroy (стиль 21 ИСТОРИЯ С ГЕРОЕМ).
// Описание образцов: patterns/reels/<имя>/README.md.
export type ReelEntry = {id: string; component: React.FC; fps: number; seconds: number};

// Ролики ученика: каждая папка src/mine/<slug>/ с Reel.tsx — композиция с id = slug.
function mineReels(): ReelEntry[] {
  const ctx = require.context('../mine', true, /^\.\/[^/]+\/Reel\.tsx$/);
  return ctx.keys().map((key) => {
    const m = ctx(key);
    return {id: key.split('/')[1], component: m.TemplateReel ?? m.Reel, fps: m.FPS, seconds: m.SECONDS};
  });
}

export const REELS: ReelEntry[] = [
  {id: 'example-custom', component: TemplateReel, fps: TPL_FPS, seconds: TPL_SECONDS},
  // стиль 21 ИСТОРИЯ С ГЕРОЕМ (шаблон)
  {id: 'example-geroy', component: GeroyReel, fps: GEROY_FPS, seconds: GEROY_SECONDS},
  // стиль 14 ЛИНЗА
  {id: 'Lens-Laya', component: Reel31, fps: FPS31, seconds: END31},
  {id: 'Lens-Artemis', component: Reel32, fps: FPS32, seconds: END32},
  {id: 'Lens-GhTricks', component: ReelRmGhtricks, fps: FPS_RM_GH, seconds: DUR_RM_GH},
  // стиль 20 ЭСТАФЕТА 35% (CHROMA RELAY + полоса записи 35% внизу)
  {id: 'Relay-GhTricks', component: ReelGhTricks, fps: FPS_GH, seconds: END_GH},
  // стиль 19 СИМБИОЗ
  {id: 'Symbiosis-Swap', component: SwapSym, fps: 60, seconds: SYM_END},
  // стиль 13 ЭКСПЕРТ, вариант «доска» (перемонтажи 10.10.2026)
  {id: 'Expert2-Money', component: ReelRM20, fps: FPS_R20, seconds: FRAMES_R20 / FPS_R20},
  {id: 'Expert2-Unlazy', component: ReelRMr39, fps: FPS_R39, seconds: FRAMES_R39 / FPS_R39},
  // ролики ученика: src/mine/<slug>/Reel.tsx
  ...mineReels(),
];
