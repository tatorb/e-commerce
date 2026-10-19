"""Paso 7. Recorte.

Con la silueta del paso anterior, centra la pieza en un cuadrado con el mismo
margen de cada lado. Si es un kit, incluye todas las piezas. Solo copia
píxeles, sin agrandar ni achicar. Si la pieza está muy pegada al borde y no
alcanza la foto para dejar el margen, se agrega lienzo vacío: transparente,
nunca contenido.
"""

from __future__ import annotations

import math

import numpy as np

from ..imagen import Foto
from .base import Medicion, Parametro, Paso, Resultado

# Mercado Libre pide al menos este lado para el zoom.
LADO_MINIMO_RECOMENDADO = 1200


def caja_de_la_pieza(alfa: np.ndarray) -> tuple[int, int, int, int] | None:
    filas = np.where((alfa >= 0.5).any(axis=1))[0]
    columnas = np.where((alfa >= 0.5).any(axis=0))[0]
    if len(filas) == 0:
        return None
    return int(columnas[0]), int(filas[0]), int(columnas[-1]) + 1, int(filas[-1]) + 1


def encuadre(caja: tuple[int, int, int, int], margen_pct: float) -> tuple[int, int, int]:
    """El lado del cuadrado y dónde empieza, en coordenadas de la foto."""
    x0, y0, x1, y1 = caja
    ancho, alto = x1 - x0, y1 - y0
    lado = math.ceil(max(ancho, alto) / (1 - 2 * margen_pct / 100.0))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return lado, int(round(cx - lado / 2)), int(round(cy - lado / 2))


class Recorte(Paso):
    clave = "recorte"
    nombre = "Recorte"
    consigna = (
        "La pieza se centra en un cuadrado con el mismo margen de cada lado. Mirá la foto y proponé el margen, en % del "
        "lado del cuadrado: suele ir entre 5 y 12. Más margen si la pieza es alargada o tiene partes finas que no tienen "
        "que quedar pegadas al borde."
    )
    cambia_encuadre = True
    parametros = (Parametro("margen", "Margen", "Espacio alrededor de la pieza, de cada lado.", 2, 25, 8, 0.5, " %"),)

    def defectos(self, ajustes: dict) -> dict[str, float]:
        return {"margen": float(ajustes.get("margen", 8))}

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        if foto.alfa is None:
            return Medicion(medidas={}, sugeridos={}, no_aplica="La foto no tiene el fondo quitado: el recorte necesita la silueta.")
        caja = caja_de_la_pieza(foto.alfa)
        if caja is None:
            return Medicion(medidas={}, sugeridos={}, no_aplica="No hay ninguna pieza en la silueta.")
        x0, y0, x1, y1 = caja
        medidas = {
            "pieza_px": [x1 - x0, y1 - y0],
            "distancia_al_borde_px": {"izquierda": x0, "arriba": y0, "derecha": foto.ancho - x1, "abajo": foto.alto - y1},
        }
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes), extra={"caja": caja})

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if medicion.no_aplica:
            return Resultado(foto=foto, valores={}, nota=medicion.no_aplica, salteado=True)
        assert foto.alfa is not None
        lado, x0, y0 = encuadre(medicion.extra["caja"], valores["margen"])
        rgb = np.zeros((lado, lado, 3), dtype=np.float32)
        alfa = np.zeros((lado, lado), dtype=np.float32)
        # La parte del cuadrado que cae dentro de la foto se copia tal cual.
        sx0, sy0 = max(0, x0), max(0, y0)
        sx1, sy1 = min(foto.ancho, x0 + lado), min(foto.alto, y0 + lado)
        dx0, dy0 = sx0 - x0, sy0 - y0
        rgb[dy0 : dy0 + (sy1 - sy0), dx0 : dx0 + (sx1 - sx0)] = foto.rgb[sy0:sy1, sx0:sx1]
        alfa[dy0 : dy0 + (sy1 - sy0), dx0 : dx0 + (sx1 - sx0)] = foto.alfa[sy0:sy1, sx0:sx1]
        lienzo = x0 < 0 or y0 < 0 or x0 + lado > foto.ancho or y0 + lado > foto.alto
        notas = []
        if lienzo:
            notas.append("La pieza estaba cerca del borde: se agregó lienzo vacío para dejar el margen parejo.")
        if lado < LADO_MINIMO_RECOMENDADO:
            notas.append(
                f"La foto final queda de {lado} px de lado, menos de los {LADO_MINIMO_RECOMENDADO} que pide Mercado Libre "
                "para el zoom. No se agranda, porque eso inventaría píxeles."
            )
        return Resultado(
            foto=Foto(rgb=rgb, alfa=alfa, datos=foto.datos),
            valores=valores,
            medidas={"lado_px": lado, "lienzo_agregado": lienzo},
            nota=" ".join(notas) or None,
        )
