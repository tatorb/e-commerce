<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/pedido-listo -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# Pedido Listo

Última actualización 08/03/2026

## Pedido Listo

Para mejorar la experiencia tanto de los socios comerciales como de los clientes finales, se implementó un nuevo endpoint de integración con el PDV/POS que permite marcar un pedido como **"listo"**  para ser retirado por el repartidor.

Esta funcionalidad permite que el restaurante o comercio notifique a Mercado Pago que el pedido ya fue preparado y está disponible para su retiro. De esta manera, se optimiza la coordinación entre la preparación del pedido y la llegada del repartidor, reduciendo tiempos de espera y mejorando la eficiencia operativa.

Importante:

Para utilizar este endpoint, deben cumplirse las siguientes condiciones:

- La tienda debe ser del tipo de logística **Dropoff**  (`drop_off`).

- El pedido debe estar en estado `ready_to_ship` con subestado `printed` (pedido aceptado).

## Llamada

Para marcar el pedido como listo, realiza un POST utilizando el `shipment_id` del pedido.

```
curl -X POST \
    'https://api.mercadopago.com/proximity-integration/v1/orders/{shipment_id}/ready' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl -X POST \
    'https://api.mercadopago.com/proximity-integration/v1/orders/44962414957/ready' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890'
```

Nota:

Este endpoint solo está disponible para tiendas con logística **Dropoff** . Si la tienda utiliza logística **Flex** , el flujo de marcado como listo se realiza cuando el repartidor escanea el código QR del pedido.

### Respuesta exitosa

```
Status: 202 Accepted
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token obtenido a través del panel de desarrollador. Obligatorio ser enviado en todas las solicitudes. |
| **Content-Type**  (obligatorio) | string | Debe ser `application/json`. |

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **shipment_id**  (obligatorio) | string | Shipment ID del pedido que se desea marcar como listo. |

## Códigos de Respuesta

| Código | Descripción |
| --- | --- |
| **202**  - Accepted | El pedido fue marcado como listo exitosamente. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | invalid_shipment_status | El pedido no está en el estado válido para ser marcado como listo. Debe estar en `ready_to_ship/printed`. |
| **401** | Unauthorized | Access Token inválido o expirado. |
| **403** | Forbidden | El usuario no tiene permisos para acceder a este recurso o la tienda no es de tipo Dropoff. |
| **424** | Not Found | No se encontró el pedido con el `shipment_id` especificado. |
| **500** | Internal Server Error | Error interno del servidor. Intenta nuevamente más tarde. |

### Ejemplo de respuesta de error

```
{
  "title": "invalid_shipment_status",
  "error": "invalid_shipment_status",
  "message": "Invalid shipment status",
  "status": 400
}
```

**Siguiente** : [Introducción Sucursales](https://developers.mercadolibre.com.ar/es_ar/proximity-introduccion-sucursales)
