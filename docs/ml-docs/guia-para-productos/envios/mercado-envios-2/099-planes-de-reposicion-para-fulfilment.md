<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/planes-de-reposicion-para-fulfilment -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Planes de reposición para fulfilment

Última actualización 06/11/2026

## Planes de reposición

Una recomendación de reposición indica si un producto almacenado en Full necesita nuevas unidades para mantener su disponibilidad. Cuando corresponda, incluye la cantidad sugerida y el plazo recomendado para realizar la reposición.

Mediante este recurso, las aplicaciones pueden consultar para un User Product información consolidada sobre stock, ventas, atributos del producto, beneficios aplicables y recomendaciones de reposición. Esta información puede integrarse en otros sistemas de gestión del seller para facilitar la planificación y la toma de decisiones.

Nota:

Siguiendo las sugerencias de envío, el seller se asegura de tener el stock necesario para cubrir sus ventas futuras. El seller conserva la decisión sobre las unidades que envía a Full, sujetas a las validaciones operativas y de capacidad aplicables.

## Recursos disponibles

| Recurso | Método y endpoint | Descripción |
| --- | --- | --- |
| Consultar por User Product | `GET /marketplace/fbm/user-products/{user_product_id}/replenishment` | Devuelve la recomendación y la información asociada a un producto. |
| Consultar por seller | `GET /marketplace/fbm/sellers/{seller_id}/user-products/replenishment` | Devuelve, de forma paginada, la recomendación y la información de los productos de un seller. |

## Casos de uso

| Caso de uso | Descripción |
| --- | --- |
| Obtener información de reposición de un producto asociado a Full | Cuando el producto tiene `inventory_id`, se entrega la información completa disponible: identificadores, datos del producto, stock, ventas, recomendación y beneficios aplicables. |
| Obtener información básica de un producto no asociado a Full | Cuando el producto no tiene `inventory_id`, se entregan los identificadores disponibles y la información básica del producto. Los datos de stock, ventas, recomendación y beneficios son `null`. |

## Autenticación

El endpoint requiere autenticación vía **OAuth2** . El integrador debe incluir un token válido en el header `Authorization`:

```
Authorization: Bearer $ACCESS_TOKEN
```

**Importante:**

El token debe corresponder al seller que realiza la operación. Cada recurso está protegido para que solo el seller autenticado pueda acceder a su propia información.

## Límite de solicitudes (Rate Limit)

El endpoint tiene rate limiting habilitado **por seller**  (basado en la identidad del token OAuth2):

| Recurso | Cuota | Ventana |
| --- | --- | --- |
| Por User Product | 500 solicitudes | 60 segundos |
| Por seller (paginado) | 500 solicitudes | 60 segundos |

Al exceder el límite, la API responde con `429 Too Many Requests`.

Nota:

El envío reiterado de requests idénticos en un corto período de tiempo puede resultar en un bloqueo temporal del seller.

## Consultar recomendación de reposición por User Product

Este recurso permite consultar la recomendación de reposición y la información asociada a un User Product.

```
GET /marketplace/fbm/user-products/{user_product_id}/replenishment
```

#### Parámetro obligatorio

| Variable | Tipo | Descripción |
| --- | --- | --- |
| `user_product_id` | String | Identificador del User Product que se desea consultar. Debe comenzar con uno de los prefijos admitidos (`U`, `MLAU`, `MLBU`, `MLMU`, `MCOU` o `MLCU`), seguido de entre 1 y 10 dígitos. Ejemplo: `MLBU763575079`. |

#### Query param obligatorio

| Variable | Descripción |
| --- | --- |
| `country` | Código de dos letras del país asociado a la consulta. Debe enviarse en mayúsculas. Ejemplos: `BR`, `CL`, `CO`. |

