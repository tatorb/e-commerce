<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/precio-por-cantidad -->
<!-- Sección: Guía para productos > Precios y Costos > Precios por cantidad -->

# Precio por cantidad

Última actualización 25/08/2026

## Gestionar precios por cantidad B2B

**Importante:**

A partir del **27 de octubre de 2026** , ya no será posible configurar Precios por Cantidad con valor absoluto, ya que el endpoint /items/$ITEM_ID/prices/standard/quantity será discontinuado. Adaptá tu desarrollo para utilizar la nueva estructura de **[Precios por Cantidad % B2B](https://developers.mercadolibre.com.ar/es_ar/pxq-porcentaje-b2b)** .

**Atención:**  el endpoint /items/$ITEM_ID/prices/standard/quantity continuará disponible únicamente para la configuración de **[Precios netos por cantidad](https://developers.mercadolibre.com.ar/es_ar/precios-netos)** . Para esta funcionalidad, no habrá cambio de endpoint.

Precio por cantidad (PxQ) es un precio mayorista donde el comprador puede llevar más productos pagando menos. La propuesta se basa en definir un precio por cantidad reutilizando el **"type"**  de precio junto con un nuevo atributo numérico dentro del campo **"conditions"** llamado **"min_purchase_unit"** , que establece la cantidad mínima de unidades a partir de la cual el precio es válido.

Para sitios con multimoneda, siempre se deberá usar la misma moneda para el precio estándar y el precio por cantidad. En caso de que se usen monedas diferentes, ocurrirá un error 404.

Nota:

Disponible en Brasil (MLB), México (MLM), Chile (MLC) y Argentina (MLA). El acceso a Precios por Cantidad % B2B está restringido a vendedores previamente seleccionados y habilitados por Mercado Libre (tag "business"), quienes podrán aplicar precios por cantidad a sus publicaciones.

En la funcionalidad disponible para Business to Business (B2B), se añadirá una cadena de texto (string) en el campo **“conditions.context_restrictions”**  con el valor **“user_type_business”** . Para representar los diferentes precios por cantidad de un ítem, se utilizan varios nodos de precio **“standard”** .

### Consideraciones

- Un ítem tiene una sola “tabla de precios mayorista” (conjunto de nodos con **“min_purchase_unit”** ).

- La tabla de precios mayorista se podrá visualizar en el recurso de precios, con el contexto: **user_type_business** .

- La tabla de precios mayorista podría tener como **min_purchase_unit**  cualquier número mayor que 1 y diferente de nulo.

- Por el momento solo vamos a generar precios con **“min_purchase_unit”**  para **channel_marketplace** .

- Es posible cargar al máximo 5 precios por cantidad, donde el precio baja a medida que crece la cantidad mínima.

- **NO**  vamos a cargar PxQ sin **“user_type_business”** . (Por lo tanto estos precios solo estarán disponibles para compradores B2B)

- En la actualidad el encendido va a ser controlado, por lo que los seller que tengan acceso a la funcionalidad, serán elegidos previamente e integrarán un listado.

- Los ítems que se les pueda definir un precio por cantidad, podrán ser validado bajo el tag **“standard_price_by_quantity”** .

- En caso de que el usuario agregue, modifique o elimine un PxQ, se enviará una notificación correspondiente al tópico [items prices](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=Items%20Price%3A%20recibir%C3%A1s%20notificaciones%20del%20item_id%20cada%20vez%20que%20el%20precio%20sea%20creado%2C%20actualizado%20o%20eliminado.).

## Identificar usuarios habilitados

Los usuarios que tengan habilitada la funcionalidad, tanto para navegar el **buying**  flow como compradores B2B o publicar como **vendedores**  B2B con precios por cantidad, serán marcados con el tag **“business”** . Esta tag puede ser consultada por el propio usuario a través del recurso de [users](https://developers.mercadolibre.com.ar/es_ar/producto-consulta-usuarios#informaci%C3%B3n-privada).

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/206946886
```

**Respuesta:**

```
{
    "id": 12345,
    "nickname": "TETE1234",
    "registration_date": "2020-03-04T09:43:00.000-04:00",
    "first_name": "Test",
  ...
    },
    "user_type": "normal",
    "tags": [
        "normal",
        "test_user",
        "business",
        "user_product_seller",
        "messages_as_seller",
        "eshop"
    ],
    "logo": null,
    "points": 1,
    "site_id": "MLB",
    "permalink": "http://perfil.mercadolivre.com.br/TETE3206487",
    "seller_experience": "NEWBIE",
    "bill_data": {
        "accept_credit_note": null
    },
    ...
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
        "required_action": null,
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
  ...
}
```

## Agregar, modificar y eliminar precio por cantidad

Importante:

A partir del **21 de julio de 2026** , la configuración de PxQ B2B estará bloqueada para publicaciones del dominio Automotive Tires en MLA (categoría MLA22195).

Para aplicar precio por cantidad en publicaciones de este segmento, utilice exclusivamente la modalidad [**PxQ B2C**](https://developers.mercadolibre.com.ar/es_ar/precios-por-cantidad-b2c).

Permite definir o modificar precios por cantidad en la publicación, enviando o editando un listado de precios.

**Parámetros:**

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| Item_id | Obligatorio | identificador de publicación< |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/prices/standard/quantity
```

**Ejemplo:**

```

curl -X POST 'https://api.mercadolibre.com/items/MLB123456789/prices/standard/quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "prices": [
      {
        "id": "1"
      },
      {
        "amount": 2850,
        "currency_id": "BRL",
        "conditions": {
          "context_restrictions": [
            "channel_marketplace",
            "user_type_business"
          ],
          "min_purchase_unit": 10
        }
      }
    ]
  }
```

**Importante:**

Ten en cuenta que en caso que no envíes el ID de uno de los precios ya definidos, se considerará que se está intentando eliminar dicho nodo.

Para modificar un ID existente, el cambio no se aplicará sobre el ID existente sino que se deberá crear un nuevo ID con la información actualizada y no enviar en la llamada los ID que se quieren quitar.

Además deberás tener en cuenta que el ID que se envía en la llamada, en la respuesta puedes identificarlo con un ID diferente, ya que si el ID enviado fue utilizado, se creará un ID nuevo en relación al último ID utilizado.

Para mantener un precio, solo tendrá que enviar el ID

**Respuesta:**

```
{
	"id": MLB123456789,
	"prices": [
		{
			"id" : "1",
			"amount": 3000,
			"currency_id" : "BRL",
			"conditions": {
				"context_restrictions": [
					"channel_marketplace"
                		],
			}
		},
		{
			"amount": 2850,
			"currency_id" : "BRL",
			"conditions": {
				"context_restrictions": [
					"channel_marketplace",
					"user_type_business"
                		],
				"min_purchase_unit": 10
			}
		}
	]
}
```

Ejemplo de envío de 5 precios por cantidad:

**Ejemplo:**

```

curl -X POST 'https://api.mercadolibre.com/items/MLB123450000/prices/standard/quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "prices": [
        {
            "id": "1"
        },
        {
            "amount": 480,
            "currency_id": "BRL",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2
            }
        },
        {
            "id": "2"
        },
        {
            "amount": 450,
            "currency_id": "BRL",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 3
            }
        },
        {
            "id": "3"
        },
        {
            "amount": 400,
            "currency_id": "BRL",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 4
            }
        },
        {
            "id": "4"
        },
        {
            "amount": 380,
            "currency_id": "BRL",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 5
            }
        },
        {
            "id": "5"
        },
        {
            "amount": 300,
            "currency_id": "BRL",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 6
            }
        }
    ]
}
```

**Respuesta:**

```
{
    "id": "MLB123450000",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 500,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-05-13T21:50:48Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "10",
            "type": "standard",
            "amount": 480,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-07-03T14:21:57Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 2
            }
        },
        {
            "id": "11",
            "type": "standard",
            "amount": 450,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-07-03T14:21:57Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 3
            }
        },
        {
            "id": "12",
            "type": "standard",
            "amount": 400,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-07-03T14:21:57Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 4
            }
        },
        {
            "id": "13",
            "type": "standard",
            "amount": 380,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-07-03T14:21:57Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 5
            }
        },
        {
            "id": "14",
            "type": "standard",
            "amount": 300,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-07-03T14:21:57Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 6
            }
        }
    ]
}
```

Importante:

En caso de enviar un id que ya fue utilizado anteriormente, el sistema lo sustituirá automáticamente por un nuevo id que aún no haya sido utilizado.

**Nota:**

Ten en cuenta que la respuesta mostrará también el precio standard, precio de promoción (si cuenta con alguno) y el listado de precios por cantidad definidos.

**Campos de la respuesta:**

La respuesta de un POST al recurso items/$ITEM_ID/prices proporcionará los siguientes parámetros:

- **prices:**  listado de precios del item después de agregar/borrar precios  **id:**  identificador del precio  **amount:**  precio del item **currency_id:**  ID de la moneda utilizada **conditions:**  restricciones aplicadas al precio  **context_restrictions:**  contexto a los cuales se le aplica el precio (para el caso de precio por cantidad, siempre deberán contar con los siguientes valores)  channel_marketplace user_type_business   **min_purchase_unit:**  cantidad de unidades mínima para que se aplique el precio

### Posibles errores

**El seller_id no es correcto o no puede identificarse**

```
{
    "message": "You must provide a client id",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

**El item id no es correcto o no puede identificarse**

```
{
    "message": "Item not found",
    "error": "not.found",
    "status": 404,
    "cause": []
}
```

**El token no pertenece al seller_id consultado**

```
{
    "message": "Caller ID must match item owner",
    "error": "FORBIDDEN",
    "status": 403,
    "cause": []
}
```

**No cuentas con permisos para acceder al recurso**

```
{
    "message": "Caller ID does not have rights to access this endpoint",
    "error": "FORBIDDEN",
    "status": 403,
    "cause": []
}
```

**Faltan campos en la llamada revisar min_purchase_unit y/o restricciones de contexto específicas channel_marketplace y user_type_business**

```
{
    "message": "A price per quantity needs min_purchase_unit and specific context_restrictions (channel_marketplace and user_type_business)",
    "error": "bad.request",
    "status": 404,
    "cause": []
}
```

**Puedes enviar un máximo de 5 precios por cantidad**

```
{
    "message": "You can just send a maximum of 5 prices per quantity",
    "error": "bad.request",
    "status": 404,
    "cause": []
}
```

**Envío de ID ya existente**

```
{
    "message": "Price per quantity min purchase unit are not unique",
    "error": "invalid.price_per_quantity"
    "status": 400,
    "cause": []
}
```

**La moneda del precio por cantidad no coincide con la del precio standard**

```
{
    "message": "Currencies must be the same for all prices",
    "error": "invalid.price.currency",
    "status": 404,
    "cause": []
}
```

## Identificar publicaciones con precio por cantidad

Podrás filtrar las publicaciones que cuenten con precios por cantidad, reconociendo estas publicaciones en [/items](https://developers.mercadolibre.com.ar/es_ar/items-y-busquedas#) mediante el tag **"standard_price_by_quantity"** .

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/MLB3868780585
```

**Respuesta:**

```
{
    "id": "MLB3868780585",
    "site_id": "MLB",
    "title": "Smart App Wifi 220v 10a Baw Smart Switch Cor Branca",
    "family_name": "Smart App Wifi 220v 10a Baw Smart Switch Cor Branca",
    "seller_id": 532833708,
    "category_id": "MLB269930",
    "user_product_id": "MLBU1946664967",
    "official_store_id": null,
    "price": 280,
    "base_price": 280,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 200,
    "available_quantity": 200,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TIME",
            "name": "Tempo de garantia",
            "value_id": null,
            "value_name": "30 dias",
            "value_struct": {
                "number": 30,
                "unit": "dias"
            },
            "values": [
                {
                    "id": null,
                    "name": "30 dias",
                    "struct": {
                        "number": 30,
                        "unit": "dias"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantia",
            "value_id": "2230279",
            "value_name": "Garantia de fábrica",
            "value_struct": null,
            "values": [
                {
                    "id": "2230279",
                    "name": "Garantia de fábrica",
                    "struct": null
                }
            ],
            "value_type": "list"
        }
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_pro",
    "start_time": "2024-10-04T15:30:04.337Z",
    "stop_time": "2044-09-29T04:00:00.000Z",
    "end_time": "2044-09-29T04:00:00.000Z",
    "expiration_time": "2024-12-23T15:32:08.219Z",
    "condition": "new",
    "permalink": "https://produto.mercadolivre.com.br/MLB-3868780585-smart-app-wifi-220v-10a-baw-smart-switch-cor-branca-_JM",
    "thumbnail_id": "948487-MLU71542239882_092023",
    "thumbnail": "http://http2.mlstatic.com/D_948487-MLU71542239882_092023-I.jpg",
    "pictures": [
        {
            "id": "948487-MLU71542239882_092023",
            "url": "http://http2.mlstatic.com/D_948487-MLU71542239882_092023-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_948487-MLU71542239882_092023-O.jpg",
            "size": "500x267",
            "max_size": "934x500",
            "quality": ""
        },
        {
            "id": "662409-MLU73489146186_122023",
            "url": "http://http2.mlstatic.com/D_662409-MLU73489146186_122023-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_662409-MLU73489146186_122023-O.jpg",
            "size": "500x376",
            "max_size": "502x378",
            "quality": ""
        },
        {
            "id": "706368-MLU73581947059_122023",
            "url": "http://http2.mlstatic.com/D_706368-MLU73581947059_122023-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_706368-MLU73581947059_122023-O.jpg",
            "size": "473x500",
            "max_size": "565x596",
            "quality": ""
        },
        {
            "id": "948008-MLU78085160228_082024",
            "url": "http://http2.mlstatic.com/D_948008-MLU78085160228_082024-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_948008-MLU78085160228_082024-O.jpg",
            "size": "500x453",
            "max_size": "1200x1088",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "me2",
        "methods": [],
        "tags": [
            "mandatory_free_shipping"
        ],
        "dimensions": null,
        "local_pick_up": false,
        "free_shipping": true,
        "logistic_type": "drop_off",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "address_line": "Rua Cardeal Arcoverde SN",
        "zip_code": "05407002",
        "city": {
            "id": "BR-SP-44",
            "name": "São Paulo"
        },
        "state": {
            "id": "BR-SP",
            "name": "São Paulo"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "search_location": {
            "neighborhood": {
                "id": "TUxCQlBJTkNBUDE1MQ",
                "name": "Pinheiros"
            },
            "city": {
                "id": "TUxCQ1NQLTY5NzA",
                "name": "São Paulo Zona Oeste"
            },
            "state": {
                "id": "TUxCUFNBT085N2E4",
                "name": "São Paulo"
            }
        },
        "latitude": -23.5601828,
        "longitude": -46.6858799,
        "id": 1090417221
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -23.5601828,
        "longitude": -46.6858799
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "ANATEL_HOMOLOGATION_NUMBER",
            "name": "Homologação Anatel Nº",
            "value_id": "-1",
            "value_name": null,
            "values": [
                {
                    "id": "-1",
                    "name": null,
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "411107",
            "value_name": "BAW",
            "values": [
                {
                    "id": "411107",
                    "name": "BAW",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "COLOR",
            "name": "Cor",
            "value_id": "52055",
            "value_name": "Branco",
            "values": [
                {
                    "id": "52055",
                    "name": "Branco",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "COMPATIBLE_SMART_APPS",
            "name": "Aplicações inteligentes compatíveis",
            "value_id": "12306602",
            "value_name": "Smart Life",
            "values": [
                {
                    "id": "12306602",
                    "name": "Smart Life",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "COMPATIBLE_VIRTUAL_ASSISTANTS",
            "name": "Assistentes virtuais compatíveis",
            "value_id": "18618763",
            "value_name": "Lâmpadas de parede e teto",
            "values": [
                {
                    "id": "18618763",
                    "name": "Lâmpadas de parede e teto",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "EMPTY_GTIN_REASON",
            "name": "Motivo de GTIN vazio",
            "value_id": "17055160",
            "value_name": "O produto não tem código cadastrado",
            "values": [
                {
                    "id": "17055160",
                    "name": "O produto não tem código cadastrado",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "INCLUDES_PLATE",
            "name": "Inclui placa",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "INMETRO_CERTIFICATION_REGISTRATION_NUMBER",
            "name": "Número de registro/certificação INMETRO",
            "value_id": "-1",
            "value_name": null,
            "values": [
                {
                    "id": "-1",
                    "name": null,
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condição do item",
            "value_id": "2230284",
            "value_name": "Novo",
            "values": [
                {
                    "id": "2230284",
                    "name": "Novo",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "LINE",
            "name": "Linha",
            "value_id": "14954282",
            "value_name": "smart wifi",
            "values": [
                {
                    "id": "14954282",
                    "name": "smart wifi",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MAIN_COLOR",
            "name": "Cor principal",
            "value_id": "2450308",
            "value_name": "Branco",
            "values": [
                {
                    "id": "2450308",
                    "name": "Branco",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "18075451",
            "value_name": "TPSWIFI-10",
            "values": [
                {
                    "id": "18075451",
                    "name": "TPSWIFI-10",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "OUTLETS_NUMBER",
            "name": "Quantidade de tomadas",
            "value_id": "5949776",
            "value_name": "1",
            "values": [
                {
                    "id": "5949776",
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "RATED_CURRENT",
            "name": "Corrente nominal",
            "value_id": "4480026",
            "value_name": "10 A",
            "values": [
                {
                    "id": "4480026",
                    "name": "10 A",
                    "struct": {
                        "number": 10,
                        "unit": "A"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "RATED_VOLTAGE",
            "name": "Voltagem nominal",
            "value_id": "3835864",
            "value_name": "220V",
            "values": [
                {
                    "id": "3835864",
                    "name": "220V",
                    "struct": {
                        "number": 220,
                        "unit": "V"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SALE_FORMAT",
            "name": "Formato de venda",
            "value_id": "1359391",
            "value_name": "Unidade",
            "values": [
                {
                    "id": "1359391",
                    "name": "Unidade",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "SELLER_SKU",
            "name": "SKU",
            "value_id": null,
            "value_name": "543",
            "values": [
                {
                    "id": null,
                    "name": "543",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "UNITS_PER_PACK",
            "name": "Unidades por kit",
            "value_id": "2726554",
            "value_name": "1",
            "values": [
                {
                    "id": "2726554",
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "WITH_USB_PORT",
            "name": "Com entrada USB",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "WITH_WI_FI",
            "name": "Com Wi-Fi",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "status": "active",
    "sub_status": [],
    "tags": [
        "good_quality_thumbnail",
        "extended_warranty_eligible",
        "user_product_listing",
        "test_item",
        "standard_price_by_quantity",
        "immediate_payment",
        "cart_eligible"
    ],
    "warranty": "Garantia de fábrica: 30 dias",
    "catalog_product_id": "MLB26881749",
    "domain_id": "MLB-ELECTRICAL_OUTLETS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2024-10-04T15:30:04.487Z",
    "last_updated": "2024-10-04T15:34:54.749Z",
    "health": null,
    "catalog_listing": true,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

## Obtener precios del ítem con precio por cantidad

Además del comportamiento conocido del recurso [/items/$ITEM_ID/prices](https://developers.mercadolibre.com.ar/es_ar/api-de-precios#Obtener-precios-del-%C3%ADtem), donde se puede conocer los precios standard y promociones aplicadas a una publicación. Ahora va a ser posible conocer los precios por cantidad.

**Nota:**

Para conocer los precios por cantidad, se podrá enviar un header extra de manera opcional (show-all-prices: true | false)

**Llamada:**

```
curl -X GET -H 'show-all-prices: TRUE' \
'Authorization: Bearer $ACCESS_TOKEN' 
 https://api.mercadolibre.com/items/$ITEMS_ID/prices
```

**Ejemplo:**

```
curl -X GET -H 'show-all-prices: TRUE' \
'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/MLB123456789/prices
```

**Respuesta:**

```
{
   "id": "MLB3868780585",
   "prices": [
       {
           "id": "7",
           "type": "standard",
           "amount": 280,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:32:08Z",
           "conditions": {
               "context_restrictions": [],
               "start_time": null,
               "end_time": null
           }
       },
       {
           "id": "2",
           "type": "standard",
           "amount": 240,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:30:04Z",
           "conditions": {
               "context_restrictions": [
                   "channel_marketplace",
                   "user_type_business"
               ],
               "start_time": null,
               "end_time": null,
               "min_purchase_unit": 10
           }
       },
       {
           "id": "3",
           "type": "standard",
           "amount": 225.58,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:30:04Z",
           "conditions": {
               "context_restrictions": [
                   "channel_marketplace",
                   "user_type_business"
               ],
               "start_time": null,
               "end_time": null,
               "min_purchase_unit": 39
           }
       },
       {
           "id": "4",
           "type": "standard",
           "amount": 220.32,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:30:04Z",
           "conditions": {
               "context_restrictions": [
                   "channel_marketplace",
                   "user_type_business"
               ],
               "start_time": null,
               "end_time": null,
               "min_purchase_unit": 48
           }
       },
       {
           "id": "5",
           "type": "standard",
           "amount": 227.5,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:30:04Z",
           "conditions": {
               "context_restrictions": [
                   "channel_marketplace",
                   "user_type_business"
               ],
               "start_time": null,
               "end_time": null,
               "min_purchase_unit": 35
           }
       },
       {
           "id": "6",
           "type": "standard",
           "amount": 232,
           "regular_amount": null,
           "currency_id": "BRL",
           "last_updated": "2024-10-04T15:30:04Z",
           "conditions": {
               "context_restrictions": [
                   "channel_marketplace",
                   "user_type_business"
               ],
               "start_time": null,
               "end_time": null,
               "min_purchase_unit": 26
           }
       }
   ]
}
```

**Campos de la respuesta:**

La respuesta de un GET al recurso [/items/$ITEM_ID/prices](https://developers.mercadolibre.com.ar/AGREGAR_LINK_ITEMS) proporcionará los siguientes parámetros:

- **id** : Identificador del ítem

- **prices** : precio que se quiere aplicar/modificar  **id** : identificador del precio por cantidad definido **type** : tipo de precio  standard   **amount** : precio del ítem **currency_id** : ID de la moneda utilizada **last_updated** : fecha de la última actualización del precio **conditions** : restricciones aplicadas al precio  **context_restrictions** : contexto a los cuales se le aplica el precio (para el caso de precio por cantidad, siempre deberán contar con los siguientes valores)  channel_marketplace user_type_business   **min_purchase_unit** : cantidad de unidades mínima para que se aplique el precio.

## Obtener el precio actual de venta según cantidad de compra

Para los sellers que tengan habilitado el feature de precio por cantidad, va a ser posible buscar por el precio de venta actual según una cantidad de compra. Hoy por hoy, buscamos el mejor precio unitario. Con ese cambio, es posible saber el mejor precio para 10, 20, 55 unidades.

Además, va a ser posible saber todos los rangos de precios disponibles y si son rangos válidos al ser comparados con el precio unitario base.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEMS_ID/sale_price?context=$CONTEXTS&quantity=$CANTIDAD
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/MLB3647026655/sale_price?context=channel_marketplace,user_type_business&quantity=30
```

**Nota:**

- Precio base: $37000 (gana siempre que quantity < 20)

- 5 unidades: $39000 (nunca gana, por qué es >= precio base)

- 10 unidades: $38000 (nunca gana, por qué es >= precio base)

- 20 unidades: $36000 (gana siempre que 20 <= quantity < 30)

- 30 unidades: $34000 (gana siempre que quantity >= 30)

Por "ganar", se entiende que el precio va ser reflejado en el campo amount.

**Respuesta:**

```
{
    "price_id": "6",
    "amount": 200,
    "regular_amount": 300,
    "currency_id": "BRL",
    "reference_date": "2024-10-14T15:04:09Z",
    "metadata": {}
}
```

**Campos de la respuesta:**

La respuesta de un GET al recurso /items/$ITEMS_ID/sale_price?context=$CONTEXTS&quantity proporcionará los siguientes parámetros:

- **prices_id** : identificador del precio ganador

- **amount** : precio ganador para la cantidad consultada.

- **regular_amount** : precio standard del item

- **currency_id** : ID de la moneda utilizada

- **reference_date** : Fecha de creación del precio por cantidad

- **metadata** : detalle de la información de precio por cantidad (No mostrará información)

Nota:

Es posible identificar las ventas realizadas por el flujo de Precio por Cantidad a través de un GET a

**/orders**

a través de los campos:

- **[context.flows](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas#:~:text=MLB%2C%20MLM%2C%20etc)-,flows,-%3A%20es%20una%20lista)** : contiene la tag **b2b**  indicando el origen de la compra.

- **[tags](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas#:~:text=ID%20de%20moneda.-,tags,-%3A%20lista%20de%20los)** : también contiene la tag **b2b**  como marcador de la orden.

Cuando una venta se origina en el flujo de Precio por Cantidad, la tag

**b2b**

estará presente en ambos campos, indicando que la venta fue realizada en el contexto de ventas por cantidad para compradores del tipo

**“business”**

.
