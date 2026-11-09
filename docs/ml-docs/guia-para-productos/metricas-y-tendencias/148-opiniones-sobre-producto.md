<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/opiniones-sobre-producto -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Opiniones de productos

Última actualización 18/09/2026

## Evaluaciones de un ítem

### Objetivo

Consulta las evaluaciones de compradores para un ítem publicado en Mercado Libre. La respuesta incluye el promedio de estrellas, la distribución por calificación, textos, contenidos multimedia (fotos y videos) y atributos evaluados.

Usa este endpoint para mostrar la reputación de un producto en tu integración y ayudar a los compradores a tomar decisiones antes de completar una compra.

### Flujo funcional

Para consultar las evaluaciones, necesitas un `ITEM_ID` válido. Puedes obtenerlo previamente mediante la API de ítems o de publicaciones del vendedor.

```
[Aplicación del integrador]
        |
        | 1. GET /items/$ITEM_ID (o ya dispone del item_id)
        v
[API de ítems - api.mercadolibre.com]
        |
        | devuelve item_id (por ejemplo, MLB4330911507)
        v
[Aplicación del integrador]
        |
        | 2. GET /reviews/item/$ITEM_ID
        v
[API de evaluaciones - api.mercadolibre.com]
        |
        | devuelve paging, reviews[], rating_average, stars y rating_levels
        v
[Aplicación del integrador]
```

Disponibilidad de evaluaciones

El ítem debe estar activo y publicado. Los ítems pausados o eliminados pueden devolver una lista vacía o un error `404`.

### Llamada

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/reviews/item/$ITEM_ID'
```

### Parámetros de query opcionales

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| `offset` | integer | Posición inicial de la página. El valor predeterminado es `0`. |
| `limit` | integer | Cantidad de evaluaciones por página. El valor predeterminado es `5`. |
| `catalog_product_id` | string | Filtra las evaluaciones de un producto de catálogo específico. Consulta Evaluaciones de ítems de catálogo. |

### Ejemplo

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/reviews/item/MLB4330911507'
```

### Respuesta

```
{
  "paging": { "total": 7651, "limit": 5, "offset": 0, "kvs_total": 7651, "reviews_with_comment": 4491, "total_pageable": 4600 },
  "rating_average": 4.9,
  "stars": 5.0,
  "cross_site_enabled": false,
  "rating_levels": { "one_star": 19, "two_star": 13, "three_star": 58, "four_star": 356, "five_star": 7205 },
  "reviews": [{
    "id": 2945898123,
    "reviewable_object": { "id": "MLB4330911507", "type": "item" },
    "date_created": "2026-06-09T03:40:00Z",
    "status": "published",
    "title": "Excelente",
    "content": "Material: excelente, resistente...",
    "rate": 5, "likes": 130, "dislikes": 0, "reviewer_id": 0,
    "buying_date": "2026-05-18T09:24:43Z", "condition": "new",
    "catalog_listing": false, "coupon_redeemed": false, "earned_rewards": 0, "has_pdd": false,
    "attributes": null,
    "attributes_variation": [{ "attribute_id": "COLOR", "attribute_name": "Color", "value_name": "Negro" }],
    "media": [
      { "id": "6a278af2d3c09cbdd62c08e4", "status": "published", "type": "video", "alt": "melifile5446060712272861376.mp4", "url": "https://video-static-clips.mms.mlstatic.com/.../master.m3u8", "thumbnail": "https://http2.mlstatic.com/...-B.jpg", "preview_url": "https://video-static-clips.mms.mlstatic.com/.../preview.mp4", "duration_ms": 39040, "variations": [] },
      { "id": "603127-MLA112957769959_062026", "status": "published", "type": "photo", "alt": "melifile1872356235417763317.jpg", "variations": [{ "size": "800x800", "url": "https://http2.mlstatic.com/...-B.jpg" }] }
    ],
    "reactions": null,
    "translations": { "es": "Material: excelente, resistente..." }
  }],
  "helpful_reviews": { "best_max_stars": null, "best_min_stars": null },
  "quali_attributes": []
}
```

### Campos de la respuesta

### `paging`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `total` | integer | Total de evaluaciones existentes para el ítem. |
| `limit` | integer | Cantidad máxima de evaluaciones devueltas por página. |
| `offset` | integer | Posición inicial de la página actual. |
| `kvs_total` | integer | Equivale a `total` y se mantiene por compatibilidad histórica. |
| `reviews_with_comment` | integer | **Obsoleto.**  Cantidad de evaluaciones con comentario. Usa `total_pageable` para paginar; este campo se eliminará en una versión futura. |
| `total_pageable` | integer | Total máximo de evaluaciones accesibles mediante paginación. |

### `reviews[]`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | integer | Identificador único de la evaluación. |
| `reviewable_object.id` | string | ID del ítem evaluado. |
| `reviewable_object.type` | string | `item` para publicaciones regulares o `product` para publicaciones de catálogo. |
| `date_created` | string (ISO 8601) | Fecha y hora de creación de la evaluación. |
| `status` | string | Estado: `published`, `pending` o `blocked`. |
| `title` | string | Título escrito por el comprador. |
| `content` | string | Texto completo de la evaluación. |
| `rate` | integer | Calificación por estrellas, de `1` a `5`. |
| `likes` / `dislikes` | integer | Cantidad de usuarios que consideraron útil o no útil la evaluación. |
| `reviewer_id` | integer | Siempre devuelve `0`; el dato está ofuscado por privacidad. |
| `buying_date` | string (ISO 8601) | Fecha de la compra que originó la evaluación. |
| `condition` | string | Condición del producto: `new` o `used`. |
| `catalog_listing`, `coupon_redeemed`, `has_pdd` | boolean | Indican, respectivamente, si la publicación es de catálogo, si se usó un cupón y si el pedido tenía fecha de entrega prometida. |
| `earned_rewards` | integer | Puntos de recompensa obtenidos en la transacción. |
| `attributes` | object \| null | Atributos evaluados por el comprador. Devuelve `null` cuando no hay atributos evaluados. |
| `attributes_variation` | array | Variación comprada; contiene `attribute_id`, `attribute_name` y `value_name`. |
| `media` | array | Fotos y videos enviados por el comprador. Consulta `media[]`. |
| `reactions` | object \| null | Reacciones de la evaluación. Devuelve `null` cuando no existen. |
| `translations` | object | Traducciones automáticas. La clave representa el idioma, por ejemplo `es`. |

