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


def _lleva(cuenta: Path, total: float) -> float:
    """Qué parte del clip ya exportó ffmpeg, de 0 a 1, según lo último que anotó."""
    try:
        renglones = cuenta.read_text(errors="replace").splitlines()
    except OSError:
        return 0.0
    for renglon in reversed(renglones):
        if renglon.startswith("out_time_us=") or renglon.startswith("out_time_ms="):
            try:
                # Los dos vienen en millonésimas de segundo.
                return max(0.0, min(1.0, int(renglon.split("=", 1)[1]) / 1_000_000 / max(total, 0.1)))
            except ValueError:
                return 0.0
    return 0.0


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
def puede_subtitular() -> bool:
    """Si este ffmpeg sabe escribir subtítulos sobre el video. Algunas instalaciones no traen esa parte."""
    filtros = correr([programa("ffmpeg"), "-hide_banner", "-filters"]).stdout.decode("utf-8", "replace")
    return any(renglon.split()[1:2] == ["subtitles"] for renglon in filtros.splitlines())


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


def comando(fuente: Fuente, plan: Plan, salida: Path, codificador: str, reglas: ReglasDelClip = MERCADOLIBRE, sonido: Path | None = None, subtitulos: str | None = None) -> list[str]:
    # Sin sonido propio, una pista en silencio.
    pista = ["-i", str(sonido)] if sonido else ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
    return [
        programa("ffmpeg"), "-v", "error", "-y",
        "-i", str(fuente.ruta),
        *pista,
        "-filter_complex", grafo(fuente, plan, reglas, subtitulos),
        "-map", "[v]", "-map", "1:a",
        *_de_video(codificador),
        "-r", f"{cuadros_por_segundo(fuente):g}",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k" if sonido else "128k",
        "-shortest", "-movflags", "+faststart",
        str(salida),
    ]


def exportar(
    fuente: Fuente,
    plan: Plan,
    salida: Path | str,
    *,
    codificador: str | None = None,
    reglas: ReglasDelClip = MERCADOLIBRE,
    cancelado: Callable[[], bool] | None = None,
    sonido: Path | None = None,
    subtitulos: Path | None = None,
    avance: Callable[[float], None] | None = None,
) -> Clip:
    """`sonido` es la pista ya mezclada, del largo del clip. `subtitulos` es un archivo .ass."""
    salida = Path(salida).resolve()
    problemas = revisar(plan, fuente, reglas)
    if problemas:
        raise PlanInvalido(" ".join(problemas))
    if salida == fuente.ruta.resolve():
        raise PlanInvalido("El clip no puede guardarse encima del original.")
    salida.parent.mkdir(parents=True, exist_ok=True)
    codificador = codificador or elegir_codificador()
    orden = comando(fuente, plan, salida, codificador, reglas, sonido.resolve() if sonido else None, subtitulos.name if subtitulos else None)
    cuenta = salida.with_name(salida.name + ".avance")
    mirar_avance = None
    if avance:
        # ffmpeg va anotando por dónde va en un archivo: se lee cada segundo.
        orden[1:1] = ["-nostats", "-progress", str(cuenta)]
        mirar_avance = lambda: avance(_lleva(cuenta, plan.dura))  # noqa: E731
    try:
        # ffmpeg corre en la carpeta de los subtítulos: así su nombre no necesita escapes.
        correr(orden, cancelado=cancelado, carpeta=subtitulos.resolve().parent if subtitulos else None, cada_segundo=mirar_avance)
    except BaseException:
        # Un clip a medio hacer no queda en el disco.
        salida.unlink(missing_ok=True)
        raise
    finally:
        cuenta.unlink(missing_ok=True)
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
