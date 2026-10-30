# Trabajador de imágenes

El trabajador es el programa que corrige las fotos de producto. Corre en la Mac del estudio y le hace a cada foto 9 ajustes, en orden:
1. Lente
2. Perspectiva y enderezado
3. Balance de blancos
4. Luces y sombras
5. Color
6. Quitar fondo
7. Recorte
8. Sombra
9. Exportar

La Mac hace los 9 de corrido y frena una sola vez, al final, para que lo apruebes. En cada ajuste Claude mira la foto y propone los valores, y el programa los aplica.

**Regla de oro:** solo se corrige la foto original. Nada se genera, rellena ni inventa, y el original nunca se toca. La única excepción es la sombra, que se agrega solo sobre el fondo y nunca toca la pieza.

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
2. Sumá fotos de tres formas:
   - **Arrastrá los originales**, tal como salen de la cámara. Pueden ser JPG, PNG, HEIC del iPhone o TIFF, de hasta 100 MB.
   - Antes de subir, la app mide cada foto. Una más chica que lo que pide el canal (en Mercado Libre, 500 px de lado) no entra, porque la edición no la agranda; entre 500 y 1200 px entra con un aviso, porque no va a tener zoom. Las HEIC las mide la Mac: si es chica, la Mac la devuelve como fallida sin pedirle nada a Claude, y la foto no se puede elegir en Organización de multimedia.
   - **Copialas desde la Mac** a la carpeta Fotos / Originales del producto en el Drive. Al abrir el paso, o con **Revisar la carpeta**, entran a la línea.
   - **Usar las fotos publicadas** baja las que ya están en Mercado Libre, en su tamaño más grande.
3. Tocá las fotos que quieras revisar. Cada una que tocás se abre abajo, una debajo de otra, y se marca con un tilde en la lista. Tocala de nuevo para cerrarla.
   - **Abrir las que esperan tu aprobación** abre de una todas las que la Mac ya terminó.
   - **Abrir todas** y **Cerrar todas** hacen lo que dicen.
   - Cada foto muestra el antes y el después, y abajo los 9 ajustes, cada uno con lo que dijo Claude y sus valores. Con varias abiertas, los ajustes arrancan plegados: tocá **Ver los 9 ajustes** en la foto que quieras cambiar.
4. Si querés cambiar algo, cambiá los valores de todos los ajustes que quieras y tocá **Rehacer con estos valores** una sola vez:
   - la Mac vuelve a hacer los 9 desde el original
   - los ajustes que cambiaste usan tus valores
   - los que no tocaste quedan como estaban, sin volver a preguntarle a Claude
   - **Aplicar**, en cada ajuste, lo prende o lo apaga. Un ajuste apagado deja la foto como estaba en ese punto. Exportar no se apaga, porque es el que arma la foto final.
5. **Para probar valores sin esperar a la Mac,** tocá **Editar en vivo**. Ver más abajo.
6. Cuando te guste, tocá **Aprobar**. La foto queda **Lista**.
7. El **JPG con fondo** y el **PNG transparente** quedan en la carpeta Fotos / Corregidas del producto en el Drive, con el nombre del original. También se bajan desde la app.

Todo se guarda en el Google Drive del estudio, en la carpeta de cada producto. Si retocás a mano una foto en Corregidas, a Mercado Libre se sube tu versión. La carpeta Trabajo de la app no hace falta tocarla.

Una foto ya aprobada también se puede rehacer. Las fotos del iPhone saltean solas el ajuste del lente, porque el teléfono ya lo corrige.

**Procesar de cero** vuelve a hacer la foto como si recién llegara: la Mac parte del original y Claude propone de nuevo los 9 ajustes. Se pierden los valores que cambiaste a mano y el giro de 90°, y Claude vuelve a cobrar. Sirve cuando Claude no respondió, por ejemplo porque la cuenta se quedó sin saldo: rehacer con valores usa los mismos números que midió el programa y no le vuelve a preguntar. Si hay fotos así, arriba de la lista aparece un aviso con un botón para procesarlas todas de cero.

