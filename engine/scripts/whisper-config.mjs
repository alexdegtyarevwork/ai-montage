// Одно место для настроек распознавания речи: им пользуются asr.mjs, transcribe.mjs, cut.mjs, setup.mjs и doctor.mjs.
// Mac: whisper.cpp 1.5.5 собирается из исходников (@remotion/install-whisper-cpp).
// Windows: официальная готовая сборка whisper.cpp 1.9.2 — она сама выбирает вариант под процессор (старые ноутбуки,
// Windows на ARM). Сборка 1.5.5 под Windows требует AVX2 и на части компьютеров не запускается (ошибка 0xC0000142).
// Модель medium (~1,5 ГБ) многоязычная и общая для обеих версий: для русского модели *.en не годятся.
import path from 'node:path';

export const WHISPER_DIR = path.resolve('.whisper');
export const WHISPER_VERSION = process.platform === 'win32' ? '1.9.2' : '1.5.5';
export const WHISPER_MODEL = 'medium';
// Точный размер файла модели: оборванная закачка (VPN, сон ноутбука) короче — такой файл удаляется и качается заново.
export const MODEL_BYTES = {medium: 1533763059};
export const MODEL_FILE = path.join(WHISPER_DIR, `ggml-${WHISPER_MODEL}.bin`);
// Готовая сборка для Windows на ARM (в выпуске 1.9.2 её нет; b5454 — сборка версии 1.9.5)
export const WHISPER_WIN_ARM64_URL = 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-win-cpu-arm64.zip';
// Где лежит программа распознавания (так её ищет @remotion/install-whisper-cpp)
export const WHISPER_EXE = process.platform === 'win32'
  ? path.join(WHISPER_DIR, 'build', 'bin', 'whisper-cli.exe')
  : path.join(WHISPER_DIR, 'main');
