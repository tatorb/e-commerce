<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/brand-central -->
<!-- Sección: Guía para productos > Catálogo -->

# Brand Central

Última actualización 08/06/2026

# Brand Central

Nota:

Este recurso está disponible para Argentina, México, Brasil, Colombia, Chile, Uruguay, Perú y Ecuador.

Con esta funcionalidad los vendedores pueden enviar sugerencias de productos que no existan en nuestro Catálogo de Mercado Libre. De esta forma hacemos escalar nuestro catálogo, dando la posibilidad de sumar más productos de manera más rápida y mejorando todo el flujo.

## Notificaciones de status

Con el tópico **catalog_suggestions**  podrás suscribirte y comenzar a [recibir notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#Accede-a-los-detalles) del cambio de estado de las sugerencias de productos para nuestro catálogo. Los estados posibles para una sugerencia son:

- **UNDER_REVIEW** : la sugerencia se encuentra en revisión por Mercado Libre.

- **WAITING_FOR_FIX** : se encontró un error en los datos y debe ser corregido por el usuario.

- **PUBLISHED** : la sugerencia fue aprobada y el producto ya se encuentra creado y activo en nuestro catálogo.

- **REJECTED** : la sugerencia fue rechazada por motivos legales o porque el producto ya se encontraba en nuestro catálogo.

## Cantidad de sugerencias de un usuario

Dado un **user_id**  ese recurso devuelve la información si un vendedor está o no habilitado para utilizar esta funcionalidad, además puedes obtener la cantidad (cupo) que dicho usuario tiene disponible para creación de sugerencias.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/users/$USER_ID/quota
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/users/123456/quota
```

Respuesta:

```
{
  "quota": [
     {
        "type": "standard",
        "available": 10
     }
  ]
}
```

Respuesta usuario no permitido:

```
{
  "code": "forbidden",
  "message": "User not allowed",
  "status_code": 403
}
```

## Dominios disponibles

Dado un **site_id**  ese recurso devuelve un dump de todos los dominios indicando si están disponibles o no para crear sugerencias.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/domains/$SITE_ID/available/full
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/domains/MLA/available/full
```

Respuesta:

```
{
    "generation_date": "2021-11-15T04:32:14.512952Z",
    "domains": [
        {
            "id": "MLA-CELLPHONE_USB_AND_AUXILIARY_ADAPTERS",
            "name": "Adaptadores de USB y auxiliar para celulares",
            "pictures": [
                {
                    "id": "715173-MLU30701120250_052019",
                    "url": "http://http2.mlstatic.com/D_NQ_NP_715173-MLU30701120250_052019-F.jpg",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_715173-MLU30701120250_052019-F.jpg",
                    "size": "500x500"
                }
                ],
            "available": false
        },
        {
            "id": "MLA-AIR_CONDITIONERS",
            "name": "Aires acondicionados",
            "pictures": [
                {
                    "id": "795131-MLU26486283495_122017",
                    "url": "http://mlu-s1-p.mlstatic.com/795131-MLU26486283495_122017-F.jpg",
                    "secure_url": "https://mlu-s1-p.mlstatic.com/795131-MLU26486283495_122017-F.jpg",
                    "size": "500x500"
                }
            ],
            "available": true
        },
        ...
    ]
}
```

## Ficha técnica por dominio

Dado un **domain_id**  este endpoint devuelve la ficha técnica para las sugerencias del dominio consultado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/$DOMAIN_ID/techincal_specs?channel_id=catalog_suggestions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/MLA-CELLPHONES/technical_specs?channel_id=catalog_suggestions
```

Respuesta:

```
{
  "input": {
    "groups": [
      {
        "id": "MAIN",
        "label": "Características principales",
        "relevance": 1,
        "section": "SPECIFICATIONS",
        "ui_config": {},
        "components": [
          {
              "component": "TEXT_INPUT",
              "label": "Marca",
              "ui_config": {
                  "hint": "Escribe la marca real del producto o 'Genérica' si no tiene marca.",
                  "allow_custom_value": false,
                  "allow_filtering": false
              },
              "attributes": [
                  {
                      "id": "BRAND",
                      "name": "Marca",
                      "value_type": "string",
                      "value_max_length": 255,
                      "tags": [
                          "catalog_required",
                          "required"
                      ],
                      "hierarchy": "PARENT_PK",
                      "relevance": 1
                  }
              ],
              "unified_units": []
          }
        ]
      },
      {
        "id": "OTHER",
        "label": "Otros",
        "relevance": 1,
        "section": "SPECIFICATIONS",
        "ui_config": {},
        "components": [
          {
              "component": "TEXT_INPUT",
              "label": "Modelo detallado",
              "ui_config": {
                  "allow_custom_value": false,
                  "allow_filtering": false
              },
              "attributes": [
                  {
                      "id": "DETAILED_MODEL",
                      "name": "Modelo detallado",
                      "value_type": "string",
                      "value_max_length": 255,
                      "tags": [
                          "hidden"
                      ],
                      "hierarchy": "CHILD_DEPENDENT",
                      "relevance": 1
                  }
              ],
              "unified_units": []
          }
        ]
      }
    ]
  },
  "output": {
    "main_title": "Características Principales",
    "groups": [
      {
        "id": "GENERAL_CHARACTERISTICS",
        "label": "Características generales",
        "relevance": 1,
        "section": "SPECIFICATIONS",
        "ui_config": {},
        "components": [
          {
            "component": "TEXT_OUTPUT",
            "label": "Marca",
            "ui_config": {
                "hint": "Escribe la marca real del producto o 'Genérica' si no tiene marca."
            },
            "attributes": [
              {
                "id": "BRAND",
                "name": "Marca",
                "value_type": "string",
                "tags": [],
                "hierarchy": "PARENT_PK",
                "relevance": 1
              }
            ]
          },
          {
            "component": "TEXT_OUTPUT",
            "label": "Línea",
            "ui_config": {},
            "attributes": [
              {
                "id": "LINE",
                "name": "Línea",
                "value_type": "string",
                "tags": [],
                "hierarchy": "PARENT_PK",
                "relevance": 1
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Ficha técnica de sugerencias

Contamos con recursos que permiten consultar solo el **input**  o solo el **output**  de la ficha técnica para un determinado dominio consultado. El input tiene las configuraciones que usamos para pedir los atributos y el output tiene las configuraciones que definen cuales los atributos que vamos a mostrar en el front.

### Input

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' hhttps://api.mercadolibre.com/domains/$DOMAIN_ID/techincal_specs/input?channel_id=catalog_suggestions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/MLA-CELLPHONES/technical_specs/input?channel_id=catalog_suggestions
```

Respuesta:

```
{
  "groups": [
    {
      "id": "MAIN",
      "label": "Características principales",
      "relevance": 1,
      "section": "SPECIFICATIONS",
      "ui_config": {},
      "components": [
        {
            "component": "TEXT_INPUT",
            "label": "Marca",
            "ui_config": {
                "hint": "Escribe la marca real del producto o 'Genérica' si no tiene marca.",
                "allow_custom_value": false,
                "allow_filtering": false
            },
            "attributes": [
                {
                    "id": "BRAND",
                    "name": "Marca",
                    "value_type": "string",
                    "value_max_length": 255,
                    "tags": [
                        "catalog_required",
                        "required"
                    ],
                    "hierarchy": "PARENT_PK",
                    "relevance": 1
                }
            ],
            "unified_units": []
        }
      ]
    },
    {
      "id": "OTHER",
      "label": "Otros",
      "relevance": 1,
      "section": "SPECIFICATIONS",
      "ui_config": {},
      "components": [
        {
            "component": "TEXT_INPUT",
            "label": "Modelo detallado",
            "ui_config": {
                "allow_custom_value": false,
                "allow_filtering": false
            },
            "attributes": [
                {
                    "id": "DETAILED_MODEL",
                    "name": "Modelo detallado",
                    "value_type": "string",
                    "value_max_length": 255,
                    "tags": [
                        "hidden"
                    ],
                    "hierarchy": "CHILD_DEPENDENT",
                    "relevance": 1
                }
            ],
            "unified_units": []
        }
      ]
    }
  ]
}
  }
}
```

### Output

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/$DOMAIN_ID/techincal_specs/output?channel_id=catalog_suggestions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/MLA-CELLPHONES/technical_specs/output?channel_id=catalog_suggestions
```

Respuesta:

```
{
  "main_title": "Características Principales",
  "groups": [
    {
      "id": "GENERAL_CHARACTERISTICS",
      "label": "Características generales",
      "relevance": 1,
      "section": "SPECIFICATIONS",
      "ui_config": {},
      "components": [
        {
          "component": "TEXT_OUTPUT",
          "label": "Marca",
          "ui_config": {
              "hint": "Escribe la marca real del producto o 'Genérica' si no tiene marca."
          },
          "attributes": [
            {
              "id": "BRAND",
              "name": "Marca",
              "value_type": "string",
              "tags": [],
              "hierarchy": "PARENT_PK",
              "relevance": 1
            }
          ]
        },
        {
          "component": "TEXT_OUTPUT",
          "label": "Línea",
          "ui_config": {},
          "attributes": [
            {
              "id": "LINE",
              "name": "Línea",
              "value_type": "string",
              "tags": [],
              "hierarchy": "PARENT_PK",
              "relevance": 1
            }
          ]
        }
      ]
    }
  ]
}
```

## Validaciones previas

Con este recurso es posible hacer un check sobre la sugerencia antes de enviarla efectivamente. Recibe una posible sugerencia y devuelve el resultado de las validaciones propias de Brand Central, de Product Standards y de Ítems.

Ejemplo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
    "title": "Sugerencia de test",
    "domain_id": "MLA-CELLPHONES",
    "pictures": [
        {
          "id": "647954-MLA46144073729_052021"
        }
    ],
    "attributes": [
        {
            "id": "BRAND",
            "values": [
                {
                     "name": "Samsung"
                }
            ]
        },
        {
            "id": "IS_DUAL_SIM",
            "values": [
                {
                    "name": "Si"
                }
            ]
        },
        {
            "id": "GTIN",
            "values": [
                {
                    "name": 12345678
                }
            ]
        },
        {
            "id": "RAM",
            "values": [
                {
                    "name": "6 GB"
                }
            ]
        },
        {
            "id": "COLOR",
            "values": [
                {
                    "name": "Rojo"
                }
            ]
        }
    ]
}
'
https://api.mercadolibre.com/catalog_suggestions/validate
```

Respuesta: **Status 200 OK**

Cuando la sugerencia tiene errores de validación.

Status: **400**

Ejemplo:

```
{
    "error": "validation_error",
    "message": "Validation error",
    "status": 400,
    "cause": [
        {
            "department": "items",
            "cause_id": 10147,
            "type": "error",
            "code": "item.attributes.missing_required",
            "references": [
                "item.attributes",
                "item.variations.attribute_combinations"
            ],
            "message": "The attributes [MODEL, INTERNAL_MEMORY] are required for category MLA1055. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes."
        },
        {
            "department": "quality",
            "cause_id": 3026,
            "type": "error",
            "code": "InvalidProductIdentifier",
            "references": [
                "suggestion.attributes"
            ],
            "message": "El código universal 12345678 tiene un formato incorrecto."
        },
        {
            "department": "quality",
            "cause_id": 3035,
            "type": "error",
            "code": "IreqAttributesMissing",
            "references": [
                "suggestion.attributes"
            ],
            "message": "El campo \"Memoria interna\" es obligatorio y no está cargado."
        },
        {
            "department": "quality",
            "cause_id": 3017,
            "type": "error",
            "code": "InvalidAttributeValue",
            "references": [
                "suggestion.attributes"
            ],
            "message": "El campo \"Es Dual SIM\" debe ser alguna de las opciones disponibles y le cargaste \"Si\"."
        },
        {
            "department": "quality",
            "cause_id": 304,
            "type": "error",
            "code": "CatalogRequiredMissing",
            "references": [
                "suggestion.attributes"
            ],
            "message": "El campo \"Modelo\" es obligatorio y no está cargado."
        }
    ]
}
```

## Crear sugerencia

En caso de que quieras crear una sugerencia de producto deberás enviar un POST con la información necesaria para la creación de cada nueva sugerencia:

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
  "title": "Item De Test, No Ofertar!",
  "domain_id": "MLA-CELLPHONES",
  "pictures": [{
    "id": "647954-MLA46144073729_052021"
  }],
  "attributes": [{
      "id": "BRAND",
      "values": [
      {
        "id": "59387",
        "name": "Xiaomi"
      }
     ]
    },
    {
      "id": "LINE",
      "values": [
       {
        "id": "199791",
        "name": "Redmi"
       }
      ]
   }
  ]
}'
https://api.mercadolibre.com/catalog_suggestions
```

Respuesta:

```
{
	"id": "MLA922220746",
	"site_id": "MLA",
	"title": "Item De Test, No Ofertar!",
	"seller_id": 238564384,
	"domain_id": "MLA-CELLPHONES",
	"status": "UNDER_REVIEW",
	"attributes": [{
			"id": "BRAND",
			"values": [
			{
				"id": "59387",
				"name": "Xiaomi"
			}
		  ]
		},
		{
			"id": "LINE",
			"values": [
			{
				"id": "199791",
				"name": "Redmi"
			}
		  ]
		}
	],
	"pictures": [{
		"id": "647954-MLA46144073729_052021"
	}]
}
```

## Obtener sugerencia

Con este recurso es posible obtener los detalles de una sugerencia que fue creada con anterioridad.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/$SUGGESTION_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/123456
```

Respuesta:

```
{
  "id": "MLA12345",
  "site_id": "MLA",
  "status": "UNDER_REVIEW" | "WAITING_FOR_FIX" | "PUBLISHED" | "REJECTED",
  "sub_status": "VALIDATING" | "WAITING_FOR_FIX" | "READY_TO_IMPORT" | "IMPORTED" | "PUBLISHED" | "REJECTED",
  "title": "Item De Test, No Ofertar!",
  "seller_id": 111111,
  "domain_id": "MLA-CELLPHONES",
  "attributes": [
    {
      "id": "BRAND",
      "name": "Marca",
      "values": [
        {
          "id": "59387",
          "name": "Xiaomi",
          "struct": null
        }
      ]
    },
    {
      "id": "LINE",
      "name": "Línea",
      "values": [
        {
          "id": "199791",
          "name": "Redmi",
          "struct": null
        }
      ]
    }
  ],
  "pictures": [
    {
      "id": "667092-MLA29115232412_012019",
      "url": "http://http2.mlstatic.com/D_667092-MLA29115232412_012019-O.jpg",
      "secure_url": "https://http2.mlstatic.com/D_667092-MLA29115232412_012019-O.jpg",
      "size": "500x375"
    }
  ],
  "tags": [
    "test_suggestion"
  ],
  "date_created": "2021-06-08T18:49:08Z",
  "last_updated": "2021-06-30T17:51:08Z"
}
```

## Crear descripción

Con el recurso puedes crear la descripción del producto relacionado con la sugerencia generada, sumando en la descripción el detalle del ítem.

Ejemplo:

```
curl -X POST-H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{    
    "plain_text": "Texto de la Descripción"
        
}
https://api.mercadolibre.com/catalog_suggestions/${suggestion_id}/description
```

Respuesta: **HTTP status 200 OK** .

## Modificar descripción

Con este recurso puedes modificar una descripción que fue enviada a una sugerencia antes creada.

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/$SUGGESTION_ID/description
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d 
{
  "plain_text": "Texto de la Descripción"
}
https://api.mercadolibre.com/catalog_suggestions/${suggestion_id}/description
```

Respuesta: **HTTP status 200 OK** .

## Obtener resultado de las validaciones

Dado un **suggestion_id**  es posible validar el resultado de las validaciones de productos estándares que hayan finalizado hasta el momento.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/$SUGGESTION_ID/validations
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/123456/validations
```

Respuesta:

```
{
    "validations": [
          {
              "department": "quality",
              "cause_id": 3025,
              "type": "error",
              "code": "InvalidProcessingPicture",
              "references": [
                "suggestion.pictures"
              ],
              "message": "Ocurrió un error procesando la foto. Por favor cargala nuevamente"
          },
          {
              "department": "quality",
              "cause_id": 3025,
              "type": "error",
              "code": "InvalidProcessingPicture",
              "references": [
                "suggestion.pictures"
              ],
              "message": "Ocurrió un error procesando la foto. Por favor cargala nuevamente"
          },
          {
              "department": "quality",
              "cause_id": 3074,
              "type": "error",
              "code": "ProductIdentifierMissing",
              "references": [
                "suggestion.attributes"
              ],
              "message": "El campo \"Código universal de producto\" es obligatorio y no está cargado."
          }
    ]
}
```

## Modificar sugerencia

Si deseas modificar una sugerencia enviada, deberás realizar el siguiente PUT:

Llamada:

```
curl -X PUT-H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/$SUGGESTION_ID
```

Ejemplo:

```
curl -X PUT-H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
    "title": "Titulo a modificar",
    "attributes": [
      {
        "id": "BRAND",
        "name": "Marca",
         "values": [
          {
            "id": "11111",
            "name": "Xiaomi 1",
            "struct": null
          }
        ]
      },
      {
        "id": "LINE",
        "values": [
          {
            "id": "199791",
            "name": "Redmi",
            "struct": null
           }
        ]
      }
    ],
    "pictures": [
      {
        "id": "647954-MLA46144073729_052021"
      }
    ]
  }
```

Respuesta:

```
{
  "id": "MLA1103361143",
  "site_id": "MLA",
  "status": "WAITING_FOR_FIX",
  "title": "Titulo A Modificar",
  "seller_id": 818222588,
  "domain_id": "MLA-GAME_CONSOLES",
  "attributes": [
    {
      "id": "BRAND",
      "name": "Marca",
      "values": [
        {
          "id": "11111",
          "name": "Xiaomi 1"
        }
      ]
    },
    {
      "id": "LINE",
      "name": "Línea",
      "values": [
        {
          "id": "199791",
          "name": "Redmi"
         }
      ]
    },
    {
      "id": "MODEL",
      "name": "Modelo",     
      "values": [
        {
          "name": "juego 1"
         }
      ]
    }
  ],
  "pictures": [
    {
      "id": "647954-MLA46144073729_052021",
      "url": "ttp://mla-s1-p.mlstatic.com/647954-MLA46144073729_052021-O.jpg",
      "secure_url":"https://mla-s1-p.mlstatic.com/647954-MLA46144073729_052021-O.jpg",
      "size": "500x313"
    }
  ],
   "tags": [
      "test_suggestion"
  ],
  "date_created": "2021-09-14T20:38:36Z",
  "last_updated": "2021-09-24T17:43:36Z"
}
```

## Listar sugerencias

Con ese recurso es posible listar todas las sugerencias creadas por un usuario, los detalles y estados que tiene en su momento.

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_suggestions/users/$USERID/suggestions/search
```

Respuesta:

```
{
  "total": 1,
  "suggestions": [
    {
      "id": "MLA924694517",
      "site_id": "MLA",
      "status": "UNDER_REVIEW",
      "sub_status": "VALIDATING",
      "title": "Item De Test, No Ofertar",
      "seller_id": 772437317,
      "domain_id": "MLA-CELLPHONES",
      "attributes": [
        {
          "id": "BRAND",
          "name": "Marca",
          "values": [
            {
              "id": "59387",
              "name": "Xiaomi",
              "struct": null
            }
          ]
        },
        {
          "id": "LINE",
          "name": "Línea",
          "values": [
            {
              "id": "199791",
              "name": "Redmi",
              "struct": null
             }
          ]
        }
      ],
      "pictures": [
        {
         "id": "647954-MLA46144073729_052021",
         "url": "ttp://mla-s1-p.mlstatic.com/647954-MLA46144073729_052021-O.jpg",
         "secure_url":"https://mla-s1-p.mlstatic.com/647954-MLA46144073729_052021-O.jpg",
        "size": "500x313"
        }
      ]
    }
  ]
}
```

### Filtros opcionales

- **limit**  [integer]: para configurar la cantidad de elementos a devolver en el request. min: 10 max: 50 default: 50 (opcional).

- **offset**  [integer]: offset de la búsqueda, es decir, índice del primer elemento a retornar. El limit debería mantenerse fijo durante todo el paginado, mientras que el que irá variando es el offset incrementándose en la misma cantidad que el límit. En la respuesta devolvemos el campo “total” con el cual se podrán guiar para saber hasta que valor puede incrementarse el offset (opcional).

- **search_type**  [scan|search]: search_type = scan devuelve scroll_id para utilizar en los siguientes requests. default: search (opcional).

- **domain_ids**  [string]: para filtrar las sugerencias de determinados dominios (opcional).

- **status**  [string]: para filtrar las sugerencias con determinados status (opcional).

- **title**  [string]: permite pasar un título parcial y buscar sugerencias cuyo title haga match con el string (opcional).

## Errores

| Error_code | Mensaje del error | Descripción |
| --- | --- | --- |
| 400 | Property [title] cannot be blank | POST/PUT sin título de la sugerencia |
| 400 | Domain is not active | Dominio inactivo en buybox |
| 400 | User is not allowed to create products | Usuario sin permisos para publicar |
| 400 | User is not allowed to create products from this brand | Usuario sin permisos para publicar una marca en especial |
| 400 | Attribute values must not be null | Atributos con valores en null |
| 400 | Item has unprocessable tags | Sugerencia en un estado no modificable |
| 400 | Domain is not modifiable | Usuario intenta modificar el dominio de una sugerencia |
| 400 | Suggestion ${suggestion_id} can not be modified | Status no permite cambio de la descripción de la sugerencia |
| 400 | Suggestion ${suggestion_id} already has a description | Sugerencia ya tiene una descripción creada |
| 403 | User {caller.id} not allowed to get validations for suggestion {suggestion_id} | User no es dueño de la sugerencia que se solicita las validaciones |
