"""Sube un clip a una publicación de Mercado Libre desde el navegador.

Mercado Libre no deja subir clips por programa a las cuentas locales, así que
esto hace lo mismo que una persona: abre un Chrome propio, con la sesión de
Mercado Libre guardada, busca la publicación en el listado del vendedor, entra
por "Crear video" y elige el archivo.

Reglas:
- Un clip por vez, sin apuro.
- Ante cualquier pantalla que no reconoce, no insiste ni adivina: se frena,
  saca una captura, anota lo que ve y avisa.
- Nunca toca nada de la publicación que no sea el video.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

LISTADO = "https://www.mercadolibre.com.ar/publicaciones/listado?search={codigo}"
INICIO = "https://www.mercadolibre.com.ar/publicaciones/listado"

# Lo que se sabe de la pantalla, tomado del recorrido del 18/11/2026.
MENU = "button.sll-list-row-secondary-actions-trigger"
OPCION = "a.sll-list-row-secondary-action__label--link"
TEXTO_OPCION = "Crear video"
ARCHIVO = "input.clip-dropzone__file-input"
TODAS_LAS_VARIANTES = "#CHECKBOX_SHOW_VIDEO_IN_ALL_VARIANTS"
FORMATOS = {".mp4", ".mpeg", ".avi", ".mov"}

ESPERA_MS = 30_000


class NoSePudoSubir(Exception):
    """No se subió. `definitivo`: reintentar no lo arregla, hace falta una persona."""

    def __init__(self, mensaje: str, definitivo: bool = False, informe: dict | None = None):
        super().__init__(mensaje)
        self.definitivo = definitivo
        self.informe = informe


class SesionCerrada(NoSePudoSubir):
    def __init__(self):
        super().__init__("La sesión de Mercado Libre de la Mac está cerrada. Abrila de nuevo con: bash sesion_mercadolibre.sh", True)


class PidePersona(NoSePudoSubir):
    def __init__(self, que: str):
        super().__init__(f"Mercado Libre pidió {que}. Resolvelo con: bash sesion_mercadolibre.sh", True)


class PantallaDesconocida(NoSePudoSubir):
    def __init__(self, donde: str, informe: dict):
        super().__init__(f"La pantalla de Mercado Libre no es la esperada ({donde}). Puede que la hayan cambiado: no se tocó nada.", True, informe)


@dataclass
class Resultado:
    subido: bool
    # Hasta dónde llegó cuando no se confirma: para mirar antes de prender lo automático.
    etapa: str
    informe: dict = field(default_factory=dict)
    captura: Path | None = None


def carpeta_del_navegador(datos: Path) -> Path:
    return datos / "navegador-mercadolibre"


def abrir_navegador(playwright, datos: Path, visible: bool = True):
    """El Chrome propio de la subida, con su sesión guardada entre una vez y otra."""
    perfil = carpeta_del_navegador(datos)
    perfil.mkdir(parents=True, exist_ok=True)
    opciones: dict = {"headless": not visible, "viewport": {"width": 1280, "height": 900}, "locale": "es-AR"}
    # En la Mac, el Chrome instalado. En las pruebas, el que se indique.
    if os.environ.get("MRB_CHROME"):
        opciones["executable_path"] = os.environ["MRB_CHROME"]
        opciones["args"] = ["--no-sandbox"]
    else:
        opciones["channel"] = "chrome"
    return playwright.chromium.launch_persistent_context(str(perfil), **opciones)


def _revisar_sesion(pagina) -> None:
    url = pagina.url.lower()
    if "/login" in url or "/jms/" in url and "login" in url or pagina.locator("input[type=password]").count() > 0:
        raise SesionCerrada()
    if "captcha" in url or pagina.locator("iframe[src*=captcha], [id*=captcha]").count() > 0:
        raise PidePersona("resolver un captcha")
    if "authentication" in url or "/security" in url or "verification" in url:
        raise PidePersona("verificar la identidad")


def mirar(pagina) -> dict:
    """Lo que hay en la pantalla, para entenderla sin verla: títulos, botones, campos y avisos."""
    return pagina.evaluate(
        """() => {
          const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const corto = (t) => (t || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
          const attrs = (e) => Object.fromEntries(['id', 'class', 'data-testid', 'aria-label', 'name', 'role', 'type', 'href', 'disabled', 'aria-disabled', 'accept'].filter((a) => e.hasAttribute(a)).map((a) => [a, corto(e.getAttribute(a))]));
          const lista = (sel, max) => [...document.querySelectorAll(sel)].filter(visible).slice(0, max).map((e) => ({ tag: e.tagName.toLowerCase(), texto: corto(e.innerText || e.value), ...attrs(e) }));
          return {
            url: location.href,
            titulo: document.title,
            encabezados: lista('h1, h2, h3', 20),
            botones: lista('button, [role=button], a.andes-button, input[type=submit]', 60),
            campos: lista('input:not([type=hidden]), textarea, select', 40),
            archivos: [...document.querySelectorAll('input[type=file]')].map((e) => attrs(e)),
            avisos: lista('[role=alert], [role=status], .andes-message, .andes-snackbar, [class*=error], [class*=progress]', 30),
            videos: lista('.clip-preview, [class*=clip-preview]', 20),
            iframes: document.querySelectorAll('iframe').length,
          };
        }"""
    )


def _capturar(pagina, carpeta: Path | None, nombre: str) -> Path | None:
    if not carpeta:
        return None
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"{nombre}.png"
    try:
        pagina.screenshot(path=str(destino), full_page=True)
    except Exception:
        return None
    return destino


def _desconocida(pagina, donde: str, carpeta: Path | None) -> PantallaDesconocida:
    informe = mirar(pagina)
    _capturar(pagina, carpeta, "pantalla-desconocida")
    if carpeta:
        (carpeta / "pantalla-desconocida.json").write_text(json.dumps(informe, ensure_ascii=False, indent=2))
    return PantallaDesconocida(donde, informe)


def direccion_de_subida(pagina, codigo: str, carpeta: Path | None = None) -> str:
    """Busca la publicación en el listado del vendedor y devuelve adónde lleva su opción Crear video."""
    pagina.goto(LISTADO.format(codigo=codigo), wait_until="domcontentloaded", timeout=ESPERA_MS)
    _revisar_sesion(pagina)
    try:
        pagina.wait_for_selector(MENU, timeout=ESPERA_MS)
    except Exception:
        _revisar_sesion(pagina)
        raise _desconocida(pagina, f"no aparece la publicación {codigo} en el listado", carpeta) from None
    filas = pagina.locator(MENU)
    # Con más de una fila no se sabe cuál es: mejor no tocar.
    if filas.count() != 1:
        raise NoSePudoSubir(f"El listado de Mercado Libre mostró {filas.count()} publicaciones al buscar {codigo}: no se sabe a cuál subirle el clip.", True, mirar(pagina))
    filas.first.click()
    opcion = pagina.locator(OPCION, has_text=re.compile(rf"^\s*{re.escape(TEXTO_OPCION)}\s*$"))
    try:
        opcion.first.wait_for(state="visible", timeout=10_000)
    except Exception:
        raise _desconocida(pagina, f"el menú de la publicación no ofrece «{TEXTO_OPCION}»", carpeta) from None
    destino = opcion.first.get_attribute("href") or ""
    if "/video/creator/upload" not in destino or "item_id=" not in destino:
        raise _desconocida(pagina, "el link de Crear video no lleva a la subida de videos", carpeta)
    return destino if destino.startswith("http") else f"https://www.mercadolibre.com.ar{destino}"


def subir_clip(pagina, codigo: str, archivo: Path, *, confirmar: bool, carpeta: Path | None = None, todas_las_variantes: bool = True) -> Resultado:
    """
    Sube el clip a la publicación. Sin `confirmar`, llega hasta elegir el
    archivo, anota la pantalla que aparece y no toca nada más.
    """
    if archivo.suffix.lower() not in FORMATOS:
        raise NoSePudoSubir(f"Mercado Libre no acepta videos {archivo.suffix}: tiene que ser MP4, MOV, MPEG o AVI.", True)
    if not archivo.is_file():
        raise NoSePudoSubir(f"No está el archivo del clip: {archivo}")

    destino = direccion_de_subida(pagina, codigo, carpeta)
    pagina.goto(destino, wait_until="domcontentloaded", timeout=ESPERA_MS)
    _revisar_sesion(pagina)
    try:
        pagina.wait_for_selector(ARCHIVO, state="attached", timeout=ESPERA_MS)
    except Exception:
        _revisar_sesion(pagina)
        raise _desconocida(pagina, "la pantalla Crear video no tiene dónde elegir el archivo", carpeta) from None

    casilla = pagina.locator(TODAS_LAS_VARIANTES)
    if casilla.count() == 1 and casilla.is_checked() != todas_las_variantes:
        casilla.set_checked(todas_las_variantes)

    antes = mirar(pagina)
    pagina.set_input_files(ARCHIVO, str(archivo))
    # Mercado Libre carga y revisa el archivo: se espera a que la pantalla cambie y se quede quieta.
    _esperar_quieta(pagina)
    _revisar_sesion(pagina)
    despues = mirar(pagina)
    captura = _capturar(pagina, carpeta, "despues-de-elegir-el-archivo")
    informe = {"antes": antes, "despues": despues}
    if carpeta:
        (carpeta / "informe.json").write_text(json.dumps(informe, ensure_ascii=False, indent=2))

    if not confirmar:
        return Resultado(False, "archivo elegido, sin confirmar", informe, captura)
    # El paso de confirmar todavía no se conoce: hasta verlo una vez, no se adivina.
    raise PantallaDesconocida("falta conocer el paso de confirmar", despues)


def _esperar_quieta(pagina, maximo_ms: int = 180_000, quieta_ms: int = 4_000) -> None:
    """Espera a que la pantalla deje de cambiar (la carga del video), hasta un máximo."""
    paso = 1_000
    igual = 0
    anterior = None
    for _ in range(maximo_ms // paso):
        pagina.wait_for_timeout(paso)
        ahora = pagina.evaluate("() => document.body.innerText.length + '|' + document.querySelectorAll('button').length + '|' + location.href")
        igual = igual + paso if ahora == anterior else 0
        anterior = ahora
        if igual >= quieta_ms:
            return
