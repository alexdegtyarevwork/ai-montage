import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {
  Chroma, CoolDown, CrtScreen, Cues, EASE, EmberGlow, FnDot, Grain, Halation, OnTwos, Pixelate, ScreenDoor, SettleLine, TypeOn, Vignette,
  lerp, measure, ramp, riserTo, useF, type Cue, type TimedWord,
} from '../../kit/md';
import {TochkaReel} from './Tochka';

// Стиль 16 ПЛЁНКА — образец по референсу A («тёплая плёнка»): тёплая тьма, свечение снизу, искра-проводник,
// слова садятся на строку, наезд ×2,6 с растром, логотип из пикселей на дропе, комета пишет название,
// чип → поле ввода → экран-кинескоп с результатом. Всё движение на двойках (15 к/с), зерно, ореол, виньетка.
const BG = '#0E0D09';
const CREAM = '#F1E6D2';
const EMBER = '#FF7A3D';
const SERIF = '"SF Pro Display", sans-serif';
export const PLENKA_SECONDS = 11.4;

const SZ = 88;
const lineFont = `italic 300 ${SZ}px ${SERIF}`;
const W1: TimedWord[] = [{text: 'Монтаж,', at: 0}, {text: 'на', at: 7}, {text: 'который', at: 10}];
const W2: TimedWord[] = [{text: 'уходила', at: 16}, {text: 'неделя,', at: 21, accent: true}];
const W3: TimedWord[] = [{text: 'теперь', at: 62}, {text: 'одна', at: 66}, {text: 'мысль.', at: 70}];

// Звёздочка-знак: 10 лучей со скруглёнными концами (свой знак стиля, не чужой логотип).
const Spark: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    {Array.from({length: 10}, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.08;
      const l = i % 2 ? 40 : 46;
      return <line key={i} x1={Math.cos(a) * 9} y1={Math.sin(a) * 9} x2={Math.cos(a) * l} y2={Math.sin(a) * l} stroke={color} strokeWidth={9} strokeLinecap="round" />;
    })}
  </svg>
);

// ——— 1. Слова садятся на строку, искра ведёт; 2. искра бежит по строке и «пишет» вторую фразу ———
const Hook: React.FC = () => {
  const f = useF();
  const dim = 1 - 0.55 * ramp(f, 50, 58, EASE.linear);
  const u = ramp(f, 34, 46, EASE.inOut);
  const nedW = measure('неделя,', lineFont);
  const l2w = measure('уходила неделя,', lineFont) + 0.28 * SZ * 2;
  const ux = 720 - l2w / 2 + measure('уходила', lineFont) + 0.28 * SZ;
  if (f >= 76) return null;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1000, opacity: dim, fontStyle: 'italic'}}>
        <SettleLine words={W1} font={lineFont} size={SZ} color={CREAM} accent={EMBER} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1100, opacity: dim, fontStyle: 'italic'}}>
        <SettleLine words={W2} font={lineFont} size={SZ} color={CREAM} accent={EMBER} />
      </div>
      {f >= 34 && (
        <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: dim}} width={1} height={1}>
          <path d={`M${ux} 1222 q ${nedW * 0.25} -10 ${nedW * 0.5} 0 t ${nedW * 0.5} 0 M${ux + 8} 1242 q ${nedW * 0.3} -8 ${nedW * 0.62} 0 t ${nedW * 0.3} -2`}
            fill="none" stroke={EMBER} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - u} />
        </svg>
      )}
      {f >= 60 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1300, fontStyle: 'italic'}}>
          <SettleLine words={W3} font={lineFont} size={SZ} color={CREAM} accent={EMBER} mode="blur" ghost={6} breathe />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ——— 3. Наезд склейкой ×2,6: расфокус уходит за 10 кадров, проступает растр экрана, камера едет вбок ———
const Punch: React.FC = () => {
  const f = useF();
  if (f < 76 || f >= 140) return null;
  const sharp = ramp(f, 76, 88, EASE.out);
  const drift = (f - 76) * 2.2;
  const up = ramp(f, 124, 137, EASE.in);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', transformOrigin: '50% 0%',
        transform: `translate(${-drift}px, ${-up * 900}px) perspective(1400px) rotateX(${up * 55}deg)`, opacity: 1 - up * 0.6}}>
        <Chroma px={lerp(14, 3, sharp)} id="pl-ca">
          <div style={{font: `300 230px ${SERIF}`, fontStyle: 'italic', color: CREAM, whiteSpace: 'nowrap', filter: `blur(${(1 - sharp) * 22}px)`,
            textShadow: '0 0 40px rgba(255,170,110,.35)'}}>одна мысль.</div>
        </Chroma>
      </div>
      <ScreenDoor cell={10} opacity={0.32 * (1 - up)} />
    </AbsoluteFill>
  );
};