### `media[]`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | string | Identificador del contenido multimedia. |
| `status` | string | `published`, `processing` o `rejected`. |
| `type` | string | `photo` o `video`. |
| `alt` | string | Nombre del archivo original enviado por el comprador. |
| `variations` | array | Tamaños disponibles para fotos; cada elemento contiene `size` y `url`. Está vacío para videos. |
| `url`, `thumbnail`, `preview_url`, `duration_ms` | string / integer | Datos exclusivos para `type: video`: URL del archivo, miniatura, vista previa y duración en milisegundos. |

### `helpful_reviews`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `best_max_stars` | string \| null | ID de la evaluación más relevante entre las de mayor calificación. Devuelve `null` cuando no hay datos suficientes. |
| `best_min_stars` | string \| null | ID de la evaluación más relevante entre las de menor calificación. Devuelve `null` cuando no hay datos suficientes. |

### Campos raíz

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `rating_average` | float | Promedio general de las calificaciones. |
| `stars` | float | Promedio de estrellas redondeado para mostrar en la interfaz, por ejemplo `4.5` o `5.0`. |
| `cross_site_enabled` | boolean | Indica si se comparten evaluaciones entre sitios de Mercado Libre. Puede no estar presente cuando no aplica al ítem consultado. |
| `rating_levels` | object | Distribución por estrellas: `one_star`, `two_star`, `three_star`, `four_star` y `five_star`. |
| `quali_attributes` | array | Atributos cualitativos evaluados, por ejemplo comodidad o durabilidad. |

Campos de uso interno

No uses `valorization`, `relevance`, `forbidden_words`, `routing_key`, `document_version`, `item_status` ni `bucket` en lógica de negocio ni los muestres a usuarios finales.

Campos sensibles

`reviewer_id` siempre devuelve `0`; no lo uses como identificador. Trata `order_id` como información confidencial y no lo expongas en interfaces públicas. `variation_id` puede combinarse con otros datos para inferir comportamientos de compra.

### Evaluaciones de ítems de catálogo

Para los ítems asociados a publicaciones de catálogo, envía el `catalog_product_id` correspondiente para consultar las evaluaciones del producto.

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/reviews/item/MLB1632704547?catalog_product_id=MLB14186226'
```

Conoce más sobre [publicaciones de catálogo](https://developers.mercadolivre.com.br/pt_br/o-catalogo-chegou-saiba-como-adaptar-sua-integracao).

### Errores comunes

| HTTP | Código | Mensaje | Causa | Solución |
| --- | --- | --- | --- | --- |
| 400 | `unauthorized` | `String $ITEM_ID is not valid` | El ID no tiene el formato correcto. | Verifica el prefijo del sitio y el ID numérico, por ejemplo `MLB123456789`. |
| 400 | `bad_request` | `Not valid limit` | El valor de `limit` supera el máximo permitido. | Reduce el valor al intervalo aceptado. |
| 400 | `bad_request` | `Not valid offset` | El valor de `offset` supera el máximo permitido. | Reduce el valor de `offset`. |
| 401 | `unauthorized` | — | El access token es inválido, expiró o tiene un formato incorrecto. | Renueva el access token mediante OAuth. |
| 403 | `forbidden` | `At least one policy returned UNAUTHORIZED` | El access token no tiene los permisos necesarios. | Renueva el token y verifica los scopes. |
| 404 | `not_found` | — | El `ITEM_ID` no existe, se eliminó o pertenece a otro sitio. | Confirma el `ITEM_ID` y el `site_id`. |
| 429 | `to_many_requests` | — | Se excedió el rate limit. | Implementa reintentos con exponential backoff y respeta el header `Retry-After`. |

### Restricciones por país

Este endpoint está disponible en todos los sitios donde opera Mercado Libre, incluidos MLB, MLA, MLM, MLC, MCO, MPE y MLU.

Evaluaciones entre sitios

`cross_site_enabled` indica si se muestran evaluaciones de compradores de otros países. Cuando devuelve `false`, la respuesta solo contiene evaluaciones del mismo `site_id`.

Usuarios CBT

Las respuestas son válidas con el access token de la cuenta padre al consultar ítems de la cuenta hija.

### Notificaciones

Este endpoint es de solo lectura; no genera webhooks ni notificaciones en tiempo real.

### Herramientas aplicables

- Centros y plataformas de integración

- ERPs

- Plataformas

- CRMs y herramientas de atención

- Herramientas de BI

- Desarrollo propio

### Prerrequisitos

- Un access token válido. La consulta de evaluaciones de ítems públicos no requiere un scope especial.

- El `ITEM_ID` de un ítem activo y publicado en Mercado Libre.

- Para ítems de catálogo, el `catalog_product_id` correspondiente.
