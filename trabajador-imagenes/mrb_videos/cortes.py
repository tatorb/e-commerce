"""De los momentos del video a las velocidades.

Claude mira el video y dice dónde empieza y termina cada momento y qué tan
importante es. El código decide las velocidades: lo importante va a velocidad
normal, lo normal se acelera y lo repetido va lo más rápido, lo justo para
que el clip dure lo pedido. Así la duración sale siempre dentro de lo que
acepta el canal, proponga lo que proponga Claude.
"""

from __future__ import annotations

from dataclasses import dataclass

from .plan import MERCADOLIBRE, VELOCIDAD_MAX, Imagen, Plan, ReglasDelClip, Tramo

IMPORTANTE = "IMPORTANTE"
NORMAL = "NORMAL"
REPETIDO = "REPETIDO"
NIVELES = (IMPORTANTE, NORMAL, REPETIDO)

# Lo repetido va tantas veces más rápido que lo normal.
REPETIDO_SOBRE_NORMAL = 2.5
# Lo que no es importante se acelera al menos esto, para que se note la diferencia.
MINIMO_ACELERADO = 1.5
# Hasta dónde se acelera lo normal antes de tocar lo importante.
NORMAL_MAX = 6.0
# Si lo importante solo no entra, se acelera hasta acá. Más rápido ya no se ve el detalle.
IMPORTANTE_MAX = 3.0
# Segundos de imagen quieta al final, para que se vea todo junto.
CIERRE = 2.0
# Un momento más corto que esto se suma al de al lado.
TRAMO_MIN = 0.6


@dataclass
class Momento:
    """Un pedazo del original, como lo marcó Claude."""

    inicio: float
    fin: float
    importancia: str = NORMAL
    nombre: str = ""


def ordenar(momentos: list[Momento], duracion: float) -> list[Momento]:
    """Los momentos en orden, pegados uno al otro, cubriendo todo el video. Lo que quedó sin marcar se acelera."""
    limpios = []
    for m in sorted(momentos, key=lambda m: m.inicio):
        inicio, fin = max(0.0, min(m.inicio, duracion)), max(0.0, min(m.fin, duracion))
        if fin - inicio >= 0.1:
            limpios.append(Momento(inicio, fin, m.importancia if m.importancia in NIVELES else NORMAL, m.nombre.strip()[:120]))
    if not limpios:
        return [Momento(0.0, duracion, NORMAL, "Todo")]
    # Cada uno empieza donde termina el anterior: sin huecos ni partes repetidas.
    pegados: list[Momento] = []
    for m in limpios:
        desde = pegados[-1].fin if pegados else 0.0
        if m.fin - desde < 0.1:
            continue
        pegados.append(Momento(desde, m.fin, m.importancia, m.nombre))
    pegados[-1].fin = duracion
    # Los muy cortos se suman al anterior, o al siguiente si es el primero.
    juntos: list[Momento] = []
    for m in pegados:
        if juntos and m.fin - m.inicio < TRAMO_MIN:
            juntos[-1].fin = m.fin
        elif juntos and juntos[-1].fin - juntos[-1].inicio < TRAMO_MIN:
            m.inicio = juntos[-1].inicio
            juntos[-1] = m
        else:
            juntos.append(m)
    return juntos


def _dura(momentos: list[Momento], nivel: str) -> float:
    return sum(m.fin - m.inicio for m in momentos if m.importancia == nivel)


