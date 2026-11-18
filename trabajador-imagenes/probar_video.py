"""Prueba en la terminal: edita un video de unboxing y deja todo en una carpeta.

Uso:
    ./probar_video.sh VIDEO [opciones]

Lo que decide Claude:
    --sin-claude            No consultarlo: luz y color medidos y una sola velocidad.
    --cuartos N             El giro a vertical si Claude no decide, en cuartos de vuelta en sentido horario.
    --producto TEXTO        Qué es el producto.
    --momentos ARCHIVO      Los momentos del video según el protocolo: [{"texto": ..., "importancia": "IMPORTANTE"}].

El guión no lo escribe este programa: llega de la app, ya revisado. Acá se pasa con --guion.

Para probar a mano, sin Claude:
    --plan ARCHIVO          Un plan guardado, para aplicarlo tal cual.
    --cortes ARCHIVO        Los cortes ya marcados: [{"inicio": 0, "fin": 8, "importancia": "IMPORTANTE", "nombre": "La caja"}].
    --guion ARCHIVO         El guión del clip, frase por frase: ["Camisas para Fiat uno punto siete diésel.", ...].

El clip:
    --objetivo SEGUNDOS     Cuánto tiene que durar. 45 si no se dice.
    --voz ID                La voz de ElevenLabs que dice el guión.
    --musica ESTILO         El estilo de la música de fondo.
    --subtitulos            Escribir el guión sobre el video.
    --color #RRGGBB         El color de la palabra que se está diciendo.
    --salida CARPETA

En la carpeta quedan las hojas de cuadros, lo que se midió, el plan usado, el
guión con sus tiempos y el clip. El original no se toca.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from mrb_videos import VERSION, hojas
from mrb_videos.editar import PlanInvalido
from mrb_videos.inspector import Contexto, InspectorDeVideo
from mrb_videos.linea import Pedido, armar
from mrb_videos.medios import FaltaFfmpeg, VideoIlegible, es_copia_liviana, leer, para_mirar
from mrb_videos.plan import Plan


def _json(ruta: Path | None):
    return json.loads(ruta.read_text()) if ruta else None


def main() -> int:
    p = argparse.ArgumentParser(description="Edita un video de unboxing para probarlo.")
    p.add_argument("video", type=Path)
    p.add_argument("--sin-claude", action="store_true")
    p.add_argument("--cuartos", type=int, default=0, choices=[0, 1, 2, 3])
    p.add_argument("--producto")
    p.add_argument("--momentos", type=Path)
    p.add_argument("--plan", type=Path)
    p.add_argument("--cortes", type=Path)
    p.add_argument("--guion", type=Path)
    p.add_argument("--objetivo", type=float, default=45.0)
    p.add_argument("--voz")
    p.add_argument("--musica")
    p.add_argument("--subtitulos", action="store_true")
    p.add_argument("--color", help="El color de la palabra que se está diciendo en los subtítulos, como #6FA82C.")
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

        pedido = Pedido(
            objetivo=args.objetivo,
            contexto=Contexto(producto=args.producto),
            plan=Plan.model_validate_json(args.plan.read_text()) if args.plan else None,
            momentos=_json(args.momentos) or [],
            cortes=_json(args.cortes),
            guion=_json(args.guion),
            voz=args.voz,
            musica=args.musica,
            subtitulos=args.subtitulos,
            color_subtitulos=args.color,
            cuartos=args.cuartos,
        )
        inspector = InspectorDeVideo.desde_entorno(simulado=args.sin_claude)
        empezo = time.monotonic()
        r = armar(fuente, mirar, pedido, inspector, salida / "trabajo", salida / "clip.mp4")

        print(f"Plan ({r.origen}): {r.razon}")
        for t in r.plan.tramos:
            veces = "velocidad normal" if abs(t.velocidad - 1) < 0.01 else f"{t.velocidad:.1f} veces más rápido".replace(".", ",")
            print(f"  {hojas.reloj(t.inicio)} a {hojas.reloj(t.fin)}  {t.nombre or 'Sin nombre'}: {veces}")
        if r.plan.cierre:
            print(f"  Al final, {r.plan.cierre:g} segundos con la imagen quieta.")
        for linea in r.guion:
            print(f"  Voz, {hojas.reloj(linea.inicio)} a {hojas.reloj(linea.fin)}: {linea.texto}")
        for aviso in r.avisos:
            print(f"Aviso: {aviso}")
        if r.costo_usd:
            print(f"Costo de Claude: {r.costo_usd:.4f} dólares.")
        (salida / "medidas.json").write_text(json.dumps(r.medidas.como_dict(), ensure_ascii=False, indent=2))
        (salida / "plan.json").write_text(r.plan.model_dump_json(indent=2))
        (salida / "guion.json").write_text(json.dumps([{"inicio": x.inicio, "fin": x.fin, "texto": x.texto} for x in r.guion], ensure_ascii=False, indent=2))
        print(f"Listo en {time.monotonic() - empezo:.0f} s: {r.clip.ruta}")
        sonido = ", ".join(x for x in ["voz" if r.guion else "", "música" if r.con_musica else "", "subtítulos" if r.con_subtitulos else ""] if x) or "en silencio"
        print(f"  {r.clip.ancho} × {r.clip.alto}, {r.clip.duracion:.1f} s, {r.clip.bytes / 1024**2:.1f} MB, con {r.clip.codificador}. Sonido: {sonido}.")
        if r.volumen_lufs is not None:
            print(f"  Volumen: {r.volumen_lufs:.1f} LUFS.")
        return 0
    except (FaltaFfmpeg, VideoIlegible, PlanInvalido, ValueError, RuntimeError) as e:
        print(f"No se pudo: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
