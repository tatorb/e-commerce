#!/bin/bash
# Edita un video de unboxing para probarlo. Ejemplo: ./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --cuartos 1
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/probar_video.py" "$@"
