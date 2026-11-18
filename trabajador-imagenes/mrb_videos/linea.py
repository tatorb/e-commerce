"""La edición completa de un video, de punta a punta.

1. Mide y decide la imagen: cómo girar, la luz y el color.
2. Arma el plan: Claude marca los momentos del video y el código les da su velocidad.
3. Pone el sonido: Claude escribe el guión, ElevenLabs lo dice y hace la música, y se mezcla.
4. Exporta el clip.

Cada parte que falla deja su aviso y la edición sigue con lo que hay: sin
Claude, el video va a una sola velocidad y sin voz; sin ElevenLabs, sale en
silencio. El clip se entrega igual y la persona decide.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from . import hojas
from .cortes import Momento, plan_de_cortes, tiempos_en_el_clip
from .editar import Clip, exportar
from .inspector import Contexto, InspectorDeVideo, escribir_guion, mosaico, palabras_que_entran, proponer_cortes
from .medios import Cancelado, Fuente, VideoIlegible
from .medir import Medidas, cuadros, medir
from .plan import MERCADOLIBRE, Imagen, Plan, ReglasDelClip, plan_parejo
from .sonido import ElevenLabs, Linea, SinElevenLabs, Subtitulos, decir_guion, mezclar, subtitulos, volumen

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
    ficha: str | None = None
    # El guión pedido, una línea por tramo.
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

    # 1 y 2. La imagen y el plan.
    if pedido.plan:
        plan, razon, origen = pedido.plan, "Se aplicó el plan pedido, sin consultar a Claude.", "pedido"
    else:
        informar("Claude mira la imagen", None)
        p = inspector.proponer(mosaico(mirar), medidas, pedido.contexto, cuartos=pedido.cuartos)
        avisos += list(p.avisos)
        costo += _costo(p.uso)
        razon, origen = p.razon, p.origen
        _frenar(cancelado)
        marcados = pedido.cortes
        if marcados is None:
            informar("Claude marca los cortes", None)
            cada = max(CUADRO_CADA_S, math.ceil(mirar.duracion / CUADROS_MAX))
            archivos = hojas.armar(mirar, carpeta / "hojas", cada=cada, cuartos=p.imagen.cuartos)
            c = proponer_cortes(inspector, [a.read_bytes() for a in archivos], fuente.duracion, cada, pedido.momentos, pedido.contexto, pedido.objetivo)
            if c is not None:
                avisos += list(c.avisos)
                costo += _costo(c.uso)
                marcados = c.momentos or None
                if marcados:
                    razon = f"{razon} {c.razon}".strip()
        if marcados:
            momentos = [Momento(float(m["inicio"]), float(m["fin"]), str(m.get("importancia") or "NORMAL"), str(m.get("nombre") or "")) for m in marcados]
            plan, de_velocidades = plan_de_cortes(momentos, fuente.duracion, p.imagen, pedido.objetivo, pedido.reglas)
            avisos += de_velocidades
        else:
            plan = plan_parejo(fuente, p.imagen, pedido.objetivo, pedido.reglas)
    _frenar(cancelado)

    # 3. El sonido.
    dichas: list[Linea] = []
    pista: Path | None = None
    escrito: Subtitulos | None = None
    con_musica = False
    if pedido.voz or pedido.musica:
        try:
            cliente = eleven()
            if pedido.voz:
                if not pedido.guion:
                    informar("Claude escribe el guión", None)
                lineas, de_guion, costo_guion = _guion(pedido, plan, mirar, inspector)
                avisos += de_guion
                costo += costo_guion
                _frenar(cancelado)
                if lineas:
                    dichas = decir_guion(cliente, lineas, tiempos_en_el_clip(plan), pedido.voz, carpeta / "voz", cancelado, informar)
                    plan, dichas, de_largo = _que_entre(plan, dichas, pedido.reglas)
                    avisos += de_largo
            archivo_musica = None
            if pedido.musica:
                _frenar(cancelado)
                informar("Generando la música", None)
                archivo_musica = carpeta / "musica.mp3"
                archivo_musica.write_bytes(cliente.musica(pedido.musica, plan.dura))
                con_musica = True
            if dichas or archivo_musica:
                informar("Mezclando el sonido", None)
                pista = mezclar(dichas, archivo_musica, plan.dura, carpeta / "sonido.wav", cancelado)
            if pedido.subtitulos and dichas:
                informar("Dibujando los subtítulos", None)
                escrito = subtitulos(dichas, carpeta / "subtitulos", plan.dura, pedido.reglas.ancho, pedido.reglas.alto, pedido.color_subtitulos)
        except SinElevenLabs as e:
            log.info(str(e))
            avisos.append(f"El clip salió sin sonido. {e}")
            dichas, pista, escrito, con_musica = [], None, None, False
    _frenar(cancelado)

    # 4. El clip.
    informar("Exportando el clip", 0)
    al_exportar = lambda parte: informar("Exportando el clip", 100 * parte)  # noqa: E731
    try:
        clip = exportar(
            fuente, plan, salida, reglas=pedido.reglas, cancelado=cancelado, sonido=pista,
            subtitulos=escrito.lista if escrito else None, subtitulos_y=escrito.y if escrito else 0, avance=al_exportar,
        )
    except VideoIlegible as e:
        if escrito is None:
            raise
        # Si lo que falló son los subtítulos, el clip sale igual, sin ellos, y lo avisa.
        log.info(f"No se pudo exportar con subtítulos ({e}): se exporta sin ellos.")
        clip = exportar(fuente, plan, salida, reglas=pedido.reglas, cancelado=cancelado, sonido=pista, subtitulos=None, avance=al_exportar)
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


def _guion(pedido: Pedido, plan: Plan, mirar: Fuente, inspector: InspectorDeVideo) -> tuple[list[str], list[str], float]:
    """Las líneas a decir, una por tramo: las pedidas, o las que escribe Claude."""
    n = len(plan.tramos)
    if pedido.guion:
        return (list(pedido.guion) + [""] * n)[:n], [], 0.0
    tiempos = tiempos_en_el_clip(plan)
    tramos = [
        {"nombre": t.nombre, "segundos": fin - inicio, "palabras": palabras_que_entran(fin - inicio), "velocidad": t.velocidad}
        for t, (inicio, fin) in zip(plan.tramos, tiempos)
    ]
    # El último tramo suma el cierre: la voz puede seguir sobre la imagen quieta.
    tramos[-1]["segundos"] += plan.cierre
    tramos[-1]["palabras"] = palabras_que_entran(tramos[-1]["segundos"])
    vista = hojas.de_tramos(mirar, [(t.inicio + t.fin) / 2 for t in plan.tramos], cuartos=plan.imagen.cuartos)
    g = escribir_guion(inspector, vista, tramos, pedido.ficha, pedido.contexto)
    if g is None:
        return [], ["Sin Claude no hay guión: el clip sale sin voz en off."], 0.0
    return g.lineas, list(g.avisos), _costo(g.uso)


def _que_entre(plan: Plan, dichas: list[Linea], reglas: ReglasDelClip) -> tuple[Plan, list[Linea], list[str]]:
    """Si la voz termina después del clip, estira el cierre; lo que ni así entra, no se dice."""
    if not dichas:
        return plan, dichas, []
    falta = dichas[-1].fin + 0.4 - plan.dura
    if falta > 0:
        cierre = min(CIERRE_MAX, plan.cierre + falta, max(plan.cierre, reglas.max_segundos - (plan.dura - plan.cierre)))
        plan = plan.model_copy(update={"cierre": round(cierre, 3)})
    entran = [linea for linea in dichas if linea.fin <= plan.dura - 0.1]
    avisos = []
    if len(entran) < len(dichas):
        avisos.append("La voz en off no entró entera en el clip: las últimas líneas no se dicen. Conviene acortar el guión o pedir un clip más largo.")
    return plan, entran, avisos
