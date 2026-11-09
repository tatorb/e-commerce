<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/competencia-en-catalogo -->
<!-- Sección: Guía para productos > Catálogo -->

# Competencia

Última actualización 21/07/2026

## Competencia

En catálogo, las publicaciones compiten por obtener las ventas de la página de producto y un algoritmo determina quién será el ganador de esas ventas, con base en características de la publicación y del vendedor mismo, como **precio de la publicación, cuotas sin interés**  y **tipo de envío: full, gratis**  o **en el día** .

Nota:

Hablaremos del ganador en forma unívoca, aunque eventualmente el vendedor podría estar ganando en general, pero no en particular para ciertos usuarios (por ejemplo, si viven muy lejos y no obtendrían un envío en el mismo día de la compra).

## Notificaciones por cambio de estado

Con el tópico **Item competition**  podrás suscribirte y comenzar a [recibir notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) sobre el cambio de estado de las publicaciones de catálogo, te permitirá reconocer la publicación que modifica su estado de competencia a ganador o viceversa.

## Detalle de la competencia

Con este recurso puedes obtener toda la información sobre el detalle del estado de la publicación de un vendedor dentro de catálogo: puede estar ganando, compartiendo primer lugar, perdiendo o listada.

Cuando una publicación está con estado de listada significa que no puede ganar dentro de catálogo porque incumple con ciertas razones que impiden que compita, pero, sigue siendo una publicación que un comprador puede adquirir y visualizar desde el buscador principal de Mercado Libre.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/price_to_win?SITE_ID&version=v2
```

Ejemplo de llamada para una publicación que está perdiendo en competencia:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1234567/price_to_win?version=v2
```

Respuesta con **status: competing** :

```
{
   "item_id": "MLA930793214",
   "current_price": 267999,
   "currency_id": "ARS",
   "price_to_win": 267999,
   "boosts": [
       {
           "id": "fulfillment",
           "status": "opportunity",
           "description": "Mercado Envíos Full"
       },
       {
           "id": "free_installments",
           "status": "opportunity",
           "description": "Cuotas sin interés"
       },
       {
           "id": "free_shipping",
           "status": "boosted",
           "description": "Envíos gratis por Mercado Envíos"
       },
       {
           "id": "shipping_collect",
           "status": "boosted",
           "description": "Mercado Envíos Colecta"
       },
       {
           "id": "same_day_shipping",
           "status": "boosted",
           "description": "Envíos en el día por Mercado Envíos"
       }
   ],
   "status": "winning",
   "consistent": true,
   "visit_share": "maximum",
   "competitors_sharing_first_place": 0,
   "reason": [],
   "catalog_product_id": "MLA16163648",
   "winner": {
       "item_id": "MLA930793214",
       "price": 267999,
       "currency_id": "ARS",
       "boosts": [
           {
               "id": "fulfillment",
               "status": "opportunity",
               "description": "Mercado Envíos Full"
           },
           {
               "id": "free_installments",
               "status": "opportunity",
               "description": "Cuotas sin interés"
           },
           {
               "id": "free_shipping",
               "status": "boosted",
               "description": "Envíos gratis por Mercado Envíos"
           },
           {
               "id": "shipping_collect",
               "status": "boosted",
               "description": "Mercado Envíos Colecta"
           },
           {
               "id": "same_day_shipping",
               "status": "boosted",
               "description": "Envíos en el día por Mercado Envíos"
           }
       ]
   }
}
```

