<#
  Установщик набора «AI монтаж» для Windows 10/11 (64-бит).

  С GitHub (скачает набор в C:\ai-montage и всё поставит) — одна строка в PowerShell:
    [Net.ServicePointManager]::SecurityProtocol='Tls12'; irm https://raw.githubusercontent.com/alexdegtyarevwork/ai-montage/main/install/install-windows.ps1 -OutFile $env:TEMP\ai-montage-install.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File $env:TEMP\ai-montage-install.ps1
  Из папки набора (обновит набор с GitHub и доставит недостающее):
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\ai-montage\install\install-windows.ps1          поставить всё
    powershell -NoProfile -ExecutionPolicy Bypass -File C:\ai-montage\install\install-windows.ps1 -Check   только проверить

  Повторный запуск безопасен: что уже стоит, пропускается.
  Windows до трёх раз спросит «Разрешить этому приложению вносить изменения?» (Git, Node.js, Visual C++): нажать «Да».

  Что ставится:
    Git              обновления набора
    Node.js (x64)    запускает Remotion и скрипты набора
    FFmpeg           режет и склеивает видео и звук, проверяет файлы
    Python           для дополнительных скриптов и инструментов
    Visual C++       библиотеки Microsoft, без них не запускаются рендер и распознавание речи
    движок           Remotion, браузер для рендера, whisper.cpp и модель речи (~1,5 ГБ) — в папку engine

  Файл сохранён в UTF-8 с BOM: без BOM Windows PowerShell 5.1 искажает русские буквы.
#>
param([switch]$Check)

$MinNode = 20
$MinFreeGB = 15
$Repo = if ($env:AI_MONTAGE_REPO) { $env:AI_MONTAGE_REPO } else { 'https://github.com/alexdegtyarevwork/ai-montage.git' }  # адрес набора на GitHub
# Где набор: рядом с этим файлом (запуск из папки набора) или C:\ai-montage (запуск с GitHub)
$KitDir = $null
if ($PSScriptRoot) {
  $parent = Split-Path -Parent $PSScriptRoot
  if (Test-Path (Join-Path $parent 'engine\package.json')) { $KitDir = $parent }
}
if (-not $KitDir) { $KitDir = if ($env:AI_MONTAGE_DIR) { $env:AI_MONTAGE_DIR } else { 'C:\ai-montage' } }
$EngineDir = Join-Path $KitDir 'engine'
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$env:NPM_CONFIG_FUND = 'false'
$env:NPM_CONFIG_AUDIT = 'false'
$env:NPM_CONFIG_UPDATE_NOTIFIER = 'false'
$script:Problems = 0
# Журнал установки: всё, что видно на экране, дописывается в <набор>\install.log (только на этом компьютере; больше 1 МБ — начинается заново).
# При ошибке его конец попадает в отчёт для автора курса: npm run report.
try {
  New-Item -ItemType Directory -Force -Path $KitDir | Out-Null
  $InstallLog = Join-Path $KitDir 'install.log'
  if ((Test-Path $InstallLog) -and ((Get-Item $InstallLog).Length -gt 1MB)) { Remove-Item -Force $InstallLog }
  Start-Transcript -Path $InstallLog -Append | Out-Null
} catch {}
$IsArm = ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') -or ($env:PROCESSOR_ARCHITEW6432 -eq 'ARM64')
$FixFolder = 'набор должен лежать в C:\ai-montage: запусти установщик с GitHub, он сам положит набор туда'
$FixRetry = 'запусти установщик снова; если повторится, пришли куратору текст ошибки'

