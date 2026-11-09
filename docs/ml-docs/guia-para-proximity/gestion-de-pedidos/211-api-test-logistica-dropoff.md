<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/api-test-logistica-dropoff -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# API TEST - Logistica Dropoff

Última actualización 08/03/2026

## **API TEST**  - Logística Dropoff

Durante el desarrollo e integración con Mercado Pago Delivery, es necesario poder simular los diferentes estados por los que pasa un pedido en el flujo logístico **Dropoff** . En producción, estos cambios de estado son enviados automáticamente conforme el repartidor avanza en el proceso de entrega.

Esta API de testing permite simular manualmente esos cambios de estado, facilitando las pruebas de integración. De esta manera, puedes verificar que tu sistema responde correctamente a cada notificación de cambio de estado.

Importante:

Esta API **solo funciona con usuarios de prueba** . No es posible utilizarla en cuentas de producción. Su único objetivo es simular los cambios de estado que normalmente son enviados por logística en el flujo Dropoff.

## Llamada

Para simular un cambio de estado, realiza un POST enviando el `shipmentId` del pedido y el `notification` (estado) que deseas simular.

```
curl -X POST \
    'https://api.mercadopago.com/proximity-integration/v1/testing/notifications' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "shipmentId": 42202706921,
  "notification": "ON_ROUTE_TO_PICKUP"
}'
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token de un usuario de prueba. |
| **Content-Type**  (obligatorio) | string | Debe ser `application/json`. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **shipmentId**  (obligatorio) | number | Shipment ID del pedido al que se le desea cambiar el estado. |
| **notification**  (obligatorio) | string | Estado al que se desea cambiar el pedido. Ver tabla de valores posibles. |

## Valores posibles de notification

Los siguientes valores representan los estados del flujo logístico Dropoff que puedes simular:

| Valor | Estado resultante | Descripción |
| --- | --- | --- |
| `ON_ROUTE_TO_PICKUP` | `ready_to_ship/on_route_to_pickup` | El repartidor está en camino hacia el restaurante para recoger el pedido. |
| `PICKING_UP` | `ready_to_ship/picking_up` | El repartidor llegó al restaurante y está recogiendo el pedido. |
| `SHIPPED` | `shipped/out_for_delivery` | El repartidor ya salió del restaurante con el pedido y está en camino al cliente. |
| `DELIVERED` | `delivered` | El pedido fue entregado exitosamente al cliente. |

Nota:

En producción, estos cambios de estado son automáticos y son enviados por el operador logístico. Cada cambio de estado generará una notificación a tu webhook configurado.

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Bad Request | El valor de `notification` no es válido o el pedido no está en un estado compatible para la transición solicitada. |
| **401** | Unauthorized | Access Token inválido o expirado. |
| **403** | Forbidden | El usuario no es un usuario de prueba o no tiene permisos para acceder a este recurso. |
| **424** | Not Found | No se encontró el pedido con el `shipmentId` especificado. |
| **500** | Internal Server Error | Error interno del servidor. Intenta nuevamente más tarde. |
