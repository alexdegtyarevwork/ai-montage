import React from 'react';
import {interpolate, interpolateColors, random} from 'remotion';
import {EASE, clamp, measure, ramp, useF} from './core';

type Css = React.CSSProperties;

// Подъём из-под маски (буква уезжает на 135 % высоты: при 105 % из-под маски выглядывают точки «Ё» и верхушки букв).
// C «КАЖДОЕ», «РИЛ», «ОДИН ПРОМПТ», «neurofam»): буква выезжает снизу из-за линии строки.
// order: left — слева направо, center — от середины к краям (C «ШОУ»: сначала «О», потом «Ш» и «У»), line — строка целиком.
export const MaskRise: React.FC<{text: string; at: number; stagger?: number; dur?: number; order?: 'left' | 'center' | 'line'; style?: Css; exitAt?: number}> =
  ({text, at, stagger = 1, dur = 4, order = 'left', style, exitAt}) => {
    const f = useF();
    const chars = [...text];
    const mid = (chars.length - 1) / 2;
    const exit = exitAt === undefined ? 0 : ramp(f, exitAt, exitAt + 5, EASE.in);
    return (
      <span style={{display: 'inline-block', whiteSpace: 'pre', ...style}}>
        {chars.map((c, i) => {
          const idx = order === 'line' ? 0 : order === 'center' ? Math.round(Math.abs(i - mid)) : i;
          const k = ramp(f, at + idx * stagger, at + idx * stagger + dur, EASE.out);
          return (
            <span key={i} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.06em', marginBottom: '-0.06em', paddingTop: '0.16em', marginTop: '-0.16em'}}>
              <span style={{display: 'inline-block', transform: `translateY(${(1 - k) * 135 - exit * 135}%)`}}>{c}</span>
            </span>
          );
        })}
      </span>
    );
  };

// Влёт с наклоном (C «СЛОВО», 3,03 с): справа, skewX −15° → 0, 7 кадров expo-out, без отскока.
export const SkewSlide: React.FC<{at: number; from?: number; dur?: number; skew?: number; children: React.ReactNode; style?: Css}> =
  ({at, from = 900, dur = 7, skew = -15, children, style}) => {
    const f = useF();
    const k = ramp(f, at, at + dur, EASE.out);
    if (f < at) return <span style={{display: 'inline-block', visibility: 'hidden', ...style}}>{children}</span>;
    return <span style={{display: 'inline-block', transform: `translateX(${(1 - k) * from}px) skewX(${(1 - k) * skew}deg)`, ...style}}>{children}</span>;
  };

// Вход из расфокуса (C «В ТАКТ», B «Learn it»): масштаб 1,33 → 1, размытие → 0, 6 кадров.
export const FocusIn: React.FC<{at: number; dur?: number; scale?: number; blur?: number; children: React.ReactNode; style?: Css}> =
  ({at, dur = 6, scale = 1.33, blur = 16, children, style}) => {
    const f = useF();
    const k = ramp(f, at, at + dur, EASE.out);
    return <span style={{display: 'inline-block', opacity: f < at ? 0 : Math.min(1, k * 3), transform: `scale(${scale + (1 - scale) * k})`,
      filter: `blur(${(1 - k) * blur}px)`, ...style}}>{children}</span>;
  };

