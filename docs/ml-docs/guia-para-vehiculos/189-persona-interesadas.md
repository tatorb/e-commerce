<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/persona-interesadas -->
<!-- Sección: Guía para vehículos -->

# Personas Interesadas

Última actualización 26/01/2026

## Personas Interesadas

Importante:

Este recurso está disponible para vehículos e inmuebles en todos los sites. 
 
El atributo "channels" será deprecado en nuestra API. En su lugar, "contact_types" será el nuevo estándar. Ambos atributos pueden ser utilizados por el momento, pero pronto solo estará disponible "contact_types". Por favor, actualicen sus llamadas de API para utilizar "contact_types" en lugar de "channels" en los valores de entrada.

El recurso /vis/users/$USER_ID/leads/buyers permite al vendedor obtener datos de contacto de los compradores interesados en sus publicaciones. Para recibir notificaciones sobre los clientes interesados, debes suscribirte al tópico [VIS Leads](https://developers.mercadolibre.com.ar/productos-recibe-notificaciones#Accede-a-los-detalles:~:text=/%24CANDIDATE_ID-,VIS%20Leads%3A,-Importante%3A), y después de recibir la notificación consultar el recurso de **/leads** .

Importante:

En el caso que ya tengas una integración con el [API de Preguntas](https://developers.mercadolibre.cl/es_cl/gestiona-preguntas-respuestas) y trates las preguntas como notificación de contacto (Leads), te recomendamos que cuando te suscribas al tópico de Leads no actives las notificaciones de Questions, esto para evitar duplicidad en los Leads.

## Consultar interesados en los ítems del vendedor

El vendedor puede consultar todos los datos de contacto de los interesados en sus ítems, con la posibilidad de paginarlos mediante el parámetro **offset** , que indica la posición del primer elemento a recuperar, y el parámetro **limit** , que señala la cantidad máxima de elementos a obtener. Además, los datos pueden ser filtrados por un período de tiempo específico, usando los parámetros **date_from**  y **date_to** . Para realizar una búsqueda más específica, se puede utilizar el parámetro **contact_types** , que representa el tipo de contacto a retornar.

Adicionalmente, el vendedor puede consultar los leads generados por usuarios no logueados utilizando el parámetro opcional **include_guest=true** , que agrega a la respuesta estándar dos nuevos nodos estructurales: **guest**  y **summary** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/users/$USER_ID/leads/buyers?offset=$OFFSET&limit=$LIMIT&date_from=$DATE_FROM&date_to=$DATE_TO&contact_types=$CONTACT_TYPES
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/users/3052668868/leads/buyers?offset=0&limit=10&date_from=2026-01-15&date_to=2026-01-22&contac_types=credit,question,whatsapp
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
    "date_to": "2026-01-22"
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

## Tipos de Leads Disponibles (contact_types)

Importante:

No todos los tipos de contactos estarán disponibles para todos los usuarios. La disponibilidad de contactos puede variar según la vertical y el tipo de usuario .

- **whatsapp** : un comprador apreta el botón de WhatsApp.

- **question** : un comprador hace una pregunta.

- **call** : un comprador apreta el botón de llamar.

- **credit** : simulación de crédito.

- **contact_request** : solicitudes de contacto dado el interés para generar una reserva.

- **visit request** : cuando un comprador solicita una solicitud de visita.

- **reservation** : reserva de un ítem.

Respuesta:

```
{
    "results": [
        {
            "id": 2678328,
            "item_id": "MLA1430828018",
            "name": "John Doe",
            "email": "jhon@example.com",
            "phone": "+5491198765432",
            "leads": [
                {
                    "id": "6b4aebf8-5570-47b8-9224-c1c177621575",
                    "contact_type": "question",
                    "created_at": "2024-05-14T14:15:39Z",
                    "external_id": "12776297658",
                    "item_id": "MLA1430828018",
                    "buyer_id": 2678328,
                    "status": "active"
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

## Posibles errores

Errores en la búsqueda de interesados.

| Error_code | Tipo | Mensaje del error | Motivos |
| --- | --- | --- | --- |
| 400 | Bad Request | { "message": "invalid date range", "error": "bad_request", "status": 400, "cause": [ "start date is greater than end date" ] } | La fecha de inicio es después de la fecha de término de la búsqueda. |
| 400 | Bad Request | { "message": "invalid start date", "error": "bad_request", "status": 400, "cause": [ "parsing time \"2021-01-021\": extra text: \"1\"" ] } | Fecha de inicio con formato inválido. |
| 400 | Bad Request | { "message": "invalid end date", "error": "bad_request", "status": 400, "cause": [ "parsing time \"2024-01-022\": extra text: \"2\"" ] } | Fecha de término con formato inválido. |
| 400 | Bad Request | { "code": "bad_request", "message": "invalid format USER_ID" } | Identificador de usuario con formato inválido. |
| 400 | Bad Request | { "message": "error decoding search params", "error": "bad_request", "status": 400, "cause": [ "schema: invalid path \"contact_types\"" ] } | Parámetro inválido. |
| 400 | Bad Request | { "message": "invalid lead type", "error": "bad_request", "status": 400, "cause": [ "invalid lead type: invalid " ] } | Tipo de contacto inválido. |
| 403 | Forbidden | { "code": "forbidden", "message": "invalid token caller" } | Access token no pertenece al vendedor. |
| 403 | Forbidden | { "blocked_by": "PolicyAgent", "path": "/v1/users/806525693/leads/buyers?scope=test-public", "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES", "status": 403, "message": "At least one policy returned UNAUTHORIZED." } | Acceso al endpoint sin access token. |
| 403 | Forbidden | { "code": "forbidden", "message": "invalid token" } | Access token inválido o expirado. |
| 429 | Too many requests | { "code":"too_many_requests", "message":"quota exceeded" } | Demasiadas solicitudes realizadas. Por favor, espere un momento antes de intentar nuevamente. |

## Obtener detalle de un lead

Cuando Mercado Libre notifica de la creación de un nuevo lead relacionado a los interesados, lo hace mencionando el ID en el mensaje, para obtener el detalle debes usar dicho identificador en el recurso /vis/leads/$LEAD_ID. El cual te proporcionará el detalle correspondiente.

Importante:

El endpoint **/vis/leads/$LEAD_ID**  es válido solo para la consulta de leads de los tipos **whatsapp** , **call** , **question**  y **visit_request** . 
Para los tipos de leads **contact_request**  y **reservation** , la consulta debe realizarse a través del endpoint **/leads/$LEAD_ID/details** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/leads/$LEAD_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/leads/3f2dedf2-dfbd-4981-a726-40b13aa172ff
```

Valores de entrada

| Atributo | Tipo de dato | Descripción | Requerido | Valor por Defecto |
| --- | --- | --- | --- | --- |
| leadID | string | Identificador del lead. | Sí | - |

Respuesta: HTTP 200

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

### Campos de la respuesta

- **id** : identificador del lead.

- **contact_type** : tipo de lead.

- **item_id** : identificador del ítem.

- **created_at** : fecha de creación del lead.

- **external_id** : identificador externo del lead.

- **status** : estado del lead.

- **buyer_id** : identificador del comprador.

- **name** : nombre del comprador. Solo si el acceso es público.

- **email** : email del comprador. Solo si el acceso es público.

- **phone** : teléfono del comprador. Solo si el acceso es público.

# Obtener detalle de un lead para “contact_request” y “reservation”

Cuando Mercado Libre notifica la creación de un nuevo lead de tipo **“contact_request”**  o **“reservation”** , lo hace mencionando el ID en el mensaje. Para obtener el detalle, debes usar dicho identificador en el recurso **/leads/$LEAD_ID/details** , el cual te proporcionará la información correspondiente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/leads/$LEAD_ID/details
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/leads/3f2dedf2-dfbd-4981-a726-40b13aa172ff/details
```

Valores de entrada

| Atributo | Tipo de dato | Descripción | Required | Valor por defecto |
| --- | --- | --- | --- | --- |
| leadID | string | Identificador del lead | Sí | - |

Respuesta: HTTP 200

```
{
  "id": "a2039207-9185-453b-a02f-aac9fc9ffacb",
  "item_id": "MLB4037459422",
  "created_at": "2025-02-14T00:00:00Z",
  "contact_type": "contact_request",
  "status": "created",
  "buyer_id": 1091441589,
  "name": "Test Test",
  "email": "john@example.com",
  "phone": "+55 01 1111-1111",
  "identification_type": "CPF",
  "identification_number": "01011010110",
  "details": {
    "color": "Azul Moonlight Perolizado",
    "zip_code": "88000-000",
    "dealership": "COD001 - Nombre - Lugar - Calle 111"
  }
}
```

Campos de la respuesta

- **id:**  identificador del lead.

- **contact_type:**  tipo de lead.

- **item_id:**  identificador del ítem.

- **created_at:**  fecha de creación del lead.

- **status:**  estado del lead.

- **buyer_id:**  identificador del comprador.

- **name:**  nombre del comprador (solo si el acceso es público).

- **email:**  email del comprador (solo si el acceso es público).

- **phone:**  teléfono del comprador (solo si el acceso es público).

- **identification_type:**  tipo de documento de identificación del usuario (solo si el acceso es público).

- **identification_value:**  valor del documento con el que se identifica al usuario (solo si el acceso es público).

- **details:**  colección de datos adicionales que sirven para identificar el vehículo seleccionado y su ubicación.

- **color:**  color del vehículo seleccionado por el comprador. **zip_code:**  código de ubicación desde donde fue seleccionado el vehículo de interés. **dealership:**  concesionaria de preferencia del comprador.

## Posibles errores

Errores en la búsqueda del detalle de un lead.

| Error_code | Tipo | Mensaje del error | Motivos |
| --- | --- | --- | --- |
| 400 | Bad Request | { "code": "bad_request", "message": "missing lead_id" } | Identificador incorrecto o inexistente. |
| 400 | Bad Request | { "code": "bad_request", "message": "invalid callerID" } | El caller id proporcionado no está presente o no es correcto. |
| 400 | Bad Request | { "code": "bad_request", "message": "invalid clientID" } | El client id proporcionado no está presente o no es correcto. |
| 403 | Forbidden | { "code": "forbidden", "message": "invalid token caller" } | Access token no pertenece al vendedor. |
| 403 | Forbidden | { "blocked_by": "PolicyAgent", "path": "/vis/leads/142536", "code": "PA_UNAUTHORIZED_RESULT_FROM_POLICIES", "status": 403, "message": "At least one policy returned UNAUTHORIZED." } | Acceso al endpoint sin access token. |
| 403 | Forbidden | { "code": "forbidden", "message": "invalid token" } | Access token inválido o expirado. |
| 404 | Not Found | { "code": "not_found", "message": "lead not found" } | El identificador proporcionado no está asociado a ningún lead del usuario. |
| 429 | Too many requests | { "code":"too_many_requests", "message":"quota exceeded" } | Demasiadas solicitudes realizadas. Por favor, espere un momento antes de intentar nuevamente. |
