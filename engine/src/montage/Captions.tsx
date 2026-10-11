import {useMemo} from 'react';
import {Easing, getInputProps, interpolate} from 'remotion';
import {GlassSurface} from '../kit/liquid/LiquidPanel';
import {useFontsReady} from '../kit/liquid/useAssetReady';
import {fontSpec, layoutLine, textWidth} from '../kit/liquid/words';
import {WORDS, type Word} from './words';

// Субтитры ролика 21: стеклянная капсула под текущей строкой (решение владельца 19.09.2026).
// 40 px сетки 1080 = 53,3 px в 2K, светлый текст на тёмном стекле, мятное подчёркивание произносимого слова.
// Строка — фраза речи: рвётся по концу предложения, по запятой после 3+ слов, по паузе > 0,45 с и по ширине 940 px.
// Капсула перетекает по ширине от строки к строке. Одна строка — centerY 1467 (1100 сетки 1080).
// Лежит поверх сцен и переходов, поэтому размытие — обычный backdrop-filter (в масштабе 1 он кадр-в-кадр, O-24).
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const flow = Easing.bezier(0.65, 0, 0.35, 1);
// Базовый вид (ПРАВИЛА/2 Субтитры.md): Manrope 700, 60 px при ширине 1080 = 80 px в кадре 1440.
// Защитный минимум — 48 px при 1080 (64 в кадре 1440): мельче кегль не ставится, даже если стиль просит.
const SIZE = 80, DEF_WEIGHT = 700, DEF_FAMILY = 'Manrope', MAXW = 920, CY = 1467, PADY = 18;
// Цвет выделения по умолчанию — «Цвет выделения» из ПРАВИЛА/1 Настройки.txt (команды дописывают его в ролик как accent).
export const ACCENT = '#FBB931';
// Формат задаёт центр строки, ширину и кегль: src/formats.ts.

export type Line = {ids: number[]; from: number; to: number; w: number};

