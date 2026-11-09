<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/precios-por-cantidad-b2c -->
<!-- Sección: Guía para productos > Precios y Costos > Precios por cantidad -->

# Precios por cantidad B2C

Última actualización 18/09/2026

## Precios por cantidad B2C

Importante:

Disponible en Brasil (MLB), México (MLM) y Argentina (MLA) y, por el momento, **solo para ítems del dominio de neumáticos**  (Automotive Tires - categorias MLB2233, MLA22195 e MLM5686).

La funcionalidad se activó en **Argentina (MLA) el 21 de julio de 2026** . En **México (MLM)** , la activación está prevista para el **22 de septiembre de 2026** . La fecha de lanzamiento para Brasil (MLB) se informará tan pronto como esté definida.

### Consideraciones

- Los precios B2C son del tipo "discount_percentage" con porcentaje de descuento (percentage) y se ubican en el nuevo array price_per_quantity[], separado del array prices[].

- Las context_restrictions del B2C incluyen únicamente "channel_marketplace", **sin "user_type_business"** . Los precios B2C están disponibles para todos los compradores en el canal marketplace.

- El endpoint de creación B2C sustituye completamente el array price_per_quantity: omitir el ID de un precio existente equivale a eliminarlo. No existe la operación de "actualizar", para modificar un precio es necesario eliminarlo y crear uno nuevo.

- Es posible registrar un máximo de **2 precios B2C por cantidad por ítem** , con valores de min_purchase_unit fijos: 2 y 4. Esta restricción aplica al dominio **AUTOMOTIVE_TIRES** .

- Los sellers con **perfil B2B (tag business)**  también serán elegibles para configurar PxQ B2C en el dominio **AUTOMOTIVE_TIRES** . Tras el lanzamiento de la funcionalidad en producción, este dominio **pasará a aceptar exclusivamente PxQ B2C** , independientemente del perfil del seller. De esta forma, los ítems de este dominio no podrán tener PxQ B2B configurado.

## Identificar versión de precios

Para crear o modificar precios por cantidad B2C, es necesario realizar primero una llamada a **/items/$ITEM_ID/prices**  para obtener la versión actual de los precios del ítem. Esta versión debe enviarse como header en la llamada de escritura posterior.

Importante:

El header **x-version**  es obligatorio en todas las llamadas de escritura. Su función es evitar que escrituras concurrentes se sobreescriban silenciosamente. Si no se envía, la API devolverá un error indicando la falta de este header.

**Llamada:**

```
curl -X GET 'https://api.mercadolibre.com/items/$ITEM_ID/prices?display_version=true' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'show-all-prices: true'
```

**Ejemplo:**

```
curl -X GET 'https://api.mercadolibre.com/items/MLB6713484994/prices?display_version=true' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'show-all-prices: true'
```

**Respuesta:**

```
{
    "id": "MLB6713484994",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 950,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2026-05-04T20:35:55Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        }
    ],
    "version": 3
}
```

**Campos de la respuesta**

- **id**  : Identificador del ítem.

- **prices** : Lista de precios configurados para el ítem.  **id** : Identificador del precio. **type** : Tipo de precio. Para precios estándar, el valor es standard. **amount** : Precio del ítem. **regular_amount** : Precio original antes de aplicar una promoción. Retorna `null` si el ítem no tiene promoción activa. **currency_id** : ID de la moneda utilizada. **last_updated** : Fecha y hora de la última modificación del precio. **conditions** : Condiciones de aplicación del precio.  **context_restrictions** : Contextos en los que aplica el precio.

- **version** : Versión actual de los precios del ítem.

El valor a utilizar es el campo **version**  de la raíz de la respuesta. En el ejemplo anterior, el valor es **3** . Este número debe enviarse como header **x-version: 3**  en el POST de creación o modificación de precios por cantidad.

## Agregar, modificar y eliminar precio por cantidad

**Importante:**

Para ítems del dominio de neumáticos (AUTOMOTIVE_TIRES), **solo se permite “min_purchase_unit” con valores 2 y 4** .

Permite definir o modificar precios por cantidad en la publicación con **porcentaje de descuento** .

**Llamada:**

```
curl -L -X POST 'https://api.mercadolibre.com/items/$ITEM_ID/prices/price-per-quantity' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'x-version: 1' \
-d '{
    "price_per_quantity": [
        {
            "type": "discount_percentage",
            "percentage": 15.0,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 2,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 17.5,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 4,
                "eligible": true
            }
        }
    ]
}'
```

