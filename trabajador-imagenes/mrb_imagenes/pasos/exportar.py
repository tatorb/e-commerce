"""Paso 8. Exportar.

Dos archivos, sin bajar la resolución: un PNG con fondo transparente y un JPG
con fondo blanco puro (o el color de Ajustes). Los dos con el perfil sRGB y
sin los datos de la cámara, así no viaja la ubicación GPS.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

from ..ajustes import color_fondo
from ..imagen import Foto, a_jpeg, perfil_srgb
from .base import Medicion, Parametro, Paso, Resultado

# El peso máximo por foto que acepta Mercado Libre.
PESO_MAXIMO_ML = 10 * 1024 * 1024


def sobre_fondo(foto: Foto, fondo: tuple[float, float, float]) -> np.ndarray:
    if foto.alfa is None:
        return foto.rgb
    a = foto.alfa[..., None]
    return foto.rgb * a + np.array(fondo, dtype=np.float32) * (1 - a)


def png_transparente(foto: Foto) -> bytes:
    rgb = np.round(np.clip(foto.rgb, 0, 1) * 255).astype(np.uint8)
    alfa = np.full(rgb.shape[:2], 255, np.uint8) if foto.alfa is None else np.round(np.clip(foto.alfa, 0, 1) * 255).astype(np.uint8)
    salida = io.BytesIO()
    Image.fromarray(np.dstack([rgb, alfa]), "RGBA").save(salida, "PNG", icc_profile=perfil_srgb(), optimize=False, compress_level=6)
    return salida.getvalue()


class Exportar(Paso):
    clave = "exportar"
    nombre = "Exportar"
    consigna = (
        "Es la foto final sobre el fondo del JPG. Revisá que esté lista para publicar: pieza completa y centrada, bordes "
        "limpios, sin halos ni restos del fondo. Si ves un problema, nombralo en la razón para que la persona rehaga el "
        "paso que corresponde. Proponé la calidad del JPG."
    )
    parametros = (Parametro("calidad", "Calidad del JPG", "Calidad de compresión del JPG final.", 80, 100, 95, 1),)

    def defectos(self, ajustes: dict) -> dict[str, float]:
        return {"calidad": float(ajustes.get("calidad_jpg", 95))}

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        medidas = {"lado_px": [foto.ancho, foto.alto], "transparente": foto.alfa is not None, "fondo_jpg": ajustes["fondo"]}
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes))

    def vista_para_claude(self, foto: Foto, medicion: Medicion) -> Foto:
        return Foto(rgb=sobre_fondo(foto, color_fondo({"fondo": medicion.medidas["fondo_jpg"]})), datos=foto.datos)

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        png = png_transparente(foto)
        jpg = a_jpeg(sobre_fondo(foto, color_fondo(ajustes)), int(valores["calidad"]), icc=perfil_srgb())
        nota = None
        if len(jpg) > PESO_MAXIMO_ML:
            nota = f"El JPG pesa {len(jpg) / 1024 / 1024:.1f} MB, más que los 10 MB que acepta Mercado Libre. Probá con menos calidad."
        return Resultado(
            foto=foto,
            valores=valores,
            medidas={"png_kb": round(len(png) / 1024), "jpg_kb": round(len(jpg) / 1024)},
            nota=nota,
            archivos={"final.png": png, "final.jpg": jpg},
        )
