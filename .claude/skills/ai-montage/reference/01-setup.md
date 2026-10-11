# Рабочее место

## Что ставит установщик (`install/install-windows.ps1` или `install/install-mac.sh`)

Набор лежит на GitHub. Команды установки одной строкой есть в `README.md`. Установщик скачивает набор
(`C:\ai-montage` на Windows, `~/ai-montage` на Mac), а при повторном запуске обновляет его
(берёт свежую версию с GitHub; правки ученика в своих файлах сохраняются, при совпадении — рядом «новое от автора» или «.мой»).

| Что | Зачем | Windows | Mac с Apple M1+ | Mac с Intel |
|---|---|---|---|---|
| Git | скачать и обновлять набор | winget `Git.Git` | инструменты Apple | инструменты Apple |
| Node.js 20+ | запускает Remotion и скрипты | winget `OpenJS.NodeJS.LTS`, всегда **x64** (на ARM работает через эмуляцию) | Homebrew `node` | сборка nodejs.org `darwin-x64` в `~/.ai-tools/node` |
| FFmpeg | видео, звук, проверки | winget `Gyan.FFmpeg.Essentials` | Homebrew `ffmpeg` | ffmpeg.martin-riedl.de (запасной — evermeet.cx) в `~/.ai-tools/bin` |
| Visual C++ | библиотеки Microsoft для рендера и whisper | winget `Microsoft.VCRedist.2015+.x64` | не нужен | не нужен |
| Инструменты Apple | git, make, компилятор для whisper | не нужны | `xcode-select --install` | `xcode-select --install` |
| Движок | Remotion и всё нужное (`npm ci` в `engine`, ~700 МБ) | да | да | да |
| Браузер и распознавание речи | `npm run setup`: браузер для рендера (~100 МБ), whisper.cpp, модель medium (~1,5 ГБ) | whisper 1.9.2 x64 (на ARM — сборка arm64) | whisper 1.5.5 из исходников | whisper 1.5.5 из исходников |

На Mac с процессором Apple Node.js и FFmpeg ставятся через Homebrew (пакет Homebrew.pkg, пароль от Mac — один раз в окне macOS).
На Intel Homebrew с сентября 2026 почти не собирает пакеты, поэтому там готовые сборки в `~/.ai-tools`, без пароля. Путь к ним установщик дописывает в `~/.zprofile`.

Компьютер: Windows 10 (1809+) или 11, 64-бит. Mac с процессором Apple или Intel, но обязательно macOS 15 и новее:
Remotion 4.0.526 и его FFmpeg собраны под macOS 15. На Intel это Mac 2018–2020 годов, которые обновляются до Sequoia;
монтаж и рендер на них заметно медленнее, чем на M1. Свободно от 15 ГБ. Папка набора на Windows — `C:\ai-montage`
(без русских букв в пути и не в OneDrive).

## Проверка

- `npm run doctor` в `engine`: всё OK.
- `npm run studio` в `engine`: студия в браузере (просмотр). Папки слева: Projects (проекты учеников на движке стилей),
  Reels (свои ролики по образцам), Styles (стили движка 2 и 5–13, каждый в двух форматах: Reels и YouTube), Template, Kit, QA.
- Скорость: установщик в конце рендерит 5 секунд в 720p и пишет время. На среднем ноутбуке финал 1080p при 30 к/с —
  примерно 5–15 минут на минуту ролика; 2K и 60 к/с — в 2–4 раза дольше; 4K — ещё дольше.

## Где что лежит у ролика (внутри `engine`)

- `work/<slug>/`: план (DIRECTION.md), бриф, источники, отчёт.
- `public/work/<slug>/`: запись (`speaker.mp4`, `voice.wav`, после нарезки `speaker-cut.mp4`, `voice-cut.wav`),
  вставки (`stock/`), фото героев (`hero/`), музыка.
- `src/mine/<slug>/Reel.tsx` или `project.ts`: код ролика ученика (студия находит его сама). `reviews/<slug>-vNNN/`: листы кадров. `out/`: рендеры.
- Готовое для ученика — в `Готовое/<дата>_<тема>/` в корне набора.
