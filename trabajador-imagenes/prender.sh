#!/bin/bash
# Prende el trabajador y deja que macOS lo arranque solo cada vez que iniciás sesión.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
if [ "$(uname)" != "Darwin" ]; then
  echo "El arranque automático es solo para Mac. Acá se corre con: bash arrancar.sh"
  exit 1
fi
mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$REGISTRO")" "$PROGRAMA"
# La copia que corre macOS, siempre igual a esta carpeta.
rsync -a --delete --exclude tests --exclude __pycache__ --exclude .venv --exclude .pytest_cache "$CARPETA/" "$PROGRAMA/"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$SERVICIO</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROGRAMA/arrancar.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$HOME/Library/Logs/MRB Imagenes/salida.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/Library/Logs/MRB Imagenes/salida.log</string>
</dict>
</plist>
PLIST
# Si ya estaba prendido, se apaga primero. macOS tarda un poco en soltarlo:
# si se prende antes, falla con "Bootstrap failed: 5". Se espera hasta 15 segundos.
if launchctl print "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    launchctl print "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1 || break
    sleep 0.5
  done
fi
if ! launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null; then
  sleep 3
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
fi
echo "El trabajador está prendido y arranca solo cada vez que iniciás sesión."
echo "Para ver qué está haciendo: bash estado.sh"
