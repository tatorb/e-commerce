<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/pharma-recetados -->
<!-- Sección: Guía para productos > Pharma -->

# Pharma - Recetados

Última actualización 03/11/2026

## Pharma - Medicamentos Recetados

Esta documentación cubre los endpoints disponibles para la gestión de recetas médicas en pedidos Pharma de Mercado Libre.

Para vender medicamentos que requieren receta médica, Mercado Libre solicitará al comprador que adjunte la receta antes de finalizar la compra, y al vendedor que la valide antes de imprimir la etiqueta y enviar el pedido. La validación es un paso obligatorio para el vendedor, quien puede aceptar la receta y procesar el pedido, o rechazarla indicando el motivo. En caso de rechazo, la order cuya receta fue rechazada se cancelará sin afectar la reputación del vendedor. Finalmente, es responsabilidad del vendedor descargar y almacenar las recetas en sus sistemas para su propio control. Mercado Libre elimina las recetas aprobadas después de 2 meses; transcurrido este plazo, los archivos ya no estarán disponibles para su descarga.

## Flujo de validación de recetas en orders Pharma

El flujo de validación de recetas sigue tres etapas:

1. Identificar las orders de **pharma**  a partir de notificaciones de orders.

2. Verificar, mediante la API de items, si el item de la order requiere receta médica.

3. Continuar con la validación de las recetas a través de los endpoints descritos en las próximas secciones.

## Identificar orders Pharma

Filtre las orders recibidas en el tópico de **orders**  a través de las notificaciones para identificar los pedidos de tipo Pharma.

### Identificación actual

Una order se considera Pharma cuando posee **static_tags**  con el valor **"pharma"** .

### Próxima actualización

Hay una migración en curso: en los próximos meses dejaremos de utilizar **static_tags = "pharma"**  y la identificación de orders Pharma pasará a realizarse únicamente mediante **flow.pharma** .

**Importante:**

Recomendación durante la migración: considere la order como Pharma si en **static_tags**  hay **"pharma"**  OR en **flows**  hay **"pharma"** .

Comparación entre la estructura actual y la nueva:

| **Estructura actual** | **Nueva estructura** |
| --- | --- |
| `{ "id": 000000, "status": "paid", "tags": ["d2c", "pack_order", "catalog", "pharma", "paid", "delivered"], "static_tags": ["pharma"], "context": { "channel": "marketplace", "site": "MLM", "flows": ["catalog"] }, "order_items": [{ "item": { "id": "MLM3659122650", "title": "Cutaclin Gel 1 %" }, "quantity": 1 }] }` | `{ "id": 000000, "status": "paid", "tags": ["d2c", "pack_order", "catalog", "paid", "delivered"], "static_tags": [], "context": { "channel": "marketplace", "site": "MLM", "flows": ["catalog", "pharma"] }, "order_items": [{ "item": { "id": "MLM3659122650", "title": "Cutaclin Gel 1 %" }, "quantity": 1 }] }` |

## Verificar si el item requiere receta médica

Para cada order Pharma, consulte la API de **items**  correspondiente al item de la order. Dentro del array **attributes**  del payload, busque el atributo con id **"IS_ELIGIBLE_FOR_PRESCRIPTION"** . El item requiere receta médica cuando este atributo esté presente con **value_id**  igual a **"242085"**  (value_name = "Sí").

Ejemplo del atributo relevante en el payload de **/items** :

```
"attributes": [
  {
    "id": "IS_ELIGIBLE_FOR_PRESCRIPTION",
    "name": "Es elegible para receta",
    "value_id": "242085",
    "value_name": "Sí",
    "value_type": "boolean",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  }
]
```

Nota:

Si el atributo **IS_ELIGIBLE_FOR_PRESCRIPTION**  no está presente o tiene un **value_id**  diferente de "242085", el pedido no requiere validación de receta.

## Validar la receta médica

Una vez confirmado que el item requiere receta, utilice los endpoints documentados en las secciones siguientes para completar el flujo de validación, comenzando por el listado de recetas pendientes.

## Sellers con sucursales

La API soporta dos tipos de seller:

- **Seller sin sucursales**  → opera con una única tienda. El alcance de la solicitud se identifica únicamente por el **seller_id** .

- **Seller con sucursales**  → opera con múltiples tiendas, cada una identificada por un **store_id** . El alcance se identifica por el par (**seller_id** , **store_id** ).

El campo **store_id**  es opcional en todos los endpoints (list, accept, reject, download y bulk download). Su presencia o ausencia indica el conjunto de recetas que se desea consultar o gestionar:

- **Sin store_id**  → opera sobre recetas de sellers sin sucursales.