**Ejemplo:**

```
curl -L -X POST 'https://api.mercadolibre.com/items/MLB4642967339/prices/price-per-quantity' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'x-version: 1' \
-d '{
    "price_per_quantity": [
        {
            "type": "discount_percentage",
            "percentage": 15.0,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 2,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 17.5,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 4,
                "eligible": true
            }
        }
    ]
}'
```

**Respuesta:**

```
{
    "id": "MLB6646853040",
    "prices": [
        {
            "id": "10",
            "type": "standard",
            "amount": 650,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2026-05-04T21:08:57Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null,
                "eligible": true
            },
            "exchange_rate_context": "DEFAULT",
            "metadata": {}
        }
    ],
    "presentation": {
        "display_currency": "BRL"
    },
    "payment_method_prices": [],
    "reference_prices": [],
    "purchase_discounts": [],
    "last_price_id": 12,
    "version": 9,
    "price_per_quantity": [
        {
            "id": "11",
            "type": "discount_percentage",
            "percentage": 15.0,
            "last_updated": "2026-05-05T10:03:52Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 2,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "12",
            "type": "discount_percentage",
            "percentage": 17.5,
            "last_updated": "2026-05-05T10:03:52Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace"
                ],
                "min_purchase_unit": 4,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        }
    ]
}
```

La lógica de **modificar o eliminar**  un precio por cantidad depende del **campo "id"** .

- **Enviar solo el “id” del precio existente** : el precio se mantiene sin cambios. Ejemplo: "id": "4".

- **No enviar el “id” de un precio existente** : este se elimina. Ejemplo: Si el ítem tenía los ids “4” y "6" y el request incluye solo el “4”, el id "6" será eliminado.

- ****Enviar datos sin "id"** : se crea un nuevo precio y se le asigna un id.**

De esta forma, no existe la opción de actualizar un precio. Modificar un precio implica necesariamente eliminar el existente y crear uno nuevo.

### Posibles errores

**Número máximo de faixas de precio excedido**

Se produce cuando se intenta configurar más de 2 entradas en el array price_per_quantity. El límite máximo permitido es de 2 faixas de precio por cantidad por ítem.

```
{
  "error": "Maximum 2 price_per_quantity entries allowed for channel_marketplace",
  "code": "bad.request",
  "status": 400
}
```

**Enviado “id” para agregar precio por cantidad**

El campo "id" dentro de "price_per_quantity" solo debe enviarse cuando se desea mantener un precio que ya existe. Si se envía un id que no corresponde a ningún precio configurado actualmente en el ítem, la API devolverá un error. Para crear un precio nuevo, no envíes el campo id; para eliminar uno existente, simplemente omítelo del array.

```
{
    "status": 400,
    "code": "bad.request",
    "error": "Price per quantity with id 5 not found"
}
```

**La versión enviada no corresponde a la versión actual del ítem**

El valor del header **x-version**  enviado en la llamada no es lo correcto.

```
{
  "error": "The version provided is not the current one. Please fetch the item again",
  "status": 409,
  "code": "item.version"
}
```

**No se envió el header x-version**

El header **x-version**  es obligatorio para todas las operaciones de escritura sobre precios por cantidad B2C. Si se omite, la API devolverá el siguiente error:

```
{
  "error": "Version must be provided for this operation",
  "status": 400,
  "code": "bad.request"
}
```

**Porcentaje fuera del rango permitido**

Se produce cuando el campo **"percentage"**  tiene un valor igual o menor a 0, o igual a 100. El porcentaje de descuento debe ser un valor mayor a 0 y menor a 100.

```
{
  "status": 400,
  "error": "Percentage must be greater than 0 and less than 100",
  "code": "bad.request"
}
```

**Ítem no pertenece al dominio Automotive Tires**

Se produce cuando se intenta configurar un precio por cantidad B2C para un ítem cuya categoría no pertenece al dominio **AUTOMOTIVE_TIRES**  (categorias MLB2233, MLA22195 y MLM5686).

```
{
  "code": "invalid.price_per_quantity",
  "error": "Price per quantity is available only for automotive tires",
  "status": 400
}
```

**El descuento de la cantidad mayor no supera al de la cantidad menor**

La cantidad mayor siempre debe tener un porcentaje de descuento más alto que la cantidad menor.

```
{
  "code": "prices.validator.validation.failed",
  "cause_id": 5612,
  "error": "Price must be strictly decreasing as quantity increases",
  "status": 400
}
```

