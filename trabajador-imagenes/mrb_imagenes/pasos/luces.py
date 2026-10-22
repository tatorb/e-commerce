"""Paso 4. Luces, sombras y claridad.

Curvas suaves que abren las sombras y recuperan las luces, más un realce
moderado del contraste local, que hace que se lean los detalles de la pieza:
cada zona de la foto estira un poco sus propios tonos.
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


# El realce de detalle mide la foto en este tamaño. Así da lo mismo en la Mac,
# con la foto entera, y en la vista en vivo de la app, que usa una copia chica.
LADO_DE_MEDIDA = 1200
_NIVELES = 256
# Cuánto del realce se suma a la foto. Calibrado con una foto real para que la
# claridad se vea como se veía antes de medir en tamaño fijo.
_FUERZA = 0.4


def celdas_de(alto: int, ancho: int) -> int:
    """En cuántas celdas por lado se divide la foto: una cada 400 px, entre 4 y 16."""
    return max(4, min(16, round(max(alto, ancho) / 400)))


def _bordes(n: int, celdas: int) -> np.ndarray:
    return np.array([i * n // celdas for i in range(celdas + 1)])


def curvas_locales(l: np.ndarray, limite: float, celdas: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Una curva de tonos por celda, el histograma acumulado de la celda.

    Cada tono del histograma se recorta en `limite` veces lo que tendría si
    fueran todos parejos, y lo recortado se reparte entre todos: así el realce
    es moderado. Devuelve las curvas y el centro de cada celda, de 0 a 1.
    """
    alto, ancho = l.shape
    by, bx = _bordes(alto, celdas), _bordes(ancho, celdas)
    nivel = np.minimum((np.clip(l, 0, 1) * _NIVELES).astype(np.int64), _NIVELES - 1)
    curvas = np.zeros((celdas, celdas, _NIVELES + 1), np.float32)
    tope = limite / _NIVELES
    for ty in range(celdas):
        for tx in range(celdas):
            h = np.bincount(nivel[by[ty] : by[ty + 1], bx[tx] : bx[tx + 1]].ravel(), minlength=_NIVELES).astype(np.float64)
            h /= max(h.sum(), 1.0)
            exceso = np.maximum(h - tope, 0).sum()
            h = np.minimum(h, tope) + exceso / _NIVELES
            acumulado = np.concatenate([[0.0], np.cumsum(h)])
            curvas[ty, tx] = acumulado / acumulado[-1]
    return curvas, (by[:-1] + by[1:]) / 2 / alto, (bx[:-1] + bx[1:]) / 2 / ancho


def _vecinas(n: int, centros: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Para cada fila o columna: las dos celdas más cercanas y cuánto pesa la segunda."""
    p = (np.arange(n) + 0.5) / n
    ultima = len(centros) - 1
    i1 = np.clip(np.searchsorted(centros, p, "right") - 1, 0, ultima)
    i2 = np.minimum(i1 + 1, ultima)
    peso = np.where(i2 > i1, (p - centros[i1]) / np.maximum(centros[i2] - centros[i1], 1e-9), 0.0)
    return i1, i2, np.clip(peso, 0, 1).astype(np.float32)


def aplicar_curvas(l: np.ndarray, curvas: np.ndarray, cy: np.ndarray, cx: np.ndarray) -> np.ndarray:
    """Cada píxel pasa por las curvas de las cuatro celdas más cercanas, mezcladas según la distancia."""
    alto, ancho = l.shape
    celdas = curvas.shape[0]
    planas = curvas.reshape(-1)
    y1, y2, wy = _vecinas(alto, cy)
    x1, x2, wx = _vecinas(ancho, cx)
    salida = np.empty((alto, ancho), np.float32)
    # De a franjas, para no ocupar tanta memoria con fotos grandes.
    for r0 in range(0, alto, 256):
        r1 = min(alto, r0 + 256)
        pos = np.clip(l[r0:r1], 0, 1) * _NIVELES
        k = np.minimum(pos.astype(np.int64), _NIVELES - 1)
        f = (pos - k).astype(np.float32)

        def por(ty: np.ndarray, tx: np.ndarray) -> np.ndarray:
            i = (ty[:, None] * celdas + tx[None, :]) * (_NIVELES + 1) + k
            a = planas[i]
            return a + f * (planas[i + 1] - a)

        arriba = por(y1[r0:r1], x1) * (1 - wx) + por(y1[r0:r1], x2) * wx
        abajo = por(y2[r0:r1], x1) * (1 - wx) + por(y2[r0:r1], x2) * wx
        salida[r0:r1] = arriba * (1 - wy[r0:r1, None]) + abajo * wy[r0:r1, None]
    return salida


def contraste_local(l: np.ndarray, claridad: float) -> np.ndarray:
    if claridad <= 0:
        return l
    alto, ancho = l.shape
    escala = min(1.0, LADO_DE_MEDIDA / max(alto, ancho))
    chica = l
    if escala < 1.0:
        chica = cv2.resize(l, (max(1, round(ancho * escala)), max(1, round(alto * escala))), interpolation=cv2.INTER_AREA)
    curvas, cy, cx = curvas_locales(chica, 1.0 + claridad / 10.0, celdas_de(alto, ancho))
    realzado = aplicar_curvas(l, curvas, cy, cx)
    return np.clip(l + (claridad / 100.0) * _FUERZA * (realzado - l), 0, 1)


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
