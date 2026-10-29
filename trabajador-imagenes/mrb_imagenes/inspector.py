"""Claude como inspector.

En cada paso Claude mira una copia achicada de la foto y lo que midió el
código, propone los valores y explica en una línea por qué. El código los
limita a los topes y los aplica. Claude nunca edita la foto.

A Claude solo van la foto, las medidas, qué es la pieza y las indicaciones
que escribió la tienda: nunca precios ni datos del cliente.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass

from .imagen import Foto, vista_jpeg
from .pasos.base import Medicion, Paso

MODELO = "claude-opus-5-5"
# Dólares por millón de tokens: entrada y salida.
PRECIOS = {"claude-opus-5-5": (4.0, 20.0)}
# El lado más largo de la foto que mira Claude.
LADO_CLAUDE = 1568
# Dónde guarda el trabajador sus claves en el Llavero de macOS.
SERVICIO_LLAVERO = "MRB Imagenes"

SISTEMA = """Sos el inspector de una línea que corrige fotos de producto de autopartes para publicar en Mercado Libre.
En cada paso mirás la foto y lo que midió el código, y proponés los valores de ese paso. El código los aplica: vos nunca editás la foto.
Regla de oro: solo se corrige la foto original. Nada se genera, se rellena ni se inventa. La única excepción es el paso Sombra: agrega una sombra suave solo sobre el fondo, nunca sobre la pieza.
Proponé valores moderados: la foto tiene que verse natural y fiel a la pieza real. Ante la duda, menos.
Si hay indicaciones de la tienda para las fotos de ese paso del protocolo, o una indicación de la persona para esta corrida, seguilas: mandan sobre lo que sugiere el código, siempre dentro de los rangos. La de la persona manda sobre las de la tienda. Si una indicación no tiene que ver con el paso que estás haciendo, no la apliques en ese paso.
Respetá los rangos indicados. La razón va en español rioplatense simple, en una sola línea, sin tecnicismos."""


@dataclass
class Contexto:
    """Lo que se le cuenta a Claude de la foto, además de la foto y de lo que midió el código."""

    producto: str | None = None
    # El paso del protocolo con que se sacó la foto y las indicaciones de la tienda para ese paso.
    foto: str | None = None
    indicaciones: str | None = None
    # La indicación puntual de la persona para esta corrida.
    indicacion: str | None = None

    def texto(self) -> str | None:
        partes = []
        if self.producto:
            partes.append(f"Producto: {self.producto}.")
        if self.foto:
            partes.append(f"Foto del protocolo: {self.foto}.")
        if self.indicaciones:
            partes.append(f"Indicaciones de la tienda para las fotos de este paso del protocolo:\n{self.indicaciones}")
        if self.indicacion:
            partes.append(f"Indicación de la persona para esta corrida, que manda sobre las demás:\n{self.indicacion}")
        return "\n\n".join(partes) or None


@dataclass
class Propuesta:
    valores: dict[str, float]
    razon: str
    # claude: la propuso Claude. medido: Claude no respondió y se usan los valores del código. simulado: prueba sin Claude.
    origen: str
    uso: dict | None = None
    aviso: str | None = None


def obtener_clave_claude() -> str | None:
    clave = os.environ.get("ANTHROPIC_API_KEY")
    if clave:
        return clave
    try:
        import keyring

        return keyring.get_password(SERVICIO_LLAVERO, "claude")
    except Exception:
        return None


def _de_claude(paso: Paso):
    """Los valores que propone Claude: los que decide solo la persona quedan afuera."""
    return [p for p in paso.parametros if not p.persona]


def esquema(paso: Paso) -> dict:
    propiedades = {}
    for p in _de_claude(paso):
        descripcion = p.ayuda + (" 1 = sí, 0 = no." if p.tipo == "si_no" else "")
        propiedades[p.clave] = {"type": "number", "description": descripcion}
    return {
        "type": "object",
        "properties": {
            "valores": {
                "type": "object",
                "properties": propiedades,
                "required": [p.clave for p in _de_claude(paso)],
                "additionalProperties": False,
            },
            "razon": {"type": "string", "description": "Por qué, en una sola línea."},
        },
        "required": ["valores", "razon"],
        "additionalProperties": False,
    }


def consigna_del_paso(paso: Paso, medicion: Medicion, ajustes: dict, contexto: Contexto | str | None) -> str:
    rangos = []
    for p in _de_claude(paso):
        minimo, maximo = p.rango(ajustes)
        if p.tipo == "si_no":
            rangos.append(f"- {p.clave} ({p.etiqueta}): 0 o 1. {p.ayuda}")
        else:
            rangos.append(f"- {p.clave} ({p.etiqueta}): de {minimo:g} a {maximo:g}{p.unidad}. {p.ayuda}")
    partes = [
        f"Paso: {paso.nombre}.",
        paso.consigna,
        "Valores a proponer:\n" + "\n".join(rangos),
        "Lo que midió el código:\n" + json.dumps(medicion.medidas, ensure_ascii=False),
        "Lo que sugiere el código a partir de eso:\n"
        + json.dumps({p.clave: medicion.sugeridos[p.clave] for p in _de_claude(paso) if p.clave in medicion.sugeridos}, ensure_ascii=False),
    ]
    # Sin más que el producto, como lo pasa la prueba en la terminal.
    texto = (Contexto(producto=contexto) if isinstance(contexto, str) else contexto or Contexto()).texto()
    if texto:
        partes.insert(0, texto)
    return "\n\n".join(partes)


def costo(modelo: str, uso: dict) -> float:
    entrada, salida = PRECIOS.get(modelo, PRECIOS[MODELO])
    tokens_entrada = uso.get("input_tokens", 0) + uso.get("cache_creation_input_tokens", 0) * 1.25 + uso.get("cache_read_input_tokens", 0) * 0.05
    return round((tokens_entrada * entrada + uso.get("output_tokens", 0) * salida) / 1_000_000, 5)


class Inspector:
    def __init__(self, cliente=None, modelo: str = MODELO, simulado: bool = False):
        self.cliente = cliente
        self.modelo = modelo
        self.simulado = simulado

    @classmethod
    def desde_entorno(cls, simulado: bool = False) -> "Inspector":
        if simulado:
            return cls(simulado=True)
        clave = obtener_clave_claude()
        if not clave:
            raise RuntimeError("Falta la clave de Claude. Cargala con ./configurar.sh, o probá sin Claude con --simulado.")
        import anthropic

        return cls(cliente=anthropic.Anthropic(api_key=clave, timeout=120, max_retries=2))

    def proponer(self, paso: Paso, foto: Foto, medicion: Medicion, ajustes: dict, contexto: Contexto | str | None = None) -> Propuesta:
        if self.simulado or self.cliente is None:
            return Propuesta(valores=dict(medicion.sugeridos), razon="Simulado: valores medidos por el código, sin consultar a Claude.", origen="simulado")
        imagen = base64.standard_b64encode(vista_jpeg(foto, LADO_CLAUDE, calidad=85)).decode("ascii")
        texto = consigna_del_paso(paso, medicion, ajustes, contexto)
        try:
            respuesta = self._pedir(paso, imagen, texto)
        except Exception as e:  # sin conexión, clave inválida, sin saldo, Claude ocupado
            logging.getLogger("trabajador").info(f"Claude no respondió (pedido {getattr(e, 'request_id', None) or 'sin número'}): {e}")
            return self._medido(medicion, aviso_sin_claude(e))
        uso = _uso(respuesta)
        if respuesta.stop_reason == "refusal":
            return self._medido(medicion, "Claude no quiso responder: se usan los valores medidos.", uso)
        if respuesta.stop_reason == "max_tokens":
            return self._medido(medicion, "La respuesta de Claude quedó cortada: se usan los valores medidos.", uso)
        texto_respuesta = next((b.text for b in respuesta.content if getattr(b, "type", "") == "text"), "")
        try:
            datos = json.loads(texto_respuesta)
            valores = {k: float(v) for k, v in dict(datos["valores"]).items()}
            razon = " ".join(str(datos["razon"]).split())[:300]
        except (ValueError, KeyError, TypeError):
            return self._medido(medicion, "La respuesta de Claude no se pudo leer: se usan los valores medidos.", uso)
        return Propuesta(valores=valores, razon=razon, origen="claude", uso=uso)

    def _pedir(self, paso: Paso, imagen: str, texto: str):
        import anthropic

        pedido = {
            "model": self.modelo,
            "max_tokens": 4000,
            "system": SISTEMA,
            "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": esquema(paso)}},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": imagen}},
                        {"type": "text", "text": texto},
                    ],
                }
            ],
        }
        try:
            # Con respaldo automático: si el modelo declina, el pedido sigue en otro.
            return self.cliente.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **pedido)
        except anthropic.BadRequestError as e:
            if "fallback" not in str(e).lower() and "beta" not in str(e).lower():
                raise
            return self.cliente.messages.create(**pedido)

    def _medido(self, medicion: Medicion, aviso: str, uso: dict | None = None) -> Propuesta:
        return Propuesta(valores=dict(medicion.sugeridos), razon=aviso, origen="medido", uso=uso, aviso=aviso)


def _dicho_por_claude(e: Exception) -> str:
    """El mensaje que devolvió Claude con el error, tal cual. Vacío si no hay."""
    cuerpo = getattr(e, "body", None)
    error = cuerpo.get("error") if isinstance(cuerpo, dict) else None
    if isinstance(error, dict) and error.get("message"):
        return " ".join(str(error["message"]).split())[:300]
    return ""


def motivo_sin_claude(e: Exception) -> str:
    """Por qué Claude no respondió, en palabras simples."""
    import anthropic

    dicho = _dicho_por_claude(e).lower()
    if isinstance(e, anthropic.APITimeoutError):
        return "Claude tardó demasiado en contestar. Probá de nuevo en un rato"
    if isinstance(e, anthropic.APIConnectionError):
        return "No se pudo conectar con Claude. Revisá la conexión a internet de la Mac"
    if not isinstance(e, anthropic.APIStatusError):
        return f"Falló algo inesperado ({type(e).__name__}: {' '.join(str(e).split())[:200]})"
    estado = e.status_code
    if estado == 402 or "credit balance" in dicho:
        return "La cuenta de Claude no tiene saldo. Se carga en console.anthropic.com, en Billing"
    if "usage limit" in dicho or "spend limit" in dicho:
        return "La cuenta de Claude llegó a su límite de gasto. Se cambia en console.anthropic.com, en Limits"
    if estado == 401:
        return "La clave de Claude no vale. Cargala de nuevo con bash configurar.sh"
    if estado == 403:
        return "La cuenta de Claude no tiene permiso para esto"
    if estado == 404:
        return "Claude no encontró el modelo que pide el trabajador"
    if estado == 413:
        return "La foto que se le mandó a Claude es demasiado grande"
    if estado == 429:
        return "La cuenta de Claude llegó al máximo de pedidos por minuto. Probá de nuevo en un rato"
    if estado >= 500:
        return "Claude está con problemas o saturado. Probá de nuevo en un rato"
    return "Claude rechazó el pedido"


def aviso_sin_claude(e: Exception) -> str:
    """El aviso del ajuste cuando Claude no respondió: el motivo y lo que dijo Claude, para poder revisarlo."""
    dicho = _dicho_por_claude(e)
    return f"Claude no respondió y se usan los valores medidos. {motivo_sin_claude(e)}." + (f" Claude dijo «{dicho}»." if dicho else "")


def _uso(respuesta) -> dict:
    u = getattr(respuesta, "usage", None)
    if u is None:
        return {}
    datos = {
        "modelo": getattr(respuesta, "model", MODELO),
        "input_tokens": int(getattr(u, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(u, "output_tokens", 0) or 0),
        "cache_creation_input_tokens": int(getattr(u, "cache_creation_input_tokens", 0) or 0),
        "cache_read_input_tokens": int(getattr(u, "cache_read_input_tokens", 0) or 0),
    }
    datos["costo_usd"] = costo(datos["modelo"], datos)
    return datos
