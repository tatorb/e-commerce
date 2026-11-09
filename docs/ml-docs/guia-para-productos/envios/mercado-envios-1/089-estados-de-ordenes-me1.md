<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/estados-de-ordenes-me1 -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 1 -->

# Estados de órdenes y seguimiento

Última actualización 17/09/2026

## Estado de pedidos y rastreo

La herramienta de estado de pedidos ME1 tiene el objetivo de mejorar la experiencia de los compradores en el seguimiento de la entrega de sus pedidos. Con este recurso es posible informar cuándo el producto fue enviado, el avance del trayecto, si hubo éxito o no en la entrega, además del número de rastreo (tracking number).

## Para qué sirve

Estas integraciones permiten que Mercado Libre comunique, en nombre del vendedor, dónde está el envío al comprador. Con esto:

- Mantenemos el tracking de la app vivo y confiable.

- Reducimos la ansiedad del comprador durante la espera.

- Ayudamos a garantizar el éxito de la entrega (delivery success).

- 

**Migración a la V2 de la API**

Las notificaciones de estado ahora usan la versión 2 (V2) del endpoint. Actualiza tus integraciones antes del 31/10, fecha en que la V1 dejará de estar disponible.

La V2 trae mejoras de seguridad y agrega diversos nuevos substatus, que ayudan a mejorar la visibilidad del paquete y la experiencia del comprador.

## Migración al endpoint V2

El endpoint de `seller_notifications` cambió su URL. Usa la versión V2 en todas tus integraciones:

| **Versión** | **Estado** | **Endpoint** |
| --- | --- | --- |
| V1 (antigua) | ❌ Se descontinuará el 31/10 | `POST https://api.mercadolibre.com/shipments/$SHIPMENT_ID/seller_notifications` |
| V2 (nueva) | ✅ En producción | `POST https://api.mercadolibre.com/v2/shipments/$SHIPMENT_ID/seller_notifications` |

**Qué cambió en la V2:**

- La URL ahora incluye `/v2/`.

- Cuando no haya substatus, envía `"substatus": null` (JSON null) — no la cadena `"null"`.

Fechas clave:

**XP del comprador:**  totalmente productiva el 14/09. Hasta esa fecha, algunos status pueden no reflejarse en la interfaz del comprador, pero el envío se actualiza igual. Ya puedes integrar y enviar todos los status sin esperar esa fecha.

**Deprecación de la V1:**  31/10. Asegúrate de haber migrado antes de esa fecha.

## Cómo funciona: status + substatus

La notificación mostrada al comprador se determina por la combinación de los campos `status` y `substatus` que envías. El `status` indica el momento macro del envío y el `substatus` detalla el evento específico.

Los tres status posibles son:

- **`shipped`** : el paquete está en tránsito (incluye los eventos de trayecto y de visitas/fallas de entrega).

- **`delivered`** : el paquete fue entregado al comprador. Es un status finalizador e irreversible.

- **`not_delivered`** : el paquete no fue entregado. Es un status finalizador e irreversible y solo debe usarse cuando no haya más intentos de entrega.

**Importante:**

Comunicar los status shipped y delivered es obligatorio, estando sujeto a penalidades en caso de no actualización. La promesa de entrega no puede modificarse vía API.

## Prerrequisito: obtener el shipment_id

