<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo -->
<!-- Sección: Guía para productos > Catálogo -->

# Publicar en catálogo

Última actualización 02/01/2026

## Publicar en catálogo

Hay diferentes formas de publicar en el catálogo:

- Publicar directamente

- Publicar a través de un optin a través de un ítem tradicional.

- Creación automática de ítems (auto-optin).

## Publicar directo

No es necesario tener una publicación de marketplace para publicar en catálogo; pueden realizarse publicaciones directas. Para ello, debes utilizar el **catalog_product_id**  de un producto de catálogo que se encuentre en estado activo o un producto inactivo habilitado que cumple con los estándares de calidad (Product Standards).

Nota:

Actualmente, la posibilidad de publicar con IDs inactivos está limitada al dominio de Autopartes.

Importante:

- El detalle de la ficha técnica del producto de catálogo es provisto por Mercado Libre. Por lo tanto, el vendedor es responsable de confirmar que el producto a crear coincida con las características específicas (ficha técnica) del **catalog_product_id** .
 - En caso de que exista una diferencia entre lo que el usuario compre y el producto asociado es posible, que se generen reclamos y/o cancelaciones que impactarán negativamente en su reputación y como consecuencia de esto la inhabilitación para publicar en catálogo, llevando eventualmente a la suspensión de la cuenta.

Al momento de realizar el POST deberás enviar los siguientes valores para que se cree la publicación de catálogo:

**catalog_product_id** : este valor debe ser confirmado con el recurso de search/product.
 **catalog_listing:** : es necesario enviar el valor en true para generar el ítem de catálogo.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items
```

Ejemplo acortado de una creación directa a catálogo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
    "site_id": "MLA",
    "title": "Item de test no ofertar",
    "category_id": "MLA1055",
    "price": 10000000,
    "currency_id": "ARS",
    "available_quantity": 1,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "pictures": [],
    "attributes": [
        {
            "id": "CARRIER",
            "name": "Compañía telefónica",
            "value_id": "298335",
            "value_name": "Liberado",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condición del ítem",
            "value_id": "2230284",
            "value_name": "Nuevo",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        }
    ],
    "catalog_product_id": "MLA6005934",
    "catalog_listing": true
}'
https://api.mercadolibre.com/items
```

Respuesta:

