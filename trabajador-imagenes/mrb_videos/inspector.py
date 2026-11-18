"""Claude como inspector de la imagen del video.

Claude mira unos cuadros del video como salió de la cámara y lo que midió el
código, y propone la corrección: cómo girarlo para que quede vertical y
derecho, cuánto acercar y la luz y el color. El código limita los valores a
sus topes y los aplica. Claude nunca edita el video.

A Claude solo van los cuadros, las medidas, qué es el producto y las
indicaciones para el editor: nunca precios ni datos del cliente.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import math
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont

from mrb_imagenes.inspector import MODELO, _uso, aviso_sin_claude, obtener_clave_claude

from .medios import Fuente, correr, programa
from .medir import Medidas
from .plan import Imagen

SISTEMA = """Sos el inspector de una línea que edita videos de unboxing de autopartes para publicar como clips en Mercado Libre.
Los videos son de cámara fija y cenital: la cámara mira la mesa desde arriba y no se mueve. El clip final es vertical, de 9 de ancho por 16 de alto.
Mirás unos cuadros del video como salió de la cámara y lo que midió el código, y proponés una sola corrección de imagen para todo el video. El código la aplica: vos nunca editás el video.
Regla de oro: solo se corrige el video original. Nada se genera, se rellena ni se inventa.
Proponé valores moderados: el producto tiene que verse natural y fiel a la pieza real. Ante la duda, menos.
Si hay indicaciones para el editor, seguilas: mandan sobre lo que sugiere el código, siempre dentro de los rangos.
La razón va en español rioplatense simple, en una sola línea, sin tecnicismos."""

CONSIGNA = """Proponé estos valores:
- cuartos: cuartos de vuelta en sentido horario, 0, 1, 2 o 3, para que el clip quede vertical y como lo vería quien desembala: las manos entran desde abajo y los textos de la caja y de la etiqueta se leen derechos. Si el video ya está bien, 0.
- enderezado: de -8 a 8 grados en sentido horario, solo si después de girar los bordes de la mesa o de la caja quedan torcidos. Si está derecho, 0.
- zoom: de 1 a 2.5. Acercá solo si sobra mucho fondo vacío alrededor de donde pasa la acción. Todo lo que se muestra en algún momento del video tiene que seguir entrando. Ante la duda, 1.
- centro_x y centro_y: de 0 a 1, hacia dónde va el acercamiento en el clip ya girado. 0.5 es el medio.
- rojo, verde y azul: de 0.6 a 1.6, cuánto se multiplica cada color. Sirven para el balance de blancos y para la luz: el fondo tiene que quedar claro y sin color, sin quemar la caja ni la pieza.
- contraste: de 0.8 a 1.3. Casi siempre entre 1 y 1.1.
- saturacion: de 0.5 a 1.5. En piezas de metal o grises, cerca de 1."""

ESQUEMA = {
    "type": "object",
    "properties": {
        "valores": {
            "type": "object",
            "properties": {clave: {"type": "number"} for clave in Imagen.model_fields},
            "required": list(Imagen.model_fields),
            "additionalProperties": False,
        },
        "razon": {"type": "string", "description": "Por qué, en una sola línea."},
    },
    "required": ["valores", "razon"],
    "additionalProperties": False,
}


@dataclass
class Contexto:
    """Lo que se le cuenta a Claude del video, además de los cuadros y de lo que midió el código."""

    producto: str | None = None
    # El paso del protocolo con que se grabó y sus indicaciones para el editor.
    paso: str | None = None
    indicaciones: str | None = None
    # La indicación puntual de la persona para esta corrida.
    indicacion: str | None = None

    def texto(self) -> str | None:
        partes = []
        if self.producto:
            partes.append(f"Producto: {self.producto}.")
        if self.paso:
            partes.append(f"Video del protocolo: {self.paso}.")
        if self.indicaciones:
            partes.append(f"Indicaciones para el editor en este paso del protocolo:\n{self.indicaciones}")
        if self.indicacion:
            partes.append(f"Indicación de la persona para esta corrida, que manda sobre las demás:\n{self.indicacion}")
        return "\n\n".join(partes) or None


@dataclass
class PropuestaDeImagen:
    imagen: Imagen
    razon: str
    # claude: la propuso Claude. medido: Claude no respondió y se usa lo que midió el código. simulado: prueba sin Claude.
    origen: str
    uso: dict | None = None
    avisos: tuple[str, ...] = ()


def mosaico(fuente: Fuente, cantidad: int = 6, columnas: int = 3, ancho: int = 512) -> bytes:
    """Unos cuadros repartidos en el video, sin girar y numerados, en una sola imagen JPG."""
    alto = max(2, int(ancho * fuente.alto / fuente.ancho) // 2 * 2)
    res = correr(
        [
            programa("ffmpeg"), "-v", "error", "-i", str(fuente.ruta), "-map", "0:v:0", "-an",
            "-vf", f"fps=1/{fuente.duracion / cantidad:.4f},scale={ancho}:{alto}", "-frames:v", str(cantidad),
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
        ]
    )
    peso = ancho * alto * 3
    cuadros = [Image.frombytes("RGB", (ancho, alto), res.stdout[i * peso : (i + 1) * peso]) for i in range(len(res.stdout) // peso)]
    if not cuadros:
        raise ValueError("No se pudo leer ningún cuadro del video.")
    hoja = Image.new("RGB", (min(columnas, len(cuadros)) * ancho, math.ceil(len(cuadros) / columnas) * alto), "black")
    lapiz = ImageDraw.Draw(hoja)
    letra = ImageFont.load_default(size=28)
    for i, cuadro in enumerate(cuadros):
        x, y = (i % columnas) * ancho, (i // columnas) * alto
        hoja.paste(cuadro, (x, y))
        lapiz.rectangle((x, y, x + 44, y + 40), fill="black")
        lapiz.text((x + 12, y + 4), str(i + 1), fill="white", font=letra)
    salida = io.BytesIO()
    hoja.save(salida, format="JPEG", quality=85)
    return salida.getvalue()


def _medida(medidas: Medidas, cuartos: int = 0) -> Imagen:
    return Imagen(cuartos=cuartos, **medidas.sugeridos)


def limitar(valores: dict) -> tuple[Imagen, list[str]]:
    """Los valores que propuso Claude, llevados a sus topes. Devuelve también lo que hubo que limitar."""
    limpios, avisos = {}, []
    for clave, campo in Imagen.model_fields.items():
        minimo = next((m.ge for m in campo.metadata if hasattr(m, "ge")), None)
        maximo = next((m.le for m in campo.metadata if hasattr(m, "le")), None)
        pedido = float(valores[clave])
        valor = min(max(pedido, minimo), maximo)
        if clave == "cuartos":
            valor = int(round(valor)) % 4
        elif abs(valor - pedido) > 1e-9:
            avisos.append(f"{clave}: se pidió {pedido:g} y el tope es {valor:g}.")
        limpios[clave] = valor
    return Imagen(**limpios), avisos


class InspectorDeVideo:
    def __init__(self, cliente=None, modelo: str = MODELO, simulado: bool = False):
        self.cliente = cliente
        self.modelo = modelo
        self.simulado = simulado

    @classmethod
    def desde_entorno(cls, simulado: bool = False) -> InspectorDeVideo:
        if simulado:
            return cls(simulado=True)
        clave = obtener_clave_claude()
        if not clave:
            raise RuntimeError("Falta la clave de Claude. Cargala con ./configurar.sh, o probá sin Claude con --sin-claude.")
        import anthropic

        return cls(cliente=anthropic.Anthropic(api_key=clave, timeout=120, max_retries=2))

    def proponer(self, cuadros_jpg: bytes, medidas: Medidas, contexto: Contexto | None = None, cuartos: int = 0) -> PropuestaDeImagen:
        """`cuartos` es el giro que se usa si Claude no responde: el código no sabe para qué lado va el video."""
        if self.simulado or self.cliente is None:
            return PropuestaDeImagen(imagen=_medida(medidas, cuartos), razon="Simulado: valores medidos por el código, sin consultar a Claude.", origen="simulado")
        partes = [
            CONSIGNA,
            "Lo que midió el código:\n" + json.dumps(medidas.como_dict(), ensure_ascii=False),
            "Los cuadros están numerados en orden y se ven como salieron de la cámara, sin girar.",
        ]
        texto = (contexto or Contexto()).texto()
        if texto:
            partes.insert(0, texto)
        try:
            respuesta = self._pedir(base64.standard_b64encode(cuadros_jpg).decode("ascii"), "\n\n".join(partes))
        except Exception as e:  # sin conexión, clave inválida, sin saldo, Claude ocupado
            logging.getLogger("trabajador").info(f"Claude no respondió (pedido {getattr(e, 'request_id', None) or 'sin número'}): {e}")
            return self._medido(medidas, cuartos, aviso_sin_claude(e))
        uso = _uso(respuesta)
        if respuesta.stop_reason == "refusal":
            return self._medido(medidas, cuartos, "Claude no quiso responder: se usan los valores medidos.", uso)
        if respuesta.stop_reason == "max_tokens":
            return self._medido(medidas, cuartos, "La respuesta de Claude quedó cortada: se usan los valores medidos.", uso)
        dicho = next((b.text for b in respuesta.content if getattr(b, "type", "") == "text"), "")
        try:
            datos = json.loads(dicho)
            imagen, avisos = limitar(dict(datos["valores"]))
            razon = " ".join(str(datos["razon"]).split())[:300]
        except (ValueError, KeyError, TypeError):
            return self._medido(medidas, cuartos, "La respuesta de Claude no se pudo leer: se usan los valores medidos.", uso)
        return PropuestaDeImagen(imagen=imagen, razon=razon, origen="claude", uso=uso, avisos=tuple(avisos))

    def _pedir(self, imagen: str, texto: str):
        import anthropic

        pedido = {
            "model": self.modelo,
            "max_tokens": 4000,
            "system": SISTEMA,
            "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": ESQUEMA}},
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

    def _medido(self, medidas: Medidas, cuartos: int, aviso: str, uso: dict | None = None) -> PropuestaDeImagen:
        return PropuestaDeImagen(imagen=_medida(medidas, cuartos), razon=aviso, origen="medido", uso=uso, avisos=(aviso,))


# ───────────────────────────── Los cortes ─────────────────────────────

SISTEMA_CORTES = """Sos el editor de una línea que arma clips de unboxing de autopartes para Mercado Libre.
Los videos son de cámara fija y cenital: alguien abre una caja y saca las piezas sobre una mesa.
Mirás el video en hojas de cuadros, cada cuadro con su segundo, y marcás los momentos del video: dónde empieza y termina cada uno y qué tan importante es. El código decide después las velocidades: vos no las elegís.
Qué tan importante es cada momento:
- IMPORTANTE: va a velocidad normal. Lo que el comprador tiene que ver bien: la etiqueta de la caja, la pieza en detalle la primera vez que se muestra, el final con todo a la vista.
- NORMAL: se acelera. Pasos que hay que ver pero no en detalle: abrir la caja, sacar envoltorios.
- REPETIDO: va lo más rápido. Lo mismo que ya se mostró antes, hecho otra vez: desembalar la segunda, la tercera y la cuarta pieza iguales a la primera.
Si el protocolo cuenta los momentos del video, seguí ese orden y esa importancia, y ubicá cada uno en el video. Un momento del protocolo que no aparece en el video no se marca. Lo que pasa en el video y no está en el protocolo se marca igual, con la importancia que le corresponda.
Si hay indicaciones para el editor o de la persona, mandan sobre lo demás.
Los momentos van en orden, pegados uno al otro, y entre todos cubren el video entero, desde el segundo 0 hasta el final. Marcá los cortes en el segundo en que cambia la acción, mirando entre qué cuadros pasa. Lo importante que dura mucho partilo: marcá como IMPORTANTE solo lo que de verdad hay que ver a velocidad normal.
Los nombres van en español rioplatense simple, de 2 a 6 palabras. La razón va en una sola línea."""

ESQUEMA_CORTES = {
    "type": "object",
    "properties": {
        "momentos": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "inicio": {"type": "number", "description": "Segundo del video en que empieza."},
                    "fin": {"type": "number", "description": "Segundo del video en que termina."},
                    "importancia": {"type": "string", "enum": ["IMPORTANTE", "NORMAL", "REPETIDO"]},
                    "nombre": {"type": "string", "description": "Qué pasa, en 2 a 6 palabras."},
                },
                "required": ["inicio", "fin", "importancia", "nombre"],
                "additionalProperties": False,
            },
        },
        "razon": {"type": "string", "description": "Cómo se armó, en una sola línea."},
    },
    "required": ["momentos", "razon"],
    "additionalProperties": False,
}

# ───────────────────────────── El guión ─────────────────────────────

SISTEMA_GUION = """Escribís la voz en off de clips de unboxing de autopartes para Mercado Libre, de una tienda argentina.
El clip muestra cómo llega el producto: la caja, cómo se abre y las piezas. Quien lo mira está decidiendo si compra: quiere saber qué recibe y en qué estado.
Escribís una línea por tramo del clip, para decir mientras ese tramo se ve. Cada línea tiene que entrar en lo que dura su tramo: se te da la cantidad máxima de palabras de cada una y no la podés pasar. Si un tramo es muy corto para decir algo, dejá su línea vacía.
Cómo escribir:
- Castellano de Argentina, tratando de vos, claro y directo. Frases cortas, para escuchar y no para leer.
- Decí lo que se ve y lo que el comprador gana con eso: que viene sellado, cuántas piezas trae, cómo viene protegida cada una, cómo es la pieza.
- Usá solo los datos de la ficha del producto y lo que se ve. No inventes medidas, compatibilidades, materiales ni garantías que no estén en la ficha.
- Nada de precios, descuentos, envíos, datos de contacto ni nombres de otras tiendas o sitios: Mercado Libre los rechaza.
- Sin saludos, sin "hola", sin "en este video", sin pedir que compren ni que comenten.
- Los números de pieza y las medidas decilos como se dirían en voz alta, o no los digas si suenan mal.
- No uses el guion largo ni signos que no se leen en voz alta."""


def esquema_guion(cantidad: int) -> dict:
    return {
        "type": "object",
        "properties": {
            "lineas": {"type": "array", "items": {"type": "string"}, "description": f"Exactamente {cantidad} líneas, una por tramo, en orden. Vacía si el tramo va en silencio."},
        },
        "required": ["lineas"],
        "additionalProperties": False,
    }


# Cuántas palabras por segundo dice la voz, hablando tranquila.
PALABRAS_POR_SEGUNDO = 2.3


@dataclass
class PropuestaDeCortes:
    momentos: list[dict]
    razon: str
    origen: str
    uso: dict | None = None
    avisos: tuple[str, ...] = ()


@dataclass
class Guion:
    lineas: list[str]
    origen: str
    uso: dict | None = None
    avisos: tuple[str, ...] = ()


def _imagen(jpg: bytes) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.standard_b64encode(jpg).decode("ascii")}}


def _texto_de(respuesta) -> str:
    return next((b.text for b in respuesta.content if getattr(b, "type", "") == "text"), "")


def recortar_palabras(linea: str, maximo: int) -> str:
    """La línea, sin pasar de las palabras que entran en su tramo."""
    palabras = " ".join(str(linea).split()).split(" ")
    if maximo <= 0 or palabras == [""]:
        return ""
    if len(palabras) <= maximo:
        return " ".join(palabras)
    return " ".join(palabras[:maximo]).rstrip(",;:") + "."


def palabras_que_entran(segundos: float) -> int:
    # Se deja un respiro al principio y al final de cada línea.
    return max(0, int((segundos - 0.6) * PALABRAS_POR_SEGUNDO))



def _pedir(inspector: InspectorDeVideo, sistema: str, contenido: list[dict], esquema_: dict, tokens: int = 6000):
    import anthropic

    pedido = {
        "model": inspector.modelo,
        "max_tokens": tokens,
        "system": sistema,
        "output_config": {"effort": "medium", "format": {"type": "json_schema", "schema": esquema_}},
        "messages": [{"role": "user", "content": contenido}],
    }
    try:
        return inspector.cliente.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **pedido)
    except anthropic.BadRequestError as e:
        if "fallback" not in str(e).lower() and "beta" not in str(e).lower():
            raise
        return inspector.cliente.messages.create(**pedido)


def consigna_de_cortes(duracion: float, cada: float, momentos: list[dict], contexto: Contexto | None, objetivo: float) -> str:
    partes = []
    texto = (contexto or Contexto()).texto()
    if texto:
        partes.append(texto)
    if momentos:
        lista = "\n".join(f"{i + 1}. {m['texto']} ({m['importancia']})" for i, m in enumerate(momentos))
        partes.append(f"Los momentos del video según el protocolo, en orden:\n{lista}")
    else:
        partes.append("El protocolo no cuenta los momentos de este video: marcalos por lo que ves.")
    partes.append(
        f"El video dura {duracion:.1f} segundos. Las hojas muestran un cuadro cada {cada:g} segundos, en orden, cada uno con su minuto y segundo arriba a la izquierda, "
        f"ya girado como va a quedar en el clip. El clip tiene que durar unos {objetivo:g} segundos."
    )
    return "\n\n".join(partes)


def proponer_cortes(inspector: InspectorDeVideo, hojas_jpg: list[bytes], duracion: float, cada: float, momentos: list[dict], contexto: Contexto | None, objetivo: float) -> PropuestaDeCortes | None:
    """Los momentos del video según Claude. None si no se le consulta o no respondió: el video va a una sola velocidad."""
    if inspector.simulado or inspector.cliente is None:
        return None
    contenido = [_imagen(h) for h in hojas_jpg] + [{"type": "text", "text": consigna_de_cortes(duracion, cada, momentos, contexto, objetivo)}]
    try:
        respuesta = _pedir(inspector, SISTEMA_CORTES, contenido, ESQUEMA_CORTES)
        datos = json.loads(_texto_de(respuesta))
        marcados = [{"inicio": float(m["inicio"]), "fin": float(m["fin"]), "importancia": str(m["importancia"]), "nombre": str(m["nombre"])} for m in datos["momentos"]]
        if respuesta.stop_reason in ("refusal", "max_tokens") or not marcados:
            raise ValueError("sin momentos")
    except Exception as e:  # sin conexión, sin saldo, respuesta ilegible
        logging.getLogger("trabajador").info(f"Claude no marcó los cortes: {e}")
        aviso = "Claude no pudo marcar los cortes: el video va todo a una sola velocidad." if isinstance(e, (ValueError, KeyError, TypeError)) else aviso_sin_claude(e).replace("se usan los valores medidos", "el video va todo a una sola velocidad")
        return PropuestaDeCortes(momentos=[], razon=aviso, origen="medido", avisos=(aviso,))
    return PropuestaDeCortes(momentos=marcados, razon=" ".join(str(datos["razon"]).split())[:300], origen="claude", uso=_uso(respuesta))


def consigna_de_guion(tramos: list[dict], ficha: str | None, contexto: Contexto | None) -> str:
    partes = []
    if ficha:
        partes.append(f"Ficha del producto:\n{ficha}")
    texto = (contexto or Contexto()).texto()
    if texto:
        partes.append(texto)
    lista = "\n".join(
        f"{i + 1}. {t['nombre'] or 'Sin nombre'}: dura {t['segundos']:.1f} segundos en el clip, hasta {t['palabras']} palabras."
        + (" Va acelerado." if t["velocidad"] > 1.2 else "")
        for i, t in enumerate(tramos)
    )
    partes.append(f"Los tramos del clip, en orden:\n{lista}")
    partes.append("La imagen muestra un cuadro de cada tramo, numerado, para que sepas qué se ve.")
    return "\n\n".join(partes)


def escribir_guion(inspector: InspectorDeVideo, cuadros_jpg: bytes | None, tramos: list[dict], ficha: str | None, contexto: Contexto | None) -> Guion | None:
    """Una línea por tramo, cada una dentro de sus palabras. None si no se le consulta o no respondió: el clip sale sin voz."""
    if inspector.simulado or inspector.cliente is None:
        return None
    contenido = ([_imagen(cuadros_jpg)] if cuadros_jpg else []) + [{"type": "text", "text": consigna_de_guion(tramos, ficha, contexto)}]
    try:
        respuesta = _pedir(inspector, SISTEMA_GUION, contenido, esquema_guion(len(tramos)), tokens=3000)
        lineas = [str(linea) for linea in json.loads(_texto_de(respuesta))["lineas"]]
        if respuesta.stop_reason in ("refusal", "max_tokens"):
            raise ValueError("sin guión")
    except Exception as e:
        logging.getLogger("trabajador").info(f"Claude no escribió el guión: {e}")
        return Guion(lineas=[], origen="medido", avisos=("Claude no pudo escribir el guión: el clip sale sin voz en off.",))
    lineas = (lineas + [""] * len(tramos))[: len(tramos)]
    return Guion(lineas=[recortar_palabras(linea, t["palabras"]) for linea, t in zip(lineas, tramos)], origen="claude", uso=_uso(respuesta))
