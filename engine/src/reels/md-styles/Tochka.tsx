import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {DISPLAY} from './fonts';
import {
  BeatBars, Cues, DotFill, DotGrid, EASE, EchoStack, FloorGrid, FnDot, FocusIn, GlowBloom, HeroDot, Hud, IrisClose, MaskRise, MorphSign,
  PopIn, RayBurst, RollLabel, Scramble, ShockRing, SignGlyph, SkewSlide, StairWipe, TickDial, TypeOn, baselineOf, bumpAt, lerp, measure, ramp,
  riserTo, useF, type Cue, type SignKind,
} from '../../kit/md';

// Стиль 18 ТОЧКА — образец по референсу C («neurofam, одна точка»). 120 BPM: доля 15 кадров, глава = такт 60 кадров.
// Время в кадрах 30 fps (см. src/kit/md/core.tsx). Кадр 1440×2560, колонка x 288–1152, HUD y 380 и 1720.
const INK = '#0F100D';
const PAPER = '#EFEBDF';
const SIG = '#DE4E2C';
const LINE = '#34342F';
const DIM = '#8F8C84';
const SANS = '"SF Pro Display", sans-serif';
const L = 288;
const R = 1152;
export const TOCHKA_SECONDS = 11.6;
const TOTAL = TOCHKA_SECONDS * 30;

const label: React.CSSProperties = {font: `600 44px ${SANS}`, letterSpacing: '0.14em', whiteSpace: 'nowrap'};

// ——— 00 ТИТР: точка падает в прицел, удар, отскок в точку после слова, точка раздувается в красный фон ———
const T = {size: 360, top1: 560, top2: 880, r: 52};
const titleGeo = () => {
  const base2 = T.top2 + baselineOf(DISPLAY, T.size, 700);
  const w = measure('ТОЧКА', `700 ${T.size}px ${DISPLAY}`);
  return {base2, period: {x: L + w + T.r + 12, y: base2 - T.r}, cross: {x: 720, y: base2 - T.r}};
};

const Title: React.FC = () => {
  const f = useF();
  const g = titleGeo();
  const big: React.CSSProperties = {position: 'absolute', left: L, font: `700 ${T.size}px ${DISPLAY}`, lineHeight: 1, color: PAPER};
  return (
    <AbsoluteFill style={{background: INK}}>
      <GlowBloom at={15} x={g.cross.x} y={g.cross.y} color="#5E2214" size={900} hold={40} />
      {f < 15 && (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
          <line x1={720} y1={560} x2={720} y2={g.cross.y - 60} stroke={DIM} strokeWidth={3} strokeDasharray="3 14" />
          <circle cx={g.cross.x} cy={g.cross.y} r={56} fill="none" stroke={PAPER} strokeWidth={4} />
          {[0, 90, 180, 270].map((d) => {
            const t = (d * Math.PI) / 180;
            return <line key={d} x1={g.cross.x + Math.cos(t) * 70} y1={g.cross.y + Math.sin(t) * 70} x2={g.cross.x + Math.cos(t) * 96}
              y2={g.cross.y + Math.sin(t) * 96} stroke={PAPER} strokeWidth={4} />;
          })}
        </svg>
      )}
      <ShockRing at={15} x={g.cross.x} y={g.cross.y} r0={60} r1={1400} dur={13} color={PAPER} width={5} />
      {f >= 15 && (
        <div style={{position: 'absolute', top: g.cross.y - 1.5, height: 3, background: PAPER, left: 720 - 720 * ramp(f, 15, 23), width: 1440 * ramp(f, 15, 23),
          opacity: 1 - ramp(f, 30, 44, EASE.linear)}} />
      )}
      <div style={{...big, top: T.top1}}>
        <EchoStack at={46} dx={14} dy={-18} color={SIG} stroke={3}><MaskRise text="ОДНА" at={16} order="center" stagger={2} dur={4} /></EchoStack>
      </div>
      <div style={{...big, top: T.top2}}>
        <EchoStack at={47} dx={14} dy={-18} color={SIG} stroke={3}><MaskRise text="ТОЧКА" at={31} stagger={1} dur={4} /></EchoStack>
      </div>
      <div style={{position: 'absolute', left: L, top: g.base2 + 64, ...label, color: PAPER}}><TypeOn text="МОНТАЖ В ДВИЖЕНИИ" at={38} cps={60} caret={false} /></div>
      <div style={{position: 'absolute', left: L, top: g.base2 + 130, ...label, fontWeight: 500, color: DIM, opacity: ramp(f, 50, 58)}}>12 СЕКУНД · 696 КАДРОВ · 1 ПРОМПТ</div>
      <RayBurst at={30} x={g.period.x} y={g.period.y} n={10} r0={60} r1={170} len={56} color={SIG} />
      <TickDial at={31} x={g.period.x} y={g.period.y} r0={130} r1={290} color={SIG} />
      <HeroDot color={SIG} keys={[
        {f: 0, x: 720, y: 600, r: T.r},
        {f: 15, x: g.cross.x, y: g.cross.y, ease: 'gravity'},
        {f: 30, x: g.period.x, y: g.period.y, ease: 'arc', arc: 170},
        {f: 64, x: g.period.x, y: g.period.y, ease: 'hold'},
        {f: 67, x: g.period.x, y: g.period.y, r: 38, ease: 'out'},
      ]} squash={[{at: 15, amount: 1.9, dur: 3}, {at: 30, amount: 1.35, dur: 3}]} />
    </AbsoluteFill>
  );
};

