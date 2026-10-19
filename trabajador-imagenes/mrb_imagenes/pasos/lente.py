"""Paso 1. Lente.

Con los datos de cámara y lente de la foto, busca el perfil del lente en la base
de lensfun y corrige su deformación, los bordes de color y la viñeta, que es el
oscurecimiento de las esquinas. Sin esos datos, o en fotos de teléfono, que ya
vienen corregidas por el propio teléfono, el paso se salta y lo avisa.
"""

from __future__ import annotations

import numpy as np

from ..geometria import deformar, recorte_valido
from ..imagen import Foto, a_lineal, a_srgb, es_de_telefono
from .base import Medicion, Parametro, Paso, Resultado

_BASE = None


def _base():
    global _BASE
    if _BASE is None:
        import lensfunpy

        _BASE = lensfunpy.Database()
    return _BASE


def buscar_perfil(camara: dict):
    """La cámara y el lente en la base de lensfun, o un motivo para no corregir."""
    marca, modelo, lente = camara.get("marca"), camara.get("modelo"), camara.get("lente")
    if not marca or not modelo or not lente or not camara.get("focal"):
        return None, None, "La foto no trae datos de cámara y lente, así que la lente no se puede corregir."
    if es_de_telefono(camara):
        return None, None, "Es una foto de teléfono: el teléfono ya corrige la lente."
    db = _base()
    camaras = db.find_cameras(marca, modelo, loose_search=True)
    if not camaras:
        return None, None, f"La cámara {marca} {modelo} no está en la base de lentes."
    cam = camaras[0]
    lentes = db.find_lenses(cam, camara.get("marca_lente"), lente, loose_search=True)
    if not lentes:
        return cam, None, f"El lente {lente} no está en la base de lentes."
    return cam, lentes[0], None


class Lente(Paso):
    clave = "lente"
    nombre = "Lente"
    consigna = (
        "Mirá si la foto muestra deformación de lente (líneas rectas curvadas cerca de los bordes), "
        "bordes de color en los contornos o esquinas más oscuras. Activá solo las correcciones que hagan falta."
    )
    cambia_encuadre = True
    parametros = (
        Parametro("distorsion", "Corregir deformación", "Endereza las líneas que el lente curva.", 0, 1, 1, tipo="si_no"),
        Parametro("aberracion", "Corregir bordes de color", "Quita los bordes de color en los contornos.", 0, 1, 1, tipo="si_no"),
        Parametro("vineta", "Corregir viñeta", "Aclara las esquinas oscurecidas por el lente.", 0, 1, 1, tipo="si_no"),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        camara = foto.datos.get("camara") or {}
        cam, lente, motivo = buscar_perfil(camara)
        medidas = {
            "camara": f"{camara.get('marca') or ''} {camara.get('modelo') or ''}".strip() or None,
            "lente": camara.get("lente"),
            "focal": camara.get("focal"),
            "apertura": camara.get("apertura"),
        }
        if motivo:
            return Medicion(medidas=medidas, sugeridos={}, no_aplica=motivo)
        medidas["perfil_encontrado"] = f"{cam.maker} {cam.model} · {lente.maker} {lente.model}"
        return Medicion(medidas=medidas, sugeridos=self.defectos(ajustes), extra={"camara": cam, "lente": lente})

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        import lensfunpy

        if medicion.no_aplica:
            return Resultado(foto=foto, valores={}, nota=medicion.no_aplica, salteado=True)
        cam, lente = medicion.extra["camara"], medicion.extra["lente"]
        camara = foto.datos.get("camara") or {}
        banderas = 0
        if valores.get("vineta"):
            banderas |= lensfunpy.ModifyFlags.VIGNETTING
        if valores.get("distorsion"):
            banderas |= lensfunpy.ModifyFlags.DISTORTION
        if valores.get("aberracion"):
            banderas |= lensfunpy.ModifyFlags.TCA
        if not banderas:
            return Resultado(foto=foto, valores=valores, nota="No se pidió ninguna corrección de lente.")

        alto, ancho = foto.alto, foto.ancho
        mod = lensfunpy.Modifier(lente, cam.crop_factor, ancho, alto)
        # Escala 1: sin agrandar la foto. Lo que queda sin foto se recorta después.
        mod.initialize(
            float(camara["focal"]),
            float(camara.get("apertura") or 8.0),
            1000.0,
            scale=1.0,
            pixel_format=np.float32,
            flags=banderas,
        )
        rgb = foto.rgb
        aplicadas: list[str] = []
        # La viñeta se corrige en luz lineal, como la midió el perfil.
        if valores.get("vineta"):
            lineal = np.ascontiguousarray(a_lineal(rgb))
            if mod.apply_color_modification(lineal):
                rgb = a_srgb(lineal)
                aplicadas.append("viñeta")
        valido = np.ones((alto, ancho), dtype=bool)
        if valores.get("distorsion") or valores.get("aberracion"):
            coords = mod.apply_subpixel_geometry_distortion()
            if coords is not None:
                canales = []
                for c in range(3):
                    canal, ok = deformar(
                        np.ascontiguousarray(rgb[..., c]),
                        np.ascontiguousarray(coords[:, :, c, 0]),
                        np.ascontiguousarray(coords[:, :, c, 1]),
                    )
                    canales.append(canal)
                    valido &= ok
                rgb = np.stack(canales, axis=-1)
                aplicadas += [n for n, k in (("deformación", "distorsion"), ("bordes de color", "aberracion")) if valores.get(k)]
        if not aplicadas:
            return Resultado(foto=foto, valores=valores, nota="El perfil del lente no trae datos para estas correcciones.", salteado=True)
        caja = recorte_valido(valido)
        if caja is None:
            return Resultado(foto=foto, valores=valores, nota="La corrección dejaba la foto sin zona útil: se salteó.", salteado=True)
        x0, y0, x1, y1 = caja
        recortada = np.ascontiguousarray(rgb[y0:y1, x0:x1])
        perdida = 1 - (x1 - x0) * (y1 - y0) / (ancho * alto)
        return Resultado(
            foto=Foto(rgb=recortada, datos=foto.datos),
            valores=valores,
            medidas={"recorte_bordes_pct": round(perdida * 100, 2), "corregido": aplicadas},
            nota=f"Se recortó {perdida * 100:.1f} % de borde para que no quede zona sin foto." if perdida > 0.001 else None,
        )
