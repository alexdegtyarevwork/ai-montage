import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {EASE, clamp, lerp, ramp, stretchOf, useF} from './core';

// Сквозная точка (C «одна точка», A «искра»): один предмет ведёт глаз через все сцены и в каждой играет роль.
// Путь — ключи {f, x, y, r}; у отрезка своя кривая: gravity — падение (x равномерно, y с ускорением),
// arc — бросок по параболе с подъёмом arc px, orbit — по окружности вокруг cx, cy.
export type DotKey = {
  f: number; x: number; y: number; r?: number;
  ease?: 'gravity' | 'arc' | 'out' | 'in' | 'inOut' | 'linear' | 'orbit' | 'hold';
  arc?: number; cx?: number; cy?: number;
};

export const dotAt = (keys: DotKey[], f: number) => {
  if (f <= keys[0].f) return {x: keys[0].x, y: keys[0].y, r: keys[0].r ?? 30};
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (f > b.f) continue;
    const t = (f - a.f) / Math.max(1e-6, b.f - a.f);
    const ra = a.r ?? 30;
    const rb = b.r ?? ra;
    const e = b.ease ?? 'out';
    if (e === 'hold') return {x: a.x, y: a.y, r: ra};
    if (e === 'gravity') return {x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, EASE.gravity(t)), r: lerp(ra, rb, t)};
    if (e === 'arc') return {x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) - 4 * (b.arc ?? 200) * t * (1 - t), r: lerp(ra, rb, t)};
    if (e === 'orbit') {
      const cx = b.cx ?? 0;
      const cy = b.cy ?? 0;
      const a0 = Math.atan2(a.y - cy, a.x - cx);
      let a1 = Math.atan2(b.y - cy, b.x - cx);
      if (a1 < a0) a1 += Math.PI * 2;
      const k = EASE.inOut(t);
      const R = lerp(Math.hypot(a.x - cx, a.y - cy), Math.hypot(b.x - cx, b.y - cy), k);
      const ang = lerp(a0, a1, k);
      return {x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), r: lerp(ra, rb, k)};
    }
    const k = EASE[e](t);
    return {x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: lerp(ra, rb, k)};
  }
  const z = keys[keys.length - 1];
  return {x: z.x, y: z.y, r: z.r ?? 30};
};

// Точка с растяжением по скорости, сплющиванием в момент удара (squash в ключах: r и squash) и хвостом-кометой.
export const HeroDot: React.FC<{
  keys: DotKey[]; color?: string; trail?: number; trailGap?: number; glow?: string;
  squash?: {at: number; dur?: number; amount?: number}[]; visible?: [number, number]; halftone?: number;
}> = ({keys, color = '#DE4E2C', trail = 0, trailGap = 1.2, glow, squash = [], visible, halftone = 0}) => {
  const f = useF();
  if (visible && (f < visible[0] || f > visible[1])) return null;
  const p = dotAt(keys, f);
  const q = dotAt(keys, f - 1);
  let {angle, sx, sy} = stretchOf(p.x - q.x, p.y - q.y);
  for (const s of squash) {
    const d = f - s.at;
    const dur = s.dur ?? 3;
    if (d >= 0 && d <= dur) {
      const k = interpolate(d, [0, dur], [s.amount ?? 1.7, 1], {...clamp, easing: EASE.out});
      angle = 90;
      sx = 1 / k;
      sy = k;
    }
  }
  const dot = (x: number, y: number, r: number, o: number, key?: React.Key, xf = '') => (
    <div key={key} style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: o,
      background: halftone ? `radial-gradient(circle, ${color} 45%, transparent 48%) 0 0 / ${halftone}px ${halftone}px` : color,
      boxShadow: glow ? `0 0 ${r * 1.6}px ${r * 0.5}px ${glow}` : undefined, transform: xf}} />
  );
  const ghosts = [];
  for (let i = trail; i >= 1; i--) {
    const g = dotAt(keys, f - i * trailGap);
    ghosts.push(dot(g.x, g.y, g.r * (1 - i / (trail + 2)), 0.5 * (1 - i / (trail + 1)), i));
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {ghosts}
      {dot(p.x, p.y, p.r, 1, 'main', `rotate(${angle}deg) scale(${sx}, ${sy}) rotate(${-angle}deg)`)}
    </AbsoluteFill>
  );
};

