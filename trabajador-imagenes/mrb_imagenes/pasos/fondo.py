"""Paso 6. Quitar el fondo.

Un modelo, a través de rembg, decide qué partes de la foto son fondo. No
dibuja nada: solo devuelve una silueta, la máscara. Con ella se arma la
transparencia. Los colores de la pieza quedan exactamente iguales.

Hay dos modelos. El completo (birefnet-general) es el más preciso, pero usa
cerca de 8 GB de memoria. El liviano (isnet-general-use) usa poco más de 1 GB
y, con la segunda pasada sobre la zona del producto, queda cerca. El
trabajador elige según la memoria de la Mac.

El modelo busca "el objeto" de cada imagen. Si en la segunda pasada el
producto llena casi todo el recorte, toma una parte de la pieza por fondo (le
pasaba a un pistón brillante sobre la caja de luz plateada). Por eso esa zona
deja entorno alrededor, y si igual pierde un pedazo que la primera pasada sí
vio, se descarta.

No se usa el "refinado de bordes" de rembg (alpha matting), porque recalcula
colores. El borde se ajusta con un filtro guiado que solo toca la transparencia.
Rellenar huecos también: vuelve opaco lo que ya es de la pieza, no dibuja nada.
"""

from __future__ import annotations

import os
from typing import Callable

import cv2
import numpy as np
from PIL import Image

from ..imagen import Foto, achicar
from .base import Medicion, Parametro, Paso, Resultado

MODELOS = {"completo": "birefnet-general", "liviano": "isnet-general-use"}
# Con menos memoria que esto, el modelo completo dejaría la Mac sin memoria.
MEMORIA_PARA_EL_COMPLETO_GB = 14

# Recibe la foto (alto x ancho x 3, de 0 a 1) y devuelve la máscara (alto x ancho, de 0 a 1).
Segmentador = Callable[[np.ndarray], np.ndarray]

_SESIONES: dict = {}


def memoria_gb() -> float:
    try:
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024**3
    except (ValueError, OSError, AttributeError):
        return 0.0


def elegir_modelo(pedido: str | None = None) -> str:
    """El modelo pedido (completo o liviano), el de MRB_MODELO_FONDO, o el que entra en la memoria de la Mac."""
    pedido = pedido or os.environ.get("MRB_MODELO_FONDO")
    if pedido:
        return MODELOS.get(pedido, pedido)
    return MODELOS["completo"] if memoria_gb() >= MEMORIA_PARA_EL_COMPLETO_GB else MODELOS["liviano"]


def preparar_modelo(modelo: str | None = None):
    """Carga el modelo. La primera vez lo baja de internet."""
    import onnxruntime as ort
    from rembg import new_session

    nombre = elegir_modelo(modelo)
    if nombre not in _SESIONES:
        # Sin reservar memoria de más: no crece de una foto a la otra.
        opciones = ort.SessionOptions()
        opciones.enable_cpu_mem_arena = False
        opciones.enable_mem_pattern = False
        _SESIONES[nombre] = new_session(nombre, sess_opts=opciones)
    return _SESIONES[nombre]


