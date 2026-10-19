"""El trabajador conectado: los mensajes con la app y un paso de punta a punta.

La app se simula con un servidor local y con un cliente en memoria.
"""

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import numpy as np
import pytest
from conftest import foto_de_prueba
from PIL import Image

from mrb_imagenes.app import (
    PROTOCOLO,
    ClienteApp,
    ErrorDeApp,
    Fallo,
    Hecho,
    Siguiente,
    Trabajo,
    Transferencia,
)
from mrb_imagenes.inspector import Inspector, Propuesta
from mrb_imagenes.pasos import CLAVES, armar_pasos
from mrb_imagenes.trabajo import Cancelado, a_json, procesar

CONTRATO = Path(__file__).resolve().parents[1] / "contrato"


def ejemplo(nombre: str) -> dict:
    return json.loads((CONTRATO / nombre).read_text())


# ───────────────────────────── El contrato ─────────────────────────────


def test_entiende_el_trabajo_de_ejemplo():
    r = Siguiente.model_validate(ejemplo("trabajo.json"))
    assert r.trabajo is not None
    assert r.trabajo.paso == "fondo" and r.trabajo.indice == CLAVES.index("fondo")
    assert r.trabajo.pedidos == {"detalle": 1, "refinar_bordes": 1, "motas": 0, "dureza": 20}
    assert [p.paso for p in r.trabajo.receta] == ["lente", "perspectiva"]
    assert set(r.trabajo.subidas) == {"vista", "mascara"}
    assert r.volver_en == 5


def test_el_resultado_tiene_la_forma_del_ejemplo():
    for nombre, modelo in [("resultado.json", Hecho), ("fallo.json", Fallo)]:
        datos = ejemplo(nombre)
        assert datos["protocolo"] == PROTOCOLO
        armado = modelo.model_validate(datos).model_dump(mode="json")
        assert sorted(armado) == sorted(datos)
        assert armado == datos


def test_los_pasos_son_los_de_la_app():
    # Los mismos 8 pasos, en el mismo orden, que src/domain/photo-steps.ts.
    app = Path(__file__).resolve().parents[2] / "src" / "domain" / "photo-steps.ts"
    if not app.exists():
        pytest.skip("Sin el código de la app al lado.")
    texto = app.read_text()
    posiciones = [texto.index(f"key: '{c}'") for c in CLAVES]
    assert posiciones == sorted(posiciones)


def test_a_json_saca_los_tipos_de_numpy():
    assert a_json({"a": np.float32(1.5), "b": [np.int64(2), np.bool_(True)], "c": float("nan"), "d": (1, 2)}) == {
        "a": 1.5,
        "b": [2, True],
        "c": None,
        "d": [1, 2],
    }


# ───────────────────────────── El cliente HTTP ─────────────────────────────


class _App(BaseHTTPRequestHandler):
    recibido: list = []
    archivos: dict = {}

    def log_message(self, *a):
        pass

    def _responder(self, estado: int, cuerpo: bytes, tipo="application/json"):
        self.send_response(estado)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        cuerpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        _App.recibido.append((self.path, self.headers.get("Authorization"), cuerpo))
        if self.headers.get("Authorization") != "Bearer mrbimg_buena":
            return self._responder(401, json.dumps({"error": "La llave del trabajador no vale."}).encode())
        if self.path.endswith("/siguiente"):
            return self._responder(200, json.dumps({"trabajo": None, "volver_en": 60}).encode())
        if self.path.endswith("/latido"):
            return self._responder(200, json.dumps({"vigente": cuerpo["id"] == "vivo"}).encode())
        return self._responder(200, json.dumps({"aceptado": True}).encode())

    def do_GET(self):
        _App.recibido.append((self.path, self.headers.get("Authorization"), None))
        if self.path.startswith("/archivo"):
            return self._responder(200, b"x" * 3_000_000, "image/jpeg")
        self._responder(404, b"no")

    def do_PUT(self):
        datos = self.rfile.read(int(self.headers["Content-Length"]))
        _App.archivos[self.path] = (datos, self.headers)
        self._responder(200, b"{}")


@pytest.fixture
def app():
    _App.recibido = []
    _App.archivos = {}
    servidor = HTTPServer(("127.0.0.1", 0), _App)
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    yield f"http://127.0.0.1:{servidor.server_port}"
    servidor.shutdown()


