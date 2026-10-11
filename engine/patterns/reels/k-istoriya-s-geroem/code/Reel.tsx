import React from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import type {Word} from '../../montage/words';
import WORDS_JSON from '../../../work/kirkorov-usnul/words.json';

// «Киркоров уснул» — пробный ролик набора в стиле 22 «История с героем»: подкаст, фото героя с Wikimedia,
// вставки Pexels на фразы рассказа, крупные слова Bebas Neue, вспышка на входе героя, размытое начало (стиль ИИ МОНТАЖ).
// План: work/kirkorov-usnul/DIRECTION.md. Кадр 1440×2560, 30 fps, финал 1080p.
export const FPS = 30;
export const SECONDS = 26.3;

const W = 1440, H = 2560;
const WORDS = WORDS_JSON as Word[];
const F = (n: string) => staticFile(`work/kirkorov-usnul/${n}`);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});
const back = Easing.out(Easing.back(2.2));
const pop = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], {...clamp, easing: back});
const YELLOW = '#FFD60A';
const BEBAS = '"Bebas Neue", "SF Pro Display", sans-serif';

// ——— камера по записи: [с, зум в начале, зум в конце]; смена строки — жёсткий стык зума. Лицо рассказчика ~ (700, 680).
const FACE = {x: 700, y: 680};
const CAM: [number, number, number][] = [
  [0, 1.0, 1.05], [3.25, 1.0, 1.04], [5.45, 1.22, 1.26], [7.57, 1.04, 1.12], [9.81, 1.0, 1.0],
  [17.62, 1.0, 1.06], [18.31, 1.0, 1.0], [19.95, 1.0, 1.12], [23.27, 1.18, 1.22],
];
const zoomAt = (t: number) => {
  let i = 0;
  while (i + 1 < CAM.length && CAM[i + 1][0] <= t) i++;
  const [a, z0, z1] = CAM[i], b = CAM[i + 1]?.[0] ?? SECONDS;
  return z0 + (z1 - z0) * Math.min(1, Math.max(0, (t - a) / (b - a)));
};
// толчок на «Уснул»: затухающая тряска
const shakeAt = (t: number, at: number, amp: number) => (t < at ? 0 : amp * Math.sin((t - at) * 70) * Math.exp(-(t - at) * 6));

// ——— вставки на весь кадр: Pexels и фото героя (источники — work/kirkorov-usnul/ASSET_SOURCES.md)
type Insert = {from: number; to: number; kind: 'video' | 'photo'; src: string; trim?: number; z0: number; z1: number; origin?: string};
const INSERTS: Insert[] = [
  {from: 0.6, to: 1.72, kind: 'photo', src: 'hero/kirkorov-1.jpg', z0: 1.0, z1: 1.08, origin: '50% 28%'},
  {from: 1.76, to: 3.25, kind: 'video', src: 'stock/tiktoker.mp4', trim: 0.4, z0: 1.0, z1: 1.06},
  {from: 9.81, to: 11.34, kind: 'photo', src: 'hero/kirkorov-2.jpg', z0: 1.04, z1: 1.12, origin: '45% 25%'},
  {from: 11.34, to: 14.24, kind: 'video', src: 'stock/hall.mp4', trim: 2.0, z0: 1.0, z1: 1.04},
  {from: 14.24, to: 15.09, kind: 'video', src: 'stock/stairs.mp4', trim: 0.5, z0: 1.06, z1: 1.0},
  {from: 15.09, to: 16.45, kind: 'video', src: 'stock/singer.mp4', trim: 0.6, z0: 1.0, z1: 1.08},
  {from: 16.45, to: 17.62, kind: 'video', src: 'stock/tear.mp4', trim: 0.5, z0: 1.1, z1: 1.2},
  {from: 18.31, to: 19.95, kind: 'photo', src: 'hero/kirkorov-1.jpg', z0: 1.15, z1: 1.45, origin: '50% 24%'},
];
const FLASHES = [0.6, 9.81, 18.31]; // вспышка на каждом входе героя

const InsertView: React.FC<{ins: Insert; t: number}> = ({ins, t}) => {
  const z = ins.z0 + (ins.z1 - ins.z0) * Math.min(1, Math.max(0, (t - ins.from) / (ins.to - ins.from)));
  const style: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover', maxWidth: 'none', maxHeight: 'none',
    transform: `scale(${z})`, transformOrigin: ins.origin ?? '50% 50%'};
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      {ins.kind === 'photo' ? <Img src={F(ins.src)} style={style} /> : <Video src={F(ins.src)} muted objectFit="cover" trimBefore={Math.round((ins.trim ?? 0) * FPS)} style={style} />}
      {/* затемнение снизу: субтитры читаются на любой картинке */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)'}} />
    </AbsoluteFill>
  );
};

// Крупное слово (Bebas Neue), вылетает пружиной, у главного — тряска.
const BigWord: React.FC<{text: string; t: number; at: number; y: number; size: number; color?: string; shake?: number}> = ({text, t, at, y, size, color = YELLOW, shake = 0}) => {
  const p = pop(t, at, 0.4);
  const dx = shakeAt(t, at, shake);
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y - size / 2, textAlign: 'center', fontFamily: BEBAS, fontWeight: 700, fontSize: size,
      lineHeight: 1, letterSpacing: 6, color, opacity: Math.min(1, p * 1.4), transform: `translateX(${dx}px) scale(${0.4 + 0.6 * p})`,
      textShadow: '0 10px 40px rgba(0,0,0,.55), 0 2px 0 rgba(0,0,0,.35)'}}>
      {text}
    </div>
  );
};

