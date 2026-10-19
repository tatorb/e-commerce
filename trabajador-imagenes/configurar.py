"""Guarda la clave de Claude en el Llavero de macOS, y comprueba que funciona.

La clave se escribe sin que se vea en pantalla y no queda en ningún archivo.
"""

from __future__ import annotations

import getpass
import sys

from mrb_imagenes.inspector import MODELO, SERVICIO_LLAVERO


def main() -> int:
    print("Pegá la clave de Claude (empieza con sk-ant-). No se va a ver mientras la pegás.")
    clave = getpass.getpass("Clave: ").strip()
    if not clave.startswith("sk-ant-"):
        print("Eso no parece una clave de Claude. No se guardó nada.")
        return 1
    import anthropic

    try:
        anthropic.Anthropic(api_key=clave, timeout=30).models.retrieve(MODELO)
    except anthropic.AuthenticationError:
        print("Claude no aceptó la clave. No se guardó nada.")
        return 1
    except Exception as e:
        print(f"No se pudo comprobar la clave ({type(e).__name__}). Se guarda igual.")
    try:
        import keyring

        keyring.set_password(SERVICIO_LLAVERO, "claude", clave)
    except Exception as e:
        print(f"No se pudo guardar en el Llavero ({e}).")
        return 1
    print("Listo: la clave quedó guardada en el Llavero.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