// ——— 4. Пауза, искра снизу, чёрный кадр, логотип из пикселей на дропе; 5. комета пишет название, текст остывает ———
const Brand: React.FC = () => {
  const f = useF();
  if (f < 137 || f >= 212) return null;
  const word = 'NEXT LEVEL';
  const tf = `italic 300 118px ${SERIF}`;
  const tw = measure(word, tf);
  const total = 190 + 46 + tw;
  const x0 = 720 - total / 2;
  const burn = ramp(f, 186, 194, EASE.linear);
  const wipe = ramp(f, 190, 197, EASE.in);
  const nextW = measure('NEXT ', tf);
  const pill = ramp(f, 196, 202, EASE.back);
  const drop = ramp(f, 204, 212, EASE.in);
  const black = f >= 144 && f < 145;
  return (
    <AbsoluteFill>
      {f >= 140 && f < 144 && (
        <div style={{position: 'absolute', left: 720 - 70, top: 2560 - lerp(0, 520, ramp(f, 140, 144, EASE.out)), filter: 'blur(3px)'}}>
          <Chroma px={10} id="pl-sp"><Spark size={140} color="#FFD9B8" /></Chroma>
        </div>
      )}
      {black && <AbsoluteFill style={{background: '#000'}} />}
      {f >= 145 && (
        <Halation radius={26} strength={0.85}>
          <div style={{position: 'absolute', left: x0, top: 1110, width: 190, height: 190, opacity: 1 - burn * 0.85, transform: `rotate(${(f - 145) * 0.4}deg)`}}>
            <Pixelate at={145} sizes={[64, 26, 0]} id="pl-px"><Spark size={190} color={EMBER} /></Pixelate>
          </div>
          {f >= 155 && (
            <div style={{position: 'absolute', left: x0 + 236, top: 1130, font: tf, fontStyle: 'italic', whiteSpace: 'pre', transform: `translateY(${drop * 260}px) scale(${1 - drop * 0.5})`,
              transformOrigin: `${nextW + (tw - nextW) / 2}px 60px`}}>
              <span style={{opacity: 1 - wipe, clipPath: `inset(0 0 0 ${wipe * 100}%)`}}><CoolDown at={156} dur={12}>NEXT </CoolDown></span>
              <span style={{position: 'relative', opacity: f >= 160 ? 1 : 0}}>
                {pill > 0 && <span style={{position: 'absolute', left: -34, right: -34, top: -4, bottom: -12, borderRadius: 80, background: EMBER, opacity: 0.95,
                  transform: `scaleX(${pill})`, boxShadow: '0 0 60px 12px rgba(255,122,61,.55)'}} />}
                <span style={{position: 'relative'}}><CoolDown at={160} dur={12}>LEVEL</CoolDown></span>
              </span>
            </div>
          )}
        </Halation>
      )}
      {f >= 189 && f < 198 && (
        <div style={{position: 'absolute', left: x0 + 236 + wipe * nextW - 6, top: 1100, width: 12, height: 180, borderRadius: 6, background: EMBER,
          boxShadow: '0 0 40px 10px rgba(255,122,61,.7)'}} />
      )}
    </AbsoluteFill>
  );
};

