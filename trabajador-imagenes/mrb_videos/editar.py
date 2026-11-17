"""Exportar el clip: aplica el plan al original y deja un MP4 listo para el canal.

El original no se toca. El clip sale sin el sonido de la grabación, con una
pista en silencio para que cualquier reproductor lo acepte; la voz y la
música se suman después.
"""

from __future__ import annotations

import platform
from dataclasses import dataclass
from functools import cache
from collections.abc import Callable
from pathlib import Path

from .filtros import cuadros_por_segundo, grafo
from .medios import Fuente, correr, leer, programa
from .plan import MERCADOLIBRE, Plan, ReglasDelClip, revisar

# Megabits por segundo del clip: de sobra para 1080 × 1920 y lejos del peso máximo del canal.
MEGABITS = 8


class PlanInvalido(ValueError):
    pass


@dataclass(frozen=True)
class Clip:
    ruta: Path
    ancho: int
    alto: int
    duracion: float
    bytes: int
    codificador: str
    avisos: tuple[str, ...]


@cache
def _codificadores() -> str:
    return correr([programa("ffmpeg"), "-hide_banner", "-encoders"]).stdout.decode("utf-8", "replace")


def elegir_codificador() -> str:
    """En la Mac, el del chip, que es mucho más rápido. Si no está, el común."""
    if platform.system() == "Darwin" and "h264_videotoolbox" in _codificadores():
        return "h264_videotoolbox"
    return "libx264"


def _de_video(codificador: str) -> list[str]:
    if codificador == "h264_videotoolbox":
        return ["-c:v", codificador, "-b:v", f"{MEGABITS}M", "-maxrate", f"{MEGABITS * 3 // 2}M", "-profile:v", "high", "-allow_sw", "1"]
    return ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", f"{MEGABITS * 3 // 2}M", "-bufsize", f"{MEGABITS * 3}M", "-profile:v", "high"]


def comando(fuente: Fuente, plan: Plan, salida: Path, codificador: str, reglas: ReglasDelClip = MERCADOLIBRE) -> list[str]:
    return [
        programa("ffmpeg"), "-v", "error", "-y",
        "-i", str(fuente.ruta),
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-filter_complex", grafo(fuente, plan, reglas),
        "-map", "[v]", "-map", "1:a",
        *_de_video(codificador),
        "-r", f"{cuadros_por_segundo(fuente):g}",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
        str(salida),
    ]


def exportar(fuente: Fuente, plan: Plan, salida: Path | str, *, codificador: str | None = None, reglas: ReglasDelClip = MERCADOLIBRE, cancelado: Callable[[], bool] | None = None) -> Clip:
    salida = Path(salida)
    problemas = revisar(plan, fuente, reglas)
    if problemas:
        raise PlanInvalido(" ".join(problemas))
    if salida.resolve() == fuente.ruta.resolve():
        raise PlanInvalido("El clip no puede guardarse encima del original.")
    salida.parent.mkdir(parents=True, exist_ok=True)
    codificador = codificador or elegir_codificador()
    try:
        correr(comando(fuente, plan, salida, codificador, reglas), cancelado=cancelado)
    except BaseException:
        # Un clip a medio hacer no queda en el disco.
        salida.unlink(missing_ok=True)
        raise
    hecho = leer(salida)
    peso = salida.stat().st_size
    avisos = []
    if (hecho.ancho, hecho.alto) != (reglas.ancho, reglas.alto):
        avisos.append(f"El clip salió de {hecho.ancho} × {hecho.alto} y se esperaba {reglas.ancho} × {reglas.alto}.")
    if not reglas.min_segundos <= hecho.duracion <= reglas.max_segundos + 0.5:
        avisos.append(f"El clip dura {hecho.duracion:.1f} segundos y el canal pide de {reglas.min_segundos:g} a {reglas.max_segundos:g}.")
    if peso > reglas.max_bytes:
        avisos.append(f"El clip pesa {peso / 1024**2:.0f} MB y el canal acepta hasta {reglas.max_bytes / 1024**2:.0f}.")
    return Clip(ruta=salida, ancho=hecho.ancho, alto=hecho.alto, duracion=hecho.duracion, bytes=peso, codificador=codificador, avisos=tuple(avisos))
