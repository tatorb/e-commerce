<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/pxq-porcentaje-b2b -->
<!-- Sección: Guía para productos > Precios y Costos > Precios por cantidad -->

# Precios por cantidad porcentaje B2B

Última actualización 01/10/2026

## Precios por cantidad % B2B

**Importante:**

A partir del **27 de octubre de 2026** , ya no será posible configurar **[Precios por Cantidad con valor absoluto](https://developers.mercadolibre.com.ar/es_ar/precio-por-cantidad#:~:text=Copiar-,Agregar%2C%20modificar%20y%20eliminar%20precio%20por%20cantidad,-Importante%3A)** , ya que el endpoint /items/$ITEM_ID/prices/standard/quantity será discontinuado. Adaptá tu desarrollo para utilizar la nueva estructura de Precios por Cantidad % B2B.

**Atención:**  el endpoint /items/$ITEM_ID/prices/standard/quantity continuará disponible únicamente para la configuración de **[Precios netos por cantidad](https://developers.mercadolibre.com.ar/es_ar/precios-netos)** . Para esta funcionalidad, no habrá cambio de endpoint.

Precio por cantidad (PxQ) es un precio mayorista en el cual el comprador puede llevar más productos pagando menos. En el modelo de **Precio por cantidad porcentaje B2B** , el vendedor configura descuentos progresivos utilizando porcentajes de descuento relativos al precio base del ítem, y no valores absolutos.

Ejemplo:

**Precio base: 100,00**

| Cantidad mínima | Descuento |
| --- | --- |
| A partir de 2 unidades | 5% de descuento |
| A partir de 5 unidades | 10% de descuento |
| A partir de 10 unidades | 15% de descuento |

De esta forma, el vendedor no necesita registrar manualmente un precio absoluto para cada rango de cantidad. Los valores relativos pueden recalcularse automáticamente cuando haya cambios en el **precio base** , **promociones**  o **automatización de precio configurada** . El porcentaje permanece igual, mientras que el precio absoluto se actualiza automáticamente.

Ejemplo de cambio del precio base (sin promoción o automatización activa):

| Situación | Precio base | Descuento PxQ | Precio por unidad |
| --- | --- | --- | --- |
| Original | 100,00 | 10% | 90,00 |
| Tras el cambio | 120,00 | 10% | 108,00 |

El mismo comportamiento se aplica cuando hay una **promoción activa** . El descuento de precio por cantidad **incide sobre el precio vigente**  en el momento de la compra, no sobre el precio base original.

| Situación | Precio base | Promoción | Precio vigente | Descuento PxQ | Precio por unidad |
| --- | --- | --- | --- | --- | --- |
| Con promoción activa | 100,00 | 10% | 90,00 | 5% | 85,50 |

Este modelo busca:

- ampliar la oferta de precios mayoristas

- simplificar la gestión de precios por parte de los vendedores

- reducir la necesidad de mantenimiento manual

- mantener la consistencia de los descuentos por cantidad

- ofrecer precios por volumen más competitivos al comprador

- preservar el margen del vendedor mediante reglas de rentabilidad

Nota:

Disponible en Brasil (MLB), México (MLM), Chile (MLC) y Argentina (MLA). El acceso a Precios por Cantidad % B2B está restringido a vendedores previamente seleccionados y habilitados por Mercado Libre (tag "business"), quienes podrán aplicar precios por cantidad a sus publicaciones.

| # | Consideraciones |
| --- | --- |
| 1 | Cada ítem soporta una sola tabla de precios por cantidad. Esto significa que todos los rangos de descuento (definidos por **min_purchase_unit** ) pertenecen a un único conjunto; no es posible crear múltiples tablas mayoristas para el mismo ítem. |
| 2 | Para usuarios business que no pertenezcan al dominio **AUTOMOTIVE_TIRES** , es obligatorio incluir **user_type_business**  en **conditions.context_restrictions** , indicando que estos precios están disponibles exclusivamente para compradores B2B (business-to-business). |
| 3 | El campo **min_purchase_unit**  acepta un valor entero mayor o igual a 1 y menor o igual a 100. |
| 4 | Es posible cargar un máximo de 5 precios por cantidad, donde el porcentaje de descuento aumenta a medida que aumenta la cantidad mínima. |
| 5 | Los ítems con precios por cantidad registrados pueden identificarse por la tag **standard_price_by_quantity**  en el recurso **/items** . |
| 6 | Si el usuario agrega, modifica o elimina un PxQ, se enviará una notificación correspondiente al tópico [items prices](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#~:text=Items%20Price%3A%20recibir%C3%A1s%20notificaciones%20del%20item_id%20cada%20vez%20que%20el%20precio%20seja%20creado%2C%20actualizado%20o%20eliminado.). |

## Identificar usuarios habilitados

Los usuarios que tengan la funcionalidad habilitada, tanto para navegar por el flujo de **compra**  como compradores B2B como para publicar como **vendedores**  B2B con precios por cantidad, serán identificados con la tag **"business"** . La identificación podrá realizarse consultando el recurso de [users](https://developers.mercadolivre.com.br/pt_br/consulta-de-usuarios).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/$USER_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/3426600000
```

Respuesta:

```
{
    "id": 3426600000,
    "nickname": "TESTUSER2885447",
    "registration_date": "2026-05-25T16:52:17.465-04:00",
    "first_name": "Test",
    "last_name": "Test",
…
       },
    "user_type": "normal",
    "tags": [
        "business",
        "test_user",
        "normal"
    ],
…
}
```

## Recomendaciones de precios

Los vendedores que venden por cantidad enfrentan complejidades operativas relacionadas con las variaciones en los costos logísticos y fiscales según el destino. Este endpoint busca minimizar estas complejidades. Antes de configurar el **PxQ % B2B** , envíe las cantidades que desea configurar y recibirá recomendaciones de precio calculadas en base al ahorro en envío.

Utilice las recomendaciones devueltas para definir los rangos de precio por cantidad.

**Parámetros:**

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| item_id | string | Sí | ID del ítem con el prefijo del sitio (ej.: MLB3456789012). |
| range_item_quantities | int[] | No | Cantidades a calcular (máx. 5, cada una ≥ 1). Si se omite, utiliza rangos estándar. |
| standard_amount | number | Sí | Precio estándar del ítem. |
| currency | string | Sí | Moneda del precio enviado (ej.: BRL). |

**Llamada:**

```
curl -L -X POST \
  'https://api.mercadolibre.com/prices-per-quantity/v1/recommendations' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "item_id": "$ITEM_ID",
    "range_item_quantities": [2,5,10],
    "price": {
        "standard_amount": 185,
        "currency": "BRL"
    }
}'
```

**Ejemplo:**

```
curl -L -X POST \
  'https://api.mercadolibre.com/prices-per-quantity/v1/recommendations' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "item_id": "MLB4958146279",
    "range_item_quantities": [2,5,10],
    "price": {
        "standard_amount": 185,
        "currency": "BRL"
    }
}'
```

**Respuesta:**

```
{
    "site_id": "MLB",
    "item_id": "MLB4958146279",
    "seller_id": 3426677654,
    "price": {
        "sale_price_amount": 185,
        "standard_amount": 185,
        "currency": "BRL"
    },
    "recommendations": [
        {
            "is_incoherent_quantity": false,
            "quantity": 2,
            "amount": 176.97,
            "discount": {
                "amount": 8.03,
                "percentage": 4.340541
            },
            "profit": {
                "amount": 330.29,
                "amount_by_unit": 165.15
            },
            "shipping": {
                "original_cost": 39.7,
                "cost": 23.65,
                "discount": {
                    "amount": 8.03,
                    "percentage": 40.428212
                }
            }
        },
        {
            "is_incoherent_quantity": false,
            "quantity": 5,
            "amount": 170.08,
            "discount": {
                "amount": 14.92,
                "percentage": 8.064865
            },
            "profit": {
                "amount": 825.75,
                "amount_by_unit": 165.15
            },
            "shipping": {
                "original_cost": 99.25,
                "cost": 24.65,
                "discount": {
                    "amount": 14.92,
                    "percentage": 75.163728
                }
            }
        },
        {
            "is_incoherent_quantity": false,
            "quantity": 10,
            "amount": 167.98,
            "discount": {
                "amount": 17.02,
                "percentage": 9.2
            },
            "profit": {
                "amount": 1651.45,
                "amount_by_unit": 165.15
            },
            "shipping": {
                "original_cost": 198.5,
                "cost": 28.35,
                "discount": {
                    "amount": 17.02,
                    "percentage": 85.717884
                }
            }
        }
    ]
}
```

**Campos de la respuesta:**

| Campo | Descripción |
| --- | --- |
| **site_id** | ID del sitio del ítem (ej.: MLB, MLA). |
| **item_id** | ID del ítem consultado. |
| **seller_id** | ID del vendedor propietario del ítem. |
| **sale_price_amount** | Valor del precio de venta actual del ítem. |
| **standard_amount** | Valor del precio estándar enviado por el usuario. |
| **currency** | Moneda del precio de venta (ej.: BRL, ARS). |
| **recommendations[].quantity** | Cantidad recomendada. |
| **recommendations[].amount** | Precio recomendado por unidad para esa cantidad. |
| **recommendations[].is_incoherent_quantity** | Indica si la cantidad es incoherente (ej.: el precio para esa cantidad es mayor que el de las cantidades inferiores). |
| **recommendations[].discount.amount** | Valor absoluto del descuento por unidad en relación al precio original. |
| **recommendations[].discount.percentage** | Porcentaje de descuento en relación al precio original. |
| **recommendations[].profit.amount** | Ganancia total estimada del vendedor. Se calcula como el precio recomendado multiplicado por la cantidad solicitada, menos el costo de envío. |
| **recommendations[].profit.amount_by_unit** | Ganancia estimada por unidad vendida. |
| **recommendations[].shipping.original_cost** | Costo de envío sin descuento. |
| **recommendations[].shipping.cost** | Costo de envío final después del descuento. |
| **recommendations[].shipping.discount.amount** | Valor absoluto del descuento en el envío por unidad. |
| **recommendations[].shipping.discount.percentage** | Porcentaje de descuento en el envío por unidad. |

Nota:

El campo

**is_incoherent_quantity**

indica si la cantidad presenta una incoherencia de precios en relación con los rangos anteriores. Tenga en cuenta lo siguiente:

- Si el valor es true, significa que el precio recomendado para esa cantidad es mayor que el de los rangos anteriores, lo que genera una incoherencia en la escala de precios.

- Cuando is_incoherent_quantity sea true, no será posible registrar un precio para esa cantidad, aunque el valor enviado sea menor que el recomendado.

### Posibles errores

**Token inválido** :

```
{
  "code": "unauthorized",
  "message": "invalid access token"
}
```

**Sin el header Authorization** :

```
{
  "code": "unauthorized",
  "message": "authorization value not present"
}
```

**Body sin el campo item_id** :

```
{
  "code": "bad_request",
  "message": "the field 'item_id' is required"
}
```

**"item_id" incorrecto** :

```
{
  "code": "bad_request",
  "message": "the field 'item_id' is invalid"
}
```

**Campo "price.currency" ausente** :

```
{
  "code": "bad_request",
  "message": "the field 'price.currency' is required"
}
```

**Campo price.standard_amount igual o menor que cero** :

```
{
  "code": "bad_request",
  "message": "the field 'price.standard_amount' must be greater than 0"
}
```

**"Currency" no soportada para el sitio** :

Ocurre cuando el campo currency_id enviado no es compatible con el site_id del ítem.

```
{
  "code": "unprocessable_entity",
  "message": "currency not supported for this site"
}
```

**Seller no elegible (no posee la tag business)** :

```
{
  "code": "forbidden",
  "message": "user is not allowed to request recommendations"
}
```

Nota:

En algunos casos excepcionales, el endpoint no devuelve recomendaciones y responde con un **HTTP 204 (No Content)** . En esos casos, no se aplica ninguna validación a los precios por cantidad configurados, por lo que el seller puede definir los precios por cantidad que considere adecuados.

## Identificar versión de precios

Para crear o modificar precios por cantidad % B2B, es necesario realizar primero una llamada a **/items/$ITEM_ID/prices**  para obtener la versión actual de los precios del ítem. Esta versión debe enviarse como header en la llamada de escritura.

Importante:

El header **x-version**  es obligatorio en todas las llamadas de escritura. Su función es evitar que escrituras concurrentes se sobreescriban silenciosamente. Si no se envía, la API retornará un error indicando la ausencia de este header.

### Parámetros obligatorios

| Parámetro | Detalle |
| --- | --- |
| display_version | true |

Llamada:

```
curl -X GET 'https://api.mercadolibre.com/items/$ITEM_ID/prices?display_version=true' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'show-all-prices: true'
```

Ejemplo:

```
curl -X GET 'https://api.mercadolibre.com/items/MLB4918386917/prices?display_version=true' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'show-all-prices: true'
```

Respuesta:

```
{
    "id": "MLB4918386917",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 100,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2026-07-20T18:54:46Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        }
    ],
    "version": 9
}
```

**Campos de la respuesta:**

| Campo | Descripción |
| --- | --- |
| **id** | Identificador del ítem. |
| **prices[].id** | Identificador del precio. |
| **prices[].type** | Tipo de precio. Para precios estándar, el valor es **standard** . |
| **prices[].amount** | Precio del ítem. |
| **prices[].regular_amount** | Precio original antes de aplicar una promoción. Retorna **null**  si el ítem no tiene una promoción activa. |
| **prices[].currency_id** | ID de la moneda utilizada. |
| **prices[].last_updated** | Fecha y hora de la última modificación del precio. |
| **prices[].conditions.context_restrictions** | Contextos en los cuales el precio se aplica. |
| **version** | Versión actual de los precios del ítem. |

El valor a utilizar es el campo **version**  de la raíz de la respuesta. En el ejemplo anterior, el valor es **9** . Este número debe enviarse como header **x-version: 9**  en el POST de creación o modificación de precios por cantidad.

## Agregar, modificar y eliminar precio por cantidad

Atención:

Antes de realizar esta configuración, es **obligatorio**  consultar el endpoint de **Recomendaciones de precios**  para obtener los porcentajes sugeridos por rango de cantidad.

Permite definir o modificar precios por cantidad en la publicación con **porcentaje de descuento** .

**Parámetros:**

| Query params | Obligatorio | Detalles del valor |
| --- | --- | --- |
| Item_id | Sí | identificador de la publicación |

**Campos del body (por objeto del array price_per_quantity):**

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| type | string | Sí | Debe enviarse con el valor **"discount_percentage"** . |
| percentage | number | Sí | Porcentaje de descuento. Debe ser mayor que 0 y menor que 100. |
| conditions.context_restrictions | string[] | Sí | "channel_marketplace" y "user_type_business" |
| conditions.min_purchase_unit | integer | Sí | Cantidad mínima de unidades a partir de la cual el descuento es válido. Debe ser mayor que 1. |
| conditions.eligible | boolean | Sí | Debe enviarse con el valor **true** . La ausencia del campo resulta en error 400. |

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/items/$ITEM_ID/prices/price-per-quantity
```