- **Con store_id**  → opera sobre recetas de la sucursal indicada.

**Atención:**

Para sellers con sucursales, el **store_id**  es obligatorio cuando esté disponible en el response de **/orders** . Si la solicitud se envía sin **store_id**  en ese caso, fallará. En pedidos donde el **store_id**  no es retornado (modalidad Turbo), el alcance se identifica únicamente por **seller_id** .

Los dos conjuntos están **aislados** : no se mezclan en un mismo resultado y no pueden ser accedidos de forma cruzada.

### Cómo obtener el store_id

El **store_id**  se obtiene del response del endpoint **/orders** . Cuando el pedido proviene de un seller con múltiples sucursales, el response incluye el campo **stock.store_id** .

**Atención:**

En pedidos Turbo (aunque el seller tenga sucursales), el response de **/orders**  no retorna el **store_id** , y el alcance se identifica únicamente por **seller_id** .

- **Seller con sucursales**  → response incluye **stock.store_id** . El alcance se identifica por el par (**seller_id** , **store_id** ).

- **Seller con sucursales (pedidos Turbo)**  → response sin **store_id** . El alcance se identifica únicamente por **seller_id** .

### Reglas para accept, reject y download

| **Escenario** | **store_id en la solicitud** | **Resultado** |
| --- | --- | --- |
| Seller **sin**  sucursales | omitido | 200 — operación permitida |
| Seller **con**  sucursales | omitido | 403 Forbidden |
| Seller **con**  sucursales, pedido **Turbo** | omitido (no disponible en /orders) | 200 — operación permitida |
| Seller **con**  sucursales, store_id correcto | igual al de la sucursal | 200 — operación permitida |
| Seller **con**  sucursales, store_id diferente | diferente al de la sucursal | 403 Forbidden |
| Seller **con**  sucursales | omitido | 403 Forbidden |

### Reglas para el listado

- **Con store_id**  → retorna únicamente recetas de la sucursal indicada.

- **Sin store_id**  → retorna únicamente recetas de sellers sin sucursales.

En ningún escenario la respuesta mezcla ambos conjuntos. Enviar **store_id**  para un seller sin sucursales, u omitirlo para un seller con sucursales, retorna **403 Forbidden** .

## Endpoints

En todos los endpoints, el path param **{flow}**  debe ser **prescription** .

### 1. Listar recetas pendientes

