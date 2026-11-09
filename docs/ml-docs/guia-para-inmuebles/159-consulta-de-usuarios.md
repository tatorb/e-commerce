<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/consulta-de-usuarios -->
<!-- Sección: Guía para inmuebles -->

# Consulta de usuarios

Última actualización 06/11/2025

## Consulta de Usuarios

Si sigues la guía de Pasos rápidos para publicar un inmueble de prueba, obtendrás un usuario de test a partir de tu cuenta real, además de crear tu aplicación para el uso de la API, en esta guía profundizamos un poco más sobre las opciones disponibles para la consulta de usuarios.

## Registrarte como inmobiliaria (opcional)

Si eres una inmobiliaria o quieres probar el comportamiento de este perfil de vendedor con tu usuario de test, puedes registrar tu usuario como tal para obtener acceso a nuestros paquetes promocionales para inmobiliarias.

Para hacerlo, accede a tu cuenta de usuario de test, ve a la sección:

- Ayuda / PQR

- Ayuda sube tu cuenta cuenta

- Configuración de mi cuenta

- Registrarme como empresa, concesionaria e inmobiliaria

- Como inmobiliaria.

Una vez realices estos pasos, deberás, por medio del canal de soporte, solicitar la activación como para tu usuario de prueba mediante este [formulario](https://forms.gle/gYLGrHurCNA1NoP87) seleccionando la opción de **activar usuario** .

Si llegaste a está sección a través de los los **“Pasos rápidos para publicar un inmueble de prueba ”**  > **“Configura tu Usuario de Prueba como Inmobiliaria”**  puedes volver a dicha sección desde aquí.

## Consultar mis datos personales

Una vez realizados los pasos detallados en la guía de [configuración](https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos) en especial la sección de [autenticación](https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token), cuando obtengas el Access_token podrás consultar la información relacionada con tu usuario ya sea el de test o el de tu cuenta real, ejecutando la siguiente llamada.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token obtenido en la guia autenticación |

Recibirás toda la información del usuario relacionado al token usado, por ejemplo:

```
{
  "id": 2320007493,
  "nickname": "TESTUSER942900259",
  "registration_date": "2025-03-11T19:06:13.272-04:00",
  "first_name": "Test",
  "last_name": "Test",
  "gender": "",
  "country_id": "CL",
  "email": "test_user_942900259@testuser.com",
  "identification": {
    "number": "11111111-1",
    "type": "RUT"
  },
  "address": {
    "address": "Apoquindo 4800",
    "city": "Las Condes",
    "state": "CL-RM",
    "zip_code": null
  },
  "phone": {
    "area_code": "",
    "extension": "",
    "number": "56978481768"
  },
  "alternative_phone": {
    "area_code": "",
    "extension": "",
    "number": ""
  },
  "user_type": "real_estate_agency",
  "tags": [
    "test_user",
    "real_estate_agency"
  ],
  "logo": null,
  "points": 0,
  "site_id": "MLC",
  "permalink": "http://perfil.mercadolibre.cl/TESTUSER942900259",
  "seller_experience": "NEWBIE",
  "bill_data": {
    "accept_credit_note": null
  },
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "canceled": 0,
      "completed": 0,
      "period": "historic",
      "ratings": {
        "negative": 0,
        "neutral": 0,
        "positive": 0
      },
      "total": 0
    },
    "metrics": {
      "sales": {
        "period": null,
        "completed": 0
      },
      "claims": {
        "period": "60 months",
        "rate": 0,
        "value": 0
      },
      "delayed_handling_time": {
        "period": "60 months",
        "rate": 0,
        "value": 0
      },
      "cancellations": {
        "period": "60 months",
        "rate": 0,
        "value": 0
      }
    }
  },
  "buyer_reputation": {
    "canceled_transactions": 0,
    "tags": null,
    "transactions": {
      "canceled": {
        "paid": null,
        "total": null
      },
      "completed": null,
      "not_yet_rated": {
        "paid": null,
        "total": null,
        "units": null
      },
      "period": "",
      "total": null,
      "unrated": {
        "paid": null,
        "total": null
      }
    }
  },
  "status": {
    "billing": {
      "allow": true,
      "codes": []
    },
    "buy": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "reasons": [],
        "required": false
      }
    },
    "confirmed_email": true,
    "shopping_cart": {
      "buy": "allowed",
      "sell": "allowed"
    },
    "immediate_payment": false,
    "list": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "reasons": [],
        "required": false
      }
    },
    "mercadoenvios": "not_accepted",
    "mercadopago_account_type": "personal",
    "mercadopago_tc_accepted": true,
    "required_action": "",
    "sell": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "reasons": [],
        "required": false
      }
    },
    "site_status": "active",
    "user_type": null
  },
  "company": {
    "brand_name": null,
    "city_tax_id": "",
    "corporate_name": "",
    "identification": "",
    "state_tax_id": "",
    "cust_type_id": "CO",
    "soft_descriptor": null
  },
  "credit": {
    "consumed": 0,
    "credit_level_id": "MLC5",
    "rank": "newbie"
  },
  "context": {},
  "registration_identifiers": []
}
```

### Campos de la respuesta

| Parámetro | Tipo de Dato | Descripción |
| --- | --- | --- |
| id | Number | Identificador único para el usuario |
| nickname | String | Nombre de usuario (nickname) |
| registration_date | String | Fecha y hora del registro del usuario |
| first_name | String | Nombre del usuario |
| last_name | String | Apellido del usuario |
| gender | String | Género del usuario |
| country_id | String | Código del país donde se encuentra el usuario (ej., "CL", “AR”) |
| email | String | Dirección de correo electrónico del usuario |
| identification | Object | Detalles de identificación del usuario |
| identification.number | String | Número de identificación |
| identification.type | String | Tipo de identificación (ej., "RUT", “CC”) |
| address | Object | Detalles de la dirección del usuario |
| address.address | String | Dirección del usuario |
| address.city | String | Ciudad del usuario |
| address.state | String | Estado del usuario |
| address.zip_code | String | Código postal del usuario |
| phone | Object | Detalles del número de teléfono del usuario |
| phone.area_code | String | Código de área del teléfono del usuario |
| phone.extension | String | Extensión del teléfono del usuario |
| phone.number | String | Número de teléfono del usuario |
| alternative_phone | Object | Detalles del número de teléfono alternativo del usuario |
| alternative_phone.area_code | String | Código de área del teléfono alternativo del usuario |
| alternative_phone.extension | String | Extensión del teléfono alternativo del usuario |
| alternative_phone.number | String | Número de teléfono alternativo del usuario |
| user_type | String | Tipo de usuario (ej., "real_estate_agency") |
| tags | Array | Lista de etiquetas asociadas al usuario |
| logo | Array | URL o referencia al logo del usuario (puede ser nulo) |
| points | Number | Puntos del usuario |
| site_id | String | Identificador del sitio (ej., "MLC") |
| permalink | Array | Enlace permanente (permalink) del usuario |
| seller_experience | String | Nivel de experiencia como vendedor del usuario |
| bill_data | Object | Datos de facturación del usuario |
| bill_data.accept_credit_note | Boolean | Indica si el usuario acepta notas de crédito |
| seller_reputation | Object | Detalles de la reputación del usuario como vendedor |
| seller_reputation.level_id | String | ID del nivel de vendedor |
| seller_reputation.power_seller_status | Array | Estado del usuario como "vendedor destacado" |
| seller_reputation.transactions | Object | Detalles de las transacciones del vendedor |
| seller_reputation.transactions.canceled | Number | Número de transacciones canceladas |
| seller_reputation.transactions.completed | Number | Número de transacciones completadas |
| seller_reputation.transactions.period | String | Período de las transacciones |
| seller_reputation.transactions.ratings | Object | Detalles de las calificaciones de las transacciones |
| seller_reputation.transactions.ratings.negative | Number | Número de calificaciones negativas |
| seller_reputation.transactions.ratings.neutral | Number | Número de calificaciones neutrales |
| seller_reputation.transactions.ratings.positive | Number | Número de calificaciones positivas |
| seller_reputation.transactions.total | Number | Número total de transacciones |
| seller_reputation.metrics | Object | Métricas del vendedor |
| seller_reputation.metrics.sales | Object | Métricas de ventas |
| seller_reputation.metrics.sales.period | Array | Período de ventas |
| seller_reputation.metrics.sales.completed | Number | Número de ventas completadas |
| seller_reputation.metrics.claims | Object | Métricas de reclamos |
| seller_reputation.metrics.claims.period | String | Período de reclamos |
| seller_reputation.metrics.claims.rate | Number | Tasa de reclamos |
| seller_reputation.metrics.claims.value | Number | Valor de los reclamos |
| seller_reputation.metrics.delayed_handling_time | Object | Métricas del tiempo de manejo demorado |
| seller_reputation.metrics.delayed_handling_time.period | String | Período del tiempo de manejo demorado |
| seller_reputation.metrics.delayed_handling_time.rate | Number | Tasa del tiempo de manejo demorado |
| seller_reputation.metrics.delayed_handling_time.value | Number | Valor del tiempo de manejo demorado |
| seller_reputation.metrics.cancellations | Object | Métricas de cancelaciones |
| seller_reputation.metrics.cancellations.period | String | Período de cancelaciones |
| seller_reputation.metrics.cancellations.rate | Number | Tasa de cancelaciones |
| seller_reputation.metrics.cancellations.value | Number | Valor de las cancelaciones |
| buyer_reputation | Object | Detalles de la reputación del usuario como comprador |
| buyer_reputation.canceled_transactions | Number | Número de transacciones canceladas como comprador |
| buyer_reputation.tags | Array | Etiquetas asociadas a la reputación de comprador |
| buyer_reputation.transactions | Object | Detalles de las transacciones del comprador |
| buyer_reputation.transactions.canceled | Array | Detalles de las transacciones canceladas |
| buyer_reputation.transactions.canceled.paid | Boolean | Indica si las transacciones canceladas fueron pagadas |
| buyer_reputation.transactions.canceled.total | Array | Total de transacciones canceladas |
| buyer_reputation.transactions.completed | Array | Número de transacciones completadas como comprador |
| buyer_reputation.transactions.not_yet_rated | Array | Detalles de las transacciones no calificadas aún |
| buyer_reputation.transactions.not_yet_rated.paid | Boolean | Indica si las transacciones no calificadas aún fueron pagadas |

## Consultar información pública de un usuario

Si cuentas con el id de un usuario que deseas consultar, puedes hacer uso del recurso de `/users` para obtener la información pública de este usuario, esto mediante la siguiente llamada.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token obtenido en la guia autenticación. |
| USER_ID | String | No | Id del usuario a consultar |

Recibirás una respuesta como la siguiente:

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
    "tags": []
  },
  "status": {
    "site_status": "active",
    "list": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "required": false,
        "reasons": []
      }
    },
    "buy": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "required": false,
        "reasons": []
      }
    },
    "sell": {
      "allow": true,
      "codes": [],
      "immediate_payment": {
        "required": false,
        "reasons": []
      }
    },
    "billing": {
      "allow": true,
      "codes": []
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

## Usuario vendedor sell equal pay (S = P)

Si prefieres que todas tus transacciones se realicen únicamente mediante Mercado Pago, debes especificar en la configuración de tu cuenta que solo aceptas este método (S = P, sell equal pay). Al hacerlo, la opción de "Acuerdo con el vendedor" se desactivará automáticamente. Para esto deberás ejecutar la siguiente llamada `PUT`.

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-type: application/json" -d '{ "reason": "by_user" }' https://api.mercadolibre.com/users/$USER_ID/immediate_payment
```

Recibirás una respuesta con estado 200 Ok con el id de tu usuario modificado.

```
{
  "id": 2320007493
}
```

Si deseas deshacer esta acción de aceptar transacciones únicamente mediante Mercado Pago, ejecuta el siguiente comando.

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/immediate_payment/by_user
```

Recibirás una respuesta como la anterior.

## Consultar usuarios bloqueados para órdenes.

Para verificar bloqueos vinculados a un comprador específico, se puede utilizar el recurso block-api/search/users, el cual proporciona detalles sobre el estado del bloqueo. El servicios para bloquear órdenes se encuentra definido por:

- **Blocked_by_order** : Para bloqueos relacionados con pedidos.

Para realizar la consulta ejecuta el siguiente comando:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/block-api/search/users/{user_id}?type=blocked_by_order
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token obtenido en la guia autenticación. |
| USER_ID | String | No | Id del usuario a consultar |
| type | String | No | `blocked_by_order` para consultar los bloqueos de pedidos para el usuario |

Si el usuario presenta algún tipo de bloqueo, recibirá una respuesta como la siguiente:

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

Si por el contrario, el usuario no presenta bloqueos recibirá una respuesta con el arreglo users vacío, de la siguiente manera:

```
{
  "users": [],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 0
  }
}
```

### Detalle de campos de la respuesta

| Parámetro | Tipo de Dato | Descripción |
| --- | --- | --- |
| `users` | Array | Lista de bloqueos del usuario. |
| `users[].id` | Number | Identificador único del usuario bloqueado. |
| `users[].blocked_at` | String | Fecha y hora en que el usuario fue bloqueado. |
| `paging` | Objeto | Información sobre la paginación de los resultados. |
| `paging.offset` | Number | Número de bloqueos que fueron omitidos antes de retornar los resultados. |
| `paging.limit` | Number | Cantidad máxima de bloqueos a recuperar (default 10, max 1000). |
| `paging.total` | Number | Total de bloqueos recuperados. |

### Lecturas recomendadas

- [Publica Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble)

- [Ciclo de vida de las publicaciones.](https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 05/11/2025 | 1.0 | Publicación Inicial |
