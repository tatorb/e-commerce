"""Arma los números de referencia para la edición en vivo de la app.

La app copia en src/domain/photo-live.ts las cuentas de los pasos de lente,
perspectiva, blancos, luces, color y recorte. Este script corre las cuentas de
la Mac sobre fotos chicas inventadas y guarda los resultados en
tests/fixtures/photo-live-reference.json, que la app compara con lo suyo. Si se
cambia una cuenta de la Mac, hay que volver a correrlo:

    python tests/armar_referencia_vivo.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
sys.path.insert(0, str(AQUI))

from conftest import foto_de_prueba  # noqa: E402

from mrb_imagenes.ajustes import leer_ajustes  # noqa: E402
from mrb_imagenes.geometria import deformar, recorte_valido  # noqa: E402
from mrb_imagenes.imagen import Foto  # noqa: E402
from mrb_imagenes.pasos.blancos import Blancos, ganancias  # noqa: E402
from mrb_imagenes.pasos.color import Color  # noqa: E402
from mrb_imagenes.pasos.luces import Luces, curva  # noqa: E402
from mrb_imagenes.pasos.perspectiva import homografia  # noqa: E402
from mrb_imagenes.pasos.recorte import caja_de_la_pieza, encuadre  # noqa: E402
from mrb_imagenes.pasos.sombra import dibujar_sombra  # noqa: E402

DESTINO = AQUI.parents[1] / "tests" / "fixtures" / "photo-live-reference.json"
AJUSTES = leer_ajustes()


def _plana(a: np.ndarray, decimales: int = 5) -> list[float]:
    return [round(float(v), decimales) for v in np.asarray(a, dtype=np.float64).ravel()]


def _foto() -> np.ndarray:
    """Una foto chica con fondo tibio, pieza gris, línea oscura y un parche muy saturado."""
    rgb = foto_de_prueba(30, 40).rgb.copy()
    rgb[4:10, 4:12] = [0.9, 0.15, 0.1]
    rgb[20:26, 28:36] = [0.2, 0.55, 0.85]
    # Redondeada, para que la app y la Mac partan exactamente de lo mismo.
    return np.round(rgb, 4).astype(np.float32)


def _caja_de_perspectiva(alto: int, ancho: int, valores: dict) -> tuple[list[float], list[int] | None]:
    h = homografia(alto, ancho, valores["giro"], valores["vertical"], valores["horizontal"])
    inversa = np.linalg.inv(h)
    yy, xx = np.mgrid[0:alto, 0:ancho].astype(np.float32)
    den = inversa[2, 0] * xx + inversa[2, 1] * yy + inversa[2, 2]
    mapa_x = ((inversa[0, 0] * xx + inversa[0, 1] * yy + inversa[0, 2]) / den).astype(np.float32)
    mapa_y = ((inversa[1, 0] * xx + inversa[1, 1] * yy + inversa[1, 2]) / den).astype(np.float32)
    _, valido = deformar(np.zeros((alto, ancho, 3), np.float32), mapa_x, mapa_y)
    caja = recorte_valido(valido)
    return _plana(h, 9), None if caja is None else [int(v) for v in caja]


def armar() -> dict:
    rgb = _foto()
    foto = Foto(rgb=rgb, datos={})
    salida: dict = {"ancho": 40, "alto": 30, "foto": _plana(rgb, 4)}

    blancos = Blancos()
    medicion = blancos.medir(foto, AJUSTES)
    valores_b = {"intensidad": 80.0, "temperatura": 6.0, "tinte": -4.0}
    salida["blancos"] = {
        "ganancias_medidas": medicion.medidas["ganancias"],
        "valores": valores_b,
        "ganancias": _plana(ganancias(valores_b, medicion.medidas["ganancias"]), 6),
        "resultado": _plana(blancos.aplicar(foto, valores_b, AJUSTES, medicion).foto.rgb),
    }

    luces = Luces()
    salida["luces"] = []
    for valores in ({"exposicion": 0.3, "sombras": 30.0, "luces": 20.0, "claridad": 0.0}, {"exposicion": -0.2, "sombras": 10.0, "luces": 40.0, "claridad": 30.0}):
        r = luces.aplicar(foto, valores, AJUSTES, luces.medir(foto, AJUSTES))
        salida["luces"].append({"valores": valores, "resultado": _plana(r.foto.rgb)})
    tonos = np.linspace(0, 1, 11, dtype=np.float32)
    salida["curva"] = {"tonos": _plana(tonos), "sombras": 60, "luces": 35, "resultado": _plana(curva(tonos, 60, 35), 6)}

    color = Color()
    salida["color"] = []
    for valores in ({"saturacion": 20.0, "vivacidad": 15.0}, {"saturacion": 50.0, "vivacidad": 50.0}):
        r = color.aplicar(foto, valores, AJUSTES, color.medir(foto, AJUSTES))
        salida["color"].append({"valores": valores, "resultado": _plana(r.foto.rgb)})

    # Los tres de corrido, como en la Mac: cada uno sobre lo que dejó el anterior.
    juntos = {"blancos": valores_b, "luces": {"exposicion": 0.5, "sombras": 25.0, "luces": 15.0, "claridad": 35.0}, "color": {"saturacion": 25.0, "vivacidad": 20.0}}
    f = blancos.aplicar(foto, juntos["blancos"], AJUSTES, medicion).foto
    f = luces.aplicar(f, juntos["luces"], AJUSTES, luces.medir(f, AJUSTES)).foto
    f = color.aplicar(f, juntos["color"], AJUSTES, color.medir(f, AJUSTES)).foto
    salida["juntos"] = {"valores": juntos, "resultado": _plana(f.rgb)}

    salida["perspectiva"] = []
    for valores in ({"giro": 3.0, "vertical": 4.0, "horizontal": -2.0}, {"giro": -8.0, "vertical": 0.0, "horizontal": 0.0}, {"giro": 0.0, "vertical": -12.0, "horizontal": 6.0}):
        matriz, caja = _caja_de_perspectiva(60, 80, valores)
        salida["perspectiva"].append({"ancho": 80, "alto": 60, "valores": valores, "matriz": matriz, "caja": caja})

    # La sombra: una pieza en L chica y una más grande que 512 px, que se dibuja achicada.
    chica = np.zeros((70, 90), np.float32)
    chica[15:45, 20:50] = 1.0
    chica[40:52, 20:75] = 0.8
    salida["sombra"] = []
    for valores in ({"intensidad": 30.0, "direccion": 25.0, "distancia": 18.0, "suavidad": 55.0}, {"intensidad": 20.0, "direccion": -120.0, "distancia": 8.0, "suavidad": 0.0}):
        salida["sombra"].append({"ancho": 90, "alto": 70, "alfa": _plana(chica, 2), "valores": valores, "resultado": _plana(dibujar_sombra(chica, valores))})
    yy, xx = np.mgrid[0:450, 0:600]
    grande = (((xx - 300) / 160) ** 2 + ((yy - 200) / 110) ** 2 <= 1).astype(np.float32)
    grande[300:340, 120:480] = 1.0
    valores = {"intensidad": 25.0, "direccion": 10.0, "distancia": 12.0, "suavidad": 70.0}
    salida["sombra_grande"] = {"valores": valores, "paso": 8, "resultado": _plana(dibujar_sombra(grande, valores)[::8, ::8])}

    alfa = np.zeros((40, 60), np.float32)
    alfa[10:22, 18:41] = 1.0
    alfa[30:33, 5:8] = 0.6
    caja = caja_de_la_pieza(alfa)
    lado, x0, y0 = encuadre(caja, 8.0)
    salida["recorte"] = {"ancho": 60, "alto": 40, "alfa": _plana(alfa, 2), "margen": 8.0, "caja": list(caja), "lado": lado, "x0": x0, "y0": y0}
    return salida


def texto() -> str:
    return json.dumps(armar(), ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(texto())
    print(f"Listo: {DESTINO}")
