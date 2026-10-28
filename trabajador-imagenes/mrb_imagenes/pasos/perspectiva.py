"""Paso 2. Perspectiva y enderezado.

El código busca las líneas rectas de la foto (bordes de la mesa, de la caja de
luz, de la pieza) y mide cuánto están torcidas. Claude decide cuánto girar y
cuánto corregir la perspectiva. Las esquinas que quedan vacías no se rellenan:
se recorta hacia adentro.

Antes, si la persona lo pide, la foto se gira de a 90°: solo se reacomodan los
píxeles, sin perder nada ni recortar. Eso no lo propone Claude.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..geometria import deformar, recorte_valido
from ..imagen import Foto, achicar
from .base import Medicion, Parametro, Paso, Resultado, sin_cambios

# Una línea cuenta como horizontal o vertical si está a menos de esto.
_CERCA = 20.0


def _lineas(foto: Foto) -> list[tuple[float, float, float, float]]:
    chica = achicar(foto, 1200)
    gris = cv2.cvtColor((np.clip(chica.rgb, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    gris = cv2.GaussianBlur(gris, (5, 5), 0)
    bordes = cv2.Canny(gris, 50, 150)
    lado = min(gris.shape)
    hallado = cv2.HoughLinesP(bordes, 1, np.pi / 720, threshold=80, minLineLength=int(lado * 0.12), maxLineGap=int(lado * 0.01) + 2)
    if hallado is None:
        return []
    escala = foto.ancho / chica.ancho
    return [tuple(float(v) * escala for v in l) for l in np.asarray(hallado).reshape(-1, 4)]  # type: ignore[misc]


def _mediana_pesada(valores: np.ndarray, pesos: np.ndarray) -> float:
    orden = np.argsort(valores)
    v, p = valores[orden], pesos[orden]
    acumulado = np.cumsum(p)
    return float(v[np.searchsorted(acumulado, acumulado[-1] / 2)])


def medir_inclinacion(foto: Foto) -> dict:
    lineas = _lineas(foto)
    horizontales, verticales = [], []
    for x0, y0, x1, y1 in lineas:
        largo = float(np.hypot(x1 - x0, y1 - y0))
        angulo = float(np.degrees(np.arctan2(y1 - y0, x1 - x0)))
        # Llevar a -90..90.
        if angulo > 90:
            angulo -= 180
        if angulo <= -90:
            angulo += 180
        if abs(angulo) <= _CERCA:
            horizontales.append((angulo, largo, (y0 + y1) / 2 / foto.alto))
        elif abs(abs(angulo) - 90) <= _CERCA:
            desvio = angulo - 90 if angulo > 0 else angulo + 90
            verticales.append((desvio, largo, (x0 + x1) / 2 / foto.ancho))
    todos = [(a, l) for a, l, _ in horizontales] + [(a, l) for a, l, _ in verticales]
    medidas: dict = {"lineas_horizontales": len(horizontales), "lineas_verticales": len(verticales)}
    if todos:
        angulos = np.array([a for a, _ in todos])
        pesos = np.array([l for _, l in todos])
        # Girar la foto al revés de lo que está torcida.
        medidas["torcida_grados"] = round(_mediana_pesada(angulos, pesos), 2)
    if len(verticales) >= 2:
        izq = [(d, l) for d, l, x in verticales if x < 0.5]
        der = [(d, l) for d, l, x in verticales if x >= 0.5]
        if izq and der:
            pi = _mediana_pesada(np.array([d for d, _ in izq]), np.array([l for _, l in izq]))
            pd = _mediana_pesada(np.array([d for d, _ in der]), np.array([l for _, l in der]))
            # Positivo: las verticales se juntan arriba, como al fotografiar desde arriba.
            medidas["convergencia_vertical_grados"] = round(pi - pd, 2)
    return medidas


def homografia(alto: int, ancho: int, giro: float, vertical: float, horizontal: float) -> np.ndarray:
    """La transformación que gira y corrige la perspectiva, alrededor del centro."""
    cx, cy = ancho / 2, alto / 2
    # Perspectiva: el borde de arriba (o el izquierdo) se abre o se cierra.
    dv = vertical / 100 * ancho / 2
    dh = horizontal / 100 * alto / 2
    origen = np.float32([[dv, dh], [ancho - dv, -dh], [ancho + dv, alto + dh], [-dv, alto - dh]])
    destino = np.float32([[0, 0], [ancho, 0], [ancho, alto], [0, alto]])
    perspectiva = cv2.getPerspectiveTransform(origen, destino)
    rot = cv2.getRotationMatrix2D((cx, cy), -giro, 1.0)
    rot3 = np.vstack([rot, [0, 0, 1]])
    return rot3 @ perspectiva


class Perspectiva(Paso):
    clave = "perspectiva"
    nombre = "Perspectiva y enderezado"
    consigna = (
        "Mirá si la foto está torcida o con perspectiva: horizonte o bordes de la base inclinados, verticales que se "
        "juntan arriba o abajo. El código midió la inclinación de las líneas rectas. Proponé el giro (positivo gira en "
        "sentido horario) y la corrección vertical u horizontal solo si se nota. Si las líneas medidas son de la pieza "
        "y no del entorno, o la pieza está a propósito en ángulo, dejá 0."
    )
    cambia_encuadre = True
    parametros = (
        Parametro(
            "cuartos",
            "Girar 90°",
            "Cuartos de vuelta en sentido horario, antes del giro fino.",
            0,
            3,
            0,
            1,
            tipo="cuartos",
            persona=True,
        ),
        Parametro("giro", "Giro", "Gira la foto. Positivo, en sentido horario.", -45, 45, 0, 0.1, "°", tope="giro", simetrico=True),
        Parametro(
            "vertical",
            "Perspectiva vertical",
            "Positivo abre la parte de arriba, para verticales que se juntan arriba.",
            -30,
            30,
            0,
            0.5,
            " %",
            tope="perspectiva",
            simetrico=True,
        ),
        Parametro(
            "horizontal",
            "Perspectiva horizontal",
            "Positivo abre el lado izquierdo.",
            -30,
            30,
            0,
            0.5,
            " %",
            tope="perspectiva",
            simetrico=True,
        ),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        medidas = medir_inclinacion(foto)
        sugeridos = self.defectos(ajustes)
        torcida = medidas.get("torcida_grados")
        if torcida is not None and 0.2 <= abs(torcida) <= float(ajustes["topes"]["giro"]):
            sugeridos["giro"] = round(-torcida, 1)
        return Medicion(medidas=medidas, sugeridos=sugeridos)

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        cuartos = int(valores.get("cuartos", 0)) % 4
        girada = f"Se giró {cuartos * 90}° en sentido horario." if cuartos else None
        if cuartos:
            foto = girar_cuartos(foto, cuartos)
        if sin_cambios(valores, ("giro", "vertical", "horizontal"), 0.05):
            return Resultado(foto=foto, valores=valores, nota=girada or "Sin giro ni perspectiva: la foto queda igual.")
        alto, ancho = foto.alto, foto.ancho
        h = homografia(alto, ancho, valores["giro"], valores["vertical"], valores["horizontal"])
        inversa = np.linalg.inv(h)
        yy, xx = np.mgrid[0:alto, 0:ancho].astype(np.float32)
        den = inversa[2, 0] * xx + inversa[2, 1] * yy + inversa[2, 2]
        mapa_x = ((inversa[0, 0] * xx + inversa[0, 1] * yy + inversa[0, 2]) / den).astype(np.float32)
        mapa_y = ((inversa[1, 0] * xx + inversa[1, 1] * yy + inversa[1, 2]) / den).astype(np.float32)
        rgb, valido = deformar(foto.rgb, mapa_x, mapa_y)
        caja = recorte_valido(valido)
        if caja is None:
            if cuartos:
                return Resultado(foto=foto, valores=valores, nota=f"{girada} Con esos valores de giro y perspectiva no quedaba foto útil: no se aplicaron.")
            return Resultado(foto=foto, valores=valores, nota="Con esos valores no quedaba foto útil: se salteó.", salteado=True)
        x0, y0, x1, y1 = caja
        perdida = 1 - (x1 - x0) * (y1 - y0) / (ancho * alto)
        return Resultado(
            foto=Foto(rgb=np.ascontiguousarray(rgb[y0:y1, x0:x1]), datos=foto.datos),
            valores=valores,
            medidas={"recorte_bordes_pct": round(perdida * 100, 2)},
            nota=" ".join(n for n in [girada, f"Se recortó {perdida * 100:.1f} % de borde para que no quede zona sin foto."] if n),
        )


def girar_cuartos(foto: Foto, cuartos: int) -> Foto:
    """Gira de a 90° en sentido horario. Exacto: cada píxel cambia de lugar, sin mezclarse con otros."""
    rgb = np.ascontiguousarray(np.rot90(foto.rgb, k=-(cuartos % 4)))
    return Foto(rgb=rgb, datos=foto.datos)
