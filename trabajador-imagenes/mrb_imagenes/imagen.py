"""Leer, convertir y guardar fotos.

Adentro del trabajador una foto es un arreglo de números decimales de 0 a 1,
en sRGB, el espacio de color de la web. Así cada paso trabaja con más
precisión que la de un archivo de 8 bits, y las correcciones sumadas no dejan
saltos en los degradés. Los archivos intermedios se guardan en PNG de 16 bits,
sin pérdida.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import pillow_heif
import tifffile
from PIL import Image, ImageCms, ImageOps

pillow_heif.register_heif_opener()

# Las fotos de un teléfono ya vienen corregidas de lente por el propio teléfono.
MARCAS_DE_TELEFONO = {"apple", "google", "samsung", "xiaomi", "huawei", "oneplus", "motorola", "oppo", "vivo", "realme"}

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"}


@dataclass
class Foto:
    # Alto x ancho x 3, decimales de 0 a 1, en sRGB.
    rgb: np.ndarray
    # Alto x ancho, de 0 (transparente) a 1 (opaco). Solo después de quitar el fondo.
    alfa: np.ndarray | None = None
    # Cámara, lente, perfil de color y otros datos del original.
    datos: dict = field(default_factory=dict)
    # Alto x ancho, cuánto oscurece la sombra el fondo, de 0 a 1. Solo después del paso Sombra.
    sombra: np.ndarray | None = None

    @property
    def alto(self) -> int:
        return int(self.rgb.shape[0])

    @property
    def ancho(self) -> int:
        return int(self.rgb.shape[1])


class FotoIlegible(Exception):
    pass


# ───────────────────────────── Color ─────────────────────────────


def a_lineal(x: np.ndarray) -> np.ndarray:
    """De sRGB a luz lineal, donde sumar y multiplicar se comporta como la luz real."""
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4).astype(np.float32)


def a_srgb(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055).astype(np.float32)


def luminancia(lineal: np.ndarray) -> np.ndarray:
    return (lineal[..., 0] * 0.2126 + lineal[..., 1] * 0.7152 + lineal[..., 2] * 0.0722).astype(np.float32)


# De otros espacios de color a sRGB, en luz lineal (blanco D65).
_P3_A_SRGB = np.array(
    [[1.2249401, -0.2249404, 0.0], [-0.0420569, 1.0420571, 0.0], [-0.0196376, -0.0786361, 1.0982735]],
    dtype=np.float32,
)
_ADOBE_A_SRGB = np.array([[1.3983557, -0.3983557, 0.0], [0.0, 1.0, 0.0], [0.0, -0.0429289, 1.0429289]], dtype=np.float32)


def _a_srgb_desde(rgb: np.ndarray, perfil: str | None) -> tuple[np.ndarray, str | None]:
    """Pasa la foto a sRGB. Devuelve la foto y un aviso si el perfil no se conoce."""
    nombre = (perfil or "").lower()
    if not nombre or "srgb" in nombre or "iec61966" in nombre:
        return rgb, None
    if "p3" in nombre:
        lineal = a_lineal(rgb) @ _P3_A_SRGB.T
        return a_srgb(lineal), None
    if "adobe rgb" in nombre:
        lineal = np.power(np.clip(rgb, 0, 1), 563 / 256) @ _ADOBE_A_SRGB.T
        return a_srgb(lineal), None
    return rgb, f"El perfil de color «{perfil}» no se reconoce: se tomó como sRGB."


# ───────────────────────────── Leer el original ─────────────────────────────


def _resumen_exif(im: Image.Image) -> dict:
    ex = im.getexif()
    sub = ex.get_ifd(0x8769)

    def texto(v):
        if v is None:
            return None
        s = str(v).strip().strip("\x00").strip()
        return s or None

    def numero(v):
        try:
            return round(float(v), 3)
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    return {
        "marca": texto(ex.get(0x010F)),
        "modelo": texto(ex.get(0x0110)),
        "marca_lente": texto(sub.get(0xA433)),
        "lente": texto(sub.get(0xA434)),
        "focal": numero(sub.get(0x920A)),
        "focal_35mm": numero(sub.get(0xA405)),
        "apertura": numero(sub.get(0x829D)),
        "fecha": texto(sub.get(0x9003)),
        "tiene_gps": bool(ex.get_ifd(0x8825)),
    }


def _perfil(im: Image.Image) -> str | None:
    icc = im.info.get("icc_profile")
    if not icc:
        return None
    try:
        return ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(icc))).strip() or None
    except Exception:
        return "desconocido"


def es_de_telefono(camara: dict) -> bool:
    return (camara.get("marca") or "").strip().lower() in MARCAS_DE_TELEFONO


def leer_original(ruta: str | Path) -> tuple[Foto, list[str]]:
    """Lee el original sin tocarlo: lo pone derecho una sola vez y lo pasa a sRGB."""
    ruta = Path(ruta)
    ext = ruta.suffix.lower()
    if ext not in EXTENSIONES:
        raise FotoIlegible(f"No se puede leer «{ruta.name}»: tiene que ser JPG, PNG, WebP, HEIC o TIFF.")
    avisos: list[str] = []
    try:
        with Image.open(ruta) as im:
            camara = _resumen_exif(im)
            perfil = _perfil(im)
            # HEIC ya viene derecha desde pillow-heif; las demás se ponen derechas acá.
            orientacion = im.info.get("original_orientation") or im.getexif().get(0x0112) or 1
            derecha = ImageOps.exif_transpose(im)
            bits = int(im.info.get("bit_depth") or 8)
            if ext in {".tif", ".tiff"}:
                arr = tifffile.imread(ruta)
                rgb = _a_decimal(arr)
                if orientacion not in (1, None):
                    rgb = _orientar(rgb, int(orientacion))
            else:
                if derecha.mode not in ("RGB", "RGBA", "L", "LA", "I;16", "I"):
                    derecha = derecha.convert("RGB")
                if derecha.mode in ("RGBA", "LA"):
                    avisos.append("El original tenía transparencia: se usaron solo sus colores.")
                rgb = _a_decimal(np.asarray(derecha))
    except FotoIlegible:
        raise
    except Exception as e:  # archivo dañado o formato raro
        raise FotoIlegible(f"No se pudo leer «{ruta.name}»: {e}") from e

    rgb, aviso_perfil = _a_srgb_desde(rgb, perfil)
    if aviso_perfil:
        avisos.append(aviso_perfil)
    foto = Foto(
        rgb=np.ascontiguousarray(rgb, dtype=np.float32),
        datos={
            "archivo": ruta.name,
            "camara": camara,
            "perfil": perfil or "sRGB",
            "bits": bits,
            "orientacion_original": int(orientacion),
            "tamano": [int(rgb.shape[1]), int(rgb.shape[0])],
        },
    )
    return foto, avisos


def _a_decimal(arr: np.ndarray) -> np.ndarray:
    """Cualquier arreglo de imagen a alto x ancho x 3 decimales de 0 a 1."""
    if arr.ndim == 2:
        arr = np.stack([arr] * 3, axis=-1)
    if arr.shape[-1] == 4:
        arr = arr[..., :3]
    if arr.shape[-1] == 2:
        arr = np.stack([arr[..., 0]] * 3, axis=-1)
    if arr.dtype == np.uint8:
        return arr.astype(np.float32) / 255.0
    if arr.dtype == np.uint16:
        return arr.astype(np.float32) / 65535.0
    if np.issubdtype(arr.dtype, np.integer):
        return arr.astype(np.float32) / float(np.iinfo(arr.dtype).max)
    return np.clip(arr.astype(np.float32), 0.0, 1.0)


def _orientar(rgb: np.ndarray, orientacion: int) -> np.ndarray:
    pasos = {
        2: lambda a: a[:, ::-1],
        3: lambda a: a[::-1, ::-1],
        4: lambda a: a[::-1, :],
        5: lambda a: np.transpose(a, (1, 0, 2)),
        6: lambda a: np.rot90(a, -1),
        7: lambda a: np.rot90(np.transpose(a, (1, 0, 2)), 2),
        8: lambda a: np.rot90(a, 1),
    }
    f = pasos.get(orientacion)
    return np.ascontiguousarray(f(rgb)) if f else rgb


# ───────────────────────────── Intermedios ─────────────────────────────


def guardar_intermedia(foto: Foto, ruta: str | Path) -> None:
    """PNG de 16 bits, sin pérdida. Con transparencia si la foto ya la tiene."""
    arr = np.round(np.clip(foto.rgb, 0, 1) * 65535).astype(np.uint16)
    bgr = arr[..., ::-1]
    if foto.alfa is not None:
        a = np.round(np.clip(foto.alfa, 0, 1) * 65535).astype(np.uint16)
        bgr = np.dstack([bgr, a])
    if not cv2.imwrite(str(ruta), np.ascontiguousarray(bgr), [cv2.IMWRITE_PNG_COMPRESSION, 3]):
        raise OSError(f"No se pudo guardar {ruta}")


def leer_intermedia(ruta: str | Path, datos: dict | None = None) -> Foto:
    arr = cv2.imread(str(ruta), cv2.IMREAD_UNCHANGED | cv2.IMREAD_IGNORE_ORIENTATION)
    if arr is None:
        raise FotoIlegible(f"No se pudo leer {ruta}")
    escala = 65535.0 if arr.dtype == np.uint16 else 255.0
    alfa = None
    if arr.ndim == 3 and arr.shape[2] == 4:
        alfa = arr[..., 3].astype(np.float32) / escala
        arr = arr[..., :3]
    rgb = arr[..., ::-1].astype(np.float32) / escala
    return Foto(rgb=np.ascontiguousarray(rgb), alfa=alfa, datos=dict(datos or {}))


def guardar_mascara(alfa: np.ndarray, ruta: str | Path) -> None:
    arr = np.round(np.clip(alfa, 0, 1) * 65535).astype(np.uint16)
    if not cv2.imwrite(str(ruta), arr, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
        raise OSError(f"No se pudo guardar {ruta}")


# ───────────────────────────── Vistas ─────────────────────────────


def _cuadros(alto: int, ancho: int, lado: int = 16) -> np.ndarray:
    """El fondo a cuadros grises con que se muestra la transparencia."""
    yy, xx = np.mgrid[0:alto, 0:ancho]
    claro = ((yy // lado + xx // lado) % 2 == 0)
    fondo = np.where(claro, 0.94, 0.82).astype(np.float32)
    return np.stack([fondo] * 3, axis=-1)


def achicar(foto: Foto, lado: int) -> Foto:
    """Copia achicada para mostrar o para Claude. Nunca se usa como resultado."""
    escala = min(1.0, lado / max(foto.alto, foto.ancho))
    if escala >= 1.0:
        return Foto(rgb=foto.rgb.copy(), alfa=None if foto.alfa is None else foto.alfa.copy(), datos=foto.datos)
    tam = (max(1, round(foto.ancho * escala)), max(1, round(foto.alto * escala)))
    rgb = cv2.resize(foto.rgb, tam, interpolation=cv2.INTER_AREA)
    alfa = None if foto.alfa is None else cv2.resize(foto.alfa, tam, interpolation=cv2.INTER_AREA)
    return Foto(rgb=rgb, alfa=alfa, datos=foto.datos)


def vista_jpeg(foto: Foto, lado: int = 1600, calidad: int = 85) -> bytes:
    """Vista liviana para la pantalla: la transparencia se ve a cuadros."""
    chica = achicar(foto, lado)
    rgb = chica.rgb
    if chica.alfa is not None:
        a = chica.alfa[..., None]
        fondo = _cuadros(chica.alto, chica.ancho)
        if foto.sombra is not None:
            fondo = fondo * (1 - cv2.resize(foto.sombra, (chica.ancho, chica.alto), interpolation=cv2.INTER_AREA)[..., None])
        rgb = rgb * a + fondo * (1 - a)
    return a_jpeg(rgb, calidad)


def a_jpeg(rgb: np.ndarray, calidad: int, icc: bytes | None = None) -> bytes:
    arr = np.round(np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    salida = io.BytesIO()
    extra = {"icc_profile": icc} if icc else {}
    Image.fromarray(arr, "RGB").save(salida, "JPEG", quality=calidad, subsampling=0, optimize=True, **extra)
    return salida.getvalue()


def perfil_srgb() -> bytes:
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def exif_legible(datos: dict) -> str:
    camara = datos.get("camara") or {}
    partes = [camara.get("marca"), camara.get("modelo")]
    lente = camara.get("lente")
    if lente:
        partes.append(f"lente {lente}")
    return " · ".join(p for p in partes if p) or "sin datos de cámara"


__all__ = [
    "Foto",
    "FotoIlegible",
    "a_jpeg",
    "a_lineal",
    "a_srgb",
    "achicar",
    "es_de_telefono",
    "exif_legible",
    "guardar_intermedia",
    "guardar_mascara",
    "leer_intermedia",
    "leer_original",
    "luminancia",
    "perfil_srgb",
    "vista_jpeg",
]
