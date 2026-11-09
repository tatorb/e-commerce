<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/descarga-masiva-de-documentos-fiscales -->
<!-- Sección: Guía para productos > Facturación -->

# Descarga masiva de documentos fiscales

Última actualización 03/11/2026

## Descarga masiva de documentos fiscales

Usa estas APIs para solicitar archivos de documentos fiscales, consultar su preparación y descargar los archivos ZIP generados. La solicitud es asíncrona: la creación devuelve un identificador que usarás para consultar el resultado antes de iniciar las descargas.

**Disponibilidad inicial:**  Brasil (MLB), Argentina (MLA) y México (MLM).

## Autenticación y permisos

Envía el access token del usuario en el encabezado `Authorization: Bearer $ACCESS_TOKEN` en todas las llamadas. Estas APIs no requieren un scope OAuth adicional. Usa el mismo usuario para crear, consultar y descargar los archivos de una solicitud.

Para crear una solicitud, envía también `Content-Type: application/json`. El resultado de la descarga es binario y debes guardarlo como archivo ZIP.

## Cómo funciona

1. Consulta `GET /processes` para obtener el nombre exacto de un proceso disponible.

2. Lee `GET /processes/{processName}/schema` para conocer los campos y valores aceptados por la versión elegida.

3. Envía `POST /archives` y guarda el `archive_id` recibido.

4. Consulta `GET /archives/{archiveId}` hasta obtener un estado final.

5. Si el estado es `READY`, descarga cada `zip_id` mediante `GET /archives/{archiveId}/download`.

## 1. Listar procesos

`GET /processes` informa los nombres que puedes enviar en `process_name`.

**Llamada:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/processes' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta — HTTP 200:**

```
{
    "processes": [
        "cte",
        "disablement",
        "invoice-arg",
        "invoice-bra",
        "invoice-mex"
    ]
}
```

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `processes` | Array de strings | Nombres exactos de los procesos disponibles. |

| Proceso | País correspondiente | Descripción |
| --- | --- | --- |
| `invoice-bra` | MLB | Documentos fiscales de venta, devolución, notas de crédito, etc. |
| `cte` | MLB | CT-e (Conocimiento de Transporte Electrónico). Documento fiscal digital obligatorio en Brasil que se utiliza para registrar la prestación de servicios de transporte de carga. |
| `disablement` | MLB | Facturas inutilizadas. Documento fiscal que fue emitido, pero que ya no será utilizado por el emisor. |
| `invoice_arg` | MLA | Devuelve las facturas, notas de crédito y notas de débito. |
| `invoice-mex` | MLM | Devuelve las facturas y notas de crédito. |

## 2. Consultar el schema de un proceso

`GET /processes/{processName}/schema` informa la estructura aceptada en el campo `body` de la creación. Consulta el schema cada vez que uses otro proceso o versión: los campos obligatorios, tipos, valores permitidos y restricciones pueden cambiar.

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `processName` (path) | String | Sí | Nombre obtenido en `GET /processes`. |
| `version` (query) | Integer | No | Versión específica del proceso. Si se omite, la API usa la versión predeterminada disponible. |

**Llamada:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/processes/$processName/schema?version=$version' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo de llamada omitiendo la versión:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/processes/invoice-arg/schema' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo ilustrativo de respuesta de `invoice-arg`:**

