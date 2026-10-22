"""Paso Sombra: mide la sombra real, la dibuja solo sobre el fondo y no toca la pieza."""

import io
import math

import cv2
import numpy as np
from PIL import Image

from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.imagen import Foto
from mrb_imagenes.pasos.exportar import Exportar
from mrb_imagenes.pasos.sombra import Sombra, desplazar, dibujar_sombra, hacia, medir_sombra

AJUSTES = leer_ajustes()


def _pieza(alto=300, ancho=400, caja=(150, 90, 250, 190)):
    alfa = np.zeros((alto, ancho), np.float32)
    x0, y0, x1, y1 = caja
    alfa[y0:y1, x0:x1] = 1
    return alfa


def _foto_con_sombra(dx: float, dy: float, fuerza: float = 0.35):
    """Fondo claro con una sombra real corrida (dx, dy) desde la pieza, como en la caja de luz."""
    alfa = _pieza()
    sombra = cv2.GaussianBlur(desplazar(alfa, dx, dy), (0, 0), 8) * fuerza
    gris = 0.9 * (1 - sombra)
    rgb = np.repeat(gris[..., None], 3, axis=-1).astype(np.float32)
    rgb[alfa > 0] = [0.3, 0.32, 0.35]
    rng = np.random.default_rng(3)
    rgb = np.clip(rgb + rng.normal(0, 0.01, rgb.shape), 0, 1).astype(np.float32)
    return Foto(rgb=rgb, alfa=alfa, datos={})


def test_mide_hacia_donde_cae_la_sombra_real():
    for dx, dy, esperado in [(0, 25, 0), (25, 0, 90), (-20, 20, -45)]:
        m = medir_sombra(_foto_con_sombra(dx, dy))
        assert m["sombra_detectada"]
        diferencia = (m["direccion_grados"] - esperado + 180) % 360 - 180
        assert abs(diferencia) < 25, (dx, dy, m)
        assert m["oscuridad_pct"] > 10


def test_sin_sombra_en_el_fondo_lo_dice():
    foto = _foto_con_sombra(0, 0, fuerza=0)
    assert not medir_sombra(foto)["sombra_detectada"]
    medicion = Sombra().medir(foto, AJUSTES)
    # Propone una muy suave hacia abajo.
    assert medicion.sugeridos["direccion"] == 0 and medicion.sugeridos["intensidad"] <= 15


def test_cae_hacia_donde_se_pide_y_se_desvanece_en_el_borde():
    alfa = _pieza()
    abajo = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 0, "distancia": 20, "suavidad": 50})
    assert abajo[200:240, 150:250].mean() > 3 * abajo[40:80, 150:250].mean()
    derecha = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 90, "distancia": 20, "suavidad": 50})
    assert derecha[90:190, 260:300].mean() > 3 * derecha[90:190, 100:140].mean()
    # Nunca queda cortada contra el borde del cuadro.
    larga = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 0, "distancia": 40, "suavidad": 0})
    assert larga[-1].max() == 0 and larga[:, 0].max() == 0
    # Lo más oscuro no pasa la intensidad pedida.
    assert abajo.max() <= 0.30 + 1e-6


def test_mas_suave_se_esparce_mas():
    alfa = _pieza()
    nitida = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 0, "distancia": 10, "suavidad": 0})
    suave = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 0, "distancia": 10, "suavidad": 100})
    # Más allá de la distancia pedida solo llega la suave.
    assert suave[205:215, 150:250].mean() > nitida[205:215, 150:250].mean() + 0.01


def test_es_un_degradado_no_una_copia_corrida():
    alfa = _pieza()
    s = dibujar_sombra(alfa, {"intensidad": 30, "direccion": 0, "distancia": 25, "suavidad": 30})
    columna = s[190:260, 200]
    # Debajo de la pieza va bajando de a poco: más oscuro pegado a ella.
    assert columna[0] > columna[20] > columna[40] > columna[60]


def test_la_sombra_no_toca_la_pieza_y_solo_oscurece_el_fondo():
    foto = _foto_con_sombra(0, 25)
    paso = Sombra()
    medicion = paso.medir(foto, AJUSTES)
    valores, _ = paso.limitar({"intensidad": 30, "direccion": 0, "distancia": 15, "suavidad": 60}, AJUSTES)
    r = paso.aplicar(foto, valores, AJUSTES, medicion)
    assert np.array_equal(r.foto.rgb, foto.rgb) and np.array_equal(r.foto.alfa, foto.alfa)
    exportar = Exportar()
    m = exportar.medir(r.foto, AJUSTES)
    jpg_valores, _ = exportar.limitar({"calidad": 100, "sombra_png": 1}, AJUSTES)
    archivos = exportar.aplicar(r.foto, jpg_valores, AJUSTES, m).archivos
    jpg = np.asarray(Image.open(io.BytesIO(archivos["final.jpg"])).convert("RGB")).astype(int)
    # Lejos de la pieza, blanco puro; debajo, la sombra oscurece un poco.
    assert jpg[5, 5].min() >= 254
    assert 150 < jpg[195, 200].mean() < 245
    png = np.asarray(Image.open(io.BytesIO(archivos["final.png"])))
    # En el PNG la pieza queda igual y la sombra es transparencia gris.
    assert np.abs(png[140, 200, :3].astype(int) - np.round(foto.rgb[140, 200] * 255)).max() <= 1
    assert png[140, 200, 3] == 255 and 0 < png[195, 200, 3] < 120 and png[5, 5, 3] == 0
    # Con la sombra apagada para el PNG, afuera de la pieza es transparente.
    sin, _ = exportar.limitar({"calidad": 100, "sombra_png": 0}, AJUSTES)
    png_sin = np.asarray(Image.open(io.BytesIO(exportar.aplicar(r.foto, sin, AJUSTES, m).archivos["final.png"])))
    assert png_sin[195, 200, 3] == 0


def test_respeta_el_tope_de_la_cuenta():
    paso = Sombra()
    ajustes = leer_ajustes({"topes": {"sombra": 12}})
    valores, avisos = paso.limitar({"intensidad": 50, "direccion": 0, "distancia": 10, "suavidad": 50}, ajustes)
    assert valores["intensidad"] == 12 and avisos


def test_sin_fondo_quitado_no_aplica():
    foto = Foto(rgb=np.ones((50, 50, 3), np.float32), datos={})
    assert Sombra().medir(foto, AJUSTES).no_aplica


def test_nombra_la_direccion():
    assert [hacia(g) for g in (0, 45, 90, 180, -90, -135)] == [
        "abajo",
        "abajo a la derecha",
        "la derecha",
        "arriba",
        "la izquierda",
        "arriba a la izquierda",
    ]
    assert math.isclose(desplazar(np.eye(3, dtype=np.float32), 1, 0)[0, 1], 1)
