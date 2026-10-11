import React from 'react';
import {AbsoluteFill, interpolate, useVideoConfig} from 'remotion';
import {EASE, clamp, ramp, timecode, useF} from './core';

type Css = React.CSSProperties;

// ——— Фактура «тёплой плёнки» (A) ———

// Зерно: шум меняется на каждой «двойке», а не на каждом кадре — иначе кипит.
export const Grain: React.FC<{opacity?: number; step?: number; freq?: number}> = ({opacity = 0.09, step = 2, freq = 0.9}) => {
  const f = useF();
  const seed = Math.floor(f / step) % 97;
  return (
    <AbsoluteFill style={{mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}}>
      <svg width="100%" height="100%">
        <filter id={`md-grain-${seed}`}><feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter={`url(#md-grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{strength?: number; color?: string}> = ({strength = 0.75, color = '0,0,0'}) => (
  <AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse 75% 62% at 50% 50%, rgba(${color},0) 55%, rgba(${color},${strength}) 100%)`}} />
);

// Ореол (halation): яркое светится своим цветом. Копия слоя размывается и ложится «экраном».
export const Halation: React.FC<{children: React.ReactNode; radius?: number; strength?: number; tint?: string}> =
  ({children, radius = 22, strength = 0.75, tint = 'sepia(.6) saturate(2.2) hue-rotate(-18deg)'}) => (
    <AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{mixBlendMode: 'screen', opacity: strength, filter: `blur(${radius}px) ${tint}`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );

// Хроматизм на крупных планах: красный канал влево, зелёно-синий вправо (только на тёмном фоне).
export const Chroma: React.FC<{px?: number; id?: string; children: React.ReactNode; style?: Css}> = ({px = 4, id = 'md-ca', children, style}) => {
  if (px <= 0.2) return <div style={style}>{children}</div>;
  const fid = `${id}-${Math.round(px * 10)}`;
  return (
    <div style={style}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={fid} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={-px} result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset in="gb" dx={px} result="gb2" />
          <feBlend in="r2" in2="gb2" mode="screen" />
        </filter>
      </svg>
      <div style={{filter: `url(#${fid})`}}>{children}</div>
    </div>
  );
};

// Растр экрана (A наезд ×3): сетка точек проступает поверх крупного плана, как макро на мониторе.
export const ScreenDoor: React.FC<{cell?: number; opacity?: number}> = ({cell = 9, opacity = 0.5}) => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'multiply', opacity,
    background: `radial-gradient(circle, rgba(255,255,255,1) 38%, rgba(0,0,0,1) 62%) 0 0 / ${cell}px ${cell}px`}} />
);

// Живое свечение снизу (A): три размытых тёплых пятна медленно переливаются.
export const EmberGlow: React.FC<{y?: number; intensity?: number; colors?: [string, string, string]}> =
  ({y = 0.9, intensity = 1, colors = ['#C2461F', '#8E2A14', '#E0603A']}) => {
    const f = useF();
    const {width: W, height: H} = useVideoConfig();
    const t = f / 30;
    const blob = (i: number, w: number, h: number, dx: number, c: string) => (
      <div key={i} style={{position: 'absolute', left: W / 2 - w / 2 + Math.sin(t * 0.6 + i * 2) * dx, top: H * y - h / 2 + Math.cos(t * 0.45 + i) * h * 0.08,
        width: w, height: h, borderRadius: '50%', background: c, filter: `blur(${w * 0.16}px)`, opacity: 0.85 * intensity}} />
    );
    return (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        {blob(0, W * 1.2, H * 0.22, W * 0.08, colors[1])}
        {blob(1, W * 0.75, H * 0.16, W * 0.12, colors[0])}
        {blob(2, W * 0.35, H * 0.08, W * 0.18, colors[2])}
      </AbsoluteFill>
    );
  };

// ——— Плакат с HUD (C) ———

// Полутоновая сетка точек, проявляется от центра (C глава ФОРМЫ).
export const DotGrid: React.FC<{at?: number; cell?: number; color?: string; cx?: number; cy?: number; dur?: number; max?: number}> =
  ({at = 0, cell = 96, color = '#5C594F', cx, cy, dur = 12, max = 7}) => {
    const f = useF();
    const {width: W, height: H} = useVideoConfig();
    const X = cx ?? W / 2;
    const Y = cy ?? H / 2;
    const reach = ramp(f, at, at + dur, EASE.out) * Math.hypot(W, H) * 0.7;
    const dots: React.ReactNode[] = [];
    for (let y = cell / 2; y < H; y += cell) {
      for (let x = cell / 2; x < W; x += cell) {
        const d = Math.hypot(x - X, y - Y);
        if (d > reach) continue;
        const r = max * (0.45 + 0.55 * Math.abs(Math.sin(x * 0.013 + y * 0.021)));
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={r * interpolate(reach - d, [0, 120], [0, 1], clamp)} fill={color} />);
      }
    }
    return <AbsoluteFill style={{pointerEvents: 'none'}}><svg width={W} height={H}>{dots}</svg></AbsoluteFill>;
  };

