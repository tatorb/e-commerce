<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/proximity-aceptar-pedidos -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# Aceptar Pedido

Última actualización 08/03/2026

## Aceptar pedido

Nota:

Cuando el estado de entrega sea **Ready_to_ship** , puedes aceptar la orden. 

 Para aceptar la orden que fue confirmada en el PDV/POS, realiza un PUT enviando el `shipment_id` y el `access_token` (generado por el proceso de autenticación OAuth) al endpoint. 

 Al aceptar la orden, se cambiará el estado y en la respuesta se indicará el nuevo estado del pedido.

Importante:

Es importante saber que solo es posible aceptar una orden en los estados **ready_to_ship**  y **ready_to_print** . Después de aceptar la orden, el subestado será **printed** . Si la orden no es aceptada 5 minutos después de su creación, se cancelará automáticamente.

## Llamada

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/shipments/$SHIPMENT_ID/accept' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "status": "accepted"
}'
```

### Ejemplo

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/shipments/44962414957/accept' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890' \
    -d '{
  "status": "accepted"
}'
```

### Respuesta

```
{
  "status": "accepted"
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
| **shipment_id**  (obligatorio) | string | ID único que identifica el envío de la orden a realizar por la operación para aceptar un pedido. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status** | string | Esta propiedad indica el status de la orden, que debe tener el valor `accepted` para este endpoint. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status** | string | Status de la orden tras su aceptación. El valor de status que se devolverá es `accepted`. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Conflict-error | This order cannot be accepted due to its current status. |
| **401** | Unauthorized | Access Token is invalid. |
| **403** | Forbidden | User cannot access this resource. |
| **424** | Not Found | Failed to get some information of the order. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Imprimir recibo de pedido.](https://developers.mercadolibre.com.ar/es_ar/proximity-imprimir-recibo)