```
{
    "id": "MLA811894603",
    "site_id": "MLA",
    "title": "Apple iPhone iPhone 3g 8 Gb Negro 128 Mb Ram",
    "subtitle": null,
    "seller_id": 464161506,
    "category_id": "MLA1055",
    "official_store_id": null,
    "price": 10000000,
    "base_price": 10000000,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "ARS",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2019-08-29T14:49:42.945Z",
    "historical_start_time": "2019-08-29T14:49:42.945Z",
    "stop_time": "2039-08-24T04:00:00.000Z",
    "end_time": "2039-08-24T04:00:00.000Z",
    "expiration_time": "2019-11-17T14:49:42.987Z",
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-811894603-apple-iphone-iphone-3g-8-gb-negro-128-mb-ram-_JM",
    "pictures": [
        {
            "id": "675782-MLA31138875214_062019",
            "url": "http://mla-s1-p.mlstatic.com/675782-MLA31138875214_062019-O.jpg",
            "secure_url": "https://mla-s1-p.mlstatic.com/675782-MLA31138875214_062019-O.jpg",
            "size": "249x500",
            "max_size": "598x1200",
            "quality": ""
        },
        {
            "id": "915001-MLA31138546867_062019",
            "url": "http://mla-s2-p.mlstatic.com/915001-MLA31138546867_062019-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/915001-MLA31138546867_062019-O.jpg",
            "size": "250x500",
            "max_size": "600x1200",
            "quality": ""
        },
        {
            "id": "881441-MLA31138332972_062019",
            "url": "http://mla-s2-p.mlstatic.com/881441-MLA31138332972_062019-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/881441-MLA31138332972_062019-O.jpg",
            "size": "243x500",
            "max_size": "585x1200",
            "quality": ""
        },
        {
            "id": "804666-MLA31139286536_062019",
            "url": "http://mla-s1-p.mlstatic.com/804666-MLA31139286536_062019-O.jpg",
            "secure_url": "https://mla-s1-p.mlstatic.com/804666-MLA31139286536_062019-O.jpg",
            "size": "405x500",
            "max_size": "836x1030",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [
        {
            "id": "MLA811894603-2265773390"
        }
    ],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 1061221617,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "1414",
        "city": {
            "id": "",
            "name": "Palermo"
        },
        "state": {
            "id": "AR-C",
            "name": "Capital Federal"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": 38.11569,
        "longitude": 13.3614868,
        "search_location": {
            "neighborhood": {
                "id": "TUxBQlBBTDI1MTVa",
                "name": "Palermo"
            },
            "city": {
                "id": "TUxBQ0NBUGZlZG1sYQ",
                "name": "Capital Federal"
            },
            "state": {
                "id": "TUxBUENBUGw3M2E1",
                "name": "Capital Federal"
            }
        }
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": 38.11569,
        "longitude": 13.3614868
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "CARRIER",
            "name": "Compañía telefónica",
            "value_id": "298335",
            "value_name": "Liberado",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condición del ítem",
            "value_id": "2230284",
            "value_name": "Nuevo",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "9344",
            "value_name": "Apple",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "LINE",
            "name": "Línea",
            "value_id": "58993",
            "value_name": "iPhone",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "14605",
            "value_name": "iPhone 3G",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "IS_DUAL_SIM",
            "name": "Es Dual SIM",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "COLOR",
            "name": "Color",
            "value_id": "52049",
            "value_name": "Negro",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "INTERNAL_MEMORY",
            "name": "Memoria interna",
            "value_id": "59566",
            "value_name": "8 GB",
            "value_struct": {
                "number": 8,
                "unit": "GB"
            },
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "RAM",
            "name": "Memoria RAM",
            "value_id": "366239",
            "value_name": "128 MB",
            "value_struct": {
                "number": 128,
                "unit": "MB"
            },
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "MAIN_COLOR",
            "name": "Color principal",
            "value_id": "2450295",
            "value_name": "Negro",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "OPERATING_SYSTEM_NAME",
            "name": "Nombre del sistema operativo",
            "value_id": "7404961",
            "value_name": "iOS",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "WITH_IMEI",
            "name": "Con IMEI",
            "value_id": "242085",
            "value_name": "Sí",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "thumbnail": "http://mla-s1-p.mlstatic.com/675782-MLA31138875214_062019-I.jpg",
    "secure_thumbnail": "https://mla-s1-p.mlstatic.com/675782-MLA31138875214_062019-I.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "immediate_payment",
        "test_item"
    ],
    "warranty": null,
    "catalog_product_id": "MLA6005934",
    "domain_id": "MLA-CELLPHONES",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2019-08-29T14:49:43.099Z",
    "last_updated": "2019-08-29T14:49:43.099Z",
    "total_listing_fee": null,
    "health": null,
    "catalog_listing": true,
    "item_relations": []
}
```

## Optin desde un item tradicional

Una vez valides que tu publicación existente es elegible para catálogo, obtengas el **catalog_product_id**  activo, desde el recurso product search, y compruebes que la ficha técnica corresponde exactamente a lo que estás publicando, debes crear la publicación de catálogo (hacer el optin) con un POST a /items/catalog_listings..

## Variaciones en catálogo

En los productos de catálogo, no se admite la creación de variaciones porque ya están asociadas a un valor específico, ejemplo: Apple iPad Air De 10.9 Wi-fi 256gb Oro Rosa (4ª Generación) donde el color oro rosa sería una variación de una publicación de marketplace.

Por tanto, si tu publicación original tenía variaciones, tendrás una publicación de catálogo por cada una de ellas. La información relevante de tus variaciones, como el color del artículo, no se perderá sino que estará reflejada en los atributos del producto de catálogo.
 Si tu publicación de marketplace contiene variaciones, deberás hacer un POST por cada una de las mismas enviando el campo **variation_id**  en el cuerpo del POST.

Ejemplo sobre una publicación de marketplace con variaciones:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/catalog_listings
{
   "item_id": "MLM1477978125",
   "variation_id": 174997747229,
   "catalog_product_id": "MLM15996654"

}
```

Ejemplo sobre una publicación de marketplace sin variaciones:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/catalog_listings
{
   "item_id": "MLM1477978125",
   "catalog_product_id": "MLM15996654"

}
```

