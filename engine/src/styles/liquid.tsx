import {bloom, blurThrough, whip} from '../kit/presentations';
import {CapsuleLine} from '../kit/liquid/CapsuleLine';
import {GlassEnv} from '../kit/liquid/env';
import {LiquidPanel} from '../kit/liquid/LiquidPanel';
import {Object25D} from '../kit/liquid/Object25D';
import {DawnSky, NightStage, Reeded, type Spot} from '../kit/liquid/stage';
import type {Format} from '../formats';
import type {StyleDef} from './engine';
import {E, k, springAt} from './parts';
import {objectOf, SkinScene, type Skin} from './skinned';
import {objectPath} from '../objects';

// 2 СТЕКЛО — жидкое стекло с настоящим преломлением (kit/liquid). Каждая сцена — своя сцена света: прожекторы с пылью,
// рифлёное стекло, рассвет над облаками, луна с лучом. Содержимое блока лежит на панели жидкого стекла, которая
// преломляет эту сцену; хук — стеклянный предмет под лучом и строка с мятной капсулой. Спикер — карточка по формату.
const skin: Skin = {
  ink: '#F2F3F5', sub: '#9AA3AD', accent: '#3DEDC3', accent2: '#FF7A2F', tile: '#F4F5F2', head: 92,
  panel: (r) => ({borderRadius: r, background: 'linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05))',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35), inset 0 0 0 1.5px rgba(255,255,255,.14), 0 18px 40px rgba(0,0,0,.35)'}),
  row: (on) => ({background: on > 0 ? 'rgba(61,237,195,.14)' : 'rgba(255,255,255,.04)'}),
};

const reels = (f: Format) => f.h > f.w;
// сцены света по кругу; лучи смотрят в центр главного предмета или панели
const spots = (f: Format, cx: number, cy: number, color: string): Spot[] => [
  {x: cx - f.w * 0.32, y: -320, angle: Math.atan2(f.w * 0.32, cy + 320) * (180 / Math.PI), spread: 13, color, power: 1.2},
  {x: cx + f.w * 0.32, y: -320, angle: -Math.atan2(f.w * 0.32, cy + 320) * (180 / Math.PI), spread: 13, color, power: 1.2},
];
// центр главного предмета хука: в рилс — середина кадра, в YouTube — середина зоны графики слева от спикера
const hookCenter = (f: Format) => (reels(f) ? {x: f.w / 2, y: 1010} : {x: 900, y: 840});
const Stage: React.FC<{t: number; i: number; f: Format; at: number}> = ({t, i, f, at}) => {
  const c = hookCenter(f);
  switch (i % 5) {
    case 0: return <NightStage t={t} spots={spots(f, c.x, c.y, '214,255,245')} floor={reels(f) ? 1560 : 1200} dust={90} />;
    case 1: return <Reeded t={t} mix={k(t, at, at + 4)} />;
    case 2: return <DawnSky t={t} rise={0.15 + 0.5 * k(t, at, at + 6, E.inOut)} />;
    case 3: return <NightStage t={t} moon={{x: f.w * 0.78, y: reels(f) ? 360 : 260, r: 120, beam: {angle: 28, spread: 9, power: 0.9}}}
      floor={reels(f) ? 1560 : 1200} glow="255,122,47" dust={70} />;
    default: return <Reeded t={t} mix={1 - k(t, at, at + 4)} rib={46} />;
  }
};

// зачёркивание слова: оранжевая линия рисуется слева направо, слово тускнеет
const strikeStyle = (p: number): React.CSSProperties | undefined => (p > 0 ? {
  color: `rgba(242,243,245,${1 - 0.45 * p})`,
  backgroundImage: 'linear-gradient(#FF7A2F, #FF7A2F)', backgroundRepeat: 'no-repeat', backgroundPosition: '0 56%', backgroundSize: `${p * 100}% 0.09em`,
} : undefined);

// панель стекла под содержимым блока: растёт из центра с пружинкой, по ней проходит блик
const panelBox = (f: Format) => reels(f) ? {x: 80, y: 250, w: 1280, h: 1130} : {x: 110, y: 110, w: 1580, h: 1060};

const Scene: StyleDef['Scene'] = (p) => {
  const {t, b, i, f} = p;
  const P = panelBox(f), e = springAt(t, b.at + 0.05, 60, 16, 160);
  const s = 0.92 + 0.08 * e, pw = P.w * s, ph = P.h * s;
  const inner = {x: P.x + 60, y: P.y + 70, w: P.w - 120, h: P.h - 120};
  const bg = () => <Stage t={t} i={i} f={f} at={b.at} />;
  if (b.kind === 'hook') {
    // длинная строка не выходит за поля: кегль уменьшается под самую длинную строку (ширина знака Manrope 800 ≈ 0,6 кегля)
    const longest = Math.max(...b.lines.map((l) => l.length)), room = reels(f) ? f.w * 0.84 : 1500;
    const size = Math.min(reels(f) ? 104 : 96, room / (longest * 0.6)), c = hookCenter(f), cx = c.x, y0 = reels(f) ? 330 : 200;
    const line1 = b.lines[0].split(' '), line2 = b.lines[1].split(' ');
    // зачёркнутое слово хука (strike): линия проходит по слову в момент strikeAt — звук «щелчка» в движке стоит ровно туда
    const strikeIn = b.strike ? k(t, b.strikeAt ?? b.at + 1.5, (b.strikeAt ?? b.at + 1.5) + 0.35, E.inOut) : 0;
    const struck = (i: number, words: string[]) => (b.strike && words[i].replace(/[.,!?:«»]/g, '') === b.strike ? strikeIn : 0);
    return (
      <GlassEnv bg={bg} w={f.w} h={f.h}>
        <Object25D src={objectPath(objectOf(b), 'png')} x={cx} y={c.y} size={reels(f) ? 660 : 520} t={t} at={b.at + 0.3}
          sheenAt={b.at + 1.1} moon={0.8} float={16} />
        {b.kicker ? <div style={{position: 'absolute', left: cx - 600, width: 1200, top: y0 - 70, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700,
          fontSize: 34, letterSpacing: '.12em', color: 'rgba(214,255,245,.8)', opacity: k(t, b.at, b.at + 0.4)}}>{b.kicker.toUpperCase()}</div> : null}
        <CapsuleLine words={line1} t={t} stops={[]} style={{family: 'Manrope', weight: 800, size, x: cx, y: y0, align: 'center'}}
          textShadow="0 4px 24px rgba(0,0,0,.55)" wordStyle={(i) => strikeStyle(struck(i, line1))} />
        <CapsuleLine words={line2} t={t} stops={[{at: b.at + 0.55, i: 0, j: line2.length - 1}]} style={{family: 'Manrope', weight: 800, size, x: cx, y: y0 + size * 1.32, align: 'center'}}
          capsule={{material: 'solid', tone: 'mint', chroma: 0.12}} textShadow="0 4px 24px rgba(0,0,0,.55)" wordStyle={(i) => strikeStyle(struck(i, line2))} />
      </GlassEnv>
    );
  }
  return (
    <GlassEnv bg={bg} w={f.w} h={f.h}>
      <LiquidPanel x={P.x + (P.w - pw) / 2} y={P.y + (P.h - ph) / 2} w={pw} h={ph} r={72} material="frosted" tone="dark" fill={0.34} chroma={0.1}
        moon={i % 5 === 3 ? 0.9 : 0.4} sheen={k(t, b.at + 0.3, b.at + 1.4)} opacity={Math.min(1, e * 2)} level={3} name={`liquid:${b.id}`} />
      <div style={{position: 'absolute', inset: 0, opacity: k(t, b.at + 0.1, b.at + 0.35)}}>
        <SkinScene {...p} zone={inner} skin={skin} />
      </div>
    </GlassEnv>
  );
};

export const LIQUID: StyleDef = {
  id: 'liquid', speaker: 'card', Background: () => null, Scene,
  zone: (f) => panelBox(f),
  captions: (f) => f.captions,
  // вспышка мятного, размытие через тёмное, рывок вбок — по кругу
  transition: (i) => [bloom({color: '#3DEDC3'}), blurThrough({color: '#0A0B0D'}), whip({dir: 'left'})][i % 3] as never,
};
