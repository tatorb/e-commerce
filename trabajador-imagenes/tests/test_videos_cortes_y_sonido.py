"""Los cortes por importancia, las consultas a Claude y el sonido del clip.

Claude y ElevenLabs se simulan: no hace falta ninguna clave.
"""

import json
import subprocess
from types import SimpleNamespace

import pytest

from mrb_videos import hojas
from mrb_videos.cortes import IMPORTANTE, NORMAL, REPETIDO, Momento, ordenar, plan_de_cortes, tiempos_en_el_clip, velocidades
from mrb_videos.inspector import ESQUEMA_CORTES, Contexto, InspectorDeVideo, escribir_guion, palabras_que_entran, proponer_cortes, recortar_palabras
from mrb_videos.linea import Pedido, armar
from mrb_videos.medios import hay_ffmpeg, leer
from mrb_videos.plan import Imagen, Plan, Tramo
from mrb_videos.sonido import ElevenLabs, Linea, Palabra, SinElevenLabs, _motivo, decir_guion, dibujar_franja, grupos_de, mezclar, momentos_de, palabras_de, subtitulos, volumen

con_ffmpeg = pytest.mark.skipif(not hay_ffmpeg(), reason="Falta ffmpeg")

# El unboxing de las cuatro camisas, como se marcó a mano.
CAMISAS = [
    Momento(0, 8, IMPORTANTE, "La caja y su etiqueta"),
    Momento(8, 30, NORMAL, "Abrir la caja"),
    Momento(30, 44, NORMAL, "Desembalar la primera"),
    Momento(44, 56, IMPORTANTE, "La primera en detalle"),
    Momento(56, 104, REPETIDO, "Las otras tres"),
    Momento(104, 106.6, IMPORTANTE, "Las cuatro juntas"),
]


# ───────────────────────────── Las velocidades ─────────────────────────────


@pytest.mark.parametrize("objetivo", [38, 40, 55])
def test_el_clip_dura_lo_pedido_con_lo_importante_a_velocidad_normal(objetivo):
    plan, avisos = plan_de_cortes(CAMISAS, 106.6, Imagen(cuartos=1), objetivo)
    assert plan.dura == pytest.approx(objetivo, abs=0.05)
    assert avisos == []
    por_nivel = {t.importancia: t.velocidad for t in plan.tramos}
    assert por_nivel[IMPORTANTE] == 1
    assert 1.5 <= por_nivel[NORMAL] < por_nivel[REPETIDO] <= 12
    assert por_nivel[REPETIDO] == pytest.approx(por_nivel[NORMAL] * 2.5, rel=0.01)
    assert plan.cierre == 2
    assert [t.nombre for t in plan.tramos] == [m.nombre for m in CAMISAS]


def test_si_lo_importante_no_entra_se_acelera_y_avisa():
    plan, avisos = plan_de_cortes(CAMISAS, 106.6, Imagen(), 20)
    assert plan.dura == pytest.approx(20, abs=0.05)
    assert plan.tramos[0].velocidad > 1 and plan.tramos[4].velocidad == 12
    assert "no entra a velocidad normal" in avisos[0] and avisos[0].endswith("veces más rápido.")


def test_un_video_todo_importante_se_acelera_parejo():
    plan, avisos = plan_de_cortes([Momento(0, 100, IMPORTANTE)], 100, Imagen(), 40)
    assert plan.dura == pytest.approx(40, abs=0.05) and avisos


def test_un_video_que_ya_entra_no_se_estira():
    plan, _ = plan_de_cortes([Momento(0, 20, NORMAL), Momento(20, 30, IMPORTANTE)], 30, Imagen(), 45)
    assert [t.velocidad for t in plan.tramos] == [1.5, 1.0] and plan.cierre == 0
    assert 10 <= plan.dura <= 30


def test_un_video_muy_corto_va_entero_y_llega_al_minimo_con_el_cierre():
    plan, _ = plan_de_cortes([Momento(0, 6, NORMAL)], 6, Imagen(), 45)
    assert plan.tramos[0].velocidad == 1 and plan.dura == pytest.approx(10)


def test_lo_que_no_entra_ni_en_el_maximo_del_canal_no_se_edita():
    with pytest.raises(ValueError, match="no entra"):
        velocidades([Momento(0, 2000, IMPORTANTE)], 45)


