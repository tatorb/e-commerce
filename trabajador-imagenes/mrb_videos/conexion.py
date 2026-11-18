"""Los mensajes del editor de videos con la app.

Usa la misma conexión y la misma llave que el trabajador de imágenes. La
forma de los mensajes es la de src/domain/video-edit.ts en la app, y los
ejemplos de contrato/ los prueban los dos lados.
"""

from __future__ import annotations

import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from mrb_imagenes.app import ClienteApp, ErrorDeApp, Transferencia

from .medios import Cancelado
from .plan import Plan

# Sube cuando cambia la forma de los mensajes, igual que VIDEO_PROTOCOL en la app.
PROTOCOLO = 1


class ArchivoDelDrive(BaseModel):
    """Un archivo que la Mac necesita: lo busca en su carpeta de Google Drive y, si no está, lo baja de a pedazos."""

    nombre: str
    bytes: int | None = None
    # Los nombres de las carpetas desde la raíz de la app hasta la del archivo.
    carpeta: list[str] = Field(default_factory=list)
    bajar: Transferencia
    pedazo: int = 4 * 1024 * 1024


class VideoDelProtocolo(BaseModel):
    titulo: str
    indicaciones: str | None = None


class Reglas(BaseModel):
    min_segundos: float = 10
    max_segundos: float = 60
    ancho: int = 1080
    alto: int = 1920
    max_bytes: int = 280 * 1024**2


class Momento(BaseModel):
    """Un momento del video según el protocolo."""

    texto: str
    importancia: str = "NORMAL"


class Voz(BaseModel):
    id: str


class Musica(BaseModel):
    estilo: str


class Sonido(BaseModel):
    voz: Voz | None = None
    musica: Musica | None = None
    subtitulos: bool = False
    # El color de la palabra que se está diciendo en los subtítulos, como "#6FA82C".
    color_subtitulos: str | None = None


class TrabajoDeVideo(BaseModel):
    id: str
    turno: int
    video: str
    producto: str | None = None
    video_del_protocolo: VideoDelProtocolo | None = None
    # La indicación puntual de la persona para esta edición: manda sobre las demás.
    indicacion: str | None = None
    objetivo_segundos: float = 45
    # El plan que pidió la persona: se aplica tal cual, sin consultar a Claude.
    plan: Plan | None = None
    # Los momentos del video según el protocolo, para que Claude ubique los cortes.
    momentos: list[Momento] = Field(default_factory=list)
    # El guión del clip, ya escrito y revisado: las frases que dice la voz, en orden. None: sin voz.
    guion: list[str] | None = None
    # Cómo se escribe cada frase en los subtítulos, en el mismo orden. None o una frase vacía: igual a lo que se dice.
    guion_en_pantalla: list[str] | None = None
    # El sonido del clip. None: sale en silencio.
    sonido: Sonido | None = None
    reglas: Reglas = Field(default_factory=Reglas)
    original: ArchivoDelDrive
    liviana: ArchivoDelDrive | None = None
    subidas: dict[Literal["clip"], Transferencia]


class SiguienteVideo(BaseModel):
    trabajo: TrabajoDeVideo | None = None
    volver_en: float = 120
    # Por qué no hay trabajo aunque haya videos en cola: apagado, fuera de horario o a batería.
    motivo: str | None = None


class PropuestaParaApp(BaseModel):
    razon: str
    # claude, medido, simulado o pedido, cuando el plan lo pidió la persona.
    origen: str
    avisos: list[str] = Field(default_factory=list)
    uso: dict | None = None


class ClipHecho(BaseModel):
    ancho: int
    alto: int
    segundos: float
    bytes: int


class LineaDicha(BaseModel):
    """Una línea del guión, con los segundos del clip en que empieza y termina."""

    inicio: float
    fin: float
    texto: str


class SonidoHecho(BaseModel):
    voz: bool = False
    musica: bool = False
    subtitulos: bool = False
    costo_usd: float | None = None