```
{
    "process_name": "invoice-arg",
    "version": 1,
    "status": "PUBLISHED",
    "deprecated_at": null,
    "sunset_at": null,
    "schema": {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "required": [
            "site",
            "start",
            "end",
            "file_types"
        ],
        "properties": {
            "end": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de finalización en formato date-time (UTC) (por ejemplo: 2025-01-31T23:59:59Z)"
            },
            "site": {
                "enum": [
                    "MLA"
                ],
                "type": "string"
            },
            "start": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de inicio en formato date-time (UTC) (por ejemplo: 2025-01-01T00:00:00Z)"
            },
            "status": {
                "type": "array",
                "items": {
                    "enum": [
                        "authorized",
                        "error",
                        "needs_review"
                    ],
                    "type": "string"
                }
            },
            "file_types": {
                "type": "array",
                "items": {
                    "enum": [
                        "xml",
                        "pdf"
                    ],
                    "type": "string"
                }
            },
            "invoices_id": {
                "type": "array",
                "items": {
                    "type": [
                        "string",
                        "integer"
                    ]
                },
                "maxItems": 15
            },
            "logistic_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "drop_off",
                        "fulfillment",
                        "cross_docking",
                        "self_service",
                        "xd_drop_off",
                        "default"
                    ],
                    "type": "string"
                },
                "description": "Tipos de logística"
            },
            "vat_condition": {
                "type": "array",
                "items": {
                    "enum": [
                        "responsable inscripto",
                        "iva responsable inscripto",
                        "responsable_inscripto",
                        "monotributo",
                        "no categorizado",
                        "sujeto no categorizado",
                        "iva exento",
                        "exento",
                        "consumidor final",
                        "consumidor_final",
                        "iva no alcanzado"
                    ],
                    "type": "string"
                },
                "description": "Condición frente al IVA"
            },
            "invoice_letter": {
                "type": "array",
                "items": {
                    "enum": [
                        "e",
                        "c",
                        "b",
                        "a"
                    ],
                    "type": "string"
                }
            },
            "type_of_receipt": {
                "type": "array",
                "items": {
                    "enum": [
                        "factura",
                        "nota_de_debito",
                        "nota_de_credito"
                    ],
                    "type": "string"
                },
                "description": "Tipos de documentos por transacción"
            },
            "fiscal_data_transaction_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "sale",
                        "devolution"
                    ],
                    "type": "string"
                },
                "description": "Tipos de transacciones fiscales"
            }
        },
        "description": "El intervalo entre start y end no puede ser superior a 31 días. No se permite solicitar datos con más de 18 meses de antigüedad. Las fechas deben informarse en el formato date-time UTC.",
        "additionalProperties": false
    },
    "replacement": null
}
```

**Ejemplo ilustrativo de respuesta de `invoice-mex`:**

```
{
    "process_name": "invoice-mex",
    "version": 1,
    "status": "PUBLISHED",
    "deprecated_at": null,
    "sunset_at": null,
    "schema": {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "required": [
            "site",
            "start",
            "end",
            "file_types"
        ],
        "properties": {
            "end": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de finalización en formato date-time (UTC) (por ejemplo: 2025-01-31T23:59:59Z)"
            },
            "site": {
                "enum": [
                    "MLM"
                ],
                "type": "string"
            },
            "start": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de inicio en formato date-time (UTC) (por ejemplo: 2025-01-01T00:00:00Z)"
            },
            "status": {
                "type": "array",
                "items": {
                    "enum": [
                        "authorized",
                        "error",
                        "needs_review",
                        "canceled"
                    ],
                    "type": "string"
                }
            },
            "file_types": {
                "type": "array",
                "items": {
                    "enum": [
                        "xml",
                        "pdf"
                    ],
                    "type": "string"
                }
            },
            "invoices_id": {
                "type": "array",
                "items": {
                    "type": [
                        "string",
                        "integer"
                    ]
                },
                "maxItems": 15
            },
            "billing_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "NOMINAL",
                        "GENERICA"
                    ],
                    "type": "string"
                }
            },
            "logistic_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "drop_off",
                        "fulfillment",
                        "drop_shipping",
                        "custom",
                        "self_service",
                        "xd_drop_off",
                        "cross_docking",
                        "default"
                    ],
                    "type": "string"
                },
                "description": "Tipos de logística"
            },
            "type_of_receipt": {
                "type": "array",
                "items": {
                    "enum": [
                        "SALE",
                        "DEVOLUTION",
                        "RESALE",
                        "RESALE_DEVOLUTION"
                    ],
                    "type": "string"
                },
                "description": "Tipos de documentos por transacción"
            }
        },
        "description": "El intervalo entre start y end no puede ser superior a 31 días. No se permite solicitar datos con más de 18 meses de antigüedad. Las fechas deben informarse en el formato date-time UTC.",
        "additionalProperties": false
    },
    "replacement": null
}
```

El siguiente ejemplo ilustra `GET /processes/invoice-arg/schema?version=1` con estado `PUBLISHED`.

**Llamada:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/processes/$processName/schema?version=$version' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo de llamada declarando la versión:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/processes/invoice-arg/schema?version=1' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo ilustrativo de respuesta de `invoice-arg` v1 — HTTP 200:**

