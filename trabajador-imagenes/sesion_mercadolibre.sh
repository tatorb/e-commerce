#!/bin/bash
# Abre el Chrome de la subida de clips para iniciar sesión en Mercado Libre.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
uv run --project "$CARPETA" --frozen --no-dev python "$CARPETA/sesion_mercadolibre.py" "$@"
