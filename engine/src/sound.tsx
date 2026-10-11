import React from 'react';
import {Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import CATALOG from '../public/sfx/pack/catalog.json';
import type {BlockData} from './template/blocks';

// Звук роликов по ПРАВИЛА/5 Звук.md — один слой для всех стилей, шаблонов и своих роликов.
// Звук задаётся строкой [секунда, звук, громкость?, длительность?] (Cue):
//   'pop', 'whoosh', 'click', 'riser'…  — раздел каталога (public/sfx/pack/КАТАЛОГ.md). Слой сам берёт разные файлы раздела
//                                         по очереди (сначала ★), без повторов подряд. Секунда — момент события на экране:
//                                         у вушей, переходов и нарастаний в эту секунду попадает самое громкое место звука
//                                         (нарастание кончается ровно на раскрытии).
//   'sfx/pack/pop/pop-09.wav'           — точный файл из каталога; секунда — начало звука.
//   'snap', 'tick-soft', 'ui-glass'…    — старые имена звуков движка: заменяются разными файлами того же раздела каталога.
//   'sheet/pop.wav', 'apple/flash.mp3'  — фирменные звуки стилей 15 ЛИСТ и 21 ИСТОРИЯ С ГЕРОЕМ, играют как есть.
// Громкость не указана — стартовая из каталога: подобрана по замеру каждого файла, звук слышен рядом с голосом и тише его.
// Длительность не указана — весь звук (раздел — не дольше 2,5 с).
export type Cue = [number, string, number?, number?];

type Snd = {path: string; cat: string; dur: number; volume: number; favorite: boolean; style: string; also: string[]; rms: number; hit: number; character: string};
const DATA = CATALOG as unknown as {sounds: Snd[]; levels: Record<string, number>};
const SOUNDS = DATA.sounds;
const BY_PATH = new Map<string, Snd>();
for (const s of SOUNDS) for (const p of [s.path, ...s.also]) if (!BY_PATH.has(p)) BY_PATH.set(p, s);

// Сколько секунд звука брать из раздела: длинные хвосты под речью мешают.
const MAX_DUR: Record<string, number> = {pop: 0.8, click: 0.8, ui: 1.3, 'text-appear': 3.5, typing: 1.8, whoosh: 1.7, 'whoosh-fast': 1.3, transition: 1.5,
  riser: 2.5, impact: 2.5, 'bass-drop': 3, counter: 1.8, money: 2, camera: 1.5, sparkle: 2.8, positive: 1.7, negative: 1.7, fall: 1, meme: 4, paper: 1.1};
// У этих разделов в секунду события ставится самое громкое место звука, у остальных — начало.
const PEAKED = new Set(['whoosh', 'whoosh-fast', 'transition', 'riser']);
// Фирменный звук стиля (не «тот же звук»): только в своём стиле, в общие разделы не идёт.
const branded = (s: Snd) => s.style !== '' && !s.style.includes('тот же звук');
// Слишком тихий файл не дотянуть громкостью до нужного уровня — в перебор раздела не берём.
const audible = (s: Snd) => s.rms + (s.favorite ? 12 : 7) >= (DATA.levels[s.cat] ?? -26);
const slow = (s: Snd) => s.character.includes('нарастает');

const POOLS = new Map<string, Snd[]>();
const poolOf = (cat: string): Snd[] => {
  if (!POOLS.has(cat)) {
    const all = SOUNDS.filter((s) => s.cat === cat && !branded(s) && !s.path.includes('/myata/'));
    // вуш с долгим разгоном начинается задолго до стыка и наезжает на соседние звуки — берём быстрые
    let pool = all.filter((s) => s.dur <= (MAX_DUR[cat] ?? 2.5) && audible(s) && (cat === 'riser' || (PEAKED.has(cat) ? s.hit <= 0.5 : !slow(s))));
    if (pool.length < 3) pool = [...all].sort((a, b) => a.dur - b.dur).slice(0, Math.max(3, pool.length));
    POOLS.set(cat, [...pool.filter((s) => s.favorite), ...pool.filter((s) => !s.favorite)]);
  }
  return POOLS.get(cat)!;
};
export const SOUND_CATEGORIES = Object.keys(DATA.levels);

// Число из текста: у разных роликов перебор начинается с разных файлов, у одного ролика — всегда одинаково.
export const seedOf = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
};

// Перебор раздела: сначала ★ (по кругу), потом остальные; соседние звуки раздела всегда разные.
const picker = (seed: number) => {
  const used = new Map<string, number>();
  return (cat: string, fits: (s: Snd) => boolean = () => true): Snd | null => {
    const pool = poolOf(cat);
    if (!pool.length) return null;
    const favs = pool.filter((s) => s.favorite).length, n = used.get(cat) ?? 0;
    used.set(cat, n + 1);
    // ★ идут первыми, остальные — со сдвига по номеру ролика
    const order = [...pool.slice(0, favs), ...rotate(pool.slice(favs), seed)];
    for (let k = 0; k < order.length; k++) {
      const s = order[(n + k) % order.length];
      if (fits(s)) return s;
    }
    return null;
  };
};
const rotate = <T,>(a: T[], seed: number) => (a.length ? [...a.slice(seed % a.length), ...a.slice(0, seed % a.length)] : a);

type Resolved = {start: number; path: string; volume: number; dur: number};
const fileOf = (name: string) => (name.startsWith('sfx/') || name.startsWith('work/') ? name : /\.(wav|mp3|m4a|aiff?|ogg)$/i.test(name) ? `sfx/${name}` : `sfx/${name}.wav`);