// Слово «садится» на строку (подпись A): появляется маленьким (60 %), приподнятым и тусклым, за 3 кадра встаёт в строку.
// Строка растёт по словам и всё время стоит по центру: ширина слова раскрывается вместе с ним (замер заранее).
// font — полная запись CSS («300 92px "SF Pro Display"»), size — тот же кегль числом (для отступов).
export type TimedWord = {text: string; at: number; accent?: boolean};
// ghost — за сколько кадров до своего времени слово уже висит на месте размытым «призраком» 30 % (A 2,0–2,3 с:
// искра проходит под строкой, и призрак становится резким). breathe — строка сначала собирается плотно, межсловные
// интервалы раскрываются к концу фразы за 10 кадров (A «Nowtakesa single» → «Now takes a single thought.»).
export const SettleLine: React.FC<{words: TimedWord[]; font: string; size: number; color: string; accent?: string; settle?: number;
  gap?: number; style?: Css; mode?: 'super' | 'blur'; ghost?: number; breathe?: boolean}> =
  ({words, font, size, color, accent = '#DE4E2C', settle = 3, gap = 0.28, style, mode = 'super', ghost = 0, breathe = false}) => {
    const f = useF();
    const last = words[words.length - 1].at;
    const g = breathe ? gap * (0.35 + 0.65 * ramp(f, last + settle, last + settle + 10, EASE.inOut)) : gap;
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'baseline', whiteSpace: 'nowrap', font, ...style}}>
        {words.map((w, i) => {
          const wpx = measure(w.text, font) + g * size;
          const color_ = w.accent ? accent : color;
          if (f < w.at) {
            if (!ghost || f < w.at - ghost) return null;
            return (
              <span key={i} style={{display: 'inline-block', width: wpx}}>
                <span style={{opacity: 0.3, filter: 'blur(6px)', color: color_}}>{w.text}</span>
              </span>
            );
          }
          const open = ghost ? 1 : ramp(f, w.at, w.at + settle + 1, EASE.out);
          const k = ramp(f, w.at, w.at + settle, EASE.out);
          const xf = mode === 'super' ? `translateY(${(1 - k) * -0.45}em) scale(${0.6 + 0.4 * k})` : `translateY(${(1 - k) * 0.25}em)`;
          return (
            <span key={i} style={{display: 'inline-block', width: wpx * open, overflow: 'visible'}}>
              <span style={{display: 'inline-block', transformOrigin: '0% 100%', transform: xf, opacity: 0.55 + 0.45 * k,
                filter: mode === 'blur' ? `blur(${(1 - k) * 12}px)` : undefined, color: color_}}>{w.text}</span>
            </span>
          );
        })}
      </div>
    );
  };

// Предложение по словам (B). layout='final' (как в референсе, замер 2,8–4,8 с): строка сразу разложена на финальных
// местах и стоит по центру своей полной длины, на местах следующих слов стоят точки, слово встаёт на место своей точки,
// начало строки не двигается. layout='grow': строка растёт по словам и плавно перецентрируется (вариант для длинных фраз).
// Новое слово светлое и темнеет за 12 кадров. Слову можно отдать render — на его месте рисуется своё (B: слово
// подпрыгивает и превращается в гроздь иконок), а collapseAt схлопывает его место, и строка плавно сдвигается.
export type LineWord = TimedWord & {render?: (f: number) => React.ReactNode; width?: number; collapseAt?: number};
export const WordLine: React.FC<{words: LineWord[]; font: string; size: number; fresh?: string; ink?: string; dots?: number; dotColor?: string;
  layout?: 'final' | 'grow'; style?: Css}> =
  ({words, font, size, fresh = '#A68BEA', ink = '#200B44', dots = 2, dotColor = '#2A1060', layout = 'final', style}) => {
    const f = useF();
    const pending = words.map((w, i) => (f < w.at ? i : -1)).filter((i) => i >= 0);
    const dotted = new Set(pending.slice(0, dots));
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap', font, ...style}}>
        {words.map((w, i) => {
          const wpx = (w.width ?? measure(w.text, font)) + 0.27 * size;
          const collapse = w.collapseAt === undefined ? 1 : 1 - ramp(f, w.collapseAt, w.collapseAt + 7, EASE.inOut);
          if (f < w.at) {
            if (layout === 'grow') return null;
            const show = dotted.has(i) ? 1 - ramp(f, w.at - 3, w.at, EASE.linear) : 0;
            return (
              <span key={i} style={{display: 'inline-block', width: wpx, textAlign: 'center'}}>
                <span style={{display: 'inline-block', width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: dotColor, opacity: show}} />
              </span>
            );
          }
          const open = (layout === 'grow' ? ramp(f, w.at, w.at + 5, EASE.out) : 1) * collapse;
          const col = interpolateColors(f, [w.at + 2, w.at + 14], [fresh, ink]);
          return (
            <span key={i} style={{display: 'inline-block', width: wpx * open, position: 'relative'}}>
              {w.render ? w.render(f) : <span style={{color: col, opacity: Math.min(1, (f - w.at) / 3)}}>{w.text}</span>}
            </span>
          );
        })}
        {layout === 'grow' && Array.from({length: Math.min(dots, pending.length)}, (_, i) => (
          <span key={`d${i}`} style={{display: 'inline-block', width: size * 1.6, textAlign: 'center'}}>
            <span style={{display: 'inline-block', width: size * 0.2, height: size * 0.2, borderRadius: '50%', background: dotColor}} />
          </span>
        ))}
      </div>
    );
  };

