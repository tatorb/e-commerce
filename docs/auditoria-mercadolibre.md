# Auditoría de la integración con Mercado Libre

Fecha: 2026-11-09. Se comparó cada conexión de la app con Mercado Libre contra la documentación oficial, guardada en `docs/ml-docs/` (empezar por `docs/ml-docs/INDEX.md`). Todavía no se cambió código: falta que el dueño apruebe cada paquete.

Cada punto dice qué pasa, dónde está en el código y de qué archivo de `docs/ml-docs/` sale. Las líneas del código son aproximadas: verificarlas antes de cambiar.

## Prioridad alta, puede estar fallando hoy

**1. Cambiar el precio con la automatización de precios prendida.** Desde el 18 de marzo de 2026, Mercado Libre rechaza con 400 un PUT /items que cambia solo `price` si la publicación tiene la automatización de precios activa. Si `price` va con otros campos, devuelve 200 pero ignora el precio y avisa con un warning, que la app no lee. La app no consulta `GET /pricing-automation/users/$USER_ID/items` antes.
- Código: `src/channels/mercadolibre/publish.ts` (`updatePrice`, cerca de la línea 528).
- Docs: `guia-para-productos/precios-y-costos/064-api-de-precios.md`, `guia-para-productos/precios-y-costos/068-automatizaciones-de-precios.md`, `guia-para-productos/077-producto-sincroniza-modifica-publicaciones.md`.

**2. Mensajes de error que confunden el motivo.** `rejectionMessage` y `detailOf` juntan todos los `cause`, avisos incluidos (`type: warning`), y toman el primer mensaje sin mirar si es error o aviso. La lista `KNOWN` prueba `/attribute/i` antes que las reglas del título y `/closed|inactive|status/i` toma cualquier cosa con "status" como finalizada.
- Código: `src/channels/mercadolibre/publish.ts` líneas 28-60 y los usos de `detailOf`.
- Docs: `guia-para-productos/059-validaciones.md` (cada causa trae `type`: `error` bloqueante o `warning` informativa).

**3. Reintentos de escrituras que pueden duplicar.** `mlSend` reintenta POST y PUT ante 500/502/503/504 y fallas de red. Si Mercado Libre ya hizo el cambio, queda duplicado (una respuesta a un comprador, una publicación creada). Reintentar solo los GET; en escrituras, solo 429 y quizás 503.
- Código: `src/channels/mercadolibre/http.ts` (`RETRY_STATUS`, `mlSend`).
- Docs: `faqs/223-rate-limit-error-429.md`.

**4. La conexión vencida no avisa a tiempo.** Un 401 en un pedido común no marca la tienda como "hay que volver a conectar": eso solo pasa si falla la renovación de la llave. Si el vendedor cambia la contraseña o revoca el permiso, todo falla hasta 6 horas sin el aviso. Propuesta: ante un 401, forzar una renovación y reintentar una vez; si falla, marcar `NEEDS_REAUTH`.
- Código: `src/lib/connections.ts` (`withAccessToken`), `src/channels/mercadolibre/http.ts`, `src/lib/channel-sync.ts`.
- Docs: `primeros-pasos/002-autenticacion-y-autorizacion.md` (eventos que invalidan la llave antes de tiempo).

**5. Comisiones fijas.** `src/domain/pricing.ts` tiene 14,3% sin cuotas, +5% cuota promocionada, +8,5% 3 cuotas. Mercado Libre da la comisión exacta en `GET /sites/MLA/listing_prices` por precio, tipo de publicación, tag, dominio y logística, con un `fixed_fee` por unidad que la app no usa. La documentación dice 4% para la cuota promocionada (tag `pcj-co-funded`), pero las ventas reales de insur mostraron 5%: leerlo de Mercado Libre lo resuelve.
- Docs: `guia-para-productos/precios-y-costos/065-comision-por-vender.md`, `guia-para-productos/precios-y-costos/066-campana-con-cuotas-para-marketplace.md`.

## Prioridad media, funciona pero con riesgo o datos viejos

