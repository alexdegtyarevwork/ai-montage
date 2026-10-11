import React from 'react';
import {AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {Backdrop, type BackdropKind} from '../../kit/backdrops';
import {Sounds, type Cue} from '../../sound';

// ШАБЛОН СВОЕГО РОЛИКА: формат «половина экрана эксперт + монтаж сверху», иногда эксперт сворачивается в окно в углу
// и анимация раскрывается на весь кадр (образец: patterns/reels/r29-jarvis-ironman). Копируется командой
// `npm run new -- <slug> custom` в src/mine/<slug>/. Кадр 1440×2560; финал 1080p (`npm run render`), 2K и 4K по просьбе.
// Что менять под ролик: BLOCKS (смысловые блоки по карте монтажа), CHANGES (когда сворачиваться), SFX.

// Частота — как в исходнике (public/work/<slug>/meta.json), без видео — 30. Запись и голос — нарезанные (speaker-cut.mp4,
// voice-cut.wav), слова — расшифровка нарезки (work/<slug>/words.json). Пока файлов нет — заглушка и демо-слова.
// >>> файлы проекта: дописывают npm run prep, cut и transcribe (руками не править)
import {END, WORDS} from './words';
export const FPS = 30;
const WORK = 'work/_template';
const SPEAKER: string | null = null;
const VOICE: string | null = null;
const MUSIC_BED: string | null = null;
const CAPTION_ACCENT = '#FBB931';
// <<<
export const SECONDS = END;

const W = 1440, H = 2560;
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const sp = (t: number, at: number, fps: number, damping = 12, stiffness = 170) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// Точка лица в кадре записи (доли ширины и высоты): лицо не обрезается и не искажается при любом окне.
const FACE = {x: 0.5, y: 0.42};

// ——— режим: 0 — деление экрана, 1 — анимация на весь кадр, спикер в окне в углу ———
// Сворачивание ставить на смену смыслового блока, где нужна вся площадь (схема, живой интерфейс). 0,7 с.
const CHANGES: [number, number][] = [[4.7, 1], [10.9, 0]];
const modeAt = (t: number) => CHANGES.reduce((m, [c, v]) => lerp(m, v, k(t, c - 0.35, c + 0.35, E.inOut)), 0);

type Rect = {x: number; y: number; w: number; h: number; r: number};
const SPLIT: Rect = {x: 0, y: 1280, w: 1440, h: 1280, r: 0};
// Окно в углу: шире квадрата и мельче масштабом, чтобы голова и плечи были целиком. Справа рейка Instagram — угол левый.
const CORNER: Rect = {x: 70, y: 1548, w: 500, h: 450, r: 36};
const mix = (a: Rect, b: Rect, m: number): Rect => ({x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), w: lerp(a.w, b.w, m), h: lerp(a.h, b.h, m), r: lerp(a.r, b.r, m)});

const Speaker: React.FC<{m: number}> = ({m}) => {
  const rc = mix(SPLIT, CORNER, m);
  // Равномерный масштаб (ширина видео lerp, высота по 9:16) — лицо никогда не сплющивается.
  const vw = lerp(1440, 540, m), vh = (vw * 16) / 9;
  const left = Math.min(0, Math.max(rc.w - vw, rc.w / 2 - FACE.x * vw));
  const top = Math.min(0, Math.max(rc.h - vh, lerp(560, 190, m) - FACE.y * vh));
  return (
    <div style={{position: 'absolute', left: rc.x, top: rc.y, width: rc.w, height: rc.h, borderRadius: rc.r, overflow: 'hidden', background: '#16181B',
      boxShadow: m > 0.5 ? '0 0 0 3px rgba(255,255,255,.9), 0 30px 60px rgba(0,0,0,.6)' : undefined}}>
      {SPEAKER ? (
        // maxWidth: 'none' обязателен: Tailwind ставит max-width 100%, и видео шире окна сжимается по ширине.
        <Video src={staticFile(SPEAKER)} volume={0} objectFit="cover" style={{position: 'absolute', left, top, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
      ) : (
        <Img src={staticFile('objects/mic.webp')} style={{position: 'absolute', left: rc.w / 2 - 120, top: rc.h / 2 - 140, width: 240, height: 240, objectFit: 'contain'}} />
      )}
    </div>
  );
};

// ——— смысловые блоки: у каждого свой фон (смена фона на каждом блоке, 5–7 в минуту) ———
type BlockProps = {t: number; fps: number};
const Big: React.FC<{text: string; size: number; color: string; y: number; at: number; t: number; fps: number}> = ({text, size, color, y, at, t, fps}) => {
  const a = sp(t, at, fps, 12, 190);
  return (
    <div style={{position: 'absolute', left: 144, width: 1008, top: y, textAlign: 'center', fontFamily: 'Inter Tight', fontWeight: 900, fontSize: size, lineHeight: 1.02,
      letterSpacing: '-0.035em', color, opacity: Math.min(1, a * 1.6), transform: `translateY(${(1 - a) * 40}px) scale(${0.9 + 0.1 * a})`,
      textShadow: '0 4px 0 rgba(0,0,0,.25), 0 18px 40px rgba(0,0,0,.35)'}}>{text}</div>
  );
};

// Первый блок — тема ролика обычным размером. Кадр 0 уже полный (at < 0): пустой первый кадр запрещён.
// Огромный хук (одна фраза на весь кадр в первые 3 с) — только если его задал стиль или попросил ученик.
const Intro: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="black" />
    <Big text="Монтаж" size={120} color="#FFFFFF" y={400} at={-0.6} t={t} fps={fps} />
    <Big text="без монтажёра" size={96} color="#FF7A2F" y={540} at={-0.45} t={t} fps={fps} />
  </AbsoluteFill>
);
const Point: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="graphite" />
    <Big text="Агент делает сам" size={110} color="#FFFFFF" y={420} at={4.9} t={t} fps={fps} />
    {['субтитры', 'графику', 'звук'].map((s, i) => (
      <Big key={s} text={`✓ ${s}`} size={90} color="#3DEDC3" y={680 + i * 150} at={5.6 + i * 0.5} t={t} fps={fps} />
    ))}
  </AbsoluteFill>
);
const Steps: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="white" />
    <Big text="Запись → расшифровка → карта → рендер" size={84} color="#101214" y={520} at={8.1} t={t} fps={fps} />
  </AbsoluteFill>
);
const Cta: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="mint" />
    <Big text="«монтаж»" size={170} color="#05231D" y={430} at={11.3} t={t} fps={fps} />
    <Big text="в комментариях" size={80} color="#05231D" y={640} at={11.6} t={t} fps={fps} />
  </AbsoluteFill>
);

