#!/bin/bash
# Apaga el trabajador y deja de arrancarlo solo. Para volver a prenderlo: bash prender.sh
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
launchctl bootout "gui/$(id -u)/$SERVICIO" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "El trabajador está apagado y no arranca solo. Lo que tenía a medias vuelve a la cola de la app."
