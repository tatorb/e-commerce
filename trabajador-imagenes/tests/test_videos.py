"""El editor de videos, con un video sintético: no hace falta ninguna grabación real."""

import shutil
import subprocess

import numpy as np
import pytest
from pydantic import ValidationError

from mrb_videos import hojas
from mrb_videos.editar import PlanInvalido, exportar
from mrb_videos.filtros import grafo, recorte
from mrb_videos.medios import Fuente, VideoIlegible, copia_liviana, es_copia_liviana, leer, para_mirar
from mrb_videos.medir import medir
from mrb_videos.plan import Imagen, Plan, Tramo, plan_parejo, revisar

con_ffmpeg = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="Falta ffmpeg")


def fuente_de_prueba(ancho=3840, alto=2160, duracion=106.6) -> Fuente:
    return Fuente(ruta="x.mp4", ancho=ancho, alto=alto, fps=25.0, duracion=duracion, codec="hevc", bits=10, tiene_audio=True)


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    """Veinte segundos horizontales, con sonido, como los graba la cámara."""
    ruta = tmp_path_factory.mktemp("video") / "DJI_0001_D.MP4"
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=20",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=20", "-c:v", "libx264", "-preset", "ultrafast",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(ruta),
        ],
        check=True,
    )
    return ruta


# ───────────────────────────── El plan ─────────────────────────────


def test_el_plan_dura_la_suma_de_sus_tramos_y_el_cierre():
    plan = Plan(tramos=[Tramo(inicio=0, fin=8, velocidad=2), Tramo(inicio=8, fin=20, velocidad=4), Tramo(inicio=20, fin=32)], cierre=2)
    assert plan.dura == pytest.approx(4 + 3 + 12 + 2)


def test_los_tramos_no_se_pisan_ni_van_al_reves():
    with pytest.raises(ValidationError):
        Plan(tramos=[Tramo(inicio=0, fin=10), Tramo(inicio=8, fin=20)])
    with pytest.raises(ValidationError):
        Tramo(inicio=10, fin=5)


def test_la_velocidad_y_la_correccion_tienen_topes():
    with pytest.raises(ValidationError):
        Tramo(inicio=0, fin=10, velocidad=40)
    with pytest.raises(ValidationError):
        Imagen(rojo=3.0)
    with pytest.raises(ValidationError):
        Imagen(cuartos=4)


def test_plan_parejo_lleva_el_video_a_lo_pedido():
    plan = plan_parejo(fuente_de_prueba(), objetivo=45)
    assert plan.dura == pytest.approx(45, abs=0.1)
    assert revisar(plan, fuente_de_prueba()) == []


def test_plan_parejo_no_frena_un_video_corto():
    plan = plan_parejo(fuente_de_prueba(duracion=30), objetivo=45)
    assert plan.tramos[0].velocidad == 1
    assert plan.dura == pytest.approx(30)


def test_plan_parejo_no_acepta_lo_que_no_entra_en_un_clip():
    with pytest.raises(ValueError):
        plan_parejo(fuente_de_prueba(duracion=6))
    with pytest.raises(ValueError):
        plan_parejo(fuente_de_prueba(duracion=3600))


def test_revisar_avisa_lo_que_el_canal_no_acepta():
    fuente = fuente_de_prueba()
    assert "máximo" in revisar(Plan(tramos=[Tramo(inicio=0, fin=100)]), fuente)[0]
    assert "mínimo" in revisar(Plan(tramos=[Tramo(inicio=0, fin=5)]), fuente)[0]
    assert "dura" in revisar(Plan(tramos=[Tramo(inicio=0, fin=200, velocidad=5)]), fuente)[0]


# ───────────────────────────── La imagen ─────────────────────────────


