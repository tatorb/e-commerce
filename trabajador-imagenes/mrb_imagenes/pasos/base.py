"""Lo común a todos los pasos.

Cada paso es una función pura: entra una foto con valores, sale una foto con
medidas. Primero mide, después propone valores a partir de lo medido (Claude
los revisa), y al final aplica. No guarda nada ni habla con la app.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np

from ..imagen import Foto


@dataclass(frozen=True)
class Parametro:
    clave: str
    etiqueta: str
    # Qué hace, en una línea: lo lee Claude y lo muestra la pantalla.
    ayuda: str
    minimo: float
    maximo: float
    defecto: float
    paso: float = 1
    unidad: str = ""
    tipo: Literal["numero", "si_no"] = "numero"
    # El tope de Ajustes que limita este valor, si hay uno.
    tope: str | None = None
    # Si el tope también limita hacia abajo, por ejemplo un giro de -10 a 10.
    simetrico: bool = False

    def rango(self, ajustes: dict) -> tuple[float, float]:
        minimo, maximo = self.minimo, self.maximo
        if self.tope and self.tope in ajustes.get("topes", {}):
            t = float(ajustes["topes"][self.tope])
            maximo = min(maximo, t)
            if self.simetrico:
                minimo = max(minimo, -t)
        return minimo, maximo


@dataclass
class Medicion:
    # Lo que midió el código, para Claude y para la pantalla. Se guarda como JSON.
    medidas: dict[str, Any]
    # Los valores que el código sugiere a partir de lo medido.
    sugeridos: dict[str, float]
    # Si no se puede aplicar, por qué. El paso se salta y lo avisa.
    no_aplica: str | None = None
    # Lo que se calculó y no va al JSON, por ejemplo la máscara del fondo.
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Resultado:
    foto: Foto
    # Los valores con que se aplicó, ya limitados por los topes.
    valores: dict[str, float]
    medidas: dict[str, Any] = field(default_factory=dict)
    # Un aviso para la persona, por ejemplo "el lienzo creció para dejar el margen parejo".
    nota: str | None = None
    salteado: bool = False
    mascara: np.ndarray | None = None
    # Archivos finales: nombre y contenido. Solo el paso Exportar.
    archivos: dict[str, bytes] = field(default_factory=dict)


class Paso:
    clave: str = ""
    nombre: str = ""
    # Qué tiene que mirar Claude en este paso.
    consigna: str = ""
    parametros: tuple[Parametro, ...] = ()
    # Los pasos que cambian el encuadre no se comparan con el deslizador.
    cambia_encuadre: bool = False

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        raise NotImplementedError

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        raise NotImplementedError

    # La foto que mira Claude: por defecto la de entrada; el paso Fondo muestra el recorte provisorio.
    def vista_para_claude(self, foto: Foto, medicion: Medicion) -> Foto:
        return foto

    def defectos(self, ajustes: dict) -> dict[str, float]:
        return {p.clave: self._ajustar_defecto(p, ajustes) for p in self.parametros}

    def _ajustar_defecto(self, p: Parametro, ajustes: dict) -> float:
        minimo, maximo = p.rango(ajustes)
        return float(min(max(p.defecto, minimo), maximo))

    def limitar(self, valores: dict[str, Any], ajustes: dict) -> tuple[dict[str, float], list[str]]:
        """Deja cada valor dentro de su rango y su tope. Lo que falta toma el valor por defecto."""
        salida: dict[str, float] = {}
        avisos: list[str] = []
        for p in self.parametros:
            minimo, maximo = p.rango(ajustes)
            crudo = valores.get(p.clave)
            try:
                v = float(crudo) if crudo is not None else self._ajustar_defecto(p, ajustes)
            except (TypeError, ValueError):
                v = self._ajustar_defecto(p, ajustes)
            if not np.isfinite(v):
                v = self._ajustar_defecto(p, ajustes)
            if p.tipo == "si_no":
                v = 1.0 if v >= 0.5 else 0.0
            elif v < minimo or v > maximo:
                limitado = min(max(v, minimo), maximo)
                avisos.append(f"{p.etiqueta}: se pidió {_numero(v)}{p.unidad} y el tope es {_numero(limitado)}{p.unidad}.")
                v = limitado
            if p.tipo == "numero" and p.paso:
                v = round(round(v / p.paso) * p.paso, 4)
            salida[p.clave] = v
        return salida, avisos


def _numero(v: float) -> str:
    return f"{v:g}"


def sin_cambios(valores: dict[str, float], claves: tuple[str, ...], tolerancia: float = 1e-6) -> bool:
    return all(abs(float(valores.get(c, 0.0))) <= tolerancia for c in claves)
