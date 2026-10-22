"""Paso 8. Sombra.

Con el fondo quitado, la pieza queda flotando sobre blanco. Este paso le
devuelve una sombra suave, copiada de la que tenía la foto. El código mide la
sombra real alrededor de la pieza: hacia dónde cae, hasta dónde llega, qué tan
blanda es y qué tan oscura. Claude la mira y propone los valores, y el código
dibuja un degradado sutil con la forma de la pieza: más denso cerca de ella y
desvaneciéndose hacia donde cae la luz. No es la silueta copiada y corrida,
como en un programa de diseño.

Es la única excepción a la regla de oro: la sombra se agrega, pero solo sobre
el fondo. Los píxeles de la pieza no cambian. En el JPG oscurece el fondo; en
el PNG va como transparencia gris, salvo que se apague en Exportar.

La sombra se dibuja sobre una copia de la silueta de a lo sumo 512 px, porque
es borrosa y así es rápida. La app hace la misma cuenta para mostrarla en vivo
(src/domain/photo-live.ts).
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from ..imagen import Foto, a_lineal, a_srgb, luminancia
from .base import Medicion, Parametro, Paso, Resultado

LADO_DE_TRABAJO = 512
# Hasta dónde se busca la sombra real, en proporción del tamaño de la pieza.
_BANDA = 0.5
# El borde del cuadro donde la sombra se desvanece, para que nunca quede cortada.
_BORDE = 0.04
# Cuánta sombra deja el lado de la pieza opuesto a donde cae, comparado con el otro.
_ALREDEDOR = 0.1


def _achicar(m: np.ndarray, lado: int) -> tuple[np.ndarray, float]:
    alto, ancho = m.shape
    escala = min(1.0, lado / max(alto, ancho))
    m = m.astype(np.float32)
    if escala >= 1.0:
        return m, 1.0
    return cv2.resize(m, (max(1, round(ancho * escala)), max(1, round(alto * escala))), interpolation=cv2.INTER_AREA), escala


def _caja(a: np.ndarray) -> tuple[int, int, int, int] | None:
    filas = np.where((a >= 0.5).any(axis=1))[0]
    columnas = np.where((a >= 0.5).any(axis=0))[0]
    if len(filas) == 0:
        return None
    return int(columnas[0]), int(filas[0]), int(columnas[-1]) + 1, int(filas[-1]) + 1


def _correr_entero(a: np.ndarray, kx: int, ky: int) -> np.ndarray:
    """La imagen corrida kx a la derecha y ky hacia abajo; lo que entra de afuera es 0."""
    alto, ancho = a.shape
    salida = np.zeros_like(a)
    if abs(kx) >= ancho or abs(ky) >= alto:
        return salida
    salida[max(0, ky) : alto + min(0, ky), max(0, kx) : ancho + min(0, kx)] = a[max(0, -ky) : alto - max(0, ky), max(0, -kx) : ancho - max(0, kx)]
    return salida


def desplazar(a: np.ndarray, dx: float, dy: float) -> np.ndarray:
    """La imagen corrida (dx, dy) píxeles, mezclando los vecinos según la parte decimal."""
    ix, iy = math.floor(dx), math.floor(dy)
    fx, fy = dx - ix, dy - iy
    return (
        (1 - fx) * (1 - fy) * _correr_entero(a, ix, iy)
        + fx * (1 - fy) * _correr_entero(a, ix + 1, iy)
        + (1 - fx) * fy * _correr_entero(a, ix, iy + 1)
        + fx * fy * _correr_entero(a, ix + 1, iy + 1)
    )


def _promedio(a: np.ndarray, radio: int, eje: int) -> np.ndarray:
    """El promedio en una ventana de 2 × radio + 1 a lo largo de un eje; lo de afuera cuenta como 0."""
    if radio <= 0:
        return a
    relleno = [(0, 0), (0, 0)]
    relleno[eje] = (radio + 1, radio)
    c = np.cumsum(np.pad(a, relleno), axis=eje, dtype=np.float64)
    n = a.shape[eje]
    if eje == 1:
        return ((c[:, 2 * radio + 1 : 2 * radio + 1 + n] - c[:, :n]) / (2 * radio + 1)).astype(np.float32)
    return ((c[2 * radio + 1 : 2 * radio + 1 + n] - c[:n]) / (2 * radio + 1)).astype(np.float32)


def difuminar(a: np.ndarray, sigma: float) -> np.ndarray:
    """Casi un desenfoque gaussiano: tres promedios seguidos en cada eje."""
    radio = max(0, round((math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2))
    for eje in (1, 0):
        for _ in range(3):
            a = _promedio(a, radio, eje)
    return a


def dibujar_sombra(alfa: np.ndarray, valores: dict[str, float]) -> np.ndarray:
    """Cuánto oscurece la sombra cada píxel, de 0 a 1, del tamaño de la silueta."""
    alto, ancho = alfa.shape
    a, escala = _achicar(alfa, LADO_DE_TRABAJO)
    caja = _caja(a)
    if caja is None or valores.get("intensidad", 0) <= 0:
        return np.zeros((alto, ancho), np.float32)
    pieza = max(caja[2] - caja[0], caja[3] - caja[1])
    largo = valores["distancia"] / 100 * pieza
    angulo = math.radians(valores["direccion"])
    dx, dy = math.sin(angulo), math.cos(angulo)
    # La sombra nace del lado de la pieza que da hacia donde cae: ese lado
    # pesa entero y el opuesto casi nada, así no queda un halo alrededor.
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    total = max(float(a.sum()), 1e-6)
    cx, cy = float((a * xx).sum() / total), float((a * yy).sum() / total)
    u = (xx - cx) * dx + (yy - cy) * dy
    alcance = max(float(np.abs(u[a >= 0.5]).max()), 1.0)
    lado = np.clip((u / alcance + 1) / 2, 0, 1) ** 2
    base = a * (_ALREDEDOR + (1 - _ALREDEDOR) * lado)
    # Desde ahí hacia donde cae la luz, cada vez más tenue.
    s = base.copy()
    pasos = max(1, min(48, math.ceil(largo)))
    for i in range(1, pasos + 1):
        t = i / pasos
        s = np.maximum(s, (1 - t) ** 1.5 * desplazar(base, t * largo * dx, t * largo * dy))
    s = difuminar(s, 0.5 + valores["suavidad"] / 100 * (0.08 * pieza + 0.5 * largo))
    # Se desvanece contra el borde del cuadro: nunca queda cortada.
    borde = max(1.0, _BORDE * max(h, w))
    fx = np.clip(np.minimum(np.arange(w) + 0.5, w - np.arange(w) - 0.5) / borde, 0, 1)
    fy = np.clip(np.minimum(np.arange(h) + 0.5, h - np.arange(h) - 0.5) / borde, 0, 1)
    s = s * fy[:, None] * fx[None, :] * (valores["intensidad"] / 100)
    if escala < 1.0:
        s = cv2.resize(s.astype(np.float32), (ancho, alto), interpolation=cv2.INTER_LINEAR)
    return np.clip(s, 0, 1).astype(np.float32)


def _percentil_pesado(valores: np.ndarray, pesos: np.ndarray, p: float) -> float:
    orden = np.argsort(valores)
    v, w = valores[orden], pesos[orden]
    acumulado = np.cumsum(w)
    return float(v[min(len(v) - 1, int(np.searchsorted(acumulado, acumulado[-1] * p)))])


_HACIA = ["abajo", "abajo a la derecha", "la derecha", "arriba a la derecha", "arriba", "arriba a la izquierda", "la izquierda", "abajo a la izquierda"]


def hacia(grados: float) -> str:
    return _HACIA[round((grados % 360) / 45) % 8]


def medir_sombra(foto: Foto) -> dict:
    """La sombra real alrededor de la pieza: donde el fondo pegado a ella está más oscuro que el resto."""
    assert foto.alfa is not None
    alto, ancho = foto.alfa.shape
    zona = np.zeros((alto, ancho), np.float32)
    x0, y0, x1, y1 = foto.datos.get("zona_de_foto") or (0, 0, ancho, alto)
    zona[y0:y1, x0:x1] = 1
    l, _ = _achicar(a_srgb(luminancia(a_lineal(foto.rgb))), LADO_DE_TRABAJO)
    a, _ = _achicar(foto.alfa, LADO_DE_TRABAJO)
    z, _ = _achicar(zona, LADO_DE_TRABAJO)
    pieza = a >= 0.5
    caja = _caja(a)
    if caja is None:
        return {"sombra_detectada": False}
    tam = max(caja[2] - caja[0], caja[3] - caja[1])
    distancia = cv2.distanceTransform((~pieza).astype(np.uint8), cv2.DIST_L2, 5)
    fondo = (a < 0.02) & (z > 0.99) & (distancia > 1.5) & (distancia <= _BANDA * tam)
    if fondo.sum() < 100:
        return {"sombra_detectada": False, "motivo": "Casi no hay fondo de la foto alrededor de la pieza."}
    # Sin la textura del fondo: un promedio que solo mira el fondo.
    sigma = max(1.0, 0.01 * tam)
    peso = cv2.GaussianBlur(fondo.astype(np.float32), (0, 0), sigma)
    suave = cv2.GaussianBlur(l * fondo, (0, 0), sigma) / np.maximum(peso, 1e-6)
    referencia = float(np.percentile(suave[fondo], 90))
    s = np.clip((referencia - suave) / max(referencia, 1e-3), 0, 1) * fondo
    s[s < 0.03] = 0
    if s.sum() < 0.002 * fondo.sum():
        return {"sombra_detectada": False, "motivo": "El fondo alrededor de la pieza es parejo: no se ve sombra."}
    # Hacia dónde: en cada punto de sombra, la dirección que se aleja de la pieza.
    gy, gx = np.gradient(distancia)
    vx, vy = float((s * gx).sum() / s.sum()), float((s * gy).sum() / s.sum())
    direccion = math.degrees(math.atan2(vx, vy))
    hay = s > 0
    d50 = _percentil_pesado(distancia[hay], s[hay], 0.5)
    d90 = _percentil_pesado(distancia[hay], s[hay], 0.9)
    cerca = s[fondo & (distancia <= max(2.0, 0.06 * tam))]
    return {
        "sombra_detectada": True,
        "direccion_grados": round(direccion),
        "cae_hacia": hacia(direccion),
        # Qué tan marcada es la dirección: 0 sombra pareja alrededor, 1 toda de un lado.
        "direccion_marcada": round(math.hypot(vx, vy), 2),
        "llega_pct_de_la_pieza": round(d90 / tam * 100, 1),
        # Más bajo, más blanda: la sombra se va apagando de a poco.
        "caida": round(d50 / max(d90, 1e-6), 2),
        "oscuridad_pct": round(float(np.percentile(cerca, 75)) * 100 if len(cerca) else 0.0, 1),
    }


class Sombra(Paso):
    clave = "sombra"
    nombre = "Sombra"
    consigna = (
        "Esta vez la foto se muestra con su fondo original, para que veas la sombra que deja la pieza sobre la base. "
        "Con el fondo quitado, se le agrega una sombra suave copiada de esa: un degradado con la forma de la pieza, solo "
        "sobre el fondo. El código midió hacia dónde cae la sombra real, hasta dónde llega, qué tan blanda es y qué tan "
        "oscura. Proponé dirección (0 hacia abajo, 90 hacia la derecha, -90 hacia la izquierda, 180 hacia arriba), "
        "distancia, suavidad e intensidad. Tiene que ser sutil: la foto principal de Mercado Libre va sobre fondo blanco. "
        "Si los oscuros que midió el código son pliegues o manchas del fondo y no la sombra, ignoralos. Si no se ve una "
        "sombra clara, proponé una muy suave hacia abajo."
    )
    parametros = (
        Parametro("intensidad", "Intensidad", "Qué tan oscura es la sombra donde es más densa.", 0, 80, 20, 1, " %", tope="sombra"),
        Parametro("direccion", "Dirección", "Hacia dónde cae: 0 abajo, 90 a la derecha, -90 a la izquierda, 180 arriba.", -180, 180, 0, 1, "°"),
        Parametro("distancia", "Distancia", "Hasta dónde llega, en % del tamaño de la pieza.", 0, 40, 10, 0.5, " %"),
        Parametro("suavidad", "Suavidad", "0 deja el borde de la sombra nítido; 100, muy difuso.", 0, 100, 60, 1),
    )

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        if foto.alfa is None:
            return Medicion(medidas={}, sugeridos={}, no_aplica="La foto no tiene el fondo quitado: la sombra necesita la silueta.")
        medidas = medir_sombra(foto)
        sugeridos = self.defectos(ajustes)
        if medidas.get("sombra_detectada"):
            # Copiada de la real, pero siempre sutil: la textura del fondo también oscurece y la mide de más.
            sugeridos["direccion"] = float(medidas["direccion_grados"]) if medidas["direccion_marcada"] >= 0.15 else 0.0
            sugeridos["distancia"] = float(np.clip(medidas["llega_pct_de_la_pieza"], 3, 15))
            sugeridos["suavidad"] = float(np.clip((0.56 - medidas["caida"]) / 0.26 * 100, 30, 100))
            sugeridos["intensidad"] = float(np.clip(medidas["oscuridad_pct"] * 0.6, 8, min(25.0, self.parametros[0].rango(ajustes)[1])))
        else:
            sugeridos["intensidad"] = min(15.0, sugeridos["intensidad"])
        sugeridos, _ = self.limitar(sugeridos, ajustes)
        return Medicion(medidas=medidas, sugeridos=sugeridos)

    def vista_para_claude(self, foto: Foto, medicion: Medicion) -> Foto:
        # Con el fondo original: ahí se ve la sombra real.
        return Foto(rgb=foto.rgb, datos=foto.datos)

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        if medicion.no_aplica or foto.alfa is None:
            return Resultado(foto=foto, valores={}, nota=medicion.no_aplica, salteado=True)
        if valores.get("intensidad", 0) <= 0:
            return Resultado(foto=foto, valores=valores, nota="Intensidad en 0: la foto queda sin sombra.")
        sombra = dibujar_sombra(foto.alfa, valores)
        # Solo sobre el fondo: debajo de la pieza no se ve.
        visible = sombra * (1 - foto.alfa)
        return Resultado(
            foto=Foto(rgb=foto.rgb, alfa=foto.alfa, datos=foto.datos, sombra=sombra),
            valores=valores,
            medidas={"oscuridad_maxima_pct": round(float(visible.max()) * 100, 1)},
        )
