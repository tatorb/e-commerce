"""Lo que mide el código en el video antes de corregirlo.

Mira unos cuadros repartidos a lo largo del video y busca el fondo: lo claro
y sin color. De ahí salen el balance de blancos y la luz que sugiere el
código, y un aviso si la cámara fue cambiando la luz sola mientras grababa.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .medios import Fuente, correr, programa

ANCHO_DE_MEDIR = 320
# Hasta dónde se lleva el fondo: claro, sin quemarlo.
FONDO_OBJETIVO = 0.90
# Cuánto se puede subir o bajar la luz, y cuánto se puede correr cada color.
LUZ_MAX = 1.30
LUZ_MIN = 0.85
COLOR_MAX = 1.15
# Si el fondo cambia más que esto entre cuadros, la cámara ajustó la luz sola.
CAMBIO_DE_LUZ = 0.035


@dataclass
class Medidas:
    fondo: tuple[float, float, float]
    fondo_por_cuadro: list[float]
    sugeridos: dict[str, float]
    avisos: list[str] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {
            "fondo": [round(v, 3) for v in self.fondo],
            "cambio_de_luz": round(float(np.ptp(self.fondo_por_cuadro)), 3) if self.fondo_por_cuadro else 0.0,
            "sugeridos": self.sugeridos,
            "avisos": self.avisos,
        }


def cuadros(fuente: Fuente, cantidad: int = 12) -> np.ndarray:
    """Cuadros repartidos en el video, achicados, con valores de 0 a 1."""
    alto = max(2, int(ANCHO_DE_MEDIR * fuente.alto / fuente.ancho) // 2 * 2)
    cada = fuente.duracion / cantidad
    res = correr(
        [
            programa("ffmpeg"), "-v", "error", "-i", str(fuente.ruta), "-map", "0:v:0", "-an",
            "-vf", f"fps=1/{cada:.4f},scale={ANCHO_DE_MEDIR}:{alto}", "-frames:v", str(cantidad),
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        ]
    )
    datos = np.frombuffer(res.stdout, dtype=np.uint8)
    n = datos.size // (alto * ANCHO_DE_MEDIR * 3)
    if n == 0:
        raise ValueError("No se pudo leer ningún cuadro del video.")
    return datos[: n * alto * ANCHO_DE_MEDIR * 3].reshape(n, alto, ANCHO_DE_MEDIR, 3).astype(np.float32) / 255.0


def fondo_de(cuadro: np.ndarray) -> np.ndarray | None:
    """El color del fondo de un cuadro: la mediana de lo claro y sin color. None si no hay."""
    brillo = cuadro.mean(axis=-1)
    color = cuadro.max(axis=-1) - cuadro.min(axis=-1)
    claro = (brillo >= np.percentile(brillo, 55)) & (color < 0.2)
    if claro.mean() < 0.05:
        return None
    return np.median(cuadro[claro], axis=0)


def medir(muestra: np.ndarray) -> Medidas:
    """De los cuadros a lo que sugiere el código. `muestra` es lo que devuelve `cuadros`."""
    fondos = [f for f in (fondo_de(c) for c in muestra) if f is not None]
    if not fondos:
        return Medidas(fondo=(0.0, 0.0, 0.0), fondo_por_cuadro=[], sugeridos={"rojo": 1.0, "verde": 1.0, "azul": 1.0}, avisos=["No se encontró un fondo claro: el color queda como está."])
    por_cuadro = [float(f.mean()) for f in fondos]
    fondo = np.median(np.stack(fondos), axis=0)
    gris = float(fondo.mean())
    # Balance de blancos: el fondo tiene que quedar sin color.
    balance = np.clip(gris / np.maximum(fondo, 1e-3), 1 / COLOR_MAX, COLOR_MAX)
    # Luz: llevar el fondo a su objetivo, sin quemar lo más claro del video.
    luz = float(np.clip(FONDO_OBJETIVO / max(gris, 1e-3), LUZ_MIN, LUZ_MAX))
    tope = float(np.percentile(muestra.max(axis=-1), 99.5))
    if tope * luz * float(balance.max()) > 1.0:
        luz = max(LUZ_MIN, 1.0 / (tope * float(balance.max())))
    ganancias = balance * luz
    avisos = []
    if np.ptp(por_cuadro) > CAMBIO_DE_LUZ:
        avisos.append("La cámara fue cambiando la luz sola durante la grabación. Conviene fijar la exposición y el balance de blancos antes de grabar.")
    return Medidas(
        fondo=(float(fondo[0]), float(fondo[1]), float(fondo[2])),
        fondo_por_cuadro=por_cuadro,
        sugeridos={"rojo": round(float(ganancias[0]), 4), "verde": round(float(ganancias[1]), 4), "azul": round(float(ganancias[2]), 4)},
        avisos=avisos,
    )
