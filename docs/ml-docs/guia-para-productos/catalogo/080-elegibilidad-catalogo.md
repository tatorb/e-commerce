<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/elegibilidad-catalogo -->
<!-- Sección: Guía para productos > Catálogo -->

# Elegibilidad de catálogo

Última actualización 29/12/2025

## Elegibilidad de catálogo

Nota:

Este recurso está disponible para Argentina, México, Brasil, Colombia, Chile, Uruguay, Perú y Ecuador.

Antes de publicar en catálogo se deben reconocer cuáles publicaciones son elegibles o pueden publicarse en catálogo reconociendo el tag **catalog_listing_eligible**  desde la API de ítems u optar por los recursos de elegibilidad de una publicación o el de multiget para verificar varias publicaciones.

Nota:

Solo pueden participar en catálogo publicaciones que cumplen con algunos requisitos como condition: new o para el dominio CELLPHONES que el teléfono sea liberado.

## Filtrar por vendedor

Este filtro permitirá distinguir las publicaciones de catálogo de aquellas tradicionales. Debes enviar en los parámetros **catalog_listing**  con el valor true o false. En primer lugar, identificamos todos los ítems de catálogo de un vendedor. Ten en cuenta que debes pasar el parámetro de status correspondiente en caso de que quieras sumar un filtro, como por ejemplo **status=active** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/$USER_ID/items/search?catalog_listing=true
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/123456789/items/search?catalog_listing=true
```

Respuesta acortada de ítems de catálogo:

```
{
  "seller_id": "123456789",
  "query": null,
  "paging": {
    "limit": 50,
    "offset": 0,
    "total": 8
  },
  "results": [
    "MLA123456789",
    "MLA234567890",
    "MLA345678912",
    "MLA456789123",
    "MLA567891234",
    "MLA678912345",
    "MLA789123456",
    "MLA891234567"
  ],
  "orders": [...],
 
  "available_orders": [...]
}
```

Puedes realizar el mismo filtro para identificar todos los ítems de un vendedor que no son de catálogo.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/$USER_ID/items/search?catalog_listing=false
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/123456789/items/search?catalog_listing=false
```

Respuesta acortada de ítems de marketplace:

```
{
  "seller_id": "123456789",
  "query": null,
  "paging": {
    "limit": 50,
    "offset": 0,
    "total": 2902
  },
  "results": [
    "MLA987654321",
    "MLA123789456",
    "MLA456789123",
    "MLA132465798",
    "MLA978645312",
    "MLA312645978",
    "MLA654987321",
    "MLA123789654",
      ],
  "filters": [
  "orders": [...],
  "available_orders": [...]
}
```

## Elegibilidad por vendedor

A través del recurso search y especificando el user_id del vendedor, podrás identificar todos los ítems de un vendedor que sean elegibles para catálogo con el tag **catalog_listing_eligible**  y que aún no están participando en este.

Que un ítem sea elegible significa que puede ser publicado en catálogo.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/$USER_ID/items/search?tags=catalog_listing_eligible
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/123456789/items/search?tags=catalog_listing_eligible
```

La respuesta del search muestra todos los ítems del vendedor con el tag catalog_listing_eligible.

Respuesta acortada:

```
{
   "seller_id":"658869707",
   "query":null,
   "paging":{
      "limit":50,
      "offset":0,
      "total":0
   },
   "results":[
    "MLA123789456",
    "MLA456789123",
    "MLA132465798"
   ],
   "orders":[...
   ],
   "available_orders":[...
                ]
}
```

Ejemplo de ítem elegible:

```
{
  "id": "MLA123789456",
  "site_id": "MLA",
  "title": "Item De Testeo, Por Favor No Ofertar --kc:off",
  "subtitle": null,
  "seller_id": 123456987,
  "category_id": "MLA3530",
  "official_store_id": null,
  "price": 50,
  "base_price": 50,
  "original_price": null,
  "currency_id": "ARS",
  "initial_quantity": 1,
  "available_quantity": 1,
  "sold_quantity": 0,
  "sale_terms": [
  ],
  "buying_mode": "buy_it_now",
  "listing_type_id": "free",
  "start_time": "2020-02-17T16:30:39.000Z",
  "stop_time": "2020-04-17T04:00:00.000Z",
  "condition": "used",
  "permalink": "https://articulo.mercadolibre.com.ar/MLA-839616438-item-de-testeo-por-favor-no-ofertar-kcoff-_JM",
  "thumbnail": "http://mla-s1-p.mlstatic.com/951410-MLA40807113659_022020-I.jpg",
  "secure_thumbnail": "https://mla-s1-p.mlstatic.com/951410-MLA40807113659_022020-I.jpg",
  "pictures": [],
  "video_id": null,
  "descriptions": [
  ],
  "accepts_mercadopago": true,
  "non_mercado_pago_payment_methods": [
  ],
  "shipping": {},
  "international_delivery_mode": "none",
  "seller_address": {},
  "seller_contact": null,
  "location": {
  },
  "geolocation": {},
  "coverage_areas": [
  ],
  "attributes": [],
  "warnings": [
  ],
  "listing_source": "",
  "variations": [
  ],
  "status": "active",
  "sub_status": [
  ],
  "tags": [
    "catalog_listing_eligible",
    "good_quality_picture",
    "test_item",
    "immediate_payment"
  ],
  "warranty": null,
  "catalog_product_id": null,
  "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
  "parent_item_id": null,
  "differential_pricing": null,
  "deal_ids": [
  ],
  "automatic_relist": false,
  "date_created": "2020-02-17T16:30:40.000Z",
  "last_updated": "2020-02-17T16:34:12.000Z",
  "health": 0.4,
  "catalog_listing": false
}
```

## Elegibilidad por item

Valida la elegibilidad de una publicación existente, una vez hayas publicado el ítem, Mercado Libre automáticamente intenta asociar el mejor producto de catálogo con el cual enlazar la publicación, mediante el atributo de **catalog_product_id** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/catalog_listing_eligibility
```