class VideoHecho(BaseModel):
    protocolo: int = PROTOCOLO
    id: str
    turno: int
    ok: Literal[True] = True
    plan: Plan
    medidas: dict | None = None
    propuesta: PropuestaParaApp | None = None
    clip: ClipHecho
    guion: list[LineaDicha] | None = None
    sonido: SonidoHecho | None = None
    avisos: list[str] = Field(default_factory=list)
    segundos: int


class VideoFallido(BaseModel):
    protocolo: int = PROTOCOLO
    id: str
    turno: int
    ok: Literal[False] = False
    error: str
    # No vale la pena reintentar: por ejemplo, el video no se puede leer.
    definitivo: bool = False


def siguiente(cliente: ClienteApp, version: str, minuto: int | None, enchufada: bool | None) -> SiguienteVideo:
    cuerpo = {"protocolo": PROTOCOLO, "version": version, "minuto": minuto, "enchufada": enchufada}
    return SiguienteVideo.model_validate(cliente._post("/api/videos/trabajador/siguiente", cuerpo))


def latido(cliente: ClienteApp, id: str, turno: int, etapa: str | None = None, porcentaje: float | None = None) -> bool:
    """Avisa que sigue con la edición y, si se dice, en qué anda. Devuelve si la edición sigue siendo suya."""
    cuerpo: dict = {"protocolo": PROTOCOLO, "id": id, "turno": turno}
    if etapa:
        cuerpo["avance"] = {"etapa": etapa[:120], "porcentaje": None if porcentaje is None else round(max(0.0, min(100.0, porcentaje)), 1)}
    return bool(cliente._post("/api/videos/trabajador/latido", cuerpo).get("vigente"))


def entregar(cliente: ClienteApp, resultado: VideoHecho | VideoFallido) -> dict:
    return cliente._post("/api/videos/trabajador/resultado", resultado.model_dump(mode="json"))


def bajar_en_pedazos(
    cliente: ClienteApp,
    archivo: ArchivoDelDrive,
    destino: Path,
    cancelado: Callable[[], bool] | None = None,
    avance: Callable[[float], None] | None = None,
) -> None:
    """Baja un archivo grande a través de la app, de a pedazos, sin cargarlo en memoria."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_name(destino.name + ".parcial")
    total = archivo.bytes
    bajado = 0
    with open(parcial, "wb") as f:
        while total is None or bajado < total:
            if cancelado and cancelado():
                raise Cancelado()
            encabezados = cliente._encabezados(archivo.bajar)
            encabezados["Range"] = f"bytes={bajado}-{bajado + archivo.pedazo - 1}"
            pedido = urllib.request.Request(archivo.bajar.url, method="GET", headers=encabezados)
            with cliente._abrir(pedido, timeout=300) as r:
                pedazo = r.read()
                rango = r.headers.get("Content-Range") or ""
            if not pedazo:
                break
            f.write(pedazo)
            bajado += len(pedazo)
            if avance and total:
                avance(bajado / total)
            # "bytes 0-4194303/754155258": el total, por si la app no lo sabía.
            if "/" in rango and rango.rsplit("/", 1)[1].isdigit():
                total = int(rango.rsplit("/", 1)[1])
            elif len(pedazo) < archivo.pedazo:
                break
    if total is not None and bajado != total:
        parcial.unlink(missing_ok=True)
        raise ErrorDeApp(f"{archivo.nombre} llegó incompleto: {bajado} de {total} bytes.")
    parcial.replace(destino)


def subir_archivo(cliente: ClienteApp, t: Transferencia, ruta: Path) -> None:
    """Sube un archivo de disco sin cargarlo entero en memoria."""
    encabezados = cliente._encabezados(t)
    encabezados.setdefault("Content-Type", "application/octet-stream")
    encabezados["Content-Length"] = str(ruta.stat().st_size)
    with open(ruta, "rb") as f:
        pedido = urllib.request.Request(t.url, data=f, method=t.metodo, headers=encabezados)
        with cliente._abrir(pedido, timeout=1800) as r:
            r.read()
