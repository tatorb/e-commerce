"""Hace una edición que pidió la app.

Consigue el video original y su copia liviana, mira y mide, le pide a Claude
la corrección de imagen (o usa el plan que pidió la persona), exporta el clip
y lo sube a la carpeta de videos del producto.

El original se busca primero en la carpeta de Google Drive de la Mac: los
videos pesan mucho y casi siempre ya están ahí, porque se copiaron desde esa
misma Mac. Si no está, se baja de a pedazos a través de la app.
"""

from __future__ import annotations

import logging
import os
import shutil
import time
from collections.abc import Callable
from pathlib import Path

from mrb_imagenes.app import ClienteApp

from .conexion import ArchivoDelDrive, ClipHecho, LineaDicha, PropuestaParaApp, SonidoHecho, TrabajoDeVideo, VideoHecho, bajar_en_pedazos, subir_archivo
from .inspector import Contexto, InspectorDeVideo
from .linea import Pedido, armar
from .medios import Cancelado, Fuente, leer
from .plan import ReglasDelClip

log = logging.getLogger("trabajador")


def carpetas_del_drive() -> list[Path]:
    """Donde Google Drive para computadoras muestra los archivos en la Mac: una carpeta por cuenta."""
    if os.environ.get("MRB_DRIVE"):
        return [Path(os.environ["MRB_DRIVE"])]
    nube = Path.home() / "Library" / "CloudStorage"
    return sorted(nube.glob("GoogleDrive-*")) if nube.is_dir() else []


def buscar_en_el_drive(archivo: ArchivoDelDrive) -> Path | None:
    """El archivo en la carpeta de Google Drive de la Mac, si está y pesa lo mismo. None si no."""
    if not archivo.carpeta:
        return None
    for cuenta in carpetas_del_drive():
        # Adentro están "Mi unidad" y las unidades compartidas, con el nombre que tenga cada una.
        try:
            raices = [d for d in cuenta.iterdir() if d.is_dir()]
            raices += [d for r in raices for d in r.iterdir() if d.is_dir() and d.name != archivo.carpeta[0]]
        except OSError:
            continue
        for raiz in raices:
            candidato = raiz.joinpath(*archivo.carpeta, archivo.nombre)
            try:
                if candidato.is_file() and (archivo.bytes is None or candidato.stat().st_size == archivo.bytes):
                    return candidato
            except OSError:
                continue
    return None


Informar = Callable[[str, float | None], None]


def _callado(etapa: str, porcentaje: float | None = None) -> None:
    pass


def conseguir(cliente: ClienteApp, archivo: ArchivoDelDrive, carpeta: Path, cancelado: Callable[[], bool], informar: Informar = _callado) -> tuple[Path, bool]:
    """El archivo listo para leer, y si hubo que bajarlo."""
    local = buscar_en_el_drive(archivo)
    if local:
        return local, False
    destino = carpeta / archivo.nombre
    if not (destino.is_file() and archivo.bytes is not None and destino.stat().st_size == archivo.bytes):
        log.info(f"{archivo.nombre} no está en la carpeta de Google Drive de la Mac: se baja a través de la app.")
        bajar_en_pedazos(cliente, archivo, destino, cancelado, lambda parte: informar(f"Bajando {archivo.nombre}", 100 * parte))
    return destino, True


def _giro_sin_claude(fuente: Fuente) -> int:
    # Un video horizontal de cámara cenital se graba parado al costado de la mesa: un cuarto de vuelta lo deja vertical.
    return 0 if fuente.vertical else 1


def procesar_video(
    trabajo: TrabajoDeVideo,
    inspector: InspectorDeVideo,
    cliente: ClienteApp,
    raiz: Path,
    cancelado: Callable[[], bool],
    informar: Informar = _callado,
) -> VideoHecho:
    empezo = time.monotonic()
    informar("Buscando el video", None)
    carpeta = raiz / f"video-{trabajo.video}"
    carpeta.mkdir(parents=True, exist_ok=True)
    try:
        original, _ = conseguir(cliente, trabajo.original, carpeta, cancelado, informar)
        fuente = leer(original)
        mirar = fuente
        if trabajo.liviana:
            try:
                mirar = leer(conseguir(cliente, trabajo.liviana, carpeta, cancelado, informar)[0])
            except Cancelado:
                raise
            except Exception as e:  # sin la copia liviana se mira el original, que es más lento
                log.info(f"No se pudo usar la copia liviana ({e}): se mira el original.")
        if cancelado():
            raise Cancelado()

        protocolo = trabajo.video_del_protocolo
        sonido = trabajo.sonido
        pedido = Pedido(
            objetivo=trabajo.objetivo_segundos,
            reglas=ReglasDelClip(**trabajo.reglas.model_dump()),
            contexto=Contexto(producto=trabajo.producto, paso=protocolo.titulo if protocolo else None, indicaciones=protocolo.indicaciones if protocolo else None, indicacion=trabajo.indicacion),
            plan=trabajo.plan,
            momentos=[m.model_dump() for m in trabajo.momentos],
            guion=trabajo.guion,
            voz=sonido.voz.id if sonido and sonido.voz else None,
            musica=sonido.musica.estilo if sonido and sonido.musica else None,
            subtitulos=bool(sonido and sonido.subtitulos),
            color_subtitulos=sonido.color_subtitulos if sonido else None,
            cuartos=_giro_sin_claude(mirar),
        )
        r = armar(fuente, mirar, pedido, inspector, carpeta, carpeta / "clip.mp4", cancelado, informar=informar)
        if cancelado():
            raise Cancelado()
        informar("Subiendo el clip al Drive", None)
        subir_archivo(cliente, trabajo.subidas["clip"], r.clip.ruta)
        return VideoHecho(
            id=trabajo.id,
            turno=trabajo.turno,
            plan=r.plan,
            medidas=r.medidas.como_dict(),
            propuesta=PropuestaParaApp(razon=r.razon, origen=r.origen, uso={"costo_usd": r.costo_usd} if r.costo_usd else None),
            clip=ClipHecho(ancho=r.clip.ancho, alto=r.clip.alto, segundos=round(r.clip.duracion, 2), bytes=r.clip.bytes),
            guion=[LineaDicha(inicio=linea.inicio, fin=linea.fin, texto=linea.texto) for linea in r.guion] or None,
            sonido=SonidoHecho(voz=bool(r.guion), musica=r.con_musica, subtitulos=r.con_subtitulos) if sonido else None,
            avisos=r.avisos,
            segundos=int(time.monotonic() - empezo),
        )
    finally:
        # Los videos pesan mucho: en la Mac no queda nada de la edición.
        shutil.rmtree(carpeta, ignore_errors=True)