También sirve cuando Claude corrigió mal: al confirmar podés escribir una **indicación para Claude, solo para esta vez**, por ejemplo "los cuadrados de la caja son parte del dibujo, no los borres". Va solo en esa corrida de esa foto, por encima de las indicaciones del protocolo, y la foto la muestra arriba. Si la corrida falla y tocás Reintentar, o la rehacés con valores, la indicación sigue.

**Indicaciones para el editor.** En Ajustes → Protocolos de fotos, cada paso de foto tiene un campo para lo que Claude tiene que tener en cuenta al corregir las fotos de ese paso. Claude recibe el título del paso y esas indicaciones en cada foto que se sacó con él, también al procesarla de cero, y las sigue por encima de lo que sugiere el programa, dentro de los límites de cada ajuste. Se leen al procesar: si las cambiás, van las nuevas en la próxima foto. Las fotos que no salieron de un protocolo, como las subidas a mano o las del canal, no tienen.

### Fotos que ya vienen editadas

Si una foto ya la trajiste editada, usala **tal cual**: la Mac no la procesa, Claude no la mira y no se le cambia nada.
- **Al subirla:** marcá **Ya vienen editadas: usarlas tal cual** antes de arrastrarla.
- **Si ya estaba en la línea:** abrila y tocá **Usar el original tal cual**. Si la Mac la estaba corrigiendo, se corta.
- La foto queda como **Original, sin editar** y aparece en Organización de multimedia junto a las corregidas. A Mercado Libre va el mismo archivo que subiste.
- **Corregirla en la Mac** la vuelve a la línea. Si ya tenía una corrección aprobada, vale esa.
- Mercado Libre la acepta tal cual solo en **JPG o PNG, hasta 10 MB**. Una HEIC o TIFF hay que exportarla como JPG desde la Mac. Si pesa más, la app avisa y no la achica.

### La sombra

Con el fondo quitado, la pieza queda flotando sobre blanco. El ajuste **Sombra** le devuelve una sombra suave, copiada de la que tenía la foto:
- La Mac mide la sombra real alrededor de la pieza: hacia dónde cae, hasta dónde llega, qué tan blanda es y qué tan oscura.
- Claude la mira con el fondo original y propone los valores.
- El programa dibuja un degradado sutil con la forma de la pieza: más denso del lado donde cae y desvaneciéndose. No es la silueta copiada y corrida de un programa de diseño.

Los valores son **Intensidad**, **Dirección** (0 hacia abajo, 90 a la derecha, -90 a la izquierda, 180 hacia arriba), **Distancia** y **Suavidad**. Se pueden mover en vivo.
- **Aplicar**, en la tarjeta Sombra, la saca de esa foto.
- El JPG la lleva sobre el fondo. El PNG transparente también, como transparencia gris; para sacarla solo del PNG, apagá **Sombra en el PNG** en Exportar.
- En **Ajustes, Imágenes** elegís si las fotos nuevas arrancan con sombra o sin ella, y el tope de intensidad.
- Algunas guías de Mercado Libre piden la foto principal sin sombras. Por eso arranca sutil y se puede apagar en cada foto.

### Editar en vivo

Con **Editar en vivo**, la foto queda arriba y cada valor de lente, perspectiva, blancos, luces, color y sombra tiene una barra. Al moverla, la foto cambia al instante, sin esperar a la Mac.
- **Lo de la Mac**, arriba de la foto, muestra lo que hizo la Mac para comparar.
- **Girar a la izquierda y Girar a la derecha**, arriba a la derecha de la foto, la giran de a 90°. Sirven para una foto que llegó acostada o de cabeza. También están en Perspectiva y enderezado. El giro de 90° lo decide solo una persona: Claude no lo propone. La Mac lo hace antes del enderezado fino y es exacto, solo reacomoda los píxeles, sin perder calidad ni recortar. Si apagás Perspectiva y enderezado, la foto vuelve a su posición.
- **Quitar fondo, Recorte y Exportar** no se ven en vivo: se usa la silueta que hizo la Mac. Si cambiás el giro o la lente, la silueta se acomoda sola.

