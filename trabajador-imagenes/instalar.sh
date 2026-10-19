#!/bin/bash
# Deja listo el trabajador: Python, librerías y el modelo para quitar el fondo.
# Se puede correr de nuevo sin problema: solo completa lo que falta.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"

echo "Instalando el trabajador de imágenes…"
if [ "$(uname)" = "Darwin" ] && [ "$(uname -m)" != "arm64" ]; then
  echo "Aviso: esta Mac no tiene chip Apple. Algunas librerías pueden no instalarse."
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "Instalando uv, el instalador de Python…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
mkdir -p "$DATOS"
uv sync --project "$CARPETA" --frozen --no-dev
echo "Bajando el modelo para quitar el fondo (una sola vez)…"
uv run --project "$CARPETA" --frozen --no-dev python -c "
import sys; sys.path.insert(0, '$CARPETA')
from mrb_imagenes.pasos.fondo import elegir_modelo, memoria_gb, preparar_modelo
print(f'Memoria de esta Mac: {memoria_gb():.0f} GB. Modelo: {elegir_modelo()}.')
preparar_modelo()
"
echo "Listo. Ahora cargá la clave de Claude con ./configurar.sh"
