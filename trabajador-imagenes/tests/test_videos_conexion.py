"""El editor de videos conectado: los mensajes con la app y una edición de punta a punta.

La app y el Drive se simulan con un servidor local.
"""

import json
import shutil
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from mrb_imagenes.app import ClienteApp, ErrorDeApp, Transferencia
from mrb_videos import conexion
from mrb_videos.conexion import PROTOCOLO, ArchivoDelDrive, SiguienteVideo, VideoFallido, VideoHecho, bajar_en_pedazos
from mrb_videos.inspector import InspectorDeVideo
from mrb_videos.medios import Cancelado, hay_ffmpeg, leer
from mrb_videos.plan import Imagen, Plan, Tramo
from mrb_videos.trabajo import buscar_en_el_drive, procesar_video

CONTRATO = Path(__file__).resolve().parents[1] / "contrato"
con_ffmpeg = pytest.mark.skipif(not hay_ffmpeg(), reason="Falta ffmpeg")


def ejemplo(nombre: str) -> dict:
    return json.loads((CONTRATO / nombre).read_text())


# ───────────────────────────── El contrato ─────────────────────────────


def test_entiende_el_trabajo_de_ejemplo():
    r = SiguienteVideo.model_validate(ejemplo("video_trabajo.json"))
    t = r.trabajo
    assert t is not None and r.volver_en == 10
    assert (t.objetivo_segundos, t.plan, t.reglas.alto) == (40, None, 1920)
    assert t.video_del_protocolo.indicaciones == "Mostrar bien la primera pieza."
    assert t.original.carpeta[-1] == "Videos" and t.liviana.nombre == "DJI_0073_D.LRF"
    assert t.subidas["clip"].metodo == "PUT"
    assert [m.importancia for m in t.momentos] == ["IMPORTANTE", "NORMAL", "IMPORTANTE", "REPETIDO"]
    assert t.ficha.startswith("Producto: Camisa") and t.guion is None
    assert (t.sonido.voz.id, t.sonido.musica.estilo, t.sonido.subtitulos) == ("voz-de-prueba", "Instrumental suave, sin voces.", True)


def test_un_trabajo_de_una_app_anterior_se_entiende_igual():
    # Una app sin los cortes ni el sonido no manda esos datos: el clip sale a una sola velocidad y en silencio.
    datos = ejemplo("video_trabajo.json")["trabajo"]
    for clave in ("momentos", "ficha", "guion", "sonido"):
        del datos[clave]
    t = conexion.TrabajoDeVideo.model_validate(datos)
    assert t.momentos == [] and t.sonido is None and t.guion is None


def test_el_resultado_tiene_la_forma_del_ejemplo():
    for nombre, modelo in [("video_resultado.json", VideoHecho), ("video_fallo.json", VideoFallido)]:
        datos = ejemplo(nombre)
        assert datos["protocolo"] == PROTOCOLO
        assert modelo.model_validate(datos).model_dump(mode="json") == datos


def test_la_version_de_los_mensajes_es_la_de_la_app():
    app = Path(__file__).resolve().parents[2] / "src" / "domain" / "video-edit.ts"
    if not app.exists():
        pytest.skip("Sin el código de la app al lado.")
    assert f"export const VIDEO_PROTOCOL = {PROTOCOLO};" in app.read_text()


# ───────────────────────────── La app simulada ─────────────────────────────