**Recuperar partes**, en Quitar fondo: el modelo que quita el fondo está hecho para recortar también rejas y mallas, y una caja con cuadrícula blanca le parece una malla: toma los cuadrados de color por agujeros y los borra. Con Recuperar partes prendido, que es lo que viene, lo que el modelo dejó transparente dentro de la pieza vuelve a quedar opaco si no se parece al fondo que tiene cerca. Lo que sí es fondo, como el centro de un aro, o una sombra sobre la caja de luz, queda transparente. Solo cambia la transparencia, nunca los colores. Si alguna vez deja pieza donde hay fondo, apagalo y rehacé.
- **Volver a lo de la Mac** deja los valores como estaban.
- **Aplicar en la Mac** le pide a la Mac la foto final con esos valores. No le vuelve a preguntar a Claude, así que no tiene costo.
- Es una vista previa en tamaño de pantalla: la foto final siempre la hace la Mac. Lo que ves en vivo y lo que hace la Mac se ven prácticamente iguales.
- Funciona con las fotos que la Mac hizo después de actualizar el trabajador. En las anteriores, la app dice que hay que rehacerlas. Lo mismo con girar 90°: sale en las fotos que hizo un trabajador actualizado.

## Actualizar el trabajador

Cuando la app avisa que el trabajador está desactualizado, o para estrenar algo nuevo, como editar en vivo o girar 90°:
1. Bajá el proyecto de nuevo, igual que en el paso 1 de la instalación. Reemplazá la carpeta vieja de Descargas.
2. En la Terminal, entrá a la carpeta `trabajador-imagenes` nueva, igual que en el paso 3.
3. Escribí `bash instalar.sh` y Enter.

No hace falta crear otra llave ni volver a cargar las claves: quedan en el Llavero. Al terminar, el trabajador se reinicia solo con lo nuevo. Mientras no lo actualices, el anterior sigue andando, sin lo nuevo. Las indicaciones para el editor le llegan igual a un trabajador anterior, junto a lo que es la pieza; Recuperar partes necesita el trabajador actualizado.

## Prender, apagar y revisar

Siempre desde la Terminal, dentro de la carpeta `trabajador-imagenes`:
- **Ver si está corriendo y qué hizo último:** `bash estado.sh`
- **Apagarlo:** `bash apagar.sh`. Deja de arrancar solo. Lo que tenía a medias vuelve a la cola de la app.
- **Prenderlo de nuevo:** `bash prender.sh`

Lo que hace queda anotado en un registro. Para abrirlo:
- En el Finder, menú **Ir**, **Ir a la carpeta**, y pegá `~/Library/Logs/MRB Imagenes`.
- Abrí `trabajador.log` con doble clic.

Mientras procesa una foto, el trabajador le pide a la Mac que no se duerma. Si la Mac se apaga a mitad de una foto, a los 15 minutos esa foto vuelve a la cola y la retoma al prenderse.

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
- **`--preguntar`:** frena después de cada ajuste y muestra qué hizo, qué propuso Claude y por qué. Ahí:
  - **Enter** aprueba y sigue.
  - **`s`** saltea el ajuste: la foto queda como estaba.
  - **Valores para rehacer**, por ejemplo `giro=1.5` o `intensidad=80 tinte=5`, rehace el ajuste con esos valores. Los nombres de los valores aparecen en pantalla.
- **`--simulado`:** prueba sin Claude, con los valores que mide el programa. No gasta nada.
- **`--intermedios`:** guarda además cada ajuste en tamaño completo, sin pérdida. Ocupa mucho lugar.
- **`--modelo liviano`** o **`--modelo completo`:** fuerza uno de los dos modelos para quitar el fondo. En una Mac de 8 GB, el completo la deja casi sin memoria.

