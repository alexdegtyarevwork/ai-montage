// Подготовка движка после npm install: npm run setup
// Скачивает браузер для рендера, ставит whisper.cpp и модель речи. Повторный запуск ничего не скачивает заново.
import './log.mjs'; // журнал команд: engine/logs/ai-montage.log
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {ensureWhisper, retry} from './asr.mjs';
import {WHISPER_MODEL, WHISPER_VERSION} from './whisper-config.mjs';

const cli = path.resolve('node_modules/@remotion/cli/remotion-cli.js');
console.log('Браузер для рендера…');
await retry('браузер для рендера', async () => execFileSync(process.execPath, [cli, 'browser', 'ensure'], {stdio: 'inherit'}));
console.log(`Распознавание речи: whisper.cpp ${WHISPER_VERSION} и модель ${WHISPER_MODEL} (~1,5 ГБ, один раз)…`);
await ensureWhisper();
console.log('Движок готов.');
