<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/servicios-consulta-usuarios -->
<!-- Sección: Guía para servicios -->

# Consulta Usuarios

Última actualización 29/04/2025

## Consultas sobre el usuario

Si ya lograste registrar tu aplicación, autenticarte y generar un usuario de Test, el siguiente paso a seguir es aprender a trabajar con usuarios (vendedores y compradores):

### Consultar mis datos personales

Si te encuentras logueado en MercadoLibre y tienes un token podrás hacer la siguiente llamada y conocer qué información se encuentra relacionada a tu usuario:

**Ejemplo:**

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
```

Respuesta:

```
{
  "id": 202593498,
  "nickname": "TETE2870021",
  "registration_date": "2016-01-06T11:31:42.000-04:00",
  "country_id": "AR",
  "address": {
    "state": "AR-C",
    "city": "Palermo"
  },
  "user_type": "normal",
  "tags": [
    "normal",
    "test_user",
    "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "period": "historic",
      "total": 0,
      "completed": 0,
      "canceled": 0,
      "ratings": {
        "positive": 0,
        "negative": 0,
        "neutral": 0
      }
    }
  },
  "buyer_reputation": {
    "tags": []
  },
  "status": {
    "site_status": "active"
  }
}
```

### Consultar información pública de un usuario

Los datos públicos son aquellos que puedes consultar de manera abierta en el perfil de un usuario. Los datos que puedes consultar son los siguientes:

- Id de usuario

- Nickname

- Fecha de registro

- Estado del usuario

- Dirección (ciudad y provincia)

- Reputación como vendedor

- Reputación como comprador

Para poder consultar esta información debes tener el id del usuario:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{User_id}
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/202593498
```

Respuesta:

```
{
  "id": 202593498,
  "nickname": "TETE2870021",
  "registration_date": "2016-01-06T11:31:42.000-04:00",
  "country_id": "AR",
  "address": {
    "state": "AR-C",
    "city": "Palermo"
  },
  "user_type": "normal",
  "tags": [
    "normal",
    "test_user",
    "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "period": "historic",
      "total": 0,
      "completed": 0,
      "canceled": 0,
      "ratings": {
        "positive": 0,
        "negative": 0,
        "neutral": 0
      }
    }
  },
  "buyer_reputation": {
    "tags": []
  },
  "status": {
    "site_status": "active"
  }
}
```

### Consultar información privada de un usuario que ha aceptado el uso de mi aplicación

La información privada es aquella que solo podrá ser consultada con el consentimiento del usuario. La información a la que se puede acceder incluye:

- Reputación como vendedor

- Reputación como comprador

- Dirección (incluye datos específicos)

- Datos de contacto

Para poder consultar esta información debes tener el id del usuario y el token que permita realizar la consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{User_id}/private
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/202593498/private
```

Respuesta:

```
{
  "id": 202593498,
  "nickname": "TETE2870021",
  "registration_date": "2016-01-06T11:31:42.000-04:00",
  "country_id": "AR",
  "address": {
    "state": "AR-C",
    "city": "Palermo",
    "street": "Av. Santa Fe",
    "number": "1234"
  },
  "user_type": "normal",
  "tags": [
    "normal",
    "test_user",
    "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "period": "historic",
      "total": 0,
      "completed": 0,
      "canceled": 0,
      "ratings": {
        "positive": 0,
        "negative": 0,
        "neutral": 0
      }
    }
  },
  "buyer_reputation": {
    "tags": []
  },
  "status": {
    "site_status": "active"
  }
}
```

### Actualizar datos de usuario

Si deseas actualizar la información de un usuario (que te haya otorgado el permiso), debes realizar la siguiente llamada:

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
  "address": {
    "street": "Nueva Calle",
    "number": "123",
    "city": "Nueva Ciudad",
    "state": "Nuevo Estado"
  }
}' https://api.mercadolibre.com/users/{User_id}/address
```