```
curl -L -X GET \
https://api.mercadolibre.com/v1/prescription/attachments \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

Lista las recetas pendientes de validación para el seller. Permite consultar qué pedidos tienen recetas pendientes sin necesidad de conocer los **order_ids**  previamente.

### Parámetros de query

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `store_id` | string | No | Identificador de la sucursal. Obligatorio para sellers con múltiples sucursales. Cuando se omite, retorna únicamente recetas de pedidos sin sucursal. |
| `order_id` | string | No | Filtra por un pedido específico |
| `status` | string | No (default: WAITING_VALIDATION) | Filtra por status de la receta. Ver tabla de valores permitidos. |
| `page` | integer | No (default: 1) |  |
| `per_page` | integer | No (default: 20, máx: 100) |  |
| `created_after` | string | No | Filtra registros creados después de la fecha indicada |
| `sort` | string | No (default: created_at:asc) | Valores: `created_at:asc`, `created_at:desc` |

| **Valores del parámetro status** | **Descripción** |
| --- | --- |
| `WAITING_VALIDATION` | Receta pendiente de validación. |
| `ACCEPTED` | Receta aceptada. |
| `REJECTED` | Las recetas rechazadas permanecen disponibles durante el período de retención aplicable. Tras la eliminación física del archivo, la descarga individual retorna `410 Gone` y la descarga masiva informa `attachment_purged` en el `manifest.json`. |

**Ejemplo de request:**

```
curl -L -X GET \
https://api.mercadolibre.com/v1/prescription/attachments?store_id=12345678&page=1&per_page=20 \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer APP_USR-123467899999.....'
```

### Response

| **Status** | **Descripción** | **Respuesta** |
| --- | --- | --- |
| 200 | Éxito | `{ "data": [ { "order_id": "2000012345678", "store_id": "12345678", "status": "WAITING_VALIDATION", "item_id": "MLB43243243", "attachment_id": "MLM_112233466_0123ab3430000.pdf", "flow": "prescription", "created_at": "2026-04-20T14:00:00Z", "attachment_downloaded_at": null } ], "paging": { "total": 42, "page": 1, "per_page": 20 } }` Una lista vacía retorna 200 con `"data": []` y `"paging.total": 0`. |
| 200 | Éxito — filtro REJECTED | `{ "data": [ { "order_id": "2000012345678", "store_id": "12345678", "status": "REJECTED", "rejection_reason": "seller_reject_file_invalid", "item_id": "MLB43243243", "attachment_id": "MLM_11234569_012345.pdf", "flow": "prescription", "created_at": "2026-04-20T14:00:00Z", "attachment_downloaded_at": null } ], "paging": { "total": 42, "page": 1, "per_page": 20 } }` |
| 400 | Bad Request | `{ "code": "bad_request", "message": "attachment_id: is required", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "attachment_id", "reason": "is required" }] }` `{ "code": "bad_request", "message": "status: must be one of ACCEPTED, REJECTED, WAITING_VALIDATION", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "status", "reason": "must be one of ACCEPTED, REJECTED, WAITING_VALIDATION" }] }` `{ "code": "bad_request", "message": "invalid page", "error_code": "ERROR_RX_INTEGRATOR_013" }` `{ "code": "bad_request", "message": "flow: must be a supported flow (prescription)", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "flow", "reason": "must be a supported flow (prescription)" }] }` |
| 401 | No autorizado. Token ausente o inválido. | `{ "blocked_by": "OfficeSec", "code": "null", "message": "", "status": 401 }` `{ "blocked_by": "OfficeSec", "code": "null", "message": "token is expired", "status": 401 }` |
| 429 | Rate limit excedido | `{ "code": "too_many_requests", "message": "rate limit exceeded for client" }` |
| 500 | Error interno | `{ "code": "internal_server_error", "message": "failed to list attachments", "error_code": "ERROR_RX_INTEGRATOR_905" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_999" }` |

| **Motivos de rechazo (rejection_reason)** | **Descripción** |
| --- | --- |
| `seller_reject_file_expired` | Receta vencida |
| `seller_reject_file_invalid_product` | El medicamento no corresponde al item del pedido |
| `seller_reject_file_quantity` | La cantidad no coincide con el pedido |
| `seller_reject_file_data` | Datos del médico inválidos |
| `seller_reject_file_already_used` | Receta ya utilizada en otro pedido |
| `seller_reject_file_invalid` | El archivo no es una receta o es ilegible |

### 2. Descargar receta

```
curl -L -X GET \
https://api.mercadolibre.com/v1/prescription/attachment/download \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

Descarga una receta específica mediante su **attachment_id** . Esta llamada registra la descarga del archivo, lo que es un requisito previo para poder aceptar o rechazar la receta.

Descarga individual por order:

El parámetro

`order_id`

es opcional. Envíelo cuando el mismo

`attachment_id`

esté asociado a más de una order: la descarga y la marcación de

`attachment_downloaded_at`

se realizarán solo para la relación indicada.

Sin

`order_id`

, el contrato legado continúa funcionando cuando el attachment tiene una única relación en el flow

`prescription`

. Si hay múltiples relaciones en ese flow, la respuesta será HTTP

`409`

(

`order_id_required`

,

`ERROR_RX_INTEGRATOR_017`

): el PDF no será retornado y ninguna descarga será marcada.

**Ejemplo con order_id:**

```
GET /v1/prescription/attachment/download?attachment_id=<ATTACHMENT_ID>&order_id=<ORDER_ID>&store_id=<STORE_ID>
```

### Parámetros de query

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `attachment_id` | string | Sí | Identificador de la receta a descargar |
| `order_id` | string | No | Identificador de la order para descargar y marcar solo esa relación. |
| `store_id` | string | No | Identificador de la sucursal. Obligatorio para sellers con múltiples sucursales. |
| `status` | string | No | Acepta un único valor: `WAITING_VALIDATION`, `ACCEPTED` o `REJECTED`. Cuando se informa, filtra exactamente por el status indicado. Sin `status`, no se filtra por status y se consideran los tres estados. |

**Ejemplo de request:**

```
curl -L -X GET \
https://api.mercadolibre.com/v1/prescription/attachment/download?attachment_id=MLM_112233466_0123ab3430000.pdf&store_id=12345 \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer APP_USR-123467899999.....'
```

#### Response

| **Status** | **Descripción** | **Respuesta** |
| --- | --- | --- |
| 200 | Éxito | Retorna el contenido binario de la receta (PDF). Para una receta en `WAITING_VALIDATION`, habilita las operaciones de accept/reject para este **attachment_id** . Para una receta en `REJECTED`, solo recupera el archivo: no habilita accept/reject ni cambia el estado de la receta. |
| 400 | Bad Request | `{ "code": "bad_request", "message": "attachment_id: is required", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "attachment_id", "reason": "is required" }] }` |
| 401 | No autorizado. Token ausente o inválido. | `{ "blocked_by": "OfficeSec", "code": "null", "message": "", "status": 401 }` `{ "blocked_by": "OfficeSec", "code": "null", "message": "token is expired", "status": 401 }` |
| 403 | Forbidden. El store_id no coincide con el del attachment. | `{ "code": "forbidden", "message": "attachment_store_mismatch", "error_code": "ERROR_RX_INTEGRATOR_002" }` |
| 404 | Receta no encontrada | `{ "code": "not_found", "message": "attachment_not_found", "error_code": "ERROR_RX_INTEGRATOR_001" }` |
| 409 | Attachment asociado a múltiples orders; informe `order_id`. | `{ "code": "conflict", "message": "order_id_required", "error_code": "ERROR_RX_INTEGRATOR_017" }` |
| 410 | El archivo de la receta fue eliminado y ya no está disponible para descargar; el registro de la receta puede seguir existiendo. | `{ "code": "gone", "message": "attachment_gone", "error_code": "ERROR_RX_INTEGRATOR_019" }` |
| 429 | Rate limit excedido | `{ "code": "too_many_requests", "message": "rate limit exceeded for client" }` |
| 500 | Error interno | `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_900" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_901" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_907" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_999" }` |

### 3. Aceptar receta

```
curl -L -X POST \
https://api.mercadolibre.com/v1/prescription/attachment/accept \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer' \
--data '{
  "attachment_id": "$ATTACHMENT_ID",
  "store_id": "$STORE_ID"
}'
```

Acepta una receta específica mediante su **attachment_id** . Requiere que la receta haya sido descargada previamente y que su status sea **WAITING_VALIDATION** .

Aceptar por order_id:

El campo

`order_id`

es opcional en el body. Cuando se envía, la decisión se aplica a la relación exacta entre

`attachment_id`

y

`order_id`

; el

`store_id`

continúa limitando el alcance de la sucursal.

Sin

`order_id`

, la compatibilidad legada se mantiene si hay una única relación en el flow

`prescription`

. Si hay más de una relación, la respuesta será HTTP

`409`

con

`order_id_required`

(

`ERROR_RX_INTEGRATOR_017`

), sin modificar el status ni cancelar la order. Se consideran todas las relaciones del attachment en ese flow, incluso las terminales; las relaciones de otros flows no entran en la ambigüedad.

**Ejemplo de body:**

```
{
  "attachment_id": "<ATTACHMENT_ID>",
  "order_id": "<ORDER_ID>",
  "store_id": "<STORE_ID>"
}
```

#### Parámetros del body

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `attachment_id` | string | Sí | Identificador de la receta a aceptar |
| `order_id` | string | No | Order cuya relación con el attachment será aceptada. |
| `store_id` | string | No | Identificador de la sucursal. Obligatorio para sellers con múltiples sucursales. Enviar `store_id` para un seller sin sucursales retorna 403. |

**Ejemplo de request:**

```
curl --location 'https://api.mercadolibre.com/v1/prescription/attachment/accept' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer APP_USR-123467899999.....' \
--data '{
  "attachment_id": "MLM_112233466_0123ab3430000.pdf",
  "store_id": "123456789"
}
'
```

#### Response

| **Status** | **Descripción** | **Respuesta** |
| --- | --- | --- |
| 200 | Éxito | `{ "attachment_id": "MLM_112233466_0123ab3430000.pdf", "order_id": "2000012345678", "status": "ACCEPTED", "updated_at": "2026-04-21T10:30:00Z" }` |
| 400 | JSON inválido en el body | `{ "code": "bad_request", "message": "invalid request body", "error_code": "ERROR_RX_INTEGRATOR_013" }` |
| 400 | Error de validación | `{ "code": "bad_request", "message": "attachment_id: is required", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "attachment_id", "reason": "is required" }] }` |
| 401 | No autorizado. Token ausente o inválido. | `{ "blocked_by": "OfficeSec", "code": "null", "message": "", "status": 401 }` |
| 403 | Forbidden. El store_id no coincide. | `{ "code": "forbidden", "message": "attachment_store_mismatch", "error_code": "ERROR_RX_INTEGRATOR_002" }` |
| 404 | Receta no encontrada | `{ "code": "not_found", "message": "attachment_not_found", "error_code": "ERROR_RX_INTEGRATOR_001" }` |
| 409 | Attachment asociado a múltiples orders; informe `order_id`. | `{ "code": "conflict", "message": "order_id_required", "error_code": "ERROR_RX_INTEGRATOR_017" }` |
| 422 | Receta no descargada previamente | `{ "code": "unprocessable_entity", "message": "attachment_not_downloaded", "error_code": "ERROR_RX_INTEGRATOR_003" }` |
| 422 | Receta ya aceptada | `{ "code": "unprocessable_entity", "message": "attachment_already_accepted", "error_code": "ERROR_RX_INTEGRATOR_004" }` |
| 422 | Receta ya rechazada | `{ "code": "unprocessable_entity", "message": "attachment_already_rejected", "error_code": "ERROR_RX_INTEGRATOR_005" }` |
| 422 | Receta no está en estado WAITING_VALIDATION | `{ "code": "unprocessable_entity", "message": "attachment_not_waiting_validation", "error_code": "ERROR_RX_INTEGRATOR_006" }` |
| 429 | Rate limit excedido | `{ "code": "too_many_requests", "message": "rate limit exceeded for client" }` |
| 500 | Error interno | `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_902" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_903" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_999" }` |

