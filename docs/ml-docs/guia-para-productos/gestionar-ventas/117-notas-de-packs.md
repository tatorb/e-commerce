<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/notas-de-packs -->
<!-- Sección: Guía para productos > Gestionar ventas -->

# Notas de Packs

Última actualización 12/09/2025

## Crear nota informativa

Mostrar quien (Seller, Colaborador) y desde donde (Postventa, Ventas, Integrador) añade las notas a las ventas

**Llamada:**

```
curl --location 'https://api.mercadolibre.com/packs/$PACK_ID/notes' \
--header 'Authorization: Bearer $ACCESS_TOKEN' \
--header 'Content-Type: application/json' \
--header 'X-Public: true'
```

**Parámetros de consulta:**

**Query Params**

| Campo | Tipo | Descripción | Obligatorio | Longitud máxima |
| --- | --- | --- | --- | --- |
| packID | Long | Identificador del pack. | Sí | - |
| accessToken | String | Token de acceso del usuario. | Sí | - |

**Body**

| Campo | Tipo | Descripción | Obligatorio | Longitud máxima |
| --- | --- | --- | --- | --- |
| note | String | Contenido de la nota a crear. | Sí | 300 |

**Ejemplo:**

```
curl --location 'https://api.mercadolibre.com/packs/20000154314645307/notes' \
--header 'Authorization: Bearer $ACCESS_TOKEN' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--data '{"note": "from postman"}'
```

**Respuesta:**

```
{
    "note": {
        "id": "681bace17c69893ae6558c52",
        "date_created": "2025-05-07T18:56:33Z",
        "date_last_updated": "2025-05-07T18:56:33Z",
        "note": "from postman",
        "source_bu": "integrator",
        "seller_id": 363796203,
        "operator_id": null
    }
}
```

**Parámetros de respuesta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| note | Objeto | Modelo que contiene los detalles de la nota creada. | Sí |
| note.id | String | Identificador único de la nota. | Sí |
| note.date_created | Date | Fecha y hora de creación de la nota. | Sí |
| note.date_last_updated | Date | Fecha y hora de la última actualización de la nota. | Sí |
| note.note | String | Contenido de la nota. | Sí |
| note.seller_id | Long | Identificador del vendedor asociado a la nota. | Sí |
| note.source_bu | String | Identificador de la unidad de negocio de origen. | No |
| note.operator_id | Long | Identificador del operador asociado a la nota. | No |

## Actualizar nota informativa

**Llamada:**

```
curl --location --request PUT \
'https://api.mercadolibre.com/packs/{packID}/notes/{noteID}?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}' \
--data '{
  "note": "from postman"
}'
```

**Parámetros de consulta:**

**Query Params**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| packID | Long | Identificador del pack. | Sí |
| noteID | Long | Identificador único de la nota. | Sí |
| accessToken | String | Token de acceso del usuario. | Sí |

**Body**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| note | String | Contenido textual de la nota. | Sí |

**Ejemplo:**

```
curl --location --request PUT \
'https://api.mercadolibre.com/packs/20000154314645307/notes/681bace17c69893ae6558c52?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}' \
--data '{
  "note": "from postman"
}'
```

**Respuesta:**

```
{
    "note": {
        "id": "681bace17c69893ae6558c52",
        "date_created": "2025-05-07T18:56:33Z",
        "date_last_updated": "2025-05-07T18:56:33Z",
        "note": "from postman",
        "source_bu": "integrator",
        "seller_id": 363796203,
        "operator_id": null
    }
}
```

**Parámetros de respuesta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| id | String | Identificador único de la nota. | Sí |
| date_created | Date | Fecha y hora de creación de la nota. | Sí |
| date_last_updated | Date | Fecha y hora de la última actualización de la nota. | Sí |
| note | String | Contenido textual de la nota. | Sí |
| source_bu | String | Identificador de la unidad de negocio de origen. | No |
| seller_id | Long | Identificador del vendedor asociado a la nota. | Sí |
| operator_id | Long | Identificador del operador asociado a la nota. | No |

## Visualizar nota informativa

**Llamada:**

```
curl --location 'https://api.mercadolibre.com/packs/{packID}/notes/{noteID}?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}'
```

**Parámetros de consulta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| packID | Long | Identificador del pack. | Sí |
| noteID | Long | Identificador único de la nota. | Sí |
| accessToken | String | Token de acceso del usuario. | Sí |

**Ejemplo:**

```
curl --location 'https://api.mercadolibre.com/packs/20000154314645307/notes/681bace17c69893ae6558c52?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}'
```

**Respuesta:**

```
{
    "id": "681bace17c69893ae6558c52",
    "date_created": "2025-05-07T18:56:33Z",
    "date_last_updated": "2025-05-07T18:56:33Z",
    "note": "from postman",
    "source_bu": "integrator",
    "seller_id": 363796203,
    "operator_id": null
}
```

**Parámetros de respuesta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| id | String | Identificador único de la nota. | Sí |
| date_created | Date | Fecha y hora de creación de la nota. | Sí |
| date_last_updated | Date | Fecha y hora de la última actualización de la nota. | Sí |
| note | String | Contenido textual de la nota. | Sí |
| source_bu | String | Identificador de la unidad de negocio de origen. | No |
| seller_id | Long | Identificador del vendedor asociado a la nota. | Sí |
| operator_id | Long | Identificador del operador asociado a la nota. | No |

## Buscar nota informativa

**Llamada:**

```
curl --location 'https://api.mercadolibre.com/packs/{packID}/notes?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}'
```

**Parámetros de consulta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| packID | Long | Identificador del pack. | Sí |
| accessToken | String | Token de acceso del usuario. | Sí |

**Ejemplo:**

```
curl --location 'https://api.mercadolibre.com/packs/20000154314645307/notes?access_token={accessToken}' \
--header 'Content-Type: application/json' \
--header 'X-Public: true' \
--header 'Authorization: Bearer {accessToken}'
```

**Respuesta:**

```
[
  {
    "results": [
      {
        "id": "681bace17c69893ae6558c52",
        "date_created": "2025-05-07T18:56:33Z",
        "date_last_updated": "2025-05-07T18:56:33Z",
        "note": "Esta es una nota de ejemplo.",
        "source_bu": "integrator",
        "seller_id": 363796203,
        "operator_id": null
      }
    ],
    "pack_id": 2000007791475695
  }
]
```

**Parámetros de respuesta:**

| Campo | Tipo | Descripción | Obligatorio |
| --- | --- | --- | --- |
| array (root) | Array | Array de objetos que contienen los resultados de las notas por pedido. | Sí |
| pack_id | Long | Identificador único del pedido. | Sí |
| results | Array | Lista de notas asociadas al pedido. | Sí |
| results.id | String | Identificador único de la nota. | Sí |
| results.date_created | Date | Fecha y hora de creación de la nota. | Sí |
| results.date_last_updated | Date | Fecha y hora de la última actualización de la nota. | Sí |
| results.note | String | Contenido de la nota. | Sí |
| results.source_bu | String | Identificador de la unidad de negocio de origen. | No |
| results.seller_id | Long | Identificador del vendedor asociado a la nota. | Sí |
| results.operator_id | Long | Identificador del operador asociado a la nota. | No |
