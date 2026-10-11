import React from 'react';
import META_RAW from './sfx-meta.json';
import {fromLegacy, Sounds} from '../../sound';

// Звук как часть движения (разборы A, B, C): одно событие на экране — один звук, пик звука ровно на кадре события.
// Метка: [кадр 30 fps, файл из public/sfx без .wav, громкость, ставить пиком? (по умолчанию да), длительность с].
// Играет по ПРАВИЛА/5 Звук.md (src/sound.tsx): в тот же момент — разные файлы того же раздела каталога, громкость из каталога.
const META = META_RAW as Record<string, {onset: number; peak: number; dur: number; db: number}>;
export type Cue = [number, string, number, boolean?, number?];

export const Cues: React.FC<{list: Cue[]}> = ({list}) => (
  <Sounds cues={fromLegacy(list.map(([at, key, v, pk = true, dd]): [number, string, number, number?] => {
    const m = META[key];
    if (!m) throw new Error(`нет звука в sfx-meta.json: ${key}`);
    return [Math.max(0, at / 30 - (pk ? m.peak : m.onset)), key, v, dd];
  }))} />
);

// Подъём перед стыком (C: последняя доля такта — шумовой подъём, пик ровно на смене главы).
export const riserTo = (cut: number, v = 0.8): Cue => [cut, 'riser', v, true, 1.0];