**Ejemplo:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
  "address": {
    "street": "Av. Libertador",
    "number": "6789",
    "city": "Buenos Aires",
    "state": "Capital Federal"
  }
}' https://api.mercadolibre.com/users/202593498/address
```

Respuesta:

```
{
  "id": 202593498,
  "nickname": "TETE2870021",
  "registration_date": "2016-01-06T11:31:42.000-04:00",
  "country_id": "AR",
  "address": {
    "state": "AR-C",
    "city": "Palermo",
    "street": "Av. Libertador",
    "number": "6789"
  },
  "user_type": "normal",
  "tags": [
    "normal",
    "test_user",
    "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "period": "historic",
      "total": 0,
      "completed": 0,
      "canceled": 0,
      "ratings": {
        "positive": 0,
        "negative": 0,
        "neutral": 0
      }
    }
  },
  "buyer_reputation": {
    "tags": []
  },
  "status": {
    "site_status": "active"
  }
}
```

Ten en cuenta que la información proporcionada es solo un ejemplo, y que puede variar según el estado actual del usuario y la información que el mismo haya decidido compartir.

## Endpoint block-api/search/users: Consultar usuários bloqueados para orders y question:

El endpoint block-api/search/users permite consultar bloqueos asociados a un usuario (Buyer) específico, devolviendo información sobre el estado del bloqueo. Los servicios de bloqueo de preguntas y orders se han unificado en un único endpoint.

- Blocked_by_questions: Para bloqueos relacionados con preguntas.

- Blocked_by_order: Para bloqueos relacionados con pedidos.

| Parámetro | TIPO | Obligatorio | Descripción |
| --- | --- | --- | --- |
| **client.id** | string | Opcional | ID del cliente que realiza la solicitud. |
| **type** | string | Obligatório | Tipo de bloqueo: blocked_by_questions o blocked_by_order. |
| **user_blocked** | int | Opcional | ID del usuario bloqueado (Buyer). |
| **caller.id** | string | Obligatorio | ID del usuario que realiza la solicitud. |
| **offset** | int | Opcionales | por defecto: 0 |
| **limit** | int | Opcionales | máximo 1000, por defecto: 10 |

Llamada:

```

curl -X GET  'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/block-api/search/users/{user_id}
```

### Ejemplo de request: blocked_by_questions

```

curl -X GET - location 'https://api.mercadolibre.com/block-api/search/users/123456?type=blocked_by_questions' \
--header 'Authorization: Bearer {ACCESS_TOKEN}'
```

**Response:**

```

{
  "users": [
    {
      "id": 123456,
      "blocked_at": "2024-02-07T15:04:05Z"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 1
  }
}
```

**Código de Estado:**  **200 OK** - La solicitud fue procesada con éxito.

### Ejemplo de request: blocked_by_order

```

curl -X GET -location 'https://api.mercadolibre.com/block-api/search/users/123456?type=blocked_by_order' \
--header 'Authorization: Bearer {ACCESS_TOKEN}'
```

**Response:**

```

{
  "users": [
    {
      "id": 123456,
      "blocked_at": "2024-02-07T15:04:05Z"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 1
  }
}
```

**Código de Estado: 200 OK - La solicitud fue procesada con éxito.**

### Ejemplo de Respuesta Sin Bloqueos (blocked_by_questions o blocked_by_order.)

**Response:**

```

{ "users": [],
 "paging": { 
"total": 0, 
"limit": 10,
 "offset": 0 } 
}
```

- **users:**  Indica que no hay usuarios bloqueados relacionados ni con preguntas ni con pedidos para el usuario solicitado.

- **paging:**  Muestra que no hay resultados, con total igual a 0.

**Campos de la Respuesta:**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| **users.id** | int | ID del usuario bloqueado. |
| **users.blocked_at** | string | Fecha y hora de creación del bloqueo. |
| **paging.offset** | int | Número de bloqueos que fueron omitidos antes de retornar los resultados. |
| **paging.limit** | int | Cantidad máxima de bloqueos a recuperar (default 10, max 1000). |
| **paging.total** | int | Total de bloqueos recuperados. |
