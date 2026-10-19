#!/bin/bash
# Lo que corre macOS al iniciar sesión: el trabajador conectado a la app.
# No hace falta correrlo a mano: para prenderlo usá bash prender.sh.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
exec "$UV_PROJECT_ENVIRONMENT/bin/python" "$CARPETA/principal.py"
