<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/estadisticas-de-interacciones-en-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Estadísticas de interacciones en Inmuebles

Última actualización 06/11/2025

## Estadísticas de interacciones en Inmuebles

Cuando los usuarios de MercadoLibre interactúan con publicaciones de inmuebles van generando estadísticas que permitirán a los sellers tomar decisiones sobre la gestión de su inventario. En esta sección MLA trataremos los tipos de interacciones que puede tener un usuario en una publicación y recursos de nuestra API que te permitirán saber cuántas de estas interacciones genera.

## Tipo de interacciones

Cuando los usuarios ingresan a una publicación se genera el primer registro de interacción la cual es una visita. Dependiendo si el usuario se encuentra interesado o no en el inmueble, esta visita puede evolucionar a:

- **Contacto o pregunta:**  Es la interacción donde un usuario se dirige al botón de contacto o en la sección de pregunta y deja un comentario.

- **WhatsApp:**  Es la interacción donde un usuario selecciona el botón de WhatsApp (siempre y cuando el seller haya registrado en la publicación un número de teléfono en la publicación) y este termina derivado a un chat con el seller, sea por WhatsApp WEB o por su versión móvil.

- **Teléfono:**  Es la interacción donde un usuario selecciona el botón de “Ver número Telefónico” el cual entrega un número de contacto del seller.

- **Cotizaciones:**  El usuario comprador tiene la posibilidad de pedir una cotización para informarse de los detalles y valor del inmueble en el cual está interesado. Una cotización ocurre cuando el interesado realiza una consulta en un anuncio.

Las interacciones en las publicaciones son independientes entre sí, por tanto, un usuario puede ser capaz de generar múltiples interacciones al mismo tiempo como generar una visita, generar una pregunta o contacto, rescatar el número telefónico o derivar a un chat de WhatsApp.

Importante:

En esta guía veremos recursos que solo te permiten ver las **cantidades**  de estas interacciones; si necesitas recuperar la demás información de contacto de los usuarios para los sellers te invitamos a revisar la sección de [Leads](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles).

## Visitas

### Visitas por vendedor - total de visitas entre rangos de fechas

Para obtener la cantidad de visitas que ha obtenido un seller en un rango de fechas dado, puede hacerse mediante la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/items_visits?date_from=$DATE_FROM&date_to=$DATE_TO'
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | Id del seller por el cual se consulta |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial desde la cual se cuenta las visitas, en el formato YYYY-mm-dd, por ejemplo: 2021-01-01. |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final desde que se cuentan las visitas, en el formato YYYY-mm-dd, por ejemplo: 2021-02-01. |

Obtendrá una respuesta como la siguiente:

```
{
  "user_id": 1000011398,
  "date_from": "2021-01-01T00:00:00Z",
  "date_to": "2021-02-01T00:00:00Z",
  "total_visits": 690,
  "visits_detail": [
    {
      "company": "mercadolibre",
      "quantity": 690
    }
  ]
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| user_id | number | Identificador del usuario (seller) para el que se recuperaron las estadísticas de visitas. |
| date_from | date/time | Fecha inicial del rango de tiempo para las visitas. |
| date_to | date/time | Fecha final del rango de tiempo para las visitas. |
| total_visits | number | Número total de visitas recibidas por el usuario durante el rango de tiempo especificado. |
| visits_detail | array | Detalles de las visitas, incluyendo la compañía y la cantidad de visitas. |
| company | string | Nombre de la compañía. |
| quantity | number | Cantidad de visitas. |

### Cantidad de Visitas Recientes por Usuario

Para obtener la cantidad de visitas recientes, puede hacerlo ejecutando la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/items_visits/time_window?last=$LAST&unit=$UNIT&ending=$ENDING'
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en unit, por ejemplo `last=2&unit=day` (Últimos 2 días). |
| $UNIT | integer | Sí | Unidades de tiempo, por ejemplo `unit=day` (por defecto) u `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo. Si no se declara, la fecha de la consulta será fecha y hora actual. |

Obtendrá un resultado como el siguiente:

```
{
  "user_id": 1765562240,
  "date_from": "2025-03-04T00:00:00-04:00",
  "date_to": "2025-03-16T00:00:00-04:00",
  "total_visits": 20,
  "last": 12,
  "unit": "day",
  "results": [
    {
      "date": "2025-03-10T00:00:00Z",
      "total": 4,
      "visits_detail": [
        { "company": "mercadolibre", "quantity": 4 }
      ]
    },
    {
      "date": "2025-03-13T00:00:00Z",
      "total": 2,
      "visits_detail": [
        { "company": "mercadolibre", "quantity": 2 }
      ]
    }
  ]
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| user_id | number | Identificador del usuario (seller) para el que se recuperaron las estadísticas de visitas. |
| date_from | date/time | Fecha inicial del rango de tiempo para las visitas. |
| date_to | date/time | Fecha final del rango de tiempo para las visitas. |
| total_visits | number | Número total de visitas recibidas por el usuario durante el rango de tiempo especificado. |
| last | number | Última cantidad de tiempo definida en la unidad especificada. |
| unit | string | Unidades de tiempo (por ejemplo, "day"). |
| results | array | Lista de objetos que contienen datos de resultados por día. |
| results[n].date | date/time | La fecha específica del resultado dentro del período. |
| results[n].total | number | El número total de visitas asociadas a la fecha específica del resultado. |
| results[n].visits_detail[m].company | string | Nombre de la compañía para las visitas en una fecha específica. |
| results[n].visits_detail[m].quantity | number | Cantidad de visitas para una compañía en una fecha específica. |

## Visitas por Publicación

### Todas las visitas de una publicación

Para obtener todas las visitas que ha recibido un inmueble, basta con tener el id de la publicación y ejecutar la siguiente llamada.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/visits/items?ids=$ITEM_ID'
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $ITEM_ID | string | No | ID de la publicación |

Obtendrá una respuesta como la siguiente:

```
{
  "MLA123456789": 98
}
```

### Total entre rangos de fechas

Para obtener todas las visitas que ha recibido un inmueble en un rango de fechas, basta con tener el id de la publicación y ejecutar el siguiente comando con el rango de fechas que desea consultar.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/visits?ids=$ITEM_ID&date_from=$DATE_FROM&date_to=$DATE_TO'
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $ITEM_ID | string | No | ID de la publicación |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial desde la cual se cuenta las visitas, en el formato YYYY-mm-dd, por ejemplo: 2021-01-01. |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final desde que se cuentan las visitas, en el formato YYYY-mm-dd, por ejemplo: 2021-01-01. |

La respuesta será similar a las anteriores.

```
{
  "item_id": "MLA473861358",
  "date_from": "2025-01-01T00:00:00Z",
  "date_to": "2025-02-01T00:00:00Z",
  "total_visits": 536,
  "visits_detail": [
    { "company": "mercadolibre", "quantity": 536 }
  ]
}
```

## Preguntas

Puedes obtener el número total de preguntas hechas en una publicación específica o el total de preguntas que un vendedor recibió en todas sus publicaciones dentro de un periodo de tiempo determinado. A continuación te listamos las consultas posibles.

### Preguntas por Publicación

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/$ITEM_ID/contacts/questions?date_from=$DATE_FROM&date_to=$DATE_TO'
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $ITEM_ID | string | No | ID de la publicación |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial del rango a consultar, en el formato YYYY-mm-dd, por ejemplo: 2021-01-01. |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final del rango a consultar, en el formato YYYY-mm-dd, por ejemplo: 2021-01-01. |

Obtendrás un resultado similar al siguiente ejemplo:

```
{
  "date_from": "2014-08-01T00:00:00.000-03:00",
  "date_to": "2014-08-02T23:59:59.999",
  "item_id": "MLA421672596",
  "total": 9
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| date_from | String | Fecha inicial del periodo del reporte. |
| date_to | String | Fecha final del periodo del reporte. |
| item_id | String | ID del ítem. |
| total | Int | El número total de preguntas al ítem en este periodo. |

### Preguntas asociadas a un usuario

Puedes consultar la cantidad de preguntas asociadas a un usuario, haciendo el siguiente llamado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/contacts/questions?date_from=$DATE_FROM&date_to=$DATE_TO'
```

| Parámetro | Tipo | Opcional | Valores / Descripción |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en la guía de configuración |
| USER_ID | String | No | id del usuario a consultar |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial del rango a consultar |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final del rango a consultar |

La respuesta obtenida será similar a la mencionada anteriormente, pero en este caso estará enfocada en el usuario en lugar del ítem.

```
{
  "date_from": "2025-01-01T00:00:00.000-03:00",
  "date_to": "2025-01-31T23:59:59.999",
  "user_id": "1672596785",
  "total": 5
}
```

### Preguntas recientes

Puedes obtener la cantidad de preguntas en una ventana de tiempo dada, esto mediante el siguiente llamado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/contacts/questions/time_window?last=$LAST&unit=$UNIT&ending=$ENDING'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en unit, por ejemplo `last=2&unit=day` (Últimos 2 días). |
| $UNIT | integer | Sí | Unidades de tiempo por ejemplo `unit=day` (por defecto) u `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo. Si no se declara, la fecha de la consulta será fecha y hora actual. |

El resultado es similar a los anteriores:

```
{
  "user_id": "510272257",
  "total": 5,
  "date_from": "2025-06-06T12:00:00Z",
  "date_to": "2025-06-06T14:00:00Z",
  "last": 2,
  "unit": "hour",
  "results": [
    { "date": "2025-06-06T13:00:00Z", "total": 3 },
    { "date": "2025-06-06T14:00:00Z", "total": 2 }
  ]
}
```

## Teléfono

Similar a cómo se consulta el número de preguntas hechas a un ítem, es posible ver la cantidad total de clics en 'Ver teléfono' de una publicación o de todas las publicaciones de un usuario dentro de un rango de fechas. Te presentamos las consultas disponibles relacionadas al teléfono.

### Solicitudes de teléfono por publicación

Puedes consultar la cantidad de interacciones que ha habido con el teléfono desde un ítem entre un rangos de fechas haciendo el siguiente llamado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/$ITEM_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $ITEM_ID | string | No | ID del item |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial de rango a consultar |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final de rango a consultar |

Respuesta:

```
{
  "date_from": "2025-01-13T00:00:00.000-03:00",
  "date_to": "2025-06-01T23:59:59.999",
  "total": 2,
  "item_id": "MLA52366166"
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| date_from | String | Fecha inicial del periodo del reporte. |
| date_to | String | Fecha final del periodo del reporte. |
| item_id | String | ID del ítem. |
| total | Int | El número total de preguntas al ítem en este periodo. |

### Solicitudes de teléfono por usuario

De igual forma, puedes consultar la cantidad de interacciones con el teléfono asociadas a un usuario, haciendo el siguiente llamado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del usuario |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial del rango a consultar |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final del rango a consultar |

Respuesta:

```
{
  "date_from": "2025-01-01T00:00:00.000-03:00",
  "date_to": "2025-05-29T23:59:59.999",
  "total": 71,
  "user_id": "52366166"
}
```

### Usos del botón teléfono recientes

Accede al número total de clics en 'Ver teléfono' de un anuncio o de todos los anuncios de un usuario en un lapso determinado. Además del total de visitas, los datos se desglosan y organizan por períodos de tiempo.

#### Relacionadas a un usuario se obtiene de la siguiente manera:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views/time_window?last=$LAST&unit=$UNIT&ending=$ENDING'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en `unit`, por ejemplo `last=2&unit=day`.  Indica los últimos **2 días** . |
| $UNIT | integer | Sí | Unidades de tiempo, por ejemplo `unit=day` (por defecto).  La otra opción posible es `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo.  Si no se declara, la fecha de la consulta será la fecha y hora actual. |

#### Relacionadas a un ítem se hace con el llamado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/$ITEM_ID/contacts/phone_views/time_window?last=$LAST&unit=$UNIT&ending=$ENDING'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en `unit`, por ejemplo `last=2&unit=day`.  Indica los últimos **2 días** . |
| $UNIT | integer | Sí | Unidades de tiempo, por ejemplo `unit=day` (por defecto).  La otra opción posible es `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo.  Si no se declara, la fecha de la consulta será la fecha y hora actual. |

Puedes concatenar varios id de ítems separados por coma de la siguiente manera:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/contacts/phone_views/time_window?ids=$ID1,ID2&last=$LAST&unit=$UNIT&ending=$ENDING_NOTE'
```

En cualquiera de los dos casos obtendrás una respuesta similar a la siguiente:

```
[
  {
    "item_id": "MLA510272257",
    "total": 0,
    "date_from": "2014-05-28T02:00:00Z",
    "date_to": "2014-05-28T04:00:00Z",
    "last": 2,
    "unit": "hour",
    "results": [
      { "date": "2014-05-28T02:00:00Z", "total": 0 },
      { "date": "2014-05-28T03:00:00Z", "total": 0 }
    ]
  },
  {
    "item_id": "MLA489747739",
    "total": 0,
    "date_from": "2014-05-28T02:00:00Z",
    "date_to": "2014-05-28T04:00:00Z",
    "last": 2,
    "unit": "hour",
    "results": [
      { "date": "2014-05-28T02:00:00Z", "total": 0 },
      { "date": "2014-05-28T03:00:00Z", "total": 0 }
    ]
  }
]
```

## WhatsApp

También se puede consultar el número total de clics en la opción de WhatsApp de una publicación, o para cada anuncio de un usuario, dentro de un periodo de fechas específico.

### Derivaciones a WhatsApp por usuario

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  \
'https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial del rango de fechas a consultar |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final del rango de fechas a consultar |

Obtendrás una respuesta como la siguiente :

```
{
  "total": 174,
  "date_from": "2025-01-01T00:00:00Z",
  "date_to": "2025-04-01T17:01:00Z",
  "user_id": "127232529"
}
```

### Interacciones con WhatsApp recientes por usuario

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$USER_ID/contacts/whatsapp/time_window?unit=$UNIT&last=$LAST&ending=$ENDING'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en unit, por ejemplo `last=2&unit=day` (Últimos 2 días). |
| $UNIT | integer | Sí | Unidades de tiempo por ejemplo `unit=day` (por defecto) u `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo. Si no se declara, la fecha de la consulta será fecha y hora actual. |

Obtendrás una respuesta como la siguiente:

```
{
  "total": 31,
  "last": "3",
  "unit": "day",
  "date_from": "2022-10-26T04:00:00Z",
  "date_to": "2022-10-29T04:00:00Z",
  "user_id": "127232529",
  "results": [
    { "date": "2022-10-26T04:00:00Z", "total": 7 },
    { "date": "2022-10-27T04:00:00Z", "total": 16 },
    { "date": "2022-10-28T04:00:00Z", "total": 8 }
  ]
}
```

### Derivaciones a WhatsApp por publicación

De igual manera que en casos anteriores, puedes obtener las interacciones con el botón de whatsapp por publicación así:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  \
'https://api.mercadolibre.com/items/$ITEM_ID/contacts/whatsapp?date_from=$DATE_FROM&date_to=$DATE_TO'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $ITEM_ID | string | No | ID de la publicación |
| $DATE_TO | date (ISO 8601) | Sí | Fecha inicial del rango a consultar |
| $DATE_FROM | date (ISO 8601) | Sí | Fecha final del rango a consultar |

Obteniendo una respuesta similar a la siguiente:

```
{
  "total": 3,
  "date_from": "2025-02-14T17:01:00Z",
  "date_to": "2025-02-29T17:01:00Z",
  "item_id": "MLA1116194549"
}
```

### Derivaciones a WhatsApp por publicación recientes

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/$ITEM_ID/contacts/whatsapp/time_window?unit=$UNIT&last=$LAST&ending=$ENDING'
```

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| $ACCESS_TOKEN | string | No | Token de autenticación de la API |
| $USER_ID | string | No | ID del seller |
| $LAST | option | Sí | Última cantidad de tiempo definida en unit, por ejemplo `last=2&unit=day` (Últimos 2 días). |
| $UNIT | integer | Sí | Unidades de tiempo por ejemplo `unit=day` (por defecto) u `hour`. |
| $ENDING | date (ISO 8601) | Sí | Fecha ISO límite para el conteo. Si no se declara, la fecha de la consulta será fecha y hora actual. |

Opcionalmente puedes consultar múltiples publicaciones separando su id por coma, usando el siguiente ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/contacts/whatsapp/time_window?ids=$ID1,$ID2&unit=$UNIT&last=$LAST&ending=$ENDING'
```

Obtendrás una respuesta similar a la siguiente:

```
{
  "total": 31,
  "last": "3",
  "unit": "day",
  "date_from": "2025-02-26T04:00:00Z",
  "date_to": "2025-02-29T04:00:00Z",
  "item_id": "MLA127232529",
  "results": [
    { "date": "2025-02-26T04:00:00Z", "total": 7 },
    { "date": "2025-02-27T04:00:00Z", "total": 16 },
    { "date": "2025-02-28T04:00:00Z", "total": 8 }
  ]
}
```

### Campos de respuesta

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| total | Int | El número total de interacciones. |
| last | String | El número de unidades de tiempo consideradas para el reporte. |
| unit | String | La unidad de tiempo (por ejemplo, "day" para días). |
| date_from | String | La fecha de inicio del período del reporte. |
| date_to | String | La fecha final del período del reporte. |
| user_id | String | El ID del usuario. |
| results | Array | Lista de objetos que contienen datos de resultados por día. |
| results[n].date | String | La fecha específica del resultado dentro del período. |
| results[n].total | Int | El número total de interacciones asociadas a la fecha específica del resultado. |

### Lecturas recomendadas

- [Leads](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
