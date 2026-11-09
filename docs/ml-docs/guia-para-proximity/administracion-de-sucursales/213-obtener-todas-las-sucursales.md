<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/obtener-todas-las-sucursales -->
<!-- Sección: Guía para Proximity > Administración de sucursales -->

# Obtener todas las sucursales

Última actualización 04/03/2026

## Administración de sucursales

Nota:

A partir de la solicitud realizada a través de APIs REST, con la identificación devuelta en el atributo `user_id`, se puede consultar información sobre las sucursales que reciben las órdenes. 

 Este endpoint devuelve todas las tiendas propiedad de un usuario, utilizando el ID de usuario como parámetro.

Con la información obtenida puedes consultar:

- Identificación de la sucursal (`store_id`).

- Ubicación del establecimiento.

- Horarios de apertura.

- Identificación externa (si la hay).

Con `store_id` puedes consultar y cambiar el estado operativo de la sucursal, además de poder crear una identificación externa que se utilizará como identificador para un sistema de software de gestión de pedidos.

## Obtener todas las sucursales

### Llamada

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/users/$SELLER_ID/stores' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl -X GET \
    'https://api.mercadopago.com/proximity-integration/users/813887163/stores' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890'
```

### Respuesta

```
[
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
    "external_id": "A15154DE"
  }
]
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token obtenido a través del panel de desarrollador. Obligatorio ser enviado en todas las solicitudes. |

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **seller_id**  (obligatorio) | string | ID de usuario que se puede utilizar para recuperar las tiendas. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **id** | number | ID que identifica la tienda (`store_id`). |
| **user_id** | number | ID que identifica al usuario propietario de la tienda. |
| **description** | string | Nombre de la tienda. |
| **business_hours** | object | Lista de horarios de apertura de tiendas. Cada atributo del objeto estará representado por un día de la semana.  **monday** , **tuesday** , **wednesday** , **thursday** , **friday** , **saturday** , **sunday**  (Array): Array de objetos con horarios.  **open**  (string): Hora de apertura. **close**  (string): Hora de cierre. |
| **location** | object | Ubicación del establecimiento.  **address_line**  (string): Dirección completa de la tienda. **reference**  (string): Referencia sobre la ubicación. **latitude**  (number): Latitud de la ubicación. **longitude**  (number): Longitud de la ubicación. |
| **external_id** | string | Identificación externa que se puede utilizar como identificador para un sistema de software de gestión de pedidos. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **424** | Not Found | No se pudo obtener alguna información de las tiendas. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Modificar ID externo de la sucursal.](https://developers.mercadolibre.com.ar/es_ar/modificar-id-externo-de-la-sucursal)
