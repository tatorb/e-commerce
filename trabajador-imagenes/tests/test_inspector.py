import json
from types import SimpleNamespace

from conftest import foto_de_prueba
from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.inspector import Inspector, costo, esquema
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


def test_simulado_no_llama_a_nadie():
    medicion, propuesta = medir_y_proponer(Perspectiva(), foto_de_prueba(), AJUSTES, Inspector(simulado=True))
    assert propuesta.origen == "simulado" and propuesta.valores == medicion.sugeridos


def test_esquema_pide_todos_los_valores_y_la_razon():
    e = esquema(Perspectiva())
    assert e["required"] == ["valores", "razon"]
    assert e["properties"]["valores"]["required"] == ["giro", "vertical", "horizontal"]
    assert e["additionalProperties"] is False
