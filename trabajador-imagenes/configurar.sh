#!/bin/bash
# Guarda la dirección de la app, la llave del trabajador y la clave de Claude.
# Las claves quedan en el Llavero de macOS. Al terminar, reinicia el trabajador.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/configurar.py" "$@"
if [ "$(uname)" = "Darwin" ] && launchctl print "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/$SERVICIO" && echo "El trabajador se reinició con lo nuevo."
fi