## Ejemplos

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/marketplace/fbm/user-products/$USER_PRODUCT_ID/replenishment?country=$COUNTRY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/marketplace/fbm/user-products/U4259572170/replenishment?country=BR
```

## Respuesta por User Product

Las respuestas 200 y 206 mantienen la misma estructura. El historial de ventas puede incluir hasta seis períodos semanales.

Si el producto tiene `inventory_id`, la respuesta incluye identificadores, producto, stock, ventas, recomendación y beneficios.

### 200 OK

**Cuando el producto ya está en Full:**

```
{
 "identifiers": {
   "user_product_id": "MLBU123342568",
   "inventory_id": "FCAD123456",
   "seller_sku": "gfhrts-dagtddhg"
 },
 "product": {
   "tags": [
     "master_case",
     "star_product",
     "is_fulfillment"
   ],
   "packages_master_case": []
 },
 "stock": {
   "total_stock": 0,
   "shipping_urgency": "THIS_WEEK",
   "minimum_distributable_stock": 95
 },
 "sales": {
   "sales_totals": {
     "period": "30DAYS",
     "gmv": [
       {
         "full": 14674.98
       }
     ],
     "currency": "BRL",
     "units_sold": [
       {
         "full": 210
       }
     ]
   },
   "sales_history": [
     {
       "start_date": "2026-08-13",
       "end_date": "2026-08-19",
       "units_sold": 4,
       "days_out_of_stock": 5,
       "campaigns": []
     },
     {
       "start_date": "2026-08-06",
       "end_date": "2026-08-12",
       "units_sold": 3,
       "days_out_of_stock": 1,
       "campaigns": []
     },
     {
       "start_date": "2026-07-30",
       "end_date": "2026-08-05",
       "units_sold": 115,
       "days_out_of_stock": 0,
       "campaigns": []
     },
     {
       "start_date": "2026-07-23",
       "end_date": "2026-07-29",
       "units_sold": 75,
       "days_out_of_stock": 0,
       "campaigns": []
     },
     {
       "start_date": "2026-07-16",
       "end_date": "2026-07-22",
       "units_sold": 17,
       "days_out_of_stock": 0,
       "campaigns": []
     },
     {
       "start_date": "2026-07-09",
       "end_date": "2026-07-15",
       "units_sold": 0,
       "days_out_of_stock": 4,
       "campaigns": []
     }
   ]
 },
 "recommendation": {
   "recommendation_type": "REPLENISH",
   "suggested_quantity": {
     "type": "exact",
     "value": 510
   },
   "replenishment_deadline": "THIS_WEEK",
   "replenishment_frequency": 4
 },
 "eligibility_benefits": [
   "AGING"
 ]
}
```

### Sin cantidad sugerida

Cuando no se necesita reponer, `recommendation_type` es `NO_REPLENISHMENT` y `suggested_quantity` es `null`.

```
{
  "recommendation": {
    "recommendation_type": "NO_REPLENISHMENT",
    "suggested_quantity": null,
    "replenishment_deadline": "NEXT_WEEK",
    "replenishment_frequency": 4
  }
}
```

**Cuando el producto nunca ha estado en Full**  (por el momento no se cuenta con más información):

```
{
 "identifiers": {
   "user_product_id": "MLBU123342568",
   "inventory_id": null,
   "seller_sku": "gfhrts-dagtddhg"
 },
 "product": {
   "tags": [
     "is_fulfillment"
   ],
   "packages_master_case": []
 },
 "stock": null,
 "sales": null,
 "recommendation": null,
 "eligibility_benefits": null
}
```

**Cuando el producto presenta una restricción**  (todavía no está asociado a Full y la restricción puede afectar o impedir su envío):

```
{
 "identifiers": {
   "user_product_id": "MLBU123342568",
   "inventory_id": null,
   "seller_sku": "gfhrts-dagtddhg"
 },
 "product": {
   "tags": [
     "is_restricted"
   ],
   "packages_master_case": []
 },
 "stock": null,
 "sales": null,
 "recommendation": null,
 "eligibility_benefits": null
}
```

### Response 206 — Partial Content

La API devuelve `206 Partial Content` cuando puede entregar la recomendación de reposición y los beneficios aplicables, pero parte de la información complementaria del producto no está disponible.

**Importante:**

El header X-Content-Missing identifica los contenidos afectados. Los valores posibles son identifiers, product, sales y stock. Cuando existe más de un contenido afectado, los valores se separan por comas. Este header se devuelve únicamente en respuestas 206; las respuestas 200 OK no lo incluyen y nunca expone nombres de APIs, servicios o dependencias internas.

La respuesta conserva su estructura general. Los contenidos afectados pueden presentar campos en `null`, listas vacías o información parcial. El integrador puede utilizar los datos disponibles y reintentar la consulta posteriormente.

```
HTTP/1.1 206 Partial Content
Content-Type: application/json
X-Content-Missing: sales, stock

{
 "identifiers": {
   "user_product_id": "MLBU763575079",
   "inventory_id": "FFOC95076",
   "seller_sku": "ND-ZIG-1PT"
 },
 "product": {
   "tags": [
     "star_product",
     "is_fulfillment"
   ],
   "packages_master_case": []
 },
 "stock": {
   "total_stock": 0,
   "shipping_urgency": null,
   "minimum_distributable_stock": null
 },
 "sales": {
   "sales_totals": {
     "period": "30DAYS",
     "gmv": [
       {
         "full": 14990.54
       }
     ],
     "currency": "BRL",
     "units_sold": [
       {
         "full": 214
       }
     ]
   },
   "sales_history": null
 },
 "recommendation": {
   "recommendation_type": "REPLENISH",
   "suggested_quantity": {
     "type": "exact",
     "value": 510
   },
   "replenishment_deadline": null,
   "replenishment_frequency": null
 },
 "eligibility_benefits": [
   "AGING"
 ]
}
```

## Consultar reposición por seller

Este recurso devuelve de forma paginada la recomendación de reposición y la información asociada a los User Products de un seller.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/marketplace/fbm/sellers/$SELLER_ID}/user-products/replenishment
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/marketplace/fbm/sellers/1356551933/user-products/replenishment
```

