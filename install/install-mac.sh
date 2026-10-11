#!/bin/bash
# Установщик набора «AI монтаж» для Mac: процессор Apple (M1 и новее) или Intel, macOS 15 и новее.
#
# С GitHub одной командой (скачает набор в папку ai-montage в папке пользователя и всё поставит):
#   curl -fsSL https://raw.githubusercontent.com/alexdegtyarevwork/ai-montage/main/install/install-mac.sh | bash
# Из уже скачанной папки набора:
#   bash install/install-mac.sh           поставить всё, чего не хватает (и обновить набор с GitHub)
#   bash install/install-mac.sh --check   только проверить, ничего не ставить
#
# Повторный запуск безопасен: что уже стоит, пропускается.
# Что ставится:
#   Инструменты Apple (Command Line Tools)  git, make и компилятор для распознавания речи (окно «Установить»)
#   Node.js, FFmpeg и Python                Mac с Apple M1+: через Homebrew (один раз пароль от Mac в окне macOS);
#                                           Mac на Intel: готовые официальные сборки в ~/.ai-tools, без пароля;
#                                           Python на Intel — из инструментов Apple (python3), без пароля
#   движок                                  Remotion, браузер для рендера, whisper.cpp и модель речи (~1,5 ГБ) — в папку engine

REPO="${AI_MONTAGE_REPO:-https://github.com/alexdegtyarevwork/ai-montage.git}"   # адрес набора на GitHub
MIN_MACOS=15   # Remotion 4.0.526 (и его FFmpeg) работает только на macOS 15 и новее — и на Apple, и на Intel
MIN_NODE=20
MIN_FREE_GB=15
NODE_LINE="latest-v24.x"   # Node.js для Intel: официальная сборка nodejs.org
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1
PROBLEMS=0
ARCH=$(uname -m)
export HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_ENV_HINTS=1 NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_UPDATE_NOTIFIER=false

# Где набор: рядом с этим файлом (запуск из папки набора) или ~/ai-montage (запуск с GitHub)
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$(dirname "$SELF")/../engine/package.json" ]; then
  KIT_DIR="$(cd "$(dirname "$SELF")/.." && pwd)"
else
  KIT_DIR="${AI_MONTAGE_DIR:-$HOME/ai-montage}"
fi
ENGINE_DIR="$KIT_DIR/engine"
TOOLS="$HOME/.ai-tools"                       # Node.js и FFmpeg для Mac на Intel
if [ "$ARCH" = "arm64" ]; then NODE_PLAT=darwin-arm64; FF_ARCH=arm64; else NODE_PLAT=darwin-x64; FF_ARCH=amd64; fi
PROFILE="${AI_MONTAGE_PROFILE:-$HOME/.zprofile}"  # сюда дописывается путь к программам, чтобы их видели новые окна