// Уголки видоискателя (B 3,40–3,93): верхний левый уголок встаёт на место следующего слова, нижний правый отъезжает
// на его ширину — рамка заранее показывает размер слова; гаснет, когда слово появилось.
export const ViewCorners: React.FC<{at: number; until: number; x: number; y: number; w: number; h: number; color?: string; arm?: number; stroke?: number}> =
  ({at, until, x, y, w, h, color = '#A68BEA', arm = 22, stroke = 3}) => {
    const f = useF();
    if (f < at || f > until + 4) return null;
    const k = ramp(f, at + 2, at + 9, EASE.out);
    const o = 1 - ramp(f, until, until + 4, EASE.linear);
    const x1 = x + w * k;
    const y1 = y + h * k;
    return (
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: o}} width={1} height={1}>
        <path d={`M${x} ${y + arm}V${y}H${x + arm}`} fill="none" stroke={color} strokeWidth={stroke} />
        <path d={`M${x1 - arm} ${y1}H${x1}V${y1 - arm}`} fill="none" stroke={color} strokeWidth={stroke} opacity={ramp(f, at + 1, at + 3)} />
      </svg>
    );
  };

// Штрихи-разрезы (B 3,93–4,13): тонкие вертикальные линии прорезают кадр сверху и снизу в момент появления слова, ≈ 6 кадров.
export const SlashLines: React.FC<{at: number; xs: number[]; y0: number; y1: number; color?: string; width?: number; dur?: number}> =
  ({at, xs, y0, y1, color = '#2A1060', width = 2, dur = 6}) => {
    const f = useF();
    if (f < at || f > at + dur) return null;
    const k = ramp(f, at, at + dur, EASE.out);
    return (
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {xs.map((x, i) => {
          const down = i % 2 === 0;
          const len = (y1 - y0) * 0.45;
          const head = down ? y0 + (y1 - y0) * k : y1 - (y1 - y0) * k;
          return <line key={i} x1={x} x2={x} y1={head - (down ? len : -len) * (1 - k)} y2={head} stroke={color} strokeWidth={width} opacity={1 - k * 0.6} />;
        })}
      </svg>
    );
  };

// Уход слова стиранием слева направо со сжатием на 6 % (B «Learn it», «Do it» 39,13 и 39,80 с).
export const EraseLeft: React.FC<{at: number; dur?: number; children: React.ReactNode; style?: Css}> = ({at, dur = 4, children, style}) => {
  const f = useF();
  const k = ramp(f, at, at + dur, EASE.in);
  const s = 1 - 0.06 * ramp(f, at - 6, at, EASE.in);
  return <span style={{display: 'inline-block', transform: `scale(${s})`, clipPath: `inset(-20% -5% -20% ${k * 105}%)`, ...style}}>{children}</span>;
};

// Печать с кареткой (C «Сделай шоурил…» ≈ 60 знаков/с, B «Make it Done|»).
export const TypeOn: React.FC<{text: string; at: number; cps?: number; caret?: string | false; style?: Css; caretColor?: string}> =
  ({text, at, cps = 40, caret = '|', style, caretColor}) => {
    const f = useF();
    const n = Math.max(0, Math.min(text.length, Math.floor(((f - at) * cps) / 30)));
    const blink = Math.floor(f / 8) % 2 === 0 || (n > 0 && n < text.length);
    return (
      <span style={{whiteSpace: 'pre-wrap', ...style}}>
        {text.slice(0, n)}
        {caret !== false && f >= at - 15 && <span style={{opacity: blink ? 1 : 0, color: caretColor, fontWeight: 300}}>{caret}</span>}
      </span>
    );
  };