// ——— 01 СЛОВА: три входа слова в такт — маска, наклонный влёт, фокус; бочка на 4-й доле ———
const Words: React.FC = () => {
  const f = useF();
  const s = bumpAt(f, [120]);
  const big: React.CSSProperties = {position: 'absolute', left: L, font: `700 320px ${DISPLAY}`, lineHeight: 1, color: INK};
  return (
    <AbsoluteFill style={{background: SIG}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${L}px 1400px`, transform: `scaleY(${s})`}}>
        <div style={{...big, top: 560}}><MaskRise text="КАЖДОЕ" at={76} stagger={1} dur={4} /></div>
        <div style={{...big, top: 860}}><SkewSlide at={90} from={980}>СЛОВО</SkewSlide></div>
        <div style={{...big, top: 1160}}><FocusIn at={105} scale={1.33} blur={18}>В ТАКТ</FocusIn></div>
      </div>
      <div style={{position: 'absolute', left: L, top: 1560}}><BeatBars beat={15} offset={75} color={INK} /></div>
      <div style={{position: 'absolute', right: 1440 - R, top: 1560, ...label, color: INK}}>120 BPM</div>
    </AbsoluteFill>
  );
};

// ——— 02 ФОРМЫ: шесть знаков на восьмые доли, комета без остановки, подпись барабаном ———
const SEQ: {at: number; kind: SignKind; name: string}[] = [
  {at: 135, kind: 'dot', name: 'ТОЧКА'}, {at: 144, kind: 'square', name: 'КВАДРАТ'}, {at: 152, kind: 'ring', name: 'КОЛЬЦО'},
  {at: 160, kind: 'cross', name: 'ПРИЦЕЛ'}, {at: 167, kind: 'spark', name: 'ИСКРА'}, {at: 175, kind: 'rays', name: 'ЛУЧИ'}, {at: 183, kind: 'dot', name: 'ТОЧКА'},
];
const SIGNS: SignKind[] = ['dot', 'square', 'ring', 'cross', 'spark', 'rays'];
const C2 = {x: 720, y: 1000, R: 190};
const Forms: React.FC = () => {
  const f = useF();
  let idx = 0;
  SEQ.forEach((s, i) => { if (f >= s.at) idx = i; });
  const grow = lerp(T.r / C2.R, 1, ramp(f, 135, 141, EASE.back));
  const orbit = (t: number) => {
    const a = (t - 135) * 0.16 - Math.PI / 2;
    const rr = 330 * ramp(t, 135, 142, EASE.out);
    return {x: C2.x + Math.cos(a) * rr, y: C2.y + Math.sin(a) * rr * 0.92, r: 22};
  };
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <DotGrid at={137} cx={C2.x} cy={C2.y} cell={96} color="#9C988D" max={6} />
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${C2.x}px ${C2.y}px`, transform: `scale(${grow})`}}>
        <MorphSign seq={SEQ} cx={C2.x} cy={C2.y} R={C2.R} color={INK} />
      </div>
      <FnDot pos={orbit} color={SIG} trail={6} visible={[136, 300]} />
      <div style={{position: 'absolute', left: L, top: 540, display: 'flex', gap: 34}}>
        {SIGNS.map((k, i) => (
          <div key={k} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
            <SignGlyph kind={k} size={52} color={i === idx % 6 ? INK : '#B3AFA5'} />
            <div style={{width: 52, height: 4, background: INK, opacity: i === idx % 6 ? 1 : 0}} />
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: L, top: 1290, width: R - L, height: 3, background: INK}} />
      <div style={{position: 'absolute', left: L, top: 1314, font: `700 210px ${DISPLAY}`, lineHeight: 1, color: INK}}>
        <RollLabel items={SEQ.map((s) => ({at: s.at, text: s.name}))} />
      </div>
      <div style={{position: 'absolute', right: 1440 - R, top: 1430, ...label, color: INK}}>{String((idx % 6) + 1).padStart(2, '0')}/06</div>
      <div style={{position: 'absolute', left: L, top: 1545, ...label, fontWeight: 500, color: DIM}}>ШЕСТЬ ЗНАКОВ СТИЛЯ</div>
    </AbsoluteFill>
  );
};

