# Extensión de Chrome: clips a Mercado Libre

Carga en Mercado Libre los clips aprobados en la app, desde tu propio Chrome y con tu sesión de siempre. Mercado Libre no deja subir clips por programa a las cuentas locales, así que la extensión hace lo mismo que harías a mano: abre la publicación, entra por **Crear video** y carga el archivo.

## Instalarla, una sola vez

1. Bajá el proyecto y ubicá la carpeta `extension-clips`.
2. En Chrome, abrí `chrome://extensions`.
3. Arriba a la derecha, prendé **Modo de desarrollador**.
4. Tocá **Cargar descomprimida** y elegí la carpeta `extension-clips`.
5. Recargá la app. En **Clips por subir** tiene que decir que la extensión está instalada.

No muevas ni borres la carpeta después: Chrome la lee de ahí. Para actualizarla, reemplazá la carpeta y tocá la flecha de recargar en `chrome://extensions`.

## Usarla

1. Tené la sesión de Mercado Libre iniciada en ese Chrome.
2. Aprobá el clip en el paso Videos: se sube solo. Si quedó alguno pendiente, en **Clips por subir** tocá **Subir a Mercado Libre**.
3. Se abre una pestaña de Mercado Libre. Un cartel abajo a la derecha cuenta qué va haciendo.
4. Cuando Mercado Libre suma el video a **Tus videos**, la subida terminó: queda en revisión y la app lo marca sola como subido.

## Qué hace y qué no

- Solo actúa en la pestaña que abrió ella para subir un clip. En tus otras pestañas de Mercado Libre no hace nada.
- Solo toca el menú de la publicación, el link **Crear video** y el campo del archivo.
- No hay nada que confirmar: al cargar el archivo, Mercado Libre lo pone en revisión. Si el video no aparece en Tus videos, la extensión no lo da por subido.
- Si el listado muestra más de una publicación, si la pantalla cambió, si la sesión está cerrada o aparece un captcha, se frena y avisa. No insiste ni adivina.
- No guarda contraseñas. El clip lo toma de la app con tu sesión de la app.

Usar el sitio con una ayuda automática va por fuera del camino oficial de Mercado Libre: es una decisión de la tienda.

## Probarla sin Mercado Libre

`node extension-clips/prueba/probar.mjs` la carga en un Chrome de verdad contra una app y un Mercado Libre de mentira.