### 4. Rechazar receta

```
curl -L -X POST \
https://api.mercadolibre.com/v1/prescription/attachment/reject \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer' \
--data '{
  "attachment_id": "$ATTACHMENT_ID",
  "store_id": "$STORE_ID",
  "reason": "$REASON"
}'
```

Rechaza una receta. Requiere que la receta haya sido descargada previamente y que se indique un motivo de rechazo válido.

Rechazar por order_id:

El campo

`order_id`

es opcional en el body. Cuando se envía, la decisión se aplica a la relación exacta entre

`attachment_id`

y

`order_id`

; el

`store_id`

continúa limitando el alcance de la sucursal. En compras agrupadas, incluso con

`order_id`

informado, la cancelación puede limitarse a la order indicada o alcanzar a todo el pack, incluidas otras orders con receta aceptada o de ítems que no requieren receta. El resultado depende de la proporción entre el valor afectado y el valor total de la compra y de la configuración aplicada a la compra.

Sin

`order_id`

, la compatibilidad legada se mantiene si hay una única relación en el flow

`prescription`

. Si hay más de una relación, la respuesta será HTTP

`409`

con

`order_id_required`

(

`ERROR_RX_INTEGRATOR_017`

), sin modificar el status ni cancelar la order. Se consideran todas las relaciones del attachment en ese flow, incluso las terminales; las relaciones de otros flows no entran en la ambigüedad.

