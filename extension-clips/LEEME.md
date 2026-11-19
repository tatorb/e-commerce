# Extensión de Chrome: clips a Mercado Libre

Carga en Mercado Libre los clips aprobados en la app, desde tu propio Chrome y con tu sesión de siempre. Mercado Libre no deja subir clips por programa a las cuentas locales, así que la extensión hace lo mismo que harías a mano: abre la publicación, entra por **Crear video** y carga el archivo.

## Instalarla, una sola vez

1. Bajá el proyecto y ubicá la carpeta `extension-clips`.
2. En Chrome, abrí `chrome://extensions`.
3. Arriba a la derecha, prendé **Modo de desarrollador**.
4. Tocá **Cargar descomprimida** y elegí la carpeta `extension-clips`.
5. Recargá la app. En el Pipeline, pestaña **Por subir**, sección **Clips**, tiene que decir que la extensión está instalada.

No muevas ni borres la carpeta después: Chrome la lee de ahí. Para actualizarla, reemplazá la carpeta y tocá la flecha de recargar en `chrome://extensions`.

## Usarla

1. Tené la sesión de Mercado Libre iniciada en ese Chrome.
2. En el Pipeline, pestaña **Por subir**, o en el paso **Publicación**, tocá **Subir a Mercado Libre** en el clip.
3. Se abre una pestaña de Mercado Libre. Si el producto tiene varias medidas, las despliega y entra por la de la publicación. Si tiene varias opciones de venta, entra por la de la publicación, o por otra del mismo producto si la suya no está a la vista: el video es del producto y se ve en todas. Un cartel abajo a la derecha cuenta qué va haciendo.
4. Cuando Mercado Libre suma el video a **Tus videos**, la subida terminó: queda en revisión y la app lo marca sola como subido.

## La cola de subida

Para subir en lote, sin tocar cada clip:

1. En el Pipeline, pestaña **Por subir**, sección **Clips**, prendé **Subir sola la cola**. Queda prendido en ese Chrome.
2. Poné clips en la cola: con **Poner todos en la cola**, con **Poner en la cola** de cada uno, o pidiéndoselo a Claude (`queue_clip_uploads`).
3. La extensión le pregunta a la app cada minuto si hay algo en la cola. Sube de a un clip, en una ventana aparte que no te saca el foco, y espera unos dos minutos entre uno y otro.
4. El que se sube sale de la lista. El que falla sale de la cola con su motivo, a la vista en la lista, y la ventana queda abierta para que mires qué pasó.

Hace falta dejar Chrome abierto, con la sesión de la app y la de Mercado Libre iniciadas. Con la cola apagada, nada se sube solo.

## Qué hace y qué no

- Solo actúa en la pestaña que abrió ella para subir un clip. En tus otras pestañas de Mercado Libre no hace nada.
- Solo toca el menú de la publicación, el link **Crear video** y el campo del archivo.
- No hay nada que confirmar: al cargar el archivo, Mercado Libre lo pone en revisión. Si el video no aparece en Tus videos, la extensión no lo da por subido.
- Si el listado muestra más de una publicación, si la pantalla cambió, si la sesión está cerrada o aparece un captcha, se frena y avisa. No insiste ni adivina.
- No guarda contraseñas. El clip lo toma de la app con tu sesión de la app.

Usar el sitio con una ayuda automática va por fuera del camino oficial de Mercado Libre: es una decisión de la tienda.

## Probarla sin Mercado Libre

`node extension-clips/prueba/probar.mjs` la carga en un Chrome de verdad contra una app y un Mercado Libre de mentira.