def test_pregunta_avisa_y_entrega_con_su_llave(app):
    c = ClienteApp(app + "/", "mrbimg_buena")
    assert c.siguiente({"modelo_fondo": "x"}, "0.2.0").trabajo is None
    assert c.latido("vivo", 3) is True
    assert c.latido("otro", 3) is False
    assert c.entregar(Fallo(id="a", turno=1, error="no")) == {"aceptado": True}
    ruta, llave, cuerpo = _App.recibido[0]
    assert ruta == "/api/imagenes/trabajador/siguiente"
    assert llave == "Bearer mrbimg_buena"
    assert cuerpo == {"protocolo": PROTOCOLO, "version": "0.2.0", "info": {"modelo_fondo": "x"}}
    assert _App.recibido[-1][2] == {"protocolo": PROTOCOLO, "id": "a", "turno": 1, "ok": False, "error": "no"}


def test_un_error_de_la_app_llega_con_su_mensaje(app):
    with pytest.raises(ErrorDeApp) as e:
        ClienteApp(app, "mrbimg_mala").siguiente({}, "0.2.0")
    assert e.value.estado == 401
    assert e.value.hay_que_configurar
    assert "La llave del trabajador no vale." in str(e.value)
    with pytest.raises(ErrorDeApp) as e:
        ClienteApp("http://127.0.0.1:9", "mrbimg_buena", timeout=2).latido("x", 1)
    assert e.value.estado is None and not e.value.hay_que_configurar


def test_baja_y_sube_archivos_con_los_encabezados_de_la_app(app, tmp_path):
    c = ClienteApp(app, "mrbimg_buena")
    destino = tmp_path / "foto" / "original.heic"
    # El archivo pasa por la app: va con la llave.
    c.bajar(Transferencia(url=f"{app}/archivo?x=1", metodo="GET"), destino)
    assert destino.stat().st_size == 3_000_000
    assert _App.recibido[-1][1] == "Bearer mrbimg_buena"
    # Al depósito va solo con los encabezados que armó la app.
    otro = app.replace("127.0.0.1", "localhost")
    c.subir(Transferencia(url=f"{otro}/subir?pathname=a.jpg", metodo="PUT", encabezados={"x-content-type": "image/jpeg", "authorization": "Bearer permiso"}), b"jpg")
    datos, encabezados = _App.archivos["/subir?pathname=a.jpg"]
    assert datos == b"jpg"
    assert encabezados["authorization"] == "Bearer permiso"
    assert encabezados["Content-Type"] == "image/jpeg"


# ───────────────────────────── Un paso de punta a punta ─────────────────────────────


def _segmentador(rgb):
    alto, ancho = rgb.shape[:2]
    m = np.zeros((alto, ancho), np.float32)
    m[int(alto * 0.3) : int(alto * 0.7), int(ancho * 0.32) : int(ancho * 0.68)] = 1
    return m


class _ClienteEnMemoria:
    """Hace de app y de depósito: guarda lo que se sube y entrega el original."""

    def __init__(self, original: bytes):
        self.original = original
        self.bajadas = 0
        self.subidas: dict[str, bytes] = {}

    def bajar(self, t, destino: Path):
        self.bajadas += 1
        destino.write_bytes(self.original)

    def subir(self, t, contenido: bytes):
        self.subidas[t.url] = contenido


class _InspectorQueCuenta(Inspector):
    def __init__(self):
        super().__init__(simulado=True)
        self.pedidos = 0

    def proponer(self, paso, foto, medicion, ajustes, contexto=None):
        self.pedidos += 1
        return Propuesta(valores=dict(medicion.sugeridos), razon=f"Propuesta para {paso.clave}.", origen="claude", uso={"costo_usd": 0.01})


def _original() -> bytes:
    salida = io.BytesIO()
    Image.fromarray((foto_de_prueba(inclinacion=2).rgb * 255).astype(np.uint8)).save(salida, "JPEG", quality=95)
    return salida.getvalue()


def _trabajo(indice: int, receta: list, pedidos=None, id=None) -> Trabajo:
    tipos = ["vista"] + (["antes"] if indice == 0 else []) + (["mascara"] if CLAVES[indice] == "fondo" else []) + (["png", "jpg"] if CLAVES[indice] == "exportar" else [])
    return Trabajo.model_validate(
        {
            "id": id or f"c{indice}",
            "turno": 1,
            "foto": "f1",
            "paso": CLAVES[indice],
            "indice": indice,
            "producto": "Kit de prueba",
            "ajustes": {},
            "pedidos": pedidos,
            "original": {"nombre": "IMG_1.JPG", "tipo": "image/jpeg", "bajar": {"url": "https://deposito/original", "metodo": "GET"}},
            "receta": receta,
            "subidas": {t: {"url": f"https://deposito/{id or f'c{indice}'}/{t}", "metodo": "PUT"} for t in tipos},
        }
    )


