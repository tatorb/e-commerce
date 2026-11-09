<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/changes -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios -->

# Cambios

Última actualización 04/02/2026

## Cambios - Changes & Allow Replace

Importante:

La funcionalidad de Cambios y Reemplazo está disponible actualmente para las siguientes modalidades de envío:

**Cambios:**  Full, Cross Docking y, próximamente: Cross Docking Drop Off.

**Reemplazos:**  Full y próximamente: Cross Docking y Cross Docking Drop Off.

El flujo de cambios/reemplazos permite que los compradores realicen el cambio de sus compras en Mercado Libre. Esta documentación presenta la solución desarrollada para integrar este proceso, detallando los endpoints disponibles, el modelo de datos y las validaciones necesarias para una implementación eficiente.

En los siguientes temas, exploraremos la estructura del servicio, los requisitos técnicos y las mejores prácticas para garantizar una integración fluida, permitiendo que los sellers gestionen los cambios de forma automatizada y sin fricciones.

## Cambios

El recurso /changes garantiza que los integradores puedan acceder a la información de cambios relacionados con sus ventas, incluyendo acceso a datos generales de los pedidos correspondientes y la verificación de la existencia de cambios en las reclamaciones asociadas, asegurando una gestión más precisa y automatizada.

**¿Cómo identificar un cambio?**

Regístrate en el [feed de reclamos](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=evitar%20este%20problema.-,Post%20Purchase%3A,-Estructura%20Modelo%20con/), así recibirás notificaciones sobre todos los reclamos generados para la cuenta del vendedor. Consulta el recurso /claims/$CLAIM_ID y verifica el campo "related_entities". Si el valor "changes" está presente, hay un cambio asociado. Utiliza el recurso /changes para obtener los detalles.

### Consultar un cambio:

Para consultar un cambio, utiliza el recurso /post-purchase/v1/claims/$CLAIM_ID/changes, como en el ejemplo a continuación:

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/changes
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/post-purchase/v1/claims/5255498215/changes
```

**Respuesta:**

```

