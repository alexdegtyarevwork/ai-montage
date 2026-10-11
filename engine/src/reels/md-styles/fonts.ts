import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Сверхузкий гротеск стиля 18 ТОЧКА (в референсе C — Druk / Bebas). Bebas Neue Bold с кириллицей, файл из шрифтов владельца.
// Перед публикацией курса проверить лицензию файла или заменить на Oswald 700 (OFL).
loadFont({family: 'Bebas Neue', url: staticFile('fonts/BebasNeue-Bold.ttf'), weight: '700'});
export const DISPLAY = '"Bebas Neue", "SF Pro Display", sans-serif';
// Bebas Neue Regular 400 — слова-акценты ролика «Моушн без AE» (выбор владельца 08.10.2026).
loadFont({family: 'Bebas Neue', url: staticFile('fonts/BebasNeue-Regular.ttf'), weight: '400'});
