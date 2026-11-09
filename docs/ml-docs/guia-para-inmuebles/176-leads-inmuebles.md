<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Leads

Última actualización 06/11/2026

## Leads

Un lead es un contacto realizado por un comprador que ha mostrado interés en una publicación. A menudo, se trata de una interacción inicial. Esta interacción puede manifestarse de diversas formas, que incluyen:

- whatsapp: un comprador utiliza el botón de WhatsApp.

- question: un comprador formula una pregunta.

- call: un comprador utiliza el botón para realizar una llamada.

- schedule: el comprador agenda una visita.

- quotation: un comprador solicita una cotización del inmueble (si está disponible).

## Consultar interesados en los ítems del vendedor

El vendedor puede consultar todos los datos de contacto de los interesados en sus ítems, con la posibilidad de paginarlos mediante el parámetro **offset** , que indica la posición del primer elemento a recuperar, y el parámetro **limit** , que señala la cantidad máxima de elementos a obtener. Además, los datos pueden ser filtrados por un período de tiempo específico, usando los parámetros **date_from**  y **date_to** . Para realizar una búsqueda más específica, se puede utilizar el parámetro **contact_types** , que representa el tipo de contacto a retornar.

Adicionalmente, el vendedor puede consultar los leads generados por usuarios no logueados utilizando el parámetro opcional **include_guest=true** , que agrega a la respuesta estándar dos nuevos nodos estructurales: **guest**  y **summary** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
'https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers?offset=$OFFSET&limit=$LIMIT&date_from=$DATE_FROM&date_to=$DATE_TO&contact_types=$CONTACT_TYPES&item_id=$ITEM_ID&buyer_ids=$BUYER_IDS'
```

### Parámetros de la consulta

| Parámetro | Tipo de Dato | Opcional | Valores / Descripción |
| --- | --- | --- | --- |
| USER_ID | int | No | Identificador del vendedor. |
| OFFSET | int | Sí | Posición del primer elemento en la lista. Valor por defecto: 0. |
| LIMIT | int | Sí | Cantidad máxima de elementos del listado. Valor por defecto: 10. |
| DATE_FROM | string (YYYY-MM-DD) | Sí | Fecha de inicio de la búsqueda. Valor por defecto: 7 días antes de la fecha actual. |
| DATE_TO | string (YYYY-MM-DD) | Sí | Fecha de término de la búsqueda. Valor por defecto: fecha actual. |
| CONTACT_TYPES | string | Sí | Tipos de contactos a retornar. Si no se envía, se retornan todos los tipos. |
| ITEM_ID | string | Sí | Identificador del ítem, formato MLX12345678. |
| BUYER_IDS | int o lista de int | Sí | Identificadores del comprador, separados por coma si son más de uno. |
| INCLUDE_GUEST | boolean | Sí | Indica si se deben incluir los leads generados por usuarios no logueados (guest) en la respuesta. Al activarse, se agregan las estructuras guest y summary. |

Nota:

Los parámetros de paginado (offset y limit) no afectan a los leads de **tipo guest** , los cuales se devuelven siempre completos según el rango de date_from y date_to solicitado.

Respuesta de ejemplo:

```
{
  "results": [
    {
      "id": 1914813422,
      "item_id": "MLA2919342112",
      "name": "Test Test",
      "email": "test.test+1914813422@mercadolibre.com",
      "phone": "+56 01 1111-1111",
      "identification_number": "7894564123-7",
      "identification_type": "RUT",
      "leads": [
        {
          "id": "214e7c51-076b-495c-aec4-a326e8eecb0d",
          "uuid": "214e7c51-076b-495c-aec4-a326e8eecb0d",
          "channel": "question",
          "contact_type": "question",
          "created_at": "2025-06-12T20:56:45.174Z",
          "external_id": "13358605478",
          "item_id": "MLA2919342112",
          "status": "active"
        }
      ]
    },
    {
      "id": 1554225116,
      "item_id": "MLA2832508942",
      "name": "Tester Inmo",
      "email": "Tester.inmo+1554225116@mercadolibre.com",
      "phone": "+56 572369293",
      "identification_number": "11111111-1",
      "identification_type": "RUT",
      "leads": [
        {
          "id": "237df990-115b-4d16-b80e-cc70f9fafb84",
          "uuid": "237df990-115b-4d16-b80e-cc70f9fafb84",
          "channel": "question",
          "contact_type": "question",
          "created_at": "2025-05-26T17:46:51.2Z",
          "external_id": "13345640067",
          "item_id": "MLA2832508942",
          "status": "active"
        }
      ]
    },
    {
      "id": 1914813422,
      "item_id": "MLA1612742785",
      "name": "Test Test",
      "email": "test.test+1914813422@mercadolibre.com",
      "phone": "+56 01 1111-1111",
      "identification_number": "78708960-7",
      "identification_type": "RUT",
      "leads": [
        {
          "id": "9fe96952-454c-47bf-abb5-657f069592e9",
          "uuid": "9fe96952-454c-47bf-abb5-657f069592e9",
          "channel": "question",
          "contact_type": "question",
          "created_at": "2025-05-20T15:05:13.603Z",
          "external_id": "13341528179",
          "item_id": "MLA1612742785",
          "status": "active"
        }
      ]
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 3
  },
  "date_from": "2025-04-18",
  "date_to": "2025-06-18"
}
```

### Descripción de la respuesta

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| results | array<objeto> | Lista de resultados, cada uno representando un comprador con sus detalles y leads. |
| results.id | número | Identificador único del comprador. |
| results.item_id | string | Identificador del ítem asociado al comprador. |
| results.name | string | Nombre del comprador. Dato visible solo si el acceso es por usuario logueado. |
| results.email | string | Correo electrónico del comprador. Dato visible solo si el acceso es por usuario logueado. |
| results.phone | string | Número de teléfono del comprador. Dato visible solo si el acceso es por usuario logueado. |
| results.identification_number | string | Número de identificación del comprador. Dato visible solo si el acceso es por usuario logueado. |
| results.identification_type | string | Tipo de identificación del comprador. Dato visible solo si el acceso es por usuario logueado. |
| results.leads | array<objeto> | Lista de leads generados por el comprador. |
| results.leads.id | string | Identificador único del lead. |
| results.leads.uuid | string | UUID del lead (igual a su ID). |
| results.leads.channel | string | Canal por el cual se generó el lead (p. ej., "question"). |
| results.leads.contact_type | string | Tipo de contacto del lead (p. ej., "question"). |
| results.leads.created_at | string (fecha/hora) | Fecha y hora de creación del lead en formato ISO 8601. |
| results.leads.external_id | string | Identificador externo del lead (p. ej., id de pregunta). |
| results.leads.item_id | string | Identificador del ítem asociado al lead, formato MLX########. |
| results.leads.status | string | Estado del lead. |
| paging | objeto | Información sobre la paginación de los resultados. |
| paging.offset | número | Posición del primer elemento en la lista de resultados. |
| paging.limit | número | Cantidad máxima de elementos en la lista de resultados. |
| paging.total | número | Cantidad total de elementos disponibles. |
| date_from | string (YYYY-MM-DD) | Fecha de inicio del periodo de búsqueda en formato YYYY-MM-DD. |
| date_to | string (YYYY-MM-DD) | Fecha de fin del periodo de búsqueda en formato YYYY-MM-DD. |

### Ejemplo de llamada con el parámetro opcional include_guest=true

El objetivo es permitir que el vendedor cuantifique el volumen total de interés y clics en sus publicaciones provenientes de usuarios no registrados, facilitando para un análisis de métricas más completo y real.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/users/3052668868/leads/buyers?offset=0&limit=10&date_from=2026-01-15&date_to=2026-01-22&contact_types=credit,question,whatsapp&include_guest=true
```

Respuesta:

```
{
    "results": [
        {
            "id": 2522572034,
            "item_id": "MLC3404674016",
            "name": "Test Test",
            "email": "test_user_2030409702@testuser.com",
            "phone": "+56 01 1111-1111",
            "identification_number": "67602099-3",
            "identification_type": "RUT",
            "leads": [
                {
                    "id": "b711e264-ec67-480e-90b2-444d8f47d5ed",
                    "uuid": "b711e264-ec67-480e-90b2-444d8f47d5ed",
                    "channel": "whatsapp",
                    "contact_type": "whatsapp",
                    "created_at": "2026-01-22T21:01:47Z",
                    "external_id": "",
                    "item_id": "MLC3404674016",
                    "status": "active"
                }
            ]
        },
        {
            "id": 2522572034,
            "item_id": "MLC3404028058",
            "name": "Test Test",
            "email": "test_user_2030409702@testuser.com",
            "phone": "+56 01 1111-1111",
            "identification_number": "67602099-3",
            "identification_type": "RUT",
            "leads": [
                {
                    "id": "5a6732a1-6051-4281-a470-d81cb43acecb",
                    "uuid": "5a6732a1-6051-4281-a470-d81cb43acecb",
                    "channel": "question",
                    "contact_type": "question",
                    "created_at": "2026-01-22T20:44:05.3Z",
                    "external_id": "13510887742",
                    "item_id": "MLC3404028058",
                    "status": "active"
                }
            ]
        }
    ],
    "paging": {
        "offset": 0,
        "limit": 10,
        "total": 2
    },
    "date_from": "2026-01-15",
    "date_to": "2026-01-22",
    "guest": [
        {
            "item_id": "MLC3404674016",
            "leads": [
                {
                    "id": "56c71b07-f347-41e2-8f63-4f81dda74491",
                    "contact_type": "whatsapp",
                    "status": "active",
                    "created_at": "2026-01-22T20:30:52Z"
                }
            ]
        }
    ],
    "summary": [
        {
            "item_id": "MLC3404674016",
            "total": 2,
            "user": 1,
            "guest": 1
        },
        {
            "item_id": "MLC3404028058",
            "total": 1,
            "user": 1,
            "guest": 0
        }
    ]
}
```

### Campos adicionales al utilizar el parámetro include_guest=true

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| guest | array<objeto> | Contiene el listado de leads generados por usuarios no logueados (guest), agrupados por ítem. |
| guest.item_id | string | identificador del ítem. |
| guest.leads | array | Contiene el listado de leads generados por usuarios no logueados para el ítem. |
| guest.leads.id | string | Identificador único del lead. |
| guest.leads.contact_type | string | Tipo de contacto del lead (p. ej., "whatsapp"). |
| guest.leads.status | string | Estado del lead. |
| guest.leads.created_at | string (fecha/hora) | Fecha y hora de creación del lead en formato ISO 8601. |
| summary | array<objeto> | Contiene un resumen por ítem de la cantidad total de leads y su distribución por tipo de usuario. |
| summary.item_id | string | Identificador del ítem. |
| summary.total | string | Cantidad total de leads del ítem en el período consultado. |
| summary.user | string | Cantidad de leads generados por usuarios logueados. |
| summary.guest | string | Cantidad de leads generados por usuarios no logueados. |

## Consultar Leads

A continuación, se muestran ejemplos de cómo realizar consultas de leads específicos.Recuerda tener a mano tu Access Token generado en el módulo de Autorización.

### Consultar todos los leads de un usuario

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
'https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers'
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token válido para el usuario consultado. |
| USER_ID | string | No | ID del vendedor a consultar. |

### Consultar todos los leads de un ítem asociado a un vendedor

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
'https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers?item_id=MLX1234'
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token válido para el usuario consultado. |
| USER_ID | string | No | ID del vendedor a consultar. |
| item_id | string | No | ID del ítem específico a consultar. |

### Consultar los leads de tipo de contacto específico

Se puede iterar el atributo contact_type con los siguientes valores: whatsapp, question, call, quotation y schedule. Este último devolverá resultados solo si el ítem tiene disponible esta funcionalidad. En caso contrario, no dará error, pero devolverá un arreglo vacío.

A continuación, se muestra un ejemplo utilizando el contact_type de whatsapp:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
'https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers?contact_types=whatsapp'
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token válido para el usuario consultado. |
| USER_ID | string | No | ID del vendedor a consultar. |
| contact_types | string | No | Lead que desea consultar: whatsapp, question, call, schedule y quotation. |

El código de respuesta debe ser 200, lo que devolverá un JSON con la información solicitada. En caso de que el código de respuesta sea diferente, por favor revisa la sección de posibles errores.

Recibirás una respuesta similar a la siguiente:

```
{
  "results": [
    {
      "id": 2678328,
      "item_id": "MLA1430828018",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+5491198765432",
      "leads": [
        {
          "id": "6b4aebf8-5570-47b8-9224-c1c177621575",
          "contact_type": "question",
          "created_at": "2024-05-14T14:15:39Z",
          "external_id": "12776297658",
          "item_id": "MLA1430828018",
          "buyer_id": 2678328,
          "status": "active",
          "sub_status": "answered"
        }
      ]
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 1
  },
  "date_from": "2024-05-14",
  "date_to": "2024-05-24"
}
```

La cual es similar a la inicialmente vista que puedes consultar más a detalle en la tabla relacionada.

## Obtener detalles de un Lead

Cuando MercadoLibre notifica sobre la creación de un nuevo lead relacionado a los interesados, menciona el ID en el mensaje. Para obtener los detalles, debes usar dicho identificador en el recurso /vis/leads/$LEAD_ID, lo cual te proporcionará la información correspondiente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/vis/leads/$LEAD_ID
```

### Parámetro

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba” |
| LEAD_ID | String | No | Identificador de un lead, es un valor similar al siguiente: 6b4aebf8-5570-47b8-9224-c1c177621575. |

Nota: Al consultar los leads, se puede obtener en la respuesta el campo results.leads.id.

La respuesta obtenida será similar a la siguiente:

```
{
    "id": "44115522",
    "item_id": "MLB4037459422",
    "created_at": "2024-02-14T00:00:00Z",
    "contact_type": "whatsapp",
    "external_id": "13864821",
    "status": "active",
    "buyer_id": 1091441589,
    "name": "Test Test",
    "email": "john@example.com",
    "phone": "+55 01 1111-1111"
}
```

| Campo | Tipo de Dato | Descripción |
| --- | --- | --- |
| id | string | Identificador del lead. |
| item_id | string | Identificador del ítem. |
| created_at | string (fecha) | Fecha de creación del lead. |
| contact_type | string | Tipo de lead. |
| external_id | string | Identificador externo del lead. |
| status | string | Estado del lead. |
| buyer_id | número | Identificador del comprador. |
| name | string | Nombre del comprador. Solo si el acceso es público. |
| email | string | Correo electrónico del comprador. Solo si el acceso es público. |
| phone | string | Teléfono del comprador. Solo si el acceso es público. |

**Identificador de la agenda:**

Este cambio en `external_id` aplica únicamente a los leads con `contact_type` igual a `schedule`. En estos leads, `external_id` identifica la agenda asociada y es diferente del ID del lead. Los demás tipos de lead no se ven afectados por este cambio.

Actualmente, el ID numérico de una agenda ya se entrega en `external_id` como texto, por ejemplo `"4823917"`. Las agendas creadas a partir de la implementación del 21/12/26 tendrán un ID UUID, que puede ser UUIDv7. Las agendas anteriores conservan su mismo ID numérico, que seguirá siendo válido para consulta y actualización después del 31/12. Conserva ambos formatos como texto y evita convertir el identificador a número o depender de que sea secuencial.

Ejemplo parcial de un lead de tipo agenda:

```
{
  "contact_type": "schedule",
  "external_id": "019b4a35-7c00-7a3f-8b92-5d6e7f809abc"
}
```

## Leads de Preguntas

Como se mencionó anteriormente, es posible consultar los leads específicos de una publicación de la siguiente manera, por ejemplo para preguntas:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers?contact_types=question
```

### Parámetro

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| USER_ID | String | No | id del vendedor a consultar |
| contact_types | String | No | Lead que desea consultar, los valores pueden ser whatsapp, question, call y quotation |

Esto devolverá la siguiente información:

```
{
    "results": [
        {
            "id": 2678328,
            "item_id": "MLA1430828018",
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+5491198765432",
            "leads": [
                {
                    "id": "6b4aebf8-5570-47b8-9224-c1c177621575",
                    "contact_type": "question",
                    "created_at": "2024-05-14T14:15:39Z",
                    "external_id": "12776297658",
                    "item_id": "MLA1430828018",
                    "buyer_id": 2678328,
                    "status": "active",
                    "sub_status": "answered"
                }
            ]
        }
    ],
    "paging": {
        "offset": 0,
        "limit": 10,
        "total": 1
    },
    "date_from": "2024-05-14",
    "date_to": "2024-05-24"
}
```

Para obtener el mensaje de la pregunta, no es posible hacerlo consultando el detalle de un lead. En su lugar, se debe consultar a la API de preguntas de la siguiente manera:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/questions/$QUESTION_ID?api_version=4
```

### Parámetro

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba” |
| QUESTION_ID | String | No | Corresponde al external_id de la respuesta anterior. |

La respuesta que se obtendrá será similar a la siguiente:

```
{
   "id": 12776297658,
   "seller_id": 179571326,
   "buyer_id": 2678328,
   "item_id": "MLA1430828018",
   "deleted_from_listing": false,
   "suspected_spam": false,
   "status": "ANSWERED",
   "hold": false,
   "text": "Texto de la pregunta.",
   "app_id": 8304540643508652,
   "date_created": "2021-02-08T17:51:21.746608612Z",
   "last_updated": "2021-02-08T17:51:29.184950392Z",
   "answer": {
       "text": "",
       "status": "BANNED",
       "date_created": "2021-02-16T14:52:13.580-04:00"
   }
}
```

| Campo | Tipo de Dato | Descripción |
| --- | --- | --- |
| id | número | Identificador único de la pregunta (coincide con external_id del lead). |
| seller_id | número | Identificador del vendedor que recibió la pregunta. |
| buyer_id | número | Identificador del comprador que hizo la pregunta. |
| item_id | string | Identificador del ítem al que se le hizo la pregunta. |
| deleted_from_listing | booleano | Indica si la pregunta fue eliminada del listado. |
| suspected_spam | booleano | Indica si la pregunta se considera sospechosa de ser spam. |
| status | string | Estado de la pregunta |
| hold | booleano | Indica si la pregunta está en espera. |
| text | string | Texto de la pregunta. |
| app_id | número | Identificador de la aplicación desde la cual se hizo la pregunta. |
| date_created | string (fecha/hora) | Fecha y hora de creación de la pregunta en formato ISO 8601. |
| last_updated | string (fecha/hora) | Fecha y hora de la última actualización de la pregunta en formato ISO 8601. |
| answer | objeto | Objeto que contiene la información de la respuesta a la pregunta. |
| answer.text | string | Texto de la respuesta. Puede estar vacío si la respuesta está "BANNED". |
| answer.status | string | Estado de la respuesta |
| answer.date_created | string (fecha/hora) | Fecha y hora de creación de la respuesta en formato ISO 8601. |

Importante:

- Si el estado de la pregunta o respuesta es "BANNED", se devolverá un texto vacío. Utiliza el parámetro `api_version=4` para obtener la nueva estructura del JSON.

- Ten en cuenta que las preguntas que tengan más de 7 meses sin responder serán eliminadas.

Para obtener más información sobre cómo interactuar con la API de preguntas, puedes consultar su documentación en: [Documentación de la API de preguntas](https://developers.mercadolibre.com.ar/es_ar/gestiona-preguntas-respuestas).

## Posibles errores

A continuación se describen algunos errores comunes en la búsqueda de leads:

### Código de error 400 - Bad Request

- Mensaje: Invalid date range Motivo: La fecha de inicio es posterior a la fecha de término de la búsqueda.

```
{
    "message": "invalid date range",
    "error": "bad_request",
    "status": 400,
    "cause": [
        "start date is greater than end date"
    ]
}
```

- Mensaje: Invalid Start Date Motivo: Fecha de inicio con formato inválido.

```
{
    "message": "invalid start date",
    "error": "bad_request",
    "status": 400,
    "cause": [
        "parsing time '2021-01-021': extra text: '1'"
    ]
}
```

- Mensaje: Invalid End Date Motivo: Fecha de término con formato inválido.

```
{
    "message": "invalid end date",
    "error": "bad_request",
    "status": 400,
    "cause": [
        "parsing time '2024-01-022': extra text: '2'"
    ]
}
```

- Mensaje: Invalid Format USER_ID Motivo: Identificador de usuario con formato inválido.

```
{
    "code": "bad_request",
    "message": "invalid format USER_ID"
}
```

- Mensaje: Error Decoding Search Params Motivo: Parámetro inválido.

```
{
    "message": "error decoding search params",
    "error": "bad_request",
    "status": 400,
    "cause": [
        "schema: invalid path 'contact_types'"
    ]
}
```

- Mensaje: Invalid Lead Type Motivo: Tipo de contacto inválido.

```
{
    "message": "invalid lead type",
    "error": "bad_request",
    "status": 400,
    "cause": [
        "invalid lead type: invalid"
    ]
}
```

- Mensaje: Missing Lead_ID Motivo: Identificador incorrecto o inexistente.

```
{
    "code": "bad_request",
    "message": "missing lead_id"
}
```

- Mensaje: Invalid CallerID Motivo: El Caller ID proporcionado no está presente o no es correcto.

```
{
    "code": "bad_request",
    "message": "invalid callerID"
}
```

- Mensaje: Invalid ClientID Motivo: El Client ID proporcionado no está presente o no es correcto.

```
{
    "code": "bad_request",
    "message": "invalid clientID"
}
```

### Código de error 403 - Forbidden

- Mensaje: Invalid token caller Motivo: El Access Token no pertenece al vendedor.

```
{
    "code": "forbidden",
    "message": "invalid token caller"
}
```

- Mensaje: At least one policy returned UNAUTHORIZED Motivo: Acceso al endpoint sin Access Token.

```
{
    "blocked_by": "PolicyAgent",
    "path": "/v1/users/806525693/leads/buyers?scope=test-public",
    "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
    "status": 403,
    "message": "At least one policy returned UNAUTHORIZED."
}
```

- Mensaje: Invalid Token Motivo: Access Token inválido o expirado.

```
{
    "code": "forbidden",
    "message": "invalid token"
}
```

### Código de error 404 - Not Found

- Mensaje: Lead not found Motivo: El identificador proporcionado no está asociado a ningún lead del usuario.

```
{
    "code": "not_found",
    "message": "lead not found"
}
```

### Código de error 409 - Too many requests

- Mensaje: Quota Exceeded Motivo: Se han realizado demasiadas solicitudes. Por favor, espera antes de intentarlo nuevamente.

```
{
    "code": "too_many_requests",
    "message": "quota exceeded"
}
```

### Lecturas Recomendadas:

- [Solicitud de visitas](https://developers.mercadolibre.com.ar/es_ar/solicitud-de-visita)

- [Estadísticas de Publicación](https://developers.mercadolibre.cl/es_ar/estadisticas-de-interacciones-en-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
| 26/01/2026 | 1.1 | Agregado el parámetro opcional include_guest=true en el endpoint ["Consultar interesados en los ítems del vendedor"](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles#:~:text=si%20est%C3%A1%20disponible).-,Consultar%20interesados%20en%20los%20%C3%ADtems%20del%20vendedor,-El%20vendedor%20puede). |
