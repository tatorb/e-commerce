"""Hace un paso que pidió la app.

Un paso tiene varios ajustes que se hacen de corrido. Consigue la foto que
entra al paso y, ajuste por ajuste, la mide, le pide valores a Claude (o usa
los que pidió la persona) y aplica. Al final sube las vistas, el paquete para
editar en vivo en la app y arma el resultado.

Las fotos intermedias en tamaño completo quedan en la Mac, en una carpeta por
foto: pesan mucho y subirlas en cada paso haría todo lento. Si esa carpeta se
borra, se vuelven a armar desde el original con la receta que manda la app.
"""

from __future__ import annotations

import io
import json
import math
import shutil
import time
from collections.abc import Callable
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .ajustes import leer_ajustes
from .app import (
    ClienteApp,
    Hecho,
    OriginalPreparado,
    Parametro,
    Parte,
    PropuestaParaApp,
    Trabajo,
)
from .imagen import Foto, guardar_intermedia, leer_intermedia, leer_original, vista_jpeg
from .inspector import Contexto, Inspector
from .linea import aplicar, medir_y_proponer
from .pasos.base import Paso
from .vivo import armar_paquete

# Las carpetas de fotos que no se tocan hace este tiempo se borran solas.
DIAS_EN_LA_MAC = 7


class Cancelado(Exception):
    """La app avisó que el paso ya no es de este intento: se rehízo o se sacó la foto."""