Ejemplo:

```
curl --location \
  'https://api.mercadolibre.com/items/MLB4918386917/prices/price-per-quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'X-Version: 13' \
  --data '{
    "price_per_quantity": [
        {
            "type": "discount_percentage",
            "percentage": 3.63,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 9.29,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 4,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 12,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 6,
                "eligible": true
            }
        }
    ]
}'
```

Respuesta:

```
{
    "id": "MLB4918386917",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 100,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2026-07-20T18:54:46Z",
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
    "metadata": {
        "price_per_quantity_last_updated": "2026-07-29T12:38:03Z"
    },
    "last_price_id": 14,
    "version": 14,
    "price_per_quantity": [
        {
            "id": "12",
            "type": "discount_percentage",
            "percentage": 3.630000,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "13",
            "type": "discount_percentage",
            "percentage": 9.290000,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 4,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "14",
            "type": "discount_percentage",
            "percentage": 12.000000,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 6,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        }
    ]
}
```

La lógica de **modificar o eliminar**  un precio por cantidad depende del **campo "id"** .

- **Enviar solo el "id" del precio existente** : el precio se mantiene sin cambios. Ejemplo: "id": "4".

- **No enviar el "id" de un precio existente** : será eliminado. Ejemplo: si el ítem tenía los ids "4" y "6" y el request incluye solo el 4, el id "6" será eliminado.