Ejemplo acortado de respuesta a la creación de un producto de catálogo:

```
{
    "id": "MLM1477990462",
    "site_id": "MLM",
    "title": "Huawei Y6p Dual Sim 64 Gb Emerald Green 3 Gb Ram",
    "subtitle": null,
    "seller_id": 1008002397,
    "category_id": "MLM1055",
    "official_store_id": null,
    "price": 9999,
    "base_price": 9999,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "MXN",
    "initial_quantity": 2,
    "available_quantity": 2,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantía",
            "value_id": "2230280",
            "value_name": "Garantía del vendedor",
            "value_struct": null,
            "values": [
                {
                    "id": "2230280",
                    "name": "Garantía del vendedor",
                    "struct": null
                }
            ]
        },
        {
            "id": "WARRANTY_TIME",
            "name": "Tiempo de garantía",
            "value_id": null,
            "value_name": "3 meses",
            "value_struct": {
                "number": 3,
                "unit": "meses"
            },
            "values": [
                {
                    "id": null,
                    "name": "3 meses",
                    "struct": {
                        "number": 3,
                        "unit": "meses"
                    }
                }
            ]
        }
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2022-08-10T16:28:40.141Z",
    "stop_time": "2042-08-05T04:00:00.000Z",
    "end_time": "2042-08-05T04:00:00.000Z",
    "expiration_time": "2022-10-29T16:28:40.255Z",
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.mx/MLM-1477990462-huawei-y6p-dual-sim-64-gb-emerald-green-3-gb-ram-_JM",
    "pictures": [
        ...
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "me2",
        "local_pick_up": false,
        "free_shipping": true,
        "methods": [],
        "dimensions": null,
        "tags": [
            "mandatory_free_shipping"
        ],
        "logistic_type": "drop_off",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        ...
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": 20.7846638,
        "longitude": -103.4679048
    },
    "coverage_areas": [],
    "attributes": [ ... ],
    "warnings": [
      ...
    ],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "753526-MLA49391002480_032022",
    "thumbnail": "http://mlm-s1-p.mlstatic.com/753526-MLA49391002480_032022-I.jpg",
    "secure_thumbnail": "https://mlm-s1-p.mlstatic.com/753526-MLA49391002480_032022-I.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "cart_eligible",
        "immediate_payment",
        "test_item"
    ],
    "warranty": "Garantía del vendedor: 3 meses",
    "catalog_product_id": "MLM15996654",
    "domain_id": "MLM-CELLPHONES",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2022-08-10T16:28:40.371Z",
    "last_updated": "2022-08-10T16:28:40.419Z",
    "health": null,
    "catalog_listing": true,
    "item_relations": [
        {
            "id": "MLM1477978125",
            "variation_id": 174997747229,
            "stock_relation": 1
        }
    ],
    "channels": [
        "marketplace"
    ]
}
```

Consideraciones

- Dentro de la información del producto/publicación de marketplace podrás encontrar el array **item_relations**  el cual tendrá la información de la relación creada entre el **item_id**  de la publicación, con su variación respectiva y el **item_id**  del producto de catálogo creado a partir de ella.

- Si el request de creación de un producto de catálogo es enviado sin variaciones, pero la publicación de marketplace cuando sí las tiene, la respuesta será error:

```
{
   "message": "Validation error",
   "error": "validation_error",
   "status": 400,
   "cause": [
       {
           "department": "items",
           "cause_id": 216,
           "type": "error",
           "code": "item.variations.invalid",
           "references": [
               "variation_id"
           ],
           "message": "Item MLM1477978125 doesn't have a variation with id null"
       }
   ]
}
```

- El campo **catalog_product_id**  es obligatorio en el POST para publicaciones de marketplace con o sin variaciones.

- `{ "message": "Validation error", "error": "validation_error", "status": 400, "cause": [ { "department": "items", "cause_id": 369, "type": "error", "code": "body.required_fields", "references": [ "body.invalid" ], "message": "The payload is missing the following properties: [catalog_product_id]" } ] }`

