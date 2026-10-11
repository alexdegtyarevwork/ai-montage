import React from 'react';
import {Easing, Freeze, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// Набор «motion-design» (навык .claude/skills/motion-design). Время везде в кадрах референса 30 fps:
// at={15} = 0,5 с и в 30-, и в 60-кадровой композиции, поэтому числа из разборов переносятся как есть.
export const useF = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (frame * 30) / fps;
};

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Кривые, снятые с референсов.
export const EASE = {
  // C: подпись стиля ТОЧКА, ролик сам рисует эту кривую в главе «КРИВЫЕ» (перелёт до 1,10).
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  // expo-out: влёт слова с наклоном, вход из фокуса, уменьшение знака B (без перелёта).
  out: Easing.bezier(0.16, 1, 0.3, 1),
  // expo-in: точка раздувается в фон, ирис сжимается в точку (ускорение к концу).
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  // C: падение точки — постоянное ускорение (замер: +5,3 px/кадр² в кадре 720).
  gravity: (t: number) => t * t,
  linear: (t: number) => t,
};

// 0→1 на отрезке [a, b] кадров референса с кривой.
export const ramp = (f: number, a: number, b: number, ease: (t: number) => number = EASE.out) =>
  interpolate(f, [a, b], [0, 1], {...clamp, easing: ease});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Бит-сетка. C: 120 BPM, глава = такт (4 доли = 2 с), смена главы за 1,5 кадра до доли.
export const beatGrid = (bpm: number, offset = 0) => {
  const beat = (30 * 60) / bpm;
  return {
    beat,
    at: (n: number) => offset + n * beat,
    bar: (n: number) => offset + n * beat * 4,
    cut: (n: number) => offset + n * beat * 4 - 1.5,
  };
};

// Удар бочки по тексту (C, 4,00 с): scaleY 1 → 1,16 → 0,95 → 1 за 11 кадров от доли.
export const bumpAt = (f: number, beats: number[]) => {
  let s = 1;
  for (const b of beats) {
    const d = f - b;
    if (d < 0 || d > 11) continue;
    s *= interpolate(d, [0, 4, 8, 11], [1, 1.16, 0.95, 1], {...clamp, easing: EASE.inOut});
  }
  return s;
};

// Растяжение по скорости с сохранением площади (C: ×1,33 / ×0,86 на 70 px/кадр в кадре 720).
export const stretchOf = (vx: number, vy: number, k = 0.0045, max = 0.5) => {
  const v = Math.hypot(vx, vy);
  const s = 1 + Math.min(max, v * k);
  return {angle: (Math.atan2(vy, vx) * 180) / Math.PI, sx: s, sy: 1 / s, speed: v};
};

// «На двойках» (A): движение 15 к/с при любой частоте композиции. step — шаг в кадрах 30 fps (2 = на двойках).
export const OnTwos: React.FC<{step?: number; children: React.ReactNode}> = ({step = 2, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = Math.max(1, Math.round((step * fps) / 30));
  return <Freeze frame={Math.floor(frame / n) * n}>{children}</Freeze>;
};

// Ширина текста до показа: строка из слов растёт и центрируется плавно (A, B), контейнер меряется заранее.
let ctx: CanvasRenderingContext2D | null = null;
export const measure = (text: string, font: string) => {
  if (typeof document === 'undefined') return text.length * 20;
  ctx = ctx ?? document.createElement('canvas').getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
};

// Где у строки базовая линия при line-height: 1 — чтобы посадить точку-«точку» ровно в конец слова (C «РИЛ.»).
export const baselineOf = (family: string, size: number, weight = 400) => {
  if (typeof document === 'undefined') return size * 0.82;
  ctx = ctx ?? document.createElement('canvas').getContext('2d');
  ctx.font = `${weight} ${size}px ${family}`;
  const m = ctx.measureText('НH');
  const a = m.fontBoundingBoxAscent ?? size * 0.8;
  const d = m.fontBoundingBoxDescent ?? size * 0.2;
  return size / 2 + (a - d) / 2;
};

// Таймкод как у C: 00:СС:КК (секунды:кадры 30 fps).
export const timecode = (f30: number) => {
  const s = Math.floor(f30 / 30);
  const k = Math.floor(f30 % 30);
  return `00:${String(s).padStart(2, '0')}:${String(k).padStart(2, '0')}`;
};
