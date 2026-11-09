<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/modificar-id-externo-de-la-sucursal -->
<!-- Sección: Guía para Proximity > Administración de sucursales -->

# Modificar ID externo de la sucursal

Última actualización 04/03/2026

## Modificar ID externo de la sucursal

Nota:

También existe la posibilidad de crear un ID externo (`external_id`) para una determinada sucursal. Este campo es opcional, pero se puede utilizar como identificador para el sistema de software de gestión de pedidos.

Importante:

También podrás consultar la información de una sucursal a través de su ID externo. Para eso, envía como parámetros de solicitud el `user_id` relacionado con la sucursal, el `external_id` y el `access_token`. Accede a más información en la API [Obtener sucursal por ID externo](https://developers.mercadolibre.com.ar/es_ar/obtener-tienda-por-id-externo).

## Llamada

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/stores/$STORE_ID/external_id' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "external_id": "9320001PC21"
}'
```

### Ejemplo

```
curl -X PUT \
    'https://api.mercadopago.com/proximity-integration/stores/41517088/external_id' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890' \
    -d '{
  "external_id": "9320001PC21"
}'
```

### Respuesta

```
{
  "id": 41517088,
  "user_id": 813887163,
  "description": "Doc's grocery store",
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
  "external_id": "9320001PC21"
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
| **StoreID**  (obligatorio) | string | ID de la tienda. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **external_id**  (obligatorio) | string | Valor del ID externo que se vinculará a la tienda. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **id** | number | ID que identifica la tienda. |
| **user_id** | number | ID que identifica al usuario propietario de la tienda. |
| **description** | string | Nombre de la tienda. |
| **business_hours** | object | Lista de horarios de apertura de tiendas. Cada atributo del objeto estará representado por un día de la semana.  **monday** , **tuesday** , **wednesday** , **thursday** , **friday** , **saturday** , **sunday**  (Array): Array de objetos con horarios.  **open**  (string): Hora de apertura. **close**  (string): Hora de cierre. |
| **location** | object | Ubicación del establecimiento.  **address_line**  (string): Dirección completa de la tienda. **reference**  (string): Referencia sobre la ubicación. **latitude**  (number): Latitud de la ubicación. **longitude**  (number): Longitud de la ubicación. |
| **external_id** | string | Valor del ID externo vinculado a la tienda. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Missing_Parameter | ID de tienda inválido. |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **424** | Not Found | No se pudo obtener alguna información de la tienda. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Obtener sucursal por ID externo.](https://developers.mercadolibre.com.ar/es_ar/obtener-tienda-por-id-externo)