say()  { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
ok()   { printf '  OK      %s\n' "$*"; }
note() { printf '  !       %s\n' "$*"; }
miss() { printf '  НЕТ     %s\n' "$*"; PROBLEMS=$((PROBLEMS + 1)); }
die()  {
  printf '\n  ОШИБКА  %s\n' "$1"
  [ -n "${2:-}" ] && printf '  Что сделать: %s\n' "$2"
  exit 1
}
# путь к программам пишется и для zsh (~/.zprofile), и для bash (~/.bash_profile): на старых учётках Mac оболочка — bash
add_profile() {
  local f
  for f in "$PROFILE" "$HOME/.bash_profile"; do grep -qsF "$1" "$f" || printf '\n%s\n' "$1" >> "$f"; done
}
# Обновление набора: берётся свежая версия с GitHub целиком (история там всегда одна, поэтому без git pull — после замены
# истории он ломается). Файлы набора, которые ученик поменял у себя:
# - автор этот файл не менял — правка ученика остаётся;
# - поменяли оба: ПРАВИЛА и Стили принадлежат ученику — его версия остаётся, версия автора кладётся рядом «… (новое от автора)»;
#   остальное (код набора) берётся от автора, версия ученика сохраняется рядом с припиской «.мой».
# Свои ролики, записи и настройки вне git (src/mine, work, .env, Готовое…) обновление не трогает.
update_kit() {
  local d="$1" f n=0 base ext tmp list=()
  git -C "$d" fetch -q --depth 1 origin main 2>/dev/null || return 1
  [ "$(git -C "$d" rev-parse HEAD)" = "$(git -C "$d" rev-parse FETCH_HEAD)" ] && return 0
  tmp=$(mktemp -d)
  while IFS= read -r -d '' f; do list+=("$f"); done < <(git -C "$d" -c core.quotepath=off diff --name-only -z HEAD)
  for f in ${list[@]+"${list[@]}"}; do
    [ -f "$d/$f" ] && { mkdir -p "$tmp/$(dirname "$f")"; cp -p "$d/$f" "$tmp/$f"; }
  done
  git -C "$d" reset -q --hard FETCH_HEAD || { rm -rf "$tmp"; return 1; }
  for f in ${list[@]+"${list[@]}"}; do
    [ -f "$tmp/$f" ] || continue   # ученик удалил файл набора — остаётся версия автора
    if [ "$(git -C "$d" rev-parse -q --verify "ORIG_HEAD:$f" 2>/dev/null)" = "$(git -C "$d" rev-parse -q --verify "HEAD:$f" 2>/dev/null)" ]; then
      mkdir -p "$(dirname "$d/$f")"; cp -p "$tmp/$f" "$d/$f"
      continue
    fi
    n=$((n + 1))
    case "$f" in
      ПРАВИЛА/*|Стили/*)
        base="$f"; ext=""; case "$(basename "$f")" in *.*) base="${f%.*}"; ext=".${f##*.}";; esac
        [ -f "$d/$f" ] && cp -p "$d/$f" "$d/$base (новое от автора)$ext"
        mkdir -p "$(dirname "$d/$f")"; cp -p "$tmp/$f" "$d/$f" ;;
      *) cp -p "$tmp/$f" "$d/$f.мой" ;;
    esac
  done
  rm -rf "$tmp"
  [ "$n" -gt 0 ] && note "при обновлении совпали правки в $n файл(ах): твои ПРАВИЛА и Стили сохранены, новое от автора — рядом с пометкой «новое от автора»"
  return 0
}
find_brew() {
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && { printf '%s' "$b"; return 0; }
  done
  return 1
}
node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'; }
node_ok() { [ "$(node_major)" -ge "$MIN_NODE" ] 2>/dev/null; }
ffmpeg_ok() { command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; }
# Python 3.10+ (на Intel годится и python3 из инструментов Apple — он старше, но работает)
python_ok() { command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; }
RETRY="запусти установщик снова; если повторится, пришли куратору текст ошибки"
# FFmpeg: сборка Martin Riedl, запасная — evermeet.cx (часто отвечает «слишком много запросов»). Обе — со ссылками на ffmpeg.org
fetch_ffmpeg_tool() {  # $1 = ffmpeg или ffprobe, $2 = временная папка
  for url in "https://ffmpeg.martin-riedl.de/redirect/latest/macos/$FF_ARCH/release/$1.zip" "https://evermeet.cx/ffmpeg/getrelease/$1/zip"; do
    rm -f "$2/$1.zip" "$TOOLS/bin/$1"
    curl -fsSL --retry 3 --retry-delay 10 -o "$2/$1.zip" "$url" && unzip -o -q "$2/$1.zip" "$1" -d "$TOOLS/bin" \
      && chmod +x "$TOOLS/bin/$1" && "$TOOLS/bin/$1" -version >/dev/null 2>&1 && return 0
  done
  return 1
}
# Node.js и FFmpeg из ПРОМПТА 1 или прошлой установки; старые установки клали их в .tools набора
for d in "$KIT_DIR/.tools/node/bin" "$KIT_DIR/.tools/bin" "$TOOLS/node/bin" "$TOOLS/bin"; do [ -d "$d" ] && export PATH="$d:$PATH"; done
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"

main() {
# Журнал установки: всё, что видно на экране, дописывается в <набор>/install.log (только на этом Mac; больше 1 МБ — начинается заново).
# При ошибке его конец попадает в отчёт для автора курса: npm run report.
mkdir -p "$KIT_DIR" 2>/dev/null && {
  LOG="$KIT_DIR/install.log"
  [ -f "$LOG" ] && [ "$(wc -c < "$LOG" | tr -d ' ')" -gt 1048576 ] && : > "$LOG"
  printf '\n===== установка %s (%s) =====\n' "$(date '+%Y-%m-%d %H:%M')" "$([ "$CHECK_ONLY" = 1 ] && echo проверка || echo установка)" >> "$LOG"
  exec > >(tee -a "$LOG") 2>&1
}
step "1/7 Компьютер"
ver=$(sw_vers -productVersion); major=${ver%%.*}
[ "$major" -ge "$MIN_MACOS" ] || die "macOS $ver, а нужна $MIN_MACOS или новее (этого требует Remotion)" "обнови систему: Настройки → Основные → Обновление ПО; если обновления нет — этот Mac для курса не подойдёт"
ok "macOS $ver"
if [ "$ARCH" = "arm64" ]; then ok "процессор Apple"; else ok "процессор Intel (монтаж и рендер будут медленнее, чем на Apple M1+)"; fi
case "$KIT_DIR" in
  *"/Library/Mobile Documents/"* | "$HOME/Documents"* | "$HOME/Desktop"*)
    note "набор лежит в «Документах» или на «Рабочем столе»: если там включён iCloud, движок будет ломаться; надёжнее папка пользователя" ;;
esac
ok "папка набора: $KIT_DIR"
mkdir -p "$KIT_DIR" 2>/dev/null
free=$(df -g "$KIT_DIR" 2>/dev/null | awk 'NR==2 {print $4}')
if [ "${free:-0}" -ge "$MIN_FREE_GB" ]; then ok "свободно на диске $free ГБ"
elif [ "${free:-0}" -ge 8 ]; then note "свободно $free ГБ — впритык, лучше от $MIN_FREE_GB"
else die "свободно ${free:-?} ГБ, а нужно от $MIN_FREE_GB" "освободи место на диске и запусти снова"; fi

step "2/7 Инструменты Apple (git, make)"
if xcode-select -p >/dev/null 2>&1; then ok "Command Line Tools"
elif [ "$CHECK_ONLY" = 1 ]; then miss "Command Line Tools"
else
  say "  Открываю установку инструментов Apple. В окне macOS нажми «Установить», потом «Принимаю»."
  xcode-select --install >/dev/null 2>&1
  waited=0
  until xcode-select -p >/dev/null 2>&1; do
    sleep 10; waited=$((waited + 10))
    [ $((waited % 60)) -eq 0 ] && say "  …жду, пока установятся инструменты Apple ($((waited / 60)) мин)"
    [ "$waited" -ge 2700 ] && die "инструменты Apple не установились за 45 минут" "запусти установщик ещё раз; если окно не появилось, напиши куратору"
  done
  ok "Command Line Tools"
fi

step "3/7 Набор с GitHub"
if [ -d "$KIT_DIR/.git" ]; then
  if [ "$CHECK_ONLY" = 1 ]; then ok "набор на месте"
  else
    git -C "$KIT_DIR" config user.name >/dev/null 2>&1 || git -C "$KIT_DIR" config user.name "ai-montage"
    git -C "$KIT_DIR" config user.email >/dev/null 2>&1 || git -C "$KIT_DIR" config user.email "student@ai-montage.local"
    if update_kit "$KIT_DIR"; then
      ok "набор обновлён"
    else note "обновить не вышло (нет интернета или свои правки мешают) — работаю с тем, что есть"; fi
  fi
elif [ -f "$ENGINE_DIR/package.json" ]; then ok "набор на месте"
elif [ "$CHECK_ONLY" = 1 ]; then miss "набор не скачан"
else
  case "$REPO" in *'<'*'>'*) die "в установщике не указан адрес набора на GitHub" "напиши автору курса";; esac
  say "  Скачиваю набор с GitHub (~100 МБ)…"
  tmp=$(mktemp -d)
  git clone -q --depth 1 "$REPO" "$tmp/kit" || die "набор не скачался" "проверь интернет и VPN, запусти снова"
  # копируем, а не клонируем прямо в папку: она может быть уже создана и не пустой
  cp -R "$tmp/kit/." "$KIT_DIR/" || die "не получилось положить набор в $KIT_DIR" "$RETRY"
  rm -rf "$tmp"
  git -C "$KIT_DIR" config user.name "ai-montage"; git -C "$KIT_DIR" config user.email "student@ai-montage.local"
  ok "набор скачан в $KIT_DIR"
fi

step "4/7 Программы (Node.js, FFmpeg, Python)"
if [ "$ARCH" = "arm64" ]; then
  brew=$(find_brew)
  if [ -z "$brew" ] && [ "$CHECK_ONLY" = 0 ] && ! { node_ok && ffmpeg_ok && python_ok; }; then
    say "  Скачиваю Homebrew — установщик программ. Сейчас macOS попросит пароль от этого Mac: введи его в окне macOS, не в чат."
    pkg="$(mktemp -d)/Homebrew.pkg"
    curl -fsSL --retry 3 -o "$pkg" "https://github.com/Homebrew/brew/releases/latest/download/Homebrew.pkg" || die "Homebrew не скачался" "проверь интернет и VPN, запусти установщик снова"
    osascript - "$pkg" >/dev/null <<'OSA' || die "Homebrew не установлен: пароль не введён или установку отменили" "запусти установщик снова и введи пароль от Mac в окне"
on run argv
  do shell script "/usr/sbin/installer -pkg " & quoted form of (item 1 of argv) & " -target /" with prompt "Курс «AI монтаж» ставит Homebrew — установщик программ. Введите пароль от этого Mac." with administrator privileges
end run
OSA
    rm -f "$pkg"
    brew=$(find_brew) || die "Homebrew не нашёлся после установки" "$RETRY"
  fi
  if [ -n "$brew" ]; then
    eval "$("$brew" shellenv)"
    [ "$CHECK_ONLY" = 0 ] && add_profile "eval \"\$($brew shellenv)\""
  fi
  if node_ok; then ok "Node.js $(node -v)"
  elif [ "$CHECK_ONLY" = 1 ]; then miss "Node.js $MIN_NODE+"
  else say "  Ставлю Node.js…"; "$brew" install --quiet node || die "Node.js не установился" "$RETRY"; hash -r; ok "Node.js $(node -v)"; fi
  if ffmpeg_ok; then ok "FFmpeg"
  elif [ "$CHECK_ONLY" = 1 ]; then miss "FFmpeg"
  else say "  Ставлю FFmpeg (2–5 минут)…"; "$brew" install --quiet ffmpeg || die "FFmpeg не установился" "$RETRY"; hash -r; ok "FFmpeg"; fi
  if python_ok; then ok "Python $(python3 -V 2>&1 | cut -d' ' -f2)"
  elif [ "$CHECK_ONLY" = 1 ]; then miss "Python 3"
  else say "  Ставлю Python…"; "$brew" install --quiet python || die "Python не установился" "$RETRY"; hash -r; ok "Python $(python3 -V 2>&1 | cut -d' ' -f2)"; fi
else
  # Intel: Homebrew с сентября 2026 почти не собирает пакеты под Intel — готовые сборки в ~/.ai-tools, без пароля.
  if node_ok; then ok "Node.js $(node -v)"
  elif [ "$CHECK_ONLY" = 1 ]; then miss "Node.js $MIN_NODE+"
  else
    say "  Скачиваю Node.js (официальная сборка nodejs.org)…"
    name=$(curl -fsSL "https://nodejs.org/dist/$NODE_LINE/SHASUMS256.txt" | awk -v p="$NODE_PLAT.tar.gz" '$2 ~ p"$" {print $2}' | head -1)
    [ -n "$name" ] || die "не нашёл Node.js на nodejs.org" "проверь интернет и VPN, запусти снова"
    tmp=$(mktemp -d)
    curl -fsSL --retry 3 -o "$tmp/$name" "https://nodejs.org/dist/$NODE_LINE/$name" || die "Node.js не скачался" "проверь интернет и VPN, запусти снова"
    mkdir -p "$TOOLS" && rm -rf "$TOOLS/node" && tar -xzf "$tmp/$name" -C "$tmp" && mv "$tmp/${name%.tar.gz}" "$TOOLS/node" || die "Node.js не распаковался" "$RETRY"
    rm -rf "$tmp"
    export PATH="$TOOLS/node/bin:$PATH"; hash -r
    ok "Node.js $(node -v)"
  fi
  if ffmpeg_ok; then ok "FFmpeg"
  elif [ "$CHECK_ONLY" = 1 ]; then miss "FFmpeg"
  else
    say "  Скачиваю FFmpeg (готовые сборки, на них ссылается ffmpeg.org)…"
    tmp=$(mktemp -d); mkdir -p "$TOOLS/bin"
    for t in ffmpeg ffprobe; do
      fetch_ffmpeg_tool "$t" "$tmp" || die "$t не скачался" "проверь интернет и VPN, запусти снова через пару минут"
    done
    rm -rf "$tmp"
    export PATH="$TOOLS/bin:$PATH"; hash -r
    command -v ffmpeg >/dev/null 2>&1 || die "FFmpeg не находится после установки" "$RETRY"
    ok "FFmpeg"
  fi
  if command -v python3 >/dev/null 2>&1 && python3 -V >/dev/null 2>&1; then ok "Python $(python3 -V 2>&1 | cut -d' ' -f2)"
  else miss "Python 3 (ставится вместе с инструментами Apple, шаг 2)"; fi
  # чтобы Node.js и FFmpeg видели новые окна терминала и Claude
  if [ "$CHECK_ONLY" = 0 ] && [ -d "$TOOLS" ]; then add_profile 'export PATH="$HOME/.ai-tools/node/bin:$HOME/.ai-tools/bin:$PATH"'; fi
fi

step "5/7 Движок (Remotion, браузер для рендера, распознавание речи)"
[ -f "$ENGINE_DIR/package.json" ] || die "нет движка в $ENGINE_DIR" "запусти установщик без --check, он скачает набор"
cd "$ENGINE_DIR" || die "нет доступа к папке $ENGINE_DIR"
[ -f .env ] || { [ "$CHECK_ONLY" = 0 ] && [ -f .env.example ] && cp .env.example .env; }
# зависимости ставятся заново, если сменился package-lock.json (новая версия набора) или прошлая установка оборвалась
lock_sum() { shasum -a 256 package-lock.json 2>/dev/null | cut -d' ' -f1; }
if [ -d node_modules/remotion ] && [ "$(cat node_modules/.ai-montage-lock 2>/dev/null)" = "$(lock_sum)" ]; then ok "Remotion и зависимости"
elif [ "$CHECK_ONLY" = 1 ]; then miss "Remotion и зависимости (нет или устарели)"
else
  say "  Ставлю Remotion и зависимости (2–10 минут)…"
  npm ci --loglevel=error || true
  [ -d node_modules/remotion ] || npm install --loglevel=error
  [ -d node_modules/remotion ] || die "Remotion не поставился" "$RETRY"
  lock_sum > node_modules/.ai-montage-lock
  ok "Remotion и зависимости"
fi
# модель речи medium весит ровно 1533763059 байт: оборванная закачка удаляется и качается заново (npm run setup)
MODEL=.whisper/ggml-medium.bin
if [ -f "$MODEL" ] && [ "$(wc -c < "$MODEL" | tr -d ' ')" != 1533763059 ]; then
  if [ "$CHECK_ONLY" = 1 ]; then miss "модель речи скачана не целиком"; else note "модель речи скачана не целиком — качаю заново"; rm -f "$MODEL"; fi
fi
if [ -d node_modules/.remotion/chrome-headless-shell ] && [ -x .whisper/main ] && [ -f "$MODEL" ]; then
  ok "браузер для рендера и распознавание речи"
elif [ "$CHECK_ONLY" = 1 ]; then miss "браузер для рендера и распознавание речи (npm run setup)"
else
  say "  Скачиваю браузер для рендера, собираю распознавание речи и качаю модель ~1,5 ГБ (5–20 минут)…"
  # закачки внутри уже повторяются; если шаг всё равно упал (долгий обрыв связи) — ещё один заход перед ошибкой
  npm run -s setup || { note "связь прервалась — повторяю шаг"; sleep 10; npm run -s setup; } || die "браузер или распознавание речи не поставились" "проверь интернет или VPN и запусти установку снова — она продолжит с этого места"
  ok "браузер для рендера и распознавание речи"
fi

step "6/7 Проверка"
if npm run -s doctor; then ok "проверка движка"; else miss "проверка движка: см. FAIL выше"; fi

step "7/7 Пробный ролик"
# уже рендерился на этой версии движка — повторно не рендерим (повторный запуск установщика = быстрое обновление)
if [ "$CHECK_ONLY" = 1 ]; then note "в режиме проверки не рендерю"
elif [ -s out/proba.mp4 ] && [ "$(cat out/.proba-lock 2>/dev/null)" = "$(lock_sum)" ]; then ok "пробный ролик уже рендерился на этой версии движка"
else
  mkdir -p out
  say "  Рендерю 5 секунд в 720p (1–10 минут)…"
  t0=$(date +%s)
  node node_modules/@remotion/cli/remotion-cli.js render src/index.ts example-custom out/proba.mp4 --frames=0-149 --scale=0.5 --concurrency=2 --log=error \
    || die "пробный ролик не отрендерился" "пришли куратору текст ошибки выше"
  ok "пробный ролик engine/out/proba.mp4: 5 с видео за $(( $(date +%s) - t0 )) с (ориентир скорости этого Mac)"
  lock_sum > out/.proba-lock
fi

step "Итог"
if [ "$PROBLEMS" -eq 0 ]; then
  say "Готово ✅ Набор установлен в $KIT_DIR."
  say "Полностью закройте Claude (или Codex), откройте снова — и приступайте к следующему уроку."
  exit 0
fi
say "Не хватает: $PROBLEMS (строки «НЕТ» выше). Запусти установщик без --check, он доставит недостающее."
exit 1
}

main "$@" </dev/null
