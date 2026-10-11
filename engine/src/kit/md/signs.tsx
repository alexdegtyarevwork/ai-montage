import React from 'react';
import {evolvePath} from '@remotion/paths';
import {EASE, lerp, ramp, useF} from './core';

// ——— Знаки, которые перетекают друг в друга (C глава ФОРМЫ: точка → квадрат → кольцо → прицел → искра → лучи) ———
// Внешний контур задан в полярных координатах на 144 точках, поэтому любые два знака морфятся без рывков.
const N = 144;
export type SignKind = 'dot' | 'square' | 'ring' | 'cross' | 'spark' | 'rays' | 'scallop';
const outer = (kind: SignKind): number[] => Array.from({length: N}, (_, i) => {
  const t = (i / N) * Math.PI * 2;
  switch (kind) {
    case 'square': return 0.88 / Math.pow(Math.pow(Math.abs(Math.cos(t)), 6) + Math.pow(Math.abs(Math.sin(t)), 6), 1 / 6);
    case 'spark': return 0.16 + 0.94 * Math.pow(Math.abs(Math.cos(2 * t)), 3.2);
    case 'rays': return 0.5 + 0.55 * Math.pow(Math.abs(Math.cos(6 * t)), 9);
    case 'scallop': return 0.9 + 0.1 * Math.abs(Math.cos(6 * t));
    default: return 1;
  }
});
const SHAPES: Record<SignKind, {r: number[]; hole: number; ticks: number; rot: number}> = {
  dot: {r: outer('dot'), hole: 0, ticks: 0, rot: 0},
  square: {r: outer('square'), hole: 0, ticks: 0, rot: 0},
  ring: {r: outer('dot'), hole: 0.58, ticks: 0, rot: 0},
  cross: {r: outer('dot').map((v) => v * 0.78), hole: 0.72, ticks: 1, rot: 0},
  spark: {r: outer('spark'), hole: 0, ticks: 0, rot: 0},
  rays: {r: outer('rays'), hole: 0, ticks: 0, rot: 0},
  scallop: {r: outer('scallop'), hole: 0, ticks: 0, rot: 0},
};

export const signPath = (r: number[], cx: number, cy: number, R: number, rot = 0, hole = 0) => {
  const a0 = (rot * Math.PI) / 180;
  const pts = r.map((v, i) => {
    const t = (i / N) * Math.PI * 2 + a0;
    return `${(cx + Math.cos(t) * v * R).toFixed(2)} ${(cy + Math.sin(t) * v * R).toFixed(2)}`;
  });
  let d = `M${pts.join('L')}Z`;
  if (hole > 0.01) {
    const h = hole * R * Math.min(...r);
    d += `M${cx + h} ${cy}A${h} ${h} 0 1 0 ${cx - h} ${cy}A${h} ${h} 0 1 0 ${cx + h} ${cy}Z`;
  }
  return d;
};

// Последовательность знаков по времени (замер C 4,57–6,20, каждый кадр): за 2 кадра до смены текущий знак сжимается
// до ×0,78 (предвосхищение) → контур перетекает в новый за 3 кадра через «желейную» форму → новый знак входит повёрнутым
// на ±18° (через раз в разные стороны) и с перелётом масштаба, доворачивается и садится за 4 кадра → держится.
export const MorphSign: React.FC<{seq: {at: number; kind: SignKind}[]; cx: number; cy: number; R: number; color?: string; dur?: number; spin?: number;
  squeeze?: number; enterRot?: number}> =
  ({seq, cx, cy, R, color = '#0F100D', dur = 3, spin = 0, squeeze = 0.78, enterRot = 18}) => {
    const f = useF();
    let i = 0;
    seq.forEach((s, j) => { if (f >= s.at) i = j; });
    const a = SHAPES[seq[Math.max(0, i - 1)].kind];
    const b = SHAPES[seq[i].kind];
    const k = i === 0 ? 1 : ramp(f, seq[i].at, seq[i].at + dur, EASE.inOut);
    const wob = i === 0 ? 0 : Math.sin(k * Math.PI) * 0.06;
    const r = b.r.map((v, j) => lerp(a.r[j], v, k) * (1 + wob * Math.sin(j * 0.35 * 6)));
    const hole = Math.max(0, lerp(a.hole, b.hole, k));
    const ticks = Math.max(0, lerp(a.ticks, b.ticks, k));
    const next = seq[i + 1]?.at;
    const pre = next === undefined ? 0 : ramp(f, next - 2, next, EASE.in);
    const enter = i === 0 ? 1 : ramp(f, seq[i].at, seq[i].at + dur + 4, EASE.back);
    const scale = (1 - (1 - squeeze) * pre) * (i === 0 ? 1 : 0.85 + 0.15 * enter);
    const rot = (i === 0 ? 0 : (i % 2 ? enterRot : -enterRot) * (1 - Math.min(1, enter))) + spin * f;
    const RR = R * scale;
    const tl = RR * 1.05;
    return (
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <path d={signPath(r, cx, cy, RR, rot, hole)} fill={color} fillRule="evenodd" />
        {ticks > 0.01 && [0, 90, 180, 270].map((deg) => {
          const t = ((deg + rot) * Math.PI) / 180;
          const r0 = RR * 0.38 * ticks + RR * 0.62;
          const r1 = r0 + tl * 0.62 * ticks;
          return <line key={deg} x1={cx + Math.cos(t) * r0 * 0.9} y1={cy + Math.sin(t) * r0 * 0.9} x2={cx + Math.cos(t) * r1} y2={cy + Math.sin(t) * r1}
            stroke={color} strokeWidth={RR * 0.17} />;
        })}
      </svg>
    );
  };

