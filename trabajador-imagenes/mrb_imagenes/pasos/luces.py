"""Paso 4. Luces, sombras y claridad.

Curvas suaves que abren las sombras y recuperan las luces, más un realce
moderado del contraste local, que hace que se lean los detalles de la pieza.
Solo cambia el brillo de los píxeles que ya están: el color de cada uno se
mantiene.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..imagen import Foto, a_lineal, a_srgb, luminancia
from .base import Medicion, Parametro, Paso, Resultado, sin_cambios


def curva(l: np.ndarray, sombras: float, luces: float) -> np.ndarray:
    """Abre las sombras y baja las luces sin dar vuelta el orden de los tonos."""
    s, h = sombras / 100.0, luces / 100.0
    l = l + s * 2.5 * l * (1 - l) ** 4
    l = l - h * 2.5 * l**4 * (1 - l)
    return np.clip(l, 0, 1)


def contraste_local(l: np.ndarray, claridad: float) -> np.ndarray:
    if claridad <= 0:
        return l
    alto, ancho = l.shape
    celdas = max(4, min(16, round(max(alto, ancho) / 400)))
    clahe = cv2.createCLAHE(clipLimit=1.0 + claridad / 10.0, tileGridSize=(celdas, celdas))
    l16 = np.round(np.clip(l, 0, 1) * 65535).astype(np.uint16)
    realzado = clahe.apply(l16).astype(np.float32) / 65535.0
    # Moderado: se mezcla con el original.
    return np.clip(l + (claridad / 100.0) * 1.5 * (realzado - l), 0, 1)


class Luces(Paso):
    clave = "luces"
    nombre = "Luces, sombras y claridad"
    consigna = (
        "Buscá que la pieza se vea bien expuesta y con detalle: sin sombras empastadas ni luces quemadas. El código midió "
        "el brillo de la foto. Proponé exposición (en pasos de luz), cuánto abrir las sombras, cuánto recuperar las luces "
        "y una claridad moderada. Una foto de producto tiene que verse natural, no dramática."
    )
    parametros = (
        Parametro("exposicion", "Exposición", "Aclara u oscurece toda la foto, en pasos de luz.", -2, 2, 0, 0.05, " EV", tope="exposicion", simetrico=True),
        Parametro("sombras", "Sombras", "Abre las zonas oscuras.", 0, 100, 0, 1, tope="sombras"),
        Parametro("luces", "Luces", "Recupera detalle en las zonas claras.", 0, 100, 0, 1, tope="luces"),
        Parametro("claridad", "Claridad", "Realza el contraste local, el detalle de la pieza.", 0, 100, 15, 1, tope="claridad"),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        paso = max(1, int(min(foto.alto, foto.ancho) / 800))
        lum = a_srgb(luminancia(a_lineal(foto.rgb[::paso, ::paso])))
        p = np.percentile(lum, [1, 5, 50, 95, 99])
        medidas = {
            "brillo_p1": round(float(p[0]), 3),
            "brillo_p5": round(float(p[1]), 3),
            "brillo_mediana": round(float(p[2]), 3),
            "brillo_p95": round(float(p[3]), 3),
            "brillo_p99": round(float(p[4]), 3),
            "quemados_pct": round(float((lum >= 0.995).mean()) * 100, 2),
            "negros_pct": round(float((lum <= 0.01).mean()) * 100, 2),
        }
        sugeridos = self.defectos(ajustes)
        if p[1] < 0.08:
            sugeridos["sombras"] = min(25.0, ajustes["topes"]["sombras"])
        if medidas["quemados_pct"] < 1 and p[4] > 0.97:
            sugeridos["luces"] = min(20.0, ajustes["topes"]["luces"])
        return Medicion(medidas=medidas, sugeridos=sugeridos)

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if sin_cambios(valores, ("exposicion", "sombras", "luces", "claridad"), 1e-4):
            return Resultado(foto=foto, valores=valores, nota="Sin cambios de luz: la foto queda igual.")
        lineal = a_lineal(foto.rgb) * np.float32(2.0 ** valores["exposicion"])
        y = luminancia(lineal)
        l = a_srgb(y)
        l2 = contraste_local(curva(l, valores["sombras"], valores["luces"]), valores["claridad"])
        y2 = a_lineal(l2)
        # Mismo color, otro brillo: cada píxel se multiplica por la misma cantidad en sus tres canales.
        factor = np.where(y > 1e-6, y2 / np.maximum(y, 1e-6), 0.0).astype(np.float32)
        nuevo = lineal * factor[..., None]
        return Resultado(foto=Foto(rgb=a_srgb(nuevo), alfa=foto.alfa, datos=foto.datos), valores=valores)