// Cue → файл, начало, громкость. Секунды идут по порядку, поэтому соседние звуки одного раздела не совпадают.
export const resolveCues = (cues: Cue[], seed = seedOf(JSON.stringify(cues))): Resolved[] => {
  const pick = picker(seed);
  const out: Resolved[] = [];
  for (const [at, name, vol, len] of [...cues].sort((a, b) => a[0] - b[0])) {
    // раздел каталога или старое имя звука движка → файл раздела
    const old = !SOUND_CATEGORIES.includes(name) && !name.includes('/') && !/\.\w+$/.test(name) ? BY_PATH.get(fileOf(name)) : undefined;
    const cat = SOUND_CATEGORIES.includes(name) ? name : old && !branded(old) ? old.cat : null;
    if (cat) {
      // старое имя: событие — там, где у старого файла было самое громкое место
      const event = old && PEAKED.has(cat) ? at + Math.min(old.hit, 2.5) : at;
      const s = pick(cat, (c) => cat !== 'riser' || event - c.hit >= 0); // нарастание целиком помещается до события
      if (!s) continue;
      const start = PEAKED.has(cat) ? event - s.hit : event;
      out.push({start, path: s.path, volume: vol ?? s.volume, dur: len ?? Math.min(s.dur, MAX_DUR[cat] ?? 2.5)});
    } else {
      const path = fileOf(name), s = BY_PATH.get(path);
      out.push({start: at, path, volume: vol ?? s?.volume ?? 1, dur: len ?? s?.dur ?? 4});
    }
  }
  return out;
};

// Старая раскладка образцов: [секунда начала, имя файла public/sfx, громкость, длительность]. Момент события тот же, а звук —
// разные файлы того же раздела каталога с громкостью из каталога (старое ×0,37 больше не нужно). Фирменные звуки — как есть.
export const fromLegacy = (list: [number, string, number?, number?][]): Cue[] => list.map(([at, name, , len]): Cue => {
  const old = BY_PATH.get(fileOf(name));
  if (!old || branded(old)) return len ? [at, fileOf(name), undefined, len] : [at, fileOf(name)];
  const event = PEAKED.has(old.cat) ? at + Math.min(old.hit, 2.5) : at;
  return len ? [event, old.cat, undefined, len] : [event, old.cat];
});

// Слой звуков: <Sounds cues={[[0.05, 'pop'], [3.3, 'whoosh'], [4.2, 'counter']]} />
export const Sounds: React.FC<{cues: Cue[]; seed?: number}> = ({cues, seed}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {resolveCues(cues, seed).map((c, i) => {
        const from = Math.round(c.start * fps), cut = Math.max(0, -from), len = Math.max(1, Math.round(c.dur * fps) - cut);
        return len > 1 ? (
          <Sequence key={i} from={Math.max(0, from)} durationInFrames={len} layout="none">
            <Audio src={staticFile(c.path)} volume={c.volume} trimBefore={cut || undefined} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};

// Звук по блокам ролика (движок стилей, шаблон КАНВАС): звук почти на каждое видимое действие.
// cut(i) — секунда смены сцены i (вуш), first — до этой секунды первая сцена уже на экране (её появление без звука).
export const FIRST_READY = 1.2;
export const autoCues = (blocks: BlockData[], cut: (b: BlockData, i: number) => number): Cue[] => {
  const cues: Cue[] = [[0.05, 'pop']];
  const reveals: number[] = [];   // раскрытия: новый крупный предмет, цифра — сюда может кончаться нарастание
  const add = (i: number, at: number, name: string, len?: number) => {
    if (i === 0 && at < FIRST_READY) return;
    cues.push(len ? [at, name, undefined, len] : [at, name]);
  };
  blocks.forEach((b, i) => {
    if (i > 0) add(i, cut(b, i), 'whoosh');
    switch (b.kind) {
      case 'hook':
        if (b.object && i > 0) { add(i, b.at + 0.5, 'pop'); reveals.push(b.at + 0.5); }
        if (b.strikeAt !== undefined) add(i, b.strikeAt + 0.1, 'whoosh-fast');
        break;
      case 'list':
        add(i, b.at + 0.4, 'pop');
        b.ticks.forEach((tc, k) => add(i, tc, k === b.ticks.length - 1 ? 'positive' : 'click'));
        break;
      case 'stat':
        add(i, b.countAt, 'counter', 1.3);
        add(i, b.countAt + 0.3, 'pop');   // растут столбики
        reveals.push(b.countAt);
        break;
      case 'logos':
        b.logos.forEach((_, k) => add(i, b.at + 0.3 + k * 0.16, 'pop'));
        if (b.object) add(i, b.at + 0.9, 'sparkle');
        break;
      case 'flow':
        b.nodes.forEach((_, k) => add(i, b.at + 0.35 + k * 0.55, k % 2 ? 'ui' : 'pop'));
        break;
      case 'cta':
        add(i, b.at + 0.3, 'ui');
        add(i, b.typeAt, 'typing', 0.6);
        add(i, b.typeAt + 0.8, 'positive');
        break;
    }
  });
  // Одно нарастание на ролик: конец — на раскрытии, перед которым меньше всего других звуков (нарастание не спорит с ними).
  const busy = (r: number) => cues.filter(([at]) => at > r - 1.6 && at < r - 0.05).length;
  const reveal = reveals.filter((r) => r > 1.5).sort((x, y) => busy(x) - busy(y) || x - y)[0];
  if (reveal !== undefined) cues.push([reveal, 'riser']);
  // два звука почти в одну секунду сливаются в щелчок: оставляем первый (нарастание не трогаем)
  const sorted = cues.sort((x, y) => x[0] - y[0]);
  return sorted.filter((c, k) => c[1] === 'riser' || !sorted.slice(0, k).some((p) => p[1] !== 'riser' && c[0] - p[0] < 0.12));
};