// Точка по формуле (комета на орбите вокруг знака C, дрейф искры A): pos(f) → {x, y, r}, растяжение и хвост те же.
export const FnDot: React.FC<{pos: (f: number) => {x: number; y: number; r: number}; color?: string; trail?: number; trailGap?: number; glow?: string;
  visible?: [number, number]}> = ({pos, color = '#DE4E2C', trail = 5, trailGap = 1.4, glow, visible}) => {
  const f = useF();
  if (visible && (f < visible[0] || f > visible[1])) return null;
  const p = pos(f);
  const q = pos(f - 1);
  const {angle, sx, sy} = stretchOf(p.x - q.x, p.y - q.y);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: trail}, (_, j) => {
        const i = trail - j;
        const g = pos(f - i * trailGap);
        const r = g.r * (1 - i / (trail + 2));
        return <div key={i} style={{position: 'absolute', left: g.x - r, top: g.y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: color,
          opacity: 0.45 * (1 - i / (trail + 1))}} />;
      })}
      <div style={{position: 'absolute', left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2, borderRadius: '50%', background: color,
        boxShadow: glow ? `0 0 ${p.r * 1.6}px ${p.r * 0.5}px ${glow}` : undefined,
        transform: `rotate(${angle}deg) scale(${sx}, ${sy}) rotate(${-angle}deg)`}} />
    </AbsoluteFill>
  );
};

// Удар: ударная волна-кольцо, лучи, циферблат с засечками, свечение (C f15–f26, f30–f36, 13,00 с).
export const ShockRing: React.FC<{at: number; x: number; y: number; r0?: number; r1?: number; dur?: number; color?: string; width?: number}> =
  ({at, x, y, r0 = 60, r1 = 900, dur = 12, color = '#EFEBDF', width = 4}) => {
    const f = useF();
    if (f < at || f > at + dur) return null;
    const k = ramp(f, at, at + dur, EASE.out);
    const r = lerp(r0, r1, k);
    return <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
      border: `${width * (1 - k * 0.6)}px solid ${color}`, opacity: 1 - ramp(f, at + dur * 0.55, at + dur, EASE.linear)}} />;
  };

export const RayBurst: React.FC<{at: number; x: number; y: number; n?: number; r0?: number; r1?: number; len?: number; dur?: number; color?: string; width?: number; rot?: number}> =
  ({at, x, y, n = 10, r0 = 30, r1 = 140, len = 40, dur = 8, color = '#DE4E2C', width = 6, rot = 0}) => {
    const f = useF();
    if (f < at || f > at + dur) return null;
    const k = ramp(f, at, at + dur, EASE.out);
    const r = lerp(r0, r1, k);
    const l = len * (1 - k);
    return (
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {Array.from({length: n}, (_, i) => {
          const a = ((i / n) * 360 + rot) * (Math.PI / 180);
          return <line key={i} x1={x + Math.cos(a) * r} y1={y + Math.sin(a) * r} x2={x + Math.cos(a) * (r + l)} y2={y + Math.sin(a) * (r + l)}
            stroke={color} strokeWidth={width} strokeLinecap="round" />;
        })}
      </svg>
    );
  };

// Циферблат: кольцо с n засечками расходится и гаснет (C f31–f36: r 78 → 160).
export const TickDial: React.FC<{at: number; x: number; y: number; r0?: number; r1?: number; dur?: number; n?: number; color?: string}> =
  ({at, x, y, r0 = 150, r1 = 320, dur = 10, n = 12, color = '#DE4E2C'}) => {
    const f = useF();
    if (f < at || f > at + dur) return null;
    const k = ramp(f, at, at + dur, EASE.out);
    const r = lerp(r0, r1, k);
    const o = 1 - ramp(f, at + dur * 0.5, at + dur, EASE.linear);
    return (
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: o}} width={1} height={1}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={3} />
        {Array.from({length: n}, (_, i) => {
          const a = ((i / n) * 360 + k * 20) * (Math.PI / 180);
          return <line key={i} x1={x + Math.cos(a) * r * 0.55} y1={y + Math.sin(a) * r * 0.55} x2={x + Math.cos(a) * r * 0.72} y2={y + Math.sin(a) * r * 0.72}
            stroke={color} strokeWidth={5} strokeLinecap="round" />;
        })}
      </svg>
    );
  };

export const GlowBloom: React.FC<{at: number; x: number; y: number; color?: string; size?: number; hold?: number; strength?: number}> =
  ({at, x, y, color = '#7A2A18', size = 900, hold = 1e9, strength = 0.9}) => {
    const f = useF();
    if (f < at) return null;
    const k = ramp(f, at, at + 8, EASE.out) * (1 - ramp(f, at + hold, at + hold + 20, EASE.linear));
    return <div style={{position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2, opacity: k * strength,
      background: `radial-gradient(circle, ${color} 0%, ${color}88 25%, transparent 62%)`}} />;
  };
