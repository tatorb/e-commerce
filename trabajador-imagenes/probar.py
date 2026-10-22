"""Prueba en la terminal: pasa una foto por los 9 pasos y deja todo en una carpeta.

Uso:
    ./probar.sh FOTO [--simulado] [--preguntar] [--producto "Kit de embrague Sachs"] [--salida CARPETA]

En la carpeta quedan la vista de cada paso, la máscara, el PNG y el JPG
finales, la receta con los valores y las explicaciones de Claude, y
resumen.html para mirarlo todo en el navegador. El original no se toca.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import sys
import time
from pathlib import Path

from mrb_imagenes import VERSION
from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.imagen import FotoIlegible, exif_legible, guardar_intermedia, guardar_mascara, leer_original, vista_jpeg
from mrb_imagenes.inspector import Inspector
from mrb_imagenes.linea import Corrida, aplicar, medir_y_proponer, saltear
from mrb_imagenes.pasos import armar_pasos
from mrb_imagenes.pasos.fondo import memoria_gb


def huella(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def preguntar(corrida: Corrida) -> str:
    ejemplo = " ".join(f"{k}={v:g}" for k, v in list(corrida.resultado.valores.items())[:2])
    print(f"    [Enter] aprobar · [s] saltear · o escribí valores para rehacer, por ejemplo: {ejemplo}")
    try:
        return input("    > ").strip()
    except EOFError:
        return ""


def leer_pedido(texto: str) -> dict[str, float]:
    pedidos: dict[str, float] = {}
    for parte in texto.split():
        if "=" in parte:
            clave, valor = parte.split("=", 1)
            try:
                pedidos[clave.strip()] = float(valor.replace(",", "."))
            except ValueError:
                print(f"    «{parte}» no es un número: se ignora.")
    return pedidos


def mostrar(n: int, corrida: Corrida) -> None:
    r = corrida.receta()
    estado = "salteado" if r["salteado"] else "listo"
    print(f"\n{n}. {r['nombre']}: {estado} ({r['segundos']} s)")
    if r["propuesta"]:
        print(f"    Claude ({r['propuesta']['origen']}): {r['propuesta']['razon']}")
    if r["valores"]:
        print("    Valores: " + ", ".join(f"{k}={v:g}" for k, v in r["valores"].items()))
    if r["nota"]:
        print(f"    Nota: {r['nota']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Pasa una foto por los 9 pasos de la línea de corrección.")
    parser.add_argument("foto", type=Path, nargs="?")
    parser.add_argument("--salida", type=Path, help="Carpeta de resultados. Por defecto, al lado de la foto.")
    parser.add_argument("--simulado", action="store_true", help="Sin Claude: usa los valores que mide el código.")
    parser.add_argument("--preguntar", action="store_true", help="Frena después de cada paso para aprobar, saltear o rehacer.")
    parser.add_argument("--producto", help="Qué es la pieza, para que Claude tenga contexto.")
    parser.add_argument("--ajustes", type=Path, help="Archivo JSON con márgenes, fondo, calidad y topes.")
    parser.add_argument("--intermedios", action="store_true", help="Guarda también cada paso en tamaño completo (PNG de 16 bits, pesado).")
    parser.add_argument(
        "--modelo",
        choices=["completo", "liviano"],
        help="Modelo para quitar el fondo. Por defecto, el que entra en la memoria de la Mac.",
    )
    args = parser.parse_args()
    if args.foto is None:
        print("Falta la foto. Escribí todo en una sola línea, por ejemplo:")
        print('  bash probar.sh /Users/vos/Downloads/IMG_7356.HEIC --preguntar --producto "Kit de pistones"')
        print("Para no escribir la ruta, arrastrá la foto a la Terminal después de «bash probar.sh ».")
        return 1

    original: Path = args.foto.expanduser().resolve()
    if not original.is_file():
        print(f"No encuentro la foto {original}")
        return 1
    salida: Path = (args.salida or original.parent / f"{original.stem}-corregida").expanduser().resolve()
    salida.mkdir(parents=True, exist_ok=True)
    ajustes = leer_ajustes(json.loads(args.ajustes.read_text()) if args.ajustes else None)
    try:
        inspector = Inspector.desde_entorno(simulado=args.simulado)
    except RuntimeError as e:
        print(e)
        return 1

    huella_antes = huella(original)
    inicio = time.monotonic()
    print(f"Trabajador de imágenes {VERSION}")
    print(f"Foto: {original.name} · resultados en {salida}")
    try:
        foto, avisos = leer_original(original)
    except FotoIlegible as e:
        print(e)
        return 1
    print(f"Preparada: {foto.ancho} x {foto.alto} px · {exif_legible(foto.datos)} · color {foto.datos['perfil']}")
    for a in avisos:
        print(f"  Aviso: {a}")
    (salida / "00-original.jpg").write_bytes(vista_jpeg(foto))
    if args.intermedios:
        guardar_intermedia(foto, salida / "00-original.png")

    pasos = armar_pasos(modelo_fondo=args.modelo)
    print(f"Modelo para quitar el fondo: {getattr(pasos[5].segmentador, 'modelo', '?')} (memoria de esta Mac: {memoria_gb():.0f} GB)")
    recetas = []
    for n, paso in enumerate(pasos, start=1):
        comienzo = time.monotonic()
        medicion, propuesta = medir_y_proponer(paso, foto, ajustes, inspector, args.producto)
        corrida = aplicar(paso, foto, ajustes, medicion, propuesta)
        corrida.segundos = time.monotonic() - comienzo
        mostrar(n, corrida)
        while args.preguntar and not corrida.resultado.salteado:
            respuesta = preguntar(corrida)
            if not respuesta:
                break
            if respuesta.lower() in {"s", "saltear"}:
                corrida = saltear(paso, foto, medicion, propuesta)
                mostrar(n, corrida)
                break
            corrida = aplicar(paso, foto, ajustes, medicion, propuesta, pedidos={**corrida.resultado.valores, **leer_pedido(respuesta)})
            mostrar(n, corrida)
        resultado = corrida.resultado
        nombre = f"{n:02d}-{paso.clave}"
        (salida / f"{nombre}.jpg").write_bytes(vista_jpeg(resultado.foto))
        if args.intermedios and not resultado.salteado:
            guardar_intermedia(resultado.foto, salida / f"{nombre}.png")
        if resultado.mascara is not None:
            guardar_mascara(resultado.mascara, salida / f"{nombre}-mascara.png")
        for archivo, contenido in resultado.archivos.items():
            (salida / archivo).write_bytes(contenido)
        receta = corrida.receta()
        receta["vista"] = f"{nombre}.jpg"
        recetas.append(receta)
        foto = resultado.foto

    intacto = huella(original) == huella_antes
    total = sum((r["uso_claude"] or {}).get("costo_usd", 0) for r in recetas)
    resumen = {
        "version": VERSION,
        "foto": original.name,
        "camara": foto.datos.get("camara"),
        "ajustes": ajustes,
        "pasos": recetas,
        "original_intacto": intacto,
        "costo_claude_usd": round(total, 4),
        "segundos": round(time.monotonic() - inicio, 1),
    }
    (salida / "receta.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2))
    (salida / "resumen.html").write_text(pagina(resumen))
    print(f"\nListo en {resumen['segundos']} s. Costo de Claude: US$ {total:.3f}.")
    print("El original no cambió." if intacto else "ATENCIÓN: el original cambió.")
    print(f"Abrí {salida / 'resumen.html'} para verlo todo.")
    return 0 if intacto else 2


def pagina(resumen: dict) -> str:
    e = html.escape
    tarjetas = []
    anterior = "00-original.jpg"
    for n, r in enumerate(resumen["pasos"], start=1):
        valores = ", ".join(f"{e(k)} = {v:g}" for k, v in r["valores"].items()) or "—"
        razon = e(r["propuesta"]["razon"]) if r["propuesta"] else ""
        origen = e(r["propuesta"]["origen"]) if r["propuesta"] else ""
        nota = f"<p class='nota'>{e(r['nota'])}</p>" if r["nota"] else ""
        estado = "Salteado" if r["salteado"] else f"{r['segundos']} s"
        tarjetas.append(
            f"""<section><h2>{n}. {e(r['nombre'])} <small>{estado}</small></h2>