def test_los_momentos_quedan_en_orden_pegados_y_cubren_todo_el_video():
    marcados = [Momento(30, 50, IMPORTANTE, "B"), Momento(2, 28, NORMAL, "A"), Momento(49, 49.3, NORMAL, "cortito"), Momento(55, 400, "CUALQUIERA", "C")]
    ordenados = ordenar(marcados, 100)
    assert [(m.inicio, m.fin, m.importancia) for m in ordenados] == [(0, 28, NORMAL), (28, 50, IMPORTANTE), (50, 100, NORMAL)]
    assert ordenar([], 100)[0].fin == 100
    assert ordenar([Momento(0, 0.05)], 30) == [Momento(0.0, 30, NORMAL, "Todo")]


def test_tiempos_en_el_clip():
    plan = Plan(tramos=[Tramo(inicio=0, fin=8, velocidad=1), Tramo(inicio=8, fin=28, velocidad=4)])
    assert tiempos_en_el_clip(plan) == [(0, 8), (8, 13)]


# ───────────────────────────── Claude ─────────────────────────────


class ClienteFalso:
    def __init__(self, textos=(), error=None):
        self.pedidos, self.textos, self.error = [], list(textos), error
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._crear))

    def _crear(self, **pedido):
        self.pedidos.append(pedido)
        if self.error:
            raise self.error
        return SimpleNamespace(
            stop_reason="end_turn",
            model="claude-opus-5-5",
            content=[SimpleNamespace(type="text", text=self.textos.pop(0))],
            usage=SimpleNamespace(input_tokens=5000, output_tokens=300, cache_creation_input_tokens=0, cache_read_input_tokens=0),
        )


MOMENTOS_DEL_PROTOCOLO = [{"texto": "Mostrar la caja y la etiqueta", "importancia": "IMPORTANTE"}, {"texto": "Sacar las demás piezas", "importancia": "REPETIDO"}]


def test_claude_marca_los_cortes_con_las_hojas_y_los_momentos_del_protocolo():
    dicho = {"momentos": [{"inicio": 0, "fin": 8, "importancia": "IMPORTANTE", "nombre": "La caja"}, {"inicio": 8, "fin": 60, "importancia": "REPETIDO", "nombre": "Las piezas"}], "razon": "Seguí  el protocolo."}
    cliente = ClienteFalso([json.dumps(dicho)])
    c = proponer_cortes(InspectorDeVideo(cliente=cliente), [b"hoja1", b"hoja2"], 60, 2, MOMENTOS_DEL_PROTOCOLO, Contexto(producto="Camisas", indicacion="La etiqueta entera."), 40)
    assert c.origen == "claude" and c.razon == "Seguí el protocolo." and c.uso["costo_usd"] > 0
    assert c.momentos == dicho["momentos"]
    pedido = cliente.pedidos[0]
    assert pedido["output_config"]["format"]["schema"] == ESQUEMA_CORTES
    contenido = pedido["messages"][0]["content"]
    assert [x["type"] for x in contenido] == ["image", "image", "text"]
    texto = contenido[-1]["text"]
    assert "1. Mostrar la caja y la etiqueta (IMPORTANTE)" in texto and "2. Sacar las demás piezas (REPETIDO)" in texto
    assert "La etiqueta entera." in texto and "un cuadro cada 2 segundos" in texto and "unos 40 segundos" in texto
    assert "IMPORTANTE: va a velocidad normal" in pedido["system"]


def test_sin_momentos_en_el_protocolo_claude_los_marca_por_lo_que_ve():
    cliente = ClienteFalso([json.dumps({"momentos": [{"inicio": 0, "fin": 30, "importancia": "NORMAL", "nombre": "Todo"}], "razon": "x"})])
    proponer_cortes(InspectorDeVideo(cliente=cliente), [b"h"], 30, 2, [], None, 20)
    assert "marcalos por lo que ves" in cliente.pedidos[0]["messages"][0]["content"][-1]["text"]


def test_si_claude_no_marca_los_cortes_se_avisa_y_no_hay_cortes():
    for cliente in (ClienteFalso(error=RuntimeError("sin conexión")), ClienteFalso(["no es json"]), ClienteFalso([json.dumps({"momentos": [], "razon": "x"})])):
        c = proponer_cortes(InspectorDeVideo(cliente=cliente), [b"h"], 30, 2, [], None, 20)
        assert c.momentos == [] and c.origen == "medido" and "una sola velocidad" in c.avisos[0]
    assert proponer_cortes(InspectorDeVideo(simulado=True), [b"h"], 30, 2, [], None, 20) is None