**6. Envíos en formato viejo.** `GET /shipments/{id}` y `/costs` van sin el header `x-format-new: true`. La fecha de despacho sale de `estimated_handling_limit`, deprecado desde el 13/05/2025: hay que usar `GET /shipments/{id}/sla` (y `/delays`).
- Código: `src/channels/mercadolibre/sales.ts` (lectura de envíos y `parseShipment`), `src/channels/mercadolibre/http.ts` (headers).
- Docs: `guia-para-productos/gestionar-ventas/116-envios.md`.

**7. "En revisión" que sí se puede arreglar.** Con `sub_status` `waiting_for_patch`, Mercado Libre pausa la publicación para que el vendedor la corrija, y corregirla la reactiva. La app la trata como bloqueada.
- Código: `src/channels/mercadolibre/publish.ts` (patrón `under_review`), `src/domain/channel-status.ts`.
- Docs: `recursos-de-la-api/moderaciones/031-gestionar-moderaciones.md`.

**8. Título de familia bloqueado.** El `family_name` no se puede cambiar si alguna condición de venta del User Product tiene ventas; la app mira solo las ventas de la publicación propia. Además `PUT /items/{id}/family_name` no figura en la documentación (figuran PUT /items y `PUT /user-products-families/{family_id}`): confirmar con una prueba real antes de cambiarlo.
- Código: `src/channels/mercadolibre/publish.ts` (`update`, campo `title`), `src/domain/title-lock.ts`.
- Docs: `guia-para-productos/user-products/054-user-products.md`, `guia-para-productos/user-products/055-precio-variacion.md`.

**9. Calidad con el sistema viejo.** Se usa `item.health`; Mercado Libre reemplazó /health por `/item/{id}/performance` y `/user-product/{id}/performance`.
- Código: `src/channels/mercadolibre/listings.ts` (`health`).
- Docs: `guia-para-productos/metricas-y-tendencias/149-calidad-de-publicaciones.md`.

**10. Visitas.** Se intenta `/items/visits?ids=` con 20 códigos; Mercado Libre acepta uno por pedido. Sacar el intento conjunto y leer visitas con menos frecuencia (por ejemplo una vez por día).
- Código: `src/channels/mercadolibre/listings.ts` (visitas), `src/lib/channel-sync.ts`.
- Docs: `faqs/223-rate-limit-error-429.md`, `guia-para-productos/metricas-y-tendencias/151-recurso-de-visitas.md`.

**11. Avisos perdidos.** La ruta de avisos responde 200 y procesa después; si el proceso falla, el aviso se pierde. Mercado Libre guarda 2 días los no entregados en `missed_feeds`.
- Código: `src/app/api/canales/[canal]/avisos/route.ts`.
- Docs: `recursos-de-la-api/029-productos-recibe-notificaciones.md`.

**12. Renovación de la llave dentro de la transacción.** La renovación se pide a Mercado Libre dentro de la transacción de la base. Si la llave nueva llega pero no se guarda, la vieja ya no sirve (el refresh token es de un solo uso) y hay que volver a conectar. Guardar apenas llega. También: `invalid_client` y `unauthorized_client` deberían marcar reconexión, y el motivo viene en `error_description`, no en `message`.
- Código: `src/lib/connections.ts`, `src/channels/mercadolibre/oauth.ts`.
- Docs: `primeros-pasos/002-autenticacion-y-autorizacion.md`.

**13. Búsqueda pública sin llave.** `/sites/MLA/search` se llama sin token salvo con `positionsWithAccount`. Mandar siempre la llave si la tienda está conectada.
- Código: `src/channels/mercadolibre/research.ts`, `src/lib/research.ts`.
- Docs: `recursos-de-la-api/025-items-y-busquedas.md`.

**14. Precio leído de campos que se eliminan.** `price` y `original_price` de /items se van a quitar; leer con `GET /items/{id}/prices` o `/items/{id}/sale_price?context=channel_marketplace`. Escribir sigue siendo por PUT /items.
- Código: `src/channels/mercadolibre/listings.ts` (`listPriceOf`, `discountOf`).
- Docs: `guia-para-productos/precios-y-costos/064-api-de-precios.md`.

