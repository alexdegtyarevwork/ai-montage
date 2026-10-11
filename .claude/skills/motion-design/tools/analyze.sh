#!/usr/bin/env bash
# Разбор референса на микроатомы (метод навыка motion-design, reference/analysis.md):
# кадры, метрики движения и склеек, каденция («на двойках»), листы 2 и 10 к/с, слова (whisper), звук, спектрограмма,
# громкость, палитра; по флагу --stems — разделение на голос/ударные/бас/прочее (htdemucs, первый раз качает ~1 ГБ).
#   bash .claude/skills/motion-design/tools/analyze.sh <видео> <папка-выхода> [--lang ru|en] [--stems]
# Окружение Python: engine/tmp/md-venv (создаётся само) или своё через MD_VENV=<путь>. Только Mac (bash).
set -euo pipefail
SRC="${1:?видео}"; OUT="${2:?папка выхода}"; shift 2
LANG_=ru; STEMS=0
while [ $# -gt 0 ]; do case "$1" in --lang) LANG_="$2"; shift 2;; --stems) STEMS=1; shift;; *) shift;; esac; done
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../../.." && pwd)"
VENV="${MD_VENV:-$ROOT/engine/tmp/md-venv}"; PY="$VENV/bin/python"
if [ ! -x "$PY" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q numpy opencv-python-headless scipy pillow scikit-learn soundfile librosa
fi
mkdir -p "$OUT/f30" "$OUT/s10"
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC" | awk -F/ '{printf "%.3f", $1/($2?$2:1)}')
export FPS
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration -of compact "$SRC" > "$OUT/probe.txt"
ffmpeg -v error -y -i "$SRC" -vsync 0 -q:v 3 "$OUT/f30/%04d.jpg"
ffmpeg -v error -y -i "$SRC" -ac 1 -ar 44100 "$OUT/audio.wav"
N=$(ls "$OUT/f30" | wc -l | tr -d ' ')
echo "кадров: $N, fps: $FPS"

"$PY" -I "$HERE/md_frames.py" "$OUT" > "$OUT/cuts.txt"
"$PY" -I "$HERE/md_twos.py" "$OUT" > "$OUT/cadence.txt"
ffmpeg -v error -y -i "$SRC" -vf "fps=2,scale=320:-1,drawtext=fontfile='$ROOT/engine/public/fonts/JetBrainsMono-Variable.ttf':text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x5:padding=4:color=gray" "$OUT/overview_%d.jpg"
STEP=$(awk -v f="$FPS" 'BEGIN{s=int(f/10+0.5); if(s<1)s=1; print s}')
"$PY" -I "$HERE/md_sheet.py" "$OUT" "$OUT/s10/s" 0 $((N-1)) "$STEP" 6 320 > /dev/null

# расшифровка — движком набора (engine/scripts/transcribe.mjs); путь к выходу абсолютный, т.к. команда идёт из папки engine
OUT_ABS="$(cd "$OUT" && pwd)"
( cd "$ROOT/engine" && node scripts/transcribe.mjs "$OUT_ABS/audio.wav" "$OUT_ABS/words.json" --lang "$LANG_" ) > "$OUT/transcribe.log" 2>&1 \
  || { echo '[]' > "$OUT/words.json"; echo "слова не расшифровались: $OUT/transcribe.log"; }
"$PY" -I "$HERE/md_audio.py" "$OUT/audio.wav" > "$OUT/audio.txt"
"$PY" -I "$HERE/md_spec.py" "$OUT/audio.wav" "$OUT/spec.png" "$OUT/words.json" "$OUT/frames.json"
ffmpeg -nostats -i "$SRC" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' > "$OUT/loudness.txt"
PAL=$("$PY" -I -c "import sys; n=int(sys.argv[1]); f=float(sys.argv[2]); print(','.join(str(i) for i in range(0, n, max(1, int(f*2)))))" "$N" "$FPS")
"$PY" -I "$HERE/md_palette.py" "$OUT" "$PAL" > "$OUT/palette.txt"

if [ "$STEMS" = 1 ]; then
  "$VENV/bin/pip" install -q demucs torchaudio
  "$PY" -I -m demucs -n htdemucs --out "$OUT/stems" "$OUT/audio.wav" > /dev/null 2>&1
  "$PY" -I "$HERE/md_stems.py" ref "$OUT/stems/htdemucs/audio" "$OUT" > "$OUT/stems.txt"
  "$PY" -I "$HERE/md_spec.py" "$OUT/ref.music.wav" "$OUT/spec_music.png" "$OUT/words.json" "$OUT/frames.json"
fi
echo "готово: $OUT (cuts.txt, cadence.txt, overview_*.jpg, s10/, words.json, audio.txt, spec.png, loudness.txt, palette.txt)"
