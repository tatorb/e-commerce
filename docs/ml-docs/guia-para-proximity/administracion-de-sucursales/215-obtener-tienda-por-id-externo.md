<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/obtener-tienda-por-id-externo -->
<!-- Sección: Guía para Proximity > Administración de sucursales -->

# Obtener sucursal por ID externo

Última actualización 08/03/2026

## Obtener sucursal por ID externo

Importante:

Para saber cómo crear un ID externo para tu sucursal y utilizarlo como identificador para el sistema de software de gestión de pedidos, accede a [Cambiar ID externo de la sucursal](https://developers.mercadolibre.com.ar/es_ar/modificar-id-externo-de-la-sucursal).

Nota:

Es posible consultar información de una **sucursal específica**  usando su **ID externo** . 

 Para ello, realiza un GET enviando el `seller_id`, el `external_id` y el `access_token` (generado por el proceso de autenticación OAuth) al endpoint. 

 Este endpoint obtiene tiendas por el ID externo que se registró previamente.

## Llamada

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/users/$SELLER_ID/stores/external_id/$EXTERNAL_ID' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/users/813887163/stores/external_id/9320001PC21' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890'
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
| **SellerID**  (obligatorio) | string | ID que identifica al usuario propietario de la tienda. |
| **ExternalID**  (obligatorio) | string | ID externo de la tienda que se registró previamente. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **id** | number | Store ID vinculado al ID externo que se utilizó como parámetro. |
| **user_id** | number | ID que identifica al usuario propietario de la tienda. |
| **description** | string | Nombre de la tienda. |
| **business_hours** | object | Lista de horarios de apertura de tiendas. Cada atributo del objeto estará representado por un día de la semana.  **monday** , **tuesday** , **wednesday** , **thursday** , **friday** , **saturday** , **sunday**  (Array): Array de objetos con horarios.  **open**  (string): Hora de apertura. **close**  (string): Hora de cierre. |
| **location** | object | Ubicación del establecimiento.  **address_line**  (string): Dirección completa de la tienda. **reference**  (string): Referencia sobre la ubicación. **latitude**  (number): Latitud de la ubicación. **longitude**  (number): Longitud de la ubicación. |
| **external_id** | string | Identificación externa de la tienda. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Missing_Parameter | ID de tienda inválido. |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **424** | Not Found | No se pudo buscar tiendas asociadas al usuario. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Cambiar el estado de la sucursal](https://developers.mercadolibre.com.ar/es_ar/cambiar-estado-de-sucursal)