TRAMOS = [{"nombre": "La caja", "segundos": 8.0, "palabras": 17, "velocidad": 1.0}, {"nombre": "Abrir", "segundos": 2.0, "palabras": 3, "velocidad": 4.0}, {"nombre": "Final", "segundos": 0.5, "palabras": 0, "velocidad": 1.0}]


def test_claude_escribe_una_linea_por_tramo_y_cada_una_entra_en_sus_palabras():
    cliente = ClienteFalso([json.dumps({"lineas": ["Así llega: caja sellada.", "La abrimos y adentro vienen las cuatro.", "Esto no entra."]})])
    g = escribir_guion(InspectorDeVideo(cliente=cliente), b"cuadros", TRAMOS, "Producto: Camisa 384675\nContenido: 4 camisas", Contexto(producto="Camisas"))
    assert g.lineas == ["Así llega: caja sellada.", "La abrimos y.", ""]
    texto = cliente.pedidos[0]["messages"][0]["content"][-1]["text"]
    assert "Ficha del producto:\nProducto: Camisa 384675" in texto
    assert "1. La caja: dura 8.0 segundos en el clip, hasta 17 palabras." in texto
    assert "2. Abrir: dura 2.0 segundos en el clip, hasta 3 palabras. Va acelerado." in texto
    sistema = cliente.pedidos[0]["system"]
    assert "Nada de precios" in sistema and "No inventes" in sistema


def test_si_claude_devuelve_menos_lineas_las_que_faltan_van_en_silencio():
    g = escribir_guion(InspectorDeVideo(cliente=ClienteFalso([json.dumps({"lineas": ["Una sola."]})])), None, TRAMOS, None, None)
    assert g.lineas == ["Una sola.", "", ""]


def test_sin_claude_no_hay_guion():
    assert escribir_guion(InspectorDeVideo(simulado=True), None, TRAMOS, None, None) is None
    g = escribir_guion(InspectorDeVideo(cliente=ClienteFalso(error=RuntimeError("x"))), None, TRAMOS, None, None)
    assert g.lineas == [] and "sin voz en off" in g.avisos[0]


def test_las_palabras_que_entran_en_un_tramo():
    assert palabras_que_entran(8.0) == 17 and palabras_que_entran(0.5) == 0
    assert recortar_palabras("  una   dos tres  ", 5) == "una dos tres"
    assert recortar_palabras("una dos, tres cuatro", 2) == "una dos."
    assert recortar_palabras("una dos", 0) == ""


# ───────────────────────────── ElevenLabs ─────────────────────────────

ALINEACION = {
    "characters": list("Caja sellada."),
    "character_start_times_seconds": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
    "character_end_times_seconds": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
}


def test_de_las_letras_a_las_palabras():
    assert palabras_de(ALINEACION) == [Palabra("Caja", 0.0, 0.4), Palabra("sellada.", 0.5, 1.3)]
    assert palabras_de({}) == []


def test_los_motivos_de_elevenlabs_en_palabras_simples():
    sin_permiso = json.dumps({"detail": {"message": "The API key you used is missing the permission text_to_speech"}})
    assert "dale acceso a Text to Speech y a Music" in _motivo(401, sin_permiso)
    assert "no vale" in _motivo(401, json.dumps({"detail": {"message": "Invalid API key"}}))
    assert "créditos" in _motivo(401, json.dumps({"detail": {"status": "quota_exceeded", "message": "This request exceeds your quota"}}))
    assert "no encontró esa voz" in _motivo(404, "{}")
    assert "empiezan con sk_" in _motivo(400, json.dumps({"detail": {"message": "API key must start with 'sk_'."}}))


