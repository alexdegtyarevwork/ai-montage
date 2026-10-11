import React from 'react';
import {interpolate} from 'remotion';
import {EASE, clamp, lerp, measure, ramp, useF} from './core';

type Css = React.CSSProperties;

// Кольцо коллажа вокруг фразы (B 11,2–13,1 с): карточки на эллипсе медленно вращаются, дальние меньше и размыты.
export const OrbitRing: React.FC<{items: React.ReactNode[]; cx: number; cy: number; rx: number; ry: number; at?: number; speed?: number; size?: number}> =
  ({items, cx, cy, rx, ry, at = 0, speed = 0.12, size = 220}) => {
    const f = useF();
    const t = (f - at) / 30;
    const n = items.length;
    return (
      <>
        {items.map((it, i) => {
          const a = (i / n) * Math.PI * 2 + t * speed;
          const depth = (Math.sin(a) + 1) / 2;
          const k = ramp(f, at + i * 1.5, at + i * 1.5 + 9, EASE.back);
          const s = lerp(0.72, 1.06, depth) * k;
          return (
            <div key={i} style={{position: 'absolute', left: cx + Math.cos(a) * rx - size / 2, top: cy + Math.sin(a) * ry - size / 2, width: size, height: size,
              transform: `scale(${s})`, zIndex: Math.round(depth * 100), filter: depth < 0.3 ? `blur(${(0.3 - depth) * 14}px)` : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{it}</div>
          );
        })}
      </>
    );
  };

// Предмет-слот внутри фразы (B «New [наушники → камера → ноутбук …] product»): соседние слова расступаются,
// предметы сменяются каруселью, ≈ 4 кадра на смену, со смазом по горизонтали.
export const InlineSlot: React.FC<{items: {at: number; node: React.ReactNode}[]; w: number; h: number; swap?: number; style?: Css}> =
  ({items, w, h, swap = 4, style}) => {
    const f = useF();
    const open = ramp(f, items[0].at, items[0].at + 6, EASE.back);
    let cur = 0;
    items.forEach((it, i) => { if (f >= it.at) cur = i; });
    const k = cur === 0 ? 1 : ramp(f, items[cur].at, items[cur].at + swap, EASE.out);
    const slot = (node: React.ReactNode, x: number, o: number, blur: number, key: React.Key) => (
      <div key={key} style={{position: 'absolute', left: 0, top: 0, width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translateX(${x}px)`, opacity: o, filter: blur > 0.5 ? `blur(${blur}px)` : undefined}}>{node}</div>
    );
    return (
      <span style={{display: 'inline-block', position: 'relative', width: w * open, height: h, verticalAlign: 'middle', ...style}}>
        <span style={{position: 'absolute', left: (w * open - w) / 2, top: 0, width: w, height: h, transform: `scale(${open})`}}>
          {cur > 0 && k < 1 && slot(items[cur - 1].node, -k * w * 0.8, 1 - k, k * 18, 'prev')}
          {slot(items[cur].node, (1 - k) * w * 0.8, k, (1 - k) * 18, 'cur')}
        </span>
      </span>
    );
  };

// Надпись рядом со знаком, связка всё время по центру кадра (родитель — flex по центру).
// mode='behind' (B 14,57–14,90, замер): слово выезжает из-за знака вправо — каждая новая буква появляется вплотную
//   к знаку и толкает слово, видно сначала конец слова («o» → «Do» → «wDo» → «HowDo»), 10 кадров.
// mode='wipe' (B 41,8–42,1): надпись открывается шторкой слева направо («H» → «Ho» → «HowD»), связка съезжает влево.
export const MarkReveal: React.FC<{at: number; mark: React.ReactNode; text: string; font: string; dur?: number; gap?: number; mode?: 'behind' | 'wipe';
  style?: Css}> = ({at, mark, text, font, dur = 10, gap = 18, mode = 'behind', style}) => {
  const f = useF();
  const w = measure(text, font) + 4;
  const k = ramp(f, at, at + dur, mode === 'behind' ? EASE.out : EASE.inOut);
  return (
    <div style={{display: 'flex', alignItems: 'center', whiteSpace: 'pre', font, ...style}}>
      <div style={{display: 'flex', position: 'relative', zIndex: 2}}>{mark}</div>
      <div style={{width: (w + gap) * k, overflow: 'hidden', display: 'flex', justifyContent: mode === 'behind' ? 'flex-end' : 'flex-start'}}>
        <span style={{display: 'inline-block', paddingLeft: gap, flex: 'none'}}>{text}</span>
      </div>
    </div>
  );
};

// Барабан страниц (A 12,9–15,0 с): страницы на цилиндре, ось горизонтальная, перекатываются сверху.
export const PageDrum: React.FC<{pages: React.ReactNode[]; w: number; h: number; angle: number; radius?: number; style?: Css}> =
  ({pages, w, h, angle, radius, style}) => {
    const n = pages.length;
    const step = 360 / Math.max(n, 6);
    const R = radius ?? h / 2 / Math.tan(((step / 2) * Math.PI) / 180);
    return (
      <div style={{position: 'relative', width: w, height: h, perspective: 2600, ...style}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${-R}px) rotateX(${-angle}deg)`}}>
          {pages.map((p, i) => (
            <div key={i} style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: `rotateX(${i * step}deg) translateZ(${R}px)`}}>{p}</div>
          ))}
        </div>
      </div>
    );
  };