{
   "paging": {
       "offset": 0,
       "limit": 1,
       "total": 1
   },
   "data": [
       {
           "claim_id": 1234567890,
           "resource": "order",
           "resource_id": 2000001234567890,
           "items": [
               {
                   "id": "MLM1965897079",
                   "quantity": 1,
                   "price": 900.61,
                   "price_at_creation": 900.61,
                   "variation_id": 179014252922,
                   "currency_id": "MXN"
               }
           ],
           "seller_id": 10000000,
           "buyer_id": 2000000,
           "return": {
               "id": 37350682
           },
           "new_orders_ids": [1000000],
           "new_orders_shipments": [
               {
                   "id": 43176542122
               }
           ],
           "site_id": "ABC",
           "status": "changed",
           "status_detail": null,
           "type": "change",
           "estimated_exchange_date": {
               "from": "2024-03-11T00:00:00.000-04:00",
               "to": "2024-03-19T00:00:00.000-04:00"
           },
           "date_created": "2024-03-08T12:52:45.161-04:00",
           "last_updated": "2024-03-08T13:15:37.095-04:00"
       }
   ]
}
```

## Campos de la Respuesta

| Campo | Descripción |
| --- | --- |
| **claim_id** | ID del reclamo. |
| **resource** | Indica el recurso sobre el que se inició el cambio. En este caso, "order". |
| **resource_id** | ID correspondiente al recurso. |
| **items** | Array que indica el artículo que el cliente eligió para el cambio. |
| **ID del artículo** | Identificación del artículo. |
| **quantity** | Cantidad del artículo. |
| **price** | Nuevo precio del artículo en la nueva compra. |
| **price_at_creation** | Precio original del artículo en el momento del cambio. |
| **currency_id** | Identificación de la moneda. |
| **variation_id** | ID de la variación del artículo, si existe. |
| **seller_id** | ID del vendedor. |
| **buyer_id** | ID del comprador. |
| **return** | Identificación de la devolución. |
| **id** | ID de la devolución del artículo que no permanecerá con el comprador. |
| **new_orders_ids** | ID del pedido generado para el envío del nuevo producto al comprador. |
| **new_orders_shipments** | Identificación del envío del nuevo pedido. |
| **site_id** | Sitio de la compra. |
| **type** | Tipo de cambio: "change" (cambio por otro artículo) y "replace" (cambio por el mismo artículo). |
| **estimated_exchange_date** | Período estimado para la realización del cambio del producto. |
| **from** | Fecha inicial para la recolección del producto por parte del comprador. |
| **to** | Fecha final para la recolección del producto por parte del comprador. |
| **date_created** | Fecha de creación del cambio. |
| **last_updated** | Fecha de la última actualización. |

## Campos de Respuesta: Estados

Breve descripción de los estados relacionados con el proceso exitoso de cambios.

### Estado Pending y Descripciones Detalladas

- **pending** : Primer paso, donde se crea una nueva entidad de cambio con toda la información.

- **pending / return_pending** : El estado indica que la entidad de devolución ha sido creada, pero el envío aún está en proceso de creación.

- **pending / return_created** : La devolución ha sido notificada con el estado "label-generated".

- **pending / payment_required** : El nuevo pedido ha sido creado y espera pago.

- **pending / money_granted** : El préstamo para el cambio ha sido aplicado.

- **pending / purchase_payment_done** : El pago de la compra ha sido realizado.

### Estado de Procesamiento y Entrega

- **generated** : El cambio ha sido creado exitosamente y el envío avanza a "ready-to-ship".

- **purchase_shipped** : El envío ha sido notificado como "shipped".

- **[NUEVO] purchase_delayed/by_expiration** : El estado expira después de P+4 (P = fecha de la promesa original) y puede transitar a "ready" o "change_failed / purchase_returning".

- **[NUEVO] purchase_delayed/by_notification** : Se ha notificado un retraso en el envío. Si no hay nuevas actualizaciones, expira en P+2 y transita a "change_failed" con el subestado apropiado.

- **ready** : El envío ha sido notificado como "shipped / waiting-for-withdraw", listo para el cambio.

- **changed** : El comprador ha realizado el proceso de cambio y el envío ha sido entregado.

- **return_shipped** : El envío de la devolución ha sido despachado.

- **change_return_delivered** : La devolución ha sido entregada al centro de distribución.

- **change_return_delivered / return_triage_success** : El proceso de triage se completó exitosamente.

### Definición de Estados - Fallo

Breve descripción de los estados de fallo (change_failed) técnicos o funcionales.

- **failed** : El pago de la nueva compra falló.

- **purchase_pay_failed** : Error al procesar el pago.

- **change_failed** : Problemas al crear entidades o dificultades logísticas durante el transporte.

- **coverage_not_aplied** : El pedido no cumple con los criterios de la política de cambios/devoluciones.

- **mediator_closed** : Cambio cerrado por el mediador.

- **purchase_failed** : Error en la creación de la nueva compra.

- **purchase_return_lost** : El envío se perdió.

- **shipment_return_stole** : El envío fue robado.

- **shipment_returned** : El envío fue devuelto al centro de distribución.

- **purchase_returning** : El envío está en "not_delivered - returning_to_warehouse".

- **return_failed** : La devolución falló.

- **return_no_label_generated** : No se generó la etiqueta de devolución.

- **shipment_fw_cancel_seller** : Cancelado por el vendedor.

- **shipment_fw_cancelled** : Cancelado por el centro de distribución o durante el transporte.

- **shipment_fw_fraudulent** : Cancelado por fraude.

- **shipment_fw_lost** : Envío no entregado - perdido.

- **shipment_fw_stolen** : Envío no entregado - robado.

- **shipment_fw_unfulfillable** : Pedido imposible de ser atendido.

## Reemplazo

El **Reemplazo**  es un subflujo dentro del proceso de **cambios** , que permite el intercambio del mismo producto y la misma variación (por ejemplo: color o tamaño) en casos de productos dañados. A diferencia del flujo de cambio convencional, donde el comprador puede optar por otra variación, el reemplazo solo permite el intercambio por el mismo artículo.

### Diferencia entre Change y Replace

- **Reemplazo** : Se refiere al intercambio del mismo producto y la misma variación.

- **Cambio convencional** : Permite la sustitución por una variación diferente (por ejemplo: tamaño o color). **Reemplazo**  no permite este cambio.

- **Reemplazo** : Es ofrecido por el vendedor, mientras que **Cambio convencional**  puede ser iniciado directamente por el comprador, sin intervención del vendedor.

## ¿Cómo verificar si el Reemplazo está disponible?

Para saber si un pedido es elegible para el reemplazo, el vendedor debe consultar el endpoint Get Claim y verificar si la acción **allow_replace**  está disponible.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID
```

