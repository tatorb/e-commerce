<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios > Reclamos -->

# Gestionar reclamos

Última actualización 20/08/2026

## ¿Qué es un reclamo?

Un reclamo es una solicitud formal que los usuarios pueden presentar para expresar insatisfacción o problemas relacionados con un proceso específico. Estos reclamos son esenciales para resolver problemas, garantizar una experiencia positiva para los usuarios y mantener la integridad del servicio. Existen cuatro tipos de reclamos, cada uno asociado a un aspecto diferente de la transacción en la plataforma. A continuación, detallamos los tipos de reclamos posibles:

- **Order**  (Orden): Reclamos generadas a partir de una orden de compra en la plataforma Mercado Libre, como discrepancias en el producto, errores en la cantidad u otros problemas. Esto permite que los usuarios comuniquen insatisfacciones y reciban soluciones adecuadas.

- **Shipment**  (Envío): Reclamos relacionadas con el proceso de entrega, incluyendo retrasos, productos dañados o problemas logísticos. Estas quejas ayudan a resolver rápidamente los problemas, mejorando la experiencia del cliente.

- **Payment**  (Pago): Reclamos sobre pagos realizados a través de la plataforma, incluyendo cobros incorrectos, fallos en el procesamiento o disputas de transacciones. Este mecanismo permite resolver problemas y mejorar la confiabilidad del sistema de pagos.

- **Purchase**  (Compra): Reclamos derivadas de una compra en la plataforma, enfocándose en productos defectuosos o discrepancias en la descripción. Esto facilita una rápida resolución y refuerza la confianza del cliente en la plataforma.

## Notificaciones de reclamos

En la sección "Mis aplicaciones", edita tu aplicación y ve al tema "Post Purchase".

Tenemos 2 opciones de filtros: podrás seleccionar los 2 o solo el que deseas recibir notificaciones.

**[claims](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=evitar%20este%20problema.-,Post%20Purchase,-%3A):**  recibirás notificaciones relacionadas con los reclamos realizados sobre tus ventas.

**[claims_actions](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=evitar%20este%20problema.-,Post%20Purchase,-%3A):**  recibirás notificaciones cuando se ejecute una acción en un reclamo.

