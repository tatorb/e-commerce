# Editor de videos

El editor arma el clip vertical de un video de unboxing. Corre en la Mac del estudio, dentro del mismo trabajador que corrige las fotos, y le hace esto a cada video:
1. Lo gira para que quede vertical, con las manos entrando desde abajo y la etiqueta derecha.
2. Lo endereza y lo acerca, si hace falta.
3. Corrige la luz y el balance de blancos.
4. Lo acelera para que dure lo pedido.
5. Le saca el sonido de la grabación.
6. Lo exporta en el tamaño que pide Mercado Libre, 1080 × 1920.

Claude mira unos cuadros del video y propone los valores, y el programa los aplica. El clip queda en la carpeta de videos del producto en el Drive, al lado del original, esperando que lo apruebes.

**Regla de oro:** solo se edita el video original. Nada se genera ni se inventa en la imagen, y el original nunca se toca.

**Lo que todavía no hace:** cortar por momentos con distintas velocidades, el guión, la voz en off y la música. Hoy todo el video va a una sola velocidad.

## Qué necesitás

- **El trabajador de imágenes instalado y configurado.** Cómo, en [IMAGENES.md](IMAGENES.md). El editor usa su misma llave y su misma clave de Claude.
- **ffmpeg**, el programa que edita los videos. Se instala una vez, en la Terminal:

```bash
brew install ffmpeg
```

- **Google Drive para computadoras** en la Mac, con la cuenta del estudio. No es obligatorio, pero sin él cada video se baja por internet antes de editarlo, y pesan mucho.

## Cómo se usa

1. **Copiá el video a la carpeta del producto.** En el Drive, `E-commerce Studio MRB / la cuenta / el producto / Videos`. Si la cámara es una DJI, copiá también el archivo `.LRF` que graba al lado de cada video: es una copia liviana y el editor la usa para mirar más rápido.
2. **Abrí el paso Videos** de una publicación del producto. La app lee la carpeta y muestra el video.
3. **Tocá Editar para clip.** Elegí cuántos segundos tiene que durar y, si hace falta, escribí una indicación para el editor.
4. **Esperá a que la Mac lo tome.** La pantalla se pone al día sola.
5. **Mirá el clip** y tocá Aprobar, Pedir de nuevo o Descartar el clip.
6. **Elegilo como clip** de la publicación, con Usar como clip.

## Cuándo edita la Mac

Se elige en Equipo, en Editor de videos. Arranca apagado.

- **Apagado.** La Mac no edita videos. Si estaba editando uno, lo deja y vuelve a la cola.
- **Prendido.** Edita apenas hay un video en la cola.
- **Con horario.** Edita solo entre las dos horas que elijas, con la hora de la Mac. Si empezó dentro del horario, termina.

En cualquiera de los dos últimos se puede pedir que edite solo con la Mac enchufada.

Las fotos van siempre primero: la Mac pregunta por videos solo cuando no tiene fotos para corregir.

## Probar un video sin la app

En la Terminal, en la carpeta `trabajador-imagenes`:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4
```

Deja al lado del video una carpeta `edicion-…` con el clip, las hojas de cuadros con su segundo, lo que se midió y el plan usado. Para probar sin Claude:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --sin-claude --cuartos 1
```

Para probar cortes y velocidades a mano, editá el `plan.json` que dejó la corrida anterior y pasalo:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --plan ~/Desktop/edicion-DJI_0073_D/plan.json
```

## Para grabar mejor

- **Fijá la exposición y el balance de blancos** en la cámara antes de grabar. Si la cámara los va cambiando sola, el editor avisa, pero no lo puede arreglar del todo.
- **Grabá en 4K.** Al girar el video a vertical sobra calidad.

## Cómo está hecho

- `trabajador-imagenes/mrb_videos/`: el editor. `plan.py` es el plan de edición, `medir.py` lo que mide el código, `inspector.py` la consulta a Claude, `filtros.py` y `editar.py` lo que se le pide a ffmpeg, `trabajo.py` una edición de punta a punta y `conexion.py` los mensajes con la app.
- `src/domain/video-edit.ts`: el plan, los mensajes y cuándo puede editar la Mac.
- `src/lib/video-edits.ts`: la cola de edición. `src/lib/video-edit-files.ts`: los archivos en el Drive.
- `src/app/api/videos/trabajador/`: por donde la Mac pregunta, avisa que sigue, baja el original y entrega.
- `trabajador-imagenes/contrato/video_*.json`: ejemplos de los mensajes, que prueban los dos lados.
