"""Corre un paso: mide, le pide valores a Claude, los limita y aplica.

Lo usan la prueba en la terminal y, más adelante, el trabajador conectado a la app.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .imagen import Foto
from .inspector import Contexto, Inspector, Propuesta
from .pasos.base import Medicion, Paso, Resultado


@dataclass
class Corrida:
    paso: Paso
    medicion: Medicion
    resultado: Resultado
    propuesta: Propuesta | None
    # Avisos de valores que pasaban su tope.
    avisos: list[str] = field(default_factory=list)
    segundos: float = 0.0

    def receta(self) -> dict:
        """Lo que se guarda de este paso: alcanza para rehacerlo igual desde el original."""
        p = self.propuesta
        return {
            "paso": self.paso.clave,
            "nombre": self.paso.nombre,
            "salteado": self.resultado.salteado,
            "valores": self.resultado.valores,
            "propuesta": None if p is None else {"valores": p.valores, "razon": p.razon, "origen": p.origen},
            "medidas": {**self.medicion.medidas, **self.resultado.medidas},
            "nota": " ".join(dict.fromkeys(n for n in [self.medicion.no_aplica if self.resultado.salteado else None, self.resultado.nota, *self.avisos] if n))
            or None,
            "uso_claude": None if p is None else p.uso,
            "segundos": round(self.segundos, 1),
        }


def medir_y_proponer(
    paso: Paso, foto: Foto, ajustes: dict, inspector: Inspector, contexto: Contexto | str | None = None
) -> tuple[Medicion, Propuesta | None]:
    medicion = paso.medir(foto, ajustes)
    if medicion.no_aplica:
        return medicion, None
    vista = paso.vista_para_claude(foto, medicion)
    return medicion, inspector.proponer(paso, vista, medicion, ajustes, contexto)


def aplicar(
    paso: Paso, foto: Foto, ajustes: dict, medicion: Medicion, propuesta: Propuesta | None, pedidos: dict | None = None
) -> Corrida:
    """Aplica con los valores pedidos por la persona, o si no, con los de la propuesta."""
    inicio = time.monotonic()
    if medicion.no_aplica:
        resultado = paso.aplicar(foto, {}, ajustes, medicion)
        return Corrida(paso, medicion, resultado, propuesta, [], time.monotonic() - inicio)
    base = pedidos if pedidos is not None else (propuesta.valores if propuesta else medicion.sugeridos)
    valores, avisos = paso.limitar(base, ajustes)
    resultado = paso.aplicar(foto, valores, ajustes, medicion)
    return Corrida(paso, medicion, resultado, propuesta, avisos, time.monotonic() - inicio)


def saltear(paso: Paso, foto: Foto, medicion: Medicion, propuesta: Propuesta | None) -> Corrida:
    resultado = Resultado(foto=foto, valores={}, nota="Paso salteado a pedido.", salteado=True)
    return Corrida(paso, medicion, resultado, propuesta)
