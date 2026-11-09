<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/items-y-busquedas -->
<!-- Sección: Recursos de la API -->

# Ítems y Búsquedas

Última actualización 10/09/2026

## Búsqueda de ítems

**Importante:**

Los endpoints de consultas múltiples **/items?ids=**  y **/users?ids=**  entran en proceso de deprecación. Para realizar estas consultas, usá **/items/bulk?ids=**  y **/users/bulk?ids=** . Los nuevos endpoints ya están disponibles. Migrá tus integraciones antes del **25/10/2026** . Durante este período, los endpoints actuales y sus reemplazos convivirán.

## Resumen de los recursos disponibles

| Recurso | Descripción | Reemplace por: |
| --- | --- | --- |
| /sites/SITEID/search?nickname=NICKNAME | Obtener ítems de los listados por nickname. | Sin sustituición. |
| /sites/SITEID/search?sellerid=SELLER_ID | Permite listar ítems por vendedor. | https://api.mercadolibre.com/users/{User_id}/items/search. |
| /sites/SITEID/search?sellerid=SELLER_ID&category=$CATEGORY_ID | Obtener ítems de los listados por vendedor en una categoría específica. | https://api.mercadolibre.com/users/{User_id}/items/search. |
| /users/$USER_ID/items/search | Permite listar todos los ítems de la cuenta de un vendedor. | Se mantiene |
| /items?ids=ITEMID1,ITEM_ID2 | Consulta de múltiples ítems. | Nuevo /items/bulk?ids=ITEMID1,ITEM_ID2 |
| /users?ids=USERID1,USER_ID2 | Consulta de múltiples usuarios. | Nuevo /users/bulk?ids=USERID1,USER_ID2 |
| /items?ids=ITEMID1,ITEM_ID2&attributes=ATTRIBUTE1,ATTRIBUTE2,$ATTRIBUTE3 | Consulta de múltiples ítems seleccionando campos. | Nuevo /items/bulk?ids=ITEMID1,ITEM_ID2&attributes=body.ATTRIBUTE1,body.ATTRIBUTE2 |
| /users/$USER_ID/items/search?search_type=scan | Permite obtener más de 1000 items correspondientes a un usuario. | Se mantiene |

