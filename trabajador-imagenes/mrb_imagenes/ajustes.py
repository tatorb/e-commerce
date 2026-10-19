"""Los valores por defecto de la línea y los topes de cada ajuste.

Son los mismos que después se editan en la app, en Ajustes, Imágenes. Ningún
valor, ni el que propone Claude ni el que escribe una persona, pasa su tope.
"""

from __future__ import annotations

import re
from copy import deepcopy

AJUSTES_DEFECTO: dict = {
    # Margen alrededor de la pieza, en % del lado del cuadrado final, de cada lado.
    "margen": 8,
    # Color de fondo del JPG final.
    "fondo": "#FFFFFF",
    "calidad_jpg": 95,
    # Topes: lo máximo que se puede corregir en cada ajuste.
    "topes": {
        "giro": 10,  # grados
        "perspectiva": 15,  # %
        "blancos": 100,  # % de la corrección medida
        "temperatura": 30,  # ajuste fino de tono y tinte
        "exposicion": 1.0,  # pasos de luz
        "sombras": 60,
        "luces": 60,
        "claridad": 40,
        "saturacion": 30,  # %
        "vivacidad": 30,
    },
}

_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def leer_ajustes(datos: dict | None = None) -> dict:
    """Junta lo que llega con los valores por defecto. Lo que no es válido se ignora."""
    salida = deepcopy(AJUSTES_DEFECTO)
    if not datos:
        return salida
    if isinstance(datos.get("margen"), (int, float)) and 0 <= datos["margen"] <= 30:
        salida["margen"] = float(datos["margen"])
    if isinstance(datos.get("fondo"), str) and _COLOR.match(datos["fondo"]):
        salida["fondo"] = datos["fondo"].upper()
    if isinstance(datos.get("calidad_jpg"), (int, float)) and 80 <= datos["calidad_jpg"] <= 100:
        salida["calidad_jpg"] = int(datos["calidad_jpg"])
    for clave, valor in (datos.get("topes") or {}).items():
        if clave in salida["topes"] and isinstance(valor, (int, float)) and valor >= 0:
            # Un tope nunca puede superar el máximo técnico del paso.
            salida["topes"][clave] = min(float(valor), float(AJUSTES_DEFECTO["topes"][clave]) * 2)
    return salida


def color_fondo(ajustes: dict) -> tuple[float, float, float]:
    h = ajustes["fondo"].lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]