def test_un_video_horizontal_girado_entra_entero():
    assert recorte(fuente_de_prueba(), Imagen(cuartos=1)) == recorte(fuente_de_prueba(), Imagen(cuartos=3))
    r = recorte(fuente_de_prueba(), Imagen(cuartos=1))
    assert (r.ancho, r.alto, r.x, r.y) == (2160, 3840, 0, 0)


def test_sin_girar_se_toma_la_franja_del_medio():
    r = recorte(fuente_de_prueba(), Imagen())
    assert r.alto == 2160
    assert r.ancho == pytest.approx(2160 * 9 / 16, abs=2)
    assert r.x == pytest.approx((3840 - r.ancho) / 2, abs=1)


def test_el_centro_corre_la_franja_sin_salirse():
    izquierda = recorte(fuente_de_prueba(), Imagen(centro_x=0))
    derecha = recorte(fuente_de_prueba(), Imagen(centro_x=1))
    assert izquierda.x == 0
    assert derecha.x + derecha.ancho == pytest.approx(3840, abs=2)


def test_enderezar_y_acercar_achican_el_recorte_y_queda_adentro():
    fuente = fuente_de_prueba()
    base = recorte(fuente, Imagen(cuartos=1))
    for imagen in (Imagen(cuartos=1, enderezado=3), Imagen(cuartos=1, zoom=1.5), Imagen(cuartos=1, enderezado=-5, zoom=1.2, centro_x=1, centro_y=0)):
        r = recorte(fuente, imagen)
        assert r.ancho < base.ancho and r.alto < base.alto
        assert r.x >= 0 and r.y >= 0 and r.x + r.ancho <= 2160 and r.y + r.alto <= 3840
        assert r.ancho / r.alto == pytest.approx(9 / 16, abs=0.01)


def test_el_grafo_corta_antes_de_corregir():
    plan = Plan(imagen=Imagen(cuartos=1, rojo=1.1), tramos=[Tramo(inicio=0, fin=8, velocidad=2), Tramo(inicio=8, fin=30, velocidad=4)], cierre=2)
    g = grafo(fuente_de_prueba(), plan)
    assert "split=2" in g and "concat=n=2" in g
    assert g.index("trim=") < g.index("transpose=1") < g.index("scale=1080:1920") < g.index("colorchannelmixer")
    assert "setpts=(PTS-STARTPTS)/4.0000" in g
    assert "tpad=stop_mode=clone:stop_duration=2.000" in g
    assert g.endswith("[v]")


def test_el_grafo_de_un_solo_tramo_no_parte_ni_une():
    g = grafo(fuente_de_prueba(), Plan(tramos=[Tramo(inicio=0, fin=30)]))
    assert "split" not in g and "concat" not in g and "tpad" not in g


# ───────────────────────────── Medir ─────────────────────────────


def cuadros_con_fondo(color, n=6, brillo=None):
    muestra = np.zeros((n, 90, 160, 3), dtype=np.float32)
    for i in range(n):
        muestra[i] = np.array(color, dtype=np.float32) * (brillo[i] if brillo else 1.0)
        muestra[i, 30:60, 60:100] = [0.6, 0.1, 0.1]
    return muestra


def test_medir_saca_el_tinte_del_fondo_y_sube_la_luz():
    m = medir(cuadros_con_fondo([0.60, 0.66, 0.72]))
    s = m.sugeridos
    assert s["rojo"] > s["verde"] > s["azul"]
    corregido = np.array([0.60, 0.66, 0.72]) * [s["rojo"], s["verde"], s["azul"]]
    assert np.ptp(corregido) < 0.01
    assert 0.66 < corregido.mean() <= 0.91
    assert m.avisos == []


def test_medir_no_quema_lo_que_ya_esta_claro():
    m = medir(cuadros_con_fondo([0.97, 0.97, 0.97]))
    assert max(m.sugeridos.values()) * 0.97 <= 1.0