**Ejemplo de body:**

```
{
  "attachment_id": "<ATTACHMENT_ID>",
  "order_id": "<ORDER_ID>",
  "store_id": "<STORE_ID>",
  "reason": "<REASON>"
}
```

#### Parámetros del body

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `attachment_id` | string | Sí | Identificador de la receta a rechazar |
| `order_id` | string | No | Order cuya relación con el attachment será rechazada. |
| `reason` | string | Sí | Motivo de rechazo. Ver tabla de valores permitidos. |
| `store_id` | string | No | Identificador de la sucursal. Obligatorio para sellers con múltiples sucursales. Enviar `store_id` para un seller sin sucursales retorna 403. |

| **Valores del parámetro reason** | **Descripción** |
| --- | --- |
| `seller_reject_file_expired` | Receta vencida |
| `seller_reject_file_invalid_product` | El medicamento no corresponde al item del pedido |
| `seller_reject_file_quantity` | La cantidad no coincide con el pedido |
| `seller_reject_file_data` | Datos del médico inválidos |
| `seller_reject_file_already_used` | Receta ya utilizada en otro pedido |
| `seller_reject_file_invalid` | El archivo no es una receta o es ilegible |

**Ejemplo de request:**

```
curl -L -X POST \
https://api.mercadolibre.com/v1/prescription/attachment/reject \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer APP_USR-123467899999.....' \
--data '{
  "attachment_id": "MLA_423423_4324324ad325.pdf",
  "store_id": "123456789",
  "reason": "seller_reject_file_expired"
}'
```

#### Response

