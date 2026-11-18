"""El trabajador conectado a la app. Lo arranca macOS solo al iniciar sesión.

Pregunta a la app si hay algo para hacer: cada 1 minuto cuando no hay nada y
cada 5 segundos cuando hay trabajo. Toma un paso de una foto, lo hace, sube
lo que hizo y avisa. Mientras procesa avisa cada minuto que sigue vivo y le
pide a la Mac que no se duerma.

Cuando no hay fotos, pregunta también si hay un video para editar. La app
decide si la Mac puede editar ahora, según lo que se eligió en Equipo: apagado,
prendido o con horario. Las fotos van siempre primero.

Lo que pasa queda en ~/Library/Logs/MRB Imagenes/trabajador.log.
"""

from __future__ import annotations

import fcntl
import logging
import platform
import shutil
import signal
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from logging.handlers import RotatingFileHandler

from mrb_imagenes import VERSION
from mrb_imagenes.app import ClienteApp, ErrorDeApp, Fallo, Trabajo
from mrb_imagenes.config import (
    carpeta_de_datos,
    carpeta_de_registros,
    leer_direccion,
    leer_llave_app,
)
from mrb_imagenes.inspector import Inspector, obtener_clave_claude
from mrb_imagenes.pasos import armar_pasos
from mrb_imagenes.pasos.fondo import memoria_gb
from mrb_imagenes.trabajo import Cancelado, FotoChica, limpiar_viejas, procesar
from mrb_videos import VERSION as VERSION_VIDEOS
from mrb_videos import conexion as videos
from mrb_videos.inspector import InspectorDeVideo
from mrb_videos.medios import Cancelado as VideoCancelado
from mrb_videos.medios import FaltaFfmpeg, VideoIlegible, hay_ffmpeg
from mrb_videos.trabajo import procesar_video

log = logging.getLogger("trabajador")
LATIDO_CADA_S = 60
# Sin configurar o sin conexión, vuelve a probar cada tanto, sin apurar.
ESPERA_SIN_CONFIGURAR_S = 300
ESPERA_SIN_CONEXION_S = 60

_parar = threading.Event()