// Экран-кинескоп (A 9,5–12,5 с): выпуклые края, ореол, «прогрев» яркости при появлении.
export const CrtScreen: React.FC<{w: number; h: number; at?: number; warm?: number; children: React.ReactNode; style?: Css}> =
  ({w, h, at = 0, warm = 10, children, style}) => {
    const f = useF();
    const k = ramp(f, at, at + warm, EASE.out);
    return (
      <div style={{position: 'relative', width: w, height: h, borderRadius: `${w * 0.06}px / ${h * 0.1}px`, overflow: 'hidden',
        boxShadow: `0 0 ${80 * k}px ${10 * k}px rgba(255,236,210,${0.25 * k})`, ...style}}>
        <div style={{position: 'absolute', inset: 0, filter: `brightness(${0.35 + 0.65 * k}) saturate(${0.6 + 0.4 * k})`}}>{children}</div>
        <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${w * 0.06}px rgba(0,0,0,.55)`,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.08), transparent 60%)'}} />
      </div>
    );
  };

// Лупа (A 18,7–19,5 с): кольцо с ручкой; знаки под стеклом расшифровываются (передать lensX в Scramble.resolved).
export const Magnifier: React.FC<{x: number; y: number; r: number; color?: string; handle?: number; width?: number}> =
  ({x, y, r, color = '#FF7A3D', handle = 1, width = 6}) => (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={width} style={{filter: `drop-shadow(0 0 10px ${color})`}} />
      {handle > 0 && <line x1={x - r * 0.72} y1={y + r * 0.72} x2={x - r * (0.72 + 0.6 * handle)} y2={y + r * (0.72 + 0.6 * handle)} stroke={color}
        strokeWidth={width * 1.4} strokeLinecap="round" />}
    </svg>
  );

// Кнопка с наведением и нажатием (B 22,5–23,8 с): заливка слева направо, нажатие сжимает, отпускание гасит.
export const PressButton: React.FC<{hoverAt: number; pressAt: number; w: number; h: number; base: string; fill: string; children: React.ReactNode; style?: Css}> =
  ({hoverAt, pressAt, w, h, base, fill, children, style}) => {
    const f = useF();
    const fillK = ramp(f, hoverAt, hoverAt + 9, EASE.inOut);
    const press = interpolate(f, [pressAt, pressAt + 3, pressAt + 8], [1, 0.9, 1], {...clamp, easing: EASE.out});
    return (
      <div style={{position: 'relative', width: w, height: h, borderRadius: h / 2, overflow: 'hidden', background: base, transform: `scale(${press})`, ...style}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fillK * 100}%`, background: fill}} />
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</div>
      </div>
    );
  };
