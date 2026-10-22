"""Los 9 pasos de la línea, en orden."""

from __future__ import annotations

from .base import Medicion, Parametro, Paso, Resultado
from .blancos import Blancos
from .color import Color
from .exportar import Exportar
from .fondo import Fondo, Segmentador, segmentador_rembg
from .lente import Lente
from .luces import Luces
from .perspectiva import Perspectiva
from .recorte import Recorte
from .sombra import Sombra


def armar_pasos(segmentador: Segmentador | None = None, modelo_fondo: str | None = None) -> list[Paso]:
    fondo = Fondo(segmentador or segmentador_rembg(modelo_fondo))
    return [Lente(), Perspectiva(), Blancos(), Luces(), Color(), fondo, Recorte(), Sombra(), Exportar()]


CLAVES = [p.clave for p in armar_pasos(lambda rgb: rgb[..., 0])]

__all__ = ["CLAVES", "Medicion", "Parametro", "Paso", "Resultado", "armar_pasos"]