## Obtener precios del ítem con precio por cantidad

Para obtener todos los precios de un ítem, incluyendo los precios por cantidad B2C, utiliza la llamada a **GET /items/$ITEM_ID/prices** . La respuesta tendrá el nuevo array **price_per_quantity** , donde se definen los precios por cantidad B2C con un porcentaje de descuento en lugar de un monto fijo.

Nota:

- Los precios B2B se identifican por contar con **user_type_business**  en **context_restrictions** .

- Tanto para B2B como B2C, campo **min_purchase_unit**  > 0.

- Los precios B2C aparecen exclusivamente en el array **price_per_quantity** , con solo **channel_marketplace**  en **context_restrictions** .

**Llamada:**

```
curl -L -X GET 'https://api.mercadolibre.com/items/$ITEM_ID/prices' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -L -X GET 'https://api.mercadolibre.com/items/MLB6646853040/prices' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "id": "MLB6646853040",
  "prices": [
    {
      "id": "10",
      "type": "standard",
      "amount": 650,
      "regular_amount": null,
      "currency_id": "BRL",
      "last_updated": "2026-05-04T21:08:57Z",
      "conditions": {
        "context_restrictions": [],
        "start_time": null,
        "end_time": null
      }
    }
  ],
  "price_per_quantity": [
    {
      "id": "11",
      "type": "discount_percentage",
      "percentage": 15.0,
      "last_updated": "2026-05-05T10:03:52Z",
      "price_floor": null,
      "conditions": {
        "context_restrictions": [
          "channel_marketplace"
        ],
        "min_purchase_unit": 2,
        "eligible": true,
        "start_time": null,
        "end_time": null
      }
    },
    {
      "id": "12",
      "type": "discount_percentage",
      "percentage": 17.5,
      "last_updated": "2026-05-05T10:03:52Z",
      "price_floor": null,
      "conditions": {
        "context_restrictions": [
          "channel_marketplace"
        ],
        "min_purchase_unit": 4,
        "eligible": true,
        "start_time": null,
        "end_time": null
      }
    }
  ]
}
```

**Campos de la respuesta:**

- **id:**  identificador del precio

- **type:**  tipo de precio. Para B2C siempre será **discount_percentage**

- **percentage:**  porcentaje de descuento aplicado sobre el precio standard del ítem

- **last_updated:**  fecha y hora de la última actualización del precio

- **conditions:**  restricciones aplicadas al precio  **context_restrictions:**  contextos en los que se aplica el precio. Para B2C siempre incluirá **channel_marketplace**  **min_purchase_unit:**  cantidad mínima de unidades para que se aplique el precio **eligible:**  indica si el precio está activo y puede aplicarse **start_time / end_time:**  fechas de vigencia del precio. Pueden ser **null**

## Obtener precio de venta según cantidad de compra

Para obtener el precio de venta ganador según la cantidad que el comprador desea adquirir, agrega el parámetro **quantity**  a la llamada **GET /items/{itemId}/sale_price** . El resultado seguirá siendo un único valor, el precio ganador para esa cantidad.

Si el precio ganador corresponde a un PxQ B2C, la respuesta incluirá el campo **is_price_per_quantity: true**  en el objeto **metadata** .

**Llamada:**

```
curl -L -X GET 'https://api.mercadolibre.com/items/$ITEM_ID/sale_price?quantity=5' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -L -X GET 'https://api.mercadolibre.com/items/MLB6646853040/sale_price?quantity=5' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "price_id": "10",
  "amount": 536.25,
  "regular_amount": null,
  "currency_id": "BRL",
  "reference_date": "2026-05-05T10:46:14Z",
  "metadata": {
    "is_price_per_quantity": true
  }
}
```

## Identificar publicaciones con precio por cantidad