- **Enviar datos sin "id"** : se crea un nuevo precio y recibe un id.

De esta forma, no existe la opción de actualizar un precio. Modificar un precio implica necesariamente eliminar el existente y crear uno nuevo.

### Configurar descuento para 1 unidad

También es posible configurar precio por cantidad para la unidad del ítem (**min_purchase_unit: 1** ). En este caso, cuando se realiza la configuración, el precio base del ítem pasa a mostrarse tachado en la publicación. Para obtener la recomendación de descuento para 1 unidad, incluye el valor **1**  en el array **range_item_quantities**  al consultar el endpoint de **Recomendaciones de precios** . El endpoint devolverá el valor recomendado para esa cantidad.

Ejemplo de llamada:

```
curl -X POST \
  'https://api.mercadolibre.com/prices-per-quantity/v1/recommendations' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{
    "item_id": "MLB4958146279",
    "range_item_quantities": [1,5,10],
    "price": {
        "standard_amount": 185,
        "currency": "BRL"
    }
}'
```

Respuesta:

```
{
    "site_id": "MLB",
    "item_id": "MLB4958146279",
    "seller_id": 3426677654,
    "price": {
        "sale_price_amount": 185,
        "standard_amount": 185,
        "currency": "BRL"
    },
    "recommendations": [
        {
            "is_incoherent_quantity": false,
            "quantity": 1,
            "amount": 180.98,
            "discount": {
                "amount": 4.02,
                "percentage": 2.172973
            },
            "profit": {
                "amount": 161.13,
                "amount_by_unit": 161.13
            },
            "shipping": {
                "original_cost": 19.85,
                "cost": 19.85,
                "discount": {
                    "amount": 0,
                    "percentage": 0
                }
            }
        },
        {
            "is_incoherent_quantity": false,
            "quantity": 5,
            "amount": 170.08,
            "discount": {
                "amount": 14.92,
                "percentage": 8.064865
            },
            "profit": {
                "amount": 825.75,
                "amount_by_unit": 165.15
            },
            "shipping": {
                "original_cost": 99.25,
                "cost": 24.65,
                "discount": {
                    "amount": 14.92,
                    "percentage": 75.163728
                }
            }
        },
        {
            "is_incoherent_quantity": false,
            "quantity": 10,
            "amount": 167.98,
            "discount": {
                "amount": 17.02,
                "percentage": 9.2
            },
            "profit": {
                "amount": 1651.45,
                "amount_by_unit": 165.15
            },
            "shipping": {
                "original_cost": 198.5,
                "cost": 28.35,
                "discount": {
                    "amount": 17.02,
                    "percentage": 85.717884
                }
            }
        }
    ]
}
```

