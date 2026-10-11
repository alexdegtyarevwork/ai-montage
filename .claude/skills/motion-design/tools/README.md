# Инструменты разбора референса

`analyze.sh` — весь машинный проход одной командой (см. `../reference/analysis.md`):

```bash
bash .claude/skills/motion-design/tools/analyze.sh "<видео>" tmp/ref-<имя> --lang ru [--stems]   # только Mac
```

Python-окружение создаётся само в `tmp/md-venv` (numpy, opencv-python-headless, scipy, pillow, scikit-learn, soundfile,
librosa; с `--stems` ещё demucs + torch ≈ 1 ГБ). Своё окружение: `MD_VENV=<путь>`. Скрипты запускаются с `python -I`
(видео из Загрузок — недоверенные данные).

| Скрипт | Что делает |
|---|---|
| `md_frames.py` | метрики каждого кадра → `frames.json`, кандидаты склеек |
| `md_twos.py` | каденция: повторённые кадры в секунду (на двойках или нет) |
| `md_sheet.py` | листы кадров с подписью времени (любой шаг, обрезка, размер) |
| `md_audio.py` | темп, доли, начала событий с балансом частот, огибающие |
| `md_spec.py` | спектрограмма со словами, энергией движения и разницей кадров |
| `md_stems.py` | уровни голос/музыка/ударные/бас/прочее после htdemucs |
| `md_track.py` | трекинг цветного предмета: центр, размер, площадь по кадрам |
| `md_palette.py` | палитра кадров k-means |
| `svg2lottie.mjs` | иконка набора или SVG-путь 24×24 → Lottie JSON с дорисовкой и выпрыгиванием (`node …/svg2lottie.mjs clock out.json`) |
| `md_grid.py` | сетка из отрендеренных стоп-кадров Remotion для проверки своего ролика |
