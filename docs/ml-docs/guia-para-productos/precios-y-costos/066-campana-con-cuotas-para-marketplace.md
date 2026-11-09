<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/campana-con-cuotas-para-marketplace -->
<!-- Sección: Guía para productos > Precios y Costos -->

# Campañas con cuotas para Marketplace

Última actualización 11/02/2026

## Campañas con cuotas para Marketplace

Importante:

Las campañas con cuotas están disponibles en MLA y algunas solo podrán participar productos de categorías específicas.
 Recuerda que a partir de ahora, tus publicaciones se diferencian por las cuotas que agregues. Para que puedas identificar de una manera más clara qué ofrecen tus publicaciones, dejamos de llamarlas Clásica o Premium. [Ver más](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos).

 El programa Cuota Simple fue discontinuado.

## Publicaciones en las que elegís no agregar cuotas

Las **publicaciones gold_special**  solo tienen las cuotas con interés que ofrecen los bancos. Por eso pagás solo el cargo por vender y, si aplica, también el costo fijo.

**Cuotas con interés bajo** : con esta opción pagás un 4% por ofrecer a tus compradores de 3 a 12 cuotas con un interés menor que el de los bancos. Así podrás ofrecer precios más competitivos. Para hacerlo, modifica tus publicaciones y actívalas con el tag **pcj-co-funded** . [Ver términos y condicionens](https://www.mercadolibre.com.ar/ayuda/870).

## Publicaciones en las que elegís agregar cuotas

En las **publicaciones gold_pro**  podrás ofrecer cuotas más convenientes a los compradores, pero deberás pagar el cargo por vender más un costo por ofrecer cuotas, y el costo fijo si aplica.

- **3 cuotas al mismo precio que publiques** : tendrás un porcentaje de descuento en el cargo por venta, y así podrás ofrecer precios más competitivos. Para hacerlo, modifica tus publicaciones y actívalas con el tag **3x_campaign** . Este descuento está disponible en [categorías seleccionadas](https://www.mercadolibre.com.ar/ayuda/21456).

- **6 cuotas al mismo precio que publiques** : tendrás un porcentaje de descuento en el cargo por venta. Estás publicaciones (6x), no tienen un tag asociado en /ítems. Al dar de alta una publicación en **gold_pro** , ofrecerás por defecto las 6 cuotas al mismo precio que publiques. Este descuento está disponible en a todas las categorías. Ver [costos por agregar cuotas](https://www.mercadolibre.com.ar/ayuda/870#:~:text=%C2%BFCu%C3%A1l%20es%20el%20costo%20por%20ofrecer%20financiaci%C3%B3n%3F).

## Comparación opciones de cuotas

Nota:

Es necesario tener en cuenta, que podemos activar nuevos tipos de campaña de cuotas que no están en el listado, y con esto, será necesario seguir el proceso de validación y activación en los items.

### Publicaciones en las que eliges no agregar cuotas

| Nombre de campaña | Listing type | Tag Marketplace |
| --- | --- | --- |
| No quiero agregar cuotas | gold_special | sin tag |
| 3 a 12 cuotas con interés bajo | gold_special | pcj-co-funded |

### Publicaciones en las que eliges agregar cuotas

| Nombre de campaña | Listing type | Tag Marketplace |
| --- | --- | --- |
| 3 cuotas al mismo precio que publicaste | gold_pro | 3x_campaign |
| 6 cuotas al mismo precio que publicaste | gold_pro | sin tag |
| 9 cuotas al mismo precio que publicaste | gold_pro | 9x_campaign |
| 12 cuotas al mismo precio que publicaste **(Activación en 18/06/24)** | gold_pro | 12x_campaign |

## Validar campañas por seller y categoría

Con el fin de obtener todas las campañas habilitadas para un seller específico, es necesario realizar una consulta al recurso /special_installments/campaigns

**Parámetros:**

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| category_id | Obligatorio | identificador de la categoría |
| brand | Opcional | Marca |
| model | Opcional | Modelo |
| listing_type_id | Opcional | identificador del tipo de publicación (gold_special o gold_pro) |
| channel | Opcional | "marketplace" |

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 

https://api.mercadolibre.com/special_installments/campaigns?category_id=$CATEGORY_ID&brand=$ID&model=$ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 

https://api.mercadolibre.com/special_installments/campaigns?category_id=MLA1611&brand=276243
```

**Respuesta:**

```
[
    {
        "channel": "marketplace",
        "available_campaigns": [
            {
                "listing_type_id": "gold_special",
                "available_campaigns": [
                    {
                        "campaign_id": "no-campaign",
                        "description_campaign": "No agregar cuotas"
                    },
                    {
                        "campaign_id": "pcj-co-funded",
                        "description_campaign": "3 a 12 cuotas con interés baixo"
                    }
                ]
            },
            {
                "listing_type_id": "gold_pro",
                "available_campaigns": [
                    {
                        "campaign_id": "3x_campaign",
                        "description_campaign": "3 cuotas al mismo precio que publiques"
                    },
                    {
                        "campaign_id": "no-campaign",
                        "description_campaign": "6 cuotas al mismo precio que publiques"
                    },
                    {
                        "campaign_id": "9x_campaign",
                        "description_campaign": "9 cuotas al mismo precio que publiques"
                    }
                ]
            }
        ]
    }
]
```

## Campos de la respuesta

La respuesta de un GET al recurso /special_installments/campaigns proporcionará los siguientes parámetros:

- **channel** : Canal disponible para la combinación de atributos consultada (marketplace)

- **available_campaigns** : Array de campañas disponibles para el canal  **listing_type_id** : Tipo de publicación  [gold_special](https://developers.mercadolibre.com.ar/AGREGAR_LINK) gold_pro   **available_campaigns** : Array de campañas disponibles para el listing_type_id  **campaign_id** : tag de la campaña habilitada para el channel & listing_type_id  **Ejm para gold_special** :  sin tag (no quiero ofrecer cuotas) ahora-paid-by-buyer (no quiero ofrecer cuotas) pcj-co-funded   **Ejm para gold_pro** :  3x_campaign 6x (no existe tag)  9x_campaign   12x_campaign

- **description_campaign** : Descripción del campaign_id

## Conocer si el usuario está habilitado para sumarse a la campaña

Importante:

Todos los sellers de MLA tienen habilitadas las campañas del tipo 3x, 9x y 12x_campaign, por lo que no es necesario validar con el recurso "special_installments". En caso de hacerlo, recibirán un error 404.

Para conocer qué usuario tiene la posibilidad de sumarse a las campañas existentes, deberás realizar un GET al recurso /special_installments según corresponda, con el $SELLER_ID.

**Parámetros opcionales:**

- **pcj-co-funded** : campaña 3 a 12 cuotas con un interés bajo.

En caso que el usuario pueda participar, se mostrará la fecha en la que fue habilitado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/special_installments/$CAMPAIGN_TAG_ID/sellers/$SELLER_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/special_installments/3x_campaign/sellers/1234
```

Respuesta:

```
{
   "date_created": "2019-08-30T16:09:10.941-04:00",
   "seller_id": 1234
}
```

Si el usuario NO tiene permitido o estas consultando una campaña de 3x o 9x que estan activas para todos los sellers MLA, la respuesta será:

```
{
   "message": "seller does not exist",
   "error": "seller.not_found",
   "status": 404,
   "cause": []
}
```

## Conocer qué categorías pueden sumarse a la campaña

Debes realizar un POST al recurso /special_installments según la campaña que corresponda, con el $CATEGORY_ID (ejem: **pcj-co-funded, 3x_campaign** )

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/special_installments/$CAMPAIGN_TAG_ID/categories/$CATEGORY_ID/enabled
```

**Response Body** : devolverá como respuesta el campo “enabled” con valor true o false, según corresponda.
 **Response Status** : 200
 **Cacheable** : Sí. Se devolverá el header “Cache-Control” con value “max-age=$max-age” indicando el tiempo recomendado en segundos para cachear la información que responde el recurso.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/special_installments/3x_campaign/categories/MLA1055/enabled
```

Respuesta:

```
{
   "enabled": true
}
```

## Conocer si una publicación está en la campaña

Importante:

- La cantidad de cuotas con interés bajo **(pcj-co-funded)**  es seleccionada por tus compradores al momento de realizar la compra. 
 - Vía API, solo podrás validar que dichas cuotas están habilitadas en la publicación. No podrás ver la cantidad de cuotas elegidas por el comprador. De igual manera, la comisión es la misma ya sean 3, 6, 9 o 12 cuotas [(Términos y condiciones)](https://www.mercadolibre.com.ar/ayuda/870).

Para consultar si una **publicación en las que elegís no agregar cuotas**  (gold_special) tiene habilitada alguna campaña, realiza un GET al **recurso /items**  con su item_id y verifica que tenga el tag **pcj-co-funded**  dentro de los campos.

Para consultar si una **publicación en las que elegís agregar cuotas**  (gold_pro) tiene habilitada alguna campaña, realiza un GET al **recurso /items**  con su item_id y verifica que tenga el tag **3x_campaign**  dentro de los campos. Recuerda que las publicaciones gold_pro con “6 cuotas al mismo precio que publiques” (6x), no tienen un tag asociado en /ítems.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA608007087
```

Respuesta:

```
{
   "id": "MLA810693730",
   "site_id": "MLA",
   "title": "Item De Test - No Ofertar",
   "subtitle": null,
   "seller_id": 443024908,
   "category_id": "MLA3530",
   "official_store_id": null,
   "price": 100,
   "base_price": 100,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 1,
   "available_quantity": 1,
   "sold_quantity": 0,
   "sale_terms": [],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2019-08-22T17:33:51.000Z",
   "stop_time": "2039-08-17T04:00:00.000Z",
   "end_time": "2039-08-17T04:00:00.000Z",
   "expiration_time": "2019-11-10T17:33:51.000Z",
   "condition": "new",
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "international_delivery_mode": "none",
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -34.5780655,
       "longitude": -58.4265317
   },
   "coverage_areas": [],
   "warnings": [],
   "listing_source": "",
   "variations": [],
   "status": "active",
   "sub_status": [],
   "tags": [
       "3x_campaign",
       "immediate_payment",
       "test_item"
   ],
   "warranty": null,
   "catalog_product_id": null,
   "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2019-08-22T17:33:51.000Z",
   "last_updated": "2019-08-22T18:37:41.468Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": []
}
```

## Ver cargos por venta filtrando campañas

Para consultar los costos por vender debes realizar un GET al recurso /listing_prices filtrando por precio, listing_type, tag y dominio, según corresponda.

Recuerda:

1. Respetar la relación listing_type+tag [(ver opciones)](https://developers.mercadolibre.com.ar/es_ar/campanas-con-cuotas-para-marketplace?nocache=true#Comparaci%C3%B3n-opciones-de-cuotas).

2. Filtrar por channel para ver las comisiones específicas. En caso contrario, verás por defecto las de marketplace.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&listing_type_id=$LISTING_TYPE_ID&tags=$CAMPAIGN_TAG_ID&domain_id=$DOMAIN_ID
```

Ejemplo del dominio Notebooks:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=10000&listing_type_id=gold_pro&tags=3x_campaign&domain_id=MLA-NOTEBOOKS
```

Respuesta:

```
[
    {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "highest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "gold_pro",
        "listing_type_name": "Premium",
        "requires_picture": true,
        "sale_fee_amount": 2700,
        "sale_fee_details": {
            "financing_add_on_fee": 15,
            "fixed_fee": 0,
            "gross_amount": 2700,
            "meli_percentage_fee": 12,
            "percentage_fee": 27
        },
        "stop_time": "2043-09-09T00:00:00.000-04:00"
    }
]
}
]
```

Es decir, el dominio Notebooks con el tag **3x_campaign** , el cargo por venta en Marketplace será de 12% y el cargo por ofrecer cuotas será de 15%, total cargos de 27%. Para más información, puedes consultar recursos para [obtener los costos por vender](https://developers.mercadolibre.com.ar/es_ar/comision-por-vender) y el significado de cada campo en la respuesta.

Ejemplo del dominio Cellphones:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=10000&listing_type_id=gold_special&tags=pcj-co-funded&domain_id=MLA-CELLPHONES
```

Respuesta:

```
[
    {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "highest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "gold_special",
        "listing_type_name": "Clásica",
        "requires_picture": true,
        "sale_fee_amount": 1600,
        "sale_fee_details": {
            "financing_add_on_fee": 4,
            "fixed_fee": 0,
            "gross_amount": 1600,
            "meli_percentage_fee": 12,
            "percentage_fee": 16
        },
        "stop_time": "2043-09-09T00:00:00.000-04:00"
    }
]
```

Es decir, el dominio Cellphones con el tag **pcj-co-funded** , el cargo por venta en Marketplace será de 12% y el cargo por ofrecer cuotas será de 4%, total cargos de 16%. Para más información puedes consultar recursos para [obtener los costos por vender](https://developers.mercadolibre.com.ar/es_ar/comision-por-vender).

## Crear una publicación en una campaña

Nota:

Es permitido tener solo 1 tipo de cuotas activo por publicación y por canal (Marketplace).

Debes realizar el POST al **recurso /items**  incluyendo el tag correspondiente (ver opciones). Ten en cuenta de siempre enviar el atributo **buying_mode**  ya que es requerido en el POST para productos nuevos.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items
{
    "title": "Item de testeo por favor no ofertar kc:off",
    "pictures": [
        ..
    ],
    "price": 53936,
    "variations": [],
    "shipping": {
        ..
    },
    "currency_id": "ARS",
    "location": {},
    "attributes": [
        ...
    ],
    "listing_type_id": "gold_pro",
    "available_quantity": 543,
    "category_id": "MLA1611",
    "condition": "new",
    "buying_mode": "buy_it_now",
    "tags": [
        "3x_campaign"       
    ]
     ...
}
```

Respuesta:

```
{
   "id": "MLA810693730",
   "site_id": "MLA",
   "title": "Item De Test - No Ofertar",
   "subtitle": null,
   "seller_id": 443024908,
   "category_id": "MLA3530",
   "official_store_id": null,
   "price": 100,
   "base_price": 100,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 1,
   "available_quantity": 1,
   "sold_quantity": 0,
   "sale_terms": [],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2019-08-22T17:33:51.000Z",
   "stop_time": "2039-08-17T04:00:00.000Z",
   "end_time": "2039-08-17T04:00:00.000Z",
   "expiration_time": "2019-11-10T17:33:51.000Z",
   "condition": "new",
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "international_delivery_mode": "none",
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -34.5780655,
       "longitude": -58.4265317
   },
   "coverage_areas": [],
   "warnings": [],
   "listing_source": "",
   "variations": [],
   "status": "active",
   "sub_status": [],
   "tags": [
       "3x_campaign",
       "immediate_payment",
       "test_item"
   ],
   "warranty": null,
   "catalog_product_id": null,
   "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2019-08-22T17:33:51.000Z",
   "last_updated": "2019-08-22T18:37:41.468Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": []
}
```

Recuerda que retornaremos un http error 400 siempre que no cumplas los requisitos o en los siguientes casos:

- Categoría no habilitada para ofrecer cuotas.

- Producto usado o reacondicionado.

- Listing_type de la publicación no corresponde con el tag campaña enviado [(ver opciones)](https://developers.mercadolibre.com.ar/es_ar/publicaciones-con-3-cuotas?nocache=true#Comparaci%C3%B3n-opciones-de-cuotas).

## Habilitar la campaña en una publicación

Debes realizar un PUT al **recurso /items**  incluyendo el tag correspondiente [(ver opciones)](https://developers.mercadolibre.com.ar/es_ar/publicaciones-con-3-cuotas?nocache=true#Comparaci%C3%B3n-opciones-de-cuotas). Ten en cuenta que si el item_id contiene otros tags, también deberán ser enviados en la modificación.

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "tags": [
       "3x_campaign",
       "immediate_payment",
       "test_item"
   ]
}
https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "tags": [
       "3x_campaign",
       "immediate_payment",
       "test_item"
   ]
}
https://api.mercadolibre.com/items/MLA810693730
```

Respuesta:

```
{
   "id": "MLA810693730",
   "site_id": "MLA",
   "title": "Item De Test - No Ofertar",
   "subtitle": null,
   "seller_id": 443024908,
   "category_id": "MLA3530",
   "official_store_id": null,
   "price": 100,
   "base_price": 100,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 1,
   "available_quantity": 1,
   "sold_quantity": 0,
   "sale_terms": [],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2019-08-22T17:33:51.000Z",
   "stop_time": "2039-08-17T04:00:00.000Z",
   "end_time": "2039-08-17T04:00:00.000Z",
   "expiration_time": "2019-11-10T17:33:51.000Z",
   "condition": "new",
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "international_delivery_mode": "none",
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -34.5780655,
       "longitude": -58.4265317
   },
   "coverage_areas": [],
   "warnings": [],
   "listing_source": "",
   "variations": [],
   "status": "active",
   "sub_status": [],
   "tags": [
       "3x_campaign", 
       "immediate_payment",
       "test_item"
   ],
   "warranty": null,
   "catalog_product_id": null,
   "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2019-08-22T17:33:51.000Z",
   "last_updated": "2019-08-22T18:37:41.468Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": []
}
```

Recuerda que retornaremos un http error 400 siempre que no cumplas los requisitos o en los siguientes casos:

- Categoría no habilitada para ofrecer cuotas.

- Producto usado o reacondicionado.

- Listing_type de la publicación no corresponde con el tag campaña enviado [(ver opciones)](https://developers.mercadolibre.com.ar/es_ar/publicaciones-con-3-cuotas?nocache=true#Comparaci%C3%B3n-opciones-de-cuotas).

## Deshabilitar la campaña en una publicación

Para deshabilitar la campaña en un item_id debes realizar un PUT al **recurso /items**  incluyendo todos los tags que tenía anteriormente excepto el tag que deseas eliminar ( **pcj-co-funded o 3x_campaign**).****

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "tags": [
       "immediate_payment",
       "test_item"
   ],
}
https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "tags": [
       "immediate_payment",
       "test_item"
   ],
}
https://api.mercadolibre.com/items/MLA810693730
```

Respuesta:

```
{
   "id": "MLA810693730",
   "site_id": "MLA",
   "title": "Item De Test - No Ofertar",
   "subtitle": null,
   "seller_id": 443024908,
   "category_id": "MLA3530",
   "official_store_id": null,
   "price": 100,
   "base_price": 100,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 1,
   "available_quantity": 1,
   "sold_quantity": 0,
   "sale_terms": [],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2019-08-22T17:33:51.000Z",
   "stop_time": "2039-08-17T04:00:00.000Z",
   "end_time": "2039-08-17T04:00:00.000Z",
   "expiration_time": "2019-11-10T17:33:51.000Z",
   "condition": "new",
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "international_delivery_mode": "none",
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -34.5780655,
       "longitude": -58.4265317
   },
   "coverage_areas": [],
   "warnings": [],
   "listing_source": "",
   "variations": [],
   "status": "active",
   "sub_status": [],
   "tags": [
       "immediate_payment",
       "test_item"
   ],
   "warranty": null,
   "catalog_product_id": null,
   "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2019-08-22T17:33:51.000Z",
   "last_updated": "2019-08-22T18:37:41.468Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": []
}
```
