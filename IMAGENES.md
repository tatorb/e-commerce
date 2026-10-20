# Trabajador de imágenes

El trabajador es el programa que corrige las fotos de producto. Corre en la Mac del estudio y pasa cada foto por 2 pasos, cada uno con varios ajustes:
1. **Corregir la foto:** lente, perspectiva, balance de blancos, luces y sombras, y color.
2. **Recortar y exportar:** quitar fondo, recorte y exportar.

La Mac hace los ajustes de un paso de corrido y frena para que lo apruebes. En cada ajuste Claude mira la foto y propone los valores, y el programa los aplica.

**Regla de oro:** solo se corrige la foto original. Nada se genera, rellena ni inventa, y el original nunca se toca.

El trabajador se conecta con la app y arranca solo cada vez que iniciás sesión en la Mac. Él le pregunta a la app si hay algo para hacer, así que en la Mac no hay que abrir nada.

## Qué necesitás

- **Una Mac con chip Apple**, M1 o más nuevo, y macOS 14 Sonoma o más nuevo.
- **Memoria:** anda con 8 GB.
  - Para quitar el fondo hay dos modelos, y el trabajador elige solo según la memoria de la Mac.
  - **Con 8 GB usa el liviano:** necesita poco más de 1 GB y tarda unos segundos.
  - **Con 16 GB o más usa el completo,** que separa un poco mejor los detalles finos pero necesita cerca de 8 GB.