## Lo que falta y conviene sumar

**15. Compatibilidades de autopartes por la API.** Hoy es una lista manual. `POST /items/{id}/compatibilities` (o `/user-products/{id}/compatibilities`), hasta 200 por pedido.
- Código: `src/channels/mercadolibre/apply.ts`.
- Docs: `guia-para-productos/categorizacion/051-compatibilidades-entre-items-y-productos.md`.

**16. Validar antes de crear.** `POST /items/validate` devuelve 204 si se aceptaría. Útil sobre todo al crear una familia (`createMembers`), para que no queden medidas a medias.
- Código: `src/channels/mercadolibre/publish.ts`.
- Docs: `primeros-pasos/009-validador-de-publicaciones.md`.

**17. Avisos de cambios en publicaciones.** Suscribirse a los tópicos `items` y `user_products_families` y espaciar la pasada completa de cada hora. Hoy solo se reciben preguntas, ventas, envíos y pagos.
- Código: `src/lib/channel-sync.ts`, ruta de avisos, texto de ayuda en `src/channels/mercadolibre/oauth.ts`.
- Docs: `recursos-de-la-api/029-productos-recibe-notificaciones.md`, `recursos-de-la-api/023-dominios-y-categorias.md`.

**18. Stock multi origen.** Con el tag `warehouse_management` no se acepta `available_quantity`; el stock va por `/user-products/{id}/stock/...`. No aplica hoy a insur.
- Docs: `guia-para-productos/user-products/057-stock-multi-origen.md`, `guia-para-productos/user-products/056-stock-distribuido.md`.

## Prioridad baja

19. Largos fijos (60 letras de título en `src/channels/mercadolibre/title-rules.ts`) en vez de `max_title_length`, `max_description_length`, `max_pictures_per_item` de la categoría. Docs: `guia-para-productos/053-publica-productos.md`, `recursos-de-la-api/023-dominios-y-categorias.md`.
20. POST de la descripción sin `api_version=2` (el PUT sí lo tiene). Docs: `guia-para-productos/058-descripcion-de-articulos.md`.
21. Al borrar, sin reintento ante 409 (bloqueo optimista). Docs: `guia-para-productos/077-producto-sincroniza-modifica-publicaciones.md`.
22. Tope de 30 condiciones de venta por User Product, sin control antes de `addOption`. Docs: `guia-para-productos/user-products/055-precio-variacion.md`.
23. `DISCOUNT_RANGE` acepta 80% justo; la doc pide menor a 80%. Docs: `guia-para-productos/central-de-promociones/106-descuento-individual.md`.
24. Al cambiar de cuotas, sacar el tag de campaña antes de bajar el tipo de publicación. Docs: `guia-para-productos/precios-y-costos/066-campana-con-cuotas-para-marketplace.md`.
25. Formularios de categoría bajados una vez (19/10/2026) en `src/channels/mercadolibre/catalog/categories.ts`; existe `technical_specs/input` y el predictor `domain_discovery`. Docs: `recursos-de-la-api/027-atributos.md`, `recursos-de-la-api/023-dominios-y-categorias.md`.
26. 403 sin motivo claro. Docs: `primeros-pasos/014-error-403.md`.

## Ya está como pide la documentación

- La conexión de la cuenta, con PKCE y `state`.
- La espera cuando Mercado Libre pide frenar (429 con Retry-After).
- La lectura en lote con `/items/bulk` y la búsqueda con `scroll_id`.
- La creación de familias con `family_name`.
- La creación de una forma de cobro nueva con `POST /user-products/{id}/items`.
- Las fotos.
- Las cuotas con sus tags.
- Las promociones y campañas con `app_version=v2`.
- Las ventas.
- Las preguntas, con `api_version=4` y un máximo de 2.000 letras por respuesta.

## Orden propuesto

1. Primer paquete: puntos 1, 2, 3, 4 y 7.
2. Después: 5 y 15.
3. El resto, en tandas.
