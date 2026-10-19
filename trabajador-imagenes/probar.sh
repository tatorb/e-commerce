#!/bin/bash
# Pasa una foto por los 8 pasos. Ejemplo: ./probar.sh ~/Desktop/IMG_7346.HEIC --preguntar
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/probar.py" "$@"