- **Unos 2 GB libres en el disco**, para Python, las librerías y el modelo.
- **Una clave de Claude**, que se crea en [console.anthropic.com](https://console.anthropic.com), en API Keys.
  - Conviene crear una propia para el trabajador, por ejemplo con el nombre "Trabajador de imágenes".
  - Así su gasto se ve por separado.

## Instalar (una sola vez)

1. **Bajar el proyecto.**
   - Entrá a [github.com/tatorb/e-commerce](https://github.com/tatorb/e-commerce/tree/claude/brave-goodall-uprrfs).
   - Tocá el botón verde **Code** y después **Download ZIP**.
   - Abrí el ZIP con doble clic. Queda una carpeta en Descargas.
2. **Abrir la Terminal:** Cmd + Espacio, escribí `Terminal` y Enter.
3. **Entrar a la carpeta del trabajador.**
   - Escribí `cd` y un espacio.
   - Arrastrá la carpeta `trabajador-imagenes`, que está adentro de la que bajaste, hasta la ventana de la Terminal, y apretá Enter.
4. **Instalar.** Escribí esto y Enter:

   ```
   bash instalar.sh
   ```

   - Tarda unos minutos.
   - Instala Python sin tocar el de la Mac, las librerías y el modelo para quitar el fondo.
   - Al final deja el trabajador prendido, para que arranque solo cada vez que iniciás sesión. Para eso guarda una copia del programa en su propia carpeta. La de Descargas dejala: desde ahí se corren los comandos de esta guía.
   - Si en algún momento dice `command not found`, cerrá la Terminal, abrila de nuevo, volvé a entrar a la carpeta y repetí.
5. **Crear la llave en la app.**
   - En la app, entrá a **Equipo** y buscá **Trabajador de imágenes**.
   - Tocá **Crear llave** y después **Copiar**. La llave se muestra una sola vez.
6. **Configurar.** En la Terminal, escribí esto y Enter:

   ```
   bash configurar.sh
   ```

   Te pide tres cosas:
   - **La dirección de la app.** Apretá Enter para dejar la que propone.
   - **La llave del trabajador**, la que copiaste en el paso 5. Pegala con Cmd + V. No se ve mientras la pegás, es normal.
   - **La clave de Claude.** Pegala igual. Si ya la habías cargado, con Enter queda la misma.

   Las dos claves quedan en el Llavero de la Mac, no en un archivo. Al terminar, el trabajador se reinicia solo con lo nuevo.
7. **Comprobar.** En la app, en Equipo, el trabajador tiene que decir **Conectado** en menos de un minuto.

## Usarlo desde la app

1. Abrí una publicación en el paso **Imágenes** del pipeline.
2. Sumá fotos de dos formas:
   - **Arrastrá los originales**, tal como salen de la cámara. Pueden ser JPG, PNG, HEIC del iPhone o TIFF, de hasta 100 MB.
   - **Usar las fotos publicadas** baja las que ya están en Mercado Libre, en su tamaño más grande.
3. Tocá una foto para ver su línea, con los 2 pasos arriba.
4. En cada paso ves el antes y el después, y abajo cada ajuste con lo que dijo Claude y sus valores. Ahí:
   - **Aprobar** pasa al paso siguiente, que arranca solo.
   - **Rehacer con estos valores** vuelve a hacer el paso con los valores que cambiaste. Los ajustes que no tocaste quedan como estaban, sin volver a preguntarle a Claude.
   - **Aplicar**, en cada ajuste, lo prende o lo apaga. Un ajuste apagado deja la foto como estaba en ese punto.
5. En el paso 2 se bajan el **JPG con fondo** y el **PNG transparente**.

El paso 1 ya aprobado también se puede rehacer: el paso 2 se vuelve a hacer. Las fotos del iPhone saltean solas el ajuste del lente, porque el teléfono ya lo corrige.

## Prender, apagar y revisar

Siempre desde la Terminal, dentro de la carpeta `trabajador-imagenes`:
- **Ver si está corriendo y qué hizo último:** `bash estado.sh`
- **Apagarlo:** `bash apagar.sh`. Deja de arrancar solo. Lo que tenía a medias vuelve a la cola de la app.
- **Prenderlo de nuevo:** `bash prender.sh`

Lo que hace queda anotado en un registro. Para abrirlo:
- En el Finder, menú **Ir**, **Ir a la carpeta**, y pegá `~/Library/Logs/MRB Imagenes`.
- Abrí `trabajador.log` con doble clic.

Mientras procesa una foto, el trabajador le pide a la Mac que no se duerma. Si la Mac se apaga a mitad de un paso, a los 15 minutos ese paso vuelve a la cola y lo retoma al prenderse.

## Probar con una foto

Todo va **en una sola línea**, y recién al final se aprieta Enter:
1. Escribí `bash probar.sh` y un espacio. **No apretes Enter todavía.**
2. Arrastrá la foto a la Terminal. Aparece su ruta en la misma línea. Puede ser JPG, PNG, HEIC del iPhone o TIFF.
3. Escribí un espacio y las opciones, y recién ahí apretá Enter. Queda así:

   ```
   bash probar.sh /Users/vos/Downloads/IMG_7356.HEIC --preguntar --producto "Subconjunto de pistones y aros Persan"
   ```

**Las opciones:**
- **`--producto`:** qué es la pieza, para que Claude tenga contexto.
- **`--preguntar`:** frena después de cada paso y muestra qué hizo, qué propuso Claude y por qué. Ahí:
  - **Enter** aprueba y sigue.
  - **`s`** saltea el paso: la foto queda como estaba.
  - **Valores para rehacer**, por ejemplo `giro=1.5` o `intensidad=80 tinte=5`, rehace el paso con esos valores. Los nombres de los valores aparecen en pantalla.
- **`--simulado`:** prueba sin Claude, con los valores que mide el programa. No gasta nada.
- **`--intermedios`:** guarda además cada paso en tamaño completo, sin pérdida. Ocupa mucho lugar.
- **`--modelo liviano`** o **`--modelo completo`:** fuerza uno de los dos modelos para quitar el fondo. En una Mac de 8 GB, el completo la deja casi sin memoria.

**El resultado** queda en una carpeta al lado de la foto, con el mismo nombre y `-corregida` al final:
- **`resumen.html`:** abrilo con doble clic. Muestra el antes y el después de cada paso, lo que dijo Claude y los valores usados.
- **`final.jpg`:** fondo blanco puro, listo para Mercado Libre.
- **`final.png`:** fondo transparente.
- **`06-fondo-mascara.png`:** la silueta que usó para quitar el fondo.
- **`receta.json`:** todos los valores de cada paso, para rehacerla igual.

**Tiempos y costo:**
- Cada foto tarda menos de un minuto con el modelo liviano. El paso más pesado es quitar el fondo.
- Claude cuesta unos US$ 0,15 por foto. Al final se muestra el costo de esa foto.

## Si algo no anda

- **macOS pide permiso** para que la Terminal use el Escritorio o Descargas: tocá Permitir.
- **El Llavero pregunta si Python puede usar la clave** guardada en "MRB Imagenes": tocá Permitir siempre.
- **"Falta la clave de Claude":** corré de nuevo `bash configurar.sh`.
- **"Claude no respondió":** el paso sigue con los valores que midió el programa y lo avisa. Revisá la conexión a internet o la clave.
- **"permission denied" con el nombre de la foto:** la foto quedó sola en una línea. Volvé a escribir todo junto, empezando por `bash probar.sh`.
- **"Falta la foto":** se apretó Enter antes de arrastrar la foto. Escribí todo en una sola línea.
- **La Mac se pone lenta en el paso del fondo:** es el modelo trabajando. Si forzaste `--modelo completo` en una Mac de 8 GB, volvé al liviano.
- **La app dice "Desconectado":**
  - Corré `bash estado.sh`. Si dice que está apagado, corré `bash prender.sh`.
  - Si está prendido, mirá las últimas líneas que muestra.
  - **"La llave del trabajador no vale":** creá una llave nueva en Equipo y cargala con `bash configurar.sh`.
  - **"Está desactualizado":** bajá el proyecto de nuevo y corré `bash instalar.sh`.
  - **"No se pudo conectar":** revisá la conexión a internet de la Mac.
- **Un paso dice "falló":** la app muestra el motivo. Podés tocar **Reintentar**. Si falló el paso 1, también podés saltearlo y seguir con la foto como estaba.

## Para el equipo técnico

- **El código** está en `trabajador-imagenes/`. Cada paso es una función pura en `mrb_imagenes/pasos/`:
  - mide la foto
  - propone valores
  - aplica
- **El inspector de Claude** está en `mrb_imagenes/inspector.py`.
- **La conexión con la app** está en `mrb_imagenes/app.py`, y cada paso pedido se hace en `mrb_imagenes/trabajo.py`, ajuste por ajuste. El programa que corre siempre es `principal.py`.
- **La prueba en la Terminal**, `probar.sh`, sigue mostrando los 8 ajustes uno por uno.
- **Los mensajes con la app** tienen ejemplos en `contrato/`, que prueban los dos lados.
- **El arranque automático** es un servicio de usuario de macOS, `com.studiomrb.imagenes`, que arma `prender.sh` en `~/Library/LaunchAgents/`.
- **Dónde vive:** el entorno de Python, el modelo, la dirección de la app y las fotos de trabajo quedan fuera del proyecto, en `~/Library/Application Support/MRB Imagenes/`. Las fotos de trabajo se borran solas a los 7 días sin uso; si faltan, se rearman desde el original.
- **Pruebas:** `cd trabajador-imagenes && uv run pytest`. Verifican la regla de oro en cada paso:
  - al enderezar no queda ninguna zona sin foto
  - quitar el fondo no cambia ningún color
  - el original no cambia
- **Fuera del armado de la app:** la carpeta no entra en el control de tipos ni en el estilo, y `.vercelignore` la deja fuera de Vercel.
