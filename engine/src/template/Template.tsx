import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../montage/Captions';
import {autoCues, seedOf, Sounds} from '../sound';
import {E, k} from '../montage/parts';
import {FORMATS, type FormatId} from '../formats';
import {BlockView, cursorOf} from './blocks';
import {AgentCursor, camAt, FormatProvider, pressAt, toScreen, track, worldStyle, type CamKey} from './canvas';
import {cardRect, center, CardSpark, Connector, Desk, layoutPages, linkOf, linkPoint, PageLabel, Sheet} from './desk';
import {DEMO, type ProjectData} from './demo';
import {Speaker} from './Speaker';
import {demoOn} from '../demoRec';
import {ownerProject} from './ownerDemo';

// Превью стилей (demoRec): холст КАНВАС на ролике владельца (ownerDemo.ts), иначе — обычное демо.
const ownerDemoRec = (): ProjectData | null => (demoOn() ? ownerProject('TEMPLATE') : null);

// Шаблон «сценарный канвас»: смысловые блоки — карточки на одном столе, камера едет от карточки к карточке по пунктиру,
// который тянет курсор агента; приехавшая карточка вспыхивает неоном, по кромке бежит комета.
// Формат — props.format: 'reels' (1440×2560) или 'youtube' (2560×1440). Данные ролика — props.project.
export type TemplateProps = {format: FormatId; project?: ProjectData; qa?: boolean};

const TRAVEL = 0.65;          // длина переезда камеры, с

export const calcTemplate: CalculateMetadataFunction<TemplateProps> = ({props}) => {
  const f = FORMATS[props.format];
  const p = props.project ?? ownerDemoRec() ?? DEMO;
  const fps = p.fps ?? f.fps; // частота исходника ученика (meta.json)
  return {width: f.w, height: f.h, fps, durationInFrames: Math.round(p.duration * fps)};
};

// Первый блок с кадра 0 показан «уже въехавшим» (время блока не меньше 1,2 с): пустой первый кадр запрещён.
export const Template: React.FC<TemplateProps> = ({format, project: given}) => {
  const project = given ?? ownerDemoRec() ?? DEMO;
  const f = FORMATS[format];
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const blocks = project.blocks;
  const pages = layoutPages(f, blocks);
  const links = pages.slice(1).map((p, i) => linkOf(f, pages[i], p));

  // Камера: стоит на карточке, за TRAVEL секунд до следующего блока — рывок к следующей.
  const keys: CamKey[] = [[0, center(f, pages[0]).cx, center(f, pages[0]).cy, 1]];
  pages.slice(1).forEach((p, i) => {
    const prev = center(f, pages[i]), c = center(f, p);
    keys.push([p.at - TRAVEL, prev.cx, prev.cy, 1], [p.at, c.cx, c.cy, 1]);
  });
  const cam = camAt(t, keys);
  const cur = Math.max(0, pages.findIndex((p, i) => t < (pages[i + 1]?.at ?? 1e9)));
  const hot = (p: (typeof pages)[number]) => {
    const flash = k(t, p.at - 0.15, p.at + 0.25) * (1 - k(t, p.at + 0.8, p.at + 1.8, E.inOut));
    return Math.max(flash, p.id === pages[cur].id ? 0.3 : 0);
  };

  // Курсор: внутри блока — по своему пути, на переезде — едет на острие пунктира.
  let cursor: {x: number; y: number; clicks: number[]};
  const travel = pages.findIndex((p, i) => i > 0 && t >= p.at - TRAVEL && t < p.at);
  if (travel > 0) {
    const [x, y] = linkPoint(links[travel - 1], k(t, pages[travel].at - TRAVEL, pages[travel].at, (v) => v));
    cursor = {x, y, clicks: []};
  } else {
    const p = pages[cur], c = cursorOf(blocks[cur], cardRect(f, p));
    const pt = track(t, c.pts);
    cursor = {x: p.x + pt.x, y: p.y + pt.y, clicks: c.clicks};
  }
  const sp = toScreen(f, cam, cursor.x, cursor.y);
  // пока курсор щёлкает пункты списка, метка «Claude» прячется — иначе закрывает текст пунктов
  const cb = blocks[cur];
  const busy = travel <= 0 && cb.kind === 'list' && t > cb.ticks[0] - 0.35 && t < cb.ticks[cb.ticks.length - 1] + 0.25;

  // звук по ПРАВИЛА/5 Звук.md (src/sound.tsx): вуш на перелёте камеры к карточке, дальше — на каждое действие в карточке
  const cues = [...(project.sfx === false ? [] : autoCues(blocks, (b) => b.at - TRAVEL * 0.4)), ...(project.cues ?? [])];

  return (
    <FormatProvider value={f}>
      <AbsoluteFill style={{background: '#0B0D10', overflow: 'hidden'}}>
        <div style={worldStyle(f, cam)}>
          <Desk pages={pages} cx={cam.cx} cy={cam.cy} s={cam.s} hot={hot} />
          {links.map((l, i) => {
            const at = pages[i + 1].at;
            return <Connector key={i} l={l} draw={k(t, at - TRAVEL, at, (v) => v)} ghost={t < at - TRAVEL ? 0.6 : 0} />;
          })}
          {pages.map((p, i) => (Math.abs(i - cur) <= 1 ? (
            <Sheet key={p.id} pages={pages} p={p} hot={hot}>
              <BlockView t={i === 0 ? Math.max(t, 1.2) : t} b={blocks[i]} r={cardRect(f, p)} light={p.tone === 'light'} />
            </Sheet>
          ) : null))}
          {pages.map((p) => <PageLabel key={`l${p.id}`} p={p} />)}
          {pages.map((p) => <CardSpark key={`s${p.id}`} p={p} g={t > p.at - 0.1 && t < p.at + 0.9 ? 1 - k(t, p.at - 0.1, p.at + 0.9, (v) => v) : 0} />)}
        </div>
        <AgentCursor x={sp.x} y={sp.y} press={pressAt(t, cursor.clicks)} ripple={cursor.clicks} t={t} edge={f.w - 320} tag={!busy} />
        {project.voice ? <Audio src={staticFile(project.voice)} /> : null}
        {project.music ? <Audio src={staticFile(project.music)} /> : null}
        <Captions t={t} words={project.words} cx={f.captions.cx} cy={f.captions.cy} maxW={f.captions.maxW} size={f.captions.size} frameW={f.w} frameH={f.h} accent={project.accent} />
        <Speaker t={t} plan={project.plan} video={project.speaker} />
        <Sounds cues={cues} seed={seedOf(project.words.map((w) => w.text).join(' ') + project.duration)} />
      </AbsoluteFill>
    </FormatProvider>
  );
};