Con el porcentaje devuelto para la cantidad 1, es posible configurar el descuento normalmente a través del endpoint de **Agregar, modificar y eliminar precio por cantidad** , enviando **min_purchase_unit: 1**  en la condición correspondiente.

Ejemplo de llamada:

```
curl -X POST \
  'https://api.mercadolibre.com/items/MLB4958146279/prices/price-per-quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'X-Version: 8' \
  --data '{
    "price_per_quantity": [
        {
            "type": "discount_percentage",
            "percentage": 2.18,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 1,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 8.07,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 5,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 9.2,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 10,
                "eligible": true
            }
        }
    ]
}'
```

### Eliminar todos los rangos de precio por cantidad

Para eliminar todos los rangos de precio por cantidad de una publicación, envía el array **price_per_quantity**  vacío. El header **X-Version**  sigue siendo obligatorio.

Ejemplo:

```
curl -X POST \
  'https://api.mercadolibre.com/items/MLB123456789/prices/price-per-quantity' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'X-Version: 12' \
  --data '{
    "price_per_quantity": []
}'
```

### Posibles errores

**El header X-Version no fue enviado** :

```
{
    "error": "Version must be provided for this operation",
    "code": "bad.request",
    "status": 400
}
```

**La versión enviada no corresponde a la versión actual del ítem** :

```
{
    "error": "The version provided is not the current one. Please fetch the item again",
    "code": "item.version",
    "status": 409
}
```

**Enviado "id" para agregar precio por cantidad** :

El campo **id**  dentro de **price_per_quantity**  solo debe enviarse cuando se desea mantener un precio ya existente. Si se envía un **id**  que no corresponde a ningún precio configurado actualmente en el ítem, la API retornará este error. Para crear un nuevo precio, no envíes el campo **id** ; para eliminar uno existente, simplemente omítelo del array.

```
{
    "error": "Price per quantity with id 20 not found",
    "code": "bad.request",
    "status": 400
}
```

**Porcentaje fuera del rango permitido** :

Ocurre cuando el campo **"percentage"**  tiene un valor igual o menor a 0, o igual a 100. El porcentaje de descuento debe ser un valor mayor que 0 y menor que 100.