def test_sin_clave_de_elevenlabs_se_dice_como_cargarla(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.setattr("mrb_videos.sonido.obtener_clave_elevenlabs", lambda: None)
    with pytest.raises(SinElevenLabs, match="configurar.sh"):
        ElevenLabs.desde_entorno()


def tono(ruta, segundos, frecuencia=440):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency={frecuencia}:duration={segundos}", "-b:a", "128k", str(ruta)], check=True)
    return ruta.read_bytes()


class ElevenFalso:
    """Dice cada línea con un tono que dura según sus palabras, y hace música con otro tono."""

    def __init__(self, carpeta, falla=None):
        self.carpeta, self.falla, self.dichas, self.musicas = carpeta, falla, [], []

    def decir(self, texto, voz, anterior="", siguiente=""):
        if self.falla:
            raise self.falla
        self.dichas.append({"texto": texto, "voz": voz, "anterior": anterior, "siguiente": siguiente})
        palabras, t = [], 0.0
        for palabra in texto.split():
            palabras.append(Palabra(palabra, t, t + 0.35))
            t += 0.4
        return tono(self.carpeta / f"tono_{len(self.dichas)}.mp3", max(t, 0.5)), palabras

    def musica(self, estilo, segundos):
        self.musicas.append((estilo, segundos))
        return tono(self.carpeta / "musica_falsa.mp3", 6, 220)


@con_ffmpeg
def test_cada_linea_va_donde_empieza_su_tramo_y_nunca_encima_de_la_anterior(tmp_path):
    eleven = ElevenFalso(tmp_path)
    lineas = ["Una dos tres cuatro cinco seis siete ocho nueve diez.", "", "Otra línea corta.", "Fin."]
    dichas = decir_guion(eleven, lineas, [(0, 2), (2, 3), (3, 9), (9, 12)], "voz1", tmp_path / "voz")
    assert [d.texto for d in dichas] == [lineas[0], lineas[2], lineas[3]]
    # La primera dura 4 s y pisa el tramo siguiente: la segunda espera a que termine.
    assert dichas[0].inicio == pytest.approx(0.3) and dichas[0].fin == pytest.approx(4.3, abs=0.15)
    assert dichas[1].inicio == pytest.approx(dichas[0].fin + 0.25, abs=0.01)
    assert dichas[2].inicio == pytest.approx(9.3)
    # Cada pedido lleva lo que se dijo antes y lo que sigue, para la entonación.
    assert eleven.dichas[1] == {"texto": "Otra línea corta.", "voz": "voz1", "anterior": lineas[0], "siguiente": "Fin."}


@con_ffmpeg
def test_la_mezcla_dura_lo_que_el_clip_con_voz_musica_o_las_dos(tmp_path):
    eleven = ElevenFalso(tmp_path)
    dichas = decir_guion(eleven, ["Una dos tres cuatro.", "Cinco seis."], [(0, 4), (4, 8)], "v", tmp_path / "voz")
    musica = tmp_path / "m.mp3"
    musica.write_bytes(eleven.musica("x", 6))
    for nombre, lineas, pista in [("todo", dichas, musica), ("voz", dichas, None), ("musica", [], musica)]:
        salida = mezclar(lineas, pista, 9.0, tmp_path / f"{nombre}.wav")
        assert leer_audio(salida) == pytest.approx(9.0, abs=0.1)
        assert -30 < volumen(salida) < -8
    with pytest.raises(ValueError):
        mezclar([], None, 9.0, tmp_path / "nada.wav")


def leer_audio(ruta) -> float:
    dicho = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)], capture_output=True, text=True).stdout
    return float(dicho)


def test_los_subtitulos_van_de_a_pocas_palabras_con_la_que_se_dice_resaltada(tmp_path):
    from PIL import Image

    palabras = [Palabra(p, i * 0.4, i * 0.4 + 0.35) for i, p in enumerate("Así llega tu juego de camisas: caja {sellada}.".split())]
    assert [[p.texto for p in g] for g in grupos_de(palabras)] == [["Así", "llega", "tu"], ["juego", "de", "camisas:"], ["caja", "{sellada}."]]
    linea = Linea("x", 10.0, 13.6, tmp_path / "a.mp3", palabras)
    momentos = momentos_de([linea])
    assert len(momentos) == len(palabras)
    # La primera palabra, resaltada desde el segundo 10 hasta que empieza la segunda.
    assert momentos[0] == (pytest.approx(10.0), pytest.approx(10.4), ["Así", "llega", "tu"], 0)
    assert momentos[3][2:] == (["juego", "de", "camisas:"], 0)
    assert all(a[1] <= b[0] + 1e-9 for a, b in zip(momentos, momentos[1:]))

    s = subtitulos([linea], tmp_path / "subs", 20.0)
    renglones = s.lista.read_text().splitlines()
    assert renglones[0] == "ffconcat version 1.0"
    # Empieza con la franja vacía hasta la primera palabra, y la última imagen va dos veces.
    assert renglones[1:3] == ["file 'vacia.png'", "duration 10.000"]
    assert renglones[3:5] == ["file 's0000.png'", "duration 0.400"]
    assert renglones[-1] == "file 'vacia.png'" and renglones[-3] == "file 'vacia.png'"
    duraciones = [float(r.split()[1]) for r in renglones if r.startswith("duration")]
    assert sum(duraciones) >= 20.0 and all(d > 0 for d in duraciones)
    # Las franjas son transparentes, del ancho del clip, y tienen algo dibujado.
    with Image.open(tmp_path / "subs" / "s0000.png") as franja:
        assert franja.mode == "RGBA" and franja.width == 1080 and franja.height % 2 == 0
        assert franja.getpixel((2, 2))[3] == 0 and franja.getbbox() is not None
        assert s.y + franja.height == round(1920 * 0.8)
    with Image.open(tmp_path / "subs" / "vacia.png") as vacia:
        assert vacia.getbbox() is None


