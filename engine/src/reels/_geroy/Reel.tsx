import React from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {Sounds, type Cue} from '../../sound';

// ШАБЛОН СТИЛЯ 21 «ИСТОРИЯ С ГЕРОЕМ» (правила: patterns/styles/k-geroy/ПРАВИЛА СТИЛЯ.md, образец — ролик «Киркоров уснул»,
// patterns/reels/k-istoriya-s-geroem). Копируется командой `npm run new -- <slug> geroy` в src/mine/<slug>/.
// Рассказчик на весь кадр, размытое начало, фото героя со вспышкой на его имени, вставки со стока на фразы рассказа,
// крупные слова Bebas Neue, тишина перед развязкой и развязка одним словом с тряской.
// Что заполнить под ролик (время — по словам из work/<slug>/words.json): CAM, INSERTS, FLASHES, BIG, SILENCE, SFX.
// Файлы вставок кладутся в public/work/<slug>/ (stock/…, hero/…), путь в INSERTS — относительно этой папки.

// >>> файлы проекта: дописывают npm run prep, cut и transcribe (руками не править)
import {END, WORDS} from './words';
export const FPS = 30;
const WORK = 'work/_geroy';
const SPEAKER: string | null = null;
const VOICE: string | null = null;
const MUSIC_BED: string | null = null;
const CAPTION_ACCENT = '#FBB931';
// <<<
export const SECONDS = END;

const W = 1440, H = 2560;
const F = (n: string) => staticFile(`${WORK}/${n}`); // файлы ролика: public/work/<slug>/…
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {...clamp, easing: ease});
const back = Easing.out(Easing.back(2.2));
const pop = (t: number, at: number, d = 0.35) => interpolate(t, [at, at + d], [0, 1], {...clamp, easing: back});
const YELLOW = '#FFD60A';
const BEBAS = '"Bebas Neue", "SF Pro Display", sans-serif';

// ——— камера по записи: [с, зум в начале, зум в конце]; смена строки — жёсткий стык зума. FACE — точка лица в кадре 1440×2560.
const FACE = {x: 720, y: 760};
const CAM: [number, number, number][] = [[0, 1.0, 1.05], [3.0, 1.0, 1.04], [6.0, 1.18, 1.22], [9.0, 1.04, 1.1]];
const zoomAt = (t: number) => {
  let i = 0;
  while (i + 1 < CAM.length && CAM[i + 1][0] <= t) i++;
  const [a, z0, z1] = CAM[i], b = CAM[i + 1]?.[0] ?? SECONDS;
  return z0 + (z1 - z0) * Math.min(1, Math.max(0, (t - a) / Math.max(0.01, b - a)));
};
const shakeAt = (t: number, at: number, amp: number) => (t < at ? 0 : amp * Math.sin((t - at) * 70) * Math.exp(-(t - at) * 6));

// ——— вставки на весь кадр: фото героя (Wikimedia, свободная лицензия) и сток (Pixabay, Pexels по просьбе).
// Пример: {from: 0.6, to: 1.7, kind: 'photo', src: 'hero/01.jpg', z0: 1.0, z1: 1.08, origin: '50% 28%'},
//         {from: 1.8, to: 3.2, kind: 'video', src: 'stock/01.mp4', trim: 0.4, z0: 1.0, z1: 1.06}
type Insert = {from: number; to: number; kind: 'video' | 'photo'; src: string; trim?: number; z0: number; z1: number; origin?: string};
const INSERTS: Insert[] = [];
const FLASHES: number[] = []; // секунды входа героя: белая вспышка
// Крупные слова: то же слово, что звучит; на время крупного слова субтитры убираются. shake — тряска развязки.
type Big = {text: string; from: number; to: number; y: number; size: number; color?: string; shake?: number};
const BIG: Big[] = [];
// Музыка (npm run music → music-bed.wav, подключается сама: MUSIC_BED): тишина перед развязкой — [с, с], пусто — играет весь ролик.
const SILENCE: [number, number] | null = null;
// Звуки — по ПРАВИЛА/5 Звук.md (src/sound.tsx): раздел каталога ('whoosh', 'pop'…) — разные файлы с громкостью из каталога;
// фирменные стиля — путём: sfx/apple/blur-out.mp3 (начало), sfx/apple/flash.mp3 (вход героя), sfx/apple/apple-typing.mp3 (тык).
const SFX: Cue[] = [[0.0, 'sfx/apple/blur-out.mp3', 0.35]];
// громкость музыки: перед тишиной затухает за 0,35 с, после тишины возвращается сразу (на развязке)
const musicAt = (s: number) => {
  if (!SILENCE) return 1;
  const [a, b] = SILENCE;
  return s >= b ? 1 : s >= a ? 0 : Math.min(1, (a - s) / 0.35);
};