// Правила владельца 30.09.2026 для всех роликов:
// 1) в конце строки субтитров нет точки, запятой, двоеточия, точки с запятой и восклицательного знака; «?» остаётся;
// 2) предлог, союз, частица или указательное слово не висят в конце строки — уходят на следующую вместе со своим словом;
// 3) слова не переносятся по частям.
export const capText = (s: string) => s.replace(/[.,;:!…—–]+([»"”)]*)$/u, '$1');
const GLUE = new Set(['и', 'а', 'но', 'да', 'или', 'либо', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'у', 'о', 'об', 'обо', 'от', 'до', 'по', 'за',
  'из', 'изо', 'без', 'для', 'при', 'про', 'над', 'под', 'через', 'не', 'ни', 'же', 'ли', 'бы', 'что', 'как', 'если', 'чтобы', 'то', 'ты', 'я',
  'мы', 'вы', 'это', 'эту', 'этот', 'эта', 'всю', 'весь', 'вся', 'такой', 'такая', 'такое', 'свой', 'своё', 'свою', 'один', 'одна', 'одно',
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'and', 'or', 'for', 'with']);
const isGlue = (text: string) => !/[.!?,:;…—–]$/.test(text) && GLUE.has(text.toLowerCase().replace(/[«»"“”()]/g, ''));
// Видимый текст слов строки: без конечной пунктуации у каждого слова — строка проявляется по словам, и любое
// слово бывает последним видимым (правило владельца 30.09.2026). Разбивка строк по-прежнему смотрит на исходную пунктуацию.
export const lineText = (ws: Word[], ids: number[]) => ids.map((i) => capText(ws[i].text));

// Разбивка на строки (30.09.2026): сначала фразы по сильным границам (. ! ? : ; и пауза > 0,45 с), затем каждая длинная
// фраза делится на наименьшее число строк до 5 слов и ширины maxW, строки выравниваются по ширине. Жёстко нельзя:
// висящий в конце строки предлог или частица. Выгодно: разрыв после запятой и перед союзом. Дорого: разрыв внутри перечисления
// («наложений, субтитров, анимаций» остаётся одной строкой).
const MAX_WORDS = 5;
export const buildLines = (ws: Word[], maxW: number, size: number, FAMILY = DEF_FAMILY, WEIGHT = DEF_WEIGHT): Line[] => {
  const FONT = fontSpec(WEIGHT, size, FAMILY);
  const width = (ids: number[]) => textWidth(lineText(ws, ids).join(' '), FONT, size);
  const segs: number[][] = [];
  let seg: number[] = [];
  ws.forEach((w, i) => {
    if (seg.length && (/[.!?:;]["»”)]*$/.test(ws[i - 1].text) || w.start - ws[i - 1].end > 0.45)) { segs.push(seg); seg = []; }
    seg.push(i);
  });
  if (seg.length) segs.push(seg);
  const listBreak = (i: number) => /,$/.test(ws[i].text) && !!ws[i + 1] && /,$/.test(ws[i + 1].text);
  const split = (s: number[], relaxGlue: boolean): number[][] | null => {
    const n = s.length;
    const total = width(s);
    for (let lines = Math.ceil(n / MAX_WORDS); lines <= n; lines++) {
      const target = total / lines;
      // dp[m][j]: лучшая цена первых j слов в m строках
      const dp = Array.from({length: lines + 1}, () => new Array<number>(n + 1).fill(Infinity));
      const from = Array.from({length: lines + 1}, () => new Array<number>(n + 1).fill(-1));
      dp[0][0] = 0;
      for (let m = 1; m <= lines; m++) {
        for (let j = 1; j <= n; j++) {
          for (let i = Math.max(0, j - MAX_WORDS); i < j; i++) {
            if (dp[m - 1][i] === Infinity) continue;
            const ids = s.slice(i, j);
            const w = width(ids);
            if (w > maxW) continue;
            const lastIdx = s[j - 1];
            if (j < n && !relaxGlue && isGlue(ws[lastIdx].text)) continue;
            let c = ((w - target) / target) ** 2;
            if (j < n && /,$/.test(ws[lastIdx].text)) c -= 0.3;
            if (j < n && /^(и|а|но|или|and|but|or)$/i.test(ws[s[j]].text)) c -= 0.3; // новая строка с союза — граница мысли
            if (j < n && listBreak(lastIdx)) c += 4;
            if (dp[m - 1][i] + c < dp[m][j]) { dp[m][j] = dp[m - 1][i] + c; from[m][j] = i; }
          }
        }
      }
      if (dp[lines][n] < Infinity) {
        const out: number[][] = [];
        for (let m = lines, j = n; m > 0; m--) { const i = from[m][j]; out.unshift(s.slice(i, j)); j = i; }
        return out;
      }
    }
    return null;
  };
  const groups: number[][] = [];
  for (const s of segs) {
    if (s.length <= MAX_WORDS && width(s) <= maxW) groups.push(s);
    else groups.push(...(split(s, false) ?? split(s, true) ?? s.map((i) => [i])));
  }
  return groups.map((ids, g) => {
    const from = ws[ids[0]].start - 0.06;
    const last = ws[ids[ids.length - 1]];
    const next = groups[g + 1] ? ws[groups[g + 1][0]].start - 0.06 : last.end + 0.6;
    return {ids, from, to: next - from > 1.1 + (last.end - from) ? last.end + 0.45 : next, w: width(ids)};
  });
};

// Ширина капсулы в момент t — НИКОГДА не уже видимого текста (правило владельца 24.09.2026: текст не выходит за
// контейнер ни в одном кадре). Новая строка длиннее — капсула сразу берёт её ширину; короче — плавно сужается за 0,22 с.
// Задерживать текст, пока капсула растёт, нельзя: получается пустая капсула между строками.
export const capsuleAt = (lines: Line[], li: number, t: number, padX: number) => {
  const line = lines[li];
  const prev = li > 0 && Math.abs(lines[li - 1].to - line.from) < 0.02 ? lines[li - 1] : null;
  const k = interpolate(t, [line.from, line.from + 0.22], [0, 1], {...clamp, easing: flow});
  // При смене строки без паузы текст виден с первого кадра (0,3 → 1), иначе на стыке мелькает пустая капсула (ролик 25).
  const raw = interpolate(t, [line.from, line.from + 0.16], [0, 1], {...clamp, easing: ease});
  const textIn = prev ? 0.3 + 0.7 * raw : raw;
  const morph = prev ? prev.w + (line.w - prev.w) * k : line.w;
  const w = Math.max(morph, textIn > 0 ? line.w : 0) + padX * 2;
  return {w, textIn, prev};
};

// Проверка всех стыков строк с шагом 1/120 с (qa-fit смотрит кадры раз в 0,5 с и короткий стык пропускает):
// поля капсулы вокруг видимого текста — не меньше 0,4 кегля. Нарушение пишется в консоль как [fit].
const checkCapsules = (lines: Line[], padX: number, size: number) => {
  lines.forEach((line, li) => {
    for (let t = line.from; t < Math.min(line.to, line.from + 0.6); t += 1 / 120) {
      const {w, textIn} = capsuleAt(lines, li, t, padX);
      if (textIn > 0 && (w - line.w) / 2 < size * 0.4 - 0.5) {
        console.error(`[fit] caption:${li}: капсула ${Math.round(w)} px уже текста ${Math.round(line.w)} px + поля в ${t.toFixed(2)} с`);
        break;
      }
    }
  });
};

// plate: 'capsule' — стеклянная капсула под строкой (по умолчанию), 'none' — без подложки: тот же шрифт, размер и цвет,
// читаемость держит мягкая тень. mark: 'underline' — подчёркнуто произносимое слово, 'none' — без выделения.
// По умолчанию: с капсулой — подчёркивание есть, без капсулы — подчёркивания нет (решение владельца 11.10.2026).
export const Captions: React.FC<{t: number; grow?: (t: number) => number; words?: Word[]; cx?: number; cy?: number; maxW?: number; size?: number; frameW?: number; frameH?: number; light?: boolean; family?: string; weight?: number; accent?: string; hot?: string; hotFill?: string; plate?: 'capsule' | 'none'; mark?: 'underline' | 'none'}> =
  ({t, grow, words = WORDS, cx = 720, cy = CY, maxW = MAXW, size: sizeIn = SIZE, frameW = 1440, frameH = 2560, light = false, family = DEF_FAMILY, weight = DEF_WEIGHT, accent, hot, hotFill, plate = 'capsule', mark = plate === 'none' ? 'none' : 'underline'}) => {
  const FAMILY = family, WEIGHT = weight;
  const size = Math.max(sizeIn, (64 * Math.max(frameW, frameH)) / 2560);
  const SIZE = size, CY = cy, PADX = Math.max(48, size * 0.9);
  const ready = useFontsReady([fontSpec(WEIGHT, size, FAMILY)]);
  const grouped = useMemo(() => (ready ? buildLines(words, maxW, size, FAMILY, WEIGHT) : []), [ready, words, maxW, size, FAMILY, WEIGHT]);
  // Ширина строк меряется заново на каждом кадре тем же шрифтом, что рисует текст: запомненная при загрузке ширина
  // в одном из потоков рендера оказалась от соседнего начертания, и подложка прыгала раз в 4 кадра (ролик 33, 28.09.2026).
  const FONT = fontSpec(WEIGHT, size, FAMILY);
  const lines = grouped.map((l) => ({...l, w: textWidth(lineText(words, l.ids).join(' '), FONT, size)}));
  useMemo(() => { if (plate === 'capsule' && grouped.length && (getInputProps() as {qa?: boolean}).qa) checkCapsules(grouped, PADX, size); }, [plate, grouped, PADX, size]);
  if (!lines.length) return null;
  const li = lines.findIndex((l) => t >= l.from && t < l.to);
  if (li < 0) return null;
  const line = lines[li];
  const {w, textIn, prev} = capsuleAt(lines, li, t, PADX);
  const h = SIZE * 1.22 + PADY * 2;
  const appear = prev ? 1 : interpolate(t, [line.from, line.from + 0.2], [0, 1], {...clamp, easing: ease});
  const contNext = !!lines[li + 1] && Math.abs(lines[li + 1].from - line.to) < 0.02;
  const fadeOut = contNext ? 1 : interpolate(t, [line.to - 0.16, line.to], [1, 0], clamp);
  const capVis = appear * fadeOut;
  const pop = 0.92 + 0.08 * appear;
  const boxes = layoutLine(lineText(words, line.ids), {family: FAMILY, weight: WEIGHT, size: SIZE, x: cx, y: CY - (SIZE * 1.22) / 2, align: 'center', lineHeight: 1.22});
  const s = grow ? grow(t) : 1;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: frameW, height: frameH, pointerEvents: 'none', transformOrigin: `${cx}px ${CY}px`, transform: s !== 1 ? `scale(${s})` : undefined}}>
      {plate === 'capsule' ? (
        <div style={{position: 'absolute', left: cx - w / 2, top: CY - h / 2, width: w, height: h, borderRadius: h / 2, overflow: 'hidden',
          opacity: capVis, transform: `scale(${pop})`,
          backdropFilter: 'blur(22px) saturate(1.5)', WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 3px 6px rgba(0,0,0,.3), 0 18px 40px rgba(0,0,0,.4)'}}>
          <GlassSurface radius={h / 2} tone={light ? 'light' : 'dark'} fill={light ? 0.72 : 0.5} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, top: 0, width: frameW, height: frameH, transformOrigin: `${cx}px ${CY}px`, transform: pop !== 1 ? `scale(${pop})` : undefined}}>
      {boxes.map((b, i) => {
        const id = line.ids[i], wd = words[id];
        const next = words[id + 1]?.start ?? wd.end + 0.4;
        const a = wd.start - 0.04, bb = a + 0.1, c = Math.max(bb + 0.01, Math.min(next, wd.end + 0.25) - 0.04), d = c + 0.1;
        const on = interpolate(t, [a, bb, c, d], [0, 1, 1, 0], clamp);
        return (
          <span key={id} style={{position: 'absolute', left: b.x, top: b.y, height: b.h, lineHeight: `${b.h}px`, whiteSpace: 'nowrap',
            fontFamily: FAMILY, fontWeight: WEIGHT, fontSize: SIZE, color: light ? '#15181B' : '#F2F3F5', opacity: textIn * fadeOut,
            filter: textIn < 1 ? `blur(${(1 - textIn) * 6}px)` : undefined, transform: `translateY(${(1 - textIn) * 8}px)`,
            textShadow: plate === 'none'
              ? (light ? '0 1px 2px rgba(255,255,255,.7), 0 0 14px rgba(255,255,255,.55)' : '0 2px 4px rgba(0,0,0,.5), 0 6px 22px rgba(0,0,0,.6)')
              : (light ? '0 1px 0 rgba(255,255,255,.8)' : '0 2px 0 rgba(0,0,0,.35), 0 8px 18px rgba(0,0,0,.45)')}}>
            {hot && wd.text.includes(hot)
              ? <span style={{background: hotFill ?? accent ?? '#FF7A2F', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textShadow: 'none'}}>{b.text}</span>
              : b.text}
            {mark === 'underline' ? (
              <span style={{position: 'absolute', left: 0, right: 0, bottom: 6, height: 5, borderRadius: 3, background: accent ?? (light ? '#FF7A2F' : ACCENT),
                transform: `scaleX(${on})`, transformOrigin: 'left center', opacity: on, boxShadow: `0 0 10px ${accent ?? (light ? '#FF7A2F' : 'rgba(251,185,49,.6)')}`}} />
            ) : null}
          </span>
        );
      })}
      </div>
    </div>
  );
};