Para actualizar el status es necesario conocer el `shipment_id` del pedido. Se obtiene a partir del recurso de `order`. Esta llamada no cambia con la V2 — permanece igual:

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/orders/$ORDER_ID/shipments
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/orders/2000017766645450/shipments
```

**Respuesta:**

```
{
  "id": 28264263908,
  "mode": "me1",
  "created_by": "receiver",
  "order_id": 2339711980,
  "order_cost": 99.9,
  "base_cost": 22.07,
  "site_id": "MLB",
  "status": "pending",
  "substatus": null
}
```

El campo `id` de la respuesta es el `shipment_id` que usarás en la llamada de actualización.

## Cómo actualizar un status (llamada genérica)

Todas las actualizaciones de status usan la misma llamada: un POST al endpoint V2 de `seller_notifications`, cambiando solo los campos `status`, `substatus` y `comment` según el evento que quieras informar.

**Endpoint V2:**

```
POST https://api.mercadolibre.com/v2/shipments/$SHIPMENT_ID/seller_notifications
```

**Ejemplo de llamada (V2):**

```
curl --location \
'https://api.mercadolibre.com/v2/shipments/$SHIPMENT_ID/seller_notifications' \
--header 'Authorization: Bearer $ACCESS_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "payload": {
    "service_id": 154,
    "comment": "texto libre describiendo el evento",
    "date": "2026-08-10T14:44:52.252Z"
  },
  "tracking_number": "TEST123456",
  "tracking_url": "https://tracking.mercadolivre.com.br/TEST123456",
  "status": "delivered",
  "substatus": null
}'
```

Importante:

Para reportar cualquier subestado de `Shipped`, primero debés enviar el evento con estado `null` (`en camino`). No podés informar directamente un subestado intermedio sin haber registrado esta transición inicial. Si no respetás esta secuencia, el shipment no se actualizará.

## Campos del payload

| **Campo** | **Obligatorio** | **Descripción** |
| --- | --- | --- |
| `payload.service_id` | Sí | Código que representa el servicio de ME1 en cada país (ver tabla de service_id por país). |
| `payload.comment` | No | Texto libre describiendo el evento. |
| `payload.date` | Sí | Fecha y hora del envío del evento de tracking, en formato ISO 8601 con timezone. |
| `tracking_number` | Condicional | Número de rastreo de la transportadora. No es obligatorio, pero si se envía, el `tracking_url` también debe enviarse. |
| `tracking_url` | Condicional | URL de rastreo de la transportadora. No es obligatorio, pero si se envía, el `tracking_number` también debe enviarse. |
| `status` | Sí | Status del envío. Valores: `shipped`, `delivered`, `not_delivered`. |
| `substatus` | Sí | Substatus del evento. Ver tabla de referencia. El campo debe estar siempre presente — no lo omitas. Cuando el evento no tenga substatus, envía `null` (JSON), no la cadena `"null"`. |

**Importante:**

tracking_number y tracking_url van siempre juntos. Ninguno de los dos es obligatorio, pero no envíes uno sin el otro — o envías los dos, o ninguno.

## Respuesta

Una solicitud HTTP realizada con éxito debe devolver el código de respuesta `200` con el siguiente cuerpo:

```
{
  "status": "OK"
}
```

Sin embargo, cuando ocurran errores en el procesamiento de la request, tendremos el siguiente patrón de respuesta:

```
{
  "status_code": 400,
  "error_code": "validation_error",
  "message": "error message",
  "timestamp": "2026-08-14T10:00:00Z",
  "request_id": "request-uuuid"
}
```

## Códigos de error

| **Código HTTP** | **error_code** | **message** | **Descripción del error** |
| --- | --- | --- | --- |
| `400` | `event_date_before_shipment_creation_date` | `Date value predates the shipment` | Notificación enviada con una fecha anterior a la creación del envío. |
| `403` | `forbidden_client` | `caller.id is not shipment sender` | El envío no pertenece al vendedor que está intentando actualizarlo. |
| `400` | `shipment_mode_is_not_me1` | `Shipment mode is not ME1` | El envío informado no pertenece a la unidad de negocio ME1. |
| `403` | `bad_request` | `Status-substatus not allowed` | Combinación de status-substatus inválida. |
| `400` | `invalid_seller_json_format` | `Invalid json format from seller` | El cuerpo de la solicitud contiene un formato inválido de acuerdo con el estándar esperado. |
| `429` | — | — | La solicitud fue rechazada porque alcanzó el límite de tasa (rate limit) del servidor. |
| `503` | — | — | El servicio está temporalmente no disponible. |
| `500` | — | — | Error interno de procesamiento. |

## service_id por país

| **Site** | **País** | **service_id** |
| --- | --- | --- |
| `MLB` | Brasil | 11 |
| `MLA` | Argentina | 154 |
| `MLM` | México | 231876 |
| `MLC` | Chile | 282578 |
| `MCO` | Colombia | 282579 |
| `MLU` | Uruguay | 282604 |
| `MPE` | Perú | 361180 |

## Rastreo interno vs. externo

La misma llamada lleva dos tipos de información de seguimiento, con finalidades diferentes:

- **Seguimiento interno (Mercado Libre):**  los campos `status` y `substatus` actualizan el estado del envío dentro del marketplace de Mercado Libre — es lo que el comprador ve reflejado en su compra en Meli.

- **Rastreo externo (transportadora):**  los campos `tracking_number` (código de rastreo) y `tracking_url` (link de seguimiento) apuntan al rastreo externo, en la propia transportadora del vendedor.

Sobre el rastreo externo (`tracking_number` + `tracking_url`):

- Puede enviarse en cualquier notificación de seller (cualquier llamada al endpoint `seller_notifications`), independientemente del `status`/`substatus`.

- Ninguno de los dos campos es obligatorio.

- Si envías uno, debes enviar el otro. No envíes `tracking_number` sin `tracking_url` (ni al revés) — ambos se usan para presentar la información de rastreo externo en la experiencia del comprador.

## Referencia de status y substatus

Para informar un evento, envía la llamada genérica con el `status` y el `substatus` correspondientes a la fila deseada. Los substatus están agrupados por etapa del envío.

### shipped — En tránsito

| **Substatus (API)** | **Nombre de referencia** | **Descripción** |
| --- | --- | --- |
| `null` | En camino | El vendedor despachó la compra a su transportadora. |
| `out_for_delivery` | Salió a última milla / llega hoy | El envío salió a reparto y será entregado durante el día. |
| `soon_deliver` | Próxima entrega | La transportadora avisa que el destino del comprador es la próxima parada de la ruta. |
| `at_the_door` | En la puerta | La transportadora avisa que está en el domicilio del comprador esperando ser atendida. |

### shipped — Visitas fallidas

| **Substatus (API)** | **Nombre de referencia** | **Descripción** |
| --- | --- | --- |
| `receiver_absent` | Comprador ausente | El comprador no se encontraba en el domicilio o no respondió al momento de la visita. |
| `bad_address` | Domicilio incorrecto | La transportadora no encontró el domicilio de entrega al momento de la visita. |
| `dangerous_area` | Zona peligrosa | La transportadora no pudo realizar la visita por condiciones de seguridad en la zona. |
| `unauthorized_receiver` | Persona no autorizada para recibir | No había alguien autorizado para recibir el envío en nombre del comprador. |
| `impassable_zone` | Zona intransitable | La transportadora no pudo acceder a la zona de entrega. |
| `not_visited` | Domicilio no visitado | La transportadora tuvo un inconveniente y no logró visitar el domicilio en la fecha prevista. |

### shipped — Problema de transporte

| **Substatus (API)** | **Nombre de referencia** | **Descripción** |
| --- | --- | --- |
| `documentation_issue` | Retenido por falta de documentación | El paquete está retenido por falta de documentación. |
| `taxes_issue` | Retenido por falta de pago de impuesto | El paquete está retenido por falta de pago de impuesto. |
| `fiscalization_issue` | Retenido por fiscalización | El paquete está retenido por fiscalización. |

### delivered — Finalizador

| **Substatus (API)** | **Nombre de referencia** | **Descripción** |
| --- | --- | --- |
| `null` | Entregado | La compra fue entregada al comprador. |

Nota:

`delivered` es un status finalizador e irreversible.

### not_delivered — Finalizador

| **Substatus (API)** | **Nombre de referencia** | **Descripción** |
| --- | --- | --- |
| `refused_delivery` | Compra rechazada | El comprador rechazó la entrega al momento de la visita. |
| `returned` | No entregado | No se pudo entregar por máximo de intentos u otro problema de fuerza mayor. |

Nota:

`not_delivered` es un status finalizador e irreversible. Solo debe usarse cuando no haya más intentos de entrega. El vendedor debe alinear el flujo de devolución con su transportadora.

## Notas por evento

**Fallas de entrega**  (`receiver_absent`, `bad_address`, `dangerous_area`, `unauthorized_receiver`, `impassable_zone`, `not_visited`):

- El comprador y el vendedor deben coordinar cómo resolver la entrega o cancelar la compra.

- Si los intentos de entrega se agotan, la transportadora o el vendedor debe marcar como `not_delivered`. Solo entonces Mercado Libre reembolsará al comprador, y el vendedor deberá gestionar la devolución con su transportadora.

**Problemas de transporte**  (`documentation_issue`, `taxes_issue`, `fiscalization_issue`):

- El paquete está retenido y depende de regularización (documentación, pago de impuesto o fiscalización) antes de continuar.

## Ejemplos de experiencia comprador y vendedor

### Shipment paid

Nota:

Notificado automáticamente por Mercado Libre cuando se efectúa la compra.

**Comprador**

**Vendedor**

### Shipped + external tracking

**Comprador**

**Vendedor**

### Shipped + Out for delivery

**Comprador**

**Vendedor**

### Visita fallida (ejemplo receiver absent)

**Comprador**

**Vendedor**

### Not delivered

**Comprador**

**Vendedor**

### Demorado

Nota:

Notificado automáticamente por Mercado Libre.

**Comprador**

**Vendedor**

**Siguiente** : [Flete dinámico](https://developers.mercadolibre.com.ar/es_ar/flete-dinamico).
