<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/producto-consulta-usuarios -->
<!-- Sección: Recursos de la API > Usuarios -->

# Consulta usuarios

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 12/01/2026

## Consultas sobre el usuario

**Importante:**

Los nuevos usuarios tendrán IDs que exceden el límite de Int32 y ahora usarán Int64. Verifica que tu sistema sea compatible con este formato, tanto para el almacenamiento como para la recuperación de datos, asegurándote de que los IDs no sean forzados a Int32, para evitar errores.

Si ya lograste [registrar tu aplicación](https://developers.mercadolibre.com.ar/es_ar/registra-tu-aplicacion) y generaste un [usuarios test](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas), comienza a trabajar con usuarios (vendedores y compradores). Puedes [reconocer la situación de sus usuarios](https://developers.mercadolibre.com.ar/es_ar/validar-datos-de-vendedores) (vendedores nuevos y actuales) y determinar si estos tienen sus datos completos para poder vender en Mercado Libre, recibir dinero por Mercado Pago o usar la tarjeta prepaga.

## Consultar mis datos personales

Si te encuentras logueado en Mercado Libre y [tienes un token](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion) podrás hacer la siguiente llamada y conocer qué información se encuentra relacionada a tu usuario.
Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
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

## Consultar información pública de un usuario

Muy bien, de ésta manera ya conoces el Id del usuario, por lo cual puedes realizar la llamada al recurso de users de la siguiente manera y obtener la información pública del usuario que deseas.
Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID
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
  "country_id": "AR",
  "address": {
    "city": "Palermo",
    "state": "AR-C"
  },
  "user_type": "real_estate_agency",
  "site_id": "MLA",
  "permalink": "http://perfil.mercadolibre.com.ar/TETE2870021",
  "seller_reputation": {
    "level_id": null,
    "power_seller_status": null,
    "transactions": {
      "period": "historic",
      "total": 1
    }
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
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID
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

Puedes observar que esta vez obtuviste mayor cantidad de datos del usuario: su nombre completo, email, teléfono, domicilio, etc. Te solicitamos que no reveles estos datos públicamente ya que pueden comprometer al usuario.

## Códigos de error comunes

206 – Partial content: en algunos casos, el recurso de la API de Usuarios devolverá un código 206 – Partial content. Esto ocurrirá cuando falle la solicitud a algunos de los datos (por ejemplo, reputación del usuario) para informarte que recibirás una respuesta incompleta.

**Siguiente:**  [Tiendas Oficiales](https://developers.mercadolibre.com.ar/es_ar/tiendas-oficiales).
