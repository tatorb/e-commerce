"""Paso 5. Color.

Saturación moderada: aleja cada color del gris, sin cambiar su brillo. La
vivacidad hace lo mismo pero cuida los colores que ya están saturados.
"""

from __future__ import annotations

import numpy as np

from ..imagen import Foto, a_lineal, a_srgb, luminancia
from .base import Medicion, Parametro, Paso, Resultado, sin_cambios


def saturacion_de(rgb: np.ndarray) -> np.ndarray:
    maximo = rgb.max(axis=-1)
    minimo = rgb.min(axis=-1)
    return np.where(maximo > 1e-6, (maximo - minimo) / np.maximum(maximo, 1e-6), 0.0)


class Color(Paso):
    clave = "color"
    nombre = "Color"
    consigna = (
        "La pieza tiene que verse con su color real, ni lavada ni exagerada. El código midió la saturación de la foto. "
        "Proponé una saturación moderada y, si hace falta, vivacidad, que realza los colores apagados sin pasarse con los "
        "fuertes. En piezas de metal o grises, casi siempre poco o nada."
    )
    parametros = (
        Parametro("saturacion", "Saturación", "Más o menos color en toda la foto.", -50, 50, 0, 1, " %", tope="saturacion", simetrico=True),
        Parametro("vivacidad", "Vivacidad", "Realza los colores apagados, cuidando los fuertes.", 0, 50, 0, 1, tope="vivacidad"),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        paso = max(1, int(min(foto.alto, foto.ancho) / 800))
        s = saturacion_de(foto.rgb[::paso, ::paso])
        p = np.percentile(s, [50, 95])
        medidas = {
            "saturacion_mediana": round(float(p[0]), 3),
            "saturacion_p95": round(float(p[1]), 3),
            "muy_saturados_pct": round(float((s > 0.9).mean()) * 100, 2),
        }
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes))

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if sin_cambios(valores, ("saturacion", "vivacidad"), 1e-4):
            return Resultado(foto=foto, valores=valores, nota="Sin cambios de color: la foto queda igual.")
        lineal = a_lineal(foto.rgb)
        y = luminancia(lineal)[..., None]
        s_actual = saturacion_de(foto.rgb)[..., None]
        factor = 1.0 + valores["saturacion"] / 100.0 + (valores["vivacidad"] / 100.0) * (1.0 - s_actual)
        nuevo = y + (lineal - y) * factor.astype(np.float32)
        # Si un color se iría de rango, se lo acerca al gris en lugar de cortarlo.
        exceso = np.maximum(nuevo.max(axis=-1, keepdims=True) - 1.0, 0) + np.maximum(-nuevo.min(axis=-1, keepdims=True), 0)
        if (exceso > 0).any():
            nuevo = np.where(exceso > 0, y + (lineal - y) * np.minimum(factor, 1.0), nuevo)
        return Resultado(foto=Foto(rgb=a_srgb(nuevo), alfa=foto.alfa, datos=foto.datos), valores=valores)
