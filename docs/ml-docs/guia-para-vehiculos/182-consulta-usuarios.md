<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/consulta-usuarios -->
<!-- Sección: Guía para vehículos -->

# Consulta Usuarios

Última actualización 12/01/2026

## Consultas sobre el usuario

Si ya lograste [registrar tu aplicación](https://developers.mercadolibre.com.ar/es_ar/registra-tu-aplicacion), autenticarte y generar un [usuario de test](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas), el siguiente paso a seguir es aprender a trabajar con usuarios (vendedores y compradores):

## Consultar mis datos personales

Si te encuentras logueado en Mercado Libre y tienes un token podrás hacer la siguiente llamada y conocer qué información se encuentra relacionada a tu usuario:

Ejemplo:

```
curl  -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
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
  "user_type": "real_estate_agency",
  "tags": [
  "real_estate_agency",
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
  "tags": [
  ]
  },
  "status": {
  "site_status": "active"
  }
}
```

Como se muestra en el resultado, se trata de un usuario de prueba -inmobiliario- que lleva activo en el sitio argentino desde el 6 de enero de 2016, sin datos relevantes de reputación hasta la fecha.

## Consultar información pública de un usuario

Muy bien, de ésta manera ya conoces el Id del usuario, por lo cual puedes realizar la llamada al recurso de users de la siguiente manera y obtener la información pública del usuario que deseas:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{User_id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/205159033
```

Respuesta:

```
{
  "id": 205159033,
  "nickname": "TETE4358231",
  "registration_date": "2016-02-04T13:49:09.000-04:00",
  "country_id": "AR",
  "address": {
  "state": "AR-C",
  "city": "Palermo"
  },
  "user_type": "car_dealer",
  "tags": [
  "car_dealer",
  "test_user",
  "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE4358231",
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
  "tags": [
  ]
  },
  "status": {
  "site_status": "active"
  }
}
```

## Consultar información privada de un usuario que ha aceptado el uso de mi aplicación

Para obtener los datos privados de un usuario, solo debes apendar el ACCESS_TOKEN del usuario al final de la llamada que realizaste anteriormente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{User_id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/202593498
```

Respuesta:

```
{
  "id": 202593498,
  "nickname": "TETE2870021",
  "registration_date": "2016-01-06T11:31:42.000-04:00",
  "first_name": "Test",
  "last_name": "Test",
  "country_id": "AR",
  "email": "test_user_50698062@testuser.com",
  "identification": {
  "type": "DNI",
  "number": "1111111"
  },
  "address": {
  "state": "AR-C",
  "city": "Palermo",
  "address": "Test Address 123",
  "zip_code": "1414"
  },
  "phone": {
  "area_code": "01",
  "number": "1111-1111",
  "extension": "",
  "verified": false
  },
  "alternative_phone": {
  "area_code": "",
  "number": "",
  "extension": ""
  },
  "user_type": "real_estate_agency",
  "tags": [
  "real_estate_agency",
  "test_user",
  "user_info_verified"
  ],
  "logo": null,
  "points": 100,
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_experience": "ADVANCED",
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
  "canceled_transactions": 0,
  "transactions": {
    "period": "historic",
    "total": null,
    "completed": null,
    "canceled": {
      "total": null,
      "paid": null
    },
    "unrated": {
      "total": null,
      "paid": null
    },
    "not_yet_rated": {
      "total": null,
      "paid": null,
      "units": null
    }
  },
  "tags": [
  ]
  },
  "status": {
  "site_status": "active",
  "list": {
    "allow": true,
    "codes": [
    ],
    "immediate_payment": {
      "required": false,
      "reasons": [
      ]
    }
  },
  "buy": {
    "allow": true,
    "codes": [
    ],
    "immediate_payment": {
      "required": false,
      "reasons": [
      ]
    }
  },
  "sell": {
    "allow": true,
    "codes": [
    ],
    "immediate_payment": {
      "required": false,
      "reasons": [
      ]
    }
  },
  "billing": {
    "allow": true,
    "codes": [
    ]
  },
  "mercadopago_tc_accepted": true,
  "mercadopago_account_type": "personal",
  "mercadoenvios": "not_accepted",
  "immediate_payment": false,
  "confirmed_email": false,
  "user_type": "eventual",
  "required_action": ""
  },
  "credit": {
  "consumed": 100,
  "credit_level_id": "MLA1"
  }
}
```

## Usuario Vendedor S = P (sell equal pay)

Si deseas que todas tus operaciones sean exclusivamente a través de Mercado Pago deberás indicar en la información de tu usuario que solo aceptas la modalidad S = P (sell equal pay). De esta manera quedará deshabilitada la opción “Acuerdo con el vendedor”.

PUT:

```
curl -XPUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-type: application/json" -d 

'{
    "reason": "by_user"
}'

https://api.mercadolibre.com/users/{user_id}/immediate_payment
```

Si querés dejar de aceptar como única opción Mercado Pago, puedes eliminar la marca de la siguiente manera:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{user_id}/immediate_payment/by_user
```

## Códigos de error comunes

**206**  – Partial content: en algunos casos el recurso API de los usuarios devolverá un código 206 - Partial content. Esto va a suceder cuando la solicitud de algunos de los datos falle (por ejemplo, la reputación del usuario), para hacerle saber que está recibiendo una respuesta incompleta.

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

## Eliminar usuario bloqueado

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$YOUR_CUST_ID/order_blacklist/$SELLER_ID
```

Bloquear usuarios de preguntas
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' "Content-Type: application/json" -d
{
  "user_id": blocked user id
}
https://api.mercadolibre.com/users/$SELLER_ID/questions_blacklist