| **Status** | **Descripción** | **Respuesta** |
| --- | --- | --- |
| 200 | Éxito | `{ "attachment_id": "MLA_423423_4324324ad325.pdf", "order_id": "2000012345678", "status": "REJECTED", "reason": "seller_reject_file_expired", "updated_at": "2026-04-21T11:00:00Z" }` |
| 400 | Motivo de rechazo inválido | `{ "code": "bad_request", "message": "invalid_reject_reason", "error_code": "ERROR_RX_INTEGRATOR_010" }` |
| 400 | JSON inválido en el body | `{ "code": "bad_request", "message": "invalid_json_body", "error_code": "ERROR_RX_INTEGRATOR_013" }` |
| 401 | No autorizado. Token ausente o inválido. | `{ "blocked_by": "OfficeSec", "code": "null", "message": "", "status": 401 }` |
| 403 | Forbidden. El store_id no coincide. | `{ "code": "forbidden", "message": "attachment_store_mismatch", "error_code": "ERROR_RX_INTEGRATOR_002" }` |
| 404 | Receta no encontrada | `{ "code": "not_found", "message": "attachment_not_found", "error_code": "ERROR_RX_INTEGRATOR_001" }` |
| 404 | Pedido no encontrado | `{ "code": "not_found", "message": "order_not_found", "error_code": "ERROR_RX_INTEGRATOR_009" }` |
| 409 | Attachment asociado a múltiples orders; informe `order_id`. | `{ "code": "conflict", "message": "order_id_required", "error_code": "ERROR_RX_INTEGRATOR_017" }` |
| 422 | Receta no descargada previamente | `{ "code": "unprocessable_entity", "message": "attachment_not_downloaded", "error_code": "ERROR_RX_INTEGRATOR_003" }` |
| 422 | Receta ya aceptada | `{ "code": "unprocessable_entity", "message": "attachment_already_accepted", "error_code": "ERROR_RX_INTEGRATOR_004" }` |
| 422 | Receta ya rechazada | `{ "code": "unprocessable_entity", "message": "attachment_already_rejected", "error_code": "ERROR_RX_INTEGRATOR_005" }` |
| 422 | Receta no está en estado WAITING_VALIDATION | `{ "code": "unprocessable_entity", "message": "attachment_not_waiting_validation", "error_code": "ERROR_RX_INTEGRATOR_006" }` |
| 422 | Saldo insuficiente del seller | `{ "code": "unprocessable_entity", "message": "insufficient_seller_balance", "error_code": "ERROR_RX_INTEGRATOR_011" }` |
| 429 | Rate limit excedido | `{ "code": "too_many_requests", "message": "rate limit exceeded for client" }` |
| 500 | Error interno | `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_902" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_903" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_904" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_999" }` |

### 5. Descarga masiva de recetas

```
curl -L -X POST \
https://api.mercadolibre.com/v1/prescription/attachments/download \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer' \
--data '{
  "attachment_ids": [
    $ATTACHMENT_ID_1,
    $ATTACHMENT_ID_2,
    $ATTACHMENT_ID_3,
  ],
  "store_id": "$STORE_ID"
}
'
```

Descarga múltiples recetas en una única llamada. Retorna un archivo ZIP con todos los PDFs solicitados.

#### Parámetros del body

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `attachment_ids` | array<string> (máx: 50) | Condicional | Contrato legado. Envíe este campo o `attachments`, nunca ambos. |
| `attachments` | array<object> (máx: 50 pares únicos) | Condicional | Pares con `attachment_id` y `order_id` para alcance por order. Exclusivo con `attachment_ids`. |
| `store_id` | string | No | Identificador de la sucursal |
| `status` | string | No (default: WAITING_VALIDATION) | Valores: `WAITING_VALIDATION`, `ACCEPTED`, `REJECTED` |

**Ejemplo de request:**

```
curl -L -X POST \
https://api.mercadolibre.com/v1/prescription/attachments/download \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer APP_USR-123467899999.....' \
--data '{
  "attachment_ids": [
    "MLM_112233466_0123ab3430001.pdf",
    "MLM_112233466_0123ab3430002.pdf",
    "MLM_112233466_0123ab3430003.pdf"
  ],
  "store_id": "123456789",
  "status": "REJECTED"
}
'
```

Descarga masiva por order y compatibilidad:

El contrato legado

`attachment_ids`

continúa disponible. Para alcance por order, utilice

`attachments`

, una lista de pares

`{ attachment_id, order_id }`

. Envíe exactamente uno de los campos; si envía ambos o ninguno, la solicitud es rechazada con HTTP

`400`

.

Si una entrada legada sin

`order_id`

es ambigua, es decir, si el mismo

`attachment_id`

está asociado a múltiples orders (como puede ocurrir en carritos con varios ítems recetados), aparece en

`failed`

con

`reason: "order_id_required"`

. Ninguna relación ambigua es marcada. Las demás entradas válidas continúan procesándose y la respuesta es HTTP

`207`

con ZIP y

`manifest.json`

.

**Ejemplo con alcance por order:**

```
{
  "attachments": [
    { "attachment_id": "<SHARED_ATTACHMENT_ID>", "order_id": "<ORDER_X>" },
    { "attachment_id": "<SHARED_ATTACHMENT_ID>", "order_id": "<ORDER_Y>" }
  ],
  "store_id": "<STORE_ID>",
  "status": "WAITING_VALIDATION"
}
```

**Ejemplo de falla con alcance por order en el manifest.json:**

