# Trabajador de imágenes

El trabajador es el programa que corrige las fotos de producto. Corre en la Mac del estudio y pasa cada foto por 8 pasos:
1. lente
2. perspectiva
3. balance de blancos
4. luces y sombras
5. color
6. quitar fondo
7. recorte
8. exportar

En cada paso Claude mira la foto y propone los valores, y el programa los aplica.

**Regla de oro:** solo se corrige la foto original. Nada se genera, rellena ni inventa, y el original nunca se toca.

Por ahora el trabajador se prueba solo, desde la Terminal. Más adelante se conecta con la app y arranca solo al prender la Mac. Esta guía se va a completar en ese momento.

## Qué necesitás

- **Una Mac con chip Apple**, M1 o más nuevo, y macOS 14 Sonoma o más nuevo.
- **16 GB de memoria, recomendado.** Quitar el fondo usa cerca de 8 GB.
- **Unos 3 GB libres en el disco**, para Python, las librerías y el modelo que quita el fondo.
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
   - Instala Python sin tocar el de la Mac, las librerías y el modelo para quitar el fondo, que pesa cerca de 1 GB.
   - Si en algún momento dice `command not found`, cerrá la Terminal, abrila de nuevo, volvé a entrar a la carpeta y repetí.
5. **Guardar la clave de Claude:**

   ```
   bash configurar.sh
   ```

   - Pegá la clave cuando la pida. No se ve mientras la pegás, es normal.
   - Queda guardada en el Llavero de la Mac, no en un archivo.

## Probar con una foto

1. Escribí `bash probar.sh` y un espacio.
2. Arrastrá la foto a la Terminal. Puede ser JPG, PNG, HEIC del iPhone o TIFF.
3. Agregá las opciones y apretá Enter. Por ejemplo:

   ```
   bash probar.sh /Users/vos/Desktop/IMG_7346.HEIC --preguntar --producto "Subconjunto de pistones y aros Persan"
   ```

**Las opciones:**
- **`--producto`:** qué es la pieza, para que Claude tenga contexto.
- **`--preguntar`:** frena después de cada paso y muestra qué hizo, qué propuso Claude y por qué. Ahí:
  - **Enter** aprueba y sigue.
  - **`s`** saltea el paso: la foto queda como estaba.
  - **Valores para rehacer**, por ejemplo `giro=1.5` o `intensidad=80 tinte=5`, rehace el paso con esos valores. Los nombres de los valores aparecen en pantalla.
- **`--simulado`:** prueba sin Claude, con los valores que mide el programa. No gasta nada.
- **`--intermedios`:** guarda además cada paso en tamaño completo, sin pérdida. Ocupa mucho lugar.

**El resultado** queda en una carpeta al lado de la foto, con el mismo nombre y `-corregida` al final:
- **`resumen.html`:** abrilo con doble clic. Muestra el antes y el después de cada paso, lo que dijo Claude y los valores usados.
- **`final.jpg`:** fondo blanco puro, listo para Mercado Libre.
- **`final.png`:** fondo transparente.
- **`06-fondo-mascara.png`:** la silueta que usó para quitar el fondo.
- **`receta.json`:** todos los valores de cada paso, para rehacerla igual.

**Tiempos y costo:**
- Cada foto tarda alrededor de un minuto. El paso más pesado es quitar el fondo.
- Claude cuesta unos US$ 0,15 por foto. Al final se muestra el costo de esa foto.

## Si algo no anda

- **macOS pide permiso** para que la Terminal use el Escritorio o Descargas: tocá Permitir.
- **El Llavero pregunta si Python puede usar la clave** guardada en "MRB Imagenes": tocá Permitir siempre.
- **"Falta la clave de Claude":** corré de nuevo `bash configurar.sh`.
- **"Claude no respondió":** el paso sigue con los valores que midió el programa y lo avisa. Revisá la conexión a internet o la clave.
- **La Mac se pone lenta en el paso del fondo:** es el modelo trabajando. Con 8 GB de memoria puede tardar bastante más.

## Para el equipo técnico

- **El código** está en `trabajador-imagenes/`. Cada paso es una función pura en `mrb_imagenes/pasos/`:
  - mide la foto
  - propone valores
  - aplica
- **El inspector de Claude** está en `mrb_imagenes/inspector.py`.
- **Dónde vive:** el entorno de Python y el modelo quedan fuera del proyecto, en `~/Library/Application Support/MRB Imagenes/`.
- **Pruebas:** `cd trabajador-imagenes && uv run pytest`. Verifican la regla de oro en cada paso:
  - al enderezar no queda ninguna zona sin foto
  - quitar el fondo no cambia ningún color
  - el original no cambia
- **Fuera del armado de la app:** la carpeta no entra en el control de tipos ni en el estilo, y `.vercelignore` la deja fuera de Vercel.
