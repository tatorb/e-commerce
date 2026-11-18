# Editor de videos

El editor arma el clip vertical de un video de unboxing. Corre en la Mac del estudio, dentro del mismo trabajador que corrige las fotos, y le hace esto a cada video:
1. Lo gira para que quede vertical, con las manos entrando desde abajo y la etiqueta derecha.
2. Lo endereza y lo acerca, si hace falta.
3. Corrige la luz y el balance de blancos.
4. Marca los momentos del video y le da a cada uno su velocidad.
5. Le saca el sonido de la grabación.
6. Le pone la voz en off, la música y los subtítulos, si la cuenta los tiene prendidos.
7. Lo exporta en el tamaño que pide Mercado Libre, 1080 × 1920.

Claude mira el video y propone la imagen, los cortes y el guión, y el programa los aplica. El clip queda en la carpeta de videos del producto en el Drive, al lado del original, esperando que lo apruebes.

**Regla de oro:** solo se edita el video original. Nada se genera ni se inventa en la imagen, y el original nunca se toca.

## Cómo decide las velocidades

En el protocolo, cada paso de video cuenta sus momentos en orden y qué tan importante es cada uno:

- **Importante:** va a velocidad normal. La etiqueta, la pieza en detalle, el final con todo a la vista.
- **Normal:** se acelera. Abrir la caja, sacar envoltorios.
- **Repetido:** va lo más rápido. Lo mismo que ya se mostró, hecho otra vez.

Claude ubica cada momento en el video. Las velocidades las calcula el programa, lo justo para que el clip dure lo pedido: por eso la duración sale siempre dentro de lo que acepta el canal. Si lo importante solo no entra, también se acelera un poco, y el clip lo avisa.

Sin momentos en el protocolo, Claude los marca por lo que ve.

## La voz, la música y los subtítulos

Se prenden por cuenta, en Ajustes, Protocolos de fotos, Edición de videos.

- **Voz en off.** ElevenLabs dice el guión del clip con la voz que elijas. Hace falta el ID de la voz: en ElevenLabs, en Voices, abrí el menú de la voz y elegí Copy voice ID. El guión se escribe aparte, antes de editar: está más abajo.
- **Música.** ElevenLabs la genera para cada clip, del largo justo, con el estilo que describas. Baja sola cuando habla la voz.
- **Subtítulos.** El guión escrito sobre el video, de a pocas palabras, con la que se está diciendo resaltada en el color de la marca, que se elige ahí mismo. Los dibuja el programa, con la letra Poppins Bold que viene con él, así que se ven igual en cualquier Mac y no dependen de cómo esté instalado ffmpeg.

La mezcla lleva la voz a -14 LUFS, el volumen de las redes, y la música a un 16 %.

Si algo falla, el clip sale igual con lo que hay y lo avisa: sin Claude va a una sola velocidad, sin guión sale sin voz, y sin ElevenLabs sale en silencio.

## El guión del clip

La voz no relata lo que se ve: eso ya se ve. Aprovecha ese tiempo para dar las certezas que el comprador necesita, las mismas que la imagen con texto: qué es, con qué es compatible, con qué no, y las dudas que más se repiten.

Se escribe antes de editar, en el paso Videos, en la sección Guión del clip:

1. **Pedir el guión a Claude.** Lo arma con el paso Información y con Preguntas y respuestas de la publicación: la ficha y sus compatibilidades, lo del fabricante, lo que sabe la tienda, las preguntas de los compradores y de la competencia, y los dolores y objeciones. No inventa: si falta un dato, no lo dice.
2. **Corregirlo.** Cada frase se edita, se sube, se baja o se saca, y se pueden agregar frases. Abajo dice cuántas palabras tiene y cuántos segundos lleva decirlo.
3. **Guardar.**

El guión es del producto: vale para todos sus videos y todas sus publicaciones.

Después, al editar un video, el editor se acomoda al guión y no al revés. Primero genera la voz, mide cuánto dura y con eso calcula las velocidades. Si la voz dura más que lo pedido, el clip se alarga para que entre, hasta lo que acepta el canal, y lo avisa. Las frases se reparten a lo largo del clip, con pausas parejas.

Un clip ya editado no cambia cuando se corrige el guión: para que diga el guión nuevo, hay que pedirlo de nuevo.

## Qué necesitás

- **El trabajador de imágenes instalado y configurado.** Cómo, en [IMAGENES.md](IMAGENES.md). El editor usa su misma llave y su misma clave de Claude.
- **ffmpeg**, el programa que edita los videos. Se instala una vez, en la Terminal:

```bash
brew install ffmpeg
```

- **Una clave de ElevenLabs**, solo si querés voz o música. Se crea en elevenlabs.io, en API Keys, con acceso a Text to Speech y a Music. Se carga en la Mac con:

```bash
bash configurar.sh
```

- **Google Drive para computadoras** en la Mac, con la cuenta del estudio. No es obligatorio, pero sin él cada video se baja por internet antes de editarlo, y pesan mucho.

## Cómo se usa

1. **Copiá el video a la carpeta del producto.** En el Drive, `E-commerce Studio MRB / la cuenta / el producto / Videos`. Si la cámara es una DJI, copiá también el archivo `.LRF` que graba al lado de cada video: es una copia liviana y el editor la usa para mirar más rápido.
2. **Abrí el paso Videos** de una publicación del producto. La app lee la carpeta y muestra el video.
3. **Tocá Editar para clip.** Elegí cuántos segundos tiene que durar, con qué paso del protocolo se grabó y, si hace falta, escribí una indicación para el editor.
4. **Esperá a que la Mac lo tome.** La pantalla se pone al día sola y muestra en qué etapa va: si Claude está mirando la imagen, marcando los cortes o escribiendo el guión, qué línea de la voz se está generando, y cuánto lleva exportado el clip. En Equipo, en Editor de videos, se ve la cola entera, de todas las cuentas.
5. **Mirá el clip.** Abajo se ve cómo se editó, lo que dice la voz y los avisos.
6. **Aprobalo, o corregilo.** Con Ajustar los cortes cambiás a mano dónde corta cada tramo y su velocidad, y la Mac lo rehace tal cual. Con Pedir de nuevo, Claude lo propone otra vez con tu indicación. Lo que dice la voz se corrige arriba, en Guión del clip.
7. **Elegilo como clip** de la publicación, con Usar como clip.

## Subir el clip a Mercado Libre

El clip sigue la misma lógica que el resto del pipeline: se aprueba, queda en **Por subir** y lo subís cuando quieras. Aprobar no sube nada.

1. Al aprobar un clip, queda elegido en las publicaciones activas del producto que no tenían clip. Qué clips van y en qué medidas se cambia en **Organización de multimedia**.
2. En el Pipeline, la pestaña **Por subir** tiene la sección **Clips**. También aparecen en el paso **Publicación** de cada publicación.
3. Va una subida por producto: Mercado Libre muestra el mismo video en todas sus medidas y formas de cobro. Si un clip está elegido solo en algunas medidas, va una subida por medida y se ve solo en esa.

### La medida de cada video

En un producto con varias medidas, cada video tiene la suya. Sale del primero de estos que haya:

1. La elegís vos en el paso Videos, con el desplegable **Medida** de cada video.
2. Se grabó con su medida en Registro de productos.
3. El nombre del archivo trae el SKU de la medida, por ejemplo `SP-449-060.MP4`.

El clip editado es de la medida de su video. Al aprobarlo: con un solo video aprobado se ve en todas las medidas; cuando aprobás el de otra medida, cada uno queda en la suya.

Mercado Libre no deja subir clips por programa a las cuentas locales (se lo preguntamos con la conexión de Insur y respondió que la cuenta no tiene permiso) y desde septiembre de 2024 tampoco acepta videos de YouTube. Por eso la subida sale de tu Chrome, con la extensión de Studio MRB: el botón **Subir a Mercado Libre** abre la publicación con tu sesión de siempre, despliega el producto, entra por **Crear video** de la medida que corresponde y carga el archivo. Cuando Mercado Libre suma el video a Tus videos queda en revisión, y la app lo marca sola como subido. Cómo instalarla está en `extension-clips/LEEME.md`. Sin la extensión, cada clip tiene **Bajar el clip**, **Abrir en Mercado Libre** y **Ya lo subí**.

Si Mercado Libre algún día habilita el permiso, Claude lo puede comprobar con `check_channel_clips`.

## En automático

En Edición de videos, por cuenta:

- **Editar solo cada video nuevo.** Al grabar un video en Registro de productos o al leer la carpeta del Drive, va a la cola sin que nadie lo pida.
- **Que Claude escriba el guión solo.** Si el producto todavía no tiene guión, lo escribe Claude al pedir la edición y se usa sin que nadie lo revise.
- **Aprobar solo el clip que salió sin avisos.** Si la edición tuvo algún aviso, espera a que alguien la mire.
- **Con qué paso del protocolo se edita cada video.** Cada protocolo es de un tipo de producto, y cada tipo tiene uno solo (se elige al crearlo, en Protocolos de fotos). El paso sale del primero de estos que haya:
  1. El que elegís al pedir la edición: un paso, **Sin protocolo**, o **Automático** para volver al que sale solo.
  2. El paso con que se grabó en Registro de productos.
  3. En un video copiado al Drive, el paso de video del protocolo del tipo de su producto. Si ese protocolo tiene más de un paso de video, el marcado como "Usar este paso para los videos copiados al Drive".

  Si el producto no tiene tipo, su tipo no tiene protocolo o ningún paso está marcado, el editor marca los momentos por lo que ve.

## Cuándo edita la Mac

Se elige en Equipo, en Editor de videos. Arranca apagado.

- **Apagado.** La Mac no edita videos. Si estaba editando uno, lo deja y vuelve a la cola.
- **Prendido.** Edita apenas hay un video en la cola.
- **Con horario.** Edita solo entre las dos horas que elijas, con la hora de la Mac. Si empezó dentro del horario, termina.

En cualquiera de los dos últimos se puede pedir que edite solo con la Mac enchufada.

Las fotos van siempre primero: la Mac pregunta por videos solo cuando no tiene fotos para corregir.

## Desde Claude

Todo lo del editor se puede hacer también hablando con Claude, conectado a la app:

- **Ver** el paso Videos, cada edición con su avance, el guión y los ajustes: `get_videos_step`. La cola de la Mac: `get_video_queue`.
- **Escribir el guión** del clip: `save_video_script`. Claude lee antes el paso Información y Preguntas y respuestas.
- **Pedir o rehacer** una edición, con o sin cortes propios: `request_video_edit`. **Aprobar o descartar** el clip: `review_video_edit`.
- **Cambiar** la voz, la música, los subtítulos y lo automático de la cuenta, y cuándo edita la Mac: `update_video_settings`. **Cargar los momentos** de un paso del protocolo: `set_video_moments`.

Claude no puede ver ni escuchar el clip: antes de aprobarlo muestra cómo se editó, lo que dice la voz y los avisos.

## Probar un video sin la app

En la Terminal, en la carpeta `trabajador-imagenes`:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4
```

Deja al lado del video una carpeta `edicion-…` con el clip, las hojas de cuadros con su segundo, lo que se midió y el plan usado. Para probar sin Claude:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --sin-claude --cuartos 1
```

Con voz, música y subtítulos:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --voz ID_DE_LA_VOZ --musica "Instrumental suave, sin voces." --subtitulos
```

Para probar cortes y velocidades a mano, editá el `plan.json` que dejó la corrida anterior y pasalo:

```bash
./probar_video.sh ~/Desktop/DJI_0073_D.MP4 --plan ~/Desktop/edicion-DJI_0073_D/plan.json
```

## Para grabar mejor

- **Fijá la exposición y el balance de blancos** en la cámara antes de grabar. Si la cámara los va cambiando sola, el editor avisa, pero no lo puede arreglar del todo.
- **Grabá en 4K.** Al girar el video a vertical sobra calidad.

## Cómo está hecho

- `trabajador-imagenes/mrb_videos/`: el editor. `plan.py` es el plan de edición, `medir.py` lo que mide el código, `inspector.py` las dos consultas a Claude (imagen y cortes), `cortes.py` las velocidades por importancia, `sonido.py` la voz, la música, la mezcla y los subtítulos, `filtros.py` y `editar.py` lo que se le pide a ffmpeg, `linea.py` la edición completa, `trabajo.py` un pedido de la app de punta a punta y `conexion.py` los mensajes con la app.
- `src/domain/video-edit.ts`: el plan, los mensajes y cuándo puede editar la Mac.
- `src/lib/video-script.ts` y `src/ai/video-script.ts`: el guión del clip y lo que se le pide a Claude para escribirlo.
- `src/lib/video-edits.ts`: la cola de edición. `src/lib/video-edit-files.ts`: los archivos en el Drive.
- `src/lib/mcp/video-tools.ts`: las herramientas de Claude.
- `src/app/api/videos/trabajador/`: por donde la Mac pregunta, avisa que sigue, baja el original y entrega.
- `trabajador-imagenes/contrato/video_*.json`: ejemplos de los mensajes, que prueban los dos lados.