const InsertView: React.FC<{ins: Insert; t: number; fps: number}> = ({ins, t, fps}) => {
  const z = ins.z0 + (ins.z1 - ins.z0) * Math.min(1, Math.max(0, (t - ins.from) / (ins.to - ins.from)));
  const style: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover', maxWidth: 'none', maxHeight: 'none',
    transform: `scale(${z})`, transformOrigin: ins.origin ?? '50% 50%'};
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      {ins.kind === 'photo' ? <Img src={F(ins.src)} style={style} /> : <Video src={F(ins.src)} muted objectFit="cover" trimBefore={Math.round((ins.trim ?? 0) * fps)} style={style} />}
      {/* затемнение снизу: субтитры читаются на любой картинке */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)'}} />
    </AbsoluteFill>
  );
};

const BigWord: React.FC<{b: Big; t: number}> = ({b, t}) => {
  const p = pop(t, b.from, 0.4), dx = shakeAt(t, b.from, b.shake ?? 0);
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: b.y - b.size / 2, textAlign: 'center', fontFamily: BEBAS, fontWeight: 700, fontSize: b.size,
      lineHeight: 1, letterSpacing: 6, color: b.color ?? YELLOW, opacity: Math.min(1, p * 1.4), transform: `translateX(${dx}px) scale(${0.4 + 0.6 * p})`,
      textShadow: '0 10px 40px rgba(0,0,0,.55), 0 2px 0 rgba(0,0,0,.35)'}}>{b.text}</div>
  );
};

export const TemplateReel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  // размытое начало: кадр в размытии и чуть ближе, за 0,6 с размытие уходит и кадр отъезжает
  const intro = ramp(t, 0, 0.6);
  const big = BIG.find((b) => t >= b.from && t < b.to);
  const z = zoomAt(t) * (1 + 0.12 * (1 - intro));
  const dx = big?.shake ? shakeAt(t, big.from, big.shake) : 0;
  const ins = INSERTS.find((i) => t >= i.from && t < i.to);
  const flash = Math.max(0, ...FLASHES.map((a) => (t >= a && t < a + 0.3 ? 1 - (t - a) / 0.3 : 0)));
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `translateX(${dx}px) scale(${z})`, transformOrigin: `${FACE.x}px ${FACE.y}px`,
        filter: intro < 1 ? `blur(${(1 - intro) * 14}px)` : undefined}}>
        {SPEAKER ? (
          <Video src={staticFile(SPEAKER)} volume={0} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, maxWidth: 'none', maxHeight: 'none'}} />
        ) : (
          <AbsoluteFill style={{background: 'radial-gradient(90% 70% at 50% 30%, #2A3036 0%, #14171A 70%)'}}>
            <Img src={staticFile('objects/mic.webp')} style={{position: 'absolute', left: W / 2 - 260, top: 600, width: 520, height: 520, objectFit: 'contain'}} />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
      {ins ? <InsertView ins={ins} t={t} fps={fps} /> : null}
      {big ? <BigWord b={big} t={t} /> : null}
      {big ? null : <Captions t={t} words={WORDS} cx={720} cy={1680} maxW={1040} size={80} family="Montserrat" weight={700} accent={CAPTION_ACCENT} />}
      {flash > 0 ? <AbsoluteFill style={{background: '#FFFFFF', opacity: flash * 0.85}} /> : null}
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {MUSIC_BED ? <Audio src={staticFile(MUSIC_BED)} volume={(f) => musicAt(f / fps)} /> : null}
      <Sounds cues={SFX} />
    </AbsoluteFill>
  );
};