**El resultado** queda en una carpeta al lado de la foto, con el mismo nombre y `-corregida` al final:
- **`resumen.html`:** abrilo con doble clic. Muestra el antes y el después de cada ajuste, lo que dijo Claude y los valores usados.
- **`final.jpg`:** fondo blanco puro, listo para Mercado Libre.
- **`final.png`:** fondo transparente.
- **`06-fondo-mascara.png`:** la silueta que usó para quitar el fondo.
- **`receta.json`:** todos los valores de cada ajuste, para rehacerla igual.

**Tiempos y costo:**
- En una Mac de 8 GB, cada foto tarda alrededor de un minuto y medio con los 9 ajustes. El más pesado es quitar el fondo.
- Claude cuesta unos US$ 0,13 por foto. Al final se muestra el costo de esa foto.
- Rehacer con valores que pediste cuesta menos, porque Claude solo mira los ajustes que no tienen valores pedidos.

## Si algo no anda

- **macOS pide permiso** para que la Terminal use el Escritorio o Descargas: tocá Permitir.
- **El Llavero pregunta si Python puede usar la clave** guardada en "MRB Imagenes": tocá Permitir siempre.
- **"Falta la clave de Claude":** corré de nuevo `bash configurar.sh`.
- **"Claude no respondió":** el ajuste sigue con los valores que midió el programa y lo avisa, con el motivo y lo que dijo Claude. Cuando esté resuelto, tocá **Procesar de cero** para que Claude mire la foto. Los motivos más comunes:
  - **"La cuenta de Claude no tiene saldo":** cargalo en [console.anthropic.com](https://console.anthropic.com), en Billing.
  - **"Llegó a su límite de gasto":** subilo en console.anthropic.com, en Limits.
  - **"La clave de Claude no vale":** corré de nuevo `bash configurar.sh` con una clave nueva.
  - **"No se pudo conectar con Claude":** revisá la conexión a internet de la Mac.
  - **"Claude rechazó el pedido":** pasale el aviso completo al equipo técnico. El registro de la Mac también lo guarda, con el número de pedido.
- **"permission denied" con el nombre de la foto:** la foto quedó sola en una línea. Volvé a escribir todo junto, empezando por `bash probar.sh`.
- **"Falta la foto":** se apretó Enter antes de arrastrar la foto. Escribí todo en una sola línea.
- **La Mac se pone lenta en el ajuste del fondo:** es el modelo trabajando. Si forzaste `--modelo completo` en una Mac de 8 GB, volvé al liviano.
- **La app dice "Desconectado":**
  - Corré `bash estado.sh`. Si dice que está apagado, corré `bash prender.sh`.
  - Si está prendido, mirá las últimas líneas que muestra.
  - **"La llave del trabajador no vale":** creá una llave nueva en Equipo y cargala con `bash configurar.sh`.
  - **"Está desactualizado":** bajá el proyecto de nuevo y corré `bash instalar.sh`.
  - **"No se pudo conectar":** revisá la conexión a internet de la Mac.
  - **"El Drive del estudio no está conectado":** conectalo en Equipo, en la tarjeta Google Drive del estudio.
- **Una foto dice "falló":** la app muestra el motivo. Podés tocar **Reintentar**.

## Para el equipo técnico

- **El código** está en `trabajador-imagenes/`. Cada ajuste es una función pura en `mrb_imagenes/pasos/`:
  - mide la foto
  - propone valores
  - aplica
- **El inspector de Claude** está en `mrb_imagenes/inspector.py`.
- **Los archivos:** el trabajador baja el original a través de la app y sube lo que hace directo al Drive del estudio, con una subida que sirve para un solo archivo. No tiene la llave del Drive.
- **La conexión con la app** está en `mrb_imagenes/app.py`, y lo que pide la app se hace en `mrb_imagenes/trabajo.py`, ajuste por ajuste. La app hoy pide los 9 en un solo paso, pero el trabajador también sabe hacerlos repartidos en varios pasos. El programa que corre siempre es `principal.py`.
- **La prueba en la Terminal**, `probar.sh`, sigue mostrando los 9 ajustes uno por uno.
- **Los mensajes con la app** tienen ejemplos en `contrato/`, que prueban los dos lados.
- **Editar en vivo:** con cada foto, `mrb_imagenes/vivo.py` sube un paquete con la foto preparada en tamaño de pantalla, una copia por cada combinación de correcciones de lente y la silueta. La app repite en el navegador las cuentas de lente, perspectiva, blancos, luces, color y sombra (`src/domain/photo-live.ts`). `tests/armar_referencia_vivo.py` saca números de referencia de las cuentas de la Mac, que la app compara con las suyas; si se cambia una cuenta, hay que volver a correrlo.
- **La sombra** está en `mrb_imagenes/pasos/sombra.py`. Se dibuja sobre una copia de la silueta de a lo sumo 512 px, porque es borrosa, y se guarda en la foto aparte de la transparencia: Exportar la pone en el JPG y, si se pide, en el PNG. Desde el protocolo 4; a un trabajador anterior la app no se la pide.
- **Las indicaciones para Claude** llegan en el trabajo como `foto_del_protocolo` (título del paso y sus indicaciones) e `indicacion` (la puntual de la corrida), desde el protocolo 6. `contexto_de` en `mrb_imagenes/trabajo.py` arma un `Contexto` (`mrb_imagenes/inspector.py`) que va al principio del pedido de cada ajuste. A un trabajador anterior la app se las manda dentro de `producto`.
- **Recuperar partes** es `recuperar_partes` en `mrb_imagenes/pasos/fondo.py`: en chico arma la silueta de la pieza (entrantes de hasta el 5 % cerrados y agujeros tapados) y el color del fondo de referencia más cercano, tomado a un 2 % de la pieza; en grande vuelve opaca cada zona de la silueta que el modelo dejó transparente y en su mayor parte se aleja del fondo más de 25 en Lab, con la luz a la mitad. Completa los entrantes abiertos del borde hasta el contorno solo con lo que es de otro color, y cierra las líneas finas entre zonas recuperadas. Claude ve el recorte ya con las partes recuperadas.
- **Girar 90°** es el valor `cuartos` de Perspectiva, en `mrb_imagenes/pasos/perspectiva.py`: los cuartos de vuelta en sentido horario, de 0 a 3, antes del giro fino. Es el primer valor marcado `persona`: Claude no lo ve ni lo propone, y queda en 0 si nadie lo cambia. Desde el protocolo 5; un trabajador anterior no lo muestra en sus fotos.
- **La claridad** mide cada zona de la foto en tamaño de pantalla, 1200 px, y aplica la curva a la foto entera. Así da lo mismo en la Mac y en la vista en vivo.
- **El arranque automático** es un servicio de usuario de macOS, `com.studiomrb.imagenes`, que arma `prender.sh` en `~/Library/LaunchAgents/`.
- **Dónde vive:** el entorno de Python, el modelo, la dirección de la app y las fotos de trabajo quedan fuera del proyecto, en `~/Library/Application Support/MRB Imagenes/`. Las fotos de trabajo se borran solas a los 7 días sin uso; si faltan, se rearman desde el original.
- **Pruebas:** `cd trabajador-imagenes && uv run pytest`. Verifican la regla de oro en cada ajuste:
  - al enderezar no queda ninguna zona sin foto
  - quitar el fondo no cambia ningún color
  - el original no cambia
- **Fuera del armado de la app:** la carpeta no entra en el control de tipos ni en el estilo, y `.vercelignore` la deja fuera de Vercel.