Ejemplo de una publicación con variaciones:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA123456789/catalog_listing_eligibility
```

Respuesta:

```
{
    "id": "MLA123456789",
    "site_id": "MLA",
    "domain_id": "MLA-CELLPHONES",
    "status": null,
    "buy_box_eligible": null,
    "reason": null,
    "status": null,
    "variations": [
        {
            "id": 1312323,
            "status": "READY_FOR_OPTIN",
            "buy_box_eligible": true
        },
        {
            "id": 1312444,
            "status": "READY_FOR_OPTIN",
            "buy_box_eligible": true
        }
    ],
    "site_items": []
}
```

Ejemplo de una publicación sin variaciones:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB1234/catalog_listing_eligibility
```

Respuesta:

```
{
    "id": "MLB1234",
    "site_id": "MLB",
    "domain_id": "MLB-MICROWAVES",
    "buy_box_eligible": true,
    "reason": null,
    "status": "READY_FOR_OPTIN",
    "variations": [],
    "site_items": []
}
```

### Consideraciones

- Si el ítem no posee variaciones, la elegibilidad quedará expresada a través del campo **buy_box_eligible**  de primer nivel en el JSON de la respuesta y la sección variations estará vacía.

- Si el ítem posee variaciones, la elegibilidad de cada una de ellas quedará expresada dentro de la sección variations, la cual contendrá un array por variación con un campo **buy_box_eligible**  para cada una de ellas.

### Descripción de campos

**id** : ID de la publicación que estamos consultando.
 **site_id** : ID del sitio al cual corresponde el ítem.
 **domain_id** : ID del dominio al cual pertenece el ítem.
 **buy_box_eligible** : indica si el ítem/variación está habilitado o no para participar de catálogo.
 **variations** : todas las variaciones que tiene un ítem. Cada una tendrá asociada un status y un valor para el campo **buy_box_eligible** .
 **status** : define la situación del ítem tradicional con respecto a catálogo. Los diferentes estados podrán ser:

- **READY_FOR_OPTIN** : la publicación es elegible y puede ser optineada en catálogo.

- **ALREADY_OPTED_IN** : la publicación ya tiene un ítem de catálogo asociado.

- **CLOSED** : la publicación se encuentra en un estado que impide que se continúe vendiendo.

- **PRODUCT_INACTIVE** : la publicación está asociado a un producto que todavía no ha sido habilitado para catálogo o el ítem aún no tiene **catalog_product_id**  asignado.

- **NOT_ELIGIBLE** : existe una regla de negocio que impide que la publicación aplique a catálogo. (ej.: un producto usado, un celular sin liberar). COMPETING: el ítem de catálogo consultado se encuentra compitiendo.

## Elegibilidad en varios items

Para chequear si múltiples publicaciones son elegibles para catálogo realiza una única llamada. Deberás incorporar en la url el parámetro ids, además de realizar el llamado al recurso multiget, de la siguiente manera:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/multiget/catalog_listing_eligibility?ids=$ITEM_ID,$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/multiget/catalog_listing_eligibility?ids=MLA818878419,MLA820167922
```

Respuesta con multiget:

```
[
   {
       "id": "MLA820167922",
       "site_id": "MLA",
       "domain_id": "MLA-CELLPHONES",
       "buy_box_eligible": null,
       "reason": null,
       "status": null,
       "variations": [
           {
               "id": 44931385066,
               "status": "READY_FOR_OPTIN",
               "buy_box_eligible": true
           {
                   "id": 44931385069,
                   "status": "ALREADY_OPTED_IN",
                   "buy_box_eligible": true
               }
           ],
           "site_items": []
       },
       {
           "id": "MLA818878419",
           "site_id": "MLA",
           "domain_id": "MLA-CELLPHONES",
           "buy_box_eligible": null,
           "reason": null,
           "status": null,
           "variations": [
               {
                   "id": 44612657634,
                   "status": "NOT_ELIGIBLE",
                   "buy_box_eligible": false,
                   "reason": "status_not_active_nor_paused_by_stock_nor_under_review_by_buy_box"
               },
               {
                   "id": 44890704657,
                   "status": "NOT_ELIGIBLE",
                   "buy_box_eligible": false,
                   "reason": "status_not_active_nor_paused_by_stock_nor_under_review_by_buy_box"
               }
           ],
           "site_items": []
       }
   ]
```

**Siguiente** : [Buscador productos](https://developers.mercadolibre.com.ar/es_ar/buscador-de-productos).
