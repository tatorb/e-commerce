"""Paso 3. Balance de blancos y tinte.

Mide el color del fondo en una franja alrededor de la foto, donde casi siempre
hay fondo y no pieza, y calcula cuánto corregir para que quede gris neutro, sin
tono azul, amarillo, verde ni magenta. Solo cambia el color de los píxeles que
ya están, todos con la misma regla.
"""

from __future__ import annotations

import numpy as np

from ..imagen import Foto, a_lineal, a_srgb, luminancia
from .base import Medicion, Parametro, Paso, Resultado, sin_cambios

# Ancho de la franja de borde donde se mide el fondo, en proporción del lado.
FRANJA = 0.08
# Cuánto cambia el color cada unidad del ajuste fino de tono y tinte.
_K = 0.01


def muestra_de_fondo(rgb: np.ndarray) -> np.ndarray:
    """Los píxeles de la franja de borde que parecen fondo: ni muy oscuros, ni quemados, ni muy de color."""
    alto, ancho = rgb.shape[:2]
    f = max(2, int(min(alto, ancho) * FRANJA))
    paso = max(1, int(min(alto, ancho) / 600))
    bordes = [rgb[:f:paso, ::paso], rgb[-f::paso, ::paso], rgb[f:-f:paso, :f:paso], rgb[f:-f:paso, -f::paso]]
    m = np.concatenate([b.reshape(-1, 3) for b in bordes], axis=0)
    lineal = a_lineal(m)
    lum = luminancia(lineal)
    ok = (lum > 0.03) & (lum < 0.92)
    if ok.sum() < 50:
        return lineal
    lineal = lineal[ok]
    lum = lum[ok][:, None]
    color = np.abs(lineal / np.maximum(lum, 1e-6) - 1).sum(axis=1)
    return lineal[color <= np.percentile(color, 70)]


def ganancias(valores: dict[str, float], medidas_ganancia: list[float]) -> np.ndarray:
    """Cuánto multiplicar cada color (rojo, verde, azul) para la corrección pedida."""
    g = np.exp(np.log(np.array(medidas_ganancia, dtype=np.float64)) * valores["intensidad"] / 100.0)
    t, tinte = valores["temperatura"], valores["tinte"]
    g *= np.exp(np.array([_K * t, 0.0, -_K * t]))
    g *= np.exp(np.array([_K * tinte / 2, -_K * tinte, _K * tinte / 2]))
    # Mantener el brillo de un gris.
    return (g / (g @ np.array([0.2126, 0.7152, 0.0722]))).astype(np.float32)


class Blancos(Paso):
    clave = "blancos"
    nombre = "Balance de blancos y tinte"
    consigna = (
        "El fondo de una foto de producto tiene que verse gris neutro o blanco, sin tono. El código midió el color del "
        "fondo en el borde de la foto y calculó la corrección para neutralizarlo. Proponé la intensidad (100 aplica toda "
        "la corrección medida) y, si hace falta, un ajuste fino de tono (positivo más cálido) y de tinte (positivo más "
        "magenta, negativo más verde). Si el borde tiene reflejos de color de la propia pieza o del entorno, bajá la "
        "intensidad."
    )
    parametros = (
        Parametro("intensidad", "Intensidad", "Cuánto de la corrección medida se aplica.", 0, 100, 100, 1, " %", tope="blancos"),
        Parametro(
            "temperatura", "Tono", "Ajuste fino: positivo más cálido, negativo más frío.", -30, 30, 0, 1, tope="temperatura", simetrico=True
        ),
        Parametro(
            "tinte", "Tinte", "Ajuste fino: positivo más magenta, negativo más verde.", -30, 30, 0, 1, tope="temperatura", simetrico=True
        ),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        muestra = muestra_de_fondo(foto.rgb)
        mediana = np.median(muestra, axis=0)
        gris = float(mediana @ np.array([0.2126, 0.7152, 0.0722]))
        g = (gris / np.maximum(mediana, 1e-6)).clip(0.25, 4.0)
        fondo_srgb = a_srgb(mediana[None, :])[0]
        medidas = {
            "fondo_rgb": [int(round(v * 255)) for v in fondo_srgb],
            # Positivo: el fondo tira a cálido (amarillo). Negativo: a frío (azul).
            "tono_del_fondo": round(float(np.log(mediana[0] / max(mediana[2], 1e-6))) * 100, 1),
            # Positivo: el fondo tira a verde. Negativo: a magenta.
            "tinte_del_fondo": round(float(np.log(mediana[1] / max(np.sqrt(mediana[0] * mediana[2]), 1e-6))) * 100, 1),
            "ganancias": [round(float(v), 4) for v in g],
            "pixeles_medidos": int(len(muestra)),
        }
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes))

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if valores.get("intensidad", 0) <= 0 and sin_cambios(valores, ("temperatura", "tinte")):
            return Resultado(foto=foto, valores=valores, nota="Sin corrección de color: la foto queda igual.")
        g = ganancias(valores, medicion.medidas["ganancias"])
        lineal = a_lineal(foto.rgb) * g
        quemados = float((lineal > 1.0).any(axis=-1).mean())
        rgb = a_srgb(lineal)
        return Resultado(
            foto=Foto(rgb=rgb, alfa=foto.alfa, datos=foto.datos),
            valores=valores,
            medidas={"ganancias_aplicadas": [round(float(v), 4) for v in g], "pixeles_al_limite_pct": round(quemados * 100, 2)},
        )
