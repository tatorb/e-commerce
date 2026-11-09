<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/proximity-imprimir-recibo -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# Imprimir recibo de pedido

Última actualización 08/03/2026

## Imprimir recibo de pedido

Nota:

Después de aceptar la orden, podrás imprimir tu recibo en **formato PDF** . 

 Para imprimirlo, realiza un GET enviando el `shipment_id` y `access_token` (generado por el proceso de autenticación OAuth). 

 Este endpoint se puede usar si no es necesario desarrollar un cupón personalizado para el PDV.

Importante:

El recibo siempre se puede imprimir, excepto cuando la orden tiene estado **cancelado**  o **enviado** .

## Llamada

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/shipments/$SHIPMENT_ID/print_label_pdf' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/shipments/44962414957/print_label_pdf' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890'
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

## Parámetros de Response

Nota:

Esta solicitud devuelve un archivo **PDF**  con el recibo del pedido. No tiene una respuesta JSON.

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **424** | Not Found | No se pudo obtener alguna información de la orden. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Cancelar pedido.](https://developers.mercadolibre.com.ar/es_ar/proximity-cancelar-pedido)