def test_una_frase_larga_achica_la_letra_para_entrar(tmp_path):
    franja = dibujar_franja(["Extraordinariamente", "larguísima", "palabrota"], 1, 1080, 160, 70)
    caja = franja.getbbox()
    assert caja is not None and caja[0] > 20 and caja[2] < 1060
    # La palabra que se dice va en amarillo y las otras en blanco.
    colores = {franja.getpixel((x, 80))[:3] for x in range(0, 1080, 2) if franja.getpixel((x, 80))[3] == 255}
    assert (255, 230, 51) in colores and (255, 255, 255) in colores
    # Con el color de la cuenta, va en ese.
    verde = dibujar_franja(["Caja", "sellada"], 1, 1080, 160, 70, "#6FA82C")
    colores = {verde.getpixel((x, 80))[:3] for x in range(0, 1080, 2) if verde.getpixel((x, 80))[3] == 255}
    assert (111, 168, 44) in colores and (255, 230, 51) not in colores


def test_un_color_que_no_vale_deja_el_de_siempre():
    from mrb_videos.sonido import color_de

    assert color_de("#6FA82C") == (111, 168, 44, 255) and color_de("6fa82c") == (111, 168, 44, 255)
    for malo in (None, "", "verde", "#12", "#GGGGGG"):
        assert color_de(malo) == (255, 230, 51, 255)


def test_la_letra_de_los_subtitulos_viene_con_el_programa():
    from mrb_videos.sonido import LETRAS, _letra

    assert LETRAS[0].endswith("letras/Poppins-Bold.woff")
    assert _letra(60).getname()[0] == "Poppins"


# ───────────────────────────── De punta a punta ─────────────────────────────


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    ruta = tmp_path_factory.mktemp("grabado") / "DJI_0002_D.MP4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=40", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(ruta)],
        check=True,
    )
    return ruta


CORTES = [
    {"inicio": 0, "fin": 6, "importancia": "IMPORTANTE", "nombre": "La caja"},
    {"inicio": 6, "fin": 34, "importancia": "REPETIDO", "nombre": "Las piezas"},
    {"inicio": 34, "fin": 40, "importancia": "IMPORTANTE", "nombre": "Todo junto"},
]


@con_ffmpeg
def test_un_clip_completo_con_cortes_de_claude_guion_voz_musica_y_subtitulos(video, tmp_path):
    fuente = leer(video)
    claude = ClienteFalso(
        [
            json.dumps({"valores": {"cuartos": 1, "enderezado": 0, "zoom": 1, "centro_x": 0.5, "centro_y": 0.5, "rojo": 1, "verde": 1, "azul": 1, "contraste": 1, "saturacion": 1}, "razon": "Girado."}),
            json.dumps({"momentos": CORTES, "razon": "Tres momentos."}),
            json.dumps({"lineas": ["Así llega la caja, sellada de fábrica.", "", "Todo listo para colocar."]}),
        ]
    )
    eleven = ElevenFalso(tmp_path)
    pedido = Pedido(objetivo=20, momentos=MOMENTOS_DEL_PROTOCOLO, ficha="Producto: Camisa", voz="voz1", musica="Suave, sin voces.", subtitulos=True)
    r = armar(fuente, fuente, pedido, InspectorDeVideo(cliente=claude), tmp_path / "trabajo", tmp_path / "clip.mp4", eleven=lambda: eleven)

    assert len(claude.pedidos) == 3
    assert r.origen == "claude" and r.razon == "Girado. Tres momentos."
    assert [(t.nombre, t.importancia, t.velocidad == 1) for t in r.plan.tramos] == [("La caja", "IMPORTANTE", True), ("Las piezas", "REPETIDO", False), ("Todo junto", "IMPORTANTE", True)]
    assert r.clip.duracion == pytest.approx(20, abs=0.4) and (r.clip.ancho, r.clip.alto) == (1080, 1920)
    assert [linea.texto for linea in r.guion] == ["Así llega la caja, sellada de fábrica.", "Todo listo para colocar."]
    # La última línea va cuando empieza el último tramo.
    assert r.guion[1].inicio == pytest.approx(tiempos_en_el_clip(r.plan)[2][0] + 0.3, abs=0.01)
    assert r.con_musica and r.con_subtitulos and r.volumen_lufs is not None
    assert eleven.musicas == [("Suave, sin voces.", pytest.approx(r.plan.dura))]
    assert r.costo_usd > 0
    assert leer(r.clip.ruta).tiene_audio