Podrás filtrar las publicaciones que cuenten con precios por cantidad, reconociendo estas publicaciones en [/items](https://developers.mercadolibre.com.ar/es_ar/items-y-busquedas#) mediante el tag **"standard_price_by_quantity"** .

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/MLB6713484994
```

**Respuesta:**

```
{
    "id": "MLB6713484994",
    "site_id": "MLB",
    "title": "Michelin Ii Primacy Test Pxq B2c - Promo",
    "family_name": null,
    "seller_id": 3347552577,
    "category_id": "MLB2233",
    "user_product_id": null,
    "official_store_id": null,
    "price": 950,
    "base_price": 950,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 6,
    "available_quantity": 6,
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
    "start_time": "2026-05-04T20:35:55.785Z",
    "stop_time": "2046-04-29T04:00:00.000Z",
    "end_time": "2046-04-29T04:00:00.000Z",
    "expiration_time": "2026-07-23T20:35:55.852Z",
    "condition": "new",
    "permalink": "https://produto.mercadolivre.com.br/MLB-6713484994-michelin-ii-primacy-test-pxq-b2c-promo-_JM",
    "thumbnail_id": "800206-MLB95151503674_102025",
    "thumbnail": "http://http2.mlstatic.com/D_800206-MLB95151503674_102025-I.webp",
    "pictures": [
        {
            "id": "800206-MLB95151503674_102025",
            "url": "http://http2.mlstatic.com/D_800206-MLB95151503674_102025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_800206-MLB95151503674_102025-O.webp",
            "size": "358x500",
            "max_size": "859x1199",
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
        "address_line": "daw da SN",
        "zip_code": "14010030",
        "city": {
            "id": "BR-SP-23",
            "name": "Ribeirão Preto"
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
                "id": "TVhYQ2VudHJvVFZoWVVtbGlaV2x5dzZOdklGQ0",
                "name": "Centro"
            },
            "city": {
                "id": "TVhYUmliZWlyw6NvIFByZXRvVFV4Q1VGTkJUM",
                "name": "Ribeirão Preto"
            },
            "state": {
                "id": "TUxCUFNBT085N2E4",
                "name": "São Paulo"
            }
        },
        "latitude": -21.1817961,
        "longitude": -47.8002979,
        "id": 1610141194
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -21.1817961,
        "longitude": -47.8002979
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "AUTOMOTIVE_TIRE_ASPECT_RATIO",
            "name": "Relação de aspecto",
            "value_id": null,
            "value_name": "55",
            "values": [
                {
                    "id": null,
                    "name": "55",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "76166",
            "value_name": "Michelin",
            "values": [
                {
                    "id": "76166",
                    "name": "Michelin",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "EXTERNAL_NOISE_REDUCTION_EFFICIENCY",
            "name": "Eficiência de redução de ruído externo",
            "value_id": "11308238",
            "value_name": "A",
            "values": [
                {
                    "id": "11308238",
                    "name": "A",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "EXTERNAL_NOISE_REDUCTION_LEVEL",
            "name": "Nivel de redução de ruído externo",
            "value_id": "11363510",
            "value_name": "68 dBA",
            "values": [
                {
                    "id": "11363510",
                    "name": "68 dBA",
                    "struct": {
                        "number": 68,
                        "unit": "dBA"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_SAVING_EFFICIENCY",
            "name": "Eficiência de poupança de combustível",
            "value_id": "11300936",
            "value_name": "C",
            "values": [
                {
                    "id": "11300936",
                    "name": "C",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "IS_DIRECTIONAL",
            "name": "É direcional",
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
            "id": "IS_RUN_FLAT",
            "name": "É run flat",
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
            "value_id": "5914488",
            "value_name": "Primacy",
            "values": [
                {
                    "id": "5914488",
                    "name": "Primacy",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "LOAD_INDEX",
            "name": "Índice de carga",
            "value_id": "75319",
            "value_name": "94",
            "values": [
                {
                    "id": "75319",
                    "name": "94",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MANUFACTURER_TIRE_SIZE",
            "name": "Tamanho",
            "value_id": "36524054",
            "value_name": "295/55 R16",
            "values": [
                {
                    "id": "36524054",
                    "name": "295/55 R16",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "7741851",
            "value_name": "Primacy 4",
            "values": [
                {
                    "id": "7741851",
                    "name": "Primacy 4",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "OUTSIDE_DIAMETER",
            "name": "Diâmetro externo",
            "value_id": "7494998",
            "value_name": "631.9 mm",
            "values": [
                {
                    "id": "7494998",
                    "name": "631.9 mm",
                    "struct": {
                        "number": 631.9,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "RIM_DIAMETER",
            "name": "Diâmetro da roda",
            "value_id": null,
            "value_name": "17 \"",
            "values": [
                {
                    "id": null,
                    "name": "17 \"",
                    "struct": {
                        "number": 17,
                        "unit": "\""
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SECTION_WIDTH",
            "name": "Largura de secção",
            "value_id": null,
            "value_name": "205 mm",
            "values": [
                {
                    "id": null,
                    "name": "205 mm",
                    "struct": {
                        "number": 205,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_HEIGHT",
            "name": "Altura da embalagem do vendor",
            "value_id": null,
            "value_name": "66 cm",
            "values": [
                {
                    "id": null,
                    "name": "66 cm",
                    "struct": {
                        "number": 66,
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
            "value_name": "21 cm",
            "values": [
                {
                    "id": null,
                    "name": "21 cm",
                    "struct": {
                        "number": 21,
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
            "value_name": "9219 g",
            "values": [
                {
                    "id": null,
                    "name": "9219 g",
                    "struct": {
                        "number": 9219,
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
            "value_name": "66 cm",
            "values": [
                {
                    "id": null,
                    "name": "66 cm",
                    "struct": {
                        "number": 66,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SERVICE_TYPE",
            "name": "Tipo de serviço",
            "value_id": "4369800",
            "value_name": "P",
            "values": [
                {
                    "id": "4369800",
                    "name": "P",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "SIDEWALL",
            "name": "Lateral",
            "value_id": "13384862",
            "value_name": "BSW",
            "values": [
                {
                    "id": "13384862",
                    "name": "BSW",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "TERRAIN_TYPE",
            "name": "Tipo de terreno",
            "value_id": "4369773",
            "value_name": "HT",
            "values": [
                {
                    "id": "4369773",
                    "name": "HT",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TIRES_NUMBER",
            "name": "Quantidade de pneus",
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
            "id": "TIRE_ASPECT_RATIO",
            "name": "Relação de aspecto do pneu",
            "value_id": null,
            "value_name": "55 %",
            "values": [
                {
                    "id": null,
                    "name": "55 %",
                    "struct": {
                        "number": 55,
                        "unit": "%"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "TIRE_CONSTRUCTION_TYPE",
            "name": "Tipo de construção",
            "value_id": "79419",
            "value_name": "Radial",
            "values": [
                {
                    "id": "79419",
                    "name": "Radial",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "UNITS_PER_PACK",
            "name": "Unidades por kit",
            "value_id": null,
            "value_name": "1",
            "values": [
                {
                    "id": null,
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "VEHICLE_TYPE",
            "name": "Tipo de veículo",
            "value_id": "11377043",
            "value_name": "Carro/Caminhonete",
            "values": [
                {
                    "id": "11377043",
                    "name": "Carro/Caminhonete",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WET_GRIP_EFFICIENCY",
            "name": "Eficiência de aderência em molhado",
            "value_id": "11300941",
            "value_name": "A",
            "values": [
                {
                    "id": "11300941",
                    "name": "A",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WITH_NOISE_REDUCTION",
            "name": "Com redução de ruído",
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
    "variations": [
        {
            "id": 194124095318,
            "price": 950,
            "attribute_combinations": [
                {
                    "id": "SPEED_INDEX",
                    "name": "Índice de velocidade",
                    "value_id": "362211",
                    "value_name": "A1",
                    "values": [
                        {
                            "id": "362211",
                            "name": "A1",
                            "struct": null
                        }
                    ],
                    "value_type": "list"
                }
            ],
            "available_quantity": 6,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "800206-MLB95151503674_102025"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "inventory_id": null,
            "item_relations": [],
            "user_product_id": "MLBU3946240324"
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item",
        "catalog_listing_eligible",
        "good_quality_thumbnail",
        "standard_price_by_quantity",
        "immediate_payment",
        "cart_eligible"
    ],
    "warranty": "Sem garantia",
    "catalog_product_id": "MLB35830119",
    "domain_id": "MLB-AUTOMOTIVE_TIRES",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-05-04T20:35:55.966Z",
    "last_updated": "2026-05-07T12:01:47.516Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

**Comportamiento con promociones y automatización de precios**

El precio por cantidad B2C es compatible con promociones activas y con la automatización de precios. En ambos casos, el porcentaje de descuento configurado no se modifica — lo que cambia es el precio base sobre el que se aplica:

- Si el ítem tiene una **promoción activa** , el porcentaje se aplica sobre el precio promocional, no sobre el precio regular.

- Si el precio estándar se actualiza por **automatización** , el porcentaje se recalcula automáticamente sobre el nuevo precio base, generando un precio absoluto distinto.

- Si el ítem **entra en una promoción**  después de haber configurado el PxQ, ambos conviven: el precio estándar se sincroniza con la promoción y los precios por cantidad se ajustan en consecuencia.