// Расшифровка (A код и console.log, C подпись): случайные знаки складываются в текст слева направо;
// resolved(i, f) можно отдать снаружи — например, «знак под линзой» для лупы A.
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789{}[]()<>/\\=+*#%&$@!?;:АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
export const Scramble: React.FC<{text: string; at: number; dur?: number; seed?: string; style?: Css; resolved?: (i: number, f: number) => boolean;
  colorOf?: (i: number) => string | undefined; step?: number}> =
  ({text, at, dur = 18, seed = 's', style, resolved, colorOf, step = 2}) => {
    const f = useF();
    if (f < at) return <span style={{...style, opacity: 0}}>{text}</span>;
    const tick = Math.floor(f / step);
    return (
      <span style={{whiteSpace: 'pre', ...style}}>
        {[...text].map((c, i) => {
          const done = resolved ? resolved(i, f) : f >= at + (i / Math.max(1, text.length)) * dur + 2;
          const g = c === ' ' || done ? c : GLYPHS[Math.floor(random(`${seed}-${i}-${tick}`) * GLYPHS.length)];
          return <span key={i} style={{color: colorOf?.(i), opacity: done ? 1 : 0.55}}>{g}</span>;
        })}
      </span>
    );
  };

// Горячий текст остывает (A «Claude Fable 5»): буквы оранжевые и плотные, за 10 кадров кремовые и с нормальной разрядкой.
export const CoolDown: React.FC<{at: number; dur?: number; hot?: string; cool?: string; children: React.ReactNode; style?: Css}> =
  ({at, dur = 10, hot = '#FF7A3D', cool = '#F3E6D0', children, style}) => {
    const f = useF();
    const k = ramp(f, at, at + dur, EASE.inOut);
    return <span style={{color: interpolateColors(k, [0, 1], [hot, cool]), letterSpacing: `${-0.06 + 0.06 * k}em`,
      textShadow: `0 0 ${18 + (1 - k) * 30}px ${interpolateColors(k, [0, 1], ['rgba(255,110,40,.9)', 'rgba(255,170,110,.45)'])}`, ...style}}>{children}</span>;
  };

// Эхо-экструзия (C f46–f49): за заголовком стопка контурных копий в акцентном цвете со сдвигом.
export const EchoStack: React.FC<{at: number; n?: number; dx?: number; dy?: number; color?: string; stroke?: number; children: React.ReactNode; style?: Css}> =
  ({at, n = 4, dx = 7, dy = -9, color = '#DE4E2C', stroke = 2, children, style}) => {
    const f = useF();
    return (
      <span style={{position: 'relative', display: 'inline-block', ...style}}>
        {Array.from({length: n}, (_, i) => {
          const k = ramp(f, at + i, at + i + 4, EASE.out);
          return <span key={i} aria-hidden style={{position: 'absolute', left: 0, top: 0, transform: `translate(${dx * (i + 1) * k}px, ${dy * (i + 1) * k}px)`,
            color: 'transparent', WebkitTextStroke: `${stroke}px ${color}`, opacity: k * (1 - i / (n + 1))}}>{children}</span>;
        })}
        <span style={{position: 'relative'}}>{children}</span>
      </span>
    );
  };

// Барабан подписи (C «ТОЧКА → КВАДРАТ…»): старое слово уезжает вверх под маску, новое поднимается снизу.
export const RollLabel: React.FC<{items: {at: number; text: string}[]; dur?: number; style?: Css}> = ({items, dur = 5, style}) => {
  const f = useF();
  let cur = 0;
  items.forEach((it, i) => { if (f >= it.at) cur = i; });
  const k = ramp(f, items[cur].at, items[cur].at + dur, EASE.out);
  const prev = cur > 0 ? items[cur - 1].text : null;
  return (
    <span style={{position: 'relative', display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', ...style}}>
      <span style={{display: 'inline-block', transform: `translateY(${(1 - k) * 100}%)`}}>{items[cur].text}</span>
      {prev && k < 1 && <span style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${-k * 100}%)`}}>{prev}</span>}
    </span>
  );
};

// Счётчик прогресса (C 11,47–11,93): 2 кадра серым «0%», потом новое число каждый кадр
// 19, 35, 49, 61, 70, 78, 85, 90, 94, 96, 98, 99, 100 — 13 кадров, ease-out.
export const Counter: React.FC<{at: number; dur?: number; to?: number; suffix?: string; pre?: number; dim?: string; style?: Css}> =
  ({at, dur = 13, to = 100, suffix = '%', pre = 2, dim = '#A5A39E', style}) => {
    const f = useF();
    const t = Math.floor(f - at - pre);
    const v = t < 0 ? 0 : Math.round(interpolate(t + 1, [0, dur], [0, to], {...clamp, easing: EASE.out}));
    return <span style={{fontVariantNumeric: 'tabular-nums', color: t < 0 ? dim : undefined, ...style}}>{v}{suffix}</span>;
  };