def velocidades(momentos: list[Momento], objetivo: float, reglas: ReglasDelClip = MERCADOLIBRE) -> tuple[dict[str, float], float, list[str]]:
    """La velocidad de cada nivel y el cierre, para que el clip dure lo pedido. Devuelve también los avisos."""
    avisos: list[str] = []
    objetivo = min(max(objetivo, reglas.min_segundos), reglas.max_segundos)
    importante, normal, repetido = (_dura(momentos, n) for n in NIVELES)
    total = importante + normal + repetido
    cierre = CIERRE if total > objetivo else 0.0
    libre = objetivo - cierre

    def resto(v: float) -> float:
        return normal / v + repetido / min(VELOCIDAD_MAX, v * REPETIDO_SOBRE_NORMAL)

    if total <= libre + 1e-6:
        # Entra entero: lo importante queda normal y lo demás apenas acelerado, si sobra lugar para notarlo.
        v = MINIMO_ACELERADO if importante + resto(MINIMO_ACELERADO) >= reglas.min_segundos else 1.0
        return {IMPORTANTE: 1.0, NORMAL: v, REPETIDO: min(VELOCIDAD_MAX, v * REPETIDO_SOBRE_NORMAL) if v > 1 else 1.0}, 0.0, avisos

    v_importante = 1.0
    if importante + resto(NORMAL_MAX) > libre:
        # Ni acelerando todo lo demás al máximo entra: hay que acelerar también lo importante.
        lugar = libre - resto(NORMAL_MAX)
        v_importante = importante / lugar if lugar > 0 else IMPORTANTE_MAX + 1
        if v_importante > IMPORTANTE_MAX:
            # Sigue sin entrar: se usa todo lo que deja el canal.
            libre = reglas.max_segundos - cierre
            lugar = libre - resto(NORMAL_MAX)
            v_importante = importante / lugar if lugar > 0 else VELOCIDAD_MAX + 1
        if v_importante > VELOCIDAD_MAX:
            raise ValueError(f"El video dura {total:.0f} segundos y lo marcado como importante no entra en un clip de {reglas.max_segundos:g}.")
        veces = f"{v_importante:.1f}".replace(".", ",")
        avisos.append(f"Lo importante dura {importante:.0f} segundos y no entra a velocidad normal: va {veces} veces más rápido.")
        v = NORMAL_MAX
    else:
        # Se busca la velocidad de lo normal que deja el clip justo en lo pedido.
        bajo, alto = 1.0, NORMAL_MAX
        for _ in range(40):
            medio = (bajo + alto) / 2
            if importante + resto(medio) > libre:
                bajo = medio
            else:
                alto = medio
        v = max(alto, MINIMO_ACELERADO if normal + repetido > 0 else 1.0)
    return {IMPORTANTE: round(v_importante, 3), NORMAL: round(v, 3), REPETIDO: round(min(VELOCIDAD_MAX, v * REPETIDO_SOBRE_NORMAL), 3)}, cierre, avisos


def plan_de_cortes(momentos: list[Momento], duracion: float, imagen: Imagen, objetivo: float, reglas: ReglasDelClip = MERCADOLIBRE) -> tuple[Plan, list[str]]:
    """El plan completo a partir de lo que marcó Claude."""
    ordenados = ordenar(momentos, duracion)
    por_nivel, cierre, avisos = velocidades(ordenados, objetivo, reglas)
    tramos = [Tramo(inicio=round(m.inicio, 3), fin=round(m.fin, 3), velocidad=por_nivel[m.importancia], nombre=m.nombre, importancia=m.importancia) for m in ordenados]
    plan = Plan(imagen=imagen, tramos=tramos, cierre=cierre)
    if plan.dura < reglas.min_segundos:
        # Un video corto: se frena todo lo necesario para llegar al mínimo no tiene sentido; va entero.
        plan = Plan(imagen=imagen, tramos=[t.model_copy(update={"velocidad": 1.0}) for t in tramos], cierre=min(6.0, max(0.0, reglas.min_segundos - duracion)))
    return plan, avisos


def tiempos_en_el_clip(plan: Plan) -> list[tuple[float, float]]:
    """En qué segundo del clip empieza y termina cada tramo."""
    tiempos, t = [], 0.0
    for tramo in plan.tramos:
        tiempos.append((t, t + tramo.dura))
        t += tramo.dura
    return tiempos