@con_ffmpeg
def test_el_guion_pedido_se_dice_tal_cual_y_si_no_entra_se_estira_el_cierre(video, tmp_path):
    fuente = leer(video)
    eleven = ElevenFalso(tmp_path)
    largo = "Esta última línea es bastante más larga que lo que queda del clip."
    plan = Plan(imagen=Imagen(cuartos=1), tramos=[Tramo(inicio=0, fin=10, velocidad=1), Tramo(inicio=10, fin=40, velocidad=10)], cierre=0)
    r = armar(fuente, fuente, Pedido(plan=plan, guion=["Hola.", largo], voz="v"), InspectorDeVideo(simulado=True), tmp_path / "t", tmp_path / "clip.mp4", eleven=lambda: eleven)
    assert r.origen == "pedido"
    assert [linea.texto for linea in r.guion] == ["Hola.", largo]
    assert r.plan.cierre > 0 and r.guion[-1].fin <= r.plan.dura
    assert not r.con_musica and not r.con_subtitulos and eleven.musicas == []


@con_ffmpeg
def test_sin_claude_no_hay_cortes_ni_voz_pero_la_musica_va(video, tmp_path):
    fuente = leer(video)
    eleven = ElevenFalso(tmp_path)
    r = armar(fuente, fuente, Pedido(objetivo=15, voz="v", musica="Suave.", subtitulos=True, cuartos=1), InspectorDeVideo(simulado=True), tmp_path / "t", tmp_path / "clip.mp4", eleven=lambda: eleven)
    assert len(r.plan.tramos) == 1 and r.guion == [] and r.con_musica and not r.con_subtitulos
    assert any("sin voz en off" in a for a in r.avisos)


@con_ffmpeg
def test_si_elevenlabs_falla_el_clip_sale_en_silencio_con_su_aviso(video, tmp_path):
    fuente = leer(video)
    eleven = ElevenFalso(tmp_path, falla=SinElevenLabs("La cuenta de ElevenLabs no tiene créditos."))
    plan = Plan(imagen=Imagen(cuartos=1), tramos=[Tramo(inicio=0, fin=40, velocidad=3)])
    r = armar(fuente, fuente, Pedido(plan=plan, guion=["Hola."], voz="v", musica="Suave."), InspectorDeVideo(simulado=True), tmp_path / "t", tmp_path / "clip.mp4", eleven=lambda: eleven)
    assert r.guion == [] and not r.con_musica and r.volumen_lufs is None
    assert r.avisos[-1] == "El clip salió sin sonido. La cuenta de ElevenLabs no tiene créditos."
    assert r.clip.duracion == pytest.approx(13.3, abs=0.4)


@con_ffmpeg
def test_un_cuadro_por_tramo_para_el_guion(video):
    import io

    from PIL import Image

    with Image.open(io.BytesIO(hojas.de_tramos(leer(video), [3, 20, 37], cuartos=1, columnas=4, ancho=90))) as hoja:
        assert hoja.size == (3 * 90, 160)




