"""Abre el Chrome de la subida de clips para iniciar sesión en Mercado Libre.

Uso:
    bash sesion_mercadolibre.sh

Se abre una ventana de Chrome aparte, que no es la tuya de todos los días.
Iniciá sesión con la cuenta de la tienda, y cuando veas tu listado de
publicaciones, cerrá la ventana. La sesión queda guardada en esta Mac para que
el programa suba los clips. La contraseña no pasa por el programa ni se guarda
en ningún otro lado.
"""

from __future__ import annotations

import sys

from mrb_imagenes.config import carpeta_de_datos
from mrb_videos import subida


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Falta instalar una parte del programa. Corré: bash instalar.sh")
        return 1
    print("Se abre una ventana de Chrome. Iniciá sesión en Mercado Libre y, cuando veas tus publicaciones, cerrala.")
    with sync_playwright() as p:
        try:
            contexto = subida.abrir_navegador(p, carpeta_de_datos(), visible=True)
        except Exception as e:
            print(f"No se pudo abrir Chrome. ¿Está instalado Google Chrome en esta Mac? ({str(e).splitlines()[0]})")
            return 1
        pagina = contexto.pages[0] if contexto.pages else contexto.new_page()
        pagina.goto(subida.INICIO, wait_until="domcontentloaded")
        try:
            pagina.wait_for_event("close", timeout=0)
        except Exception:
            pass
        try:
            contexto.close()
        except Exception:
            pass
    print("Listo: la sesión quedó guardada en esta Mac.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
