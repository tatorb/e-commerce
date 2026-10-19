"""Fotos sintéticas para las pruebas: no hace falta ninguna foto real."""

import numpy as np
import pytest

from mrb_imagenes.imagen import Foto


def foto_de_prueba(alto: int = 600, ancho: int = 800, inclinacion: float = 0.0) -> Foto:
    """Un fondo con tono cálido, una pieza gris en el centro y una línea oscura abajo."""
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:alto, 0:ancho].astype(np.float32)
    degrade = 0.95 + 0.05 * (xx / ancho)
    rgb = np.stack([0.86 * degrade, 0.78 * degrade, 0.62 * degrade], axis=-1)
    rgb += rng.normal(0, 0.004, rgb.shape).astype(np.float32)
    pieza = (np.abs(xx - ancho / 2) < ancho * 0.18) & (np.abs(yy - alto / 2) < alto * 0.2)
    rgb[pieza] = [0.42, 0.41, 0.44]
    rgb[pieza] += rng.normal(0, 0.03, (int(pieza.sum()), 3)).astype(np.float32)
    # Una línea recta, como el borde de una mesa, con la inclinación pedida.
    pendiente = np.tan(np.radians(inclinacion))
    y_linea = alto * 0.85 + (xx - ancho / 2) * pendiente
    rgb[np.abs(yy - y_linea) < 3] = [0.12, 0.12, 0.12]
    return Foto(rgb=np.clip(rgb, 0.0, 1.0).astype(np.float32), datos={"camara": {}})


@pytest.fixture
def foto():
    return foto_de_prueba()
