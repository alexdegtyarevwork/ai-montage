import type {Word} from '../../montage/words';

// Демо-слова шаблона, разложены равномерно, чтобы видеть субтитры, пока записи нет. После
// npm run transcribe -- public/work/<slug>/voice-cut.wav work/<slug>/words.json ролик сам переключится на настоящие слова
// (блок «файлы проекта» в Reel.tsx). Правка слов — только написание в words.json, время не трогать.
const phrase = (start: number, text: string, step = 0.32): Word[] =>
  text.split(' ').map((w, i) => ({text: w, start: +(start + i * step).toFixed(2), end: +(start + i * step + step * 0.85).toFixed(2)}));

export const WORDS: Word[] = [
  ...phrase(0.1, 'Мне уже страшно за монтажёров.'),
  ...phrase(2.2, 'Этот ролик собрал ИИ-агент за вечер.'),
  ...phrase(4.8, 'Он сам делает субтитры, графику и звук.'),
  ...phrase(8.0, 'Смотри, как это устроено по шагам.'),
  ...phrase(11.2, 'Напиши «монтаж» в комментариях, пришлю шаблон.'),
];
export const END = 15;
