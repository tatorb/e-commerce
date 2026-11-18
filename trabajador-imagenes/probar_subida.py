"""Prueba en la terminal: sube un clip a una publicación de Mercado Libre desde el navegador.

Uso:
    bash probar_subida.sh CLIP CODIGO [--confirmar] [--oculto]

    CLIP       El archivo del clip, por ejemplo ~/Desktop/clip.mp4
    CODIGO     El código de la publicación, por ejemplo MLA3307805900

Sin --confirmar, llega hasta elegir el archivo y se frena ahí: no publica nada.
Deja en una carpeta del Escritorio una captura y un informe de lo que apareció
en la pantalla. Ojo: Mercado Libre puede guardar el archivo en "Tus videos"
apenas se elige, aunque no se publique.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from mrb_imagenes.config import carpeta_de_datos
from mrb_videos import subida


def main() -> int:
    p = argparse.ArgumentParser(description="Sube un clip a una publicación de Mercado Libre para probar.")
    p.add_argument("clip", type=Path)
    p.add_argument("codigo")
    p.add_argument("--confirmar", action="store_true")
    p.add_argument("--oculto", action="store_true", help="Sin mostrar la ventana.")
    p.add_argument("--salida", type=Path)
    a = p.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Falta instalar una parte del programa. Corré: bash instalar.sh")
        return 1

    clip = a.clip.expanduser()
    carpeta = (a.salida or Path.home() / "Desktop" / f"subida-{a.codigo}-{time.strftime('%H%M%S')}").expanduser()
    with sync_playwright() as pw:
        try:
            contexto = subida.abrir_navegador(pw, carpeta_de_datos(), visible=not a.oculto)
        except Exception as e:
            print(f"No se pudo abrir Chrome. ¿Está instalado Google Chrome y cerrada la ventana de sesion_mercadolibre.sh? ({str(e).splitlines()[0]})")
            return 1
        pagina = contexto.pages[0] if contexto.pages else contexto.new_page()
        try:
            r = subida.subir_clip(pagina, a.codigo.strip().upper(), clip, confirmar=a.confirmar, carpeta=carpeta)
        except subida.NoSePudoSubir as e:
            print(f"No se subió: {e}")
            if carpeta.exists():
                print(f"Lo que se vio quedó en: {carpeta}")
            return 2
        finally:
            if not a.oculto:
                # Un momento para mirar la pantalla antes de que se cierre.
                try:
                    pagina.wait_for_timeout(8_000)
                except Exception:
                    pass
            contexto.close()
    print("Subido." if r.subido else f"Llegó hasta: {r.etapa}. No se publicó nada.")
    print(f"El informe y la captura quedaron en: {carpeta}")
    botones = [b.get("texto") for b in r.informe.get("despues", {}).get("botones", []) if b.get("texto")]
    if botones:
        print("Botones que aparecieron:", " | ".join(dict.fromkeys(botones)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