```
{
  "successful": ["<ATTACHMENT_ID>"],
  "failed": [{ "attachment_id": "<ATTACHMENT_ID>", "order_id": "<ORDER_Y>", "reason": "fetch_error" }]
}
```

**Ejemplo de falla legada ambigua en el manifest.json:**

```
{
  "successful": ["<OTHER_ATTACHMENT_ID>"],
  "failed": [{ "attachment_id": "<SHARED_ATTACHMENT_ID>", "reason": "order_id_required" }]
}
```

#### Response

| **Status** | **Descripción** | **Respuesta** |
| --- | --- | --- |
| 200 | Éxito. Retorna un archivo ZIP con todas las recetas solicitadas. | `HTTP/1.1 200 OK Content-Type: application/zip Content-Disposition: attachment; filename="ATTACHMENTS-2026-05-12.zip" Content-Length: <bytes> <ZIP body> \|-- MLM_112233466_0123ab3430001.pdf \|-- MLM_112233466_0123ab3430002.pdf \|-- MLM_112233466_0123ab3430003.pdf` |
| 207 | Éxito parcial. El ZIP incluye las recetas disponibles y un `manifest.json` con el detalle de las que no pudieron descargarse. Si un archivo fue eliminado, los demás adjuntos continúan procesándose. | `HTTP/1.1 207 OK Content-Type: application/zip Content-Disposition: attachment; filename="ATTACHMENTS-2026-05-12.zip" <ZIP body> \|-- MLM_112233466_0123ab3430001.pdf \|-- MLM_112233466_0123ab3430002.pdf \|-- manifest.json` **Contenido del manifest.json:**  `{ "successful": ["MLM_112233466_0123ab3430001.pdf", "MLM_112233466_0123ab3430002.pdf"], "failed": [ { "attachment_id": "MLM_112233466_0123ab3430003.pdf", "reason": "attachment_purged" } ] }` |
| 400 | Bad Request | `{ "code": "bad_request", "message": "seller_id: is required", "error_code": "ERROR_RX_INTEGRATOR_012", "errors": [{ "field": "seller_id", "reason": "is required" }] }` `{ "code": "bad_request", "message": "attachment_ids exceeds maximum allowed limit: max 50, got 61", "error_code": "ERROR_RX_INTEGRATOR_007" }` `{ "code": "bad_request", "message": "attachment archive exceeds maximum allowed size", "error_code": "ERROR_RX_INTEGRATOR_008" }` `{ "code": "bad_request", "message": "invalid request body", "error_code": "ERROR_RX_INTEGRATOR_013" }` |
| 401 | No autorizado. Token ausente o inválido. | `{ "blocked_by": "OfficeSec", "code": "null", "message": "", "status": 401 }` |
| 429 | Rate limit excedido | `{ "code": "too_many_requests", "message": "rate limit exceeded for client" }` |
| 500 | Error interno | `{ "code": "internal_server_error", "message": "failed to build attachment archive", "error_code": "ERROR_RX_INTEGRATOR_906" }` `{ "code": "internal_server_error", "message": "internal error", "error_code": "ERROR_RX_INTEGRATOR_999" }` |

| **Motivos de error en el manifest.json** | **Descripción** |
| --- | --- |
| `omitted` | El attachment fue excluido porque no pertenece al seller, el `store_id` no coincide, o el status no corresponde al filtro aplicado. |
| `fetch_error` | Error al recuperar el archivo de la receta. |
| `attachment_purged` | El archivo de la receta fue eliminado y ya no está disponible para descargar. Los demás adjuntos continúan procesándose. |
| `file_too_large` | El archivo excede el tamaño máximo permitido por ítem. |
| `order_id_required` | La entrada legada (sin `order_id`) es ambigua: el mismo `attachment_id` está asociado a múltiples orders. Reenvíe usando `attachments` con `order_id`. |

## Errores

Todos los endpoints retornan un body JSON estructurado en respuestas no-2xx. El campo **error_code**  utiliza el formato **ERROR_RX_INTEGRATOR_NNN** .

**Estructura:**

```
{
  "code":       "bad_request",
  "message":    "attachment_not_found",
  "error_code": "ERROR_RX_INTEGRATOR_001",
  "errors": [
    { "field": "attachment_id", "reason": "is required" }
  ]
}
```

- **code**  — texto del status HTTP en snake_case (siempre presente)

- **message**  — clave legible del error (siempre presente)

- **error_code**  — código catalogado (siempre presente en errores)

- **errors[]**  — detalle por campo (presente únicamente en respuestas **ERROR_RX_INTEGRATOR_012** )

### 4xx — Reglas de negocio, autorización e input