// ——— 6. Поле ввода собирается вокруг чипа, печать запроса; 7. поле становится окном-кинескопом с результатом ———
const BOX = {x: 288, y: 1180, w: 864, h: 300};
const Prompt: React.FC = () => {
  const f = useF();
  const {fps} = useVideoConfig();
  if (f < 206) return null;
  const k = ramp(f, 206, 214, EASE.out);
  const out = ramp(f, 264, 272, EASE.linear);
  const grow = ramp(f, 272, 290, EASE.inOut);
  const scr = {w: lerp(BOX.w, 1000, grow), h: lerp(BOX.h, 1420, grow)};
  const sy = lerp(BOX.y, 560, grow);
  const chips = ['Монтаж', 'Звук', 'Цвет', 'Титры'];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1040, opacity: 1 - out, fontStyle: 'italic'}}>
        <SettleLine words={[{text: 'С', at: 210}, {text: 'возвращением!', at: 212}]} font={`italic 300 84px ${SERIF}`} size={84} color={CREAM} />
      </div>
      {f < 272 ? (
        <div style={{position: 'absolute', left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, borderRadius: 40, background: '#1C1B16',
          border: '2px solid #34352E', opacity: k, padding: 40, boxSizing: 'border-box', font: `400 50px ${SERIF}`, color: CREAM}}>
          <div style={{opacity: 1 - out}}><TypeOn text="Смонтируй рилс в стиле плёнки" at={222} cps={26} caretColor={EMBER} /></div>
          <div style={{position: 'absolute', right: 34, bottom: 30, padding: '8px 26px', borderRadius: 60, background: EMBER, color: '#2A1206',
            font: `500 40px ${SERIF}`, opacity: (1 - out) * ramp(f, 210, 213)}}>LEVEL</div>
        </div>
      ) : (
        <div style={{position: 'absolute', left: 720 - scr.w / 2, top: sy, width: scr.w, height: scr.h}}>
          <CrtScreen w={scr.w} h={scr.h} at={272} warm={16}>
            <div style={{position: 'absolute', left: (scr.w - 1440 * 0.62) / 2, top: (scr.h - 2560 * 0.62) / 2, width: 1440, height: 2560,
              transform: 'scale(0.62)', transformOrigin: '0 0'}}>
              <Sequence from={Math.round((272 / 30) * fps - 75 * 2)} layout="none"><TochkaReel silent /></Sequence>
            </div>
          </CrtScreen>
        </div>
      )}
      <div style={{position: 'absolute', left: 0, right: 0, top: BOX.y + BOX.h + 40, display: 'flex', justifyContent: 'center', gap: 22, opacity: k}}>
        {chips.map((c, i) => {
          const g = ramp(f, 262 + i * 2, 265 + i * 2, EASE.in);
          return <div key={c} style={{padding: '10px 28px', borderRadius: 40, border: '2px solid #3A3B33', font: `400 44px ${SERIF}`, color: '#CFC6B5',
            opacity: 1 - g, transform: `scale(${1 - g * 0.3})`}}>{c}</div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const CUES: Cue[] = [
  [3, 'woosh-air', 0.35], [21, 'sheet/select', 0.25], [70, 'sheet/sw-s1', 0.25], [76, 'zoom', 0.45], [126, 'sheet/sw-s7', 0.35],
  riserTo(145, 0.9), [145, 'sub-hit', 0.9], [158, 'shimmer', 0.5], [192, 'sheet/sw-s5', 0.35], [200, 'sheet/select', 0.4], [211, 'sheet/click', 0.35],
  [222, 'typing', 0.28, false, 1.2], [272, 'sheet/es-open', 0.45], [290, 'flash', 0.2],
];

export const PlenkaReel: React.FC = () => {
  const f = useF();
  const glow = 1 - ramp(f, 76, 82, EASE.linear) * 0.85 + ramp(f, 206, 230, EASE.linear) * 0.6 - ramp(f, 137, 140) * 0.15;
  const spark = (t: number) => {
    // в удержании искра не стоит, а дрейфует влево (A 0,6–1,7: ≈ 4 px/кадр в кадре 1080)
    if (t < 50) return {x: lerp(1330, 1040, ramp(t, 0, 6, EASE.out)) - Math.max(0, t - 6) * 2.2, y: lerp(880, 950, ramp(t, 0, 6, EASE.out)), r: 22};
    if (t < 76) {
      const k = ramp(t, 52, 74, EASE.inOut);
      return {x: lerp(943, 1080, k) - Math.sin(k * Math.PI) * 600, y: lerp(950, 1420, ramp(t, 52, 60, EASE.in)), r: 20};
    }
    const fall = ramp(t, 124, 136, EASE.gravity);
    return {x: 720 + (t - 76) * 0.6, y: lerp(1620, 2900, fall), r: lerp(110, 150, fall)};
  };
  return (
    <AbsoluteFill style={{background: BG}}>
      <OnTwos step={2}>
        <AbsoluteFill>
          <div style={{position: 'absolute', inset: 0, opacity: Math.max(0, Math.min(1, glow))}}><EmberGlow y={0.86} /></div>
          <Halation radius={18} strength={0.55}>
            <Hook />
          </Halation>
          {f < 137 && f >= 76 && (
            <div style={{position: 'absolute', left: 720 - 110, top: spark(f).y - 110, width: 220, height: 220, borderRadius: '50%',
              background: `radial-gradient(circle, ${EMBER} 42%, transparent 46%) 0 0 / 16px 16px`, filter: `blur(${(1 - ramp(f, 76, 88)) * 10}px)`}} />
          )}
          <Punch />
          {f < 76 && <FnDot pos={spark} color={EMBER} glow="rgba(255,122,61,.6)" trail={3} />}
          <Brand />
          <Prompt />
          <Grain opacity={0.11} />
          <Vignette strength={0.7} />
        </AbsoluteFill>
      </OnTwos>
      {f >= 137 && f < 140 && <AbsoluteFill style={{background: BG}} />}
      <Cues list={CUES} />
    </AbsoluteFill>
  );
};