Ejemplo de llamada para una publicación que está ganando en competencia:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA765432/price_to_win?version=v2
```

Respuesta con **status:winning** :

```
{
   "item_id": "MLA930793214",
   "current_price": 267999,
   "currency_id": "ARS",
   "price_to_win": 267999,
   "boosts": [
       {
           "id": "fulfillment",
           "status": "opportunity",
           "description": "Mercado Envíos Full"
       },
       {
           "id": "free_installments",
           "status": "opportunity",
           "description": "Cuotas sin interés"
       },
       {
           "id": "free_shipping",
           "status": "boosted",
           "description": "Envíos gratis por Mercado Envíos"
       },
       {
           "id": "shipping_collect",
           "status": "boosted",
           "description": "Mercado Envíos Colecta"
       },
       {
           "id": "same_day_shipping",
           "status": "boosted",
           "description": "Envíos en el día por Mercado Envíos"
       }
   ],
   "status": "winning",
   "consistent": true,
   "visit_share": "maximum",
   "competitors_sharing_first_place": 0,
   "reason": [],
   "catalog_product_id": "MLA16163648",
   "winner": {
       "item_id": "MLA930793214",
       "price": 267999,
       "currency_id": "ARS",
       "boosts": [
           {
               "id": "fulfillment",
               "status": "opportunity",
               "description": "Mercado Envíos Full"
           },
           {
               "id": "free_installments",
               "status": "opportunity",
               "description": "Cuotas sin interés"
           },
           {
               "id": "free_shipping",
               "status": "boosted",
               "description": "Envíos gratis por Mercado Envíos"
           },
           {
               "id": "shipping_collect",
               "status": "boosted",
               "description": "Mercado Envíos Colecta"
           },
           {
               "id": "same_day_shipping",
               "status": "boosted",
               "description": "Envíos en el día por Mercado Envíos"
           }
       ]
   }
}
```

Ejemplo de llamada para una publicación que está compartiendo el primer lugar en competencia:

Nota:

El **status:sharing_first_place**  identifica a todos los vendedores que según las condiciones de la oferta actualmente comparten el primer lugar como **ganador** .

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA9876543/price_to_win?version=v2
```

Respuesta con: **sharing_first_place** :

```
{
   "item_id": "MLA9876543",
   "current_price": 493000,
   "currency_id": "ARS",
   "price_to_win": 485109,
   "boosts": [
       {
           "id": "fulfillment",
           "status": "opportunity",
           "description": "Mercado Envíos Full"
       },
       {
           "id": "free_installments",
           "status": "opportunity",
           "description": "Cuotas sin interés"
       },
       {
           "id": "free_shipping",
           "status": "boosted",
           "description": "Envíos gratis por Mercado Envíos"
       },
       {
           "id": "shipping_collect",
           "status": "boosted",
           "description": "Mercado Envíos Colecta"
       },
       {
           "id": "same_day_shipping",
           "status": "boosted",
           "description": "Envíos en el día por Mercado Envíos"
       }
   ],
   "status": "sharing_first_place",
   "consistent": true,
   "visit_share": "medium",
   "competitors_sharing_first_place": 1,
   "reason": [],
   "catalog_product_id": "MLA15934914",
   "winner": {
       "item_id": "MLA765432",
       "price": 48150,
       "currency_id": "ARS",
       "boosts": [
           {
               "id": "fulfillment",
               "status": "opportunity",
               "description": "Mercado Envíos Full"
           },
           {
               "id": "free_installments",
               "status": "opportunity",
               "description": "Cuotas al mismo precio que publicaste"
           },
           {
               "id": "free_shipping",
               "status": "boosted",
               "description": "Envíos gratis por Mercado Envíos"
           },
           {
               "id": "shipping_collect",
               "status": "boosted",
               "description": "Mercado Envíos Colecta"
           },
           {
               "id": "same_day_shipping",
               "status": "opportunity",
               "description": "Envíos en el día por Mercado Envíos"
           }
       ]
   }
}
```

