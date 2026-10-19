"""Dónde vive el trabajador en la Mac y con qué se conecta.

La dirección de la app va en un archivo de configuración. Las dos claves, la
llave de la app y la clave de Claude, van en el Llavero de macOS y nunca en
un archivo.
"""

from __future__ import annotations

import json
import os
import platform
from pathlib import Path

from .inspector import SERVICIO_LLAVERO

APP_POR_DEFECTO = "https://e-commerce.studiomrb.com"


def carpeta_de_datos() -> Path:
    """La misma carpeta que arma entorno.sh."""
    if os.environ.get("MRB_DATOS"):
        return Path(os.environ["MRB_DATOS"])
    if platform.system() == "Darwin":
        return Path.home() / "Library" / "Application Support" / "MRB Imagenes"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "mrb-imagenes"


def carpeta_de_registros() -> Path:
    if platform.system() == "Darwin":
        return Path.home() / "Library" / "Logs" / "MRB Imagenes"
    return carpeta_de_datos() / "registros"


def _archivo() -> Path:
    return carpeta_de_datos() / "config.json"


def leer_direccion() -> str:
    if os.environ.get("MRB_APP_URL"):
        return os.environ["MRB_APP_URL"].rstrip("/")
    try:
        return str(json.loads(_archivo().read_text()).get("app") or APP_POR_DEFECTO).rstrip("/")
    except (OSError, ValueError):
        return APP_POR_DEFECTO


def guardar_direccion(direccion: str) -> None:
    _archivo().parent.mkdir(parents=True, exist_ok=True)
    _archivo().write_text(json.dumps({"app": direccion.rstrip("/")}, ensure_ascii=False, indent=2))


def leer_llave_app() -> str | None:
    if os.environ.get("MRB_LLAVE_APP"):
        return os.environ["MRB_LLAVE_APP"]
    try:
        import keyring

        return keyring.get_password(SERVICIO_LLAVERO, "app")
    except Exception:
        return None


def guardar_llave_app(llave: str) -> None:
    import keyring

    keyring.set_password(SERVICIO_LLAVERO, "app", llave)
