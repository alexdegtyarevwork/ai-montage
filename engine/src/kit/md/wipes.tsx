import React from 'react';
import {AbsoluteFill, interpolate, useVideoConfig} from 'remotion';
import {EASE, clamp, lerp, ramp, useF} from './core';

// Стыки «из предмета» (C, A, B): следующая сцена рождается из главного предмета текущей, а не из шаблонной шторки.
// Все обёртки кладутся поверх уходящей сцены и показывают входящую (children) по маске.

// Точка раздувается в фон (C f67–f75): радиус растёт в 1,65 раза за кадр (expo-in), 8 кадров до полного кадра.
export const DotFill: React.FC<{at: number; x: number; y: number; r0?: number; dur?: number; children: React.ReactNode}> =
  ({at, x, y, r0 = 46, dur = 8, children}) => {
    const f = useF();
    const {width: W, height: H} = useVideoConfig();
    if (f < at) return null;
    const rMax = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 4;
    const k = ramp(f, at, at + dur, EASE.linear);
    const r = r0 * Math.pow(rMax / r0, k);
    return <AbsoluteFill style={{clipPath: `circle(${r}px at ${x}px ${y}px)`}}>{children}</AbsoluteFill>;
  };

// Ирис: уходящая сцена (children) сжимается в круг, круг в точку, центр едет к якорю следующей главы (C f129–f135).
// Кладётся ПОВЕРХ входящей сцены. r по кадрам C: 484 → 454 → 399 → 304 → 152 → 33 (×2 в 2K).
export const IrisClose: React.FC<{at: number; dur?: number; from: [number, number]; to: [number, number]; r1?: number; children: React.ReactNode}> =
  ({at, dur = 6, from, to, r1 = 33, children}) => {
    const f = useF();
    const {width: W, height: H} = useVideoConfig();
    if (f >= at + dur) return null;
    const k = ramp(f, at, at + dur, EASE.in);
    const r0 = Math.hypot(W, H) / 2 + 10;
    const r = lerp(r0, r1, k);
    const x = lerp(from[0], to[0], k);
    const y = lerp(from[1], to[1], k);
    return <AbsoluteFill style={{clipPath: `circle(${r}px at ${x}px ${y}px)`}}>{children}</AbsoluteFill>;
  };

// Ступенчатая диагональная шторка (C f309–f314): столбики графика превращаются в лестницу, 6 кадров.
export const StairWipe: React.FC<{at: number; dur?: number; steps?: number; children: React.ReactNode}> = ({at, dur = 6, steps = 16, children}) => {
  const f = useF();
  const {width: W, height: H} = useVideoConfig();
  if (f < at) return null;
  const k = ramp(f, at, at + dur, EASE.inOut);
  const sw = W / steps;
  const pts: string[] = [`0px ${H}px`];
  const front = k * (W + H) * 1.05;
  for (let i = 0; i <= steps; i++) {
    const x0 = i * sw;
    const top = Math.max(-2, H - Math.max(0, front - x0));
    pts.push(`${x0}px ${top}px`, `${x0 + sw}px ${top}px`);
  }
  pts.push(`${W}px ${H}px`);
  return <AbsoluteFill style={{clipPath: `polygon(${pts.join(',')})`}}>{children}</AbsoluteFill>;
};

// Прямоугольник раскрывается в кадр (C карточка → фон, A поле ввода → окно игры): сначала ширина, потом высота.
export const RectGrow: React.FC<{at: number; dur?: number; rect: {x: number; y: number; w: number; h: number}; radius?: number;
  order?: 'wh' | 'both'; children: React.ReactNode}> = ({at, dur = 10, rect, radius = 48, order = 'wh', children}) => {
  const f = useF();
  const {width: W, height: H} = useVideoConfig();
  if (f < at) return null;
  const kw = order === 'wh' ? ramp(f, at, at + dur * 0.5, EASE.in) : ramp(f, at, at + dur, EASE.inOut);
  const kh = order === 'wh' ? ramp(f, at + dur * 0.35, at + dur, EASE.in) : kw;
  const x0 = lerp(rect.x, 0, kw);
  const x1 = lerp(rect.x + rect.w, W, kw);
  const y0 = lerp(rect.y, 0, kh);
  const y1 = lerp(rect.y + rect.h, H, kh);
  const r = radius * (1 - Math.min(kw, kh));
  return <AbsoluteFill style={{clipPath: `inset(${y0}px ${W - x1}px ${H - y1}px ${x0}px round ${r}px)`}}>{children}</AbsoluteFill>;
};

