import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {
  Cues, EASE, EraseLeft, ExposureWhip, FocusIn, ICONS, Icon, InlineSlot, MarkReveal, MaskRise, PopIn, SlashLines, TypeOn, ViewCorners, WordLine, lerp,
  measure, ramp, riserTo, useF,
  type Cue, type LineWord,
} from '../../kit/md';

// Стиль 17 СЛОВА — образец по референсу B («HowDo, слова и иконки»): речь пишет экран. Белый лист с лавандовой дымкой,
// фраза собирается по словам в центре, слова превращаются в иконки, предмет-слот внутри фразы, разборка слова
// с направляющими, знак-кольцо, из которого выезжает надпись. Время — кадры 30 fps.
const INK = '#200B44';
const FRESH = '#A68BEA';
const ACC = '#8B5CF6';
const SANS = 'Manrope, sans-serif';
export const SLOVA_SECONDS = 11.5;

// Глянцевое кольцо-знак (B 13,8 с): конический градиент по кольцу медленно вращается, блик сверху.
const RingMark: React.FC<{size: number; spin?: number; tone?: 'violet' | 'white'}> = ({size, spin = 0, tone = 'violet'}) => {
  const c = tone === 'white' ? ['#FFFFFF', '#D9E4F2', '#FFFFFF', '#BFD0E6', '#FFFFFF'] : ['#6D28D9', '#C4A1FF', '#7C3AED', '#E9D5FF', '#6D28D9'];
  return (
    <div style={{width: size, height: size, borderRadius: '50%', background: `conic-gradient(from ${spin}deg, ${c.join(', ')})`,
      WebkitMaskImage: `radial-gradient(circle, transparent ${size * 0.27}px, #000 ${size * 0.28}px, #000 ${size * 0.49}px, transparent ${size * 0.5}px)`,
      maskImage: `radial-gradient(circle, transparent ${size * 0.27}px, #000 ${size * 0.28}px, #000 ${size * 0.49}px, transparent ${size * 0.5}px)`,
      boxShadow: 'inset 0 10px 30px rgba(255,255,255,.6)', filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.08}px rgba(76,29,149,.35))`}} />
  );
};

// Лавандовая дымка снизу (B): размытые «горы» медленно плывут.
const Mist: React.FC<{opacity?: number}> = ({opacity = 1}) => {
  const f = useF();
  const t = f / 30;
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{position: 'absolute', left: -200 + i * 380 + Math.sin(t * 0.4 + i) * 60, top: 1990 + (i % 2) * 90, width: 640, height: 420,
          borderRadius: '50%', background: i % 2 ? '#C9B8FA' : '#B6A1F6', filter: 'blur(70px)', opacity: 0.8}} />
      ))}
      <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(255,255,255,0) 70%, rgba(186,164,248,.55) 100%)'}} />
    </AbsoluteFill>
  );
};

const OBJ = ['laptop', 'mic', 'book', 'heart', 'hourglass', 'scissors', 'coins', 'gift-box'];
const objImg = (name: string, size: number) => <Img src={staticFile(`objects/${name}.webp`)} style={{width: size, height: size, objectFit: 'contain'}} />;

// ——— 1. Вступление: знак, вокруг выпрыгивают предметы, надпись поднимается; уход в белое засветкой ———
const Intro: React.FC = () => {
  const f = useF();
  const push = 1 + 0.12 * ramp(f, 0, 72, EASE.linear);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg, #B79CF6 0%, #E7D9F4 45%, #F7DCCB 100%)'}}>
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        <div style={{position: 'absolute', left: 720 - 210, top: 1000 - 210}}><RingMark size={420} spin={f * 3} /></div>
        {OBJ.map((o, i) => {
          const a = (i / OBJ.length) * Math.PI * 2 - Math.PI / 2;
          const bob = Math.sin(f / 12 + i) * 14;
          return (
            <div key={o} style={{position: 'absolute', left: 720 + Math.cos(a) * 470 - 95, top: 1000 + Math.sin(a) * 520 - 95 + bob}}>
              <PopIn at={4 + ((i * 5) % 17)} dur={9} rot={i % 2 ? 14 : -14}>{objImg(o, 190)}</PopIn>
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 0, right: 0, top: 1600, textAlign: 'center', font: `800 150px ${SANS}`, color: '#FFFFFF', letterSpacing: '-0.02em',
          textShadow: '0 8px 30px rgba(76,29,149,.35)'}}>
          <MaskRise text="next level" at={10} stagger={2} dur={6} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 2. Фраза по словам: места-точки, свежее слово светлое, слово подпрыгивает и становится иконками ———
const SZ = 120;
const FONT = `600 ${SZ}px ${SANS}`;
// Слово подпрыгивает (4 кадра), уступает место и превращается в гроздь иконок над (side=-1) или под (side=1) строкой;
// иконки дальше сменяются каждые cycle кадров — «что-то» каждый раз другое.
const iconsRow = (names: string[], at: number, side: 1 | -1, cycle = 0) => (f: number) => {
  const hop = ramp(f, at, at + 4, EASE.out) * (1 - ramp(f, at + 4, at + 8, EASE.in));
  if (f < at + 5) return <span style={{display: 'inline-block', color: INK, transform: `translateY(${-hop * 40}px)`}}>{names[0]}</span>;
  const shift = cycle ? Math.floor((f - at - 5) / cycle) : 0;
  const pool = Object.keys(ICONS);
  return (
    <span style={{position: 'absolute', left: 0, top: side < 0 ? -150 : 160, transform: `translateX(${side < 0 ? -100 : 0}%)`, display: 'inline-flex', gap: 14}}>
      {names.slice(1).map((n, i) => (
        <PopIn key={`${i}-${shift}`} at={shift ? at + 5 + shift * cycle : at + 5 + i * 2} dur={6}>
          <Icon name={shift ? pool[(pool.indexOf(n) + shift * 3 + i) % pool.length] : n} size={92} color={INK} stroke={1.9} />
        </PopIn>
      ))}
    </span>
  );
};
const LINE1: LineWord[] = [
  {text: 'Каждый', at: 74, collapseAt: 108, render: iconsRow(['Каждый', 'calendar', 'clock', 'bolt'], 104, -1, 6)},
  {text: 'день', at: 81},
];
const LINE2: LineWord[] = [
  {text: 'что-то', at: 86},
  {text: 'новое', at: 91, collapseAt: 116, render: iconsRow(['новое', 'spark', 'play', 'music'], 112, 1, 6)},
];
const Sentence: React.FC = () => {
  const f = useF();
  const out = ramp(f, 140, 150, EASE.in);
  const line = (words: LineWord[], top: number, dots: number) => (
    <div style={{position: 'absolute', left: 0, right: 0, top, filter: `blur(${out * 18}px)`, opacity: 1 - out * 0.7}}>
      <WordLine words={words.map((w) => ({...w, width: measure(w.text, FONT)}))} font={FONT} size={SZ} ink={INK} fresh={FRESH} dots={dots} />
    </div>
  );
  // место слова «новое» во второй строке: строка стоит на финальных местах, поэтому рамку можно поставить заранее
  const l2 = measure('что-то', FONT) + measure('новое', FONT) + 0.27 * SZ * 2;
  const nx = 720 - l2 / 2 + measure('что-то', FONT) + 0.27 * SZ * 1.5;
  return (
    <AbsoluteFill>
      {line(LINE1, 1000, 2)}
      {line(LINE2, 1160, 2)}
      <ViewCorners at={84} until={91} x={nx - 10} y={1160 - 4} w={measure('новое', FONT) + 20} h={SZ * 1.36} color={FRESH} />
      <SlashLines at={91} xs={[nx + 60, nx + 210, 470]} y0={760} y1={1560} color={INK} width={3} />
    </AbsoluteFill>
  );
};

// ——— 3. Предмет-слот внутри фразы, курсор листает предметы ———
const Slot: React.FC = () => {
  const f = useF();
  // карусель тормозит, как барабан слот-машины, и встаёт на последнем предмете: интервалы 4 → 5 → 6 → 8 кадров
  const items = [{at: 154, o: 'laptop'}, {at: 168, o: 'mic'}, {at: 172, o: 'book'}, {at: 177, o: 'hourglass'}, {at: 183, o: 'heart'}];
  const k = ramp(f, 150, 156, EASE.out);
  const cur = {x: lerp(1180, 760, ramp(f, 158, 168, EASE.inOut)) + Math.sin(f / 4) * 6 * ramp(f, 168, 170), y: lerp(1500, 1250, ramp(f, 158, 168, EASE.inOut))};
  const out = ramp(f, 203, 209, EASE.in);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1060, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16,
        font: `600 86px ${SANS}`, color: INK, opacity: k * (1 - out), filter: `blur(${(1 - k) * 12 + out * 14}px)`}}>
        <span>Новый</span>
        <InlineSlot w={200} h={220} swap={4} items={items.map((it) => ({at: it.at, node: objImg(it.o, 200)}))} />
        <span>продукт</span>
      </div>
      {f >= 158 && f < 206 && (
        <div style={{position: 'absolute', left: cur.x, top: cur.y}}><Icon name="cursor" size={70} color="#FFFFFF" fill={INK} stroke={1.2} /></div>
      )}
    </AbsoluteFill>
  );
};

// ——— 4. «П р о с т о» с типографскими направляющими, буквы съезжаются в слово ———
const Simple: React.FC = () => {
  const f = useF();
  const word = 'Просто';
  const size = 190;
  const font = `600 ${size}px ${SANS}`;
  const close = ramp(f, 240, 246, EASE.inOut);
  const ws = [...word].map((c) => measure(c, font));
  const tight = ws.reduce((a, b) => a + b, 0);
  const spread = [0, 50, 90, 30, 100, 20];
  const total = tight + spread.reduce((a, b) => a + b, 0) * (1 - close);
  let x = 720 - total / 2;
  const base = 1250;
  const guides = [base, base - size * 0.52, base - size * 0.72];
  const g = 1 - close;
  return (
    <AbsoluteFill>
      <svg style={{position: 'absolute', left: 0, top: 0, opacity: g * ramp(f, 207, 212)}} width={1440} height={2560}>
        {guides.map((y, i) => <line key={i} x1={0} x2={1440} y1={y} y2={y} stroke="#B4A2EE" strokeWidth={3} />)}
        {[...word].map((_, i) => {
          const xi = 720 - total / 2 + ws.slice(0, i).reduce((a, b) => a + b, 0) + spread.slice(0, i + 1).reduce((a, b) => a + b, 0) * (1 - close);
          return (
            <g key={i}>
              <line x1={xi} x2={xi} y1={760} y2={1560} stroke="#CBBDF5" strokeWidth={3} />
              <circle cx={xi} cy={base} r={9} fill={INK} />
              <circle cx={xi + ws[i]} cy={guides[1]} r={9} fill={ACC} />
            </g>
          );
        })}
      </svg>
      {[...word].map((c, i) => {
        x += spread[i] * (1 - close);
        const jitter = Math.sin(f * 1.3 + i * 2) * 5 * g;
        const el = <div key={i} style={{position: 'absolute', left: x, top: base - size * 0.95 + jitter, font, color: INK, lineHeight: 1, opacity: ramp(f, 207 + i * 0.5, 211 + i * 0.5),
          filter: close > 0 && close < 1 ? `blur(${Math.sin(close * Math.PI) * 6}px)` : undefined}}>{c}</div>;
        x += ws[i];
        return el;
      })}
    </AbsoluteFill>
  );
};

// ——— 5. Тройка нарастанием, знак-кольцо сжимается, надпись выезжает из кольца справа налево ———
const Finale: React.FC = () => {
  const f = useF();
  const ring = lerp(760, 230, ramp(f, 292, 299, EASE.out));
  const grow = 1 + 0.1 * ramp(f, 300, 345, EASE.linear);
  const word = (t: string, a: number, b: number) => (f >= a && f < b ? (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', font: `600 ${SZ * 1.4}px ${SANS}`, color: INK}}>
      <EraseLeft at={b - 4} dur={4}><FocusIn at={a} dur={6} scale={1.2} blur={16}>{t}</FocusIn></EraseLeft>
    </div>
  ) : null);
  return (
    <AbsoluteFill>
      {word('Учись', 250, 262)}
      {word('Делай', 262, 274)}
      {f >= 274 && f < 292 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', font: `600 ${SZ * 1.4}px ${SANS}`, color: INK}}>
          <TypeOn text="Готово" at={276} cps={22} caretColor={ACC} />
        </div>
      )}
      {f >= 292 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1000, display: 'flex', justifyContent: 'center', transform: `scale(${grow})`}}>
          <MarkReveal at={302} dur={10} gap={34} mode="behind" mark={<RingMark size={ring} spin={f * 2} />} text="next level"
            font={`800 150px ${SANS}`} style={{color: '#3B1A86', letterSpacing: '-0.02em'}} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const CUES: Cue[] = [
  [4, 'sheet/pop', 0.45], [10, 'sheet/popup', 0.4], [16, 'sheet/pop', 0.35], [64, 'whoosh-big', 0.5],
  [74, 'sheet/select', 0.3], [81, 'tick-soft', 0.4], [90, 'sheet/select', 0.3], [104, 'sheet/b3', 0.35], [112, 'sheet/b5', 0.35],
  [154, 'sheet/popup', 0.45], [168, 'tick-soft', 0.45], [172, 'tick-soft', 0.4], [177, 'tick-soft', 0.4], [183, 'sheet/click', 0.45],
  [212, 'sheet/glass', 0.35], [241, 'sheet/sw-s6', 0.4], [250, 'blur', 0.35], [262, 'blur', 0.35], [276, 'typing', 0.25, false, 0.5],
  riserTo(292, 0.6), [292, 'sheet/hit1', 0.45], [304, 'shimmer', 0.55], [330, 'sheet/chime', 0.35],
];

export const SlovaReel: React.FC = () => {
  const f = useF();
  return (
    <AbsoluteFill style={{background: '#FCFCFE'}}>
      {f >= 72 && <Mist />}
      {f >= 72 && f < 152 && <Sentence />}
      {f >= 150 && f < 212 && <Slot />}
      {f >= 207 && f < 250 && <Simple />}
      {f >= 250 && <Finale />}
      {f < 72 && <ExposureWhip at={63} dur={9}><Intro /></ExposureWhip>}
      <Cues list={CUES} />
    </AbsoluteFill>
  );
};