```
{
    "process_name": "invoice-arg",
    "version": 1,
    "status": "PUBLISHED",
    "deprecated_at": null,
    "sunset_at": null,
    "schema": {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "required": [
            "site",
            "start",
            "end",
            "file_types"
        ],
        "properties": {
            "end": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de finalización en formato date-time (UTC) (por ejemplo: 2025-01-31T23:59:59Z)"
            },
            "site": {
                "enum": [
                    "MLA"
                ],
                "type": "string"
            },
            "start": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de inicio en formato date-time (UTC) (por ejemplo: 2025-01-01T00:00:00Z)"
            },
            "status": {
                "type": "array",
                "items": {
                    "enum": [
                        "authorized",
                        "error",
                        "needs_review"
                    ],
                    "type": "string"
                }
            },
            "file_types": {
                "type": "array",
                "items": {
                    "enum": [
                        "xml",
                        "pdf"
                    ],
                    "type": "string"
                }
            },
            "invoices_id": {
                "type": "array",
                "items": {
                    "type": [
                        "string",
                        "integer"
                    ]
                },
                "maxItems": 15
            },
            "logistic_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "drop_off",
                        "fulfillment",
                        "cross_docking",
                        "self_service",
                        "xd_drop_off",
                        "default"
                    ],
                    "type": "string"
                },
                "description": "Tipos de logística"
            },
            "vat_condition": {
                "type": "array",
                "items": {
                    "enum": [
                        "responsable inscripto",
                        "iva responsable inscripto",
                        "responsable_inscripto",
                        "monotributo",
                        "no categorizado",
                        "sujeto no categorizado",
                        "iva exento",
                        "exento",
                        "consumidor final",
                        "consumidor_final",
                        "iva no alcanzado"
                    ],
                    "type": "string"
                },
                "description": "Condición frente al IVA"
            },
            "invoice_letter": {
                "type": "array",
                "items": {
                    "enum": [
                        "e",
                        "c",
                        "b",
                        "a"
                    ],
                    "type": "string"
                }
            },
            "type_of_receipt": {
                "type": "array",
                "items": {
                    "enum": [
                        "factura",
                        "nota_de_debito",
                        "nota_de_credito"
                    ],
                    "type": "string"
                },
                "description": "Tipos de documentos por transacción"
            },
            "fiscal_data_transaction_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "sale",
                        "devolution"
                    ],
                    "type": "string"
                },
                "description": "Tipos de transacciones fiscales"
            }
        },
        "description": "El intervalo entre start y end no puede ser superior a 31 días. No se permite solicitar datos con más de 18 meses de antigüedad. Las fechas deben informarse en el formato date-time UTC.",
        "additionalProperties": false
    },
    "replacement": null
}
```

El siguiente ejemplo ilustra `GET /processes/invoice-arg/schema?version=1` con estado `DEPRECATED`. Las fechas en `deprecated_at` y `sunset_at` son ilustrativas y no representan plazos anunciados.

**Ejemplo ilustrativo de respuesta de `invoice-arg` v1 — HTTP 200:**