// ——— 03 КРИВАЯ: пол поднимается в сетку графика, точка рисует пружину стиля, столбики-кадры, красная полоса ———
const O = {x: L, y: 1420, w: R - L, h: 440};
const P = [[0, 0], [0.34, 1.56], [0.64, 1], [1, 1]];
const bez = (u: number) => {
  const m = 1 - u;
  const c = [m * m * m, 3 * m * m * u, 3 * m * u * u, u * u * u];
  return {x: c.reduce((s, k, i) => s + k * P[i][0], 0), y: c.reduce((s, k, i) => s + k * P[i][1], 0)};
};
const SAMPLES = Array.from({length: 201}, (_, i) => bez(i / 200));
const valueAtX = (x: number) => {
  for (let i = 1; i < SAMPLES.length; i++) {
    if (SAMPLES[i].x >= x) {
      const a = SAMPLES[i - 1];
      const b = SAMPLES[i];
      return lerp(a.y, b.y, (x - a.x) / Math.max(1e-6, b.x - a.x));
    }
  }
  return 1;
};
const px = (p: {x: number; y: number}) => ({x: O.x + p.x * O.w, y: O.y - p.y * O.h});
const Curve: React.FC = () => {
  const f = useF();
  const frame = useCurrentFrame();
  const tilt = 1 - ramp(f, 193, 205, EASE.inOut);
  const ax = ramp(f, 203, 209);
  const prog = ramp(f, 209, 238, EASE.linear);
  const n = Math.max(1, Math.round(prog * 200));
  const pts = SAMPLES.slice(0, n + 1).map(px);
  const head = pts[pts.length - 1];
  const val = SAMPLES[n].y;
  const bars = 24;
  return (
    <AbsoluteFill style={{background: INK}}>
      <FloorGrid tilt={tilt} cell={120} color={LINE} />
      <div style={{position: 'absolute', left: L, top: 470, ...label, fontWeight: 500, color: DIM}}>КРИВАЯ СКОРОСТИ</div>
      <div style={{position: 'absolute', left: L, top: 530, ...label, letterSpacing: '0.02em', color: PAPER}}>cubic-bezier(.34, 1.56, .64, 1)</div>
      <div style={{position: 'absolute', right: 1440 - R, top: 610, display: 'flex', alignItems: 'baseline', gap: 18, opacity: ramp(f, 205, 210)}}>
        <span style={{...label, fontWeight: 500, color: DIM}}>КАДР</span>
        <span style={{font: `700 150px ${DISPLAY}`, color: PAPER, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>{frame}</span>
      </div>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <line x1={O.x} y1={O.y} x2={O.x} y2={O.y - (O.h + 260) * ax} stroke="#CFCABE" strokeWidth={3} />
        <line x1={O.x} y1={O.y} x2={O.x + O.w * ax} y2={O.y} stroke="#CFCABE" strokeWidth={3} />
        {Array.from({length: bars}, (_, i) => {
          const x = (i + 0.5) / bars;
          const k = ramp(f, 236 + i * 0.45, 242 + i * 0.45, EASE.out);
          const h = valueAtX(x) * O.h * k;
          const hot = f >= 243 && Math.abs(i - (f - 243) * 3.4) < 2.2;
          return <rect key={i} x={O.x + x * O.w - 13} y={O.y - h} width={26} height={h} fill={hot ? SIG : PAPER} />;
        })}
        {f >= 209 && (
          <>
            <line x1={px(bez(0)).x} y1={px(bez(0)).y} x2={O.x + 0.34 * O.w} y2={O.y - 1.56 * O.h} stroke={DIM} strokeWidth={2} />
            <rect x={O.x + 0.34 * O.w - 9} y={O.y - 1.56 * O.h - 9} width={18} height={18} fill={PAPER} />
            <line x1={O.x + O.w} y1={O.y - O.h} x2={O.x + 0.64 * O.w} y2={O.y - O.h} stroke={DIM} strokeWidth={2} />
            <rect x={O.x + 0.64 * O.w - 9} y={O.y - O.h - 9} width={18} height={18} fill={PAPER} />
            <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={SIG} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={head.x} cy={head.y} r={22} fill={SIG} />
          </>
        )}
      </svg>
      {f >= 209 && f < 246 && (
        <div style={{position: 'absolute', left: head.x + 34, top: head.y - 70, ...label, color: PAPER}}>{val.toFixed(2)}</div>
      )}
    </AbsoluteFill>
  );
};

// ——— 04 ПОДПИСЬ: слово поднимается из-под маски, точка по орбите садится точкой в конце, удар, итог шести знаков ———
const Sign: React.FC = () => {
  const f = useF();
  const size = 190;
  const font = `800 ${size}px Manrope`;
  const w = measure('next level', font);
  const x0 = 720 - (w + 70) / 2;
  const top = 900;
  const base = top + baselineOf('Manrope', size, 800);
  const per = {x: x0 + w + 40, y: base - 28};
  const oc = {x: 720, y: 1000, r: 520};
  const a0 = -Math.PI / 3;
  const start = {x: oc.x + Math.cos(a0) * oc.r, y: oc.y + Math.sin(a0) * oc.r};
  const a1 = 0.18;
  const mid = {x: oc.x + Math.cos(a1) * oc.r, y: oc.y + Math.sin(a1) * oc.r};
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: ramp(f, 256, 264)}} width={1} height={1}>
        <circle cx={oc.x} cy={oc.y} r={oc.r} fill="none" stroke="#B9B4A8" strokeWidth={4} strokeDasharray="1 22" strokeLinecap="round" />
      </svg>
      <div style={{position: 'absolute', left: x0, top, font, lineHeight: 1, color: INK, letterSpacing: '-0.02em'}}>
        <MaskRise text="next level" at={257} order="line" dur={5} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: base + 70, textAlign: 'center', ...label, color: INK}}>
        <Scramble text="AI МОНТАЖ · ДИЗАЙН ДВИЖЕНИЯ" at={292} dur={10} seed="sig" />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: base + 140, textAlign: 'center', ...label, fontWeight: 500, color: DIM, opacity: ramp(f, 298, 306)}}>
        12 СЕКУНД · 696 КАДРОВ · 1 ПРОМПТ
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: top - 150, display: 'flex', justifyContent: 'center', gap: 30}}>
        {SIGNS.map((k, i) => <PopIn key={k} at={300 + i * 2} dur={6}><SignGlyph kind={k} size={54} color={INK} /></PopIn>)}
      </div>
      <RayBurst at={285} x={per.x} y={per.y} n={10} r0={44} r1={150} len={50} color={SIG} />
      <TickDial at={286} x={per.x} y={per.y} r0={110} r1={250} color={SIG} />
      <ShockRing at={330} x={per.x} y={per.y} r0={40} r1={220} dur={14} color={SIG} width={3} />
      <HeroDot color={SIG} keys={[
        {f: 255, x: start.x, y: start.y, r: 30},
        {f: 276, x: mid.x, y: mid.y, ease: 'orbit', cx: oc.x, cy: oc.y},
        {f: 285, x: per.x, y: per.y, r: 28, ease: 'in'},
      ]} squash={[{at: 285, amount: 1.6, dur: 3}]} trail={4} />
    </AbsoluteFill>
  );
};