```
{
    "error": "Percentage must be greater than 0 and less than 100",
    "code": "bad.request",
    "status": 400
}
```

**Campo conditions.eligible ausente o diferente de true** :

```
{
    "error": "Condition eligible must be true",
    "code": "bad.request",
    "status": 400
}
```

**El porcentaje de la cantidad mayor no supera el de la cantidad menor** :

La cantidad mayor debe tener siempre un porcentaje de descuento más alto que la cantidad menor.

```
{
    "code": "prices.validator.validation.failed",
    "cause_id": 5512,
    "error": "Price per quantity invalid coherence order",
    "status": 400
}
```

**Precio resultante por encima del recomendado** :

Al configurar el precio por cantidad, el **porcentaje configurado debe ser mayor o igual**  al porcentaje recomendado por el endpoint /prices-per-quantity/v1/recommendations. Un porcentaje menor resultaría en un precio por unidad por encima del recomendado, generando el error "Amount above recommended". La validación compara el precio resultante, no el número del campo "percentage" directamente.

Para que este error ocurra, el precio debe cumplir simultáneamente dos condiciones: respetar la coherencia del orden (ser menor que el precio del rango anterior) y superar el valor recomendado para esa cantidad. Ejemplo: si la recomendación para la cantidad 15 es 92,04 y el precio del rango anterior (cantidad 10) es 92,72, un valor como 92,05 generará este error: respeta la coherencia del orden, pero supera la recomendación. Si el precio también viola la coherencia del orden, la API retornará únicamente el error **Price per quantity invalid coherence order** , sin retornar el error de recomendación.

```
{
    "code": "prices.validator.validation.failed",
    "cause_id": 5599,
    "error": "Amount above recommended",
    "status": 400
}
```

**Cantidad incoherente** :

Ocurre cuando la cantidad enviada está marcada como incoherente (**is_incoherent_quantity = true** ) en la respuesta del endpoint /prices-per-quantity/v1/recommendations.

```
{
    "code": "prices.validator.validation.failed",
    "cause_id": 5598,
    "error": "Quantity is incoherent",
    "status": 400
}
```

**Número máximo de rangos de precio excedido** :

Ocurre cuando se intenta configurar más de 5 entradas en el array **price_per_quantity** . El límite máximo permitido es de 5 rangos de precio por cantidad por ítem.

```
{
    "error": "Maximum 5 price_per_quantity entries allowed for channel_marketplace and user_type_business",
    "code": "bad.request",
    "status": 400
}
```

**Ítem perteneciente al dominio Automotive Tires** :

Ocurre cuando el ítem pertenece al dominio Automotive Tires y se envía el contexto para usuarios B2B. Para aplicar precio por cantidad en publicaciones de este segmento, utiliza exclusivamente la modalidad **Precio por cantidad B2C** .

```
{
    "code": "prices.validator.validation.failed",
    "cause_id": 5531,
    "error": "Category is not enabled for B2B PxQ pricing",
    "status": 400
}
```

### Migrar de PxQ absoluto a PxQ por porcentaje

Si el ítem ya tiene Precio por cantidad absoluto configurado (modelo de valor fijo, endpoint /prices/standard/quantity), el intento de registrar Precio por cantidad por porcentaje retornará un error 400. Para reemplazar el Precio por cantidad absoluto por Precio por cantidad por porcentaje en una sola operación, envía el parámetro **remove-absolute-pxq=true**  en la URL de la llamada.

Cuando este parámetro es enviado, los nodos de PxQ absoluto existentes se eliminan automáticamente y se reemplazan por los nuevos rangos por porcentaje.

**Ejemplo:**

```
curl -X POST \
  'https://api.mercadolibre.com/items/$ITEM_ID/prices/price-per-quantity?remove-absolute-pxq=true' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'X-Version: $VERSION' \
  --data '{
    "price_per_quantity": [
        {
            "type": "discount_percentage",
            "percentage": 4.35,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2,
                "eligible": true
            }
        },
        {
            "type": "discount_percentage",
            "percentage": 8.37,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 6,
                "eligible": true
            }
        }
    ]
}'
```

Sin el parámetro **remove-absolute-pxq=true** , la API retornará el siguiente error:

```
{
    "code": "bad.request",
    "error": "Cannot add price per quantity by percentage when a standard price per quantity for the same context is present",
    "status": 400
}
```

## Identificar publicaciones con precio por cantidad