```
{
    "process_name": "invoice-arg",
    "version": 1,
    "status": "DEPRECATED",
    "deprecated_at": "2026-10-23T13:56:15.302Z",
    "sunset_at": "2026-10-24T13:56:15.302Z",
    "schema": {
        "type": "object",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "required": [
            "site",
            "start",
            "end",
            "file_types"
        ],
        "properties": {
            "end": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de finalización en formato date-time (UTC) (por ejemplo: 2025-01-31T23:59:59Z)"
            },
            "site": {
                "enum": [
                    "MLA"
                ],
                "type": "string"
            },
            "start": {
                "type": "string",
                "format": "date-time",
                "description": "Fecha de inicio en formato date-time (UTC) (por ejemplo: 2025-01-01T00:00:00Z)"
            },
            "status": {
                "type": "array",
                "items": {
                    "enum": [
                        "authorized",
                        "error",
                        "needs_review"
                    ],
                    "type": "string"
                }
            },
            "file_types": {
                "type": "array",
                "items": {
                    "enum": [
                        "xml",
                        "pdf"
                    ],
                    "type": "string"
                }
            },
            "invoices_id": {
                "type": "array",
                "items": {
                    "type": [
                        "string",
                        "integer"
                    ]
                },
                "maxItems": 15
            },
            "logistic_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "drop_off",
                        "fulfillment",
                        "cross_docking",
                        "self_service",
                        "xd_drop_off",
                        "default"
                    ],
                    "type": "string"
                },
                "description": "Tipos de logística"
            },
            "vat_condition": {
                "type": "array",
                "items": {
                    "enum": [
                        "responsable inscripto",
                        "iva responsable inscripto",
                        "responsable_inscripto",
                        "monotributo",
                        "no categorizado",
                        "sujeto no categorizado",
                        "iva exento",
                        "exento",
                        "consumidor final",
                        "consumidor_final",
                        "iva no alcanzado"
                    ],
                    "type": "string"
                },
                "description": "Condición frente al IVA"
            },
            "invoice_letter": {
                "type": "array",
                "items": {
                    "enum": [
                        "e",
                        "c",
                        "b",
                        "a"
                    ],
                    "type": "string"
                }
            },
            "type_of_receipt": {
                "type": "array",
                "items": {
                    "enum": [
                        "factura",
                        "nota_de_debito",
                        "nota_de_credito"
                    ],
                    "type": "string"
                },
                "description": "Tipos de documentos por transacción"
            },
            "fiscal_data_transaction_type": {
                "type": "array",
                "items": {
                    "enum": [
                        "sale",
                        "devolution"
                    ],
                    "type": "string"
                },
                "description": "Tipos de transacciones fiscales"
            }
        },
        "description": "El intervalo entre start y end no puede ser superior a 31 días. No se permite solicitar datos con más de 18 meses de antigüedad. Las fechas deben informarse en el formato date-time UTC.",
        "additionalProperties": false
    },
    "replacement": {
        "process_name": "invoice-arg",
        "version": 2,
        "schema_url": "/processes/invoice-arg/schema?version=2"
    }
}
```

Los ejemplos ilustran reglas y valores que pueden variar entre versiones. Antes de preparar el `body`, consulta el schema efectivamente devuelto para el proceso y la versión elegidos; no envíes propiedades que no admite.

| Campo de respuesta | Tipo | Descripción |
| --- | --- | --- |
| `process_name` | String | Nombre del proceso consultado. |
| `version` | Integer | Versión del schema devuelto. |
| `status` | String | Estado de la versión, como `PUBLISHED` o `DEPRECATED`. |
| `deprecated_at` / `sunset_at` | Fecha y hora o null | Fechas informadas cuando la versión tiene una deprecación o finalización definida. |
| `schema` | Objeto | Campos, tipos y validaciones del `body` aceptado por esa versión. |
| `replacement` | Objeto o null | Versión de reemplazo, cuando se indica, con `process_name`, `version` y `schema_url`. |

## 3. Crear una solicitud de archivos

`POST /archives` inicia la preparación de los archivos. La respuesta confirma la creación de la solicitud, pero todavía no contiene el ZIP. El contenido de `body` debe seguir el schema del proceso y de la versión elegidos.

| Campo del request | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `process_name` | String | Sí | Nombre exacto obtenido del catálogo. |
| `process_version` | Integer | No | Versión del proceso. Si se omite, la API usa la versión predeterminada disponible. |
| `body` | Objeto | Sí | Criterios para generar los archivos, validados por el schema de la versión. |

### Cómo construir el body a partir del schema

El `schema` describe el formato aceptado para el `body`. Usa sus reglas para construir un objeto JSON con los valores de la solicitud; no copies la definición del schema en el `body`.

- **`type: object`:**  el `body` es un objeto JSON entre llaves `{ }`.

- **`required`:**  los campos de esta lista deben estar presentes en el `body`.

- **`properties`:**  define los nombres, tipos y restricciones de los campos. Los que no están en `required` son opcionales.

- **`additionalProperties: false`:**  envía solo los campos declarados en `properties`.