function Step($t) { Write-Host ''; Write-Host "== $t" }
function Ok($t)   { Write-Host "  OK      $t" }
function Note($t) { Write-Host "  !       $t" }
function Miss($t) { Write-Host "  НЕТ     $t"; $script:Problems++ }
function Die($t, $fix) {
  Write-Host ''
  Write-Host "  ОШИБКА  $t"
  if ($fix) { Write-Host "  Что сделать: $fix" }
  exit 1
}
function Has($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
# Обновление набора: берётся свежая версия с GitHub целиком (история там всегда одна, поэтому без git pull — после замены
# истории он ломается). Файлы набора, которые ученик поменял у себя:
# - автор этот файл не менял — правка ученика остаётся;
# - поменяли оба: ПРАВИЛА и Стили принадлежат ученику — его версия остаётся, версия автора кладётся рядом «… (новое от автора)»;
#   остальное (код набора) берётся от автора, версия ученика сохраняется рядом с припиской «.мой».
# Свои ролики, записи и настройки вне git (src/mine, work, .env, Готовое…) обновление не трогает.
# Файлы копируются Copy-Item, а не перенаправлением вывода: так не портится кодировка.
function Update-Kit($dir) {
  & git -C $dir fetch -q --depth 1 origin main 2>$null
  if ($LASTEXITCODE -ne 0) { return $false }
  if ((& git -C $dir rev-parse HEAD) -eq (& git -C $dir rev-parse FETCH_HEAD)) { return $true }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('ai-montage-upd-' + [guid]::NewGuid().ToString('N'))
  $files = @(& git -C $dir -c core.quotepath=off diff --name-only HEAD | Where-Object { $_ })
  foreach ($f in $files) {
    $full = Join-Path $dir $f
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $save = Join-Path $tmp $f
      New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($save)) | Out-Null
      Copy-Item -LiteralPath $full -Destination $save -Force
    }
  }
  & git -C $dir reset -q --hard FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue; return $false }
  $n = 0
  foreach ($f in $files) {
    $save = Join-Path $tmp $f
    if (-not (Test-Path -LiteralPath $save)) { continue }   # ученик удалил файл набора — остаётся версия автора
    $full = Join-Path $dir $f
    $old = & git -C $dir rev-parse -q --verify "ORIG_HEAD:$f" 2>$null
    $new = & git -C $dir rev-parse -q --verify "HEAD:$f" 2>$null
    New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($full)) | Out-Null
    if ($old -eq $new) { Copy-Item -LiteralPath $save -Destination $full -Force; continue }
    $n++
    if ($f -like 'ПРАВИЛА/*' -or $f -like 'Стили/*') {
      if (Test-Path -LiteralPath $full) {
        $ext = [IO.Path]::GetExtension($full)
        $copy = Join-Path ([IO.Path]::GetDirectoryName($full)) ([IO.Path]::GetFileNameWithoutExtension($full) + ' (новое от автора)' + $ext)
        Copy-Item -LiteralPath $full -Destination $copy -Force
      }
      Copy-Item -LiteralPath $save -Destination $full -Force
    } else {
      Copy-Item -LiteralPath $save -Destination ($full + '.мой') -Force
    }
  }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  if ($n -gt 0) { Note "при обновлении совпали правки в $n файл(ах): твои ПРАВИЛА и Стили сохранены, новое от автора — рядом с пометкой «новое от автора»" }
  return $true
}
function Refresh-Path {
  # программы, только что поставленные winget, видны без перезапуска окна
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Node-Ok {
  # Remotion на Windows работает только с Node.js x64 (на компьютерах с процессором ARM — тоже x64, через эмуляцию)
  if (-not (Has 'node')) { return $false }
  $v = (& node -v) -replace '^v', ''
  if ([int]($v.Split('.')[0]) -lt $MinNode) { return $false }
  return ((& node -p 'process.arch') -eq 'x64')
}
function Python-Ok {
  # «python» из папки WindowsApps — заглушка, открывающая Microsoft Store, а не Python
  foreach ($c in @(@('py', '-3'), @('python'))) {
    $cmd = Get-Command $c[0] -ErrorAction SilentlyContinue
    if (-not $cmd -or $cmd.Source -like '*WindowsApps*') { continue }
    & $c[0] @($c | Select-Object -Skip 1) -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>$null
    if ($LASTEXITCODE -eq 0) { return $true }
  }
  return $false
}
function Has-VCRedist {
  foreach ($k in @('HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
                   'HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64')) {
    $p = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue
    if ($p -and $p.Installed -eq 1) { return $true }
  }
  return $false
}
function Winget-Install($id, $label, $extra) {
  Write-Host "  Ставлю $label…"
  $wargs = @('install', '--id', $id, '-e', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements') + $extra
  & winget @wargs
  $code = $LASTEXITCODE
  Refresh-Path
  # -1978335189: уже стоит; -1978334967: поставлено, Windows просит перезагрузку
  if ($code -eq -1978334967) { Note "$label поставлен, Windows просит перезагрузку: перезагрузи компьютер после установки"; return }
  if ($code -ne 0 -and $code -ne -1978335189) { Die "$label не установился (код winget $code)" $FixRetry }
}
function Ensure-Program($label, [scriptblock]$present, $wingetId, $extra) {
  if (& $present) { Ok $label; return }
  if ($Check) { Miss $label; return }
  Winget-Install $wingetId $label $extra
  if (& $present) { Ok $label } else { Die "$label не находится после установки" 'закрой приложение агента, открой снова и повтори установку' }
}

Step '1/6 Компьютер'
$os = [Environment]::OSVersion.Version
if ($os.Major -lt 10 -or $os.Build -lt 17763) { Die "Windows $os, а нужна Windows 10 (версия 1809 и новее) или 11" 'обнови Windows' }
if (-not [Environment]::Is64BitOperatingSystem) { Die 'Windows 32-бит, а нужна 64-бит' 'нужен 64-битный Windows' }
Ok "Windows, сборка $($os.Build)$(if ($IsArm) { ', процессор ARM' })"
if ($KitDir -match '[^\x00-\x7F]') { Die "в пути к папке есть русские буквы: $KitDir" $FixFolder }
if ($KitDir -match 'OneDrive') { Die "папка лежит в OneDrive: $KitDir" $FixFolder }
Ok "папка набора: $KitDir"
$drive = Get-PSDrive -Name $KitDir.Substring(0, 1) -ErrorAction SilentlyContinue
if ($drive) {
  $free = [math]::Floor($drive.Free / 1GB)
  if ($free -ge $MinFreeGB) { Ok "свободно на диске $free ГБ" }
  elseif ($free -ge 8) { Note "свободно $free ГБ — впритык, лучше от $MinFreeGB" }
  else { Die "свободно $free ГБ, а нужно от $MinFreeGB" 'освободи место на диске и запусти снова' }
}

Step '2/6 Программы (Git, Node.js, FFmpeg, Python, Visual C++)'
Refresh-Path  # видеть программы, поставленные раньше, даже если окно агента открыто давно
if (-not (Has 'winget')) {
  if ($Check) { Miss 'winget' }
  else { Die 'нет winget, установщика программ Windows' 'открой Microsoft Store → «Установщик приложений» (App Installer) → Обновить, потом запусти установщик снова' }
} else { Ok 'winget' }
Ensure-Program 'Git' { Has 'git' } 'Git.Git' @()
if ((Has 'node') -and -not $Check -and ((& node -p 'process.arch') -ne 'x64')) {
  Die "стоит Node.js для процессора $(& node -p 'process.arch'), а Remotion на Windows работает только с x64" 'удали Node.js в «Параметры → Приложения» и запусти установщик снова: он поставит нужный'
}
Ensure-Program "Node.js $MinNode+ (x64)" { Node-Ok } 'OpenJS.NodeJS.LTS' @('--architecture', 'x64')
Ensure-Program 'FFmpeg' { (Has 'ffmpeg') -and (Has 'ffprobe') } 'Gyan.FFmpeg.Essentials' @()
Ensure-Program 'Python 3' { Python-Ok } 'Python.Python.3.13' @('--scope', 'user')
Ensure-Program 'Visual C++ (библиотеки Microsoft)' { Has-VCRedist } 'Microsoft.VCRedist.2015+.x64' @()

Step '3/6 Набор с GitHub'
if (Test-Path (Join-Path $KitDir '.git')) {
  if ($Check) { Ok 'набор на месте' }
  else {
    & git -C $KitDir config user.name 'ai-montage'
    & git -C $KitDir config user.email 'student@ai-montage.local'
    if (Update-Kit $KitDir) { Ok 'набор обновлён' } else { Note 'обновить не вышло (нет интернета или свои правки мешают) — работаю с тем, что есть' }
  }
} elseif (Test-Path (Join-Path $EngineDir 'package.json')) { Ok 'набор на месте' }
elseif ($Check) { Miss 'набор не скачан' }
else {
  if ($Repo -match '[<>]') { Die 'в установщике не указан адрес набора на GitHub' 'напиши автору курса' }
  Write-Host '  Скачиваю набор с GitHub (~100 МБ)…'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('ai-montage-' + [guid]::NewGuid().ToString('N'))
  & git clone -q --depth 1 $Repo $tmp
  if ($LASTEXITCODE -ne 0) { Die 'набор не скачался' 'проверь интернет и VPN, запусти снова' }
  # копируем, а не клонируем прямо в папку: она может быть уже создана и не пустой
  New-Item -ItemType Directory -Force -Path $KitDir | Out-Null
  & robocopy $tmp $KitDir /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { Die "не получилось положить набор в $KitDir" $FixRetry }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  & git -C $KitDir config user.name 'ai-montage'
  & git -C $KitDir config user.email 'student@ai-montage.local'
  Ok "набор скачан в $KitDir"
}

Step '4/6 Движок (Remotion, браузер для рендера, распознавание речи)'
if (-not (Test-Path (Join-Path $EngineDir 'package.json'))) {
  if ($Check) { Note 'движка ещё нет: запусти установщик без -Check' ; Step 'Итог'; Write-Host "Не хватает: $($script:Problems + 1)."; exit 1 }
  Die "нет движка в $EngineDir" $FixRetry
}
Set-Location $EngineDir
if (-not (Test-Path '.env') -and (Test-Path '.env.example') -and -not $Check) { Copy-Item '.env.example' '.env' }
# зависимости ставятся заново, если сменился package-lock.json (новая версия набора) или прошлая установка оборвалась
function Lock-Sum { if (Test-Path 'package-lock.json') { return (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash.ToLower() } return '' }
$mark = 'node_modules\.ai-montage-lock'
$fresh = (Test-Path 'node_modules\remotion') -and (Test-Path $mark) -and ((Get-Content $mark -Raw -ErrorAction SilentlyContinue).Trim() -eq (Lock-Sum))
if ($fresh) { Ok 'Remotion и зависимости' }
elseif ($Check) { Miss 'Remotion и зависимости (нет или устарели)' }
else {
  Write-Host '  Ставлю Remotion и зависимости (5–15 минут)…'
  & npm.cmd ci --loglevel=error
  if (-not (Test-Path 'node_modules\remotion')) { & npm.cmd install --loglevel=error }
  if (-not (Test-Path 'node_modules\remotion')) { Die 'Remotion не поставился' $FixRetry }
  Set-Content -Path $mark -Value (Lock-Sum) -NoNewline -Encoding ascii
  Ok 'Remotion и зависимости'
}
# модель речи medium весит ровно 1533763059 байт: оборванная закачка удаляется и качается заново (npm run setup)
$model = '.whisper\ggml-medium.bin'
if ((Test-Path $model) -and ((Get-Item $model).Length -ne 1533763059)) {
  if ($Check) { Miss 'модель речи скачана не целиком' } else { Note 'модель речи скачана не целиком — качаю заново'; Remove-Item -Force $model }
}
$ready = (Test-Path 'node_modules\.remotion\chrome-headless-shell') -and (Test-Path '.whisper\build\bin\whisper-cli.exe') -and (Test-Path $model)
if ($ready) { Ok 'браузер для рендера и распознавание речи' }
elseif ($Check) { Miss 'браузер для рендера и распознавание речи (npm run setup)' }
else {
  Write-Host '  Скачиваю браузер для рендера и модель речи ~1,5 ГБ (5–20 минут)…'
  & npm.cmd run -s setup
  # закачки внутри уже повторяются; если шаг всё равно упал (долгий обрыв связи) — ещё один заход перед ошибкой
  if ($LASTEXITCODE -ne 0) { Note 'связь прервалась — повторяю шаг'; Start-Sleep -Seconds 10; & npm.cmd run -s setup }
  if ($LASTEXITCODE -ne 0) { Die 'браузер или распознавание речи не поставились' 'проверь интернет или VPN и запусти установку снова — она продолжит с этого места' }
  Ok 'браузер для рендера и распознавание речи'
}

Step '5/6 Проверка'
& npm.cmd run -s doctor
if ($LASTEXITCODE -eq 0) { Ok 'проверка движка' } else { Miss 'проверка движка: см. FAIL выше' }

Step '6/6 Пробный ролик'
# уже рендерился на этой версии движка — повторно не рендерим (повторный запуск установщика = быстрое обновление)
$probaMark = 'out\.proba-lock'
if ($Check) { Note 'в режиме проверки не рендерю' }
elseif ((Test-Path 'out\proba.mp4') -and (Test-Path $probaMark) -and ((Get-Content $probaMark -Raw -ErrorAction SilentlyContinue).Trim() -eq (Lock-Sum))) { Ok 'пробный ролик уже рендерился на этой версии движка' }
else {
  New-Item -ItemType Directory -Force -Path 'out' | Out-Null
  Write-Host '  Рендерю 5 секунд в 720p (1–10 минут)…'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & node 'node_modules\@remotion\cli\remotion-cli.js' render 'src/index.ts' 'example-custom' 'out\proba.mp4' --frames=0-149 --scale=0.5 --concurrency=2 --log=error
  if ($LASTEXITCODE -ne 0) { Die 'пробный ролик не отрендерился' 'пришли куратору текст ошибки выше' }
  $sec = [math]::Round($sw.Elapsed.TotalSeconds)
  Ok "пробный ролик engine\out\proba.mp4: 5 с видео за $sec с (ориентир скорости этого компьютера)"
  Set-Content -Path $probaMark -Value (Lock-Sum) -NoNewline -Encoding ascii
}

Step 'Итог'
if ($script:Problems -eq 0) {
  Write-Host "Готово ✅ Набор установлен в $KitDir."
  Write-Host "Полностью закройте Claude (или Codex), откройте снова — и приступайте к следующему уроку."
  exit 0
}
Write-Host "Не хватает: $($script:Problems) (строки «НЕТ» выше). Запусти установщик без -Check, он доставит недостающее."
exit 1
