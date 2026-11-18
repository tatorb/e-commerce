"""Del plan a las instrucciones de ffmpeg.

Primero se cortan los tramos y se pasa cada uno a su velocidad, tirando los
cuadros que sobran. Recién después se gira, se recorta, se achica y se
corrige el color, así ese trabajo se hace solo sobre los cuadros que quedan.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .medios import Fuente
from .plan import MERCADOLIBRE, Imagen, Plan, ReglasDelClip

# Los cuartos de vuelta en sentido horario, como los entiende ffmpeg.
_GIROS = {0: [], 1: ["transpose=1"], 2: ["hflip", "vflip"], 3: ["transpose=2"]}


@dataclass(frozen=True)
class Recorte:
    ancho: int
    alto: int
    x: int
    y: int


def _par(n: float) -> int:
    return max(2, int(n) // 2 * 2)


def lado_girado(fuente: Fuente, cuartos: int) -> tuple[int, int]:
    return (fuente.alto, fuente.ancho) if cuartos % 2 else (fuente.ancho, fuente.alto)


def recorte(fuente: Fuente, imagen: Imagen, reglas: ReglasDelClip = MERCADOLIBRE) -> Recorte:
    """El rectángulo con la forma del clip que se toma del video ya girado."""
    ancho, alto = lado_girado(fuente, imagen.cuartos)
    forma = reglas.ancho / reglas.alto
    w, h = (alto * forma, alto) if ancho / alto > forma else (ancho, ancho / forma)
    # Al enderezar aparecen esquinas vacías: se acerca lo justo para que no se vean.
    a = math.radians(abs(imagen.enderezado))
    achique = min(ancho / (w * math.cos(a) + h * math.sin(a)), alto / (w * math.sin(a) + h * math.cos(a)), 1.0)
    factor = achique / imagen.zoom
    w, h = _par(w * factor), _par(h * factor)
    # Lo que se puede correr sin que entren las esquinas vacías.
    libre_x = max(0.0, ancho - (w * math.cos(a) + h * math.sin(a)))
    libre_y = max(0.0, alto - (w * math.sin(a) + h * math.cos(a)))
    x = (ancho - w) / 2 + (imagen.centro_x - 0.5) * libre_x
    y = (alto - h) / 2 + (imagen.centro_y - 0.5) * libre_y
    return Recorte(ancho=w, alto=h, x=int(round(x)), y=int(round(y)))


def cuadros_por_segundo(fuente: Fuente) -> float:
    """Los del original, sin pasar de 30."""
    return min(round(fuente.fps, 3) or 25.0, 30.0)


def de_imagen(fuente: Fuente, imagen: Imagen, reglas: ReglasDelClip = MERCADOLIBRE) -> list[str]:
    """Girar, enderezar, recortar, achicar y corregir el color, en ese orden."""
    pasos = list(_GIROS[imagen.cuartos])
    if abs(imagen.enderezado) > 0.01:
        pasos.append(f"rotate={math.radians(imagen.enderezado):.6f}:ow=iw:oh=ih:fillcolor=black")
    r = recorte(fuente, imagen, reglas)
    pasos.append(f"crop={r.ancho}:{r.alto}:{r.x}:{r.y}")
    pasos.append(f"scale={reglas.ancho}:{reglas.alto}:flags=lanczos")
    if any(abs(v - 1.0) > 1e-3 for v in (imagen.rojo, imagen.verde, imagen.azul)):
        pasos.append(f"colorchannelmixer=rr={imagen.rojo:.4f}:gg={imagen.verde:.4f}:bb={imagen.azul:.4f}")
    if abs(imagen.contraste - 1.0) > 1e-3 or abs(imagen.saturacion - 1.0) > 1e-3:
        pasos.append(f"eq=contrast={imagen.contraste:.4f}:saturation={imagen.saturacion:.4f}")
    return pasos


def grafo(fuente: Fuente, plan: Plan, reglas: ReglasDelClip = MERCADOLIBRE, subtitulos: str | None = None) -> str:
    """El filtro completo: deja el video terminado en la salida [v]. `subtitulos` es el nombre del archivo, en la carpeta donde corre ffmpeg."""
    fps = cuadros_por_segundo(fuente)
    n = len(plan.tramos)
    partes = [f"[0:v:0]split={n}" + "".join(f"[e{i}]" for i in range(n))] if n > 1 else []
    for i, t in enumerate(plan.tramos):
        entrada = f"[e{i}]" if n > 1 else "[0:v:0]"
        partes.append(f"{entrada}trim=start={t.inicio:.3f}:end={t.fin:.3f},setpts=(PTS-STARTPTS)/{t.velocidad:.4f},fps={fps:g}[t{i}]")
    cola = [f"concat=n={n}:v=1:a=0"] if n > 1 else []
    cola += de_imagen(fuente, plan.imagen, reglas)
    if plan.cierre > 0:
        cola.append(f"tpad=stop_mode=clone:stop_duration={plan.cierre:.3f}")
    if subtitulos:
        # Después del cierre, para que se escriban también sobre la imagen quieta.
        cola.append(f"ass={subtitulos}")
    cola += ["format=yuv420p", "setsar=1"]
    partes.append("".join(f"[t{i}]" for i in range(n)) + ",".join(cola) + "[v]")
    return ";".join(partes)
