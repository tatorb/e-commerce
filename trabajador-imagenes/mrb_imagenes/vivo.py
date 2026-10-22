"""El paquete para editar la foto en vivo en la app.

Con él, la app muestra al instante cómo quedaría la foto con otros valores de
lente, perspectiva, blancos, luces y color, sin esperar a la Mac. Lleva la foto
preparada antes de los ajustes, en tamaño de pantalla, y la silueta del fondo.
La lente no se puede calcular en el navegador: la Mac arma de antemano una
copia chica por cada combinación de correcciones, solo si la foto trae datos de
lente. Lo que se ve en la app es una vista previa: la foto final la hace
siempre la Mac.

Todo va en un solo archivo: la marca MRBVIVO1, el largo del encabezado (4
bytes), el encabezado en JSON y después las imágenes, una tras otra. La app lo
lee en src/domain/photo-live.ts.
"""

from __future__ import annotations

import itertools
import json
import struct

import cv2
import numpy as np

from .imagen import Foto, a_jpeg, achicar
from .pasos.base import Paso
from .pasos.luces import LADO_DE_MEDIDA

MARCA = b"MRBVIVO1"
VERSION = 1
# El lado más largo de la foto en la app: el mismo en que la Mac mide la
# claridad, así la claridad en vivo da igual que en la Mac.
LADO = LADO_DE_MEDIDA
CALIDAD = 90


class _Imagenes:
    def __init__(self) -> None:
        self.lista: list[dict] = []
        self.contenidos: list[bytes] = []
        self._inicio = 0

    def sumar(self, contenido: bytes, tipo: str, ancho: int, alto: int) -> int:
        self.lista.append({"tipo": tipo, "inicio": self._inicio, "largo": len(contenido), "ancho": ancho, "alto": alto})
        self.contenidos.append(contenido)
        self._inicio += len(contenido)
        return len(self.lista) - 1


def _png_gris(m: np.ndarray) -> bytes:
    ok, datos = cv2.imencode(".png", np.round(np.clip(m, 0, 1) * 255).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 6])
    if not ok:
        raise OSError("No se pudo armar la silueta para editar en vivo.")
    return datos.tobytes()


def _variantes_de_lente(chica: Foto, lente: Paso, ajustes: dict, base: int, imagenes: _Imagenes) -> list[dict] | None:
    """Una copia por cada combinación de correcciones. Las que no cambian nada usan la base."""
    medicion = lente.medir(chica, ajustes)
    if medicion.no_aplica:
        return None
    variantes = []
    for distorsion, aberracion, vineta in itertools.product((0, 1), repeat=3):
        valores = {"distorsion": distorsion, "aberracion": aberracion, "vineta": vineta}
        indice = base
        if distorsion or aberracion or vineta:
            r = lente.aplicar(chica, {k: float(v) for k, v in valores.items()}, ajustes, medicion)
            if not r.salteado and r.foto is not chica:
                indice = imagenes.sumar(a_jpeg(r.foto.rgb, CALIDAD), "image/jpeg", r.foto.ancho, r.foto.alto)
        variantes.append({**valores, "imagen": indice})
    return variantes


def armar_paquete(entrada: Foto, lente: Paso | None, ajustes: dict, mascara: np.ndarray | None) -> bytes:
    """El paquete de una foto: la base, las copias de lente y la silueta que usó el paso Quitar fondo."""
    chica = achicar(entrada, LADO)
    imagenes = _Imagenes()
    base = imagenes.sumar(a_jpeg(chica.rgb, CALIDAD), "image/jpeg", chica.ancho, chica.alto)
    variantes = _variantes_de_lente(chica, lente, ajustes, base, imagenes) if lente is not None else None
    silueta = None
    if mascara is not None:
        alto, ancho = mascara.shape
        escala = chica.ancho / entrada.ancho
        tam = (max(1, round(ancho * escala)), max(1, round(alto * escala)))
        chica_mascara = cv2.resize(mascara.astype(np.float32), tam, interpolation=cv2.INTER_AREA)
        silueta = {
            "imagen": imagenes.sumar(_png_gris(chica_mascara), "image/png", tam[0], tam[1]),
            # El tamaño de la foto cuando se quitó el fondo, ya con lente y perspectiva.
            "ancho_completo": ancho,
            "alto_completo": alto,
        }
    encabezado = {
        "version": VERSION,
        "original": {"ancho": entrada.ancho, "alto": entrada.alto},
        "base": base,
        "lente": variantes,
        "silueta": silueta,
        "imagenes": imagenes.lista,
    }
    cuerpo = json.dumps(encabezado, ensure_ascii=False).encode("utf-8")
    return MARCA + struct.pack("<I", len(cuerpo)) + cuerpo + b"".join(imagenes.contenidos)


def leer_paquete(datos: bytes) -> tuple[dict, list[bytes]]:
    """Lo contrario de armar_paquete, para las pruebas."""
    if not datos.startswith(MARCA):
        raise ValueError("No es un paquete para editar en vivo.")
    (largo,) = struct.unpack("<I", datos[len(MARCA) : len(MARCA) + 4])
    inicio = len(MARCA) + 4
    encabezado = json.loads(datos[inicio : inicio + largo].decode("utf-8"))
    cuerpo = datos[inicio + largo :]
    return encabezado, [cuerpo[i["inicio"] : i["inicio"] + i["largo"]] for i in encabezado["imagenes"]]