Podrás filtrar las publicaciones que tienen precios por cantidad, identificando esas publicaciones en [/items](https://developers.mercadolibre.com.ar/es_ar/items-y-busquedas#) mediante la tag **"standard_price_by_quantity"** .

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/MLB4918386917 
```

**Respuesta:**

```
{
    "id": "MLB4918386917",
    "site_id": "MLB",
    "title": "Pré-treino Haze Hardcore 300g Growth Supplements - Uva",
    "family_name": null,
    "seller_id": 3426677654,
    "category_id": "MLB264201",
    "user_product_id": "MLBU4381381402",
    "official_store_id": null,
    "price": 100,
    "base_price": 100,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 10,
    "available_quantity": 10,
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
    "start_time": "2026-07-20T18:54:46.307Z",
    "stop_time": "2046-07-15T04:00:00.000Z",
    "end_time": "2046-07-15T04:00:00.000Z",
    "expiration_time": "2026-10-08T18:54:46.397Z",
    "condition": "new",
    "permalink": "https://produto.mercadolivre.com.br/MLB-4918386917-pre-treino-haze-hardcore-300g-growth-supplements-uva-_JM",
    "thumbnail_id": "947028-MLA98776405883_112025",
    "thumbnail": "http://http2.mlstatic.com/D_947028-MLA98776405883_112025-I.webp",
    "pictures": [
        {
            "id": "947028-MLA98776405883_112025",
            "url": "http://http2.mlstatic.com/D_947028-MLA98776405883_112025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_947028-MLA98776405883_112025-O.webp",
            "size": "390x500",
            "max_size": "936x1200",
            "quality": ""
        },
        {
            "id": "885527-MLA98302766468_112025",
            "url": "http://http2.mlstatic.com/D_885527-MLA98302766468_112025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_885527-MLA98302766468_112025-O.webp",
            "size": "500x500",
            "max_size": "1200x1200",
            "quality": ""
        },
        {
            "id": "956963-MLA98302402676_112025",
            "url": "http://http2.mlstatic.com/D_956963-MLA98302402676_112025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_956963-MLA98302402676_112025-O.webp",
            "size": "500x500",
            "max_size": "1200x1200",
            "quality": ""
        },
        {
            "id": "950955-MLA98871108747_112025",
            "url": "http://http2.mlstatic.com/D_950955-MLA98871108747_112025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_950955-MLA98871108747_112025-O.webp",
            "size": "500x500",
            "max_size": "1200x1200",
            "quality": ""
        },
        {
            "id": "759597-MLA98871168423_112025",
            "url": "http://http2.mlstatic.com/D_759597-MLA98871168423_112025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_759597-MLA98871168423_112025-O.webp",
            "size": "500x500",
            "max_size": "1200x1200",
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
        "comment": "Referencia: The Testing Cavern",
        "address_line": "Testing Street 1450",
        "zip_code": "90570070",
        "city": {
            "id": "TUxCQ1BPUjgwZTJl",
            "name": "Porto Alegre"
        },
        "state": {
            "id": "BR-RS",
            "name": "Rio Grande do Sul"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "search_location": {
            "neighborhood": {
                "id": "TUxCQk1PSUE1Q0Y2",
                "name": "Moinhos de Vento"
            },
            "city": {
                "id": "TUxCQ1BPUjgwZTJl",
                "name": "Porto Alegre"
            },
            "state": {
                "id": "TUxCUFJJT0xkYzM0",
                "name": "Rio Grande do Sul"
            }
        },
        "latitude": -30.02376,
        "longitude": -51.201255,
        "id": 1624970940
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -30.02376,
        "longitude": -51.201255
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "AMINO_ACIDS_PER_SERVING",
            "name": "Aminoácidos por porção",
            "value_id": null,
            "value_name": "Arginina 1000mg,Beta-alanina 2000mg,Taurina 1000mg,Tirosina 250mg",
            "values": [
                {
                    "id": "20146303",
                    "name": "Arginina 1000mg",
                    "struct": null
                },
                {
                    "id": "20851061",
                    "name": "Beta-alanina 2000mg",
                    "struct": null
                },
                {
                    "id": "19013430",
                    "name": "Taurina 1000mg",
                    "struct": null
                },
                {
                    "id": "20988944",
                    "name": "Tirosina 250mg",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "5738279",
            "value_name": "Growth Supplements",
            "values": [
                {
                    "id": "5738279",
                    "name": "Growth Supplements",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "CONTAINS_LACTOSE",
            "name": "Contém lactose",
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
            "id": "FLAVOR",
            "name": "Sabor",
            "value_id": "2353054",
            "value_name": "Uva",
            "values": [
                {
                    "id": "2353054",
                    "name": "Uva",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "INGREDIENTS",
            "name": "Ingredientes",
            "value_id": null,
            "value_name": "Acidulante ácido cítrico,Arginina,Aroma idêntico ao natural,Aspartame,Beta-alanina,Cafeína,D-Ribose,Edulcorante sucralose e corante,Isomaltulose (palatinose),Taurina,Tirosina,Amido de milho,Agente antiumectante de dióxido de silício",
            "values": [
                {
                    "id": "11742814",
                    "name": "Acidulante ácido cítrico",
                    "struct": null
                },
                {
                    "id": "11135018",
                    "name": "Arginina",
                    "struct": null
                },
                {
                    "id": "11065649",
                    "name": "Aroma idêntico ao natural",
                    "struct": null
                },
                {
                    "id": "11184049",
                    "name": "Aspartame",
                    "struct": null
                },
                {
                    "id": "11126019",
                    "name": "Beta-alanina",
                    "struct": null
                },
                {
                    "id": "11135020",
                    "name": "Cafeína",
                    "struct": null
                },
                {
                    "id": "11742813",
                    "name": "D-Ribose",
                    "struct": null
                },
                {
                    "id": "23179680",
                    "name": "Edulcorante sucralose e corante",
                    "struct": null
                },
                {
                    "id": "21166013",
                    "name": "Isomaltulose (palatinose)",
                    "struct": null
                },
                {
                    "id": "11034268",
                    "name": "Taurina",
                    "struct": null
                },
                {
                    "id": "11213582",
                    "name": "Tirosina",
                    "struct": null
                },
                {
                    "id": "11357480",
                    "name": "Amido de milho",
                    "struct": null
                },
                {
                    "id": "12299502",
                    "name": "Agente antiumectante de dióxido de silício",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "IS_GLUTEN_FREE",
            "name": "É livre de glúten",
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
        },
        {
            "id": "IS_ORGANIC",
            "name": "É orgânico",
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
            "id": "IS_SUITABLE_FOR_LACTANTING_PEOPLE",
            "name": "É apto para as pessoas lactantes",
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
            "id": "IS_SUITABLE_FOR_PREGNANT_PEOPLE",
            "name": "É apto para as pessoas durante a gravidez",
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
            "id": "IS_VEGAN",
            "name": "É vegano",
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
            "id": "MAIN_SUPPLEMENT",
            "name": "Suplemento principal",
            "value_id": "19343903",
            "value_name": "Pré treino",
            "values": [
                {
                    "id": "19343903",
                    "name": "Pré treino",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MIN_RECOMMENDED_AGE",
            "name": "Idade mínima recomendada",
            "value_id": "11169535",
            "value_name": "19 anos",
            "values": [
                {
                    "id": "11169535",
                    "name": "19 anos",
                    "struct": {
                        "number": 19,
                        "unit": "anos"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "NET_VOLUME",
            "name": "Volume líquido",
            "value_id": "138647",
            "value_name": "300 mL",
            "values": [
                {
                    "id": "138647",
                    "name": "300 mL",
                    "struct": {
                        "number": 300,
                        "unit": "mL"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "NET_WEIGHT",
            "name": "Peso líquido",
            "value_id": "135510",
            "value_name": "300 g",
            "values": [
                {
                    "id": "135510",
                    "name": "300 g",
                    "struct": {
                        "number": 300,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "NUTRITIONAL_VALUES_PER_SERVING",
            "name": "Valores nutricionais por porção",
            "value_id": null,
            "value_name": "Cafeína 150mg,Arginina 1g,Beta-Alanina 2 g,Carboidrato 4.1g,taurina 1g,Tirosina 265mg,Valor energético 29kcal",
            "values": [
                {
                    "id": "19410995",
                    "name": "Cafeína 150mg",
                    "struct": null
                },
                {
                    "id": "25269214",
                    "name": "Arginina 1g",
                    "struct": null
                },
                {
                    "id": "24029513",
                    "name": "Beta-Alanina 2 g",
                    "struct": null
                },
                {
                    "id": "67076196",
                    "name": "Carboidrato 4.1g",
                    "struct": null
                },
                {
                    "id": "20634848",
                    "name": "taurina 1g",
                    "struct": null
                },
                {
                    "id": "67076197",
                    "name": "Tirosina 265mg",
                    "struct": null
                },
                {
                    "id": "67076198",
                    "name": "Valor energético 29kcal",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "PACKAGING_TYPE",
            "name": "Tipo de embalagem",
            "value_id": "130169",
            "value_name": "Pote",
            "values": [
                {
                    "id": "130169",
                    "name": "Pote",
                    "struct": null
                }
            ],
            "value_type": "string"
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
            "id": "SELLER_PACKAGE_HEIGHT",
            "name": "Altura da embalagem do vendor",
            "value_id": null,
            "value_name": "12 cm",
            "values": [
                {
                    "id": null,
                    "name": "12 cm",
                    "struct": {
                        "number": 12,
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
            "value_name": "10 cm",
            "values": [
                {
                    "id": null,
                    "name": "10 cm",
                    "struct": {
                        "number": 10,
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
            "value_name": "360 g",
            "values": [
                {
                    "id": null,
                    "name": "360 g",
                    "struct": {
                        "number": 360,
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
            "value_name": "10 cm",
            "values": [
                {
                    "id": null,
                    "name": "10 cm",
                    "struct": {
                        "number": 10,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SERVINGS_NUMBER",
            "name": "Quantidade de porções",
            "value_id": "133366",
            "value_name": "30",
            "values": [
                {
                    "id": "133366",
                    "name": "30",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "SERVING_VOLUME",
            "name": "Volume da porção",
            "value_id": "12356950",
            "value_name": "10 mL",
            "values": [
                {
                    "id": "12356950",
                    "name": "10 mL",
                    "struct": {
                        "number": 10,
                        "unit": "mL"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SERVING_WEIGHT",
            "name": "Peso da porção",
            "value_id": "11103655",
            "value_name": "10 g",
            "values": [
                {
                    "id": "11103655",
                    "name": "10 g",
                    "struct": {
                        "number": 10,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SUPPLEMENT_CLASS",
            "name": "Classe de suplemento",
            "value_id": "52261844",
            "value_name": "Outros",
            "values": [
                {
                    "id": "52261844",
                    "name": "Outros",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "SUPPLEMENT_FORMAT",
            "name": "Formato do suplemento",
            "value_id": "4567842",
            "value_name": "Pó",
            "values": [
                {
                    "id": "4567842",
                    "name": "Pó",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SUPPLEMENT_TYPE",
            "name": "Função do suplemento",
            "value_id": "10955015",
            "value_name": "Nutricional",
            "values": [
                {
                    "id": "10955015",
                    "name": "Nutricional",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRADE_NAME",
            "name": "Nome comercial",
            "value_id": "67076195",
            "value_name": "Haze",
            "values": [
                {
                    "id": "67076195",
                    "name": "Haze",
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
            "id": "UNITS_PER_PACKAGE",
            "name": "Unidades por embalagem",
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
            "id": "UNIT_VOLUME",
            "name": "Volume da unidade",
            "value_id": "138647",
            "value_name": "300 mL",
            "values": [
                {
                    "id": "138647",
                    "name": "300 mL",
                    "struct": {
                        "number": 300,
                        "unit": "mL"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "UNIT_WEIGHT",
            "name": "Peso da unidade",
            "value_id": "2049",
            "value_name": "300 g",
            "values": [
                {
                    "id": "2049",
                    "name": "300 g",
                    "struct": {
                        "number": 300,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item",
        "standard_price_by_quantity",
        "immediate_payment",
        "cart_eligible"
    ],
    "warranty": "Sem garantia",
    "catalog_product_id": "MLB45676040",
    "domain_id": "MLB-SUPPLEMENTS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-07-20T18:54:46.514Z",
    "last_updated": "2026-07-29T12:38:07.979Z",
    "health": null,
    "catalog_listing": true,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

## Obtener precios del ítem con precio por cantidad

Para obtener todos los precios de un ítem, incluidos los precios por cantidad B2B, utiliza la llamada GET /items/$ITEM_ID/prices enviando el header **show-all-prices: true** . La respuesta tendrá el array price_per_quantity, donde los precios por cantidad B2B se definen con un porcentaje de descuento en lugar de un valor fijo.

Llamada:

```
curl -X GET \
  'https://api.mercadolibre.com/items/MLB4918386917/prices' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'show-all-prices: true'
```

**Respuesta:**

```
{
    "id": "MLB4918386917",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 100,
            "regular_amount": null,
            "currency_id": "BRL",
            "last_updated": "2026-07-20T18:54:46Z",
            "conditions": {
                "context_restrictions": [],
                "start_time": null,
                "end_time": null
            }
        }
    ],
    "price_per_quantity": [
        {
            "id": "12",
            "type": "discount_percentage",
            "percentage": 3.63,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 2,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "13",
            "type": "discount_percentage",
            "percentage": 9.29,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 4,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        },
        {
            "id": "14",
            "type": "discount_percentage",
            "percentage": 12.0,
            "last_updated": "2026-07-29T12:38:03Z",
            "price_floor": null,
            "conditions": {
                "context_restrictions": [
                    "channel_marketplace",
                    "user_type_business"
                ],
                "min_purchase_unit": 6,
                "eligible": true,
                "start_time": null,
                "end_time": null
            }
        }
    ]
}
```

## Obtener precio de venta según cantidad de compra

Para obtener el precio de venta ganador según la cantidad que el comprador desea adquirir, agrega el parámetro **quantity**  a la llamada GET **/items/{itemId}/sale_price** . El resultado seguirá siendo un único valor, el precio ganador para esa cantidad.

Nota:

- Precio base: 100 (gana siempre que **quantity**  < 2).

- 2 unidades: 5% de descuento → 95 (gana siempre que 2 ≤ **quantity**  < 5).

- 5 unidades: 15% de descuento → 85 (gana siempre que **quantity**  ≥ 5).

Por "ganar" se entiende que el precio calculado a partir del porcentaje de descuento se reflejará en el campo **amount** . Para una cantidad determinada, gana el rango con el mayor porcentaje de descuento aplicable — es decir, aquel con el mayor **min_purchase_unit**  que aún sea menor o igual a la cantidad consultada.

| Parámetro | Valor | Obligatorio | Descripción |
| --- | --- | --- | --- |
| **context** | **user_type_business** | Sí | Obligatorio para recibir el precio B2B. |

Ejemplo:

```
curl -L -X GET \
  'https://api.mercadolibre.com/items/$ITEM_ID/sale_price?context=channel_marketplace,user_type_business&quantity=$QUANTIDADE' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl -L -X GET \
  'https://api.mercadolibre.com/items/MLB4918386917/sale_price?context=channel_marketplace,user_type_business&quantity=3' \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
    "price_id": "1",
    "amount": 96.37,
    "regular_amount": null,
    "currency_id": "BRL",
    "reference_date": "2026-07-29T13:16:29Z",
    "metadata": {
        "is_price_per_quantity": true
    }
}
```

| Campo | Descripción |
| --- | --- |
| **prices_id** | Identificador del precio ganador. |
| **amount** | Precio ganador para la cantidad consultada. |
| **regular_amount** | Precio original antes de aplicar una promoción. Retorna **null**  si el ítem no tiene una promoción activa. |
| **currency_id** | ID de la moneda utilizada. |
| **reference_date** | Fecha de creación del precio por cantidad. |
| **metadata** | Si el precio ganador corresponde a un PxQ % B2B, retornará **is_price_per_quantity: true**  en el objeto. |

Nota:

Es posible identificar las ventas realizadas a través del flujo de Precio por Cantidad mediante un GET a

**/orders**

, utilizando los campos:

- **[context.flows](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas#:~:text=MLB%2C%20MLM%2C%20etc)-,flows,-%3A%20es%20una%20lista)** : contiene la tag **b2b** , indicando el origen de la compra.

- **[tags](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas#:~:text=ID%20de%20moneda.-,tags,-%3A%20lista%20de%20los)** : también contiene la tag **b2b**  como marcador del pedido.

Cuando una venta se origina en el flujo de Precio por Cantidad, la tag

**b2b**

estará presente en ambos campos, indicando que la venta fue realizada en el contexto de ventas por cantidad para compradores del tipo

**"business"**

.