def a_json(valor):
    """Lo medido, en tipos que entiende JSON: sin números de numpy ni NaN."""
    if isinstance(valor, dict):
        return {str(k): a_json(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [a_json(v) for v in valor]
    if isinstance(valor, np.generic):
        valor = valor.item()
    if isinstance(valor, float) and not math.isfinite(valor):
        return None
    if isinstance(valor, (str, int, float, bool)) or valor is None:
        return valor
    return str(valor)


class CarpetaDeFoto:
    """Los archivos de una foto en la Mac: el original, sus datos y la salida de cada paso."""

    def __init__(self, raiz: Path, foto: str):
        self.dir = raiz / foto
        self.dir.mkdir(parents=True, exist_ok=True)
        # Se marca como usada: la limpieza borra las viejas.
        self.dir.touch()

    def original(self, nombre: str) -> Path:
        return self.dir / f"original{Path(nombre).suffix.lower()}"

    def salida(self, corrida: str) -> Path:
        return self.dir / f"salida-{corrida}.png"

    @property
    def datos(self) -> Path:
        return self.dir / "datos.json"

    def limpiar(self, vigentes: set[str]) -> None:
        """Borra la salida de los pasos que se rehicieron: ya no sirven."""
        for f in self.dir.glob("salida-*.png"):
            if f.stem.removeprefix("salida-") not in vigentes:
                f.unlink(missing_ok=True)


def limpiar_viejas(raiz: Path, dias: int = DIAS_EN_LA_MAC) -> None:
    if not raiz.exists():
        return
    limite = time.time() - dias * 86400
    for d in raiz.iterdir():
        if d.is_dir() and d.stat().st_mtime < limite:
            shutil.rmtree(d, ignore_errors=True)


def _foto_original(trabajo: Trabajo, carpeta: CarpetaDeFoto, cliente: ClienteApp) -> tuple[Foto, list[str]]:
    ruta = carpeta.original(trabajo.original.nombre)
    if not ruta.exists():
        cliente.bajar(trabajo.original.bajar, ruta)
    foto, avisos = leer_original(ruta)
    carpeta.datos.write_text(json.dumps(a_json(foto.datos), ensure_ascii=False))
    return foto, avisos


def _como_en_disco(foto: Foto) -> Foto:
    """La foto tal como queda al guardarla y leerla: así rearmada da lo mismo que leída de la Mac."""

    def q(x: np.ndarray) -> np.ndarray:
        return np.round(np.clip(x, 0, 1) * 65535).astype(np.uint16).astype(np.float32) / 65535.0

    return Foto(rgb=q(foto.rgb), alfa=None if foto.alfa is None else q(foto.alfa), datos=foto.datos)


def foto_de_entrada(
    trabajo: Trabajo, pasos: list[Paso], carpeta: CarpetaDeFoto, cliente: ClienteApp, cancelado: Callable[[], bool]
) -> tuple[Foto, list[str]]:
    """La foto que entra al paso: la salida del último paso hecho, o el original. Si falta, se rearma con la receta."""
    hechos = trabajo.receta
    datos = json.loads(carpeta.datos.read_text()) if carpeta.datos.exists() else None
    # La salida más reciente que quedó en la Mac.
    desde = len(hechos)
    while desde > 0 and not carpeta.salida(hechos[desde - 1].id).exists():
        desde -= 1
    if desde > 0 and datos is not None and desde == len(hechos):
        return leer_intermedia(carpeta.salida(hechos[-1].id), datos), []
    if desde > 0 and datos is not None:
        foto, avisos = leer_intermedia(carpeta.salida(hechos[desde - 1].id), datos), []
    else:
        foto, avisos = _foto_original(trabajo, carpeta, cliente)
        desde = 0
    # Se rehacen los pasos que faltan, con los ajustes y valores que se aprobaron.
    por_clave = {p.clave: p for p in pasos}
    for r in hechos[desde:]:
        ajustes = leer_ajustes(r.ajustes)
        for parte in r.partes:
            if cancelado():
                raise Cancelado()
            if not parte.aplicado:
                continue
            paso = por_clave[parte.paso]
            medicion = paso.medir(foto, ajustes)
            valores, _ = paso.limitar(parte.valores, ajustes)
            resultado = paso.aplicar(foto, valores, ajustes, medicion)
            if not resultado.salteado:
                foto = resultado.foto
        guardar_intermedia(foto, carpeta.salida(r.id))
        foto = _como_en_disco(foto)
    return foto, avisos


def _parametros(paso: Paso, ajustes: dict) -> list[Parametro]:
    """Los valores que se pueden editar en la pantalla, con el rango que dejan los topes."""
    return [
        Parametro(
            clave=x.clave,
            etiqueta=x.etiqueta,
            ayuda=x.ayuda,
            minimo=x.rango(ajustes)[0],
            maximo=x.rango(ajustes)[1],
            defecto=paso._ajustar_defecto(x, ajustes),
            paso=x.paso,
            unidad=x.unidad,
            tipo=x.tipo,
        )
        for x in paso.parametros
    ]


def _vista_del_final(jpg: bytes, lado: int = 1600) -> bytes:
    """En Exportar se muestra el JPG final, con su fondo, en lugar de la transparencia a cuadros."""
    im = Image.open(io.BytesIO(jpg))
    im.thumbnail((lado, lado), Image.Resampling.LANCZOS)
    salida = io.BytesIO()
    im.convert("RGB").save(salida, "JPEG", quality=85, subsampling=0, optimize=True)
    return salida.getvalue()


def _png_de_mascara(alfa: np.ndarray) -> bytes:
    ok, datos = cv2.imencode(".png", np.round(np.clip(alfa, 0, 1) * 65535).astype(np.uint16), [cv2.IMWRITE_PNG_COMPRESSION, 3])
    if not ok:
        raise OSError("No se pudo armar la silueta.")
    return datos.tobytes()


def contexto_de(trabajo: Trabajo) -> Contexto:
    """Lo que Claude sabe de la foto: qué es la pieza, el paso del protocolo con sus indicaciones y la indicación de esta corrida."""
    protocolo = trabajo.foto_del_protocolo
    return Contexto(
        producto=trabajo.producto,
        foto=protocolo.titulo if protocolo else None,
        indicaciones=protocolo.indicaciones if protocolo else None,
        indicacion=trabajo.indicacion,
    )


def procesar(
    trabajo: Trabajo,
    pasos: list[Paso],
    inspector: Inspector,
    cliente: ClienteApp,
    raiz: Path,
    cancelado: Callable[[], bool] = lambda: False,
) -> Hecho:
    inicio = time.monotonic()
    por_clave = {p.clave: p for p in pasos}
    for clave in trabajo.pasos:
        if clave not in por_clave:
            raise ValueError(f"La app pidió el ajuste «{clave}», que este trabajador no conoce: hay que actualizarlo.")
    carpeta = CarpetaDeFoto(raiz, trabajo.foto)
    carpeta.limpiar({r.id for r in trabajo.receta} | {trabajo.id})
    entrada, avisos = foto_de_entrada(trabajo, pasos, carpeta, cliente, cancelado)
    foto = entrada

    ajustes = leer_ajustes(trabajo.ajustes)
    pedidos = trabajo.pedidos
    partes: list[Parte] = []
    finales: dict[str, bytes] = {}
    mascara = None
    for clave in trabajo.pasos:
        if cancelado():
            raise Cancelado()
        paso = por_clave[clave]
        comienzo = time.monotonic()
        parametros = _parametros(paso, ajustes)
        # La sombra arranca apagada si la cuenta lo pide; al rehacer manda lo que se eligió.
        apagado_por_ajustes = pedidos is None and clave == "sombra" and not ajustes["con_sombra"]
        if (pedidos and clave in pedidos.apagados) or apagado_por_ajustes:
            partes.append(
                Parte(paso=clave, aplicado=False, no_aplica=None, propuesta=None, valores={}, medidas={}, parametros=parametros, nota=None, uso_claude=None, segundos=0)
            )
            continue
        pedidos_del_ajuste = pedidos.valores.get(clave) if pedidos else None
        if pedidos_del_ajuste is not None:
            # La persona pidió valores: se aplican sin volver a preguntarle a Claude.
            medicion = paso.medir(foto, ajustes)
            corrida = aplicar(paso, foto, ajustes, medicion, None, pedidos=pedidos_del_ajuste)
        else:
            medicion, propuesta = medir_y_proponer(paso, foto, ajustes, inspector, contexto_de(trabajo))
            corrida = aplicar(paso, foto, ajustes, medicion, propuesta)
        resultado = corrida.resultado
        receta = corrida.receta()
        p = corrida.propuesta
        # Los avisos de la foto original van con el primer ajuste.
        nota = " ".join(n for n in [*(avisos if not partes else []), receta["nota"] or ""] if n) or None
        partes.append(
            Parte(
                paso=clave,
                aplicado=not resultado.salteado,
                no_aplica=medicion.no_aplica,
                propuesta=None if p is None else PropuestaParaApp(valores=p.valores, razon=p.razon, origen=p.origen, aviso=p.aviso),
                valores={k: float(v) for k, v in resultado.valores.items()},
                medidas=a_json(receta["medidas"]),
                parametros=parametros,
                nota=nota,
                uso_claude=None if p is None or not p.uso else a_json(p.uso),
                segundos=round(time.monotonic() - comienzo, 1),
            )
        )
        if not resultado.salteado:
            foto = resultado.foto
        if resultado.mascara is not None:
            mascara = resultado.mascara
        finales.update(resultado.archivos)
    if cancelado():
        raise Cancelado()
    guardar_intermedia(foto, carpeta.salida(trabajo.id))

    archivos: dict[str, bytes] = {}
    if trabajo.indice == 0:
        archivos["antes"] = vista_jpeg(entrada)
    archivos["vista"] = _vista_del_final(finales["final.jpg"]) if "final.jpg" in finales else vista_jpeg(foto)
    if mascara is not None:
        archivos["mascara"] = _png_de_mascara(mascara)
    if "final.png" in finales:
        archivos["png"] = finales["final.png"]
    if "final.jpg" in finales:
        archivos["jpg"] = finales["final.jpg"]
    if "vivo" in trabajo.subidas:
        archivos["vivo"] = armar_paquete(entrada, por_clave.get("lente"), ajustes, mascara)
    for tipo, contenido in archivos.items():
        destino = trabajo.subidas.get(tipo)  # type: ignore[call-overload]
        if destino is None:
            raise ValueError(f"La app no dio permiso para subir «{tipo}».")
        cliente.subir(destino, contenido)

    return Hecho(
        id=trabajo.id,
        turno=trabajo.turno,
        partes=partes,
        segundos=round(time.monotonic() - inicio, 1),
        archivos=list(archivos),  # type: ignore[arg-type]
        original=OriginalPreparado(ancho=entrada.ancho, alto=entrada.alto, camara=a_json(entrada.datos.get("camara")))
        if trabajo.indice == 0
        else None,
    )
