"""Lo que se sabe de un archivo de video, leído con ffprobe.

ffmpeg y ffprobe son los programas que hacen la edición. No vienen con
Python: se instalan una vez en la Mac con `brew install ffmpeg`.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

# La copia liviana que graba la cámara DJI al lado de cada video: el mismo
# video en 720p. Sirve para mirar y medir rápido; se exporta desde el original.
EXTENSIONES_LIVIANAS = (".LRF", ".lrf")


class FaltaFfmpeg(RuntimeError):
    def __init__(self) -> None:
        super().__init__("Falta ffmpeg, el programa que edita los videos. En la Mac se instala con: brew install ffmpeg")


class VideoIlegible(RuntimeError):
    pass


def programa(nombre: str) -> str:
    ruta = shutil.which(nombre)
    if not ruta:
        raise FaltaFfmpeg()
    return ruta


def correr(args: list[str], *, entrada: bytes | None = None) -> subprocess.CompletedProcess:
    """Corre ffmpeg o ffprobe y, si falla, cuenta el final de lo que dijo."""
    res = subprocess.run(args, input=entrada, capture_output=True)
    if res.returncode != 0:
        cola = res.stderr.decode("utf-8", "replace").strip().splitlines()[-6:]
        raise VideoIlegible("ffmpeg no pudo con el video: " + " | ".join(cola))
    return res


@dataclass(frozen=True)
class Fuente:
    """Un video como se ve: el ancho y el alto ya tienen en cuenta el giro que anotó la cámara."""

    ruta: Path
    ancho: int
    alto: int
    fps: float
    duracion: float
    codec: str
    bits: int
    tiene_audio: bool

    @property
    def vertical(self) -> bool:
        return self.alto > self.ancho


def _fraccion(texto: str) -> float:
    try:
        a, _, b = texto.partition("/")
        return float(a) / float(b or 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


def _giro(stream: dict) -> int:
    for dato in stream.get("side_data_list") or []:
        if "rotation" in dato:
            return int(round(float(dato["rotation"]))) % 360
    return int(float((stream.get("tags") or {}).get("rotate", 0))) % 360


def leer(ruta: Path | str) -> Fuente:
    ruta = Path(ruta)
    if not ruta.is_file():
        raise VideoIlegible(f"No está el archivo {ruta}.")
    res = correr([programa("ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", str(ruta)])
    datos = json.loads(res.stdout or b"{}")
    streams = datos.get("streams") or []
    # La cámara guarda además una miniatura como si fuera otro video: no cuenta.
    videos = [s for s in streams if s.get("codec_type") == "video" and not (s.get("disposition") or {}).get("attached_pic")]
    if not videos:
        raise VideoIlegible(f"{ruta.name} no tiene video.")
    v = videos[0]
    ancho, alto = int(v["width"]), int(v["height"])
    if _giro(v) in (90, 270):
        ancho, alto = alto, ancho
    duracion = float(v.get("duration") or (datos.get("format") or {}).get("duration") or 0)
    if duracion <= 0:
        raise VideoIlegible(f"No se pudo medir cuánto dura {ruta.name}.")
    pix = str(v.get("pix_fmt") or "")
    return Fuente(
        ruta=ruta,
        ancho=ancho,
        alto=alto,
        fps=_fraccion(str(v.get("avg_frame_rate") or "")) or _fraccion(str(v.get("r_frame_rate") or "")) or 25.0,
        duracion=duracion,
        codec=str(v.get("codec_name") or ""),
        bits=10 if "10" in pix else 8,
        tiene_audio=any(s.get("codec_type") == "audio" for s in streams),
    )


def es_copia_liviana(ruta: Path | str) -> bool:
    return Path(ruta).suffix in EXTENSIONES_LIVIANAS


def copia_liviana(ruta: Path | str) -> Path | None:
    """La copia liviana que la cámara dejó al lado del video, si está."""
    ruta = Path(ruta)
    for ext in EXTENSIONES_LIVIANAS:
        candidata = ruta.with_suffix(ext)
        if candidata.is_file() and candidata != ruta:
            return candidata
    return None


def para_mirar(ruta: Path | str) -> Path:
    """El archivo que conviene mirar y medir: la copia liviana si está, y si no el original."""
    return copia_liviana(ruta) or Path(ruta)
