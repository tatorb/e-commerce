"""Paso 7. Recorte.

Con la silueta del paso anterior, centra la pieza en un cuadrado con el mismo
margen de cada lado. Si es un kit, incluye todas las piezas. Solo copia
píxeles, sin agrandar ni achicar. Si la pieza está muy pegada al borde y no
alcanza la foto para dejar el margen, se agrega lienzo vacío: transparente,
nunca contenido.

Si la pieza no sale entera porque la foto la corta, el lado cortado queda sin
margen: la pieza llega hasta el borde del cuadrado, como en la foto. Si no, el
corte quedaría flotando en el medio del fondo.
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


# La pieza toca el borde de la foto si queda a esto o menos: el borde de la
# silueta no siempre cae justo en el primer píxel.
TOCA_BORDE_PX = 2
TOCA_BORDE_PCT = 0.4


def lados_cortados(caja: tuple[int, int, int, int], ancho: int, alto: int) -> dict[str, bool]:
    """Los lados en que la foto corta la pieza: la silueta llega al borde."""
    x0, y0, x1, y1 = caja
    tx = max(TOCA_BORDE_PX, round(ancho * TOCA_BORDE_PCT / 100))
    ty = max(TOCA_BORDE_PX, round(alto * TOCA_BORDE_PCT / 100))
    return {"izquierda": x0 <= tx, "arriba": y0 <= ty, "derecha": ancho - x1 <= tx, "abajo": alto - y1 <= ty}


def encuadre(
    caja: tuple[int, int, int, int], margen_pct: float, foto: tuple[int, int] | None = None
) -> tuple[int, int, int]:
    """El lado del cuadrado y dónde empieza, en coordenadas de la foto.

    Con el tamaño de la foto (ancho, alto), los lados en que la foto corta la
    pieza van sin margen: el cuadrado empieza o termina justo en ese borde.
    """
    x0, y0, x1, y1 = caja
    corta = lados_cortados(caja, *foto) if foto else dict.fromkeys(("izquierda", "arriba", "derecha", "abajo"), False)
    if foto:
        # Lo que queda entre la pieza y el borde cortado también es foto: el cuadrado arranca en el borde.
        if corta["izquierda"]:
            x0 = 0
        if corta["arriba"]:
            y0 = 0
        if corta["derecha"]:
            x1 = foto[0]
        if corta["abajo"]:
            y1 = foto[1]
    ancho, alto = x1 - x0, y1 - y0
    p = margen_pct / 100.0
    con_margen_h = (not corta["izquierda"]) + (not corta["derecha"])
    con_margen_v = (not corta["arriba"]) + (not corta["abajo"])
    lado = math.ceil(max(ancho / (1 - con_margen_h * p), alto / (1 - con_margen_v * p)))

    def inicio(a0: int, a1: int, corta_inicio: bool, corta_fin: bool) -> int:
        if corta_inicio and not corta_fin:
            return a0
        if corta_fin and not corta_inicio:
            return a1 - lado
        return int(round((a0 + a1) / 2 - lado / 2))

    return lado, inicio(x0, x1, corta["izquierda"], corta["derecha"]), inicio(y0, y1, corta["arriba"], corta["abajo"])


class Recorte(Paso):
    clave = "recorte"
    nombre = "Recorte"
    consigna = (
        "La pieza se centra en un cuadrado con el mismo margen de cada lado. Mirá la foto y proponé el margen, en % del "
        "lado del cuadrado: suele ir entre 5 y 12. Más margen si la pieza es alargada o tiene partes finas que no tienen "
        "que quedar pegadas al borde. Si la foto corta la pieza, ese lado va solo sin margen: la pieza llega hasta el "
        "borde, como en la foto. El margen que proponés es el de los lados en que la pieza sale entera."
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
            # Los lados en que la foto corta la pieza: van sin margen.
            "cortada_por_la_foto": [k for k, v in lados_cortados(caja, foto.ancho, foto.alto).items() if v],
        }
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes), extra={"caja": caja})

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if medicion.no_aplica:
            return Resultado(foto=foto, valores={}, nota=medicion.no_aplica, salteado=True)
        assert foto.alfa is not None
        lado, x0, y0 = encuadre(medicion.extra["caja"], valores["margen"], (foto.ancho, foto.alto))
        cortados = [k for k, v in lados_cortados(medicion.extra["caja"], foto.ancho, foto.alto).items() if v]
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
        if cortados:
            notas.append(f"La foto corta la pieza ({', '.join(cortados)}): ese lado va sin margen, hasta el borde.")
        if lienzo:
            notas.append("La pieza estaba cerca del borde: se agregó lienzo vacío para dejar el margen parejo.")
        if lado < LADO_MINIMO_RECOMENDADO:
            notas.append(
                f"La foto final queda de {lado} px de lado, menos de los {LADO_MINIMO_RECOMENDADO} que pide Mercado Libre "
                "para el zoom. No se agranda, porque eso inventaría píxeles."
            )
        # Dónde quedó la foto real dentro del cuadrado: el paso Sombra mide ahí la sombra que tenía.
        datos = {**foto.datos, "zona_de_foto": [dx0, dy0, dx0 + (sx1 - sx0), dy0 + (sy1 - sy0)]}
        return Resultado(
            foto=Foto(rgb=rgb, alfa=alfa, datos=datos),
            valores=valores,
            medidas={"lado_px": lado, "lienzo_agregado": lienzo, "sin_margen": cortados},
            nota=" ".join(notas) or None,
        )