def segmentador_rembg(modelo: str | None = None) -> Segmentador:
    nombre = elegir_modelo(modelo)

    def segmentar(rgb: np.ndarray) -> np.ndarray:
        from rembg import remove

        sesion = preparar_modelo(nombre)
        im = Image.fromarray(np.round(np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")
        mascara = remove(im, session=sesion, only_mask=True, post_process_mask=False)
        return np.asarray(mascara.convert("L"), dtype=np.float32) / 255.0

    segmentar.modelo = nombre  # type: ignore[attr-defined]
    return segmentar


# La segunda pasada sirve si la zona del producto es bastante más chica que la foto.
_DETALLE_HASTA = 0.85
# En la zona de la segunda pasada el producto ocupa a lo sumo esta parte. Con más, el modelo falla.
_OCUPA_HASTA = 0.5
# Si la segunda pasada pierde un pedazo de la pieza más grande que esta parte, no se usa.
_PERDIDA_HASTA = 0.10
# Rellenar huecos solo toca los que son a lo sumo esta parte de la pieza que los rodea.
_HUECO_HASTA = 0.10


def zona_del_producto(mascara: np.ndarray) -> tuple[int, int, int, int] | None:
    """La caja del producto con un margen que crece hasta que el producto ocupe a lo sumo la mitad."""
    solido = mascara >= 0.5
    filas = np.where(solido.any(axis=1))[0]
    columnas = np.where(solido.any(axis=0))[0]
    if len(filas) == 0:
        return None
    alto, ancho = mascara.shape
    y0, y1, x0, x1 = int(filas[0]), int(filas[-1]) + 1, int(columnas[0]), int(columnas[-1]) + 1
    lado, area = max(y1 - y0, x1 - x0), int(solido.sum())
    margen, paso = int(0.04 * lado), max(1, int(0.02 * lado))
    while True:
        zona = (max(0, x0 - margen), max(0, y0 - margen), min(ancho, x1 + margen), min(alto, y1 + margen))
        if area <= _OCUPA_HASTA * (zona[2] - zona[0]) * (zona[3] - zona[1]) or zona == (0, 0, ancho, alto):
            return zona
        margen += paso


def pedazo_perdido(primera: np.ndarray, segunda: np.ndarray) -> float:
    """El pedazo más grande que la primera pasada ve como pieza y la segunda como fondo, en fracción de la pieza."""
    perdido = ((primera >= 0.5) & (segunda < 0.5)).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(perdido, connectivity=8)
    if n <= 1:
        return 0.0
    return float(stats[1:, cv2.CC_STAT_AREA].max() / max(1, int((primera >= 0.5).sum())))


def _caja(img: np.ndarray, r: int) -> np.ndarray:
    return cv2.boxFilter(img, -1, (2 * r + 1, 2 * r + 1), normalize=True, borderType=cv2.BORDER_REFLECT)


def filtro_guiado(guia: np.ndarray, p: np.ndarray, r: int, eps: float) -> np.ndarray:
    """Ajusta el borde de la máscara a los bordes reales de la foto (He y otros, 2010)."""
    media_i, media_p = _caja(guia, r), _caja(p, r)
    var_i = _caja(guia * guia, r) - media_i * media_i
    cov_ip = _caja(guia * p, r) - media_i * media_p
    a = cov_ip / (var_i + eps)
    b = media_p - a * media_i
    return _caja(a, r) * guia + _caja(b, r)


def quitar_motas(alfa: np.ndarray, minimo_pct: float) -> tuple[np.ndarray, int, int]:
    """Saca los pedacitos sueltos más chicos que el mínimo. Devuelve cuántas piezas quedan y cuántas se sacaron."""
    solido = (alfa >= 0.5).astype(np.uint8)
    n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(solido, connectivity=8)
    if n <= 1:
        return alfa, 0, 0
    minimo = alfa.size * minimo_pct / 100.0
    areas = stats[1:, cv2.CC_STAT_AREA]
    chicas = np.where(areas < minimo)[0] + 1
    if len(chicas) == 0:
        return alfa, int(n - 1), 0
    # Se saca la zona de cada mota con un pequeño margen, para no dejar su borde semitransparente.
    fuera = np.isin(etiquetas, chicas).astype(np.uint8)
    fuera = cv2.dilate(fuera, np.ones((5, 5), np.uint8)) > 0
    resto = np.isin(etiquetas, np.setdiff1d(np.arange(1, n), chicas))
    resto = cv2.dilate(resto.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    limpia = np.where(fuera & ~resto, 0.0, alfa).astype(np.float32)
    return limpia, int(n - 1 - len(chicas)), int(len(chicas))


def rellenar_huecos(alfa: np.ndarray) -> tuple[np.ndarray, int]:
    """Vuelve opacos los huecos chicos encerrados por una pieza. Los grandes, como el centro de un aro, quedan."""
    solido = alfa >= 0.5
    n, huecos, stats, _ = cv2.connectedComponentsWithStats((~solido).astype(np.uint8), connectivity=4)
    if n <= 1:
        return alfa, 0
    alto, ancho = alfa.shape
    # Lo que toca el borde de la foto es el fondo de afuera, no un hueco.
    afuera = set(np.unique(np.concatenate([huecos[0], huecos[-1], huecos[:, 0], huecos[:, -1]])).tolist())
    _, piezas, stats_piezas, _ = cv2.connectedComponentsWithStats(solido.astype(np.uint8), connectivity=8)
    chicos = np.zeros(n, dtype=bool)
    for i in range(1, n):
        if i in afuera:
            continue
        x, y, w, h, area = stats[i]
        x0, y0, x1, y1 = max(0, x - 1), max(0, y - 1), min(ancho, x + w + 1), min(alto, y + h + 1)
        # La pieza que lo rodea: la que más toca su orilla.
        orilla = cv2.dilate((huecos[y0:y1, x0:x1] == i).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        vecinas = piezas[y0:y1, x0:x1][orilla]
        vecinas = vecinas[vecinas > 0]
        if len(vecinas) and area <= _HUECO_HASTA * stats_piezas[np.bincount(vecinas).argmax(), cv2.CC_STAT_AREA]:
            chicos[i] = True
    if not chicos.any():
        return alfa, 0
    rellenar = chicos[huecos]
    # El fondo de afuera y los huecos grandes conservan su borde suave; el resto de la pieza queda opaco.
    abierto = ~solido & ~rellenar
    r = max(3, round(min(alto, ancho) / 300))
    cerca = cv2.dilate(abierto.astype(np.uint8), np.ones((2 * r + 1, 2 * r + 1), np.uint8)) > 0
    return np.where(rellenar | ~cerca, 1.0, alfa).astype(np.float32), int(chicos.sum())


def armar_alfa(mascara: np.ndarray, rgb: np.ndarray, valores: dict[str, float]) -> tuple[np.ndarray, dict]:
    alfa = mascara.astype(np.float32)
    if valores.get("refinar_bordes"):
        gris = cv2.cvtColor(np.clip(rgb, 0, 1).astype(np.float32), cv2.COLOR_RGB2GRAY)
        r = max(2, round(min(alfa.shape) / 600))
        refinada = np.clip(filtro_guiado(gris, alfa, r, 1e-3), 0, 1)
        # Solo en la franja del borde: el interior y el fondo lejano no cambian.
        franja = cv2.dilate(((alfa > 0.02) & (alfa < 0.98)).astype(np.uint8), np.ones((2 * r + 1, 2 * r + 1), np.uint8)) > 0
        alfa = np.where(franja, refinada, alfa).astype(np.float32)
    dureza = float(valores.get("dureza", 0))
    if dureza > 0:
        alfa = np.clip((alfa - 0.5) * (1 + dureza / 25.0) + 0.5, 0, 1).astype(np.float32)
    rellenados = 0
    if valores.get("rellenar_huecos"):
        alfa, rellenados = rellenar_huecos(alfa)
    alfa, piezas, sacadas = quitar_motas(alfa, float(valores.get("motas", 0)))
    medidas = {"piezas": piezas, "motas_sacadas": sacadas, "cubre_pct": round(float((alfa >= 0.5).mean()) * 100, 2)}
    if valores.get("rellenar_huecos"):
        medidas["huecos_rellenados"] = rellenados
    return alfa, medidas


class Fondo(Paso):
    clave = "fondo"
    nombre = "Quitar fondo"
    consigna = (
        "La foto muestra la pieza ya recortada sobre cuadros grises, que son transparencia. Revisá que el recorte "
        "incluya todo el producto (si es un kit, todas sus partes, incluida la caja si forma parte de lo que se vende) "
        "y nada del entorno. Proponé: detalle (1 para una segunda pasada sobre la zona del producto, que separa mejor "
        "los espacios finos, como entre aros), refinar_bordes (1 para ajustar el borde a la foto), rellenar_huecos (1 "
        "si es una sola pieza maciza y se ven manchas o agujeritos transparentes dentro de ella, por ejemplo por "
        "reflejos en el metal; 0 si es un kit, si hay aros o si la pieza tiene agujeros que se ven de lado a lado), "
        "motas (tamaño mínimo de una pieza suelta en % de la foto; más chico que eso se borra, poné 0 si hay piezas "
        "chicas como seguros o clips) y dureza (0 deja el borde suave; más alto lo vuelve más nítido y reduce halos claros)."
    )
    parametros = (
        Parametro(
            "detalle",
            "Segunda pasada",
            "Vuelve a buscar el fondo solo en la zona del producto, para separar mejor los espacios finos.",
            0,
            1,
            1,
            tipo="si_no",
        ),
        Parametro("refinar_bordes", "Refinar bordes", "Ajusta el borde de la silueta a los bordes reales de la foto.", 0, 1, 1, tipo="si_no"),
        Parametro(
            "rellenar_huecos",
            "Rellenar huecos",
            "Vuelve opacos los huecos chicos dentro de una pieza, como reflejos que el modelo tomó por fondo.",
            0,
            1,
            0,
            tipo="si_no",
        ),
        Parametro("motas", "Motas", "Borra los pedacitos sueltos más chicos que este % de la foto.", 0, 2, 0.02, 0.01, " %"),
        Parametro("dureza", "Dureza del borde", "0 deja el borde suave; más alto lo vuelve más nítido.", 0, 100, 0, 1),
    )

    def __init__(self, segmentador: Segmentador | None = None):
        self.segmentador = segmentador or segmentador_rembg()

    def _segmentar(self, rgb: np.ndarray) -> np.ndarray:
        mascara = np.clip(self.segmentador(rgb), 0, 1).astype(np.float32)
        if mascara.shape != rgb.shape[:2]:
            mascara = cv2.resize(mascara, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
        return mascara

    def medir(self, foto: Foto, ajustes: dict) -> Medicion:
        mascara = self._segmentar(foto.rgb)
        extra = {"mascara": mascara, "mascara_detalle": None}
        descartada = False
        zona = zona_del_producto(mascara)
        if zona is not None:
            x0, y0, x1, y1 = zona
            if (x1 - x0) * (y1 - y0) <= _DETALLE_HASTA * foto.alto * foto.ancho:
                # El modelo mira la foto achicada: sobre la zona del producto ve más detalle.
                detalle = np.zeros_like(mascara)
                detalle[y0:y1, x0:x1] = self._segmentar(np.ascontiguousarray(foto.rgb[y0:y1, x0:x1]))
                # Si perdió un pedazo de la pieza que la primera pasada sí vio, no se usa.
                descartada = pedazo_perdido(mascara, detalle) > _PERDIDA_HASTA
                extra["mascara_detalle"] = None if descartada else detalle
        sugeridos = self.defectos(ajustes)
        _, medidas = armar_alfa(self._mascara(extra, sugeridos), foto.rgb, sugeridos)
        medidas["segunda_pasada_disponible"] = extra["mascara_detalle"] is not None
        medidas["segunda_pasada_descartada"] = descartada
        medidas["modelo"] = getattr(self.segmentador, "modelo", "otro")
        medidas["borde_suave_pct"] = round(float(((mascara > 0.05) & (mascara < 0.95)).mean()) * 100, 2)
        return Medicion(medidas=medidas, sugeridos=sugeridos, extra=extra)

    @staticmethod
    def _mascara(extra: dict, valores: dict[str, float]) -> np.ndarray:
        if valores.get("detalle") and extra.get("mascara_detalle") is not None:
            return extra["mascara_detalle"]
        return extra["mascara"]

    def vista_para_claude(self, foto: Foto, medicion: Medicion) -> Foto:
        chica = achicar(foto, 1600)
        mascara = self._mascara(medicion.extra, medicion.sugeridos)
        mascara = cv2.resize(mascara, (chica.ancho, chica.alto), interpolation=cv2.INTER_AREA)
        return Foto(rgb=chica.rgb, alfa=mascara, datos=foto.datos)

    def aplicar(self, foto: Foto, valores: dict[str, float], ajustes: dict, medicion: Medicion) -> Resultado:
        alfa, medidas = armar_alfa(self._mascara(medicion.extra, valores), foto.rgb, valores)
        notas = []
        if medidas["piezas"] == 0:
            notas.append("El modelo no encontró ninguna pieza: revisá la foto.")
        if valores.get("detalle") and medicion.medidas.get("segunda_pasada_descartada"):
            notas.append("La segunda pasada perdía parte del producto: se usó la primera.")
        # Los colores son los mismos de la entrada, sin tocar. Solo se suma la transparencia.
        return Resultado(
            foto=Foto(rgb=foto.rgb, alfa=alfa, datos=foto.datos),
            valores=valores,
            medidas=medidas,
            nota=" ".join(notas) or None,
            mascara=alfa,
        )