Si la acción **allow_replace**  está habilitada en la respuesta de la API, el vendedor podrá continuar con la solicitud de reemplazo.

## ¿Cómo ejecutar la acción de allow_replace?

Si la acción está disponible, el vendedor puede realizar un **POST**  en el endpoint de reemplazo para iniciar el proceso.

Llamada:

```
curl  --location --request POST 'https://api.mercadolibre.com/post-purchase/v1/claims/:CLAIM_ID/expected-resolutions/allow-replace' \
--header 'Authorization: Bearer {{token}}'
```

Ejemplo de respuesta exitosa:

```
[
   {
       "player_role": "complainant",
       "user_id": 1802660952,
       "expected_resolution": "return_product",
       "details": [],
       "date_created": "2024-10-16T11:27:03.000-04:00",
       "last_updated": "2024-10-16T11:27:03.000-04:00",
       "status": "pending"
   }
]
```

Si el comprador acepta el intercambio, el flujo seguirá el proceso de **cambios** , generando un **ID de allow_replace** , que será utilizado para la ejecución de la acción.

| Campo | Descripción |
| --- | --- |
| **player_role** | Rol del actor que inicia o interactúa en la reclamación:  **complainant** : Usuario que abrió la reclamación.  **respondent** : Usuario que responde a la reclamación.  **mediator** : Mercado Libre actuando como mediador. |
| **user_id** | ID del usuario que inicia la reclamación. |
| **expected_resolution** | Resolución esperada por el actor:  **refund** : El actor espera que se devuelva el dinero.  **product** : El actor espera que el producto llegue.  **change_product** : El actor espera cambiar el producto.  **return_product** : El actor espera que el producto sea devuelto con la posterior devolución del dinero. |
| **detail** | Información adicional sobre la resolución esperada. |
| **date_created** | Fecha de creación de la resolución esperada. |
| **last_updated** | Fecha de la última actualización de la resolución esperada. |
| **Status** | Estado de la resolución de la reclamación:  **pending** : El actor ha cargado la resolución esperada, pero aún no ha sido aceptada por la otra parte.  **accepted** : La resolución cargada por el actor fue aceptada por la otra parte o, en su defecto, por el mediador de Mercado Libre.  **rejected** : La resolución cargada por el actor fue rechazada por la otra parte y, en su defecto, se cargó una nueva opción de resolución. |

## Casos de Uso - Funcionalidad de Replace

Esta sección presenta ejemplos prácticos de uso de la funcionalidad de Replace, detallando flujos de integración para diferentes escenarios:

### Caso de Uso 1: Replace Disponible

**Descripción** : Un integrador desea integrar la funcionalidad de replace en su API para automatizar el proceso de intercambio de productos dañados.

**Precondiciones:**  El pedido es elegible para replace.

### Flujo Principal