class _App(BaseHTTPRequestHandler):
    recibido: list = []
    archivos: dict = {}
    subido: dict = {}
    vigente = True

    def log_message(self, *a):
        pass

    def _responder(self, estado: int, cuerpo: bytes, encabezados: dict | None = None):
        self.send_response(estado)
        for k, v in (encabezados or {"Content-Type": "application/json"}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_POST(self):
        cuerpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        _App.recibido.append((self.path, self.headers.get("Authorization"), cuerpo))
        if self.path.endswith("/siguiente"):
            return self._responder(200, json.dumps({"trabajo": None, "volver_en": 120, "motivo": "La edición de videos está apagada."}).encode())
        if self.path.endswith("/latido"):
            return self._responder(200, json.dumps({"vigente": _App.vigente}).encode())
        return self._responder(200, json.dumps({"aceptado": True}).encode())

    def do_GET(self):
        nombre = self.path.split("cual=")[-1]
        _App.recibido.append((self.path, self.headers.get("Authorization"), self.headers.get("Range")))
        datos = _App.archivos.get(nombre)
        if datos is None:
            return self._responder(404, json.dumps({"error": "Ese video no se está editando."}).encode())
        inicio, fin = (int(x) for x in self.headers["Range"].removeprefix("bytes=").split("-"))
        pedazo = datos[inicio : fin + 1]
        self._responder(206, pedazo, {"Content-Type": "application/octet-stream", "Content-Range": f"bytes {inicio}-{inicio + len(pedazo) - 1}/{len(datos)}"})

    def do_PUT(self):
        _App.subido[self.path] = (self.headers.get("Content-Type"), self.rfile.read(int(self.headers["Content-Length"])))
        self._responder(200, b"{}")


@pytest.fixture
def app():
    _App.recibido, _App.archivos, _App.subido, _App.vigente = [], {}, {}, True
    servidor = HTTPServer(("127.0.0.1", 0), _App)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{servidor.server_port}"
    yield base, ClienteApp(base, "mrbimg_buena")
    servidor.shutdown()


def archivo(base: str, cual: str, datos: bytes | None, carpeta=None, nombre="DJI_0001_D.MP4", pedazo=1000) -> ArchivoDelDrive:
    return ArchivoDelDrive(
        nombre=nombre,
        bytes=len(datos) if datos is not None else None,
        carpeta=carpeta or [],
        bajar=Transferencia(url=f"{base}/api/videos/trabajador/original?video=v1&cual={cual}", metodo="GET"),
        pedazo=pedazo,
    )


def test_pregunta_con_la_hora_y_la_bateria_y_recibe_el_motivo(app):
    _, cliente = app
    r = conexion.siguiente(cliente, "0.1.0", 23 * 60, True)
    assert r.trabajo is None and r.motivo == "La edición de videos está apagada."
    ruta, llave, cuerpo = _App.recibido[-1]
    assert ruta == "/api/videos/trabajador/siguiente" and llave == "Bearer mrbimg_buena"
    assert cuerpo == {"protocolo": PROTOCOLO, "version": "0.1.0", "minuto": 1380, "enchufada": True}
    assert conexion.latido(cliente, "e1", 1) is True
    _App.vigente = False
    assert conexion.latido(cliente, "e1", 1) is False


def test_baja_de_a_pedazos_con_la_llave(app, tmp_path):
    base, cliente = app
    datos = bytes(range(256)) * 13  # 3328 bytes: cuatro pedazos de 1000
    _App.archivos["original"] = datos
    destino = tmp_path / "bajado.mp4"
    bajar_en_pedazos(cliente, archivo(base, "original", datos), destino)
    assert destino.read_bytes() == datos
    pedidos = [r for r in _App.recibido if "cual=original" in r[0]]
    assert [p[2] for p in pedidos] == ["bytes=0-999", "bytes=1000-1999", "bytes=2000-2999", "bytes=3000-3999"]
    assert all(p[1] == "Bearer mrbimg_buena" for p in pedidos)
    # Sin saber el peso de antemano, lo toma de la respuesta.
    bajar_en_pedazos(cliente, archivo(base, "original", None), tmp_path / "otro.mp4")
    assert (tmp_path / "otro.mp4").read_bytes() == datos


def test_bajar_se_corta_si_se_cancela_o_si_el_archivo_no_esta(app, tmp_path):
    base, cliente = app
    _App.archivos["original"] = b"x" * 5000
    with pytest.raises(Cancelado):
        bajar_en_pedazos(cliente, archivo(base, "original", b"x" * 5000), tmp_path / "a.mp4", cancelado=lambda: True)
    with pytest.raises(ErrorDeApp, match="no se está editando"):
        bajar_en_pedazos(cliente, archivo(base, "liviana", b"x" * 10), tmp_path / "b.mp4")
    assert not (tmp_path / "a.mp4").exists() and not (tmp_path / "b.mp4").exists()


# ───────────────────────────── La carpeta de Google Drive ─────────────────────────────

CARPETA = ["E-commerce Studio MRB", "Cuenta de prueba", "Camisa 384675", "Videos"]


def test_encuentra_el_video_en_la_carpeta_de_google_drive(tmp_path, monkeypatch):
    monkeypatch.setenv("MRB_DRIVE", str(tmp_path))
    pedido = ArchivoDelDrive(nombre="DJI_0001_D.MP4", bytes=4, carpeta=CARPETA, bajar=Transferencia(url="http://x", metodo="GET"))
    assert buscar_en_el_drive(pedido) is None
    en_mi_unidad = tmp_path.joinpath("Mi unidad", *CARPETA)
    en_mi_unidad.mkdir(parents=True)
    (en_mi_unidad / "DJI_0001_D.MP4").write_bytes(b"1234")
    assert buscar_en_el_drive(pedido) == en_mi_unidad / "DJI_0001_D.MP4"
    # Con otro peso no es el mismo archivo: puede estar a medio copiar.
    assert buscar_en_el_drive(pedido.model_copy(update={"bytes": 9})) is None
    assert buscar_en_el_drive(pedido.model_copy(update={"bytes": None})) is not None


def test_tambien_lo_encuentra_en_una_unidad_compartida(tmp_path, monkeypatch):
    monkeypatch.setenv("MRB_DRIVE", str(tmp_path))
    carpeta = tmp_path.joinpath("Unidades compartidas", "Estudio", *CARPETA)
    carpeta.mkdir(parents=True)
    (carpeta / "DJI_0001_D.MP4").write_bytes(b"1234")
    pedido = ArchivoDelDrive(nombre="DJI_0001_D.MP4", bytes=4, carpeta=CARPETA, bajar=Transferencia(url="http://x", metodo="GET"))
    assert buscar_en_el_drive(pedido) == carpeta / "DJI_0001_D.MP4"


# ───────────────────────────── Una edición de punta a punta ─────────────────────────────


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    ruta = tmp_path_factory.mktemp("grabado") / "DJI_0001_D.MP4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=24", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(ruta)],
        check=True,
    )
    return ruta


