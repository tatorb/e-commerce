"""Herramientas para los pasos que mueven la foto: lente y perspectiva.

Al corregir la lente o enderezar, quedan zonas sin foto en los bordes. Nunca
se rellenan: se recorta hacia adentro hasta que todo es foto real.
"""

from __future__ import annotations

import cv2
import numpy as np

# Un píxel cuenta como foto real si al menos este porcentaje viene de la foto.
VALIDO = 0.999


# El filtro de interpolación mira hasta 4 píxeles para cada lado.
_RADIO = 4


def deformar(rgb: np.ndarray, mapa_x: np.ndarray, mapa_y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Lleva la foto a la nueva forma. Devuelve la foto y qué píxeles son foto real.

    Cada píxel nuevo sale de sus vecinos reales, con interpolación Lanczos, que
    conserva la nitidez. Para que no aparezcan halos, ningún píxel queda más
    claro ni más oscuro que sus vecinos reales.
    """
    nucleo = np.ones((3, 3), np.uint8)
    borde = {"borderMode": cv2.BORDER_CONSTANT, "borderValue": 0}
    salida = cv2.remap(rgb, mapa_x, mapa_y, cv2.INTER_LANCZOS4, **borde)
    piso = cv2.remap(cv2.erode(rgb, nucleo), mapa_x, mapa_y, cv2.INTER_NEAREST, **borde)
    techo = cv2.remap(cv2.dilate(rgb, nucleo), mapa_x, mapa_y, cv2.INTER_NEAREST, **borde)
    salida = np.minimum(np.maximum(salida, piso), techo)
    unos = np.ones(rgb.shape[:2], dtype=np.float32)
    cubierto = cv2.remap(unos, mapa_x, mapa_y, cv2.INTER_LINEAR, **borde) >= VALIDO
    # Cerca del borde, el filtro tomaría algo de afuera: esos píxeles tampoco cuentan.
    lado = 2 * _RADIO + 1
    valido = cv2.erode(cubierto.astype(np.uint8), np.ones((lado, lado), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0) > 0
    return np.clip(salida, 0, 1), valido


def recorte_valido(valido: np.ndarray) -> tuple[int, int, int, int] | None:
    """El rectángulo centrado más grande, con la misma proporción, donde todo es foto real.

    Devuelve (x0, y0, x1, y1), o None si no queda ninguno.
    """
    alto, ancho = valido.shape
    # Suma acumulada de los píxeles sin foto, para revisar cada rectángulo de una vez.
    malos = np.pad((~valido).astype(np.int64), ((1, 0), (1, 0))).cumsum(0).cumsum(1)

    def caja(escala: float) -> tuple[int, int, int, int]:
        w = max(1, int(np.floor(ancho * escala)))
        h = max(1, int(np.floor(alto * escala)))
        x0 = (ancho - w) // 2
        y0 = (alto - h) // 2
        return x0, y0, x0 + w, y0 + h

    def limpio(c: tuple[int, int, int, int]) -> bool:
        x0, y0, x1, y1 = c
        return malos[y1, x1] - malos[y0, x1] - malos[y1, x0] + malos[y0, x0] == 0

    if limpio(caja(1.0)):
        return caja(1.0)
    bajo, alto_e = 0.0, 1.0
    for _ in range(40):
        medio = (bajo + alto_e) / 2
        if limpio(caja(medio)):
            bajo = medio
        else:
            alto_e = medio
    if bajo <= 0.0:
        return None
    return caja(bajo)
