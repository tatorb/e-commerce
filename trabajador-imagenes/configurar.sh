#!/bin/bash
# Guarda la clave de Claude en el Llavero de macOS.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/configurar.py" "$@"