// «Z z z» над головой, пока рассказчик изображает уснувшего (справа от лица, в поле Instagram).
const Zzz: React.FC<{t: number}> = ({t}) => {
  if (t < 20.3 || t > 23.3) return null;
  const out = 1 - ramp(t, 23.0, 23.3);
  const zs: [number, number, number, number][] = [[20.4, 1040, 560, 130], [21.2, 1090, 400, 100], [22.0, 1125, 270, 76]];
  return (
    <>
      {zs.map(([at, x, y, s], i) => {
        const p = pop(t, at, 0.45);
        return (
          <div key={i} style={{position: 'absolute', left: x - s / 2, top: y - s / 2 - (t - at) * 18, fontFamily: BEBAS, fontWeight: 700, fontSize: s, color: '#FFFFFF',
            opacity: p * out, transform: `scale(${0.3 + 0.7 * p}) rotate(-8deg)`, textShadow: '0 6px 24px rgba(0,0,0,.5)'}}>Z</div>
        );
      })}
    </>
  );
};

// Звуки пака: громкость по ПРАВИЛА/5 Звук.md
const SFX: [number, string, number][] = [
  [0.0, 'sfx/apple/blur-out.mp3', 0.35], [0.6, 'sfx/apple/flash.mp3', 0.3], [1.72, 'sfx/apple/whoosh-big.mp3', 0.07],
  [3.25, 'sfx/apple/whoosh-air.wav', 0.035], [5.45, 'sfx/apple/mech-zoom.mp3', 0.12], [9.81, 'sfx/apple/flash.mp3', 0.3],
  [10.39, 'sfx/apple/apple-typing.mp3', 0.26], [11.3, 'sfx/apple/whoosh-big.mp3', 0.07], [14.22, 'sfx/apple/whoosh-air.wav', 0.035],
  [15.07, 'sfx/apple/whoosh-long-3.wav', 0.035], [16.43, 'sfx/apple/whoosh-long-4.wav', 0.035], [17.6, 'sfx/apple/whoosh-air.wav', 0.035],
  [18.31, 'sfx/apple/flash.mp3', 0.3], [19.95, 'sfx/apple/whoosh-long-2.wav', 0.035], [20.4, 'sfx/apple/apple-typing.mp3', 0.26],
  [21.2, 'sfx/apple/apple-typing.mp3', 0.26], [22.0, 'sfx/apple/apple-typing.mp3', 0.26], [23.27, 'sfx/sub-hit.wav', 0.3], [23.27, 'sfx/apple/shake.mp3', 0.25],
];

export const TemplateReel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  // размытое начало: кадр в размытии и чуть ближе, размытие уходит, кадр отъезжает (ИИ МОНТАЖ)
  const intro = ramp(t, 0, 0.6);
  const z = zoomAt(t) * (1 + 0.12 * (1 - intro));
  const dx = shakeAt(t, 23.27, 22);
  const ins = INSERTS.find((i) => t >= i.from && t < i.to);
  const flash = Math.max(0, ...FLASHES.map((a) => (t >= a && t < a + 0.3 ? 1 - (t - a) / 0.3 : 0)));
  const bigConech = t >= 10.39 && t < 11.34;
  const bigUsnul = t >= 23.27;
  const showCaptions = !bigConech && !bigUsnul;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${FACE.x}px ${FACE.y}px`,
        filter: intro < 1 ? `blur(${(1 - intro) * 14}px)` : undefined}}>
        <Video src={F('speaker-cut.mp4')} volume={0} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, maxWidth: 'none', maxHeight: 'none'}} />
      </AbsoluteFill>
      {ins ? <InsertView ins={ins} t={t} /> : null}
      {t >= 0.6 && t < 1.72 ? <BigWord text="КИРКОРОВ" t={t} at={0.75} y={1430} size={230} color="#FFFFFF" /> : null}
      {bigConech ? <BigWord text="КОНЕЧНО" t={t} at={10.39} y={1640} size={260} /> : null}
      <Zzz t={t} />
      {bigUsnul ? <BigWord text="УСНУЛ" t={t} at={23.27} y={1700} size={300} shake={26} /> : null}
      {showCaptions ? <Captions t={t} words={WORDS} cx={720} cy={1680} maxW={1040} size={74} family="Montserrat" weight={700} accent={YELLOW} /> : null}
      {flash > 0 ? <AbsoluteFill style={{background: '#FFFFFF', opacity: flash * 0.85}} /> : null}
      <Audio src={F('voice-cut.wav')} />
      {/* музыка: тихий фон, замолкает, пока рассказчик «спит», и возвращается на «Уснул» */}
      <Sequence from={0} durationInFrames={Math.round(19.95 * fps)} layout="none">
        <Audio src={F('music.wav')} volume={(f) => 0.08 * (1 - interpolate(f / fps, [19.6, 19.95], [0, 1], clamp))} />
      </Sequence>
      <Sequence from={Math.round(23.27 * fps)} layout="none">
        <Audio src={F('music.wav')} trimBefore={Math.round(23.27 * fps)} volume={(f) => 0.08 * interpolate(f / fps, [0, 0.15, 2.6, 3.0], [0, 1, 1, 0], clamp)} />
      </Sequence>
      {SFX.map(([at, src, v], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(src)} volume={v} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