- Si la publicación de marketplace no esta productizada, es decir, no tiene el campo correspondiente de **catalog_product_id** , la respuesta será error: `{ "message": "Validation error", "error": "validation_error", "status": 400, "cause": [ { "department": "items", "cause_id": 389, "type": "error", "code": "item.catalog_listing.not_eligible", "references": [ "item.catalog_listing" ], "message": "Item cannot be catalog listing" } ] }` Sincroniza condiciones de venta La sincronización de las condiciones de venta como: precio, forma de entrega, stock, garantía, SKU, GTIN (PIs), atributos legales, campañas (ahora-5, etc) y listing_type de las publicaciones de marketplace asociadas a un producto de catálogo será automática y con las siguientes condiciones:   **El vendedor no podrá eliminar la sincronización**  (opt-out). **Las publicaciones nuevas**  estarán sincronizadas desde el inicio. **Las publicaciones existentes**  asociadas a un producto de catálogo, se sincronizan cuando el vendedor modifica alguna de las condiciones de venta de la publicación original. **La sincronización será a partir de que se realice el primer cambio** , es decir, que si el vendedor modifica primero la publicación de catálogo, actualizaremos automáticamente la publicación de marketplace, y viceversa.      Notas:   Los cambios, tanto de las publicaciones de marketplace como las publicaciones de catálogo, serán notificados a través del feed de ítems.      Corrección de la sincronización de ítems Hay casos en que, los ítems tradicionales pueden perder la sincronización con su ítem en el catálogo, aunque continúen teniendo el campo "item_relation" conectado. Para ayudarte a resolver estos posibles errores, ponemos a tu disposición dos recursos:   Consulta de sincronización de ítems Puedes verificar si tus ítems están sincronizados con su ítem de catálogo utilizando la siguiente consulta:  `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/public/buybox/sync/$ITEM_ID` Las respuestas posibles son las siguientes:  Sincronizado `HEADER x-public:True { "item_id": "MLA1318233236", "status": "SYNC", "timestamp": null, "relations": [ "MLA1281648753" ] }` No está sincronizado `HEADER x-public:True { "item_id": "MLA1361070453", "status": "UNSYNC", "timestamp": 1678116777461, "relations": [ "MLA1361334302" ] }` Sincronización de ítems Si encuentras que un ítem activo no está sincronizado y desees corregirlo, puedes hacerlo mediante la siguiente llamada, enviando solo el "ítem_id" que deseas sincronizar en el cuerpo de la solicitud: `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/public/buybox/sync` Body: `HEADER: x-public:True { "id": "MLA1361070453" }` El servidor responderá con un código de estado 200 en caso de éxito o 422/500 en caso de error.   Creación automática de ítems (Auto Optin) Mercado Libre evaluará las publicaciones de marketplace, en caso de que cumpla con todos los requisitos para realizar un optin efectivo, este se hará automáticamente. Ten en cuenta que **la publicación original será actualizada con los attributes, variations.attributes o variations.attribute_combinations**  del producto de catálogo al cual fue asociado para que ambas publicaciones relacionadas sean consistentes.   A continuación, puedes ver un **producto de catálogo**  con optin automático. Reconoce las publicaciones que fueron optineadas automáticamente con el tag **catalog_boost** . Este tag únicamente lo podrás encontrar en la publicación de catálogo que fue creada por Mercado Libre.   Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM1881484643` Respuesta acortada: `{ "id": "MLM1881484643", "site_id": "MLM", "title": "Multifuncional Hp Smart Tank 670 Tinta Continua Color Wi-fi Blanco/gris", "category_id": "MLM1676", "price": 599999, "base_price": 599999, "original_price": null, "currency_id": "MXN", "initial_quantity": 1, "available_quantity": 1, "sold_quantity": 0, "tags": [ "catalog_boost", "good_quality_thumbnail", "test_item", "immediate_payment", "cart_eligible" ], "warranty": "Sin garantía", "catalog_product_id": "MLM19441504", "domain_id": "MLM-PRINTERS", "parent_item_id": null, "differential_pricing": null, "deal_ids": [], "automatic_relist": false, "date_created": "2023-04-20T19:49:35.106Z", "last_updated": "2023-04-20T19:58:31.478Z", "health": null, "catalog_listing": true, "channels": [ "marketplace" ] }` Podrás realizar una búsqueda por vendedor para identificar las publicaciones que estén marcadas con el tag **catalog_boost**  utilizando el siguiente recurso: Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$SELLER_ID/items/search?status=active&tags=catalog_boost` Te recomendamos utilizar este recurso, con el objetivo de informar a los sellers cuales de sus publicaciones fueron optineadas automáticamente por Mercado Libre.   Mensajes de error Al momento de realizar publicaciones en catálogo, puedes obtener como respuesta mensajes de error, los cuales detallamos a continuación, con su respectiva solución:     Code_id Reason code_name code_message Solución     4400 **catalog_product_id**  o GTIN obligatorios (detectamos producto en base a PKs). **body.required_fileds**  Missing **catalog_product_id**  or GTIN. It’s required at least one of them. Enviar **catalog_product_id**  o GTIN   4402 No encontramos producto activo en base a **catalog_product_id**  **item.catalog_product_id**   The product **$product_id**  is not active Enviar un **catalog_product_id**  activo o GTIN correcto   417 **catalog_product_id**  no se corresponde al **category_id**  **item.catalog_product_id**   The product **$product_id**  does not belong to the **catalog_domain**  of the category **$category_id** . Enviar un **catalog_product_id**  correcto   418 El catalog_product_id es incorrecto ya que no concuerda con la información del parent_id o children_id relacionado. **item.catalog_product_id**   Variation **catalog_product_id**  **$variation_product_id**  is not a child of item **catalog_product_id $item_product_id** . Enviar un catalog_product_id a nivel ítem y variación que corresponda al parent_id relacionado.   4310 Detectamos que en ocasiones anteriores el vendedor intentó publicar infringiendo nuestras políticas de propiedad intelectual, por eso no puede ofrecerlo de nuevo. **seller.optin.fake**  Seller Optin is forbidden for seller [Seller_id] and parent product [product_id] El vendedor no puede ofrecer este producto de nuevo.      Publicaciones eliminadas automáticamente - OPTOUT Mercado Libre podrá modificar automáticamente el valor del atributo **“status”**  o el **"catalog_listing"**  de los ítems que actualmente están publicados en el catálogo, en casos en los que sea necesario eliminar un producto de la base actual, ya sea por inconsistencias en su especificación, por ser fraudulento o directamente es un ítem denunciado y presenta restricciones legales sobre sus ventas. Para no eliminar el historial de ventas y no afectar la reputación de los ítems, se seguirán dos flujos:   **Situación 1**    En los casos en los que el vendedor tenga ambos tipos de publicaciones para el mismo producto (tradicional y de catálogo), **el ítem de catálogo pasará a tener el status "closed", mientras que el ítem tradicional seguirá activo** . **Situación 2:**    Cuando el vendedor únicamente tiene el ítem en el catálogo, **dicho ítem, que tiene el campo "catalog_listing" establecido en "true", cambiará a "catalog_listing" establecido en "false"** . De esta manera, el vendedor podrá seguir vendiéndolo como un ítem tradicional.    En ambas situaciones, podrás [verificar los cambios en nuestro recurso de /items](https://developers.mercadolibre.com.ar/es_ar/publica-productos#:~:text=no%20longer%20supporte.-,Consultar%20productos,-Nota%3A) y recibirás notificaciones al respecto.      Eliminar publicaciones Se puede [pausar/eliminar las publicaciones](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Elimina-publicaciones) de catálogo, realizando un PUT a la al api de /items/$ITEM_ID donde el ITEM_ID que se referencia es el id de la publicación de catálogo.   Al **pausar/eliminar**  la publicación de marketplace que se encuentra optineada, no estás pausando/eliminando la publicación de catálogo, por el contrario, la publicación de catálogo permanecerá activa e independiente y podrás continuar gestionándola, hasta que mediante el API de ítems se cambie de status ha pausado o cerrado.    **Siguiente** : [Publicaciones requeridas](https://developers.mercadolibre.com.ar/es_ar/publicaciones-requeridas-en-catalogo).
