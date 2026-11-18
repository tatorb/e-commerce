"""Hojas de cuadros: el video en imágenes quietas, cada una con su segundo.

Es lo que mira Claude para saber qué pasa y cuándo, y lo que mira la persona
para revisar un plan sin esperar a que se exporte el clip.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .filtros import _GIROS
from .medios import Fuente, correr, programa


def reloj(segundos: float) -> str:
    return f"{int(segundos // 60)}:{segundos % 60:04.1f}"


def armar(fuente: Fuente, carpeta: Path | str, *, cada: float = 2.0, cuartos: int = 0, columnas: int = 4, filas: int = 4, ancho: int = 360) -> list[Path]:
    """Un cuadro cada tantos segundos, girado como va a quedar, en hojas numeradas."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    girado_ancho, girado_alto = (fuente.alto, fuente.ancho) if cuartos % 2 else (fuente.ancho, fuente.alto)
    alto = max(2, int(ancho * girado_alto / girado_ancho) // 2 * 2)
    cantidad = max(1, math.ceil(fuente.duracion / cada))
    filtro = ",".join([f"fps=1/{cada:g}", *_GIROS[cuartos], f"scale={ancho}:{alto}"])
    res = correr(
        [
            programa("ffmpeg"), "-v", "error", "-i", str(fuente.ruta), "-map", "0:v:0", "-an",
            "-vf", filtro, "-frames:v", str(cantidad), "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        ]
    )
    peso = ancho * alto * 3
    cuadros = [Image.frombytes("RGB", (ancho, alto), res.stdout[i * peso : (i + 1) * peso]) for i in range(len(res.stdout) // peso)]
    letra = ImageFont.load_default(size=max(14, ancho // 16))
    por_hoja = columnas * filas
    hojas = []
    for h in range(0, len(cuadros), por_hoja):
        grupo = cuadros[h : h + por_hoja]
        hoja = Image.new("RGB", (columnas * ancho, math.ceil(len(grupo) / columnas) * alto), "black")
        lapiz = ImageDraw.Draw(hoja)
        for i, cuadro in enumerate(grupo):
            x, y = (i % columnas) * ancho, (i // columnas) * alto
            hoja.paste(cuadro, (x, y))
            texto = reloj((h + i) * cada)
            caja = lapiz.textbbox((x + 6, y + 4), texto, font=letra)
            lapiz.rectangle((caja[0] - 4, caja[1] - 2, caja[2] + 4, caja[3] + 2), fill="black")
            lapiz.text((x + 6, y + 4), texto, fill="white", font=letra)
        ruta = carpeta / f"hoja_{h // por_hoja + 1:02d}.jpg"
        hoja.save(ruta, quality=82)
        hojas.append(ruta)
    return hojas


def de_tramos(fuente: Fuente, momentos: list[float], *, cuartos: int = 0, columnas: int = 4, ancho: int = 300) -> bytes:
    """Un cuadro por tramo, en el segundo pedido de cada uno, numerados, en una sola imagen JPG."""
    import io

    girado_ancho, girado_alto = (fuente.alto, fuente.ancho) if cuartos % 2 else (fuente.ancho, fuente.alto)
    alto = max(2, int(ancho * girado_alto / girado_ancho) // 2 * 2)
    filtro = ",".join([*_GIROS[cuartos], f"scale={ancho}:{alto}"])
    cuadros = []
    for segundo in momentos:
        res = correr(
            [
                programa("ffmpeg"), "-v", "error", "-ss", f"{max(0.0, segundo):.3f}", "-i", str(fuente.ruta), "-map", "0:v:0", "-an",
                "-vf", filtro, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
            ]
        )
        if len(res.stdout) >= ancho * alto * 3:
            cuadros.append(Image.frombytes("RGB", (ancho, alto), res.stdout[: ancho * alto * 3]))
        else:
            cuadros.append(Image.new("RGB", (ancho, alto), "black"))
    hoja = Image.new("RGB", (min(columnas, len(cuadros)) * ancho, math.ceil(len(cuadros) / columnas) * alto), "black")
    lapiz = ImageDraw.Draw(hoja)
    letra = ImageFont.load_default(size=max(18, ancho // 10))
    for i, cuadro in enumerate(cuadros):
        x, y = (i % columnas) * ancho, (i // columnas) * alto
        hoja.paste(cuadro, (x, y))
        lapiz.rectangle((x, y, x + ancho // 5, y + ancho // 7), fill="black")
        lapiz.text((x + 8, y + 2), str(i + 1), fill="white", font=letra)
    salida = io.BytesIO()
    hoja.save(salida, format="JPEG", quality=82)
    return salida.getvalue()
