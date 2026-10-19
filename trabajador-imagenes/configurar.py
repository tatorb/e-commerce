"""Configura el trabajador: la dirección de la app, su llave y la clave de Claude.

Las claves se escriben sin que se vean en pantalla y quedan en el Llavero de
macOS, no en un archivo. Con Enter se deja lo que ya estaba.
"""

from __future__ import annotations

import getpass
import sys

from mrb_imagenes.app import ClienteApp, ErrorDeApp
from mrb_imagenes.config import guardar_direccion, guardar_llave_app, leer_direccion, leer_llave_app
from mrb_imagenes.inspector import MODELO, SERVICIO_LLAVERO, obtener_clave_claude


def configurar_app() -> bool:
    actual = leer_direccion()
    direccion = input(f"Dirección de la app [{actual}]: ").strip() or actual
    if not direccion.startswith(("https://", "http://")):
        direccion = f"https://{direccion}"
    guardar_direccion(direccion)

    hay = leer_llave_app()
    print("Pegá la llave del trabajador, la que se crea en la app en Equipo (empieza con mrbimg_).")
    if hay:
        print(f"Ya hay una cargada, terminada en «{hay[-4:]}». Con Enter queda esa.")
    llave = getpass.getpass("Llave: ").strip() or (hay or "")
    if not llave.startswith("mrbimg_"):
        print("Eso no parece una llave del trabajador. No se guardó.")
        return False
    try:
        # Un aviso de prueba: comprueba la llave sin tomar ningún trabajo.
        ClienteApp(direccion, llave, timeout=30).latido("prueba", 0)
    except ErrorDeApp as e:
        if e.estado == 401:
            print("La app no aceptó la llave. Fijate que sea la última que creaste en Equipo. No se guardó.")
            return False
        print(f"No se pudo comprobar la llave: {e}. Se guarda igual.")
    try:
        guardar_llave_app(llave)
    except Exception as e:
        print(f"No se pudo guardar en el Llavero ({e}).")
        return False
    print("La llave de la app quedó guardada en el Llavero.")
    return True


def configurar_claude() -> bool:
    hay = obtener_clave_claude()
    print("Pegá la clave de Claude (empieza con sk-ant-). No se va a ver mientras la pegás.")
    if hay:
        print("Ya hay una cargada. Con Enter queda esa.")
    clave = getpass.getpass("Clave: ").strip()
    if not clave and hay:
        return True
    if not clave.startswith("sk-ant-"):
        print("Eso no parece una clave de Claude. No se guardó nada.")
        return False
    import anthropic

    try:
        anthropic.Anthropic(api_key=clave, timeout=30).models.retrieve(MODELO)
    except anthropic.AuthenticationError:
        print("Claude no aceptó la clave. No se guardó nada.")
        return False
    except Exception as e:
        print(f"No se pudo comprobar la clave ({type(e).__name__}). Se guarda igual.")
    try:
        import keyring

        keyring.set_password(SERVICIO_LLAVERO, "claude", clave)
    except Exception as e:
        print(f"No se pudo guardar en el Llavero ({e}).")
        return False
    print("La clave de Claude quedó guardada en el Llavero.")
    return True


def main() -> int:
    solo_claude = "--solo-claude" in sys.argv
    ok = True
    if not solo_claude:
        ok = configurar_app() and ok
        print()
    ok = configurar_claude() and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