- El Vendedor realiza una solicitud GET al endpoint de Claim para verificar si la acción **allow_replace**  está disponible.

- Si está disponible, el vendedor envía una solicitud POST al endpoint de **replace**  para ofrecer el cambio al comprador.

- El sistema confirma que el **replace**  fue ofrecido. (Estado: 200)

- El comprador puede aceptar o rechazar el cambio.

- Si el comprador acepta, el sistema actualiza la resolución esperada del integrador, según la respuesta:

```
[
   {
       "player_role": "complainant",
       "user_id": 1802660952,
       "expected_resolution": "return_product",
       "details": [],
       "date_created": "2024-10-16T11:27:03.000-04:00",
       "last_updated": "2024-10-16T11:27:03.000-04:00",
       "status": "rejected"
   },
   {
       "player_role": "complainant",
       "user_id": 1802660952,
       "expected_resolution": "change_product",
      {
   "id": 5308212444,
   "resource_id": 2000009575852844,
   "status": "opened",
   "type": "mediations",
   "stage": "claim",
   "parent_id": null,
   "resource": "order",
   "reason_id": "PDD9965",
   "fulfilled": true,
   "quantity_type": "total",
"details": [],
       "date_created": "2024-10-16T11:32:56.000-04:00",
       "last_updated": "2024-10-16T11:32:56.000-04:00",
       "status": "accepted"
   }
]
```

El campo **`related_entities`**  se actualiza cuando el comprador acepta la propuesta de replace y tendrá la etiqueta **change**  en **related_entities**

```
{
   "id": 5308275481,
   "resource_id": 2000009577898632,
   "status": "opened",
   "type": "mediations",
   "site_id": "MLM",
   "date_created": "2024-10-16T14:44:11.000-04:00",
   "last_updated": "2024-10-16T14:48:08.000-04:00",
   "related_entities": [
       "return",
       "change"
   ]
}
```

Nota:

En el flujo de replace, la reclamación continúa marcada como `mediations`, sin cambiar a `change`.

```
"id": 5308212444,
   "resource_id": 2000009575852844,
   "status": "opened",
   "type": "mediations",
   "stage": "claim",
   "parent_id": null,
   "resource": "order",
   "reason_id": "PDD9965",
   "fulfilled": true,
   "quantity_type": "total",
{
   "id": 5304741170,
   "resource_id": 2000009456954248,
   "status": "closed",
   "type": "mediations",
   "related_entities": [
       "return",
       "change"
   ]
}
```

El comprador recibe el nuevo producto, y la resolución de la reclamación se completa.

Importante:

El tipo, incluso después de cerrar la reclamación, sigue como “mediations” y no cambia a “change”, siendo esta la diferencia con los cambios.

### Caso de Uso 2: Acción de Reemplazo No Disponible

**Descripción** : El integrador verifica las acciones disponibles y constata que la acción allow_replace no está habilitada.

### Flujo Principal

- El Vendedor realiza una solicitud GET al endpoint de Claim.

- La respuesta no contiene la acción allow_replace, indicando que el reemplazo no está disponible.

- El vendedor intenta realizar un POST para ofrecer el reemplazo, pero recibe un error.

- El sistema responde con un **error 400**  indicando que la acción no está permitida.

- 

- **Post-condiciones** : El vendedor está al tanto de que no puede ofrecer el reemplazo para este pedido y debe buscar alternativas, como reembolso u otras formas de mediación.

Para más información sobre cómo gestionar los cambios de productos en Mercado Libre a través de FRONT, consulte el siguiente enlace:

[Cómo gestionar los cambios de productos en tus ventas](https://vendedores.mercadolivre.com.br/nota/como-gerenciar-as-trocas-de-produto-nas-suas-vendas)

Este enlace ofrece una visión detallada de cómo los vendedores pueden gestionar los cambios de productos directamente desde la plataforma de Mercado Libre, garantizando una experiencia más completa y eficiente tanto para los vendedores como para los compradores.