def trabajo_de(base: str, original: ArchivoDelDrive, **extra) -> conexion.TrabajoDeVideo:
    return conexion.TrabajoDeVideo(
        id="e1",
        turno=2,
        video="v1",
        producto="Camisa de cilindro: Camisa 384675",
        objetivo_segundos=12,
        original=original,
        subidas={"clip": Transferencia(url=f"{base}/subir/clip", metodo="PUT", encabezados={"Content-Type": "video/mp4"})},
        **extra,
    )


@con_ffmpeg
def test_edita_un_video_de_la_carpeta_del_drive_y_sube_el_clip(app, video, tmp_path, monkeypatch):
    base, cliente = app
    monkeypatch.setenv("MRB_DRIVE", str(tmp_path / "drive"))
    carpeta = tmp_path.joinpath("drive", "Mi unidad", *CARPETA)
    carpeta.mkdir(parents=True)
    shutil.copy(video, carpeta / video.name)
    original = archivo(base, "original", video.read_bytes(), carpeta=CARPETA)
    hecho = procesar_video(trabajo_de(base, original), InspectorDeVideo(simulado=True), cliente, tmp_path / "trabajo", lambda: False)

    assert (hecho.id, hecho.turno, hecho.ok) == ("e1", 2, True)
    # Sin Claude, un video horizontal se gira un cuarto y va todo a una velocidad.
    assert hecho.plan.imagen.cuartos == 1 and hecho.propuesta.origen == "simulado"
    assert hecho.plan.tramos[0].velocidad == pytest.approx(2, abs=0.05)
    assert (hecho.clip.ancho, hecho.clip.alto) == (1080, 1920)
    assert hecho.clip.segundos == pytest.approx(12, abs=0.4)
    tipo, subido = _App.subido["/subir/clip"]
    assert tipo == "video/mp4" and len(subido) == hecho.clip.bytes
    (tmp_path / "subido.mp4").write_bytes(subido)
    assert leer(tmp_path / "subido.mp4").vertical
    # No lo bajó: estaba en la Mac. Y en la Mac no queda nada de la edición.
    assert not [r for r in _App.recibido if "cual=" in r[0]]
    assert not (tmp_path / "trabajo" / "video-v1").exists()
    assert (carpeta / video.name).read_bytes() == video.read_bytes()
    # El resultado tiene la forma que espera la app.
    assert sorted(hecho.model_dump(mode="json")) == sorted(ejemplo("video_resultado.json"))
    assert hecho.guion is None and hecho.sonido is None


@con_ffmpeg
def test_si_no_esta_en_la_mac_lo_baja_y_aplica_el_plan_pedido(app, video, tmp_path, monkeypatch):
    base, cliente = app
    monkeypatch.setenv("MRB_DRIVE", str(tmp_path / "vacio"))
    datos = video.read_bytes()
    _App.archivos["original"] = datos
    plan = Plan(imagen=Imagen(cuartos=3), tramos=[Tramo(inicio=0, fin=10, velocidad=1), Tramo(inicio=10, fin=24, velocidad=7)], cierre=1)
    hecho = procesar_video(trabajo_de(base, archivo(base, "original", datos, carpeta=CARPETA, pedazo=200_000), plan=plan), InspectorDeVideo(simulado=True), cliente, tmp_path / "trabajo", lambda: False)
    assert hecho.plan == plan and hecho.propuesta.origen == "pedido"
    assert hecho.clip.segundos == pytest.approx(13, abs=0.4)
    assert len([r for r in _App.recibido if "cual=original" in r[0]]) == -(-len(datos) // 200_000)


@con_ffmpeg
def test_si_se_cancela_no_sube_nada_ni_deja_archivos(app, video, tmp_path, monkeypatch):
    base, cliente = app
    monkeypatch.setenv("MRB_DRIVE", str(tmp_path / "vacio"))
    _App.archivos["original"] = video.read_bytes()
    # Se cancela apenas empieza a exportar: cuando aparece el clip a medio hacer.
    clip = tmp_path / "trabajo" / "video-v1" / "clip.mp4"
    with pytest.raises(Cancelado):
        procesar_video(trabajo_de(base, archivo(base, "original", video.read_bytes(), pedazo=500_000)), InspectorDeVideo(simulado=True), cliente, tmp_path / "trabajo", clip.exists)
    assert _App.subido == {}
    assert not (tmp_path / "trabajo" / "video-v1").exists()
