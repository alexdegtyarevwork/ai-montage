import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction} from 'remotion';
import {Audio} from '@remotion/media';
import {linearTiming, TransitionSeries, type TransitionPresentation} from '@remotion/transitions';
import {Captions} from '../montage/Captions';
import {autoCues, FIRST_READY, seedOf, Sounds, type Cue} from '../sound';
import {FORMATS, type Box, type Format, type FormatId} from '../formats';
import {FormatProvider} from '../template/canvas';
import type {BlockData} from '../template/blocks';
import {DEMO, type ProjectData} from '../template/demo';
import {SpeakerLayer, type SpeakerMode} from './speaker';
import {demoOn} from '../demoRec';
import {ownerProject} from '../template/ownerDemo';

// Движок стилей режима «сцены». Данные ролика те же, что у шаблона КАНВАС (project.blocks), а стиль задаёт, как каждый
// блок выглядит и движется, какой фон у сцены, каким переходом сцены сменяются и где стоит спикер.
// Сцена i идёт с секунды blocks[i].at; переход съедает TRANS секунд в начале новой сцены, поэтому смена фона попадает
// ровно на фразу. Спикер, субтитры и звук лежат поверх сцен — переходы их не задевают.
// Звук — по ПРАВИЛА/5 Звук.md для всех стилей одинаково (src/sound.tsx): разные звуки каталога почти на каждое видимое
// действие, вуш на каждой смене сцены, нарастание кончается на цифре. Свои звуки — project.cues, без автоматических —
// project.sfx = false; музыка — project.music (music-bed.wav), цвет выделения субтитров — project.accent.
export const TRANS = 0.5;

export type SceneProps = {t: number; b: BlockData; i: number; f: Format; zone: Box; project: ProjectData};
export type CaptionSpec = {cx: number; cy: number; maxW: number; size: number; light?: boolean};
export type StyleDef = {
  id: string;
  speaker: SpeakerMode;
  zone: (f: Format, i: number) => Box;
  captions: (f: Format) => CaptionSpec;
  Background: React.FC<{t: number; i: number; b: BlockData; f: Format; project: ProjectData}>;
  Scene: React.FC<SceneProps>;
  transition: (i: number, f: Format) => TransitionPresentation<Record<string, unknown>>;
  sfx?: {move: string; pop: string; tick: string; count: string};   // устарело: звук ставит src/sound.tsx по правилам набора
  Overlay?: React.FC<{t: number; f: Format}>;   // слой поверх спикера: шов, затемнение, рамка
};
export type StyleProps = {format: FormatId; project?: ProjectData; demoStyle?: string};

export const calcStyle: CalculateMetadataFunction<StyleProps> = ({props}) => {
  const f = FORMATS[props.format];
  // превью стилей (demoRec) идут по ролику владельца — у него своя длительность
  const p = demoOn() && props.demoStyle ? ownerProject(props.demoStyle) : props.project ?? DEMO;
  // частота — как в исходнике ученика (meta.json), без записи — частота формата
  const fps = p.fps ?? f.fps;
  return {width: f.w, height: f.h, fps, durationInFrames: Math.round(p.duration * fps)};
};

const SceneShell: React.FC<{style: StyleDef; b: BlockData; i: number; f: Format; start: number; project: ProjectData}> = ({style, b, i, f, start, project}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Кадр 0 не бывает пустым: первая сцена с первого кадра показана «уже въехавшей» (время не меньше FIRST_READY),
  // дальше идёт как обычно. Субтитры и звуки живут вне сцены и привязаны к речи, их это не сдвигает.
  const t = i === 0 ? Math.max(start + frame / fps, FIRST_READY) : start + frame / fps;
  const {Background, Scene} = style;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Background t={t} i={i} b={b} f={f} project={project} />
      <Scene t={t} b={b} i={i} f={f} zone={style.zone(f, i)} project={project} />
    </AbsoluteFill>
  );
};

// Вуш на смене сцены: самое громкое место — посреди перехода.
export const cuesOf = (project: ProjectData): Cue[] => [
  ...(project.sfx === false ? [] : autoCues(project.blocks, (b) => b.at + TRANS * 0.3)),
  ...(project.cues ?? []),
];

export const StyleReel: React.FC<StyleProps & {style: StyleDef}> = ({style, format, project = DEMO}) => {
  const f = FORMATS[format];
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const blocks = project.blocks;
  const T = Math.round(TRANS * fps);
  const total = Math.round(project.duration * fps), startF = blocks.map((b, i) => (i === 0 ? 0 : Math.round(b.at * fps)));
  const cap = style.captions(f);
  const cur = Math.max(0, blocks.findIndex((b, i) => t < (blocks[i + 1]?.at ?? 1e9)));
  return (
    <FormatProvider value={f}>
      <AbsoluteFill style={{background: '#0B0D10'}}>
        <TransitionSeries>
          {blocks.flatMap((b, i) => {
            const start = i === 0 ? 0 : b.at;
            // в кадрах: сцена i начинается ровно на кадре blocks[i].at, последняя доходит до последнего кадра ролика
            // (при 25 к/с переход 0,5 с = 12,5 кадра, округление съедало по полкадра на стык — в конце был пустой кадр)
            const from = startF[i], to = i < blocks.length - 1 ? startF[i + 1] + T : total;
            const seq = (
              <TransitionSeries.Sequence key={`s${b.id}`} durationInFrames={Math.max(T + 1, to - from)}>
                <SceneShell style={style} b={b} i={i} f={f} start={start} project={project} />
              </TransitionSeries.Sequence>
            );
            return i === 0 ? [seq] : [<TransitionSeries.Transition key={`t${b.id}`} presentation={style.transition(i, f)} timing={linearTiming({durationInFrames: T})} />, seq];
          })}
        </TransitionSeries>
        <SpeakerLayer mode={style.speaker} t={t} f={f} i={cur} blocks={blocks} project={project} />
        {style.Overlay ? <style.Overlay t={t} f={f} /> : null}
        {project.voice ? <Audio src={staticFile(project.voice)} /> : null}
        {project.music ? <Audio src={staticFile(project.music)} /> : null}
        <Captions t={t} words={project.words} cx={cap.cx} cy={cap.cy} maxW={cap.maxW} size={cap.size} frameW={f.w} frameH={f.h} light={cap.light} accent={project.accent} />
        <Sounds cues={cuesOf(project)} seed={seedOf(project.words.map((w) => w.text).join(' ') + project.duration)} />
      </AbsoluteFill>
    </FormatProvider>
  );
};