def test_medir_avisa_si_la_camara_cambio_la_luz():
    m = medir(cuadros_con_fondo([0.7, 0.7, 0.7], brillo=[1.0, 1.0, 1.0, 1.12, 1.12, 1.12]))
    assert any("exposición" in a for a in m.avisos)


def test_medir_sin_fondo_claro_deja_el_color_como_esta():
    muestra = np.zeros((3, 90, 160, 3), dtype=np.float32)
    muestra[..., 0] = np.linspace(0.2, 0.9, 160)
    m = medir(muestra)
    assert m.sugeridos == {"rojo": 1.0, "verde": 1.0, "azul": 1.0}
    assert m.avisos


# ───────────────────────────── Con ffmpeg ─────────────────────────────


@con_ffmpeg
def test_leer_dice_como_es_el_video(video):
    f = leer(video)
    assert (f.ancho, f.alto) == (640, 360)
    assert f.duracion == pytest.approx(20, abs=0.2)
    assert f.fps == pytest.approx(25)
    assert f.tiene_audio and not f.vertical and f.bits == 8


@con_ffmpeg
def test_leer_avisa_si_no_es_un_video(tmp_path):
    with pytest.raises(VideoIlegible):
        leer(tmp_path / "no-esta.mp4")
    roto = tmp_path / "roto.mp4"
    roto.write_bytes(b"esto no es un video")
    with pytest.raises(VideoIlegible):
        leer(roto)


def test_la_copia_liviana_va_con_su_video(tmp_path):
    original = tmp_path / "DJI_0073_D.MP4"
    original.write_bytes(b"x")
    assert copia_liviana(original) is None
    assert para_mirar(original) == original
    liviana = tmp_path / "DJI_0073_D.LRF"
    liviana.write_bytes(b"x")
    assert copia_liviana(original) == liviana
    assert para_mirar(original) == liviana
    assert es_copia_liviana(liviana) and not es_copia_liviana(original)


@con_ffmpeg
def test_exportar_deja_un_clip_vertical_con_la_duracion_del_plan(video, tmp_path):
    fuente = leer(video)
    plan = Plan(
        imagen=Imagen(cuartos=1, rojo=1.05, contraste=1.05),
        tramos=[Tramo(inicio=0, fin=6, velocidad=1), Tramo(inicio=6, fin=18, velocidad=4), Tramo(inicio=18, fin=20, velocidad=1)],
        cierre=2,
    )
    clip = exportar(fuente, plan, tmp_path / "salida" / "clip.mp4", codificador="libx264")
    assert (clip.ancho, clip.alto) == (1080, 1920)
    assert clip.duracion == pytest.approx(plan.dura, abs=0.3)
    assert clip.avisos == ()
    hecho = leer(clip.ruta)
    assert hecho.tiene_audio and hecho.codec == "h264" and hecho.bits == 8
    # El original sigue igual.
    assert leer(video).duracion == pytest.approx(20, abs=0.2)


@con_ffmpeg
def test_exportar_no_arranca_con_un_plan_que_el_canal_no_acepta(video, tmp_path):
    fuente = leer(video)
    with pytest.raises(PlanInvalido):
        exportar(fuente, Plan(tramos=[Tramo(inicio=0, fin=5)]), tmp_path / "clip.mp4")
    with pytest.raises(PlanInvalido):
        exportar(fuente, plan_parejo(fuente, objetivo=15), video)
    assert not (tmp_path / "clip.mp4").exists()


@con_ffmpeg
def test_las_hojas_muestran_el_video_girado_con_su_segundo(video, tmp_path):
    from PIL import Image

    armadas = hojas.armar(leer(video), tmp_path / "hojas", cada=2, cuartos=1, columnas=4, filas=2, ancho=90)
    assert [h.name for h in armadas] == ["hoja_01.jpg", "hoja_02.jpg"]
    with Image.open(armadas[0]) as hoja:
        assert hoja.size == (4 * 90, 2 * 160)
    assert hojas.reloj(75.5) == "1:15.5"