Ejemplo de llamada para una publicación que no está compitiendo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA456789/price_to_win?version=v2
```

Respuesta con **status: listed:**

```
{
   "item_id": "MLA456789",
   "current_price": 239999,
   "currency_id": "ARS",
   "price_to_win": null,
   "boosts": [
       {
           "id": "fulfillment",
           "status": "opportunity",
           "description": "Mercado Envíos Full"
       },
       {
           "id": "free_installments",
           "status": "opportunity",
           "description": "Cuotas sin interés"
       },
       {
           "id": "free_shipping",
           "status": "boosted",
           "description": "Envíos gratis por Mercado Envíos"
       },
       {
           "id": "shipping_collect",
           "status": "boosted",
           "description": "Mercado Envíos Colecta"
       },
       {
           "id": "same_day_shipping",
           "status": "opportunity",
           "description": "Envíos en el día por Mercado Envíos"
       }
   ],
   "status": "listed",
   "consistent": true,
   "visit_share": "minimum",
   "competitors_sharing_first_place": null,
   "reason": [
       "reputation_below_threshold"
   ],
   "catalog_product_id": "MLA15934914",
   "winner": {
       "item_id": "MLA765432",
       "price": 48150,
       "currency_id": "ARS",
       "boosts": [
           {
               "id": "fulfillment",
               "status": "opportunity",
               "description": "Mercado Envíos Full"
           },
           {
               "id": "free_installments",
               "status": "opportunity",
               "description": "Cuotas al mismo precio que publicaste"
           },
           {
               "id": "free_shipping",
               "status": "boosted",
               "description": "Envíos gratis por Mercado Envíos"
           },
           {
               "id": "shipping_collect",
               "status": "boosted",
               "description": "Mercado Envíos Colecta"
           },
           {
               "id": "same_day_shipping",
               "status": "opportunity",
               "description": "Envíos en el día por Mercado Envíos"
           }
       ]
   }
```

### Campos de la respuesta

**price_to_win** : indica el precio (en la moneda actual de la publicación) para que tengas una **publicación más competitiva** , es decir, que realizando un PUT al recurso /items con el precio sugerido, su publicación tendrá un **precio más competitivo en el Catálogo** .
 **boosts** : indica as características da publicação que proporcionam chances de ganhar, tais como:

- **fulfillment** : [Mercado Envíos Full](https://developers.mercadolibre.com.ar/es_ar/mercado-envios-full-fulfillment).

- **free_installments** : cuotas sin interés.

- **free_shipping** : [frete grátis](https://developers.mercadolibre.com.ar/es_ar/enviogratis) con Mercado Envío.

- **shipping_collect** : [Mercado Envíos Coleta](https://developers.mercadolibre.com.ar/es_ar/envios-colecta-cross-docking).

- **same_day_shipping** : envíos en el mismo día de la compra con Mercado Envíos.

Puedes reconocer dentro del campo **boost**  el estado según corresponda:

| Estado del boost | Detalle |
| --- | --- |
| **boosted** | Tiene la condición de venta y actualmente aplica el boost. |
| **not_boosted** | Tiene la condición de venta pero no es un boost que mejora las posibilidades de ganar. |
| **opportunity** | No tiene la condición de venta. Si se aplica, mejoraría las chances de ganar. |
| **not_apply** | La condición de venta no aplica como boost en el producto donde compite el ítem. |

**status** : indica si el producto está ganando para el público general o para segmentos minoritarios, por ejemplo: quienes no aprovechan el envío en el mismo día. Cuando está ganando, el valor es **winning** , de lo contrario será **competing**  índica que se encuentra perdiendo, adicionalmente el valor **sharing_first_place**  para cuando se comparte primer lugar con otras publicaciones dentro de la página de producto. 
 
 **visit_share:** : indica el nivel de visibilidad que tiene tu publicación en el catálogo. Estos valores pueden variar dependiendo los estados:

- **Winning** : siempre será maximum.

- **Competing** : siempre será maximum.

- **Sharing_first_place** : siempre será medium.

**competitors_sharing_first_place** : indica la cantidad de vendedores que comparten el primer lugar. Por lo que dependerá también de los estados de las publicaciones:

- **Winning** : siempre será 0, ya que al ser ganador se lleva todas las ventas y visibilidad en el catálogo.

- **Competing** : siempre será null, pues al perder tiene que mejorar las condiciones para compartir el primer lugar o ganar.

- **Listed** : siempre será null, pues al perder tiene que mejorar las condiciones para compartir el primer lugar o ganar.

- **Sharing_first_place** : mostrará el valor de vendedores que se encuentren compitiendo por el primer lugar.

**reason** : mostrará información únicamente cuando la publicación no esté compitiendo, permitiendo identificar el motivo por el cual no lo está haciendo y así realizar acciones de mejora.

**catalog_product_id** : indica el ID de la página de producto a la que pertenece la publicación.

**winner** : indica el detalle del producto que está actualmente como ganador, permitiendo realizar una comparación rápida, con el item_id de la publicación que estás consultando, mostrando campos como: item_id, price, currency_id y boosts.

## Razones

Existen diferentes razones por las que una publicación no se encuentra compitiendo dentro de catálogo, a continuación listamos todos los posibles motivos que responderá el endpoint de [endpoint de price_to_win](https://developers.mercadolibre.com.ar/es_ar/competencia-en-catalogo?nocache=true#Detalle-de-la-competencia) en el atributo **reason** , que te permitirá realizar las diferentes acciones para mejorar tu publicación e ingresarla a la competencia.

| Reason | Explicación |
| --- | --- |
| **non_trusted_seller** | El vendedor no puede competir porque se encuentra marcado como vendedor no confiable. Aparece en los listados al final. |
| **reputation_below_threshold** | El vendedor no puede competir, ya que no alcanza la reputación requerida para poder ganar. Aparece en los listados. |
| **item_reputation_below_threshold** | La publicación no puede competir, ya que no alcanza la reputación requerida para poder ganar. Aparece en los listados. |
| **winner_has_better_reputation** | El vendedor tiene una reputación que podría competir, pero hay un ganador con mejor reputación. Por el momento, solo aparece en los listados (caso amarillo con winner verde). |
| **manufacturing_time** | La publicación tiene manufacturing time, aparece en los listados y no puede ganar porque el ganador tiene stock inmediato. |
| **temporarily_winning_manufacturing_time** | La publicación tiene manufacturing time, está ganando temporalmente porque no hay competidores en el mismo nivel de reputación sin manufacturing time. |
| **temporarily_competing_manufacturing_time** | La publicación tiene manufacturing time, está compitiendo temporalmente porque no hay competidores en el mismo nivel de reputación sin manufacturing time, el ganador también tiene manufacturing time. |
| **temporarily_winning_best_reputation_available** | El vendedor no es verde, pero cuenta con una reputación que puede ganar y es la mejor oferta disponible. Está ganando temporalmente. Si aparece una mejor oferta, deja de ganar. |
| **temporarily_competing_best_reputation_available** | El vendedor no es verde, pero tiene la mejor reputación disponible, está compitiendo temporalmente. El ganador también es de la misma reputación. Si aparece un mejor vendedor, vuelve a estar únicamente listado. |
| **item_paused** | La publicación está pausada, no puede listarse. |
| **item_not_opted_in** | La publicación no ha hecho opt in, no puede listarse, se utilizó en la llamada un item_id de una publicación que no es de catálogo o es un ítem de test por eso no puede entrar a competir. |
| **shipping_mode** | El vendedor no está compitiendo porque su método de envío es inferior al del ganador. ME2 > ME1 > Custom Shipping > Not Specified. |
| **newbie_program_seller** | El vendedor ha alcanzado el límite de ventas definido por el programa de dosificación de despegue |

## Publicación ganadora

Usando el recurso de **/products/{product_id}** , podrás, además de conocer las características y estado del producto, reconocer mediante el campo **buy_box_winner**  la publicación que está ganando la página de producto.

Ejemplo de respuesta acotada, del detalle de una página de producto:

```
{
    "id": "MLM12345",
    "status": "active",
    "domain_id": "MLM-CELLPHONES",
    "permalink": "https://www.mercadolibre.com.mx/apple-iphone-13-pro-128-gb-grafito,
    "name": "Apple iPhone 13 Pro (128 GB) - Grafito",
    "family_name": "Apple iPhone 13 Pro",
    "buy_box_winner": {
        "item_id": "MLM987654321",
        "category_id": "MLM1055",
        "seller_id": 1234567,
        "price": 25219,
        "currency_id": "MXN",
        "available_quantity": 110,
        "shipping": {
            "mode": "me2",
            "tags": [
                "mandatory_free_shipping"
            ],
            "free_shipping": true,
            "logistic_type": "fulfillment",
            "store_pick_up": false
        },
        "warranty": "Garantía de fábrica: 12 meses",
        "condition": "new",
        "sale_terms": [...],
        "official_store_id": 3953,
        "original_price": 25999,
        "listing_type_id": "gold_pro",
        "accepts_mercadopago": true,
        "seller_address": {...},
        "international_delivery_mode": "none",
        "tags": [...],
        "item_override_attributes": [],
        "seller": {
            "reputation_level_id": "GREEN",
            "tags": []
        },
        "deal_ids": [...],
        "tier": "candidate",
        "inventory_id": "DHEV26968",
        "product_id": "MLM18494248",
        "site_id": "MLM"
    },
    "buy_box_winner_price_range": {
        "min": {
            "price": 25219,
            "currency_id": "MXN"
        },
        "max": {
            "price": 38999,
            "currency_id": "MXN"
        }
    },
    "pickers": [ ... ],
    "pictures": [ ... ],
    "main_features": [ ... ],
    "attributes": [ ... ],
    "short_description": { ... },
    "parent_id": "MLM18494246",
    "children_ids": [],
    "settings": { ... },
    "buy_box_activation_date": "2022-04-22T15:20:15Z",
    "date_created": "2021-09-27T18:13:54Z"
}
```

**Próxima** : [Brand Central](https://developers.mercadolibre.com.ar/es_ar/brand-central).
