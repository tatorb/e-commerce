import json
from types import SimpleNamespace

from conftest import foto_de_prueba
from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.inspector import Inspector, consigna_del_paso, costo, esquema
from mrb_imagenes.linea import aplicar, medir_y_proponer
from mrb_imagenes.pasos.perspectiva import Perspectiva

AJUSTES = leer_ajustes({"topes": {"giro": 5}})


class ClienteFalso:
    def __init__(self, respuesta=None, error=None):
        self.pedidos = []
        self.respuesta = respuesta
        self.error = error
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._crear))

    def _crear(self, **pedido):
        self.pedidos.append(pedido)
        if self.error:
            raise self.error
        return self.respuesta


def respuesta(texto, stop="end_turn"):
    return SimpleNamespace(
        stop_reason=stop,
        model="claude-opus-5-5",
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=texto)],
        usage=SimpleNamespace(input_tokens=3000, output_tokens=200, cache_creation_input_tokens=0, cache_read_input_tokens=0),
    )


def test_claude_propone_y_el_codigo_limita_al_tope():
    cliente = ClienteFalso(respuesta(json.dumps({"valores": {"giro": -9, "vertical": 0, "horizontal": 0}, "razon": "La mesa está torcida."})))
    inspector = Inspector(cliente=cliente)
    medicion, propuesta = medir_y_proponer(Perspectiva(), foto_de_prueba(inclinacion=3), AJUSTES, inspector, "Kit de embrague")
    assert propuesta.origen == "claude"
    assert propuesta.razon == "La mesa está torcida."
    assert propuesta.uso["costo_usd"] == costo("claude-opus-5-5", {"input_tokens": 3000, "output_tokens": 200})
    corrida = aplicar(Perspectiva(), foto_de_prueba(inclinacion=3), AJUSTES, medicion, propuesta)
    assert corrida.resultado.valores["giro"] == -5
    assert corrida.avisos == ["Giro: se pidió -9° y el tope es -5°."]

    pedido = cliente.pedidos[0]
    assert pedido["model"] == "claude-opus-5-5"
    assert pedido["output_config"]["effort"] == "low"
    assert pedido["output_config"]["format"]["schema"] == esquema(Perspectiva())
    assert pedido["fallbacks"] == "default"
    contenido = pedido["messages"][0]["content"]
    assert contenido[0]["type"] == "image" and contenido[0]["source"]["media_type"] == "image/jpeg"
    texto = contenido[1]["text"]
    assert "Producto: Kit de embrague." in texto
    # Claude ve el rango ya limitado por el tope de Ajustes.
    assert "giro (Giro): de -5 a 5°" in texto
    assert "precio" not in texto.lower()


def test_si_claude_no_responde_se_usan_los_valores_medidos():
    foto = foto_de_prueba(inclinacion=3)
    for cliente in [
        ClienteFalso(error=RuntimeError("sin conexión")),
        ClienteFalso(respuesta("{}", stop="refusal")),
        ClienteFalso(respuesta('{"valores": "nada"')),
    ]:
        medicion, propuesta = medir_y_proponer(Perspectiva(), foto, AJUSTES, Inspector(cliente=cliente))
        assert propuesta.origen == "medido"
        assert propuesta.valores == medicion.sugeridos
        assert "valores medidos" in propuesta.razon


def _error_de_claude(clase, estado, mensaje):
    import anthropic
    import httpx2

    pedido = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    cuerpo = {"type": "error", "error": {"type": "invalid_request_error", "message": mensaje}}
    return getattr(anthropic, clase)(f"Error code: {estado}", response=httpx2.Response(estado, request=pedido), body=cuerpo)


def test_si_claude_rechaza_el_pedido_dice_por_que():
    foto = foto_de_prueba(inclinacion=3)
    casos = [
        (_error_de_claude("BadRequestError", 400, "Your credit balance is too low to access the Anthropic API."), "no tiene saldo"),
        (_error_de_claude("BadRequestError", 400, "You have reached your specified API usage limits."), "límite de gasto"),
        (_error_de_claude("BadRequestError", 400, "output_config.format: schema is not supported"), "Claude rechazó el pedido"),
        (_error_de_claude("AuthenticationError", 401, "invalid x-api-key"), "La clave de Claude no vale"),
        (RuntimeError("algo raro"), "Falló algo inesperado (RuntimeError: algo raro)"),
    ]
    for error, motivo in casos:
        medicion, propuesta = medir_y_proponer(Perspectiva(), foto, AJUSTES, Inspector(cliente=ClienteFalso(error=error)))
        assert propuesta.origen == "medido"
        assert propuesta.valores == medicion.sugeridos
        assert propuesta.razon.startswith("Claude no respondió y se usan los valores medidos.")
        assert motivo in propuesta.razon
        # Lo que dijo Claude va tal cual, para poder revisarlo.
        dicho = getattr(error, "body", None)
        if dicho:
            assert f"Claude dijo «{dicho['error']['message']}»" in propuesta.razon


def test_simulado_no_llama_a_nadie():
    medicion, propuesta = medir_y_proponer(Perspectiva(), foto_de_prueba(), AJUSTES, Inspector(simulado=True))
    assert propuesta.origen == "simulado" and propuesta.valores == medicion.sugeridos


def test_esquema_pide_todos_los_valores_y_la_razon():
    e = esquema(Perspectiva())
    assert e["required"] == ["valores", "razon"]
    assert e["properties"]["valores"]["required"] == ["giro", "vertical", "horizontal"]
    assert e["additionalProperties"] is False


def test_claude_no_propone_girar_90_grados():
    paso = Perspectiva()
    medicion = paso.medir(foto_de_prueba(), leer_ajustes())
    texto = consigna_del_paso(paso, medicion, leer_ajustes(), None)
    assert "cuartos" not in texto and "Girar 90" not in texto
    assert "cuartos" not in esquema(paso)["properties"]["valores"]["properties"]


def test_claude_recibe_el_paso_del_protocolo_y_las_indicaciones():
    from mrb_imagenes.inspector import Contexto, consigna_del_paso
    from mrb_imagenes.pasos.base import Medicion
    from mrb_imagenes.pasos.fondo import Fondo

    paso = Fondo(lambda rgb: rgb[..., 0])
    medicion = Medicion(medidas={}, sugeridos=paso.defectos({}))
    texto = consigna_del_paso(
        paso,
        medicion,
        {},
        Contexto(producto="Subconjunto: SP-433", foto="Cajas del lado de la etiqueta", indicaciones="La cuadrícula es parte de la caja.", indicacion="Apagá la segunda pasada."),
    )
    assert texto.startswith("Producto: Subconjunto: SP-433.\n\nFoto del protocolo: Cajas del lado de la etiqueta.")
    assert "Indicaciones de la tienda para las fotos de este paso del protocolo:\nLa cuadrícula es parte de la caja." in texto
    assert "Indicación de la persona para esta corrida, que manda sobre las demás:\nApagá la segunda pasada." in texto
    # Sin más que el producto, como desde la terminal.
    assert consigna_del_paso(paso, medicion, {}, "Kit de pistones").startswith("Producto: Kit de pistones.\n\nPaso: Quitar fondo.")
    assert "Producto" not in consigna_del_paso(paso, medicion, {}, None)