### Filtros

Los filtros `shipping_urgency` y `product_tags` permiten acotar la colección. El filtro de urgencia devuelve productos con el nivel de stock indicado y el tag `is_fulfillment` en `product.tags`.

| Productos | Parámetros | Disponible para |
| --- | --- | --- |
| Productos que hay que reponer de inmediato | `shipping_urgency=URGENT,THIS_WEEK` | 3P y CBT M4 |
| Productos estrella que hay que reponer pronto | `shipping_urgency=URGENT,THIS_WEEK&product_tags=STAR_PRODUCTS` | Solo 3P |
| Productos para planificar la semana siguiente | `shipping_urgency=NEXT_WEEK` | Solo 3P |
| Productos sin urgencia de envío | `shipping_urgency=NO_URGENCY` | 3P y CBT M4 |
| Todos los productos estrella, sin importar la urgencia | `product_tags=STAR_PRODUCTS` | Solo 3P |

Los filtros se aplican solo cuando el nombre del parámetro coincide exactamente (`shipping_urgency` o `product_tags`). La API ignora los parámetros que no figuran en la tabla de parámetros y no devuelve error por ellos.

### Parámetros

| Parámetro | Tipo | Requerido | Default | Descripción |
| --- | --- | --- | --- | --- |
| `seller_id` (ruta) | Number | Sí | — | Identificador numérico positivo del seller. |
| `country` (query) | String | Sí | — | Código de país de dos letras en mayúsculas. Debe coincidir con el país del seller. Ejemplos: AR, BR, CL, CO o MX; para CBT M4, CN. |
| `limit` (query) | Integer | No | 20 | Cantidad de productos por página. Valores permitidos: de 1 a 20. |
| `offset` (query) | Integer | No | 0 | Cantidad de productos que se omiten antes de comenzar la página. Debe ser mayor o igual que 0. Si es mayor o igual a `paging.total`, la API devuelve 200 con `results` vacío. |
| `shipping_urgency` (query) | Lista de valores | No | — | Filtra por urgencia de envío. Envía uno o más valores separados por comas: URGENT, THIS_WEEK, NEXT_WEEK, IN_TWO_WEEKS, NO_URGENCY o EXCEDENT. CBT M4 no admite NEXT_WEEK. |
| `product_tags` (query) | Lista de valores | No | — | Filtra por características del producto. El único valor disponible es STAR_PRODUCTS. Solo para sellers 3P. |

### Cómo se interpretan los parámetros

- Combina con OR los valores de un mismo filtro. Por ejemplo, `shipping_urgency=URGENT,THIS_WEEK` devuelve productos que cumplen cualquiera de los dos valores.

- Combina con AND distintos filtros, como `shipping_urgency` y `product_tags`.

- La API ignora los valores repetidos y descarta los valores vacíos dentro de un filtro.

- Si un valor de `shipping_urgency` o `product_tags` no existe, la solicitud devuelve 400.

- La API ignora los parámetros que no figuran en la tabla y no los usa para filtrar la respuesta.

- Si no envías `limit` u `offset`, se aplican sus valores predeterminados.

- La API devuelve los productos en el orden de prioridad de reposición definido para el tipo de seller. Mantiene ese orden dentro de cada página y no permite configurarlo.

### Ejemplos de solicitud

