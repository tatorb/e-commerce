<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/precios-netos -->
<!-- Sección: Guía para productos > Precios y Costos > Precios por cantidad -->

# Precios netos por cantidad

Última actualización 16/09/2026

## Precios netos por cantidad

**Importante:**

Disponible solo en **Brasil (MLB)** , para vendedores B2B (Business to Business) que pertenecen al Régimen Normal y utilizan el [**facturador de Mercado Libre**](https://developers.mercadolivre.com.br/pt_br/api-fiscal-faturamento-de-venda).

**Precios netos**  fue creado para atender las necesidades específicas de **vendedores B2B en Brasil**  que operan bajo el régimen tributario normal. Su principal objetivo es ofrecer mayor previsibilidad y control sobre el margen de lucro, ante las variaciones significativas en las alícuotas de impuestos estadales como ICMS, ICMS-ST y DIFAL.

Con esta funcionalidad, el vendedor podrá informar directamente el **valor neto**  deseado por unidad, y Mercado Libre será responsable de calcular automáticamente el precio final que se mostrará al comprador. Este cálculo considera factores como la ubicación del comprador y las reglas fiscales vigentes en cada estado.

Al eliminar incertidumbres relacionadas con la tributación, hay una reducción significativa en las cancelaciones de ventas, proporcionando una experiencia más estable y confiable. La configuración de precios netos forma parte del **flujo de Precio por cantidad (PXQ)** , permitiendo ajustes según el tipo de cliente (persona jurídica) y su localidad, garantizando transparencia en la composición de precios y consistencia en el valor recibido en cada venta.

Nota:

- La configuración de precios netos **no es obligatoria** , pudiendo el vendedor configurar sus precios en el flujo de **Precio por cantidad**  si lo desea.

- **NO**  se cargarán **Precios netos por cantidad**  sin ''user_type_business''. Por lo tanto, estos precios estarán disponibles solo para compradores B2B.

- Es posible cargar un **máximo de 5**  Precios netos por cantidad, donde el precio disminuye a medida que la cantidad mínima aumenta.

- En caso de que el usuario agregue, modifique o elimine un Precio neto por cantidad, se enviará una notificación correspondiente al tópico [items prices](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=Items%20Price%3A%20recibir%C3%A1s%20notificaciones%20del%20item_id%20cada%20vez%20que%20el%20precio%20sea%20creado%2C%20actualizado%20o%20eliminado.).

- **Vendedores B2B**  serán marcados con la tag‘business’ ey podrán ser fácilmente identificados al consultar el recurso [**users**](https://developers.mercadolibre.com.ar/es_ar/producto-consulta-usuarios#informaci%C3%B3n-privada).

## Identificar usuarios e ítems elegibles

Utilice este recurso para verificar si un usuario y sus respectivos ítems son aptos para operar con Precios Netos.

**Criterios de elegibilidad:**

- **Usuario B2B:**  Debe pertenecer al **Régimen Normal**  y utilizar el [**Facturador de Mercado Libre**](https://developers.mercadolivre.com.br/pt_br/api-fiscal-faturamento-de-venda).

- **Ítem:**  Debe poseer todos los **[datos fiscales](https://developers.mercadolivre.com.br/pt_br/envio-dos-dados-fiscais)**  configurados correctamente para ser considerado elegible a la configuración de Precios Netos por cantidad.

Llamada:

```
curl -L -X GET 'https://api.mercadolibre.com/business/v1/sites/$SITE_ID/users/$USER_ID/items/$ITEM_ID/options/net-prices/seller/eligibility' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl -L -X GET 'https://api.mercadolibre.com/business/v1/sites/MLB/users/655590662/items/MLB4177849003/options/net-prices/seller/eligibility' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
    "user_id": 655590662,
    "item_id": "MLB4177849003",
    "is_user_eligible": true,
    "is_item_eligible": true,
    "pending_actions": []
}
```

Cuando el usuario es elegible, pero el ítem consultado no posee datos fiscales configurados, en el campo "message" se mostrará el mensaje **"item has no tax information"** . En cambio, si el usuario no es elegible por no tener activado el Facturador de Mercado Libre, se mostrará el mensaje **"user ineligible for net prices by fiscal identities"** .

Ejemplo usuario elegible, pero ítem sin datos fiscales configurados:

```

{
  "user_id": 3232695484,
  "item_id": "MLB6709965196",
  "is_user_eligible": true,
  "is_item_eligible": false,
  "cause_id": "B2BSO-502",
  "message": "item has no tax information",
  "pending_actions": []
}
```

Ejemplo usuario no elegible por no tener activado el Facturador de Mercado Libre:

```

{
  "user_id": 3396749566,
  "item_id": "MLB6759546426",
  "is_user_eligible": false,
  "is_item_eligible": false,
  "cause_id": "B2BSO-404",
  "message": "user ineligible for net prices by fiscal identities",
  "pending_actions": []
}
```

### Campos de la respuesta

| Campo | Descripción |
| --- | --- |
| user_id | id del usuario |
| item_id | id del ítem |
| is_user_eligible | indica si el usuario es elegible. Valores: True o False |
| is_item_eligible | indica si el ítem es elegible. Valores: True o False |
| message | descripción legible del motivo de la inelegibilidad, cuando corresponda |

Nota:

Cuando un ítem no sea elegible debido a la falta de datos fiscales registrados, es posible cargarlos a través del recurso

[**Enviar datos fiscales** .](https://developers.mercadolivre.com.br/pt_br/envio-dos-dados-fiscais)

## Agregar, modificar y eliminar precios netos por cantidad

Permite definir **precios por cantidad con valores netos**  en una publicación, enviando una lista de precios. Para configurar correctamente los precios netos por cantidad, es necesario seguir las siguientes reglas:

- **Nodo inicial con cantidad unitaria** : El primer bloque (nodo) de la tabla de precios netos por cantidad debe contener obligatoriamente **min_purchase_unit: 1** . El valor informado en "amount" puede ser **igual o menor**  que el precio unitario estándar ya configurado en el ítem, lo que permite ofrecer un precio neto diferenciado desde la compra de 1 unidad. Este valor **no reemplaza ni altera el precio estándar del ítem** ; se agrega como un precio neto específico para compradores B2B (user_type_business).

- **Campo obligatorio en todos los nodos:**  Todos los bloques enviados deben contener el campo **"amount_tax_inclusion_type": "net"** . Este campo indica que los precios definidos son netos, es decir, ya excluyen impuestos. No se permite aplicar esta configuración solo en una parte de la tabla; todos los nodos enviados deben utilizar este campo.

- **Cantidad mínima:**  Cada nodo de la tabla debe informar el campo **min_purchase_unit**  con valores enteros mayores que 1. Este campo define la cantidad mínima de unidades necesarias para que se aplique el precio correspondiente. El valor no puede ser nulo.

### Parámetros obligatorios

| Parámetro | Descripción |
| --- | --- |
| **$ITEM_ID** | Identificador de publicación. |

Llamada de ejemplo:

```
curl -X POST 'https://api.mercadolibre.com/items/MLB5593631496/prices/standard/quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "prices": [
        {
            "type": "standard",
            "amount": 399,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 1
            }
        },
        {
            "type": "standard",
            "amount": 350,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 5
            }
        },
        {
            "type": "standard",
            "amount": 300,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 10
            }
        },
        {
            "type": "standard",
            "amount": 250,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 20
            }
        }
    ]
}'
```

Respuesta:

```
{
    "id": "MLB5593631496",
    "prices": [
        {
            "id": "2",
            "type": "standard",
            "amount": 399,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-17T13:35:09Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "3",
            "type": "standard",
            "amount": 399,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-17T13:37:22Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 1
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "4",
            "type": "standard",
            "amount": 350,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-17T13:37:22Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 5
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "5",
            "type": "standard",
            "amount": 300,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-17T13:37:22Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 10
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "6",
            "type": "standard",
            "amount": 250,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-17T13:37:22Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 20
            },
            "amount_tax_inclusion_type": "net"
        }
    ]
}
```

### Campos de la respuesta

| Campo | Descripción |
| --- | --- |
| **prices** | Lista de precios de ítems después de agregar/eliminar precios. |
| **id** | Identificador del precio. |
| **amount** | Precio del ítem. |
| **currency_id** | ID de la moneda utilizada. |
| **conditions** | Restricciones aplicadas al precio. |
| **context_restrictions** | Contexto al que se aplica el precio; para precio neto por cantidad debe contener **channel_marketplace**  y **user_type_business** . |
| **min_purchase_unit** | Cantidad mínima de unidades para que se aplique el precio. |
| **amount_tax_inclusion_type** | El valor **"net"**  indica si el precio proporcionado es un precio neto. |

Al intentar configurar Precios Netos por cantidad para un vendedor **no elegible** , es decir, que **no posee el tag “business” y no tiene reglas fiscales configuradas** , la API devolverá el error "Seller not eligible to use net price per quantity".

Ejemplo de respuesta:

```
{
    "code": "invalid.price_per_quantity",
    "error": "Seller not eligible to use net price per quantity",
    "status": 400
}
```

Al intentar configurar Precios Netos por cantidad para un ítem **no elegible** , es decir, que **no posee datos fiscales configurados** , la API devolverá el error "Item not eligible to use net price per quantity".

Ejemplo de respuesta:

```
{
    "code": "invalid.price_per_quantity",
    "error": "Item not eligible to use net price per quantity",
    "status": 400
}
```

Note:

Para **agregar**  un nuevo precio neto por cantidad, basta con incluir un nuevo nodo en el array **prices**  con el **amount**  y el **conditions.min_purchase_unit**  deseados. Para **modificar**  un nodo ya configurado, basta con enviar nuevamente ese nodo con los campos actualizados. Por otro lado, la **eliminación**  se realiza por omisión, es decir, para eliminar un precio neto por cantidad ya existente, basta con no enviar en el array **prices**  el nodo correspondiente en la solicitud.

### Configurar precio neto para la unidad del ítem

Además de los rangos de cantidad mayores, también es posible configurar un **precio neto diferenciado para la propia unidad**  del ítem **(min_purchase_unit: 1)** , enviando un valor menor que el precio unitario estándar ya configurado.

Precio unitario del ítem (antes de la configuración):

```

{
  "id": "MLB6312588352",
  "prices": [
    {
      "id": "8",
      "type": "standard",
      "amount": 500,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-04-20T12:39:21Z",
      "conditions": {
        "context_restrictions": [],
        "start_time": null,
        "end_time": null
      }
    }
  ]
}
```

Ejemplo de llamada:

```

curl -L -X POST 'https://api.mercadolibre.com/items/MLB6312588352/prices/standard/quantity' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "prices": [
    {
      "type": "standard",
      "amount": 490,
      "currency_id": "BRL",
      "amount_tax_inclusion_type": "net",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "min_purchase_unit": 1
      }
    },
    {
      "type": "standard",
      "amount": 450,
      "currency_id": "BRL",
      "amount_tax_inclusion_type": "net",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "min_purchase_unit": 2
      }
    },
    {
      "type": "standard",
      "amount": 390,
      "currency_id": "BRL",
      "amount_tax_inclusion_type": "net",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "min_purchase_unit": 4
      }
    }
  ]
}'
```

Respuesta:

```

{
  "id": "MLB6312588352",
  "prices": [
    {
      "id": "8",
      "type": "standard",
      "amount": 500,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-04-20T12:39:21Z",
      "conditions": {
        "context_restrictions": [],
        "start_time": null,
        "end_time": null
      }
    },
    {
      "id": "32",
      "type": "standard",
      "amount": 490,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-20T19:18:29Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 1
      },
      "amount_tax_inclusion_type": "net"
    },
    {
      "id": "33",
      "type": "standard",
      "amount": 450,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-20T19:18:29Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 2
      },
      "amount_tax_inclusion_type": "net"
    },
    {
      "id": "34",
      "type": "standard",
      "amount": 390,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-20T19:18:29Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 4
      },
      "amount_tax_inclusion_type": "net"
    }
  ]
}
```

Nota:

El precio estándar del ítem permanece **sin cambios**  y continúa mostrándose normalmente a los compradores que no son B2B. El precio neto enviado para min_purchase_unit: 1 se agrega como un nuevo nodo, visible solo para compradores B2B (user_type_business), sin sobrescribir el precio estándar del ítem.

### Migrar de PxQ % B2B a Precios netos por cantidad

NUEVO

Si un ítem ya tiene configurado **[Precio por cantidad % B2B](https://developers.mercadolibre.com.ar/es_ar/pxq-porcentaje-b2b)**  y el vendedor desea migrar a **Precios netos por cantidad** , es necesario llamar al endpoint /items/:item_id/prices/standard/quantity enviando el nuevo parámetro **remove_percentage_pxq=true** . Cuando se envía este parámetro, los nodos existentes de Precio por cantidad % se eliminan automáticamente y se reemplazan por los nuevos rangos de Precios netos por cantidad.

Ejemplo:

```

curl -L -X POST 'https://api.mercadolibre.com/items/MLB6312472120/prices/standard/quantity?remove_percentage_pxq=true' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "prices": [
        {
            "type": "standard",
            "amount": 75,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 1
            }
        },
        {
            "type": "standard",
            "amount": 70,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2
            }
        },
        {
            "type": "standard",
            "amount": 65,
            "currency_id": "BRL",
            "amount_tax_inclusion_type": "net",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 4
            }
        }
    ]
}'
```

```

{
  "id": "MLB6312472120",
  "prices": [
    {
      "id": "94",
      "type": "standard",
      "amount": 75,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-07-15T21:50:12Z",
      "conditions": {
        "context_restrictions": [],
        "start_time": null,
        "end_time": null
      }
    },
    {
      "id": "105",
      "type": "standard",
      "amount": 75,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-24T17:59:56Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 1
      },
      "amount_tax_inclusion_type": "net"
    },
    {
      "id": "106",
      "type": "standard",
      "amount": 70,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-24T17:59:56Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 2
      },
      "amount_tax_inclusion_type": "net"
    },
    {
      "id": "107",
      "type": "standard",
      "amount": 65,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-08-24T17:59:56Z",
      "conditions": {
        "context_restrictions": [
          "channel_marketplace",
          "user_type_business"
        ],
        "start_time": null,
        "end_time": null,
        "min_purchase_unit": 4
      },
      "amount_tax_inclusion_type": "net"
    }
  ]
}
```

Sin el parámetro **remove_percentage_pxq=true** , la API devolverá el siguiente error:

```

{
  "status": 400,
  "code": "bad.request",
  "error": "Cannot create standard price per quantity when a price per quantity by percentage for the same context is present"
}
```

Nota:

Al aplicar remove_percentage_pxq=true, los precios por cantidad en porcentaje (price_per_quantity) configurados previamente para el contexto channel_marketplace + user_type_business se eliminan y se reemplazan por los precios netos absolutos (net) enviados en la solicitud.

## Identificar publicaciones con precio neto por cantidad

En el recurso **/items**  es posible identificar si la publicación tiene precios netos por cantidad configurados, a través del tag **"net_taxes_amount_prices"** .

Llamada:

```
curl --location --request GET 'https://api.mercadolibre.com/items/$ITEM_ID' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl --location --request GET 'https://api.mercadolibre.com/items/MLB558680985' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
    "id": "MLB5593631496",
    "site_id": "MLB",
    "title": "Camisa Masculina Teste Azul G",
    "family_name": "Camisa Masculina Teste",
    "family_id": 8760037220751239,
    "seller_id": 655590662,
    "category_id": "MLB107292",
    "user_product_id": "MLBU3370724782",
    "official_store_id": null,
    "price": 399,
    "base_price": 399,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 100,
    "available_quantity": 100,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantia",
            "value_id": "6150835",
            "value_name": "Sem garantia",
            "value_struct": null,
            "values": [
                {
                    "id": "6150835",
                    "name": "Sem garantia",
                    "struct": null
                }
            ],
            "value_type": "list"
        }
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2025-08-17T13:35:09.471Z",
    "stop_time": "2045-08-12T04:00:00.000Z",
    "end_time": "2045-08-12T04:00:00.000Z",
    "expiration_time": "2025-11-05T13:35:09.543Z",
    "condition": "new",
    "permalink": "https://produto.mercadolivre.com.br/MLB-5593631496-camisa-masculina-teste-azul-g-_JM",
    "thumbnail_id": "621965-MLB89922615678_082025",
    "thumbnail": "http://http2.mlstatic.com/D_621965-MLB89922615678_082025-I.jpg",
    "pictures": [
        {
            "id": "621965-MLB89922615678_082025",
            "url": "http://http2.mlstatic.com/D_621965-MLB89922615678_082025-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_621965-MLB89922615678_082025-O.jpg",
            "size": "500x429",
            "max_size": "796x684",
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
            "self_service_out",
            "mandatory_free_shipping",
            "self_service_available"
        ],
        "dimensions": null,
        "local_pick_up": false,
        "free_shipping": true,
        "logistic_type": "cross_docking",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "address_line": "Grito de gloria 620",
        "zip_code": "01405001",
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
                "id": "TUxCQkpBUm0xaTF2",
                "name": "Jardim Paulista"
            },
            "city": {
                "id": "TUxCQ1NQLTkxMjE",
                "name": "São Paulo Zona Sul"
            },
            "state": {
                "id": "TUxCUFNBT085N2E4",
                "name": "São Paulo"
            }
        },
        "latitude": -23.5587498,
        "longitude": -46.6341625,
        "id": 1480628396
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -23.5587498,
        "longitude": -46.6341625
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "ALPHANUMERIC_MODEL",
            "name": "Modelo alfanumérico",
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
            "id": "BRAND",
            "name": "Marca",
            "value_id": null,
            "value_name": "TESTE",
            "values": [
                {
                    "id": null,
                    "name": "TESTE",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "COLOR",
            "name": "Cor",
            "value_id": "2450293",
            "value_name": "Azul",
            "values": [
                {
                    "id": "2450293",
                    "name": "Azul",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "FILTRABLE_GENDER",
            "name": "Gênero filtrável",
            "value_id": "18549360",
            "value_name": "Masculino",
            "values": [
                {
                    "id": "18549360",
                    "name": "Masculino",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "GENDER",
            "name": "Gênero",
            "value_id": "339666",
            "value_name": "Masculino",
            "values": [
                {
                    "id": "339666",
                    "name": "Masculino",
                    "struct": null
                }
            ],
            "value_type": "list"
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
            "id": "MAIN_COLOR",
            "name": "Cor principal",
            "value_id": "2450293",
            "value_name": "Azul",
            "values": [
                {
                    "id": "2450293",
                    "name": "Azul",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": null,
            "value_name": "4UP",
            "values": [
                {
                    "id": null,
                    "name": "4UP",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "RELEASE_SEASON",
            "name": "Temporada de lançamento",
            "value_id": "994283",
            "value_name": "Primavera/Verão",
            "values": [
                {
                    "id": "994283",
                    "name": "Primavera/Verão",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "RELEASE_YEAR",
            "name": "Ano de lanzamiento",
            "value_id": null,
            "value_name": "2024",
            "values": [
                {
                    "id": null,
                    "name": "2024",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "SELLER_PACKAGE_HEIGHT",
            "name": "Altura da embalagem do vendor",
            "value_id": null,
            "value_name": "29 cm",
            "values": [
                {
                    "id": null,
                    "name": "29 cm",
                    "struct": {
                        "number": 29,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_LENGTH",
            "name": "Comprimento da embalagem do vendor",
            "value_id": null,
            "value_name": "3 cm",
            "values": [
                {
                    "id": null,
                    "name": "3 cm",
                    "struct": {
                        "number": 3,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_WEIGHT",
            "name": "Peso da embalagem do vendor",
            "value_id": null,
            "value_name": "250 g",
            "values": [
                {
                    "id": null,
                    "name": "250 g",
                    "struct": {
                        "number": 250,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_WIDTH",
            "name": "Largura da embalagem do vendor",
            "value_id": null,
            "value_name": "22 cm",
            "values": [
                {
                    "id": null,
                    "name": "22 cm",
                    "struct": {
                        "number": 22,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SIZE",
            "name": "Tamanho",
            "value_id": "G",
            "value_name": "G",
            "values": [
                {
                    "id": "G",
                    "name": "G",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SIZE_GRID_ID",
            "name": "ID da guia de tamanhos",
            "value_id": null,
            "value_name": "3533472",
            "values": [
                {
                    "id": null,
                    "name": "3533472",
                    "struct": null
                }
            ],
            "value_type": "grid_id"
        },
        {
            "id": "SIZE_GRID_ROW_ID",
            "name": "ID da linha da guia de tamanhos",
            "value_id": null,
            "value_name": "3533472:1",
            "values": [
                {
                    "id": null,
                    "name": "3533472:1",
                    "struct": null
                }
            ],
            "value_type": "grid_row_id"
        },
        {
            "id": "SLEEVE_TYPE",
            "name": "Tipo de manga",
            "value_id": "466804",
            "value_name": "Curta",
            "values": [
                {
                    "id": "466804",
                    "name": "Curta",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WEDGE_SHAPE",
            "name": "Forma de caimento",
            "value_id": "12039025",
            "value_name": "Reta",
            "values": [
                {
                    "id": "12039025",
                    "name": "Reta",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WITH_RECYCLED_MATERIALS",
            "name": "Com materiais reciclados",
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
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "status": "active",
    "sub_status": [],
    "tags": [
        "good_quality_thumbnail",
        "user_product_listing",
        "standard_price_by_quantity",
        "net_taxes_amount_prices",
        "test_item",
        "immediate_payment",
        "cart_eligible"
    ],
    "warranty": "Sem garantia",
    "catalog_product_id": null,
    "domain_id": "MLB-SHIRTS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2025-08-17T13:35:09.591Z",
    "last_updated": "2025-08-17T13:50:22.038Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

## Obtener precios del ítem con precio neto por cantidad

Además del comportamiento conocido del recurso [/items/$ITEM_ID/prices](https://developers.mercadolibre.com.br/pt_br/api-de-precos#Obtener-precios-del-%C3%ADtem), donde se pueden conocer los precios estándar y promociones aplicadas a una publicación, también es posible conocer los precios netos por cantidad.

Nota:

Para conocer los precios netos por cantidad, se puede enviar un header extra de manera opcional (**show-all-prices: true | false** ).

Llamada:

```
curl -X GET \
-H 'show-all-prices: TRUE' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/$ITEMS_ID/prices'
```

Ejemplo:

```
curl -X GET -H 'show-all-prices: TRUE' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/items/MLB5586809854/prices'
```

Respuesta:

```
{
    "id": "MLB5586809854",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 5500,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-08-15T15:14:02Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "67",
            "type": "standard",
            "amount": 3500,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-11-03T19:17:17Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 6
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "68",
            "type": "standard",
            "amount": 4000,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-11-03T19:17:17Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 4
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "69",
            "type": "standard",
            "amount": 5500,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-11-03T19:17:17Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 1
            },
            "amount_tax_inclusion_type": "net"
        },
        {
            "id": "70",
            "type": "standard",
            "amount": 4500,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2025-11-03T19:17:17Z",
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "start_time": null,
                "end_time": null,
                "min_purchase_unit": 2
            },
            "amount_tax_inclusion_type": "net"
        }
    ]
}
```

## Obtener el precio de venta actual basado en la cantidad de compra

Para vendedores elegibles a la funcionalidad de **precio neto por cantidad** , esta herramienta permite consultar el **precio de venta neto actual**  basado en la cantidad informada, la ubicación y el ID del comprador.

A diferencia del comportamiento estándar, que siempre devuelve el **mejor precio unitario** , esta consulta considera los **intervalos configurados**  para precios por cantidad, devolviendo el valor efectivo que se aplicará para la cantidad deseada y el detalle de los impuestos.

### Ejemplo práctico de intervalos de precio

| Cantidad | Precio (BRL) | Regla de Aplicación |
| --- | --- | --- |
| Precio base | 399 | Se aplica siempre que la cantidad sea menor a 6. |
| 6 unidades | 300 | Se aplica cuando la cantidad está entre 6 y 10 (inclusive). |
| 11 unidades | 250 | Se aplica siempre que la cantidad sea mayor o igual a 11. |

Si el vendedor configuró rangos para 6 unidades (R$ 300) y 11 unidades (R$ 250), al consultar la cantidad de 8 unidades, la API devolverá el valor unitario de R$ 300 (referente al último rango alcanzado), ya calculado con los impuestos para la ubicación informada.

Nota:

Para conocer el detalle de los impuestos aplicados, es obligatorio el envío del header **x-calculate-net-taxes=true** .

### Parámetros obligatorios

| Parámetro | Detalle |
| --- | --- |
| **context** | channel_marketplace y user_type_business. |
| **quantity** | Cantidad de ítems a ser consultados. |
| **destination_states** | Identificación de la ubicación de destino (país + estado). |
| **buyer_id** | ID del comprador. |

### Valores de destination_states por Estado

| Estado | Sigla | Valor (destination_states) |
| --- | --- | --- |
| Acre | AC | BR-AC |
| Alagoas | AL | BR-AL |
| Amapá | AP | BR-AP |
| Amazonas | AM | BR-AM |
| Bahia | BA | BR-BA |
| Ceará | CE | BR-CE |
| Distrito Federal | DF | BR-DF |
| Espírito Santo | ES | BR-ES |
| Goiás | GO | BR-GO |
| Maranhão | MA | BR-MA |
| Mato Grosso | MT | BR-MT |
| Mato Grosso do Sul | MS | BR-MS |
| Minas Gerais | MG | BR-MG |
| Pará | PA | BR-PA |
| Paraíba | PB | BR-PB |
| Paraná | PR | BR-PR |
| Pernambuco | PE | BR-PE |
| Piauí | PI | BR-PI |
| Rio de Janeiro | RJ | BR-RJ |
| Rio Grande do Norte | RN | BR-RN |
| Rio Grande do Sul | RS | BR-RS |
| Rondônia | RO | BR-RO |
| Roraima | RR | BR-RR |
| Santa Catarina | SC | BR-SC |
| São Paulo | SP | BR-SP |
| Sergipe | SE | BR-SE |
| Tocantins | TO | BR-TO |

Llamada:

```
curl -L -X GET 'https://api.mercadolibre.com/items/$ITEM_ID/sale_price?context=channel_marketplace,user_type_business&quantity=6&destination_states=BR-SP&buyer_id=$BUYER_ID' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'x-calculate-net-taxes: true'
```

Ejemplo:

```
curl -L -X GET 'https://api.mercadolibre.com/items/MLB5586809854/sale_price?context=channel_marketplace,user_type_business&quantity=6&destination_states=BR-SP&buyer_id=655590662' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'x-calculate-net-taxes: true'
```

Respuesta:

```
{
    "price_id": "67",
    "amount": 3500,
    "regular_amount": null,
    "currency_id": "BRL",
    "reference_date": "2025-11-04T19:24:26Z",
    "metadata": {},
    "taxes": [
        {
            "tax_amount": 0,
            "base": "amount",
            "type": "ICMS"
        },
        {
            "tax_amount": 63.64,
            "base": "amount",
            "type": "PIS"
        },
        {
            "tax_amount": 293.11,
            "base": "amount",
            "type": "COFINS"
        },
        {
            "tax_amount": 0,
            "base": "amount",
            "type": "IPI"
        }
    ],
    "amount_tax_inclusion_type": "net",
    "amount_with_taxes": 3856.75
}
```

Nota:

Por “**ganar** ”, se entiende que el precio se verá reflejado en el campo amount de la respuesta de la API.

### Campos de la respuesta

| Campo | Descripción |
| --- | --- |
| **prices_id** | Identificador del precio ganador. |
| **amount** | Precio neto ganador para la cantidad consultada. |
| **regular_amount** | precio original del producto, en casos que tengan promoción. |
| **currency_id** | ID de la moneda utilizada. |
| **reference_date** | Fecha de creación del precio por cantidad. |
| **metadata** | Detalles de la información de precio por cantidad (no mostrará información). |
| **taxes** | Detalles de los impuestos aplicados al ganador para la cantidad consultada. |
| **tax_amount** | Valor calculado del impuesto. |
| **base** | Valor base del cálculo. |
| **type** | Tipo del impuesto. |
| **amount_tax_inclusion_type** | El retorno del valor **"net"**  en este campo significa que este es un precio por cantidad neto. |
| **amount_with_taxes** | Total del valor con impuestos (valor neto + impuestos). |

## Posibles errores

No se envía el campo **"amount_tax_inclusion_type": "net"** :

```
{
  "code": "invalid.price_per_quantity",
  "error": "Net prices require a 'net' tax type across all prices per quantity",
  "status": 400
}
```

No se envía el campo **"min_purchase_unit": 1**  en el nodo inicial:

```
{
  "code": "invalid.price_per_quantity",
  "error": "Net prices require a price per unit amount",
  "status": 400
}
```

Campo **"min_purchase_unit"**  enviado como cero:

```
{
  "code": "invalid.price_per_quantity",
  "error": "Price per quantity min purchase unit below the minimum",
  "status": 400
}
```

Cuando los tramos de precio por cantidad violan el orden decreciente esperado por la API. Es decir, al incrementar la cantidad mínima ("min_purchase_unit"), el "amount" correspondiente debe ser obligatoriamente menor al del tramo anterior:

```
{
  "code": "invalid.price_per_quantity",
  "error": "Price per quantity invalid coherence order",
  "status": 400
}
```