// a, b — начало и конец блока (секунды речи). Стык ставится на слово, с которого начинается новая мысль.
const BLOCKS: {a: number; b: number; C: React.FC<BlockProps>; bg: BackdropKind}[] = [
  {a: 0, b: 4.7, C: Intro, bg: 'black'}, {a: 4.7, b: 8.0, C: Point, bg: 'graphite'}, {a: 8.0, b: 10.9, C: Steps, bg: 'white'}, {a: 10.9, b: END, C: Cta, bg: 'mint'},
];

// Звуки — по ПРАВИЛА/5 Звук.md: почти на каждое видимое действие, разные. Раздел каталога ('pop', 'whoosh', 'click'…) —
// слой сам берёт разные файлы раздела с громкостью из каталога; точный файл — путь 'sfx/pack/pop/pop-09.wav' (src/sound.tsx).
// Секунда — момент события: у вуша самое громкое место попадает на стык, нарастание ('riser') кончается на раскрытии.
const SFX: Cue[] = [
  [0.05, 'pop'],                                      // тема ролика на первом кадре
  [4.7, 'whoosh'], [5.6, 'click'], [6.1, 'click'], [6.6, 'positive'],   // стык, три галочки
  [8.0, 'whoosh'], [10.9, 'whoosh'], [11.3, 'pop'], [11.6, 'ui'],       // стыки, слово призыва, «в комментариях»
];

export const TemplateReel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const m = modeAt(t);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {BLOCKS.map((B, i) => {
        // Переход: новый блок проявляется за 0,35 с поверх старого (размытие + масштаб), старый уходит так же.
        const inP = i === 0 ? 1 : k(t, B.a - 0.2, B.a + 0.2, E.inOut), outP = i === BLOCKS.length - 1 ? 0 : k(t, B.b - 0.2, B.b + 0.2, E.inOut);
        if (t < B.a - 0.25 || t > B.b + 0.25) return null;
        return (
          <AbsoluteFill key={i} style={{opacity: inP * (1 - outP), filter: inP < 1 ? `blur(${(1 - inP) * 10}px)` : outP > 0 ? `blur(${outP * 10}px)` : undefined,
            transform: `scale(${1 + (1 - inP) * 0.06 - outP * 0.04})`}}>
            <B.C t={t} fps={fps} />
          </AbsoluteFill>
        );
      })}
      <Speaker m={m} />
      {/* Субтитры над швом при делении (1157) и ниже середины на весь кадр (1467); не на лице, не под окном. */}
      {/* Базовый вид субтитров (ПРАВИЛА/2 Субтитры.md): Manrope 700, 80 px в кадре 1440 (= 60 px на 1080), капсула.
          Ученик сказал «убери капсулу» — plate="none": шрифт, размер и цвет те же, подчёркивания нет. Стиль или пример задают своё. */}
      <Captions t={t} words={WORDS} cx={690} cy={lerp(1157, 1467, m)} maxW={1000} size={80} family="Manrope" weight={700} plate="capsule" accent={CAPTION_ACCENT} />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {MUSIC_BED ? <Audio src={staticFile(MUSIC_BED)} /> : null}
      <Sounds cues={SFX} />
    </AbsoluteFill>
  );
};