**Campos del `body` en este ejemplo de `invoice-arg`:**

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `site` | String | Sí | Site de los documentos; en el lanzamiento inicial, `MLB`. |
| `start` | String | Sí | Fecha y hora de inicio en formato `YYYY-MM-DDTHH:MM:SSZ`, en UTC. |
| `end` | String | Sí | Fecha y hora de fin en formato `YYYY-MM-DDTHH:MM:SSZ`, en UTC. |
| `file_types` | Array de strings | Sí | Formatos de los archivos: `xml` y/o `pdf`. |
| `status` | Array de strings | No | Estados de los documentos fiscales aceptados por el schema. Ejemplo: `["authorized"]`. |
| `logistic_type` | Array de strings | No | Tipos de logística aceptados por el schema. Ejemplo: `["fulfillment"]`. |
| `invoices_id` | Array de strings o Integers | No | Identificadores de documentos, con un máximo de 15 elementos. Ejemplo: `["123", 456]`. |
| `vat_condition` | Array de strings | No | Condición frente al IVA. Ejemplo: `["responsable inscripto"]`. |
| `invoice_letter` | Array de strings | No | Tipo de factura según la normativa de ARCA. Ejemplo: `["a"]`. |
| `type_of_receipt` | Array de strings | No | Tipos de documentos por transacción. Ejemplo: `["factura"]`. |
| `fiscal_data_transaction_type` | Array de strings | No | Tipos de transacciones fiscales. Ejemplo: `["sale"]`. |

**Campos del `body` en este ejemplo de `invoice-mex`:**

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `site` | String | Sí | Site de los documentos; en el lanzamiento inicial, `MLB`. |
| `start` | String | Sí | Fecha y hora de inicio en formato `YYYY-MM-DDTHH:MM:SSZ`, en UTC. |
| `end` | String | Sí | Fecha y hora de fin en formato `YYYY-MM-DDTHH:MM:SSZ`, en UTC. |
| `file_types` | Array de strings | Sí | Formatos de los archivos: `xml` y/o `pdf`. |
| `status` | Array de strings | No | Estados de los documentos fiscales aceptados por el schema. Ejemplo: `["authorized"]`. |
| `logistic_type` | Array de strings | No | Tipos de logística aceptados por el schema. Ejemplo: `["fulfillment"]`. |
| `invoices_id` | Array de strings o Integers | No | Identificadores de documentos, con un máximo de 15 elementos. Ejemplo: `["123", 456]`. |
| `billing_type` | Array de strings | No | Tipo de factura bajo el esquema del Servicio de Administración Tributaria (SAT). Ejemplo: `["NOMINAL"]`. |
| `invoice_letter` | Array de strings | No | Tipo de factura según la normativa de ARCA. Ejemplo: `["a"]`. |
| `type_of_receipt` | Array de strings | No | Tipos de documentos por transacción. Ejemplo: `["SALE"]`. |

**Ejemplo ilustrativo de body con campos opcionales para invoice-arg:**

```
{
        "site": "MLA",
        "start": "2026-10-01T03:00:00Z",
        "end": "2026-11-01T02:59:59Z",
        "type_of_receipt": [
            "factura"
        ],
        "file_types": [
            "xml",
            "pdf"
        ],
        "status": [
            "authorized"
        ],
        "logistic_type": [
            "fulfillment"
        ],
        "invoices_id": [
            "123",
            456
        ],
        "vat_condition": [
            "responsable inscripto"
        ],
        "invoice_letter": [
            "a"
        ],
        "fiscal_data_transaction_type": [
            "sale"
        ]
    }
```

**Ejemplo ilustrativo de body con campos opcionales para invoice-mex:**

```
{
        "site": "MLM",
        "start": "2026-10-01T03:00:00Z",
        "end": "2026-11-01T02:59:59Z",
        "type_of_receipt": [
            "SALE"
        ],
        "file_types": [
            "xml",
            "pdf"
        ],
        "status": [
            "authorized"
        ],
        "logistic_type": [
            "fulfillment"
        ],
        "invoices_id": [
            "123",
            456
        ],
        "billing_type": [
            "NOMINAL"
        ]
    }
```

Los campos opcionales se pueden omitir cuando no necesites filtrar por ellos. El sufijo `Z` en las fechas indica UTC. El período del ejemplo cubre 31 días calendario.

Este objeto es el valor de `body`. Envía `process_name` y, cuando se indique, `process_version` fuera de él, en el nivel principal de la solicitud, como en los ejemplos de llamada siguientes. El schema ilustrado no admite estos campos dentro de `body`.

**Llamada:**

```
curl --request POST \
  --url 'https://api.mercadolibre.com/archives' \
  --header 'Authorization: Bearer $ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "process_name": "$processName",
    "body": $body
  }'
```

**Ejemplo de llamada para `invoice-arg`:**

