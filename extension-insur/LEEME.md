# Extensión de Chrome: Insur → E-commerce

Lee el stock, el costo y la ficha de cada artículo del sistema de Insur, desde tu propio Chrome y con tu sesión de siempre, y se los manda a la app para que corrija el stock y el costo de cada medida. No guarda contraseñas ni precios.

## Instalarla, una sola vez

1. Bajá el proyecto y ubicá la carpeta `extension-insur`.
2. En Chrome, abrí `chrome://extensions`.
3. Arriba a la derecha, prendé **Modo de desarrollador**.
4. Tocá **Cargar descomprimida** y elegí la carpeta `extension-insur`.
5. Fijá la extensión en la barra de Chrome, con el ícono de la pieza de rompecabezas, para tener a mano su ventana.

No muevas ni borres la carpeta después: Chrome la lee de ahí. Para actualizarla, reemplazá la carpeta y tocá la flecha de recargar en `chrome://extensions`.

## Probarla

1. Iniciá sesión en Insur (`insurmotor.com.ar`) y en la app, en ese mismo Chrome.
2. Abrí la ventana de la extensión, tildá **Solo mostrar** y tocá **Actualizar ahora**.
3. La ventana cuenta cómo va: primero el listado de Insur, después las fichas, y al final lo manda a la app. Tarda entre 7 y 20 minutos.
4. Cuando termina sale un aviso de Chrome. En la app, en **Sistema de Insur**, está el resumen de lo que cambiaría.
5. La primera vez la app está en modo prueba: ninguna corrida cambia nada hasta que alguien toca **Aplicar** en esa pantalla. Desde ahí, las corridas corrigen solas.

## Cómo trabaja

- Corre sola una vez por día, a la hora que dice la ventana (6:40 si no se cambia), y cuando tocás **Actualizar ahora**. Nunca dos a la vez.
- A Insur solo le pide datos para leer: el listado de artículos, de a 500 y con 2,5 segundos de pausa entre páginas, y la ficha de los artículos que tienen que ver con productos de la app, de a una y con 1,5 segundos de pausa.
- Las fichas se leen la primera vez que aparece cada artículo, después una vez por semana, y cuando cambia su detalle. Si no entran todas en una corrida, las que faltan quedan para la siguiente.
- Si Insur responde con un error, o tarda más de 30 segundos, espera 30 segundos y prueba una vez más. Si vuelve a fallar, corta la corrida, no manda nada a medias y avisa.
- Si la corrida pasa de 20 minutos, se corta y avisa.
- Hace falta Chrome abierto, con la sesión de Insur y la de la app iniciadas. Si falta alguna, avisa y no hace nada.

## Qué manda y qué no

- A la app le manda solo los artículos que coinciden con un producto de la app, y un listado informativo de los que tienen stock y son de una marca que la app ya tiene.
- De cada artículo manda el código, la medida, la marca, el rubro, el detalle, el stock de Córdoba, el stock de Santa Fe y el costo de reposición. El depósito Rosario no se suma.
- No manda el precio del proveedor, el precio de lista ni el precio final. Si el costo es mayor que el precio del proveedor, avisa que el costo es sospechoso, sin mandar ese precio.
- Los precios viven en la memoria mientras dura la corrida y se descartan. No se guardan en Chrome.

## Probarla sin Insur

`node extension-insur/prueba/probar.mjs` la carga en un Chrome de verdad contra una app y un Insur de mentira, con datos inventados.