def preparar_registro() -> None:
    carpeta = carpeta_de_registros()
    carpeta.mkdir(parents=True, exist_ok=True)
    formato = logging.Formatter("%(asctime)s  %(message)s", "%Y-%m-%d %H:%M:%S")
    archivo = RotatingFileHandler(carpeta / "trabajador.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    archivo.setFormatter(formato)
    pantalla = logging.StreamHandler(sys.stdout)
    pantalla.setFormatter(formato)
    log.addHandler(archivo)
    log.addHandler(pantalla)
    log.setLevel(logging.INFO)


def esperar(segundos: float) -> None:
    _parar.wait(max(1.0, segundos))


@contextmanager
def despierto():
    """Le pide a la Mac que no se duerma mientras procesa."""
    proceso = None
    if shutil.which("caffeinate"):
        proceso = subprocess.Popen(["caffeinate", "-i"])
    try:
        yield
    finally:
        if proceso:
            proceso.terminate()


@contextmanager
def latiendo(cliente: ClienteApp, trabajo, avisar=None):
    """Avisa cada minuto que sigue con el trabajo. Si la app dice que ya no es suyo, lo marca para dejarlo."""
    cancelado = threading.Event()
    listo = threading.Event()
    avisar = avisar or cliente.latido

    def latir():
        while not listo.wait(LATIDO_CADA_S):
            try:
                if not avisar(trabajo.id, trabajo.turno):
                    log.info("La app avisó que el trabajo ya no es de este intento: se deja.")
                    cancelado.set()
                    return
            except ErrorDeApp as e:
                log.info(f"No se pudo avisar que sigue: {e}")

    hilo = threading.Thread(target=latir, daemon=True)
    hilo.start()
    try:
        yield cancelado.is_set
    finally:
        listo.set()


def mensaje_simple(e: Exception) -> str:
    texto = str(e).strip() or type(e).__name__
    if isinstance(e, MemoryError):
        return "La Mac se quedó sin memoria procesando la foto."
    return texto[:1500]


def entregar(cliente: ClienteApp, resultado) -> None:
    for intento in range(4):
        try:
            r = cliente.entregar(resultado)
            if not r.get("aceptado"):
                log.info(f"La app no aceptó el resultado: {r.get('motivo')}")
            return
        except ErrorDeApp as e:
            log.info(f"No se pudo entregar el resultado ({e}).")
            if e.hay_que_configurar:
                return
            esperar(5 * 2**intento)


def un_trabajo(cliente: ClienteApp, trabajo: Trabajo, pasos, inspector) -> None:
    log.info(f"Foto {trabajo.foto}: paso {trabajo.indice + 1}, {trabajo.grupo}: {", ".join(trabajo.pasos)} (turno {trabajo.turno}).")
    with despierto(), latiendo(cliente, trabajo) as cancelado:
        try:
            hecho = procesar(trabajo, pasos, inspector, cliente, carpeta_de_datos() / "trabajo", cancelado)
        except Cancelado:
            return
        except FotoChica as e:  # no se reintenta: la foto no sirve para el canal
            log.info(str(e))
            entregar(cliente, Fallo(id=trabajo.id, turno=trabajo.turno, error=str(e), definitivo=True))
            return
        except Exception as e:  # cualquier problema con la foto se informa a la app
            log.exception("El paso falló.")
            entregar(cliente, Fallo(id=trabajo.id, turno=trabajo.turno, error=mensaje_simple(e)))
            return
    entregar(cliente, hecho)
    costo = sum((p.uso_claude or {}).get("costo_usd", 0) for p in hecho.partes)
    log.info(f"Listo en {hecho.segundos} s" + (f", Claude US$ {costo:.3f}." if costo else "."))


# ───────────────────────────── Videos ─────────────────────────────


def minuto_del_dia() -> int:
    """La hora de la Mac, en minutos desde la medianoche."""
    ahora = time.localtime()
    return ahora.tm_hour * 60 + ahora.tm_min


def enchufada() -> bool | None:
    """Si la Mac está enchufada. None si no se puede saber, por ejemplo en una Mac de escritorio."""
    if not shutil.which("pmset"):
        return None
    try:
        dicho = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    if "AC Power" in dicho:
        return True
    return False if "Battery Power" in dicho else None


def entregar_video(cliente: ClienteApp, resultado) -> None:
    for intento in range(4):
        try:
            r = videos.entregar(cliente, resultado)
            if not r.get("aceptado"):
                log.info(f"La app no aceptó la edición: {r.get('motivo')}")
            return
        except ErrorDeApp as e:
            log.info(f"No se pudo entregar la edición ({e}).")
            if e.hay_que_configurar:
                return
            esperar(5 * 2**intento)


# Cada cuánto se le cuenta a la app por dónde va una etapa larga, como exportar.
AVANCE_CADA_S = 5


class Avance:
    """Le cuenta a la app en qué anda la edición: enseguida al cambiar de etapa, y cada tanto mientras dura."""

    def __init__(self, cliente: ClienteApp, trabajo: videos.TrabajoDeVideo):
        self.cliente, self.trabajo = cliente, trabajo
        self.etapa: str | None = None
        self.ultimo = 0.0
        # La app también dice acá si la edición dejó de ser de este intento.
        self.cortado = False

    def __call__(self, etapa: str, porcentaje: float | None = None) -> None:
        nueva = etapa != self.etapa
        if nueva:
            log.info(f"  {etapa}.")
        elif time.monotonic() - self.ultimo < AVANCE_CADA_S:
            return
        self.etapa, self.ultimo = etapa, time.monotonic()
        try:
            if not videos.latido(self.cliente, self.trabajo.id, self.trabajo.turno, etapa, porcentaje):
                self.cortado = True
        except ErrorDeApp:
            pass  # el avance es un extra: si no llega, la edición sigue


def un_video(cliente: ClienteApp, trabajo: videos.TrabajoDeVideo, inspector: InspectorDeVideo) -> None:
    log.info(f"Video {trabajo.original.nombre}: se edita para un clip de {trabajo.objetivo_segundos:g} segundos (turno {trabajo.turno}).")
    avance = Avance(cliente, trabajo)
    with despierto(), latiendo(cliente, trabajo, lambda id, turno: videos.latido(cliente, id, turno)) as latido_cortado:
        cancelado = lambda: latido_cortado() or avance.cortado  # noqa: E731
        try:
            hecho = procesar_video(trabajo, inspector, cliente, carpeta_de_datos() / "trabajo", cancelado, avance)
        except VideoCancelado:
            log.info("La edición se dejó: la app la sacó de la cola o se apagó la edición de videos.")
            return
        except (VideoIlegible, FaltaFfmpeg, ValueError) as e:  # no se arregla reintentando
            log.info(str(e))
            entregar_video(cliente, videos.VideoFallido(id=trabajo.id, turno=trabajo.turno, error=mensaje_simple(e), definitivo=True))
            return
        except Exception as e:  # cualquier otro problema se informa a la app y se reintenta
            log.exception("La edición falló.")
            entregar_video(cliente, videos.VideoFallido(id=trabajo.id, turno=trabajo.turno, error=mensaje_simple(e)))
            return
    entregar_video(cliente, hecho)
    costo = (hecho.propuesta.uso or {}).get("costo_usd", 0) if hecho.propuesta else 0
    log.info(f"Clip de {hecho.clip.segundos:g} s listo en {hecho.segundos} s" + (f", Claude US$ {costo:.3f}." if costo else "."))


# Lo último que dijo la app de los videos, para no repetirlo en el registro cada minuto.
_dicho_de_videos: str | None = None


def preguntar_por_videos(cliente: ClienteApp) -> float | None:
    """Pregunta si hay un video para editar y lo edita. Devuelve cuándo volver a preguntar, o None si no se pudo."""
    global _dicho_de_videos
    try:
        r = videos.siguiente(cliente, VERSION_VIDEOS, minuto_del_dia(), enchufada())
    except ErrorDeApp as e:
        # Una app que todavía no tiene el editor de videos responde que no existe: no es un problema.
        dicho = "La app todavía no tiene el editor de videos." if e.estado == 404 else f"Videos: {e}"
        if dicho != _dicho_de_videos:
            log.info(dicho)
            _dicho_de_videos = dicho
        return None
    dicho = f"Videos: {r.motivo}" if r.motivo else None
    if dicho and dicho != _dicho_de_videos:
        log.info(dicho)
    _dicho_de_videos = dicho
    if r.trabajo is not None:
        inspector = InspectorDeVideo.desde_entorno() if obtener_clave_claude() else InspectorDeVideo(simulado=True)
        un_video(cliente, r.trabajo, inspector)
    return r.volver_en


def main() -> int:
    preparar_registro()
    datos = carpeta_de_datos()
    datos.mkdir(parents=True, exist_ok=True)
    # Un solo trabajador por Mac: si ya hay uno corriendo, este no arranca.
    candado = open(datos / "trabajador.lock", "w")
    try:
        fcntl.flock(candado, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log.info("Ya hay un trabajador corriendo en esta Mac.")
        return 0
    signal.signal(signal.SIGTERM, lambda *_: _parar.set())

    pasos = armar_pasos()
    modelo = getattr(pasos[5].segmentador, "modelo", None)
    log.info(f"Trabajador de imágenes {VERSION}. Modelo para el fondo: {modelo}. Memoria: {memoria_gb():.0f} GB.")
    log.info(f"Editor de videos {VERSION_VIDEOS}." + ("" if hay_ffmpeg() else " Falta ffmpeg: se instala con brew install ffmpeg."))
    limpiar_viejas(datos / "trabajo")

    while not _parar.is_set():
        direccion, llave = leer_direccion(), leer_llave_app()
        if not llave:
            log.info("Falta la llave de la app. Creala en Equipo y cargala con bash configurar.sh.")
            esperar(ESPERA_SIN_CONFIGURAR_S)
            continue
        aviso = None
        if obtener_clave_claude():
            inspector = Inspector.desde_entorno()
        else:
            aviso = "Falta la clave de Claude en la Mac: los pasos usan los valores que mide el programa."
            inspector = Inspector(simulado=True)
        info = {"modelo_fondo": modelo, "memoria_gb": round(memoria_gb(), 1), "sistema": f"{platform.system()} {platform.mac_ver()[0] or platform.release()}", "aviso": aviso}
        cliente = ClienteApp(direccion, llave)
        try:
            r = cliente.siguiente(info, VERSION)
        except ErrorDeApp as e:
            log.info(str(e))
            esperar(ESPERA_SIN_CONFIGURAR_S if e.hay_que_configurar else ESPERA_SIN_CONEXION_S)
            continue
        if r.trabajo is not None:
            un_trabajo(cliente, r.trabajo, pasos, inspector)
            esperar(r.volver_en)
            continue
        # Sin fotos para hacer, los videos.
        volver_por_videos = preguntar_por_videos(cliente)
        esperar(min(r.volver_en, volver_por_videos) if volver_por_videos else r.volver_en)
    log.info("Trabajador apagado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