<div class="par"><figure><img src="{e(anterior)}" alt="Antes"><figcaption>Antes</figcaption></figure>
<figure><img src="{e(r['vista'])}" alt="Después"><figcaption>Después</figcaption></figure></div>
<p><b>Claude</b> <span class="origen">{origen}</span> {razon}</p><p><b>Valores</b> {valores}</p>{nota}</section>"""
        )
        if not r["salteado"]:
            anterior = r["vista"]
    estado = "El original no cambió." if resumen["original_intacto"] else "Atención: el original cambió."
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(resumen['foto'])} · Línea de imágenes</title>
<style>body{{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f6f6f4;color:#222}}main{{max-width:1100px;margin:auto}}
section{{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0}}h2{{font-size:18px;margin:0 0 12px}}small{{color:#888;font-weight:normal}}
.par{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}figure{{margin:0}}img{{width:100%;height:auto;border-radius:4px;background:#eee}}
figcaption{{font-size:12px;color:#777}}.nota{{color:#8a5a00}}.origen{{font-size:12px;color:#777}}.final img{{max-width:600px}}
@media(max-width:640px){{.par{{grid-template-columns:1fr}}}}</style></head><body><main>
<h1>{e(resumen['foto'])}</h1><p>{e(estado)} Tiempo total {resumen['segundos']} s · Claude US$ {resumen['costo_claude_usd']:.3f}</p>
{''.join(tarjetas)}
<section class="final"><h2>Final</h2><p><a href="final.jpg">final.jpg</a> · <a href="final.png">final.png</a></p><img src="final.jpg" alt="Foto final"></section>
</main></body></html>"""


if __name__ == "__main__":
    sys.exit(main())