def test_los_8_pasos_como_los_pide_la_app(tmp_path):
    pasos = armar_pasos(_segmentador)
    cliente = _ClienteEnMemoria(_original())
    inspector = _InspectorQueCuenta()
    receta: list = []
    hechos = []
    for i in range(8):
        hecho = procesar(_trabajo(i, receta), pasos, inspector, cliente, tmp_path)
        hechos.append(hecho)
        json.dumps(hecho.model_dump(mode="json"))  # se puede mandar a la app
        receta.append({"id": hecho.id, "paso": CLAVES[i], "indice": i, "valores": hecho.valores, "salteado": hecho.no_aplica is not None, "ajustes": {}})

    lente = hechos[0]
    assert lente.no_aplica  # la foto no tiene datos de lente
    assert lente.archivos == ["antes"]
    assert lente.original is not None and (lente.original.ancho, lente.original.alto) == (800, 600)
    assert hechos[1].archivos == ["vista"]
    assert hechos[1].propuesta and hechos[1].propuesta.razon == "Propuesta para perspectiva."
    assert hechos[1].uso_claude == {"costo_usd": 0.01}
    assert {p.clave for p in hechos[1].parametros} >= {"giro"}
    assert set(hechos[5].archivos) == {"vista", "mascara"}
    assert set(hechos[7].archivos) == {"vista", "png", "jpg"}
    # El original se bajó una sola vez; los pasos siguientes usan lo que quedó en la Mac.
    assert cliente.bajadas == 1
    final = Image.open(io.BytesIO(cliente.subidas["https://deposito/c7/jpg"]))
    assert final.size[0] == final.size[1]
    # La vista de Exportar es el JPG final, sobre blanco, no la transparencia a cuadros.
    vista = np.asarray(Image.open(io.BytesIO(cliente.subidas["https://deposito/c7/vista"])).convert("RGB"))
    assert vista[2, 2].min() >= 250


def test_si_la_mac_ya_no_tiene_las_fotos_las_rearma_con_la_receta(tmp_path):
    pasos = armar_pasos(_segmentador)
    cliente = _ClienteEnMemoria(_original())
    inspector = _InspectorQueCuenta()
    receta: list = []
    for i in range(3):
        hecho = procesar(_trabajo(i, receta), pasos, inspector, cliente, tmp_path)
        receta.append({"id": hecho.id, "paso": CLAVES[i], "indice": i, "valores": hecho.valores, "salteado": hecho.no_aplica is not None, "ajustes": {}})
    vista_con_cache = cliente.subidas["https://deposito/c2/vista"]
    # Se borra la carpeta de trabajo: se vuelve a bajar el original y se rehacen los pasos, sin Claude.
    import shutil

    shutil.rmtree(tmp_path / "f1")
    antes = inspector.pedidos
    procesar(_trabajo(2, receta[:2], id="c2"), pasos, inspector, cliente, tmp_path)
    assert cliente.bajadas == 2
    assert inspector.pedidos == antes + 1  # solo el paso pedido
    assert cliente.subidas["https://deposito/c2/vista"] == vista_con_cache


def test_con_valores_pedidos_no_le_pregunta_a_claude(tmp_path):
    pasos = armar_pasos(_segmentador)
    cliente = _ClienteEnMemoria(_original())
    inspector = _InspectorQueCuenta()
    lente = procesar(_trabajo(0, []), pasos, inspector, cliente, tmp_path)
    receta = [{"id": lente.id, "paso": "lente", "indice": 0, "valores": {}, "salteado": True, "ajustes": {}}]
    hecho = procesar(_trabajo(1, receta, pedidos={"giro": 25}), pasos, inspector, cliente, tmp_path)
    assert inspector.pedidos == 0
    assert hecho.propuesta is None
    # Se pidió más que el tope de 10°: se usa el tope y se avisa.
    assert hecho.valores["giro"] == 10
    assert "tope" in (hecho.nota or "")


def test_si_la_app_cancela_no_entrega_nada(tmp_path):
    pasos = armar_pasos(_segmentador)
    cliente = _ClienteEnMemoria(_original())
    with pytest.raises(Cancelado):
        procesar(_trabajo(0, []), pasos, _InspectorQueCuenta(), cliente, tmp_path, cancelado=lambda: True)
    assert cliente.subidas == {}


def test_un_paso_desconocido_pide_actualizar(tmp_path):
    t = _trabajo(1, [])
    t.paso = "otro"
    with pytest.raises(ValueError, match="actualizarlo"):
        procesar(t, armar_pasos(_segmentador), _InspectorQueCuenta(), _ClienteEnMemoria(_original()), tmp_path)
