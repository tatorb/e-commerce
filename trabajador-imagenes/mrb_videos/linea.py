"""La edición completa de un video, de punta a punta.

1. Mide y decide la imagen: cómo girar, la luz y el color.
2. Dice el guión: llega ya escrito y revisado, y ElevenLabs lo dice. Así se sabe cuánto dura la voz.
3. Arma el plan: Claude marca los momentos del video y el código les da su velocidad, para que el clip
   dure lo pedido o, si la voz es más larga, lo que dura la voz.
4. Reparte la voz a lo largo del clip, hace la música, mezcla y dibuja los subtítulos.
5. Exporta el clip.

El video se acomoda al guión, y no al revés: la voz no relata lo que se ve.

Cada parte que falla deja su aviso y la edición sigue con lo que hay: sin
Claude, el video va a una sola velocidad; sin guión o sin ElevenLabs, sale sin
voz. El clip se entrega igual y la persona decide.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from . import hojas
from .cortes import Momento, plan_de_cortes
from .editar import Clip, exportar
from .inspector import Contexto, InspectorDeVideo, mosaico, proponer_cortes
from .medios import Cancelado, Fuente, VideoIlegible
from .medir import Medidas, cuadros, medir
from .plan import MERCADOLIBRE, Imagen, Plan, ReglasDelClip, plan_parejo
from .sonido import ElevenLabs, Linea, SinElevenLabs, Subtitulos, decir_guion, largo_de_la_voz, mezclar, subtitulos, ubicar, volumen

log = logging.getLogger("trabajador")

# Cada cuánto se saca un cuadro para que Claude marque los cortes, y cuántos como mucho.
CUADRO_CADA_S = 2.0
CUADROS_MAX = 80
# Lo que se puede estirar el cierre para que entre la última línea de la voz.
CIERRE_MAX = 6.0


@dataclass
class Pedido:
    objetivo: float = 45.0
    reglas: ReglasDelClip = MERCADOLIBRE
    contexto: Contexto = field(default_factory=Contexto)
    # El plan que pidió la persona: se aplica tal cual.
    plan: Plan | None = None
    # Los momentos del video según el protocolo: [{texto, importancia}].
    momentos: list[dict] = field(default_factory=list)
    # Los cortes ya marcados, para probar sin consultar a Claude: [{inicio, fin, importancia, nombre}].
    cortes: list[dict] | None = None
    # El guión del clip, ya escrito y revisado: las frases que dice la voz, en orden.
    guion: list[str] | None = None
    voz: str | None = None
    musica: str | None = None
    subtitulos: bool = False
    # El color de la palabra que se está diciendo, como "#6FA82C". None: el de siempre.
    color_subtitulos: str | None = None
    # El giro que se usa si Claude no decide la imagen.
    cuartos: int = 0


@dataclass
class Resultado:
    plan: Plan
    medidas: Medidas
    razon: str
    origen: str
    clip: Clip
    guion: list[Linea] = field(default_factory=list)
    con_musica: bool = False
    con_subtitulos: bool = False
    avisos: list[str] = field(default_factory=list)
    costo_usd: float = 0.0
    volumen_lufs: float | None = None


def _costo(uso: dict | None) -> float:
    return float((uso or {}).get("costo_usd") or 0)


def _frenar(cancelado: Callable[[], bool]) -> None:
    if cancelado():
        raise Cancelado()


def armar(
    fuente: Fuente,
    mirar: Fuente,
    pedido: Pedido,
    inspector: InspectorDeVideo,
    carpeta: Path,
    salida: Path,
    cancelado: Callable[[], bool] = lambda: False,
    eleven: Callable[[], ElevenLabs] = ElevenLabs.desde_entorno,
    informar: Callable[[str, float | None], None] = lambda etapa, porcentaje=None: None,
) -> Resultado:
    """`informar` recibe en qué anda, en palabras, y cuánto lleva de esa etapa, de 0 a 100, si se sabe."""
    carpeta.mkdir(parents=True, exist_ok=True)
    informar("Midiendo la luz y el color", None)
    medidas = medir(cuadros(mirar))
    avisos = list(medidas.avisos)
    costo = 0.0
    reglas = pedido.reglas

    # 1. La imagen.
    if pedido.plan:
        imagen, razon, origen = pedido.plan.imagen, "Se aplicó el plan pedido, sin consultar a Claude.", "pedido"
    else:
        informar("Claude mira la imagen", None)
        p = inspector.proponer(mosaico(mirar), medidas, pedido.contexto, cuartos=pedido.cuartos)
        avisos += list(p.avisos)
        costo += _costo(p.uso)
        imagen, razon, origen = p.imagen, p.razon, p.origen
    _frenar(cancelado)

    # 2. La voz: primero se dice el guión, para saber cuánto dura.
    dichas: list[Linea] = []
    cliente: ElevenLabs | None = None
    sin_eleven = False
    if pedido.voz or pedido.musica:
        try:
            cliente = eleven()
            if pedido.voz and not pedido.guion:
                avisos.append("El clip salió sin voz: el producto todavía no tiene guión. Se escribe en el paso Videos, en Guión del clip.")
            elif pedido.voz:
                dichas = decir_guion(cliente, pedido.guion or [], pedido.voz, carpeta / "voz", cancelado, informar)
        except SinElevenLabs as e:
            log.info(str(e))
            avisos.append(f"El clip salió sin sonido. {e}")
            dichas, sin_eleven = [], True
    # Si la voz no entra ni en el clip más largo que acepta el canal, las últimas frases no se dicen.
    todas = len(dichas)
    while dichas and largo_de_la_voz(dichas) > reglas.max_segundos:
        dichas = dichas[:-1]
    _frenar(cancelado)

    # 3. El plan: el clip dura lo pedido o, si la voz es más larga, lo que dura la voz.
    objetivo = min(max(pedido.objetivo, largo_de_la_voz(dichas)), reglas.max_segundos)
    if pedido.plan:
        plan = pedido.plan
    else:
        marcados = pedido.cortes
        if marcados is None:
            informar("Claude marca los cortes", None)
            cada = max(CUADRO_CADA_S, math.ceil(mirar.duracion / CUADROS_MAX))
            archivos = hojas.armar(mirar, carpeta / "hojas", cada=cada, cuartos=imagen.cuartos)
            c = proponer_cortes(inspector, [a.read_bytes() for a in archivos], fuente.duracion, cada, pedido.momentos, pedido.contexto, objetivo)
            if c is not None:
                avisos += list(c.avisos)
                costo += _costo(c.uso)
                marcados = c.momentos or None
                if marcados:
                    razon = f"{razon} {c.razon}".strip()
        if marcados:
            momentos = [Momento(float(m["inicio"]), float(m["fin"]), str(m.get("importancia") or "NORMAL"), str(m.get("nombre") or "")) for m in marcados]
            plan, de_velocidades = plan_de_cortes(momentos, fuente.duracion, imagen, objetivo, reglas)
            avisos += de_velocidades
        else:
            plan = plan_parejo(fuente, imagen, objetivo, reglas)
    # Un video corto, o un plan pedido a mano, puede durar menos que la voz: se estira la imagen quieta del
    # final y, si ni así entra, las últimas frases no se dicen.
    falta = largo_de_la_voz(dichas) - plan.dura
    if falta > 0:
        cierre = min(CIERRE_MAX, plan.cierre + falta, max(plan.cierre, reglas.max_segundos - (plan.dura - plan.cierre)))
        plan = plan.model_copy(update={"cierre": round(cierre, 3)})
        while dichas and largo_de_la_voz(dichas) > plan.dura + 0.05:
            dichas = dichas[:-1]
    if len(dichas) < todas:
        avisos.append(
            f"El guión es largo para este clip: no se dicen las últimas {todas - len(dichas)} frases."
            if todas - len(dichas) > 1
            else "El guión es largo para este clip: no se dice la última frase."
        )
    if dichas and plan.dura > pedido.objetivo + 1:
        avisos.append(f"El clip dura {plan.dura:.0f} segundos y se pidió de {pedido.objetivo:g}: el guión necesita ese tiempo.")
    _frenar(cancelado)

    # 4. El sonido: la voz repartida a lo largo del clip, la música y los subtítulos.
    dichas = ubicar(dichas, plan.dura)
    pista: Path | None = None
    escrito: Subtitulos | None = None
    con_musica = False
    if cliente is not None and not sin_eleven:
        try:
            archivo_musica = None
            if pedido.musica:
                informar("Generando la música", None)
                archivo_musica = carpeta / "musica.mp3"
                archivo_musica.write_bytes(cliente.musica(pedido.musica, plan.dura))
                con_musica = True
            if dichas or archivo_musica:
                informar("Mezclando el sonido", None)
                pista = mezclar(dichas, archivo_musica, plan.dura, carpeta / "sonido.wav", cancelado)
            if pedido.subtitulos and dichas:
                informar("Dibujando los subtítulos", None)
                escrito = subtitulos(dichas, carpeta / "subtitulos", plan.dura, reglas.ancho, reglas.alto, pedido.color_subtitulos)
        except SinElevenLabs as e:
            # La música falló: si la voz ya está, el clip sale con la voz sola.
            log.info(str(e))
            avisos.append(f"El clip salió sin música. {e}")
            con_musica = False
            if dichas:
                pista = mezclar(dichas, None, plan.dura, carpeta / "sonido.wav", cancelado)
                if pedido.subtitulos:
                    escrito = subtitulos(dichas, carpeta / "subtitulos", plan.dura, reglas.ancho, reglas.alto, pedido.color_subtitulos)
    _frenar(cancelado)

    # 5. El clip.
    informar("Exportando el clip", 0)
    al_exportar = lambda parte: informar("Exportando el clip", 100 * parte)  # noqa: E731
    try:
        clip = exportar(
            fuente, plan, salida, reglas=reglas, cancelado=cancelado, sonido=pista,
            subtitulos=escrito.lista if escrito else None, subtitulos_y=escrito.y if escrito else 0, avance=al_exportar,
        )
    except VideoIlegible as e:
        if escrito is None:
            raise
        # Si lo que falló son los subtítulos, el clip sale igual, sin ellos, y lo avisa.
        log.info(f"No se pudo exportar con subtítulos ({e}): se exporta sin ellos.")
        clip = exportar(fuente, plan, salida, reglas=reglas, cancelado=cancelado, sonido=pista, subtitulos=None, avance=al_exportar)
        avisos.append("El clip salió sin subtítulos: ffmpeg no los pudo escribir.")
        escrito = None
    avisos += list(clip.avisos)
    return Resultado(
        plan=plan,
        medidas=medidas,
        razon=razon,
        origen=origen,
        clip=clip,
        guion=dichas,
        con_musica=con_musica,
        con_subtitulos=escrito is not None,
        avisos=avisos,
        costo_usd=round(costo, 5),
        volumen_lufs=volumen(clip.ruta) if pista else None,
    )