@con_ffmpeg
def test_los_subtitulos_se_pegan_como_imagenes_y_si_fallan_el_clip_sale_sin_ellos(video, tmp_path, monkeypatch):
    from mrb_videos import linea
    from mrb_videos.filtros import grafo

    fuente = leer(video)
    plan = Plan(imagen=Imagen(cuartos=1), tramos=[Tramo(inicio=0, fin=40, velocidad=3)])
    # No se usa nada de ffmpeg que escriba texto: las imágenes llegan como una entrada más y se pegan encima.
    g = grafo(fuente, plan, subtitulos_y=1400)
    assert "[2:v]format=rgba[sub]" in g and "[base][sub]overlay=0:1400:eof_action=pass" in g
    assert "subtitles" not in g and "ass=" not in g and "drawtext" not in g
    assert "overlay" not in grafo(fuente, plan)

    pedido = Pedido(plan=plan, guion=["Hola a todos, así llega la caja."], voz="v", subtitulos=True)
    r = armar(fuente, fuente, pedido, InspectorDeVideo(simulado=True), tmp_path / "t0", tmp_path / "clip0.mp4", eleven=lambda: ElevenFalso(tmp_path))
    assert r.con_subtitulos and r.avisos == [a for a in r.avisos if "subtítulos" not in a]
    # En el momento en que se dice la primera palabra hay algo amarillo en la franja de los subtítulos.
    cuadro = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{r.guion[0].inicio + 0.1:.2f}", "-i", str(r.clip.ruta), "-frames:v", "1", "-vf", "crop=1080:200:0:1380", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    puntos = [cuadro[i : i + 3] for i in range(0, len(cuadro), 3 * 7)]
    assert sum(1 for p in puntos if p[0] > 200 and p[1] > 180 and p[2] < 120) > 20

    # Si pegar los subtítulos falla, el clip sale igual, con su aviso.
    real = linea.exportar
    monkeypatch.setattr(linea, "exportar", lambda *a, **k: (_ for _ in ()).throw(linea.VideoIlegible("no se pudo")) if k.get("subtitulos") else real(*a, **k))
    r = armar(fuente, fuente, pedido, InspectorDeVideo(simulado=True), tmp_path / "t", tmp_path / "clip.mp4", eleven=lambda: ElevenFalso(tmp_path))
    assert not r.con_subtitulos and r.guion and r.avisos[-1] == "El clip salió sin subtítulos: ffmpeg no los pudo escribir."


@con_ffmpeg
def test_la_edicion_va_contando_en_que_anda(video, tmp_path):
    fuente = leer(video)
    claude = ClienteFalso(
        [
            json.dumps({"valores": {"cuartos": 1, "enderezado": 0, "zoom": 1, "centro_x": 0.5, "centro_y": 0.5, "rojo": 1, "verde": 1, "azul": 1, "contraste": 1, "saturacion": 1}, "razon": "Girado."}),
            json.dumps({"momentos": CORTES, "razon": "Tres momentos."}),
            json.dumps({"lineas": ["Así llega la caja.", "", "Todo listo."]}),
        ]
    )
    dicho = []
    eleven = ElevenFalso(tmp_path)
    armar(
        fuente, fuente, Pedido(objetivo=20, voz="v", musica="Suave.", subtitulos=True), InspectorDeVideo(cliente=claude),
        tmp_path / "t", tmp_path / "clip.mp4", eleven=lambda: eleven, informar=lambda etapa, porcentaje=None: dicho.append((etapa, porcentaje)),
    )
    etapas = list(dict.fromkeys(e for e, _ in dicho))
    assert etapas == [
        "Midiendo la luz y el color",
        "Claude mira la imagen",
        "Claude marca los cortes",
        "Claude escribe el guión",
        "Generando la voz, línea 1 de 2",
        "Generando la voz, línea 2 de 2",
        "Generando la música",
        "Mezclando el sonido",
        "Dibujando los subtítulos",
        "Exportando el clip",
    ]
    de_exportar = [p for e, p in dicho if e == "Exportando el clip"]
    assert de_exportar[0] == 0 and all(0 <= p <= 100 for p in de_exportar) and de_exportar == sorted(de_exportar)


def test_lo_que_lleva_ffmpeg_se_lee_de_su_archivo_de_avance(tmp_path):
    from mrb_videos.editar import _lleva

    cuenta = tmp_path / "clip.mp4.avance"
    assert _lleva(cuenta, 40) == 0
    cuenta.write_text("frame=10\nout_time_us=10000000\nprogress=continue\nframe=20\nout_time_us=20000000\nout_time_ms=20000000\nprogress=continue\n")
    assert _lleva(cuenta, 40) == 0.5
    cuenta.write_text("out_time_us=N/A\n")
    assert _lleva(cuenta, 40) == 0
    cuenta.write_text("out_time_us=99000000\n")
    assert _lleva(cuenta, 40) == 1
