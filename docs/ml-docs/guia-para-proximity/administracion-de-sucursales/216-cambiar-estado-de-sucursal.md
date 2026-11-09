<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/cambiar-estado-de-sucursal -->
<!-- Sección: Guía para Proximity > Administración de sucursales -->

# Cambiar estado de sucursal

Última actualización 08/03/2026

## Cambiar el estado de la sucursal

Nota:

Los estados de funcionamiento de una sucursal se definen de la siguiente manera:

- **enabled** : La sucursal está abierta y lista para recibir órdenes. Se muestra en la aplicación de Mercado Pago.

- **paused** : La sucursal está en pausa y no podrá recibir nuevas órdenes, pero seguirá apareciendo en la aplicación de Mercado Pago.

Atención:

El estado **disabled**  cierra la sucursal de forma **DEFINITIVA** . La sucursal no podrá recibir nuevas órdenes y ya no se mostrará en la aplicación de Mercado Pago. 

 **Este estado no tiene retorno.**  Una vez que una sucursal ha sido deshabilitada, no puede volver a habilitarse. Por lo tanto, este estado solo debe utilizarse para eliminar una sucursal permanentemente.

## Llamada

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/stores/$STORE_ID/status' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "status": "enabled"
}'
```

### Ejemplo

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/stores/41517088/status' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890' \
    -d '{
  "status": "paused"
}'
```

### Respuesta

```
{
  "id": 41517088,
  "user_id": 813887163,
  "description": "Doc's grocery store",
  "status": "paused",
  "business_hours": {
    "monday": [
      {
        "open": "8:00",
        "close": "15:00"
      }
    ],
    "tuesday": [
      {
        "open": "8:00",
        "close": "15:00"
      }
    ],
    "wednesday": [
      {
        "open": "8:00",
        "close": "15:00"
      }
    ],
    "thursday": [
      {
        "open": "8:00",
        "close": "15:00"
      }
    ],
    "friday": [
      {
        "open": "8:00",
        "close": "15:00"
      }
    ]
  },
  "location": {
    "address_line": "Viaduto Arapuã - Saude, São Paulo - SP, 04307-070, Brasil",
    "reference": "Next to a bakery",
    "latitude": -23.630159633405057,
    "longitude": -46.64532809999999
  },
  "external_id": "A15154DE"
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
| **store_id**  (obligatorio) | string | ID que identifica la tienda cuyo estado se actualizará. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status**  (obligatorio) | string | Estado de funcionamiento de la tienda que se actualizará.  **enabled** : La sucursal está habilitada y se muestra en la aplicación. **paused** : La sucursal está en pausa, pero sigue visible en la aplicación. **disabled** : La sucursal se cierra definitivamente. **Este estado no tiene retorno.** |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **id** | number | ID que identifica la tienda. |
| **user_id** | number | ID que identifica al usuario propietario de la tienda. |
| **description** | string | Nombre de la tienda. |
| **status** | string | Estado actual de funcionamiento de la tienda.  **enabled** : La sucursal está habilitada. **paused** : La sucursal está en pausa. **disabled** : La sucursal está cerrada definitivamente. |
| **business_hours** | object | Lista de horarios de apertura de tiendas. Cada atributo del objeto estará representado por un día de la semana.  **monday** , **tuesday** , **wednesday** , **thursday** , **friday** , **saturday** , **sunday**  (Array): Array de objetos con horarios.  **open**  (string): Hora de apertura. **close**  (string): Hora de cierre. |
| **location** | object | Ubicación del establecimiento.  **address_line**  (string): Dirección completa de la tienda. **reference**  (string): Referencia sobre la ubicación. **latitude**  (number): Latitud de la ubicación. **longitude**  (number): Longitud de la ubicación. |
| **external_id** | string | ID externo de la tienda (si está configurado). |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Missing_Parameter | ID de tienda inválido. |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **404** | Not Found | Tienda no encontrada. |
| **424** | Not Found | No se pudo buscar tiendas asociadas al usuario. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Introducción de Catálogo](https://developers.mercadolibre.com.ar/es_ar/introduccion-de-catalogo)
