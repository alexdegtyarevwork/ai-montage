import {Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {CARD, RADIUS, T} from '../theme';

type Box = {x: number; y: number; w: number; h: number};
const mix = (a: Box, b: Box, p: number): Box => ({
  x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p,
});

type State = keyof typeof CARD;
export type CardPlan = {at: number; to: State}[];
// План ролика «Коннекторы»: base → compact на схеме → base на бейджах.
const DEFAULT_PLAN: CardPlan = [{at: T.bToC, to: 'compact'}, {at: T.badges, to: 'base'}];

// Карточка Screen Studio снизу. Размер меняется по смысловым блокам (план: секунда и новое состояние),
// переход 0,6 с, масштаб равномерный.
// placeholder — демо без своей речи: клип спикера без звука и по кругу (так по умолчанию: демо-сцены набора не играют чужой голос).
// src — запись спикера 9:16 из public, headY — центр головы в сетке 1080×1920 исходника (замер по лицу).
// Без src — студийная заглушка с микрофоном (учебные сцены набора без чужой записи).
export const SpeakerCard: React.FC<{plan?: CardPlan; start?: State; placeholder?: boolean; src?: string; headY?: number}> =
  ({plan = DEFAULT_PLAN, start = 'base', placeholder = true, src, headY = 907}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ease = Easing.bezier(0.65, 0, 0.35, 1);
  let box: Box = CARD[start];
  for (const step of plan) {
    const k = interpolate(frame, [step.at * fps, (step.at + 0.6) * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
    box = mix(box, CARD[step.to], k);
  }
  // Центр головы ставится на 45% высоты карточки.
  const scale = box.w / 1080;
  const top = box.h * 0.45 - headY * scale;
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: RADIUS,
      overflow: 'hidden', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.14), 0 4px 8px rgba(0,0,0,.4), 0 32px 64px rgba(0,0,0,.52), 0 80px 150px rgba(0,0,0,.36)'}}>
      {src ? <Video src={staticFile(src)} muted={placeholder} loop={placeholder} style={{position: 'absolute', left: 0, top, width: box.w, height: 1920 * scale}} /> : (
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 70% at 50% 30%, #2A3036 0%, #14171A 70%)'}}>
          <Img src={staticFile('objects/mic.webp')} style={{position: 'absolute', left: box.w * 0.3, top: box.h * 0.18, width: box.w * 0.4, height: box.w * 0.4, objectFit: 'contain'}} />
        </div>
      )}
    </div>
  );
};
