"""El plan de edición de un video: cómo queda la imagen y a qué velocidad va cada tramo.

El plan es lo que propone Claude y aprueba la persona. El programa solo lo
aplica: con el mismo plan y el mismo original sale siempre el mismo clip.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field, model_validator

from .medios import Fuente


@dataclass(frozen=True)
class ReglasDelClip:
    """Lo que pide el canal para un clip. Las de Mercado Libre están en src/channels/mercadolibre/clips.ts."""

    min_segundos: float = 10.0
    max_segundos: float = 60.0
    ancho: int = 1080
    alto: int = 1920
    max_bytes: int = 280 * 1024**2


MERCADOLIBRE = ReglasDelClip()

VELOCIDAD_MIN = 0.5
VELOCIDAD_MAX = 12.0


class Imagen(BaseModel):
    """La corrección de imagen, una sola para todo el video porque la cámara está fija."""

    # Cuartos de vuelta en sentido horario, de 0 a 3, para dejarlo vertical y derecho.
    cuartos: int = Field(default=0, ge=0, le=3)
    # Giro fino en grados, en sentido horario, por si la cámara quedó torcida.
    enderezado: float = Field(default=0.0, ge=-8.0, le=8.0)
    # Acercamiento y hacia dónde: 0 es el borde izquierdo o de arriba, 1 el opuesto.
    zoom: float = Field(default=1.0, ge=1.0, le=2.5)
    centro_x: float = Field(default=0.5, ge=0.0, le=1.0)
    centro_y: float = Field(default=0.5, ge=0.0, le=1.0)
    # Balance de blancos y luz: cuánto se multiplica cada color.
    rojo: float = Field(default=1.0, ge=0.6, le=1.6)
    verde: float = Field(default=1.0, ge=0.6, le=1.6)
    azul: float = Field(default=1.0, ge=0.6, le=1.6)
    contraste: float = Field(default=1.0, ge=0.8, le=1.3)
    saturacion: float = Field(default=1.0, ge=0.5, le=1.5)


class Tramo(BaseModel):
    """Un pedazo del original, en segundos del original, y a qué velocidad va."""

    inicio: float = Field(ge=0.0)
    fin: float = Field(gt=0.0)
    velocidad: float = Field(default=1.0, ge=VELOCIDAD_MIN, le=VELOCIDAD_MAX)
    nombre: str = ""

    @model_validator(mode="after")
    def _ordenado(self) -> Tramo:
        if self.fin - self.inicio < 0.2:
            raise ValueError("Un tramo tiene que durar al menos 0,2 segundos.")
        return self

    @property
    def dura(self) -> float:
        return (self.fin - self.inicio) / self.velocidad


class Plan(BaseModel):
    imagen: Imagen = Field(default_factory=Imagen)
    tramos: list[Tramo] = Field(min_length=1, max_length=60)
    # Segundos de imagen quieta al final, con el último cuadro.
    cierre: float = Field(default=0.0, ge=0.0, le=6.0)

    @model_validator(mode="after")
    def _sin_pisarse(self) -> Plan:
        for antes, despues in zip(self.tramos, self.tramos[1:]):
            if despues.inicio < antes.fin - 1e-6:
                raise ValueError("Los tramos tienen que ir en orden y sin pisarse.")
        return self

    @property
    def dura(self) -> float:
        return sum(t.dura for t in self.tramos) + self.cierre


def revisar(plan: Plan, fuente: Fuente, reglas: ReglasDelClip = MERCADOLIBRE) -> list[str]:
    """Lo que impide exportar el plan. Vacío: se puede."""
    problemas = []
    if plan.tramos[-1].fin > fuente.duracion + 0.05:
        problemas.append(f"El plan llega al segundo {plan.tramos[-1].fin:g} y el video dura {fuente.duracion:.1f}.")
    if plan.dura < reglas.min_segundos:
        problemas.append(f"El clip quedaría de {plan.dura:.1f} segundos y el mínimo es {reglas.min_segundos:g}.")
    if plan.dura > reglas.max_segundos:
        problemas.append(f"El clip quedaría de {plan.dura:.1f} segundos y el máximo es {reglas.max_segundos:g}.")
    return problemas


def plan_parejo(fuente: Fuente, imagen: Imagen | None = None, objetivo: float = 45.0, reglas: ReglasDelClip = MERCADOLIBRE) -> Plan:
    """Todo el video a una sola velocidad, la que hace falta para que dure lo pedido."""
    objetivo = min(max(objetivo, reglas.min_segundos), reglas.max_segundos)
    velocidad = max(1.0, fuente.duracion / objetivo)
    if velocidad > VELOCIDAD_MAX:
        raise ValueError(f"El video dura {fuente.duracion:.0f} segundos: es muy largo para llevarlo a {objetivo:g}.")
    if fuente.duracion / velocidad < reglas.min_segundos:
        raise ValueError(f"El video dura {fuente.duracion:.1f} segundos y el mínimo del clip es {reglas.min_segundos:g}.")
    return Plan(imagen=imagen or Imagen(), tramos=[Tramo(inicio=0.0, fin=round(fuente.duracion, 3), velocidad=round(velocidad, 4), nombre="Todo")])
