"""El trabajador conectado a la app. Lo arranca macOS solo al iniciar sesión.

Pregunta a la app si hay algo para hacer: cada 1 minuto cuando no hay nada y
cada 5 segundos cuando hay trabajo. Toma un paso de una foto, lo hace, sube
lo que hizo y avisa. Mientras procesa avisa cada minuto que sigue vivo y le
pide a la Mac que no se duerma.

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
def latiendo(cliente: ClienteApp, trabajo: Trabajo):
    """Avisa cada minuto que sigue con el paso. Si la app dice que ya no es suyo, lo marca para dejarlo."""
    cancelado = threading.Event()
    listo = threading.Event()

    def latir():
        while not listo.wait(LATIDO_CADA_S):
            try:
                if not cliente.latido(trabajo.id, trabajo.turno):
                    log.info("La app avisó que el paso ya no es de este intento: se deja.")
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
    log.info("Trabajador apagado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
