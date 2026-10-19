import numpy as np
import pytest
from PIL import Image

from mrb_imagenes.imagen import Foto, guardar_intermedia, leer_intermedia, leer_original


def _jpeg_con_orientacion(ruta, orientacion: int):
    arr = np.full((20, 40, 3), 200, np.uint8)
    arr[:5, :5] = [255, 0, 0]  # marca roja arriba a la izquierda
    im = Image.fromarray(arr)
    exif = im.getexif()
    exif[0x0112] = orientacion
    exif[0x010F] = "Canon"
    exif[0x0110] = "Canon EOS 5D Mark III"
    im.save(ruta, "JPEG", quality=95, exif=exif.tobytes())


def test_la_orientacion_se_aplica_una_sola_vez(tmp_path):
    ruta = tmp_path / "foto.jpg"
    _jpeg_con_orientacion(ruta, 6)
    foto, avisos = leer_original(ruta)
    assert (foto.alto, foto.ancho) == (40, 20)
    # Orientación 6: girar 90° en sentido horario. La marca queda arriba a la derecha.
    assert foto.rgb[1, -2, 0] > 0.8 and foto.rgb[1, -2, 1] < 0.3
    assert foto.datos["orientacion_original"] == 6
    assert foto.datos["camara"]["marca"] == "Canon"
    assert avisos == []


def test_un_gris_sigue_gris_al_pasar_de_display_p3(tmp_path):
    from mrb_imagenes.imagen import _a_srgb_desde

    gris = np.full((2, 2, 3), 0.5, np.float32)
    convertido, aviso = _a_srgb_desde(gris, "Display P3")
    assert aviso is None
    assert np.allclose(convertido, 0.5, atol=1e-3)
    rojo = np.zeros((1, 1, 3), np.float32)
    rojo[..., 0] = 1
    fuera, _ = _a_srgb_desde(rojo, "Display P3")
    assert fuera[0, 0, 0] == pytest.approx(1.0) and fuera[0, 0, 1] == pytest.approx(0.0, abs=1e-6)


def test_perfil_desconocido_avisa():
    from mrb_imagenes.imagen import _a_srgb_desde

    _, aviso = _a_srgb_desde(np.zeros((1, 1, 3), np.float32), "ProPhoto RGB")
    assert "no se reconoce" in aviso


def test_los_intermedios_son_de_16_bits_y_sin_perdida(tmp_path):
    rng = np.random.default_rng(1)
    foto = Foto(rgb=rng.random((30, 40, 3), dtype=np.float32), alfa=rng.random((30, 40), dtype=np.float32))
    ruta = tmp_path / "paso.png"
    guardar_intermedia(foto, ruta)
    leida = leer_intermedia(ruta)
    assert np.abs(leida.rgb - foto.rgb).max() < 1 / 60000
    assert np.abs(leida.alfa - foto.alfa).max() < 1 / 60000


def test_lee_heic(tmp_path):
    import pillow_heif

    ruta = tmp_path / "foto.heic"
    arr = np.full((32, 48, 3), 120, np.uint8)
    try:
        pillow_heif.from_bytes(mode="RGB", size=(48, 32), data=arr.tobytes()).save(str(ruta), quality=90)
    except Exception as e:  # sin codificador HEIC en esta máquina
        pytest.skip(f"no se puede escribir HEIC acá: {e}")
    foto, _ = leer_original(ruta)
    assert (foto.alto, foto.ancho) == (32, 48)
    assert abs(float(foto.rgb.mean()) - 120 / 255) < 0.03


def test_rechaza_otros_archivos(tmp_path):
    from mrb_imagenes.imagen import FotoIlegible

    ruta = tmp_path / "nota.txt"
    ruta.write_text("hola")
    with pytest.raises(FotoIlegible):
        leer_original(ruta)
    malo = tmp_path / "rota.jpg"
    malo.write_bytes(b"no es una foto")
    with pytest.raises(FotoIlegible):
        leer_original(malo)