Revise posibles errores cómo los: **401**  e [**403**](https://developers.mercadolibre.com.ar/es_ar/error-403).

## Migración de consultas múltiples

Durante el período de convivencia, los endpoints actuales y sus reemplazos estarán disponibles. A partir de octubre de 2026, utilizá los endpoints bulk.

| Endpoint actual | Reemplazo |
| --- | --- |
| `/items?ids={ITEM_ID1},{ITEM_ID2}` | `/items/bulk?ids={ITEM_ID1},{ITEM_ID2}` |
| `/users?ids={USER_ID1},{USER_ID2}` | `/users/bulk?ids={USER_ID1},{USER_ID2}` |

### Cambios en **/items/bulk**

- El campo **code**  pasa a llamarse **status_code** .

- La respuesta incluye **id**  en el nivel raíz de cada elemento.

- Para seleccionar campos, agregá el prefijo **body.**  a cada atributo. Por ejemplo: **attributes=body.id,body.price** .

## Valores en el campo available_quantity

En los recursos públicos de Ítems y Búsquedas la información de "available_quantity" será referencial con los siguientes valores:

### available_quantity

| Dato real | Referencia |
| --- | --- |
| RANGO_1_50 | 1 |
| RANGO_51_100 | 50 |
| RANGO_101_150 | 100 |
| RANGO_151_200 | 150 |
| RANGO_201_250 | 200 |
| RANGO_251_500 | 250 |
| RANGO_501_5000 | 500 |
| RANGO_5001_50000 | 5000 |
| RANGO_50001_99999 | 50000 |

## Buscar ítems por vendedor

Según el tipo de recurso que utilices obtendrás los siguientes datos:

- **/sites/$SITE_ID/search?**  obtienes los resultados de ítems activos directamente de los listados de Mercado Libre.

- **/users/$USER_ID/items/search**  obtienes un listado de los ítems publicados por determinado vendedor desde su cuenta.

### Obtener ítems de los listados por vendedor

Esta búsqueda se ajusta a las reglas de los listados de la plataforma. Los resultados siempre serán de ítems activos.

### Por ID de vendedor

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/sites/SITE_ID/search?seller_id=$SELLER_ID
```

### Por nickname

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/sites/SITE_ID/search?nickname=$NICKNAME
```

También se pueden aplicar diferentes filtros y ordenamientos.

Dentro de **/sites/$SITE_ID/search?**  están los campos "available_sorts" y "available_filters" al adicionar un parámetro.

**¿Cómo filtrar?**  Por ejemplo, para filtrar ítems con envío gratis encontrarás entre los ”available_filters" disponibles el ID "shipping" y dentro de éste el value con ID “free”.

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/sites/SITE_ID/search?seller_id=$SELLER_ID&shipping_cost=free
```

**¿Cómo ordenar?**  En este caso deberás agregar “sort” con el ID disponible del orden que quieras aplicar, por ejemplo: “price_asc”

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/sites/SITE_ID/search?seller_id=$SELLER_ID&sort=price_asc
```

Nota:

Por defecto, la búsqueda en los listados ya viene con un orden de relevancia definido.

## Por ID de vendedor para una categoría específica

Utilizando el siguiente ejemplo podrás buscar dentro de una categoría específica. Con la siguiente llamada podrás consultar las publicaciones de categorías específicas.

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/sites/SITE_ID/search?seller_id=SELLERID&category=CATEGORY_ID
```

## Ítems con pérdida de exposición

Importante:

Esta funcionalidad está disponible en México, Chile y Brasil.

Con el siguiente filtro, podrás reconocer aquellos ítems que están perdiendo o podrían perder exposición debido a reclamos o cancelaciones. Puedes utilizar:

- **unhealthy** : para identificar los ítems que ya están perdiendo exposición.

- **warning** : para aquellos que podrían perderla y que aún es posible recuperar.

- **healthy** : para ítems que no fueron impactados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/SELLER_ID/items/search?reputation_health_gauge=unhealthy
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789/items/search?reputation_health_gauge=unhealthy
```

Respuesta:

```
{
   "seller_id":"123456789",
   "query":null,
   "paging":{
      "limit":50,
      "offset":0,
      "total":1
   },
   "results":[
      "MLA844702264"
   ],
   "orders":[
      {
         "id":"stop_time_asc",
         "name":"Order by stop time ascending"
      }
   ],
   "available_orders":[
      {
         "id":"stop_time_asc",
         "name":"Order by stop time ascending"
      },
      {
         "id":"stop_time_desc",
         "name":"Order by stop time descending"
      },
      {
         "id":"start_time_asc",
         "name":"Order by start time ascending"
      },
      {
         "id":"start_time_desc",
         "name":"Order by start time descending"
      },
      {
         "id":"available_quantity_asc",
         "name":"Order by available quantity ascending"
      },
      {
         "id":"available_quantity_desc",
         "name":"Order by available quantity descending"
      },
      {
         "id":"price_asc",
         "name":"Order by price ascending"
      },
      {
         "id":"price_desc",
         "name":"Order by price descending"
      },
      {
         "id":"last_updated_desc",
         "name":"Order by lastUpdated descending"
      },
      {
         "id":"last_updated_asc",
         "name":"Order by last updated ascending"
      },
      {
         "id":{
            "id":"inventory_id_asc",
            "field":"inventory_id",
            "missing":"_last",
            "order":"asc"
         },
         "name":"Order by inventory id ascending"
      }
   ]
}
```

## Obtener ítems de la cuenta de un vendedor

Ya no mostramos el bloque correspondiente a los campos “filters” y “available_filters” para mejorar los tiempos de respuesta. Si requieres esta información, envía el parámetro include_filters=true en el search.

### Por user_id

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search
```

### Por SKU

- Seller_custom_field: si el ítem contiene un SKU en el campo “seller_custom_field”, puedes probar de la siguiente forma:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?sku=$SELLER_CUSTOM_FIELD
```

- Seller_sku: Si el ítem contiene un SKU en el campo/atributo “SELLER_SKU”, puedes probar así:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?seller_sku=$SELLER_SKU
```

### Por estado

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?status=active
```

### Con/sin product identifier

Utilizando los parámetros:

- **missing_product_identifiers=true**  consultas las publicaciones que no tienen product identifier cargado o enviando. Así, identificas qué publicaciones puedes mejorar cumpliendo con uno de los [requisitos más importante de calidad](https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones).

- **missing_product_identifiers=false**  obtienes el listado de publicaciones con PI cargado o enviando.

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?missing_product_identifiers=true
```

## Filtrar y ordenar resultados de ítems del vendedor

·l recurso /users/$USER_ID/items/search? no muestra los campos “filters” y “available_filters” para mejorar los tiempos de respuesta actuales. Para verlos, envía el parámetro **include_filters=true**  y la respuesta devolverá los campos excluídos en la llamada sin parámetro.

Ejemplo de llamada sin parámetro:

```
curl -H 'Authorization: Bearer ACCESSTOKEN'-XGEThttps://api.mercadolibre.com/users/USER_ID/items/search
```

Respuesta de llamada sin parámetro:

```
{
    "seller_id": "123456789",
    "query": null,
    "paging": {
        "limit": 50,
        "offset": 0,
        "total": 1
    },
    "results": [
        "MLA844702264"
    ],
    "orders": [
        {
            "id": "stop_time_asc",
            "name": "Order by stop time ascending"
        }
    ],
    "available_orders": [
        {
            "id": "stop_time_asc",
            "name": "Order by stop time ascending"
        },
        {
            "id": "stop_time_desc",
            "name": "Order by stop time descending"
        },
        {
            "id": "start_time_asc",
            "name": "Order by start time ascending"
        },
        {
            "id": "start_time_desc",
            "name": "Order by start time descending"
        },
        {
            "id": "available_quantity_asc",
            "name": "Order by available quantity ascending"
        },
        {
            "id": "available_quantity_desc",
            "name": "Order by available quantity descending"
        },
        {
            "id": "price_asc",
            "name": "Order by price ascending"
        },
        {
            "id": "price_desc",
            "name": "Order by price descending"
        },
        {
            "id": "last_updated_desc",
            "name": "Order by lastUpdated descending"
        },
        {
            "id": "last_updated_asc",
            "name": "Order by last updated ascending"
        },
        {
            "id": {
                "id": "inventory_id_asc",
                "field": "inventory_id",
                "missing": "_last",
                "order": "asc"
            },
            "name": "Order by inventory id ascending"
        }
    ]
}
```

Ejemplo de llamada con parámetro:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?include_filters=true
```

Respuesta de llamada con parámetros:

```
{
    "seller_id": "123456789",
    "query": null,
    "paging": {
        "limit": 50,
        "offset": 0,
        "total": 1
    },
    "results": [
        "MLA844702264"
    ],
    "filters": [],
    "available_filters": [
        {
            "id": "status",
            "name": "Status",
            "values": [
                {
                    "id": "pending",
                    "name": "Inactive items for debt or MercadoLibre policy violation",
                    "results": 0
                },
                {
                    "id": "not_yet_active",
                    "name": "Items newly created or pending activation",
                    "results": 0
                },
                {
                    "id": "programmed",
                    "name": "Items scheduled for future activation",
                    "results": 0
                },
                {
                    "id": "active",
                    "name": "Active items",
                    "results": 1
                },
                {
                    "id": "paused",
                    "name": "Paused Items",
                    "results": 0
                },
                {
                    "id": "closed",
                    "name": "Closed Items",
                    "results": 0
                }
            ]
        },
        {
            "id": "sub_status",
            "name": "Substatus",
            "values": [
                {
                    "id": "deleted",
                    "name": "Deleted substatus",
                    "results": 0
                },
                {
                    "id": "forbidden",
                    "name": "Forbidden substatus",
                    "results": 0
                },
                {
                    "id": "freezed",
                    "name": "Freezed substatus",
                    "results": 0
                },
                {
                    "id": "held",
                    "name": "Held substatus",
                    "results": 0
                },
                {
                    "id": "suspended",
                    "name": "Suspended substatus",
                    "results": 0
                },
                {
                    "id": "waiting_for_patch",
                    "name": "Waiting for patch substatus",
                    "results": 0
                },
                {
                    "id": "warning",
                    "name": "Warning items with MercadoLibre policy violation",
                    "results": 0
                }
            ]
        },
        {
            "id": "buying_mode",
            "name": "Buying Mode",
            "values": [
                {
                    "id": "buy_it_now",
                    "name": "Buy it now",
                    "results": 1
                },
                {
                    "id": "classified",
                    "name": "Classified",
                    "results": 0
                },
                {
                    "id": "auction",
                    "name": "Auction",
                    "results": 0
                }
            ]
        },
        {
            "id": "listing_type_id",
            "name": "Listing type",
            "values": [
                {
                    "id": "gold_pro",
                    "name": "Gold proffesional",
                    "results": 0
                },
                {
                    "id": "gold_special",
                    "name": "Gold special",
                    "results": 0
                },
                {
                    "id": "gold_premium",
                    "name": "Gold premium",
                    "results": 0
                },
                {
                    "id": "gold",
                    "name": "Gold",
                    "results": 0
                },
                {
                    "id": "silver",
                    "name": "Silver",
                    "results": 0
                },
                {
                    "id": "bronze",
                    "name": "Bronze",
                    "results": 0
                },
                {
                    "id": "free",
                    "name": "Free",
                    "results": 1
                }
            ]
        },
        {
            "id": "shipping_free_methods",
            "name": "Shipping free methods",
            "values": []
        },
        {
            "id": "shipping_tags",
            "name": "Shipping Tags",
            "values": []
        },
        {
            "id": "shipping_mode",
            "name": "Shipping Mode",
            "values": [
                {
                    "id": "not_specified",
                    "results": 1
                }
            ]
        },
        {
            "id": "listing_source",
            "name": "Listing Source",
            "values": [
                {
                    "id": "tucarro",
                    "name": "TuCarro",
                    "results": 0
                },
                {
                    "id": "tuinmueble",
                    "name": "TuInmueble",
                    "results": 0
                },
                {
                    "id": "tumoto",
                    "name": "TuMoto",
                    "results": 0
                },
                {
                    "id": "tulancha",
                    "name": "TuLancha",
                    "results": 0
                },
                {
                    "id": "autoplaza",
                    "name": "Autoplaza",
                    "results": 0
                },
                {
                    "id": "autoplaza_ml",
                    "name": "Autoplaza Premium",
                    "results": 0
                }
            ]
        },
        {
            "id": "labels",
            "name": "Others",
            "values": [
                {
                    "id": "few_available",
                    "name": "Items with few availables",
                    "results": 0
                },
                {
                    "id": "with_bids",
                    "name": "Items with bids",
                    "results": 0
                },
                {
                    "id": "without_bids",
                    "name": "Items whithout bids",
                    "results": 1
                },
                {
                    "id": "accepts_mercadopago",
                    "name": "Items with MercadoPago",
                    "results": 1
                },
                {
                    "id": "ending_soon",
                    "name": "Items ending in 20 days or less",
                    "results": 0
                },
                {
                    "id": "with_mercadolibre_envios",
                    "name": "Items with MercadoLibre Envíos",
                    "results": 0
                },
                {
                    "id": "without_mercadolibre_envios",
                    "name": "Items without MercadoLibre Envíos",
                    "results": 1
                },
                {
                    "id": "with_low_quality_image",
                    "name": "Items with low quality image",
                    "results": 0
                },
                {
                    "id": "with_free_shipping",
                    "name": "Items with free shipping",
                    "results": 0
                },
                {
                    "id": "without_free_shipping",
                    "name": "Items with free shipping",
                    "results": 1
                },
                {
                    "id": "with_automatic_relist",
                    "name": "Items with automatic relist",
                    "results": 0
                },
                {
                    "id": "waiting_for_payment",
                    "name": "Items waiting for payment",
                    "results": 0
                },
                {
                    "id": "suspended",
                    "name": "Suspended items",
                    "results": 0
                },
                {
                    "id": "cancelled",
                    "name": "Items cancelled that can not be recovered",
                    "results": 0
                },
                {
                    "id": "being_reviewed",
                    "name": "Items under review",
                    "results": 0
                },
                {
                    "id": "fix_required",
                    "name": "Items waiting for user fix",
                    "results": 0
                },
                {
                    "id": "waiting_for_documentation",
                    "name": "Items waiting for user documentation",
                    "results": 0
                },
                {
                    "id": "without_stock",
                    "name": "Paused items that are out of stock",
                    "results": 0
                },
                {
                    "id": "incomplete_technical_specs",
                    "name": "Items with incomplete technical specs",
                    "results": 0
                },
                {
                    "id": "loyalty_discount_eligible",
                    "name": "Loyalty discount eligible items",
                    "results": 0
                },
                {
                    "id": "with_fbm_contingency",
                    "name": "Items in FBM contingency",
                    "results": 0
                },
                {
                    "id": "with_shipping_self_service",
                    "name": "Items with shipping self service logistic",
                    "results": 0
                }
            ]
        },
        {
            "id": "logistic_type",
            "name": "Logistic Type",
            "values": [
                {
                    "id": "not_specified",
                    "results": 1
                }
            ]
        }
    ],
    "orders": [
        {
            "id": "stop_time_asc",
            "name": "Order by stop time ascending"
        }
    ],
    "available_orders": [
        {
            "id": "stop_time_asc",
            "name": "Order by stop time ascending"
        },
        {
            "id": "stop_time_desc",
            "name": "Order by stop time descending"
        },
        {
            "id": "start_time_asc",
            "name": "Order by start time ascending"
        },
        {
            "id": "start_time_desc",
            "name": "Order by start time descending"
        },
        {
            "id": "available_quantity_asc",
            "name": "Order by available quantity ascending"
        },
        {
            "id": "available_quantity_desc",
            "name": "Order by available quantity descending"
        },
        {
            "id": "price_asc",
            "name": "Order by price ascending"
        },
        {
            "id": "price_desc",
            "name": "Order by price descending"
        },
        {
            "id": "last_updated_desc",
            "name": "Order by lastUpdated descending"
        },
        {
            "id": "last_updated_asc",
            "name": "Order by last updated ascending"
        },
        {
            "id": {
                "id": "inventory_id_asc",
                "field": "inventory_id",
                "missing": "_last",
                "order": "asc"
            },
            "name": "Order by inventory id ascending"
        }
    ]
}
```

**¿Cómo ordenar?**  En este caso deberás agregar “orders” con el ID disponible del orden que quieras aplicar, por ejemplo: “start_time_desc”.

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?orders=start_time_desc
```

Nota:

Por defecto ya viene con un orden stop_time_asc aplicado.

**¿Cómo filtrar?**  Por ejemplo, para filtrar ítems con listing_type “gold_pro” encontrarás entre los ”available_filters" disponibles el ID "listing_type_id" y dentro de éste el value con ID “gold_pro”.

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?listing_type_id=gold_pro
```

Nota:

El uso de nuestro recurso de búsqueda de ítems de un vendedor no sustituye el uso de las notificaciones de ítems. Esto es siempre para tener la integración más consistente y actualizada sobre los datos de las publicaciones de los vendedores que trabajan con tu aplicación.

## Consultar vendedores restringidos

Reconoce si un vendedor tiene más de 200.000 ítems y no recibirás los campos “filters” y “available_filters” en la respuesta del recurso /search.

Llamada:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search/restrictions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789/items/search/restrictions
```

Respuesta:

```
{
   "aggregations_allowed":false,
   "query_allowed":true,
   "sort_allowed":true
}
```

Si el campo **aggregations_allowed**  tiene valor false significa que el vendedor está restringido por superar los 200.000 ítems y la búsqueda no devolverá los bloques “filters” y “available_filters”. Si envías el parámetro “include_filters”=true en /search, retornaremos un status 206 y en caso de no enviarlo, obtendrás un status 200.

## Consultas múltiples

Nota:

Los ejemplos de esta sección muestran los endpoints deprecados. Para nuevas integraciones, utilizá `/items/bulk?ids=` y `/users/bulk?ids=`.

Utiliza la función Multiget para mejorar la interacción con los recursos de ítems y users, y así poder acceder con una sola llamada a un máximo de 20 resultados. Ten en cuenta que la respuesta utilizando multiget será devuelta en formato verbose, lo que significa que además del json con la información, responderemos con un código que indicará si la consulta fue exitosa o no para cada una de las búsquedas.

Llamada a /ítems:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/items?ids=ITEM_ID1,$ITEM_ID2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items?ids=MLA599260060,MLA594239600
```

Respuesta:

```
[
     {
      "code": 200,
      "body": {

                "id": "MLA599260060",
                "site_id": "MLA",
                "title": "Item De Test - Por Favor No Ofertar",
                "subtitle": null,
                "seller_id": 303888594,
                "category_id": "MLA401685",
                "official_store_id": null,
                "price": 130,
                "base_price": 130,
                "original_price": null,
                "currency_id": "ARS",
                "initial_quantity": 1,
                "available_quantity": 1,
                "sale_terms": [],
                [...]
                "automatic_relist": false,
                "date_created": "2018-02-26T18:15:05.000Z",
                "last_updated": "2018-03-29T04:14:39.000Z",
                "health": null
              }
    },
    {
          "code": 200,
           "body": {

                "id": "MLA594239600",
                "site_id": "MLA",
                "title": "Item De Test - Por Favor No Ofertar",
                "subtitle": null,
                "seller_id": 303888594,
                "category_id": "MLA401685",
                "official_store_id": null,
                "price": 120,
                "base_price": 120,
                "original_price": null,
                "currency_id": "ARS",
                "initial_quantity": 1,
                "available_quantity": 1,
                "sale_terms": [],
                [...]
                "automatic_relist": false,
                "date_created": "2018-02-26T18:15:05.000Z",
                "last_updated": "2018-03-29T04:14:39.000Z",
                "health": null
              }
    }
]
```

Llamada a /users:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users?ids=USER_ID1,$USER_ID2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users?ids=401114259,287440999
```

Respuesta:

```
[
  {
    "code": 200,
    "body": {

      "id": 401114259,
      "nickname": "user_test234",
      "registration_date": "2019-02-05T10:38:03.000-04:00",
      "country_id": "BR",
      "address": {
        "city": null,
        "state": null
      },
      "user_type": "normal",
      "tags": [
        "normal"
      ],
      "logo": null,
      "points": 0,
      "site_id": "MLB",
      "permalink": "http://perfil.mercadolivre.com.br/user_test234",
      "seller_reputation": {
        "level_id": null,
        "power_seller_status": null,
        "transactions": {
          "canceled": 0,
          "completed": 0,
          "period": "historic",
          "ratings": {
            "negative": 0,
            "neutral": 0,
            "positive": 0
          },
          "total": 0
        }
      },
      "buyer_reputation": {
        "tags": [
        ]
      },
      "status": {
        "site_status": "guest"
      }
    }
  },
  {
    "code": 200,
    "body": {
      "id": 287440999,
      "nickname": "user_test111",
      "registration_date": "2019-03-06T00:16:08.000-04:00",
      "country_id": "MX",
      "address": {
        "city": null,
        "state": null
      },
      "user_type": "normal",
      "tags": [
        "normal"
      ],
      "logo": null,
      "points": 0,
      "site_id": "MLM",
      "permalink": "http://perfil.mercadolibre.com.mx/user_test111",
      "seller_reputation": {
        "level_id": null,
        "power_seller_status": null,
        "transactions": {
          "canceled": 0,
          "completed": 0,
          "period": "historic",
          "ratings": {
            "negative": 0,
            "neutral": 0,
            "positive": 0
          },
          "total": 0
        }
      },
      "buyer_reputation": {
        "tags": [
        ]
      },
      "status": {
        "site_status": "active"
      }
    }
  }
]
```

## Selección de campos

Nota:

El endpoint `/items?ids=` con `attributes` está deprecado. Utilizá `/items/bulk?ids=` y agregá el prefijo `body.` a cada atributo solicitado.

Otra alternativa que puedes implementar en el GET a ítems es la selección de campos para recibir solamente aquellos que sean necesarios.

Para poder definir los campos que quieres recibir, deberás agregar el parámetro attributes como se explica en el ejemplo. Conoce más sobre como trabajar con Atributos en la [documentación](https://developers.mercadolibre.com.ar/es_ar/atributos) correspondiente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/items?ids=ITEM_ID1,ITEMID2&attributes=ATTRIBUTE1,ATTRIBUTE2,ATTRIBUTE3
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items?ids=MLA599260060,MLA594239600&attributes=id,price,category_id,title
```

Respuesta:

```
[
     {
          "code": 200,
           "body": {

    "id": "MLA599260060",
    "title": "Item De Test - Por Favor No Ofertar",
    "category_id": "MLA401685",
    "price": 130
              }
        }

 {
          "code": 200,
           "body": {

    "id": "MLA594239600",
    "title": "Item De Test - Por Favor No Ofertar",
    "category_id": "MLA401685",
    "official_store_id": null,
    "price": 120,
              }
        }

]
```

## Buscar más de 1000 registros

Para realizar búsquedas de más de 1000 registros de Items, Preguntas y Respuestas de la forma **users/$USER_ID/items/search**  o **/questions/search**  debes:

1. Enviar el parámetro **search_type=scan**  a la consulta y quitar el offset. Por ejemplo:

2. Para consultar más de 1000 items:

3. `curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?search_type=scan`

4. Para consultar más de 1000 preguntas de un ítem:

5. `curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/questions/search?searchtype=scan&item=ITEM_ID`

6. En el resultado obtendrás un campo scroll_id que expira en 5 minutos:

7. `"scroll_id": "YXBpY29yZS1pdGVtcw==:ZHMtYXBpY29yZS1pdGVtcy0wMQ==:DXF1ZXJ5QW5kRmV0Y2gBAAAAABIu7AgWMXl6anF3SU5SMVNaQXFxTkZubHBqQQ=="`

8. Para obtener los resultados de scroll_id, debe actualizar el parámetro con cada llamada. Utiliza el mismo scroll_id para todas las llamadas:

9. `curl -X GET -H 'Authorization: Bearer ACCESSTOKEN'https://api.mercadolibre.com/users/USER_ID/items/search?search_type=scan&scroll_id=YXBpY29yZS1pdGVtcw==:ZHMtYXBpY29yZS1pdGVtcy0wMQ==:DXF1ZXJ5QW5kRmV0Y2gBAAAAABIu7AgWMXl6anF3SU5SMVNaQXFxTkZubHBqQQ==`

10. Así, obtendrás los resultados a partir de los 1.000.

11. Para seguir obteniendo las próximas páginas de resultados basta con hacer el mismo GET a la llamada hasta llegar al final de la lista. Cuando llegues al final recibirás null.

Nota:

En caso de no utilizar el parámetro limit se devolverá por defecto 50 items del total. Podrás agregar un limit máximo de 100.