Al activar los filtros de reclamo, comenzarás a recibir notificaciones inmediatas siempre que se inicie un reclamo o se produzca alguna acción relacionada. Mantente informado y al tanto de todas las actualizaciones importantes sobre los reclamos. Para más detalles, [consulta la información completa sobre notificaciones](https://developers.mercadolibre.com.ar/productos-recibe-notificaciones/).

## Consultar un reclamo

Para consultar la información sobre un reclamo, incluyendo su estado actual, es necesario consultar el recurso /claims/$CLAIM_ID.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5281510459
```

**Respuesta:**

```
{
    "id": 5256749420,
    "resource_id": 2000007819609432,
    "status": "closed",
    "type": "mediations",
    "stage": "claim",
    "parent_id": null,
    "resource": "order",
    "reason_id": "PDD9549",
    "fulfilled": true,
    "quantity_type": "total",
    "claimed_quantity": 1,
    "claim_version": 2.0,
    "players": [
        {
            "role": "complainant",
            "type": "buyer",
            "user_id": 1325224382,
            "available_actions": []
        },
        {
            "role": "respondent",
            "type": "seller",
            "user_id": 1330467461,
            "available_actions": []
        }
    ],
    "resolution": {
        "reason": "payment_refunded",
        "date_created": "2024-03-21T05:19:22.000-04:00",
        "benefited": [
            "complainant"
        ],
        "closed_by": "respondent",
        "applied_coverage": false
    },
    "site_id": "MLB",
    "date_created": "2024-03-14T08:28:44.000-04:00",
    "last_updated": "2024-03-21T05:19:22.000-04:00",
    "related_entities": []}
```

### Campos de la respuesta:

La respuesta de un GET al recurso /claims/$CLAIM_ID proporcionará los siguientes parámetros:

- **id** : ID del reclamo.

- **resource_id** : ID del recurso sobre el cual se crea el reclamo. Depende del "resource".

- **status** : estado del reclamo. Puede tener dos valores: opened y closed.

- **type** : Tipo de reclamo. Puede asumir uno de los siguientes valores:  **mediations** : reclamo entre comprador y vendedor. **return** : devolución del producto. En este caso, no hay mensajes. Para devoluciones, sigue la documentación de [Gestionar devoluciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones). **fulfillment** : Reclamo entre comprador y Mercado Libre con origen de compra con envío full. **ml_case** : Cancelación de la compra por parte del comprador debido a envío demorado. **cancel_sale** : cancelación de la compra por parte del vendedor. **cancel_purchase** : cancelación de la compra por parte del comprador. **change** : cambios de producto. Indica que se realizará un cambio del producto. **service** : Cancelación de un servicio de órdenes bundle.

- **stage** : Etapa del reclamo. Puede asumir uno de los siguientes valores:  **claim** : etapa del reclamo donde intervienen el comprador y el vendedor. **dispute** : Etapa de mediación donde interviene un representante de Mercado Libre. **recontact** : etapa en que una de las partes entra en contacto después del cierre del reclamo/disputa. **none** : no aplica. **stale** : Etapa del reclamo donde intervienen el comprador y Mercado Libre para reclamos del tipo ml_case.

- **claim_version** : Versión del claim. Ejemplo: claim_version: 1.0; claim_version: 1.5; claim_version: 2.0.

- **claimed_quantity** : Cantidad de ítems asociados al claim.

- **parent_id** : ID de otra reclamo de la cual depende.

- **resource** : identificador del recurso sobre el cual se crea el reclamo. Puede ser:  payment order shipment purchase

- **reason_id** : Razón/motivo por el cual se creó el reclamo. Interfiere directamente con las soluciones que pueden ser propuestas  PNR: Producto No Recibido PDD: Producto Diferente o Defectuoso CS: Compra Cancelada

- **fulfilled** : Indica si el reclamo se inicia por un producto entregado o no. Puede tener dos valores: false | true.

- **quantity_type** : informa si el reclamo es parcial o no  partial: indica que es un reclamo parcial total: indica que es un reclamo completo

- **players** : lista de los actores que participan en el reclamo con sus respectivas acciones y tiempos disponibles.  **role** : rol dentro del reclamo. Puede ser:  complainant: persona que reclama. respondent: persona a quien se reclama. mediator: persona que interviene para ayudar a resolver el problema. purchase: comprador - Mercado Libre.   **type** : rol que la persona ocupa sobre la operación que está siendo reclamada. Puede variar de acuerdo con el recurso.  Payment: comprador o colector. Order: comprador o vendedor. Shipment: receptor o remitente.   **user_id** : ID del usuario en ML que cumple el rol. **available_actions** : lista de acciones que pueden ser ejecutadas por cada una de las partes intervinientes:  **action** : acciones posibles de ser realizadas. Para el vendedor serán:  **send_message_to_complainant** : [enviar mensaje al comprador (con o sin adjuntos).](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo#Crear-mensaje-con-el-archivo-cargado) **send_message_to_mediator** : [enviar mensaje al mediador (con o sin adjuntos).](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo#Crear-mensaje-con-el-archivo-cargado) **recontact**  (no disponible aún): reabrir un reclamo ya cerrado, mediante una interacción, como un mensaje. **refund** : [devolver el dinero del comprador.](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos#Devoluci%C3%B3n-total-del-dinero) **open_dispute** : [iniciar una mediación.](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos#Solicitar-mediaci%C3%B3n) **send_potential_shipping** : [enviar una promesa de envío, una fecha.](https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos?nocache=true#promesa-de-envio) **add_shipping_evidence** : [publicar una evidencia de que el producto fue enviado.](https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos#Cargar-evidencias-de-env%C3%ADos) **send_attachments** : [enviar mensaje con adjuntos.](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo#Responder-mensajes-y-adjuntar-archivos) **allow_return** : [generar etiqueta de devolución.](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos#Devoluci%C3%B3n-del-producto) **allow_return_label** : [generar etiqueta de devolución.](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos#Devoluci%C3%B3n-del-producto) **allow_partial_refund** : [devolución parcial del dinero del comprador para reclamos del tipo PDD.](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos#Reembolso-parcial-de-dinero) **send_tracking_number** : [enviar el número de rastreo de envío (tracking number).](https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos#Cargar-evidencias-de-env%C3%ADos) **return_review** : [realizar la revisión de una devolución, indicando si el producto llegó conforme a lo esperado o no.](https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones#Revision-de-una-devolucion)   **mandatory** : campo del tipo true donde la acción es obligatoria y debe ser cumplida antes del tiempo límite. **due_date** : tiempo límite para realizar la acción.

- **resolution** : forma de resolución del reclamo.  **reason** : forma de resolución del reclamo. Valores posibles:  already_shipped: Producto en camino buyer_claim_opened: Cierre de la devolución por apertura de otra reclamo buyer_dispute_opened: Cierre de la devolución por apertura de otra reclamo en disputa (con mediación de Mercado Libre) charged_back: Cierre por contracargo coverage_decision: Disputa cerrada con cobertura por ML found_missing_parts: Comprador encontró las partes faltantes item_returned: Producto devuelto no_bpp: Cierre sin cobertura por parte de ML not_delivered: Producto no entregado opened_claim_by_mistake: Comprador creó el reclamo por error partial_refunded: Reembolso parcial del pago otorgado al comprador payment_refunded: Pago devuelto al comprador prefered_to_keep_product: Comprador prefirió quedarse con el producto product_delivered: Falla de un representante de Mercado Libre reimbursed: Reembolso rep_resolution: Falla de un representante de Mercado Libre respondent_timeout: Vendedor no responde return_canceled: Devolución cancelada por el comprador return_expired: Devolución vencida sin cambio de estado en el envío seller_asked_to_close_claim: Vendedor pidió al comprador que cerrara el reclamo seller_did_not_help: Comprador logró resolver el problema sin la ayuda del vendedor seller_explained_functions: Vendedor explicó cómo funcionaba el artículo seller_sent_product: Vendedor envió el producto timeout: Cierre por timeout de acción al comprador warehouse_decision: Cierre por demora en la revisión del producto en el Warehouse warehouse_timeout: Cierre por demora en la revisión del producto en el Warehouse worked_out_with_seller: Comprador resolvió con el vendedor fuera de ML low_cost: Cierre porque el costo del envío es mayor que el del producto item_changed: Cierre porque el cambio fue realizado con éxito change_expired: El cambio no fue realizado y el tiempo permitido expiró change_cancelled_buyer: Cierre proactivo de un cambio por el comprador change_cancelled_seller: Cierre proactivo de un cambio por el vendedor change_cancelled_meli: Cierre de un cambio por Meli shipment_not_stopped: Cierre porque el envío no pudo ser detenido cancel_installation: Cancelación de servicio de instalación   **date_created** : Fecha de resolución/cierre del reclamo. **benefited** : Beneficiarios de la resolución. Valores posibles: complainant, respondent. **closed_by** : Actor que cerró el reclamo. Valores posibles: mediator, buyer, seller. **applied_coverage** : Indica si se aplicó cobertura al reclamo. Valores posibles: true, false.

- **site_id** : ID del sitio donde se desarrolla el reclamo.

- **date_created** : Fecha de creación/apertura del reclamo.

- **last_updated** : Fecha de la última actualización sobre el reclamo.

- **related_entities** : Contiene una lista de entidades relacionadas con el reclamo.  **return** : Indica que el reclamo tiene una devolución asignada.

## Detalles de un reclamo

Para acceder a información detallada sobre un reclamo, incluyendo su estado actual, es necesario consultar el recurso /claims/$CLAIM_ID/detail.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/detail
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/detail
```

**Respuesta:**

```
{
    "due_date": "2023-07-19T22:33:00.000-04:00",
    "action_responsible": "mediator",
    "title": "Devolución en mediación con Mercado Libre",
    "description": "Intervinimos para ayudar. Te escribiremos antes del miércoles 19 de julio.",
    "problem": "Nos dijiste que el producto llegó dañado"
}
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/detail proporcionará los siguientes campos:

- **due_date** : Fecha límite para solucionar el reclamo

- **action_responsible** : Responsable de la acción. Valores posibles: seller, buyer, mediator.

- **title** : Título que detalla el estado del reclamo

- **description** : Descripción detallada del estado en que se encuentra el reclamo

- **problem** : Problema por el cual se generó el reclamo

## Buscar reclamos

La búsqueda de reclamos proporciona una visión completa de todos los reclamos asociados a un vendedor específico. Esta herramienta ayuda a monitorear y gestionar las incidencias reportadas.

### Parámetros:

Puedes consultar un reclamo realizando una búsqueda en el recurso de reclamos utilizando diversos parámetros:

Parámetro mínimo obligatorio:

El endpoint requiere **al menos uno**  de los parámetros de búsqueda listados a continuación. Los parámetros `offset`, `limit` y `sort` son de paginación/ordenamiento y **no cuentan**  como filtro: siempre deben acompañarse de al menos un filtro real. 

 Si la solicitud solo incluye `offset` y/o `limit`, la API retorna:

```
HTTP 400 Bad Request
{
    "error": "invalid_query",
    "message": "at least any of these filters: id, type, stage, status,
                resource, resource_id, reason_id, site_id,
                players.role, players.user_id,
                order_id, pack_id, payment_id, parent_id,
                date_created, last_updated"
}
```

| Parámetro | Tipo | Dependencias obligatorias | Notas |
| --- | --- | --- | --- |
| `id` | Number | — | ID único del reclamo. |
| `type` | String | — | Tipo de reclamo. Valores: `mediations`, `return`, `fulfillment`, `ml_case`, `cancel_sale`, `cancel_purchase`, `change`, `service`. |
| `stage` | String | — | Etapa del reclamo. Valores: `claim`, `dispute`, `recontact`, `stale`, `none`. |
| `status` | String | — | Estado del reclamo. Valores: `opened`, `closed`. **No usar como único filtro**  (ver advertencia abajo). |
| `resource` | String | Requiere `resource_id` o (`players.role` + `players.user_id`) | Recurso sobre el cual se creó el reclamo. Valores: `shipment`, `payment`, `order`, `purchase`. |
| `resource_id` | Number | Requiere `resource` | ID del recurso sobre el cual se creó el reclamo. |
| `reason_id` | String | — | Razón/motivo por el cual se creó el reclamo. |
| `site_id` | String | — | ID del sitio donde se desarrolla el reclamo. |
| `players.role` | String | Requiere `players.user_id` | Rol del usuario en el reclamo. Valores: `complainant`, `respondent`. |
| `players.user_id` | Number | Requiere `players.role` | ID del usuario interviniente en el reclamo. |
| `order_id` | Number | — | ID del pedido. Mutuamente excluyente con `pack_id`. |
| `pack_id` | Number | — | ID del pack. Mutuamente excluyente con `order_id`. |
| `payment_id` | Number | — | ID del pago. Se convierte internamente a `order_id`. |
| `parent_id` | Number | — | ID de otro reclamo del cual depende. |
| `date_created` | Date | — | Fecha de creación del reclamo. Usar con el parámetro `range`. El horario debe incluir milisegundos, por ejemplo: `2026-03-19T12:31:54.000+00:00`. |
| `last_updated` | Date | — | Fecha de la última actualización del reclamo. Usar con el parámetro `range`. El horario debe incluir milisegundos, por ejemplo: `2026-03-19T12:31:54.000+00:00`. |

### Dependencias obligatorias entre parámetros

Algunos parámetros deben enviarse siempre en conjunto. Si se envía uno sin el otro, la API retorna HTTP 400.

| Si envías… | También debes enviar… |
| --- | --- |
| `resource_id` | `resource` |
| `resource` | `resource_id` o (`players.role` + `players.user_id`) |
| `players.role` | `players.user_id` |
| `players.user_id` | `players.role` |

**Ejemplo de error:**

```
HTTP 400 Bad Request
{
    "error": "invalid_params",
    "message": "Invalid parameters. At least submit some of these filters:
                [resource and resource_id] [players.role and players.user_id]..."
}
```

Nota:

Con el recurso de búsqueda de reclamos, podrás considerar ciertos filtros para obtener resultados más específicos según sea necesario. 

 Al buscar por **pack_id**  y **order_id** , obtendrás todos los reclamos del vendedor relacionados con el ID ingresado. Por ejemplo, al ingresar un **pack_id** , la búsqueda devolverá todos los reclamos vinculados a ese pack a través de sus pedidos, envíos y pagos. De igual manera, al buscar por **order_id** , se mostrarán todos los reclamos asociados a ese pedido específico.

### Otras validaciones obligatorias

Para evitar errores, valida también las siguientes reglas antes de consumir `/v1/claims/search`:

| Regla | Descripción |
| --- | --- |
| `order_id` y `pack_id` | No pueden enviarse simultáneamente en la misma consulta. |
| `offset` + `limit` | La suma debe ser siempre menor que `10000`. Por ejemplo, `offset=9950` y `limit=50` es inválido, ya que la suma es igual a `10000`. |
| Fechas con horario | Deben incluir milisegundos. Formato válido: `2026-03-19T12:31:54.000+00:00`. |

**Ejemplos de solicitudes inválidas (Bad Request):**

```
// resource_id sin resource
{"type":"returns","resource_id":"2000017734643056","offset":"0","limit":"30"}

// resource sin resource_id ni players.role + players.user_id
{"status":"opened","resource":"order","offset":"0","limit":"50"}

// players.role sin players.user_id
{"status":"opened","players.role":"respondent","offset":"0","limit":"30"}

// offset + limit >= 10000
{"status":"closed","offset":"9950","limit":"50","sort":"date_created:desc"}

// Fecha sin milisegundos
range=last_updated:after:2026-03-19T12:31:54+00:00
```

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
"https://api.mercadolibre.com/post-purchase/v1/claims/search?players.user_id=123456789&players.role=respondent&status=opened&limit=30"
```

**Respuesta:**

```
{
   "paging": {
       "total": 316,
       "offset": 0,
       "limit": 30
   },
   "data": [
       {
           "id": 5187110991,
           "resource_id": 2000005489080336,
           "status": "opened",
           "type": "mediations",
           "stage": "dispute",
           "parent_id": null,
           "resource": "order",
           "reason_id": "PDD9528",
           "fulfilled": true,
           "quantity_type": null,
           "players": [
               {
                   "role": "complainant",
                   "type": "buyer",
                   "user_id": 1354382565,
                   "available_actions": []
               },
               {
                   "role": "respondent",
                   "type": "seller",
                   "user_id": 1295357671,
                   "available_actions": [
                       {
                           "action": "send_message_to_mediator",
                           "mandatory": false,
                           "due_date": null
                       }
                   ]
               }
           ],
           "resolution": null,
           "site_id": "MLM",
           "date_created": "2023-04-18T12:06:48.000-04:00",
           "last_updated": "2023-04-18T12:07:25.000-04:00"
       },
       {
           "id": 5173473377,
           "resource_id": 2000005051445424,
           "status": "opened",
           "type": "returns",
           "stage": "dispute",
           "parent_id": null,
           "resource": "order",
           "reason_id": "PDD9502",
           "fulfilled": true,
           "quantity_type": null,
           "players": [
               {
                   "role": "complainant",
                   "type": "buyer",
                   "user_id": 1299347553,
                   "available_actions": []
               },
               {
                   "role": "respondent",
                   "type": "seller",
                   "user_id": 1295357671,
                   "available_actions": [
                       {
                           "action": "send_message_to_mediator",
                           "mandatory": false,
                           "due_date": null
                       }
                   ]
               }
           ],
           "resolution": null,
           "site_id": "MLM",
           "date_created": "2023-02-03T16:25:40.000-04:00",
           "last_updated": "2023-03-13T22:41:49.000-04:00"
       }
…
    ]
}
```

Nota:

1. Tipificación de reclamos: Cada tipificación de reclamos está asociada a un conjunto específico de razones. Para obtener detalles sobre el motivo del inicio de un reclamo, es necesario consultar la API de reasons. 

 2. Tipos de roles dentro del reclamo: Los roles de los players están estrictamente definidos y no pueden ser otros. El player mediator interviene en el claim solo cuando se encuentra en las etapas de disputa o recontact. Cada player puede tener una lista de acciones, pero en el reclamo, solo un player tiene la acción obligatoria en todo el proceso.

### ¿Por qué es mala práctica enviar solo status=opened o filtros generales?

Un filtro como `status=opened` sin ningún acotador adicional (por ejemplo, players.user_id) implica que la consulta escanea un volumen muy alto de reclamos en el motor de búsqueda. Esto genera:

- **Consultas extremadamente costosas**  en el motor de búsqueda — alta latencia y consumo innecesario de recursos.

- **Riesgo de rate limiting**  o bloqueo de la aplicación si el patrón persiste.

- **Resultados difíciles de procesar**  — un volumen muy alto de reclamos sin acotar por usuario, recurso u orden hace que la respuesta sea poco práctica para integrar en flujos de negocio.

Caso reportado:

Consultas solo con paginación (sin ningún filtro) generan error HTTP 400 sistemáticamente. Consultas con solo `status=opened` son técnicamente válidas pero altamente ineficientes.

### Ejemplos de consultas recomendadas

CORRECTO **Buscar reclamos de un usuario específico**

```
GET /v1/claims/search
    ?players.user_id=123456789
    &players.role=respondent
    &status=opened
    &limit=30
    &offset=0
```

Acota la búsqueda al usuario consultado y a su rol. Trae solo reclamos vinculados a ese usuario.

CORRECTO **Buscar reclamos por orden**

```
GET /v1/claims/search
    ?order_id=9876543210
    &limit=30
```

CORRECTO **Buscar reclamos por recurso**

```
GET /v1/claims/search
    ?resource=order
    &resource_id=9876543210
```

CORRECTO **Buscar reclamos en un rango de fechas**

```
GET /v1/claims/search
    ?players.user_id=123456789
    &players.role=respondent
    &range=date_created:after:2024-01-01T00:00:00.000-0300,before:2024-03-01T00:00:00.000-0300
```

### INCORRECTO Consultas que NO deben enviarse

```
# Solo paginación — retorna HTTP 400
GET /v1/claims/search?offset=0&limit=30

# Solo status — consulta no acotada y costosa
GET /v1/claims/search?status=opened

# resource_id sin resource — retorna HTTP 400
GET /v1/claims/search?resource_id=123
```

## Personalizar la búsqueda de reclamos

La búsqueda de reclamos puede generar una amplia variedad de resultados, dependiendo de los parámetros utilizados. Para optimizar este proceso, se ofrecen diversas opciones que mejoran la eficiencia de la búsqueda.

### Parámetros de paginación y ordenamiento:

| Parámetro | Default | Máximo | Notas |
| --- | --- | --- | --- |
| `offset` | 0 | 9999 | Si supera 9999 retorna HTTP 400. |
| `limit` | 30 | 100 | Valores mayores a 100 se ajustan automáticamente a 100. |
| `sort` | — | — | Formato: `campo:asc` o `campo:desc`. |
| `range` | — | — | Búsqueda por intervalo de fechas. Formato: `range=campo:after:fecha,before:fecha`. |

### Resumen: filtros mínimos sugeridos por caso de uso

| Caso de uso | Filtros mínimos sugeridos |
| --- | --- |
| Reclamos de un comprador | `players.user_id` + `players.role=complainant` |
| Reclamos de un vendedor | `players.user_id` + `players.role=respondent` |
| Reclamos de una orden | `order_id` |
| Reclamos de un pago | `payment_id` |
| Reclamos de un ítem/recurso | `resource` + `resource_id` |
| Reclamo específico | `id` |

**Recomendación general:**  incluir siempre `players.user_id` + `players.role` como filtros base cuando se busca por criterios globales (status, type, stage), para acotar la búsqueda al usuario consultado y obtener resultados directamente útiles para el flujo de integración.

## Obtener detalles del motivo por el cual se inició el reclamo

Para obtener detalles sobre el motivo del inicio de un reclamo, se debe consultar el recurso /claims/reasons/$REASON_ID. Este acceso proporciona información detallada y permite el uso de parámetros específicos.

### Parámetros:

| Query params | Type | Values | Detalle value |
| --- | --- | --- | --- |
| flow | string | cancel_sale, distant_agencies, fulfillment_delivered, fulfillment_undelivered, label_unavailable, mediations, mediations_delivered, mediations_undelivered, no_shipping_options, reservation, returns, unification_delivered | Permite obtener reasons PDD o PNR |
| delivered | string | true, false | Permite obtener reasons PDD o PNR |
| deep | boolean | true, false | Permite obtener el árbol de dependencias de la reason consultada |
| name | string | wrong_shipment_cost, wrong_seller_address, wrong_buyer_address, unavailable_pick_up, unknown_buyer, unknown_seller, unknown_shipment_policy, unavailable_incorrect_shipping, shipment_type_not_allowed_daft, unavailable_correct_shipping, unavailable_product, unavailable_payment_method, unavailable_buyer_item_report, alignment_prices_taxes, alignment_discounts, safe_review, safety_notifications, seller_rate_modification, unauthorized_transference, seller_address_not_allowed, return_request_return, represent_buyer_claim, represent_buyer_dispute, alignment_packaging, improper_tracking, improper_package_weight, payment_method_fraud, no_agreed_delivery, not_expected_quality_offer, not_expected_quality_item, wrong_warranty, misleading_promotion, returned_service, finished_return_automatic, finished_return_with_request, return_claim_not_accept, return_claim_accept, return_claim_cancel, return_claim_item_restock, return_claim_item_refurbished, return_claim_item_lost, wrong_pack_service, wrong_pack_service_transport, buyer_return_pack_service, seller_return_pack_service, wrong_pack_service_provider, wrong_pack_service_time, wrong_pack_service_repack, wrong_pack_service_delivery, buyer_dispute_delivery, buyer_dispute_delivery_not_show, buyer_dispute_delivery_not_contact, buyer_dispute_delivery_not_receive, buyer_dispute_delivery_no_show, buyer_dispute_delivery_no_call, wrong_pack_service_failed, buyer_dispute_buyer_claim_delivery, delivery_wrong_seller, delivery_wrong_buyer, delivery_same_state, delivery_same_city, delivery_same_zip_code, delivery_wrong_shipping, delivery_lost, delivery_damaged, delivery_delayed, delivery_wrong_address, delivery_wrong_city, delivery_wrong_state, delivery_wrong_zip_code, delivery_wrong_country, delivery_wrong_date, delivery_wrong_time, delivery_wrong_shipping_service, delivery_wrong_pack_service, wrong_pack_service_full, wrong_pack_service_partial, wrong_pack_service_product_wrong, wrong_pack_service_product_changed, wrong_pack_service_restock, wrong_pack_service_no_restock, wrong_pack_service_refurbished, wrong_pack_service_lost, wrong_pack_service_failed, wrong_pack_service_provider, wrong_pack_service_time, wrong_pack_service_repack, buyer_dispute_buyer_claim_delivery |  |

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/reasons/$REASON_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/reasons/PDD9939
```

**Respuesta:**

```
{
    "id": "PDD9939",
    "flow": "post_purchase_delivered",
    "name": "repentant_buyer",
    "detail": "Llegó lo que compré en buenas condiciones pero no lo quiero",
    "position": 10,
    "filter": {
        "group": [
            "generic",
            "fashion",
            "installable_autoparts",
            "expiring_food",
            "expiring_health"
        ],
        "site_id": [
            "MLC",
            "MCO",
            "MLU",
            "MPE",
            "MLM",
            "MLA",
            "MLB",
            "MEC",
            "CBT"
        ]
    },
    "settings": {
        "allowed_flows": [
            "returns"
        ],
        "expected_resolutions": [
            "change_product",
            "return_product"
        ],
        "rules_engine_triage": [
            "repentant"
        ]
    },
    "parent_id": null,
    "children_title": null,
    "status": "active",
    "date_created": "2024-01-15T18:07:42.632-04:00",
    "last_updated": "2024-03-12T20:20:21.795-04:00"
}
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/reasons/$REASON_ID proporcionará los siguientes campos:

- **id** : ID del reclamo

- **flow** : Flujo del reclamo

- **name** : Nombre de la reason

- **detail** : Detalle de la reason

- **position** : Funciona como sort_by, pero por defecto. Sin sort_by, el sistema ordena las razones por posición ascendente.

- **group** : El group indica la vertical del ítem. Puede asumir uno de los siguientes valores:  generic fashion installable_autoparts expiring_food expiring_health

- **site_id** : ID del sitio donde se desarrolla el reclamo

- **settings** : Puede asumir uno de los siguientes valores:  **allowed_flows** : Indica en cuáles flujos podemos visualizar esta reason **expected_resolutions** : Posibles resoluciones esperadas por quien reclama  product refund other   **rules_engine_triage** : Este ítem define el tag para la categorización de triage, con valores como:  repentant defective incomplete different not_working

- **parent_id** : Reason padre

- **children_title** : Este valor se usa para tipificar en post-compra, asignando el título a razones hijas de aquellas que contienen este atributo. Solo las razones tienen este atributo.

- **status** : Estado de la reason

- **date_created** : Fecha de creación de la reason

- **last_updated** : Fecha de la última actualización de la reason

## Historial de acciones del reclamo

El historial de acciones de un reclamo detalla las acciones realizadas, quién las ejecuta y cuándo, permitiendo un seguimiento del proceso.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions-history
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5175748308/actions-history
```

**Respuesta:**

```
[
    {
        "action_name": "send_message_to_mediator",
        "player_role": "complainant",
        "action_reason_id": "",
        "claim_stage": "dispute",
        "claim_status": "opened",
        "date_created": "2023-02-15T15:44:42.000-04:00"
    },
    {
        "action_name": "open_dispute",
        "player_role": "complainant",
        "action_reason_id": "",
        "claim_stage": "claim",
        "claim_status": "opened",
        "date_created": "2023-02-15T15:44:42.000-04:00"
    },
    {
        "action_name": "generate_return",
        "player_role": "complainant",
        "action_reason_id": null,
        "claim_stage": "claim",
        "claim_status": "opened",
        "date_created": "2023-02-15T15:43:15.000-04:00"
    },
    {
        "action_name": "allow_return",
        "player_role": "respondent",
        "action_reason_id": null,
        "claim_stage": "claim",
        "claim_status": "opened",
        "date_created": "2023-02-15T15:40:15.000-04:00"
    },
    {
        "action_name": "open_claim",
        "player_role": "complainant",
        "action_reason_id": null,
        "claim_stage": null,
        "claim_status": null,
        "date_created": "2023-02-15T15:35:04.000-04:00"
    }
]
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/actions-history proporcionará los siguientes campos:

- **action_name** : Nombre de la acción realizada

- **player_role** : Player que realiza la acción

- **action_reason_id** : ID de la acción realizada

- **claim_stage** : Etapa en que la acción fue realizada

- **claim_status** : Status de la etapa en que la acción fue realizada

- **date_created** : Fecha en que la acción fue realizada

## Historial de estados del reclamo

El historial de estados de un reclamo proporciona información sobre la etapa y el estado del reclamo en el momento de cada acción.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/status-history
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5175748308/status-history
```

**Respuesta:**

```
[
    {
        "stage": "dispute",
        "status": "opened",
        "date": "2023-02-15T15:44:42.000-04:00",
        "change_by": "complainant"
    },
    {
        "stage": "claim",
        "status": "opened",
        "date": "2023-02-15T15:35:04.000-04:00",
        "change_by": "complainant"
    }
]
```

## Cómo identificar si un reclamo afecta la reputación

El recurso /affects-reputation permite a los integradores identificar si un reclamo específica impacta la reputación del vendedor, mediante la ejecución de la siguiente llamada:

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/affects-reputation
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5224172034/affects-reputation
```

**Respuesta:**

```
{
    "affects_reputation": "not_applies",
    "has_incentive": false,
    "due_date": null
}
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/affects-reputation proporcionará los siguientes campos:

- **affects_reputation** : Informa si el reclamo afecta la reputación del vendedor. Puede asumir uno de los siguientes valores:  **affected** : Afecta reputación. **not_affected** : No afecta la reputación. **not_applies** : Pagos no vinculados a pedidos del marketplace.

- **has_incentive** : Cuando este campo devuelve true, si el vendedor responde satisfactoriamente dentro de las primeras 48 horas, no afectará su reputación. Si es false, el vendedor aún tiene las mismas 48 horas, pero no garantizamos que la reputación del vendedor no sea afectada.

- **due_date** : Fecha límite para resolver el reclamo.

## Identificador único de mensajes

Para garantizar la sincronización precisa de las bases de datos, creamos un hash único que identifica cada mensaje de forma exclusiva. Esto elimina la duplicidad, garantizando que cada mensaje sea registrado solo una vez.

Al procesar mensajes, usa el hash para verificar si el mensaje ya está registrado e inclúyelo en el proceso de sincronización para evitar registros duplicados.

Ejemplo de respuesta con el hash único de mensajes:

```
[
    {
        "sender_role": "respondent",
        "receiver_role": "mediator",
        "message": "Este és un mensaje de test",
        "translated_message": null,
        "date_created": "2024-11-01T13:30:58.000-04:00",
        "last_updated": "2024-11-01T13:30:58.000-04:00",
        "message_date": "2024-11-01T13:30:58.000-04:00",
        "date_read": null,
        "attachments": [],
        "status": "available",
        "stage": "dispute",
        "message_moderation": {
            "status": "clean",
            "reason": null,
            "source": "online",
            "date_moderated": null
        },
        "repeated": false,
       "hash": "5313707006_0_c793a662-fa12-3cfb-a069-9770f016baac"
    },
]
```

Siguiente: [Gestionar mensajes de un reclamo](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo)
