#!/bin/bash
# Prueba la subida de un clip. Ejemplo: bash probar_subida.sh ~/Desktop/clip.mp4 MLA3307805900
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/probar_subida.py" "$@"
