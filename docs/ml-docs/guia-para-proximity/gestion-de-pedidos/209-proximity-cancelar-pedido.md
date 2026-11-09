<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/proximity-cancelar-pedido -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# Cancelar pedido

Última actualización 20/08/2026

## Cancelar pedido

Nota:

Para cancelar una orden que fue aceptada en el PDV/POS, realiza un PUT enviando el `shipment_id` y `access_token` (generado por el proceso de autenticación OAuth) 

 Se puede agregar un motivo para la cancelación, solo es necesario verificar si el motivo de la cancelación está disponible para el estado actual.

## Llamada

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/shipments/$SHIPMENT_ID/cancel' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "status": "cancelled",
  "cancellation_reason": {
    "id": "CS9504",
    "value": "seller_other",
    "message": "Me falta alguno de los productos."
  }
}'
```

### Ejemplo

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/shipments/44962414957/cancel' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890' \
    -d '{
  "status": "cancelled",
  "cancellation_reason": {
    "id": "CS9504",
    "value": "seller_other",
    "message": "Me falta alguno de los productos."
  }
}'
```

### Respuesta

```
{
  "status": "cancelled"
}
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token obtenido a través del panel de desarrollador. Obligatorio ser enviado en todas las solicitudes. |

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **shipment_id**  (obligatorio) | string | Shipment ID del pedido. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status**  (obligatorio) | string | Este campo indica el estado del pedido, que debe tener el valor `cancelled` para este endpoint. |
| **cancellation_reason**  (opcional) | object | Motivo de la cancelación que se recuperó desde el endpoint de motivos de cancelación.  **id**  (string): ID del motivo de cancelación. **value**  (string): Valor del motivo de cancelación (ej: `seller_other`). **message**  (string): Mensaje descriptivo del motivo de cancelación. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status** | string | Status de la orden tras su cancelación. El valor de status que se devolverá es `cancelled`. |

## Razones de cancelación por estado

Las razones de cancelación disponibles varían según el estado actual del pedido. A continuación se detallan las razones para cada estado:

### Estado: ready_to_print

Razones disponibles cuando el pedido está pendiente de aceptación.

| ID | Valor | Mensaje |
| --- | --- | --- |
| `CS9504` | `seller_other` | Me falta alguno de los productos. Se juntaron demasiados pedidos. No cerré la tienda y no estoy haciendo pedidos. El comprador me pidió cambiar la dirección y está fuera de mi área de cobertura. Otro motivo. |

### Estado: ready_to_ship

Razones disponibles cuando el pedido ya fue aceptado y está en preparación o listo para enviar.

| ID | Valor | Mensaje |
| --- | --- | --- |
| `CS9504` | `seller_other` | Me falta alguno de los productos. Se juntaron demasiados pedidos. El repartidor tuvo un problema. Otro motivo. |

### Estado: shipped

Razones disponibles cuando el pedido ya fue despachado y está en camino.

| ID | Valor | Mensaje |
| --- | --- | --- |
| `CS9504` | `seller_other` | El repartidor tuvo un problema. Otro motivo. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Conflict-error | Esta orden no puede ser cancelada debido a su estado actual. |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **424** | Not Found | No se pudo obtener alguna información de la orden. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Pedido Listo.](https://developers.mercadolibre.com.ar/es_ar/pedido-listo)
