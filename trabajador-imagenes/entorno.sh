#!/bin/bash
# Dónde viven el Python del trabajador y el modelo del fondo. Lo usan los demás scripts.
# Quedan fuera del proyecto, así no viajan a GitHub ni a Vercel.
CARPETA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(uname)" = "Darwin" ]; then
  DATOS="$HOME/Library/Application Support/MRB Imagenes"
else
  DATOS="${XDG_DATA_HOME:-$HOME/.local/share}/mrb-imagenes"
fi
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$DATOS/venv}"
export U2NET_HOME="${U2NET_HOME:-$DATOS/modelos}"
export PATH="$HOME/.local/bin:$PATH"