// Маленький знак для строки-оглавления (C: шесть мини-знаков сверху, активный тёмный с чертой).
export const SignGlyph: React.FC<{kind: SignKind; size: number; color: string}> = ({kind, size, color}) => {
  const s = SHAPES[kind];
  const R = size * 0.42;
  return (
    <svg width={size} height={size} style={{overflow: 'visible'}}>
      <path d={signPath(s.r.map((v) => (kind === 'cross' ? v * 0.95 : v)), size / 2, size / 2, R, 0, s.hole)} fill={color} fillRule="evenodd" />
      {s.ticks > 0 && [0, 90, 180, 270].map((deg) => {
        const t = (deg * Math.PI) / 180;
        return <line key={deg} x1={size / 2 + Math.cos(t) * R * 0.55} y1={size / 2 + Math.sin(t) * R * 0.55} x2={size / 2 + Math.cos(t) * R * 1.3}
          y2={size / 2 + Math.sin(t) * R * 1.3} stroke={color} strokeWidth={size * 0.09} />;
      })}
    </svg>
  );
};

// ——— Линейные иконки 24×24 (B: слово превращается в ряд иконок). Свои контуры, без чужих наборов. ———
export const ICONS: Record<string, string> = {
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM12 7v5l3.5 2',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM16 13.5a4 4 0 1 1-8 0a4 4 0 1 1 8 0z',
  laptop: 'M5 5h14a1 1 0 0 1 1 1v10H4V6a1 1 0 0 1 1-1zM2 19h20',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z',
  car: 'M3 13l2-6h14l2 6v4H3zM3 13h18M7 17v2M17 17v2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z',
  heart: 'M12 20C5 15 3 12 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 12 19 15 12 20z',
  play: 'M8 5l11 7-11 7z',
  check: 'M5 12l5 5 9-10',
  search: 'M16.5 10.5a6 6 0 1 1-12 0a6 6 0 1 1 12 0zM15 15l5 5',
  spark: 'M12 2c.6 5 2 7.4 7 8-5 .6-6.4 3-7 8-.6-5-2-7.4-7-8 5-.6 6.4-3 7-8z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0zM20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0z',
  pen: 'M4 20h4L19 9l-4-4L4 16z',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  cursor: 'M5 3l13 7-6 1.5L9 18z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7',
  play2: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM10 9l5 3-5 3z',
};

// Иконка с дорисовкой контура (draw: 0…1) — тот же приём, что у Lottie trim path.
export const Icon: React.FC<{name: keyof typeof ICONS | string; size: number; color: string; stroke?: number; draw?: number; fill?: string; style?: React.CSSProperties}> =
  ({name, size, color, stroke = 1.8, draw = 1, fill = 'none', style}) => {
    const d = ICONS[name] ?? name;
    const ev = draw < 1 ? evolvePath(Math.max(0.001, draw), d) : null;
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{overflow: 'visible', ...style}}>
        <path d={d} fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={ev?.strokeDasharray} strokeDashoffset={ev?.strokeDashoffset} />
      </svg>
    );
  };

// Выпрыгивание иконки или предмета: масштаб 0 → 1 с перелётом, поворот −10° → 0 (B пластилиновые предметы, C итоговая строка знаков).
export const PopIn: React.FC<{at: number; dur?: number; rot?: number; children: React.ReactNode; style?: React.CSSProperties; exitAt?: number}> =
  ({at, dur = 8, rot = -10, children, style, exitAt}) => {
    const f = useF();
    const k = ramp(f, at, at + dur, EASE.back);
    const e = exitAt === undefined ? 0 : ramp(f, exitAt, exitAt + 5, EASE.in);
    if (f < at) return null;
    return <div style={{display: 'inline-block', transform: `scale(${k * (1 - e)}) rotate(${(1 - k) * rot}deg)`, opacity: Math.min(1, k * 2) * (1 - e), ...style}}>{children}</div>;
  };
