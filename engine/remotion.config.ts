import {Config} from '@remotion/cli/config';
import {enableTailwind} from '@remotion/tailwind-v4';

// Правила репозитория: один воркер нагрузки, высокое качество.
Config.setConcurrency(2);
// Вывод 2K 1440×2560 (владелец, вечер 18.09.2026: «4K очень долго»). Для 4K — Config.setScale(1.5), рендер ×1,7 дольше.
Config.setScale(1);
// Кадр с 3D и перемоткой видео может считаться дольше стандартных 30 с — запас до двух минут.
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
// Битрейт вместо CRF. Это значение берётся, если вызвать `npx remotion render` напрямую. Через `npm run render` битрейт
// считается по длительности: меньшее из 46 Мбит/с и 2240 / секунды, чтобы файл был до 300 МБ (scripts/render.mjs). Фактический замеряется по файлу.
Config.setVideoBitrate('46M');
Config.setPixelFormat('yuv420p');
// 3D-образцы и предметы рисуют WebGL: без angle безголовый браузер рендера не создаёт контекст (стиль 4 СЦЕНЫ падал).
Config.setChromiumOpenGlRenderer('angle');
Config.overrideBundlerConfig((c) => enableTailwind(c));
// С Node.js 26 кэш webpack ломается после любой правки кода (рендер падает на хэше) — кэш выключен (11.10.2026).
Config.setCachingEnabled(false);