```
# Primera página, 2 productos por página, sin filtros
curl --request GET \
  --url 'https://api.mercadolibre.com/marketplace/fbm/sellers/123456789/user-products/replenishment?country=AR&limit=2&offset=0' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'

# Página siguiente: offset = offset anterior + limit
curl --request GET \
  --url 'https://api.mercadolibre.com/marketplace/fbm/sellers/123456789/user-products/replenishment?country=AR&limit=2&offset=2' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'

# Productos estrella con urgencia URGENT o THIS_WEEK
curl --request GET \
  --url 'https://api.mercadolibre.com/marketplace/fbm/sellers/123456789/user-products/replenishment?country=AR&limit=20&offset=0&shipping_urgency=URGENT,THIS_WEEK&product_tags=STAR_PRODUCTS' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

### Estructura de la respuesta

Cada elemento de `results` tiene la misma estructura que la respuesta del recurso por User Product.

| Campo | Descripción |
| --- | --- |
| `seller_id` | Identificador del seller consultado. Coincide con `seller_id` de la ruta. |
| `results` | Productos de la página. Cada elemento tiene la estructura del recurso por User Product. |
| `warnings` | Advertencias, una por cada producto con información incompleta. Está vacío cuando todos los productos tienen información completa. |
| `warnings[].user_product_id` | User Product de la página al que corresponde la advertencia. |
| `warnings[].code` | Tipo de advertencia. El valor disponible es `partial_content`. |
| `warnings[].content_missing` | Objetos que no se pudieron obtener: `product`, `sales` o `stock`. Puede incluir más de uno. |
| `paging.limit` | Cantidad máxima de productos de la página. |
| `paging.offset` | Posición inicial de la página: cantidad de productos omitidos. |
| `paging.total` | Total de productos que coinciden con los filtros antes de aplicar `limit` y `offset`. |

### 200 OK: página completa

Ejemplo de respuesta (fragmento de la lista de resultados):

```
{
  "seller_id": 123456789,
  "results": [
    {
      "identifiers": { "user_product_id": "MLAU123456789", "inventory_id": "YUMG12345", "seller_sku": "DFHMB-322614" },
      "product": { "tags": ["star_product", "is_fulfillment"], "packages_master_case": [] },
      "stock": { "total_stock": 20, "shipping_urgency": "THIS_WEEK", "minimum_distributable_stock": 5 },
      "sales": { "sales_totals": { "period": "30DAYS", "currency": "ARS", "units_sold": [{ "full": 210 }], "gmv": [{ "full": 14674.98 }] }, "sales_history": [] },
      "recommendation": { "recommendation_type": "REPLENISH", "suggested_quantity": { "type": "exact", "value": 510 }, "replenishment_deadline": "THIS_WEEK", "replenishment_frequency": 4 },
      "eligibility_benefits": ["AGING"]
    }
  ],
  "warnings": [],
  "paging": { "limit": 2, "offset": 0, "total": 134 }
}
```

### 200 OK: colección sin resultados

Si ningún producto coincide con los filtros o `offset` es mayor o igual que el total, la API devuelve 200 con `results` vacío.

```
{
  "seller_id": 123456789,
  "results": [],
  "warnings": [],
  "paging": { "limit": 20, "offset": 0, "total": 0 }
}
```

### 206 Partial Content

La API devuelve 206 cuando al menos un producto de la página tiene información complementaria incompleta (`product`, `sales` o `stock`), pero sí pudo entregar su recomendación y beneficios. Agrega una entrada a `warnings[]` por cada producto afectado. A diferencia del recurso por User Product, no envía el header `X-Content-Missing`: informa los objetos faltantes en `warnings[].content_missing`. Usa los datos disponibles y vuelve a consultar la página o consulta el producto afectado con el recurso por User Product.

Ejemplo de respuesta (fragmento):

```
{
  "seller_id": 123456789,
  "results": [{
    "identifiers": { "user_product_id": "MLAU123456789", "inventory_id": "YUMG12345", "seller_sku": "DFHMB-322614" },
    "sales": { "sales_totals": null, "sales_history": null },
    "recommendation": { "recommendation_type": "REPLENISH", "suggested_quantity": { "type": "exact", "value": 510 }, "replenishment_deadline": "THIS_WEEK", "replenishment_frequency": 4 }
  }],
  "warnings": [{ "user_product_id": "MLAU123456789", "code": "partial_content", "content_missing": ["sales"] }],
  "paging": { "limit": 2, "offset": 0, "total": 134 }
}
```

Si falla un dato obligatorio de cualquiera de los productos de la página, la solicitud completa devuelve un error y no entrega una página parcial. Ante un error 5xx, vuelve a enviar la misma página.

## Campos de la respuesta

Cada producto, tanto en el recurso por User Product como en cada elemento de `results[]` del recurso por seller, puede incluir estos campos. La disponibilidad varía según el tipo de seller.

| Campo | Descripción | Disponible para |
| --- | --- | --- |
| `identifiers.user_product_id` | Identificador único del User Product en Mercado Libre. | 3P y CBT M4 |
| `identifiers.inventory_id` | Identificador único del producto en Full. | 3P y CBT M4 |
| `identifiers.seller_sku` | SKU que define el seller para identificar el producto en su propio sistema. Puede ser `null`. | 3P y CBT M4 |
| `product.tags` | Lista de características asociadas al producto. | 3P y CBT M4 |
| `product.packages_master_case` | Configuraciones de cajas Master Case. En la primera fase devuelve una lista vacía. | Solo 3P |
| `stock.total_stock` | Incluye unidades disponibles en almacenamiento, en espera de arribo, reservadas en transferencia y, si corresponde, unidades que podrían estar disponibles al resolver restricciones por falta de documentación fiscal. Puede diferir del inventario informado por Stock, que representa solo las unidades disponibles en almacenamiento Full. Puede ser `null`. | 3P y CBT M4 |
| `stock.shipping_urgency` | Urgencia de envío para evitar que el producto se quede sin unidades en Full. Puede ser `null`. | 3P y CBT M4 |
| `stock.minimum_distributable_stock` | Unidades mínimas necesarias para distribuir el producto en Full. Puede ser `null`. | Solo 3P |
| `sales.sales_totals.period` | Período usado para calcular las ventas acumuladas. | 3P y CBT M4 |
| `sales.sales_totals.units_sold[].full` | Unidades vendidas mediante la logística de Full durante el período. | 3P y CBT M4 |
| `sales.sales_totals.gmv[].full` | Valor bruto de ventas realizadas mediante la logística de Full durante el período. | 3P y CBT M4 |
| `sales.sales_totals.currency` | Código de la moneda del GMV. | 3P y CBT M4 |
| `sales.sales_history` | Historial semanal de ventas, días sin stock y campañas activas. Puede devolver hasta seis períodos. | 3P y CBT M4 |
| `sales.sales_history[].start_date` y `end_date` | Fechas inicial y final del período semanal. | 3P y CBT M4 |
| `sales.sales_history[].units_sold` | Unidades vendidas mediante Full durante la semana. | 3P y CBT M4 |
| `sales.sales_history[].days_out_of_stock` | Días sin stock durante la semana. | 3P y CBT M4 |
| `sales.sales_history[].campaigns` | Nombres de las campañas activas durante la semana. Actualmente devuelve datos para MLB y MLM. En otros sites o si no hay campañas, devuelve una lista vacía. | Solo 3P |
| `recommendation.recommendation_type` | Resultado de la recomendación aplicable al producto. Puede ser `null`. | 3P y CBT M4 |
| `recommendation.suggested_quantity` | Cantidad sugerida. Es `null` si no se necesita reponer y puede ser `null` cuando no hay información. | 3P y CBT M4 |
| `suggested_quantity.type`, `value`, `min`, `max` | `type` indica `exact` o `range`. `value` contiene la cantidad exacta; `min` y `max`, los límites del rango. | `type` y `value`: 3P y CBT M4. `min` y `max`: solo CBT M4. |
| `recommendation.replenishment_deadline` | Plazo sugerido para reponer. Puede ser `null` si no hay información. | Solo 3P |
| `recommendation.replenishment_frequency` | Frecuencia de reposición según el historial de inbound del seller, expresada en semanas. Puede ser `null`. | Solo 3P |
| `eligibility_benefits` | Beneficios para los que el producto es elegible. La presencia de un valor indica elegibilidad, no que el beneficio se haya otorgado. | Solo 3P |

## Valores posibles de los campos dinámicos

### product.tags

| Valor | Significado |
| --- | --- |
| `is_fulfillment` | El User Product está habilitado para operar en Full. |
| `star_product` | Mercado Libre identifica el producto por su buen rendimiento. |
| `master_case` | El producto está identificado para operar con cajas de fábrica. En esta primera fase, `packages_master_case` devuelve una lista vacía. |
| `is_restricted` | El producto tiene una restricción que puede afectar su operación o reposición en Full. |

### stock.shipping_urgency

Estos son los valores del campo y del filtro `shipping_urgency` del recurso por seller:

| Valor | Significado | Disponible para |
| --- | --- | --- |
| `URGENT` | Se recomienda enviar stock de forma urgente. | 3P y CBT M4 |
| `THIS_WEEK` | Se recomienda enviar stock durante la semana actual. | 3P y CBT M4 |
| `NEXT_WEEK` | Se recomienda reponer durante la semana siguiente. | Solo 3P |
| `IN_TWO_WEEKS` | Se recomienda reponer dentro de las próximas dos semanas. | 3P y CBT M4 |
| `NO_URGENCY` | El envío de stock puede realizarse sin urgencia. | 3P y CBT M4 |
| `EXCEDENT` | El valor es aceptado por el filtro de urgencia. | El documento fuente no especifica disponibilidad por tipo de seller. |

Los productos con `stock.shipping_urgency` nulo (por ejemplo, si no tienen `inventory_id`) no coinciden con ningún valor del filtro. Solo aparecen si no envías `shipping_urgency`.

### sales.sales_totals.period

| Valor | Período |
| --- | --- |
| `7DAYS` | Últimos 7 días. |
| `14DAYS` | Últimos 14 días. |
| `30DAYS` | Últimos 30 días. |

### recommendation.recommendation_type

| Valor | Significado |
| --- | --- |
| `REPLENISH` | Se recomienda reponer tomando como referencia la cantidad sugerida. |
| `NO_REPLENISHMENT` | No se recomienda reponer en este momento, según las condiciones actuales del producto. |
| `NO_REPLENISHMENT_BY_RESTRICTION` | No se puede reponer debido a una restricción aplicable al producto. |
| `NO_QUANTITY_BY_INBOUND` | No se muestra una cantidad porque el seller ya realizó un inbound de este producto durante la semana. La API actualiza las recomendaciones cada semana, los domingos. |

### recommendation.suggested_quantity.type

| Valor | Significado |
| --- | --- |
| `exact` | La recomendación contiene una cantidad en `value`. |
| `range` | La recomendación contiene un rango en `min` y `max`. |

### recommendation.replenishment_deadline

| Valor | Significado |
| --- | --- |
| `THIS_WEEK` | Se recomienda reponer durante la semana actual. |
| `NEXT_WEEK` | Se recomienda reponer durante la semana siguiente. |
| `IN_TWO_WEEKS` | Se recomienda reponer dentro de las próximas dos semanas. |
| `NOT_REPLENISHMENT_NEEDED` | No se define un plazo porque no hace falta reponer a corto plazo. |

### recommendation.replenishment_frequency

El campo es numérico y admite estos valores:

| Valor | Significado |
| --- | --- |
| 2 | El seller repone cada dos semanas. |
| 3 | El seller repone cada tres semanas. |
| 4 | El seller repone cada cuatro semanas. |

### eligibility_benefits

La lista indica los beneficios para los que el producto es elegible. La elegibilidad no significa que el beneficio ya se haya otorgado.

| Valor | Beneficio | Condiciones para acceder |
| --- | --- | --- |
| `AGING` | Puede cubrir cargos por antigüedad de las unidades almacenadas en Full. | El seller debe enviar al menos la cantidad de `recommendation.suggested_quantity` y no haber recibido antes un beneficio AGING durante la misma semana calendario. El beneficio se otorga cuando se reciben las unidades y se valida el cumplimiento de estas condiciones. |

### sales.sales_history[].campaigns

La lista contiene nombres de campañas de Mercado Libre activas durante cada semana. Úsala para interpretar picos de ventas: durante una campaña, las ventas pueden superar el nivel habitual y no conviene extrapolarlas como demanda regular. Cada elemento es un string.

```
{
  "sales_history": [
    { "start_date": "2026-10-07", "end_date": "2026-10-13", "units_sold": 98, "days_out_of_stock": 0, "campaigns": ["Double Days Oct"] },
    { "start_date": "2026-09-30", "end_date": "2026-10-06", "units_sold": 40, "days_out_of_stock": 0, "campaigns": [] }
  ]
}
```

### Response 404 — Not Found

```
{
 "error": "not_found",
 "message": "The requested resource was not found.",
 "status": 404
}
```

Parámetro inválido:

```
{
 "error": "invalid_request",
 "message": "One or more request parameters are invalid.",
 "status": 400
}
```

### Response 403 — Forbidden

La cuenta autenticada no tiene autorización para consultar el recurso solicitado.

```
{
 "error": "access_denied",
 "message": "You are not authorized to access this resource.",
 "status": 403
}
```

### Response 429 — Too Many Requests

```
{
 "error": "too_many_requests",
 "message": "Too Many Requests",
 "status": 429
}
```

### Response 500 — Internal Error

```
{
 "error": "internal_error",
 "message": "An unexpected error occurred. Please try again later.",
 "status": 500
}
```

### Response 503 — Service Unavailable

```
{
 "error": "service_unavailable",
 "message": "The service is temporarily unavailable. Please try again later.",
 "status": 503
}
```

## Campos de la respuesta

| Campo | Descripción | No aplica |
| --- | --- | --- |
| `identifiers.user_product_id` | Identificador único del User Product en Mercado Libre. |  |
| `identifiers.inventory_id` | Identificador del inventario asociado al producto en Full. |  |
| `identifiers.seller_sku` | SKU definido por el seller para identificar el producto en su propio sistema. Puede ser `null` cuando no está informado. |  |
| `product.tags` | Lista de características asociadas al producto. |  |
| `product.packages_master_case` | Configuraciones de cajas correspondientes a Master Case. En la primera fase se devuelve una lista vacía. | CBT M4 |
| `stock.total_stock` | Contempla las unidades disponibles en almacenamiento, las unidades en espera de arribo, las unidades reservadas en transferencia y, cuando aplica, unidades almacenadas que podrían estar disponibles, una vez resueltas restricciones por falta de documentación fiscal. Por este motivo, `stock.total_stock` puede diferir del inventario informado por Stock: Stock representa únicamente las unidades disponibles en almacenamiento Full, mientras que esta contempla también las que potencialmente estarán disponibles para atender la demanda. |  |
| `stock.shipping_urgency` | Identificador de la urgencia de envío. |  |
| `stock.minimum_distributable_stock` | Cantidad mínima de unidades requerida para que el producto pueda distribuirse en Full. | CBT M4 |
| `sales.sales_totals.period` | Período utilizado para calcular las ventas acumuladas. |  |
| `sales.sales_totals.units_sold[].full` | Cantidad de unidades vendidas en la logística de Full durante el período consultado. |  |
| `sales.sales_totals.gmv[].full` | Valor bruto de las ventas realizadas en la logística de Full durante el período consultado. |  |
| `sales.sales_totals.currency` | Código de la moneda utilizada para expresar el GMV. |  |
| `sales.sales_history` | Historial semanal de ventas, días sin stock y campañas activas en Mercado Libre. Se pueden devolver hasta seis períodos. |  |
| `sales.sales_history[].start_date` | Fecha inicial del período semanal. |  |
| `sales.sales_history[].end_date` | Fecha final del período semanal. |  |
| `sales.sales_history[].units_sold` | Cantidad de unidades vendidas mediante Full durante el período semanal. |  |
| `sales.sales_history[].days_out_of_stock` | Cantidad de días sin stock durante el período semanal. |  |
| `sales.sales_history[].campaigns` | Campañas asociadas al período. En la implementación actual se devuelve una lista vacía. | CBT M4 |
| `recommendation.recommendation_type` | Resultado de la recomendación de reposición aplicable al producto. |  |
| `recommendation.suggested_quantity.type` | Forma en que se expresa la cantidad sugerida: `exact` o `range`. |  |
| `recommendation.suggested_quantity.value` | Cantidad exacta sugerida. Se informa cuando `type` es `exact`. |  |
| `recommendation.suggested_quantity.min` | Cantidad mínima sugerida. Se informa cuando `type` es `range`. |  |
| `recommendation.suggested_quantity.max` | Cantidad máxima sugerida. Se informa cuando `type` es `range`. |  |
| `recommendation.replenishment_deadline` | Plazo sugerido para realizar la reposición. Puede ser `null` cuando esta información no está disponible. | CBT M4 |
| `recommendation.replenishment_frequency` | Frecuencia de reposición, según historial de inbound del seller, expresada en semanas. Puede ser `null` cuando esta información no está disponible. | CBT M4 |
| `eligibility_benefits` | Lista de beneficios a los que el producto resulta elegible. |  |

## Valores posibles de campos dinámicos

### product.tags

| Valor | Significado |
| --- | --- |
| `is_fulfillment` | El User Product está habilitado para operar en Full. |
| `star_product` | El producto está identificado por Mercado Libre como producto con muy buen performance. |
| `master_case` | El producto está identificado para operar con configuraciones de cajas de fábrica. En esta primera fase, `packages_master_case` se devuelve vacío. |
| `is_restricted` | El producto presenta una restricción que puede afectar su operación o reposición en Full. |

### sales.sales_totals.period

| Valor | Significado |
| --- | --- |
| `7DAYS` | Las ventas acumuladas corresponden a los últimos 7 días. |
| `14DAYS` | Las ventas acumuladas corresponden a los últimos 14 días. |
| `30DAYS` | Las ventas acumuladas corresponden a los últimos 30 días. |

### sales.sales_history.campaigns

Lista de campañas asociadas al producto durante el período semanal. Los valores dependen del site (está sujeto a que se incluyan o excluyan campañas, según demanda). Se devuelve una lista vacía cuando no existen campañas asociadas al período.

| Valor | Significado |
| --- | --- |
| Black Friday | Campaña aplicable a los sites MLB y MLM. |
| Buen Fin | Campaña aplicable al site MLM. |
| Cyber Ofertas | Campaña aplicable al site MLM. |
| Descontaço Abril | Campaña aplicable al site MLB. |
| Descontaço Julho | Campaña aplicable al site MLB. |
| Descontaço Setembro | Campaña aplicable al site MLB. |
| Dia das Crianças | Campaña aplicable al site MLB. |
| Día de la Madre | Campaña aplicable al site MLM. |
| Día del Niño | Campaña aplicable al site MLM. |
| Dia do Consumidor | Campaña aplicable al site MLB. |
| Dia dos Pais | Campaña aplicable al site MLB. |
| Días Libres | Campaña aplicable al site MLM. |
| Double Days Apr | Campaña aplicable a los sites MLB y MLM. |
| Double Days Ene | Campaña aplicable al site MLM. |
| Double Days Feb | Campaña aplicable a los sites MLB y MLM. |
| Double Days Jul | Campaña aplicable al site MLM. |
| Double Days Jun | Campaña aplicable al site MLB. |
| Double Days Mar | Campaña aplicable al site MLM. |
| Double Days Oct | Campaña aplicable a los sites MLB y MLM. |
| Double Days Sep | Campaña aplicable a los sites MLB y MLM. |
| Hot Sale | Campaña aplicable al site MLM. |
| Namorados | Campaña aplicable al site MLB. |
| Natal | Campaña aplicable al site MLB. |
| Navidad | Campaña aplicable al site MLM. |
| Rebajas Verano | Campaña aplicable al site MLM. |
| Saldão/Descontaço | Campaña aplicable al site MLB. |
| Unboxing | Campaña aplicable al site MLM. |
| Unboxing Days | Campaña aplicable al site MLM. |

### stock.shipping_urgency

| Valor | Significado |
| --- | --- |
| `URGENT` | Se recomienda enviar stock para reponerlo de forma urgente. |
| `THIS_WEEK` | Se recomienda enviar stock durante la semana actual. |
| `NEXT_WEEK` | Se recomienda realizar la reposición durante la semana siguiente. |
| `IN_TWO_WEEKS` | Se recomienda realizar la reposición dentro de las próximas dos semanas. |
| `NO_URGENCY` | El envío de stock para reponerlo puede realizarse sin urgencia. |
| `EXCEDENT` | El producto tiene stock por encima del nivel considerado suficiente. |

### recommendation.recommendation_type

| Valor | Significado |
| --- | --- |
| `REPLENISH` | Se recomienda realizar una reposición utilizando como referencia la cantidad sugerida. |
| `NO_REPLENISHMENT` | No se recomienda realizar una nueva reposición en este momento, de acuerdo con las condiciones actuales del producto. |
| `NO_REPLENISHMENT_BY_RESTRICTION` | No se puede reponer porque existe una restricción aplicable al producto. |

### recommendation.suggested_quantity.type

| Valor | Significado |
| --- | --- |
| `exact` | La recomendación contiene una única cantidad sugerida, informada en `value`. |
| `range` | La recomendación contiene un intervalo de cantidades, informado mediante `min` y `max`. |

### recommendation.replenishment_deadline

| Valor | Significado |
| --- | --- |
| `THIS_WEEK` | Se recomienda realizar la reposición durante la semana actual. |
| `NEXT_WEEK` | Se recomienda realizar la reposición durante la semana siguiente. |
| `IN_TWO_WEEKS` | Se recomienda realizar la reposición dentro de las próximas dos semanas. |
| `NOT_REPLENISHMENT_NEEDED` | No se define un plazo porque no se requiere realizar una reposición en corto plazo. |

### recommendation.replenishment_frequency

Aunque es numérico, también tiene un conjunto acotado de valores:

| Valor | Significado |
| --- | --- |
| `2` | Cuando el seller repone cada dos semanas. |
| `3` | Cuando el seller repone cada tres semanas. |
| `4` | Cuando el seller repone cada cuatro semanas. |

### eligibility_benefits

Lista de beneficios para los que el producto resulta elegible. La presencia de un valor indica elegibilidad, pero no implica que el beneficio haya sido otorgado.

| Valor | Significado | Condiciones para acceder |
| --- | --- | --- |
| `AGING` | El producto es elegible para el beneficio con el que puede cubrir cargos por antigüedad de las unidades almacenadas en Full. | El seller debe enviar al menos la cantidad indicada en `recommendation.suggested_quantity` y no haber obtenido previamente un beneficio AGING durante la misma semana calendario. El beneficio se otorga una vez recibidas las unidades y validado el cumplimiento de estas condiciones. |

## Errores

| Http Code | Message | Solución |
| --- | --- | --- |
| 400 | `invalid_request` | Varía según la regla de validación. Verificar la presencia de headers obligatorios, tipos de datos y el formato de los parámetros. |
| 403 | `access_denied` | Validar la identidad del caller y que el seller pertenezca a los flujos habilitados (3P/M4). |
| 404 | `not_found` | El recurso solicitado no existe, no posee recomendaciones o no está vinculado al seller. |
| 429 | `too_many_requests` | Se excedió el límite de solicitudes. |
| 500 | `internal_error` | Falla crítica en el procesamiento de la solicitud. |
| 503 | `service_unavailable` | El servicio de autenticación o de usuarios no se encuentra disponible. |

## Consideraciones

- La recomendación de reposición es una sugerencia generada por Mercado Libre.

- El seller conserva la decisión sobre las unidades que desea enviar a Full. La cantidad finalmente admitida está sujeta a las validaciones operativas y de capacidad aplicables.

- La consulta de una recomendación no reserva espacio ni capacidad de almacenamiento en Full.

- La recomendación puede cambiar entre consultas debido a variaciones en el stock, las ventas y las proyecciones utilizadas para la planificación.

- Los valores informados corresponden al estado disponible al momento de realizar la consulta.

- La presencia de un valor en `eligibility_benefits` indica que el producto es elegible para el beneficio correspondiente. La presencia del valor no implica que el beneficio haya sido otorgado.

- Una respuesta `206 Partial Content` contiene información utilizable, pero uno o más contenidos complementarios pueden estar incompletos. Los contenidos afectados se identifican mediante el header `X-Content-Missing`.

- Ante una respuesta 206, el integrador puede utilizar la información disponible y volver a consultar el recurso posteriormente.