// Сетка: tilt 1 — перспективный пол (C ОБЪЁМ), tilt 0 — плоская сетка графика (C КРИВЫЕ). Переход между ними — стык.
export const FloorGrid: React.FC<{tilt: number; cell?: number; color?: string; opacity?: number}> = ({tilt, cell = 120, color = '#3C3C38', opacity = 1}) => (
  <AbsoluteFill style={{perspective: 1600, perspectiveOrigin: '50% 35%', pointerEvents: 'none', opacity}}>
    <AbsoluteFill style={{transformOrigin: '50% 100%', transform: `translateY(${tilt * 300}px) rotateX(${tilt * 72}deg) scale(${1 + tilt * 1.6})`,
      backgroundImage: `linear-gradient(${color} 2px, transparent 2px), linear-gradient(90deg, ${color} 2px, transparent 2px)`,
      backgroundSize: `${cell}px ${cell}px`, backgroundPosition: 'center center',
      maskImage: tilt > 0.05 ? 'linear-gradient(to bottom, transparent 0%, black 45%)' : undefined}} />
  </AbsoluteFill>
);

// HUD C: подпись сверху слева, таймкод сверху справа (настоящий номер кадра), глава снизу слева, бренд снизу справа,
// линейка с засечками глав и заливкой прогресса. Цвет меняется под фон главы.
export const Hud: React.FC<{title: string; brand: string; chapters: {at: number; name: string}[]; total: number; ink: string; dim?: string;
  box: {x0: number; x1: number; top: number; bottom: number}; size?: number; font?: string; rightTop?: React.ReactNode; leftBottom?: React.ReactNode}> =
  ({title, brand, chapters, total, ink, dim, box, size = 44, font = '"SF Pro Display"', rightTop, leftBottom}) => {
    const f = useF();
    const {width: W} = useVideoConfig();
    let ci = 0;
    chapters.forEach((c, i) => { if (f >= c.at) ci = i; });
    const label: Css = {position: 'absolute', font: `600 ${size}px ${font}`, letterSpacing: '0.14em', color: ink, whiteSpace: 'nowrap'};
    const w = box.x1 - box.x0;
    const prog = Math.min(1, f / total);
    return (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        <div style={{...label, left: box.x0, top: box.top}}>{title}</div>
        <div style={{...label, right: W - box.x1, top: box.top, fontVariantNumeric: 'tabular-nums'}}>{rightTop ?? timecode(f)}</div>
        <div style={{...label, left: box.x0, top: box.bottom - size * 1.9}}>{leftBottom ?? `${String(ci).padStart(2, '0')} — ${chapters[ci].name}`}</div>
        <div style={{...label, right: W - box.x1, top: box.bottom - size * 1.9}}>{brand}</div>
        <div style={{position: 'absolute', left: box.x0, top: box.bottom, width: w, height: 3, background: dim ?? ink, opacity: 0.35}} />
        <div style={{position: 'absolute', left: box.x0, top: box.bottom, width: w * prog, height: 3, background: ink}} />
        {chapters.slice(1).map((c, i) => (
          <div key={i} style={{position: 'absolute', left: box.x0 + (w * c.at) / total - 1.5, top: box.bottom - 10, width: 3, height: 23, background: ink,
            opacity: f >= c.at ? 1 : 0.45}} />
        ))}
      </AbsoluteFill>
    );
  };

// Эквалайзер HUD (C ТИПОГРАФИКА): полоски прыгают на долю.
export const BeatBars: React.FC<{beat: number; offset?: number; n?: number; color: string; h?: number; w?: number}> = ({beat, offset = 0, n = 9, color, h = 40, w = 7}) => {
  const f = useF();
  const ph = ((f - offset) % beat) / beat;
  return (
    <div style={{display: 'flex', gap: 7, alignItems: 'flex-end', height: h}}>
      {Array.from({length: n}, (_, i) => {
        const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + Math.floor((f - offset) / beat) * 2.3)) * (1 - ph * 0.7);
        return <div key={i} style={{width: w, height: h * v, background: color}} />;
      })}
    </div>
  );
};

export const fadeIn = (f: number, at: number, dur = 6) => ramp(f, at, at + dur, EASE.out);
