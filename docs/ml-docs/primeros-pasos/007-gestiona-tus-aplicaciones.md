<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones -->
<!-- Sección: Primeros pasos -->

# Gestiona tus aplicaciones

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 15/10/2026

## Gestiona tus aplicaciones

## Detalles de las aplicaciones

Para acceder a los detalles completos sobre una de tus aplicaciones, simplemente incluye el app_id en la llamada a la API.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/$APP_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/12345
```

Respuesta:

```
{
  "id": 213123928883922,
  "site_id": "MLB",
  "thumbnail": null,
  "url": "http://apps.mercadolivre.com.br/polipartes",
  "sandbox_mode": true,
  "project_id":null,
  "active": true,
  "max_requests_per_hour": 18000,
  "certification_status": "not_certified"
}
```

## Datos privados de tu aplicación

Cada que vez que quieras conocer más detalles de los datos de tu aplicación, deberás hacerlo utilizando el Access Token del usuario con el que se creó.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/$APP_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/12345
```

## Valide las autorizaciones de un usuário a tu aplicación

Es posible conocer los detalles de una autorización dada a tu aplicación simplemente haz un GET con el user_id y el access token.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/applications
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/26317316/applications
```

La respuesta será un conjunto de aplicaciones con el siguiente formato:

```
[
  - {
  "user_id": "26317316",
  "app_id": "13795",
  "date_created": "2012-12-20T15:38:27.000-04:00",
  "scopes": - [
    "read",
    "write",
  ],
   },
]
```

## Usuarios que le dieron permisos a tu aplicación

Para acceder al listado de usuarios que le dieron permisos a tu app, simplemente realiza el siguiente GET:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/$APP_ID/grants
```

Respuesta:

```
{
    "paging": {
        "total": 1,
        "limit": 50,
        "offset": 0
    },
    "grants": [
        {
            "user_id": {user_id},
            "app_id": {app_id},
            "date_created": "2012-05-19T01:00:54.000-04:00",
            "scopes": [
                "read",
                "offline_access",
                "write"
            ]
        }
    ]
}
```

## Descripción de los campos

- user_id: identificador del usuario.

- app_id: identificador de la aplicación.

- date_created: fecha en que fue creada la autorización.

- scopes: permisos otorgados a la aplicación: lectura, escritura y offline_access.

### Consideraciones

En el DevCenter, desde la pantalla de "Administrar permisos", se puede visualizar y exportar el listado de los Grants que tiene la aplicación. 
Esos son los estados posibles para los permisos de la integración:

- **Nuevo** : Grant generado a menos de 24 horas.

- **Activo** : usuario con uso activo de nuestras APIs en los ultimos 90 días.

- **Inactivo** : usuario considerado inactivo, pues no tiene llamadas a los recurso de nuestro ecosistema de MeLi en los ultimos 90 días.

## Revoca la autorización del usuario

Para eliminar la autorización de un usuario a tu aplicación, debes especificar el app_id, user_id y su access token. Simplemente, haz un DELETE como se muestra en el ejemplo a continuación:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/applications/$APP_ID
```

La respuesta debería ser:

```
{
    "user_id":"{user_id}",
    "app_id":"{app_id}",
    "msg":"Autorización eliminada"
}
```

## Métricas de consumo de su aplicación

Para acceder el detalle de todo consumo de los recursos de MeLi desde su aplicación, simplemente realiza el siguiente GET:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/applications/v1/$APP_ID/consumed-applications?date_start=2025-08-01&date_end=2025-08-20
```

Respueta:

```
{
    "app_id": 5555737222442288,
    "total_request": 3773948444,
    "request_by_status": [
        {
            "total_request": 1,
            "status": 412,
            "percentage": 0
        },
        {
            "total_request": 108,
            "status": 502,
            "percentage": 0.0000029
        },
        {
            "total_request": 253,
            "status": 534,
            "percentage": 0.0000067
        },
        {
            "total_request": 680,
            "status": 423,
            "percentage": 0.000018
        },
        {
            "total_request": 15587,
            "status": 503,
            "percentage": 0.000413
        },
        {
            "total_request": 19393,
            "status": 405,
            "percentage": 0.0005139
        },
        {
            "total_request": 56464,
            "status": 499,
            "percentage": 0.0014962
        },
        {
            "total_request": 64834,
            "status": 204,
            "percentage": 0.0017179
        },
        {
            "total_request": 74716,
            "status": 535,
            "percentage": 0.0019798
        },
        {
            "total_request": 150226,
            "status": 500,
            "percentage": 0.0039806
        },
        {
            "total_request": 202157,
            "status": 409,
            "percentage": 0.0053566
        },
        {
            "total_request": 425759,
            "status": 422,
            "percentage": 0.0112815
        },
        {
            "total_request": 638862,
            "status": 201,
            "percentage": 0.0169282
        },
        {
            "total_request": 1999743,
            "status": 400,
            "percentage": 0.0529881
        },
        {
            "total_request": 4764611,
            "status": 429,
            "percentage": 0.12625
        },
        {
            "total_request": 7441701,
            "status": 206,
            "percentage": 0.1971861
        },
        {
            "total_request": 12630990,
            "status": 401,
            "percentage": 0.334689
        },
        {
            "total_request": 29612527,
            "status": 404,
            "percentage": 0.7846564
        },
        {
            "total_request": 91749024,
            "status": 403,
            "percentage": 2.4311149
        },
        {
            "total_request": 3624100808,
            "status": 200,
            "percentage": 96.0294202
        }
    ],
    "top_apis_consumed": [
        {
            "resource_id": "read.items-visits",
            "resource_name": "METRICAS",
            "hierarchy1": "VISITAS",
            "hierarchy2": "VISITAS_USUARIOS_ITEMS",
            "percentage_request_successful": 94.4858993
        },
        {
            "resource_id": "public-read.items-prices-api",
            "resource_name": "PUBLICA_SINCRONIZA",
            "hierarchy1": "PRECIOS",
            "hierarchy2": "CONSULTAR_PRECIOS",
            "percentage_request_successful": 99.6489243
        },
        {
            "resource_id": "items-public.multigetapi",
            "resource_name": "PUBLICA_SINCRONIZA",
            "hierarchy1": "ITEMS",
            "hierarchy2": "BUSQUEDA_MULTIGET",
            "percentage_request_successful": 99.952714
        },
        {
            "resource_id": "public.pc-open-platform-api",
            "resource_name": "COMUNICACION",
            "hierarchy1": "RECLAMOS",
            "hierarchy2": "DETALLES_DEVOLUCION",
            "percentage_request_successful": 91.8956306
        },
        {
            "resource_id": "public.pc-open-platform-api",
            "resource_name": "COMUNICACION",
            "hierarchy1": "RECLAMOS",
            "hierarchy2": "DETALLES_DEVOLUCION",
            "percentage_request_successful": 0.0014296
        },
        {
            "resource_id": "public.shipping-mandatory-api",
            "resource_name": "VENTAS_ENVIOS",
            "hierarchy1": "COSTOS_ENVIOS_SLA",
            "hierarchy2": "CONSULTAR_COSTOS_ENVIOS",
            "percentage_request_successful": 99.8737551
        },
        {
            "resource_id": "public.shipping-shipments-api",
            "resource_name": "VENTAS_ENVIOS",
            "hierarchy1": "MERCADO_ENVIOS",
            "hierarchy2": "GESTIONAR_ENVIOS",
            "percentage_request_successful": 99.9241283
        },
        {
            "resource_id": "public-postsale-read.supply-messages-gateway",
            "resource_name": "MENSAJERIA",
            "hierarchy1": "MOTIVOS",
            "hierarchy2": "CONSULTAR_MOTIVOS_Y_MENSAJES_POR_ID",
            "percentage_request_successful": 99.8578694
        }
    ],
    "top_apis_consumed_error": [
        {
            "resource_id": "public.pc-open-platform-api",
            "errors_by_resource_id": 9272595,
            "resource_name": "COMUNICACION",
            "hierarchy1": "RECLAMOS",
            "hierarchy2": "DETALLES_DEVOLUCION",
            "percentage_errors": 8.1029398
        },
        {
            "resource_id": "read.items-visits",
            "errors_by_resource_id": 4200509,
            "resource_name": "METRICAS",
            "hierarchy1": "VISITAS",
            "hierarchy2": "VISITAS_USUARIOS_ITEMS",
            "percentage_errors": 5.5141007
        },
        {
            "resource_id": "public-read.items-prices-api",
            "errors_by_resource_id": 2041039,
            "resource_name": "PUBLICA_SINCRONIZA",
            "hierarchy1": "PRECIOS",
            "hierarchy2": "CONSULTAR_PRECIOS",
            "percentage_errors": 0.3510757
        },
        {
            "resource_id": "public-postsale-read.supply-messages-gateway",
            "errors_by_resource_id": 135181,
            "resource_name": "MENSAJERIA",
            "hierarchy1": "MOTIVOS",
            "hierarchy2": "CONSULTAR_MOTIVOS_Y_MENSAJES_POR_ID",
            "percentage_errors": 0.1421306
        },
        {
            "resource_id": "public.shipping-mandatory-api",
            "errors_by_resource_id": 912460,
            "resource_name": "VENTAS_ENVIOS",
            "hierarchy1": "COSTOS_ENVIOS_SLA",
            "hierarchy2": "CONSULTAR_COSTOS_ENVIOS",
            "percentage_errors": 0.1262449
        },
        {
            "resource_id": "public.shipping-shipments-api",
            "errors_by_resource_id": 600915,
            "resource_name": "VENTAS_ENVIOS",
            "hierarchy1": "MERCADO_ENVIOS",
            "hierarchy2": "GESTIONAR_ENVIOS",
            "percentage_errors": 0.0758717
        },
        {
            "resource_id": "items-public.multigetapi",
            "errors_by_resource_id": 376990,
            "resource_name": "PUBLICA_SINCRONIZA",
            "hierarchy1": "ITEMS",
            "hierarchy2": "BUSQUEDA_MULTIGET",
            "percentage_errors": 0.047286
        }
    ]
}
```

### Consideraciones

- El parámetros de fecha es opcional, si no es agregado, el recurso devuelve la data del consumo de los ultimoos 15 días.

- La información es actualizada como D-1, o sea siempre vas a tener el consumo hasta el dia anteior a la fecha actual.

- Recomendamos que busquen por rangos mensuales y no con algo muy extenso, pues por la cantidad de data puedes tardar mucho y terminar con un error de timeout esta llamada.
