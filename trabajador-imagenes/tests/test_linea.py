"""La línea completa con una foto sintética: el original nunca cambia."""

import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from conftest import foto_de_prueba
from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.imagen import leer_original
from mrb_imagenes.inspector import Inspector
from mrb_imagenes.linea import aplicar, medir_y_proponer
from mrb_imagenes.pasos import armar_pasos


def _segmentador(rgb):
    alto, ancho = rgb.shape[:2]
    m = np.zeros((alto, ancho), np.float32)
    m[int(alto * 0.3) : int(alto * 0.7), int(ancho * 0.32) : int(ancho * 0.68)] = 1
    return m


def test_los_8_pasos_sin_tocar_el_original(tmp_path):
    ruta = tmp_path / "foto.jpg"
    arr = (foto_de_prueba(inclinacion=2).rgb * 255).astype(np.uint8)
    im = Image.fromarray(arr)
    exif = im.getexif()
    exif[0x8825] = {2: (34, 36, 0)}  # una ubicación GPS
    im.save(ruta, "JPEG", quality=95, exif=exif.tobytes())
    huella = hashlib.sha256(ruta.read_bytes()).hexdigest()

    foto, _ = leer_original(ruta)
    assert foto.datos["camara"]["tiene_gps"]
    ajustes = leer_ajustes()
    inspector = Inspector(simulado=True)
    archivos = {}
    claves = []
    for paso in armar_pasos(_segmentador):
        medicion, propuesta = medir_y_proponer(paso, foto, ajustes, inspector)
        corrida = aplicar(paso, foto, ajustes, medicion, propuesta)
        json.dumps(corrida.receta())  # la receta se puede guardar
        claves.append((paso.clave, corrida.resultado.salteado))
        archivos.update(corrida.resultado.archivos)
        foto = corrida.resultado.foto

    assert [c for c, _ in claves] == ["lente", "perspectiva", "blancos", "luces", "color", "fondo", "recorte", "exportar"]
    assert dict(claves)["lente"] is True  # sin datos de lente
    assert hashlib.sha256(ruta.read_bytes()).hexdigest() == huella
    jpg = Image.open(io.BytesIO(archivos["final.jpg"]))
    assert jpg.size[0] == jpg.size[1]
    assert not jpg.getexif()


def test_probar_rechaza_una_foto_que_no_existe(tmp_path):
    raiz = Path(__file__).resolve().parents[1]
    r = subprocess.run([sys.executable, str(raiz / "probar.py"), str(tmp_path / "no-esta.jpg"), "--simulado"], capture_output=True, text=True)
    assert r.returncode == 1 and "No encuentro la foto" in r.stdout


def test_probar_sin_foto_explica_como_escribirlo():
    raiz = Path(__file__).resolve().parents[1]
    r = subprocess.run([sys.executable, str(raiz / "probar.py")], capture_output=True, text=True)
    assert r.returncode == 1 and "en una sola línea" in r.stdout
