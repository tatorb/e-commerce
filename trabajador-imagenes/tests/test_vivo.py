"""El paquete para editar la foto en vivo en la app."""

import io

import numpy as np
from conftest import foto_de_prueba
from PIL import Image

from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.imagen import achicar
from mrb_imagenes.pasos.lente import Lente
from mrb_imagenes.vivo import LADO, MARCA, armar_paquete, leer_paquete

AJUSTES = leer_ajustes()


def _foto_canon(alto: int, ancho: int):
    import lensfunpy

    db = lensfunpy.Database()
    cam = db.find_cameras("Canon", "Canon EOS 5D Mark III")[0]
    lente = next(l for l in db.find_lenses(cam, "Canon", "EF 24-105mm f/4L IS USM"))
    foto = foto_de_prueba(alto, ancho)
    foto.datos["camara"] = {
        "marca": "Canon",
        "modelo": "Canon EOS 5D Mark III",
        "marca_lente": "Canon",
        "lente": lente.model,
        "focal": 24.0,
        "apertura": 4.0,
    }
    return foto


def test_sin_datos_de_lente_lleva_la_base_y_la_silueta():
    foto = foto_de_prueba(600, 800)
    mascara = np.zeros((560, 760), np.float32)
    mascara[100:400, 200:500] = 1
    datos = armar_paquete(foto, Lente(), AJUSTES, mascara)
    assert datos.startswith(MARCA)
    encabezado, imagenes = leer_paquete(datos)
    assert encabezado["version"] == 1 and encabezado["original"] == {"ancho": 800, "alto": 600}
    assert encabezado["lente"] is None
    base = Image.open(io.BytesIO(imagenes[encabezado["base"]]))
    # No se agranda: la foto ya es más chica que el tamaño de pantalla.
    assert base.size == (800, 600) and base.format == "JPEG"
    silueta = encabezado["silueta"]
    assert (silueta["ancho_completo"], silueta["alto_completo"]) == (760, 560)
    png = Image.open(io.BytesIO(imagenes[silueta["imagen"]]))
    assert png.size == (760, 560) and png.mode == "L"
    m = np.asarray(png)
    assert m[250, 350] == 255 and m[50, 50] == 0


def test_la_foto_grande_va_en_tamano_de_pantalla_y_la_silueta_a_la_misma_escala():
    foto = foto_de_prueba(1800, 2400)
    mascara = np.ones((1700, 2300), np.float32)
    encabezado, imagenes = leer_paquete(armar_paquete(foto, None, AJUSTES, mascara))
    assert Image.open(io.BytesIO(imagenes[encabezado["base"]])).size == (LADO, 900)
    assert Image.open(io.BytesIO(imagenes[encabezado["silueta"]["imagen"]])).size == (1150, 850)
    item = encabezado["imagenes"][encabezado["base"]]
    assert (item["ancho"], item["alto"], item["tipo"]) == (LADO, 900, "image/jpeg")


def test_sin_silueta_cuando_no_se_quito_el_fondo():
    encabezado, _ = leer_paquete(armar_paquete(foto_de_prueba(300, 400), None, AJUSTES, None))
    assert encabezado["silueta"] is None and encabezado["lente"] is None


def test_con_datos_de_lente_lleva_una_copia_por_combinacion():
    foto = _foto_canon(800, 1200)
    encabezado, imagenes = leer_paquete(armar_paquete(foto, Lente(), AJUSTES, None))
    variantes = encabezado["lente"]
    assert len(variantes) == 8
    combinaciones = {(v["distorsion"], v["aberracion"], v["vineta"]) for v in variantes}
    assert len(combinaciones) == 8
    por = {(v["distorsion"], v["aberracion"], v["vineta"]): v["imagen"] for v in variantes}
    assert por[(0, 0, 0)] == encabezado["base"]
    # Corregir la deformación recorta los bordes; la viñeta sola no cambia el tamaño.
    distorsion = Image.open(io.BytesIO(imagenes[por[(1, 0, 0)]]))
    assert distorsion.size[0] < 1200 and distorsion.size[1] < 800
    if por[(0, 0, 1)] != encabezado["base"]:
        assert Image.open(io.BytesIO(imagenes[por[(0, 0, 1)]])).size == (1200, 800)
    # Es lo mismo que hace el paso Lente sobre la copia chica.
    chica = achicar(foto, LADO)
    lente = Lente()
    r = lente.aplicar(chica, {"distorsion": 1.0, "aberracion": 0.0, "vineta": 0.0}, AJUSTES, lente.medir(chica, AJUSTES))
    assert distorsion.size == (r.foto.ancho, r.foto.alto)


def _cerca(a, b, camino="") -> None:
    if isinstance(a, dict):
        assert sorted(a) == sorted(b), camino
        for k in a:
            _cerca(a[k], b[k], f"{camino}.{k}")
    elif isinstance(a, list):
        assert len(a) == len(b), camino
        for i, (x, y) in enumerate(zip(a, b, strict=True)):
            _cerca(x, y, f"{camino}[{i}]")
    elif isinstance(a, float) or isinstance(b, float):
        assert abs(a - b) <= 1e-4, camino
    else:
        assert a == b, camino


def test_la_referencia_de_la_app_esta_al_dia():
    """La app compara sus cuentas con estos números: si cambia una cuenta de la Mac, hay que rearmarlos."""
    import json

    from armar_referencia_vivo import DESTINO, armar

    guardada = json.loads(DESTINO.read_text())
    _cerca(json.loads(json.dumps(armar())), guardada)
