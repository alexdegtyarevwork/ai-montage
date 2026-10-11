import {staticFile} from 'remotion';

// Путь к звуку для своего кода. Звук в роликах ставит слой <Sounds> из src/sound.tsx (ПРАВИЛА/5 Звук.md) — он и громкость
// берёт из каталога, и файлы раздела перебирает. Здесь — просто путь по имени или пути из каталога public/sfx/pack/КАТАЛОГ.md:
//   'whoosh'                    → public/sfx/whoosh.wav (звуки движка)
//   'sfx/pack/pop/pop-09.wav'   → как есть (путь из каталога)
//   'sheet/pop.wav'             → public/sfx/sheet/pop.wav
export const sfxSrc = (name: string) =>
  staticFile(name.startsWith('sfx/') ? name : /\.(wav|mp3|m4a|aiff?|ogg)$/i.test(name) ? `sfx/${name}` : `sfx/${name}.wav`);