| **Código** | **error_code** | **HTTP** | **message** | **Causa** |
| --- | --- | --- | --- | --- |
| 001 | `ERROR_RX_INTEGRATOR_001` | 404 | `attachment_not_found` | El attachment_id no existe o pertenece a otro seller/sucursal. |
| 002 | `ERROR_RX_INTEGRATOR_002` | 403 | `attachment_store_mismatch` | El store_id de la solicitud no coincide con el del attachment. |
| 003 | `ERROR_RX_INTEGRATOR_003` | 422 | `attachment_not_downloaded` | Se intentó aceptar o rechazar una receta que no fue descargada previamente. |
| 004 | `ERROR_RX_INTEGRATOR_004` | 422 | `attachment_already_accepted` | El attachment ya está en estado ACCEPTED. |
| 005 | `ERROR_RX_INTEGRATOR_005` | 422 | `attachment_already_rejected` | El attachment ya está en estado REJECTED. |
| 006 | `ERROR_RX_INTEGRATOR_006` | 422 | `attachment_not_waiting_validation` | El attachment no está en estado WAITING_VALIDATION. |
| 007 | `ERROR_RX_INTEGRATOR_007` | 400 | (dinámico, incluye el límite) | Se solicitaron más de 50 attachment_ids en un bulk download. |
| 008 | `ERROR_RX_INTEGRATOR_008` | 400 | `attachment archive exceeds maximum allowed size` | El archivo ZIP generado excede el tamaño máximo permitido. |
| 009 | `ERROR_RX_INTEGRATOR_009` | 404 | `order_not_found` | El pedido asociado al attachment no fue encontrado. |
| 010 | `ERROR_RX_INTEGRATOR_010` | 400 | `invalid_reject_reason` | El motivo de rechazo no es uno de los valores permitidos. |
| 011 | `ERROR_RX_INTEGRATOR_011` | 422 | `insufficient_seller_balance` | El seller no tiene saldo suficiente para completar la operación. |
| 012 | `ERROR_RX_INTEGRATOR_012` | 400 | (join de mensajes de campo) | Uno o más campos de la solicitud fallaron la validación estructural. El array `errors[]` detalla los campos afectados. |
| 013 | `ERROR_RX_INTEGRATOR_013` | 400 | `invalid request body` | El body de la solicitud no es un JSON válido. El array `errors[]` está ausente. |
| 014 | `ERROR_RX_INTEGRATOR_014` | 403 | `payment_refund_not_authorized` | El reembolso del pedido no pudo procesarse porque el pago del seller no está autorizado para esta operación. Reintentar no resolverá el problema. |
| 015 | `ERROR_RX_INTEGRATOR_015` | 409 | `order_conflict` | El pedido no pudo actualizarse debido a una modificación concurrente. Reintente después de un breve intervalo. |
| 016 | `ERROR_RX_INTEGRATOR_016` | 409 | `order_already_locked` | El pedido está temporalmente bloqueado por otra operación en curso. Reintente después de un breve intervalo. |
| 017 | `ERROR_RX_INTEGRATOR_017` | 409 | `order_id_required` | El attachment está relacionado a múltiples orders en el mismo flow; informe `order_id` para identificar la relación deseada. |
| 019 | `ERROR_RX_INTEGRATOR_019` | 410 | `attachment_gone` | El archivo de la receta fue eliminado y ya no está disponible para descargar; el registro de la receta puede seguir existiendo. |

### 5xx — Errores internos

| **Código** | **error_code** | **HTTP** | **message** | **Causa** |
| --- | --- | --- | --- | --- |
| 900 | `ERROR_RX_INTEGRATOR_900` | 500 | internal error | Error al recuperar el archivo de la receta. |
| 901 | `ERROR_RX_INTEGRATOR_901` | 500 | internal error | Error al registrar la descarga del archivo. |
| 902 | `ERROR_RX_INTEGRATOR_902` | 500 | internal error | El attachment no tiene un pedido asociado. |
| 903 | `ERROR_RX_INTEGRATOR_903` | 500 | internal error | Error inesperado en la consulta de datos. |
| 904 | `ERROR_RX_INTEGRATOR_904` | 500 | internal error | Error de configuración interna del servicio. |
| 905 | `ERROR_RX_INTEGRATOR_905` | 500 | failed to list attachments | Error al procesar el listado de recetas. |
| 906 | `ERROR_RX_INTEGRATOR_906` | 500 | failed to build attachment archive | Error al generar el archivo comprimido en la descarga masiva. |
| 907 | `ERROR_RX_INTEGRATOR_907` | 500 | internal error | Error interno al procesar la descarga. |
| 999 | `ERROR_RX_INTEGRATOR_999` | 500 | internal error | Error interno inesperado. |