const CUES: Cue[] = [
  [15, 'sub-hit', 0.9], [30, 'sheet/pop', 0.7], [38, 'typing', 0.35, false, 0.3], [47, 'sheet/sw-s1', 0.35],
  riserTo(74), [76, 'sheet/hit2', 0.5], [90, 'sheet/sw-s4', 0.6], [105, 'blur', 0.55], [120, 'snap', 0.6],
  riserTo(134), ...SEQ.slice(1).map((s): Cue => [s.at, 'tick-soft', 0.55]), [135, 'sheet/pop', 0.5],
  riserTo(194), [203, 'sheet/select', 0.45], [209, 'counter', 0.4, false, 1.0], [243, 'sheet/sw-s5', 0.45],
  [251, 'transform', 0.6], [257, 'sheet/sw-s6', 0.4], [285, 'sub-hit', 0.85], [286, 'shimmer', 0.6], [300, 'sheet/select', 0.35], [330, 'sheet/chime', 0.4],
];

export const TochkaReel: React.FC<{silent?: boolean}> = ({silent}) => {
  const f = useF();
  const g = titleGeo();
  const ink = f < 75 ? PAPER : f < 195 ? INK : f < 252 ? PAPER : INK;
  return (
    <AbsoluteFill style={{background: INK}}>
      {f < 76 && <Title />}
      {f >= 67 && f < 129 && <DotFill at={67} x={g.period.x} y={g.period.y} r0={38} dur={8}><Words /></DotFill>}
      {f >= 129 && f < 197 && <Forms />}
      {f >= 129 && f < 135 && <IrisClose at={129} dur={6} from={[720, 1280]} to={[C2.x, C2.y]} r1={T.r}><Words /></IrisClose>}
      {f >= 189 && f < 256 && <DotFill at={189} x={C2.x} y={C2.y} r0={C2.R} dur={6}><Curve /></DotFill>}
      {f >= 249 && <StairWipe at={249} dur={6} steps={24}><Sign /></StairWipe>}
      <Hud title="ТОЧКА ▪ 2026" brand="NEXT LEVEL" total={TOTAL} ink={ink} box={{x0: L, x1: R, top: 380, bottom: 1720}}
        chapters={[{at: 0, name: 'ТИТР'}, {at: 75, name: 'СЛОВА'}, {at: 135, name: 'ФОРМЫ'}, {at: 195, name: 'КРИВАЯ'}, {at: 255, name: 'ПОДПИСЬ'}]} />
      {!silent && <Cues list={CUES} />}
    </AbsoluteFill>
  );
};