```
curl --location 'https://api.mercadolibre.com/archives' \
  --header 'Authorization: Bearer $ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "process_name": "invoice-arg",
    "process_version": 1,
    "body": {
        "site": "MLA",
        "start": "2026-10-01T03:00:00Z",
        "end": "2026-11-01T02:59:59Z",
        "type_of_receipt": [
            "factura"
        ],
        "file_types": [
            "xml",
            "pdf"
        ],
        "status": [
            "authorized"
        ],
        "logistic_type": [
            "fulfillment"
        ],
        "invoices_id": [
            "123",
            456
        ],
        "vat_condition": [
            "responsable inscripto"
        ],
        "invoice_letter": [
            "a"
        ],
        "fiscal_data_transaction_type": [
            "sale"
        ]
    }
}'
```

**Ejemplo de llamada para `invoice-mex`:**

```
curl --location 'https://api.mercadolibre.com/archives' \
  --header 'Authorization: Bearer $ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "process_name": "invoice-mex",
    "process_version": 1,
    "body": {
        "site": "MLM",
        "start": "2026-10-01T03:00:00Z",
        "end": "2026-11-01T02:59:59Z",
        "type_of_receipt": [
            "SALE"
        ],
        "file_types": [
            "xml",
            "pdf"
        ],
        "status": [
            "authorized"
        ],
        "logistic_type": [
            "fulfillment"
        ],
        "invoices_id": [
            "123",
            456
        ],
        "billing_type": [
            "NOMINAL"
        ]
    }
}'
```

**Respuesta — HTTP 201:**

```
{
  "archive_id": "59a016b0-69ee-42f6-b9b5-63ab042d20ab",
  "status": "PROCESSING"
}
```

| Campo de respuesta | Tipo | Descripción |
| --- | --- | --- |
| `archive_id` | String | Identificador de la solicitud; guárdalo para consultar el estado y descargar los archivos. |
| `status` | String | Estado inicial `PROCESSING`. |

En el ejemplo de `invoice-arg` v1, `site`, `start`, `end` y `file_types` son obligatorios. Las fechas del request usan `YYYY-MM-DDTHH:MM:SSZ`, en UTC. El schema ilustrado de esta versión limita el intervalo a 31 días y la antigüedad de los documentos a 18 meses.

Otros procesos pueden usar campos diferentes. Por ejemplo, un schema de `invoice-bra` puede pedir `site`, `start`, `end`, `file_types` y `type_of_receipt`. No reutilices automáticamente el `body` de `invoice-arg` en otro proceso.

## 4. Consultar el estado y los ZIP

`GET /archives/{archiveId}` informa el resultado de la preparación. Envía `process_name` y, si informaste `process_version` al crear la solicitud, envía la misma versión en el parámetro `version`.

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `archiveId` (path) | String | Sí | Valor de `archive_id` devuelto al crear la solicitud. |
| `process_name` (query) | String | Sí | Mismo proceso usado en la creación. |
| `version` (query) | Integer | No | Misma versión usada en la creación, cuando se eligió explícitamente. |

**Llamada:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/archives/$archiveId?process_name=$processName&version=$version' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo de llamada:**

