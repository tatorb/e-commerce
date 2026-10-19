#!/bin/bash
# Dice si el trabajador está corriendo y muestra lo último que hizo.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
if [ "$(uname)" = "Darwin" ] && launchctl print "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1; then
  if launchctl print "gui/$(id -u)/$SERVICIO" | grep -q "state = running"; then
    echo "El trabajador está prendido y corriendo."
  else
    echo "El trabajador está prendido pero no está corriendo ahora: macOS lo vuelve a arrancar en unos segundos."
  fi
else
  echo "El trabajador está apagado. Para prenderlo: bash prender.sh"
fi
echo
if [ -f "$REGISTRO" ]; then
  echo "Lo último que hizo:"
  tail -n 15 "$REGISTRO"
else
  echo "Todavía no hay registro."
fi
