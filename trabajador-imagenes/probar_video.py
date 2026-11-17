"""Prueba en la terminal: edita un video de unboxing y deja todo en una carpeta.

Uso:
    ./probar_video.sh VIDEO [--cuartos 1] [--objetivo 45] [--plan plan.json] [--salida CARPETA]

Sin --plan, pasa todo el video a una sola velocidad para que dure lo pedido,
con la luz y el color que midió el código. Con --plan, aplica ese plan tal
cual: sirve para probar cortes y velocidades a mano.

En la carpeta quedan las hojas de cuadros, lo que se midió, el plan usado y
el clip. El original no se toca.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from mrb_videos import VERSION, hojas
from mrb_videos.editar import PlanInvalido, exportar
from mrb_videos.medios import FaltaFfmpeg, VideoIlegible, es_copia_liviana, leer, para_mirar
from mrb_videos.medir import cuadros, medir
from mrb_videos.plan import Imagen, Plan, plan_parejo


def main() -> int:
    p = argparse.ArgumentParser(description="Edita un video de unboxing para probarlo.")
    p.add_argument("video", type=Path)
    p.add_argument("--cuartos", type=int, default=0, choices=[0, 1, 2, 3], help="Cuartos de vuelta en sentido horario para dejarlo vertical.")
    p.add_argument("--objetivo", type=float, default=45.0, help="Cuántos segundos tiene que durar el clip.")
    p.add_argument("--plan", type=Path, help="Un plan guardado, para aplicarlo tal cual.")
    p.add_argument("--salida", type=Path)
    args = p.parse_args()

    try:
        if es_copia_liviana(args.video):
            print("Ese archivo es la copia liviana de la cámara. Pasá el video original, el .MP4.")
            return 2
        fuente = leer(args.video)
        mirar = leer(para_mirar(args.video))
        salida = args.salida or args.video.with_name(f"edicion-{args.video.stem}")
        salida.mkdir(parents=True, exist_ok=True)
        print(f"Editor de videos {VERSION}")
        print(f"Original: {fuente.ancho} × {fuente.alto}, {fuente.duracion:.1f} s, {fuente.fps:g} cuadros por segundo, {fuente.codec} de {fuente.bits} bits.")
        if mirar.ruta != fuente.ruta:
            print(f"Para mirar y medir se usa la copia liviana: {mirar.ruta.name}.")

        medidas = medir(cuadros(mirar))
        for aviso in medidas.avisos:
            print(f"Aviso: {aviso}")

        if args.plan:
            plan = Plan.model_validate_json(args.plan.read_text())
        else:
            plan = plan_parejo(fuente, Imagen(cuartos=args.cuartos, **medidas.sugeridos), args.objetivo)
        (salida / "medidas.json").write_text(json.dumps(medidas.como_dict(), ensure_ascii=False, indent=2))
        (salida / "plan.json").write_text(plan.model_dump_json(indent=2))

        armadas = hojas.armar(mirar, salida / "hojas", cuartos=plan.imagen.cuartos)
        print(f"Hojas de cuadros: {len(armadas)} en {salida / 'hojas'}")

        print(f"Exportando un clip de {plan.dura:.1f} segundos…")
        empezo = time.monotonic()
        clip = exportar(fuente, plan, salida / "clip.mp4")
        print(f"Listo en {time.monotonic() - empezo:.0f} s: {clip.ruta}")
        print(f"  {clip.ancho} × {clip.alto}, {clip.duracion:.1f} s, {clip.bytes / 1024**2:.1f} MB, con {clip.codificador}.")
        for aviso in clip.avisos:
            print(f"  Aviso: {aviso}")
        return 0
    except (FaltaFfmpeg, VideoIlegible, PlanInvalido, ValueError) as e:
        print(f"No se pudo: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