```
curl --location 'https://api.mercadolibre.com/archives/59a016b0-69ee-42f6-b9b5-63ab042d20ab?process_name=invoice-arg&version=2' \
  --header 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta cuando los archivos están disponibles — HTTP 200:**

```
{
  "archive_id": "59a016b0-69ee-42f6-b9b5-63ab042d20ab",
  "status": "READY",
  "zip_ids": [5737364]
}
```

| Campo de respuesta | Tipo | Descripción |
| --- | --- | --- |
| `archive_id` | String | Identificador de la solicitud consultada. |
| `status` | String | Estado actual de la preparación. |
| `zip_ids` | Array de Integers | Identificadores de los ZIP disponibles; puede omitirse cuando no hay archivos. |
| `partial` | Booleano | Cuando es `true`, indica un resultado parcial. Se omite cuando es `false`. |

| Estado | Significado | Acción recomendada |
| --- | --- | --- |
| `PROCESSING` | Los archivos se están preparando. | Vuelve a consultar con una espera entre intentos. |
| `READY` | Hay ZIP disponibles; el resultado puede ser parcial. | Descarga todos los `zip_ids` y registra `partial: true`, si está presente. |
| `EMPTY` | No se encontraron documentos para los criterios enviados. | Finaliza la solicitud sin descargar archivos. |
| `UNAVAILABLE` | El resultado no está disponible. | Informa el resultado al usuario y evalúa una nueva solicitud. |
| `FAILED` | No fue posible preparar los archivos. | Registra el error y evalúa una nueva solicitud. |

No supongas que habrá un solo ZIP. Consulta el estado con intervalos entre intentos y aumenta la espera después de errores transitorios. El contrato no garantiza un tiempo único de finalización.

## 5. Descargar cada ZIP

`GET /archives/{archiveId}/download` devuelve un archivo binario para el `zip_id` informado. Repite la llamada para cada elemento de `zip_ids` recibido en la consulta de estado.

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `archiveId` (path) | String | Sí | Valor de `archive_id` devuelto al crear la solicitud. |
| `process_name` (query) | String | Sí | Mismo proceso usado en la creación. |
| `zip_id` (query) | Integer positivo | Sí | Uno de los valores de `zip_ids` devueltos en el estado. |
| `version` (query) | Integer | No | Misma versión usada en la creación, cuando se eligió explícitamente. |

**Llamada:**

```
curl --request GET \
  --url 'https://api.mercadolibre.com/archives/$archiveId/download?process_name=$processName&zip_id=$zipId&version=$version' \
  --header 'Authorization: Bearer $ACCESS_TOKEN' \
  --output 'download.zip'
```

**Ejemplo de llamada:**

```
curl --location 'https://api.mercadolibre.com/archives/59a016b0-69ee-42f6-b9b5-63ab042d20ab/download?process_name=invoice-arg&zip_id=5737364&version=2' \
  --header 'Authorization: Bearer $ACCESS_TOKEN' \
  --output 'invoice-arg.zip'
```

**Respuesta — HTTP 200:**  stream binario con `Content-Type: application/zip` y nombre sugerido en `Content-Disposition`. El contenido no es JSON.

| Encabezado de respuesta | Descripción |
| --- | --- |
| `Content-Type` | `application/zip`. |
| `Content-Disposition` | Indica el nombre sugerido para guardar el archivo ZIP. |

Si la conexión se interrumpe durante la transferencia, descarta el archivo incompleto antes de intentar nuevamente con el mismo `zip_id`. Un ZIP vencido o no disponible devuelve `410 archive_gone`; crea otra solicitud si todavía lo necesitas.

Disponibilidad del archivo

El archivo generado estará disponible durante aproximadamente 24 horas. Después de ese período, si intentas descargar el mismo archivo, recibirás el error **410 - archive_gone** .

## Errores y validaciones

Las respuestas de error en JSON usan `error`, `message` y `status`. Revisa el mensaje recibido para corregir el request, especialmente cuando la regla de fechas varíe según el proceso y la versión.

| HTTP | Error | Causa | Acción recomendada |
| --- | --- | --- | --- |
| 400 | `invalid_request_body` | Campos, valores o fechas fuera de las reglas del proceso. | Consulta el schema y el mensaje de validación. |
| 400 | `missing_request_param` / `invalid_request_param` | Parámetro ausente o inválido, como `process_name` o `zip_id`. | Revisa los parámetros de la URL. |
| 401 | `unauthenticated` | Token ausente o inválido. | Usa un access token válido del usuario. |
| 404 | `archive_not_found` | Solicitud o ZIP no encontrado para el usuario autenticado. | Revisa los identificadores y usa el mismo usuario de la creación. |
| 404 | `process_config_not_found` | Proceso o versión no disponible. | Consulta el catálogo y el schema. |
| 404–599 | `bad_download_error` | Error al entregar el ZIP antes del inicio de la transferencia. | Usa el código HTTP recibido para decidir si debes reintentar. |
| 410 | `archive_gone` | ZIP vencido o no disponible. | Crea otra solicitud si todavía necesitas el archivo. |
| 502 | `bad_gateway` | Error de comunicación o contenido inválido en la transferencia. | Vuelve a intentar con un límite de intentos. |

Cuando el proceso valida un período, la fecha final puede ser igual a la inicial, pero nunca anterior. Los límites de antigüedad y duración solo se aplican cuando están configurados para la versión del proceso; no supongas un límite único para todos los procesos.