// Уход в белое засветкой (B 2,40–2,67): камера ускоряется вверх и внутрь, смаз, кадр выгорает в белый.
export const ExposureWhip: React.FC<{at: number; dur?: number; to?: string; children: React.ReactNode}> = ({at, dur = 8, to = '#FFFFFF', children}) => {
  const f = useF();
  const k = ramp(f, at, at + dur, EASE.in);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `translateY(${-k * 260}px) scale(${1 + k * 0.35})`, filter: k > 0 ? `blur(${k * 24}px) brightness(${1 + k * 0.8})` : undefined}}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{background: to, opacity: ramp(f, at + dur * 0.35, at + dur, EASE.in)}} />
    </AbsoluteFill>
  );
};

// Пиксели → резкость (A 5,00 с, на дропе): мозаика крупная → мельче → резко за 3 кадра. SVG-фильтр на любом слое.
export const Pixelate: React.FC<{at: number; sizes?: number[]; id?: string; children: React.ReactNode; style?: React.CSSProperties}> =
  ({at, sizes = [96, 36, 0], id = 'md-px', children, style}) => {
    const f = useF();
    const i = Math.floor(f - at);
    const s = i < 0 ? sizes[0] : sizes[Math.min(sizes.length - 1, i)];
    if (!s) return <div style={style}>{children}</div>;
    const fid = `${id}-${s}`;
    return (
      <div style={style}>
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <filter id={fid} x="0" y="0" width="100%" height="100%">
            <feFlood x={s / 2 - 1} y={s / 2 - 1} width={2} height={2} />
            <feComposite width={s} height={s} />
            <feTile result="t" />
            <feComposite in="SourceGraphic" in2="t" operator="in" />
            <feMorphology operator="dilate" radius={s / 2} />
          </filter>
        </svg>
        <div style={{filter: `url(#${fid})`}}>{children}</div>
      </div>
    );
  };

// Горизонтальный смаз-уход (A 22,6 с): строка уезжает рывком, размытие только по оси движения, гаснет.
export const SmearOut: React.FC<{at: number; dur?: number; dx?: number; id?: string; children: React.ReactNode}> = ({at, dur = 9, dx = -500, id = 'md-smear', children}) => {
  const f = useF();
  const k = ramp(f, at, at + dur, EASE.in);
  if (k <= 0) return <>{children}</>;
  const fid = `${id}-${Math.round(k * 20)}`;
  return (
    <div style={{transform: `translateX(${dx * k}px)`, opacity: 1 - ramp(f, at + dur * 0.4, at + dur, EASE.linear)}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={fid} x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation={`${k * 60} 0`} /></filter>
      </svg>
      <div style={{filter: `url(#${fid})`}}>{children}</div>
    </div>
  );
};

// Отъезд-раскрытие «это экран» (B 16,4 и 32,5 с): содержимое на весь кадр сжимается в экран устройства.
export const PullBack: React.FC<{at: number; dur?: number; screen: {x: number; y: number; w: number; h: number; r?: number}; device?: React.ReactNode;
  children: React.ReactNode}> = ({at, dur = 16, screen, device, children}) => {
  const f = useF();
  const {width: W, height: H} = useVideoConfig();
  const k = ramp(f, at, at + dur, EASE.inOut);
  const s = lerp(1, Math.max(screen.w / W, screen.h / H), k);
  const cx = lerp(W / 2, screen.x + screen.w / 2, k);
  const cy = lerp(H / 2, screen.y + screen.h / 2, k);
  const iw = lerp(W, screen.w, k);
  const ih = lerp(H, screen.h, k);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{opacity: k}}>{device}</AbsoluteFill>
      <div style={{position: 'absolute', left: cx - iw / 2, top: cy - ih / 2, width: iw, height: ih, overflow: 'hidden', borderRadius: (screen.r ?? 0) * k}}>
        <div style={{position: 'absolute', left: iw / 2 - W / 2, top: ih / 2 - H / 2, width: W, height: H, transform: `scale(${s})`}}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

export const fadeBetween = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
