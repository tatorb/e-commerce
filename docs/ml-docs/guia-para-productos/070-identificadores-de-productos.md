<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/identificadores-de-productos -->
<!-- Sección: Guía para productos -->

# Identificadores de productos

Última actualización 30/12/2025

## Identificadores de productos

Los identificadores son códigos únicos (PI o product identifier) que tienen como objetivo localizar una publicación y definir el artículo que estás vendiendo a nivel global. Los fabricantes asignan identificadores únicos a cada artículo, por esta razón dos artículos idénticos comparten el mismo PI. Conoce más cómo [identificar el código universal de producto](https://www.mercadolibre.com.ar/ayuda/Codigo_univer_sal_de_producto_3429).

 Los PI más comunes de artículos incluyen los números globales de artículos comerciales (GTIN), los números de pieza del fabricante (MPN) y los nombres de marca. No todos los artículos tienen identificadores de productos. Sin embargo, si su artículo tiene uno, le recomendamos que lo envíe dentro de sus publicaciones, mejorando la calidad de la misma y haciéndola más fácil de encontrar en el search principal.

## Tipos de GTIN

El GTIN (Global Trade Item Number) es el código reconocido a nivel mundial de un artículo comercial y varía en longitud de caracteres según el tipo de producto y el lugar donde se venderá. A continuación daremos detalle de los diferentes tipos que se pueden incluir en el atributo GTIN:

- UPC (en América del Norte / GTIN-12): número de 12 dígitos (los códigos UPC-E de 8 dígitos deben convertirse a códigos UPC-A de 12 dígitos). EAN (en Europa / GTIN-13): número de 13 dígitos. JAN (en Japón / GTIN-13): número con 8 o 13 dígitos. ISBN (para libros): número de 13 dígitos (los valores ISBN-10 deben convertirse a ISBN-13). ITF-14 (para paquetes múltiples / GTIN-14): número de 14 dígitos. Part Number: códigos que utilizan para localizar a un repuesto automotor de manera única, definiendo las compatibilidades del repuesto, entre otros detalles que nos ayudan a saber a qué tipo de auto aplica el repuesto.

## Lógica para el uso del atributo GTIN

Cuando la categoría cuenta con el atributo GTIN:

- Si tiene el tag **required** , será necesario completarlo en todo momento.

- Si tiene el tag **conditional_required** , deberás priorizar el uso del GTIN, pero en situaciones en las que no esté disponible, podrás optar por agregar el **EMPTY_GTIN_REASON** .

Para utilizar el atributo **EMPTY_GTIN_REASON** , es importante seguir las reglas establecidas para las [razones de no enviar el GTIN](https://developers.mercadolibre.com.ar/es_ar/identificadores-de-productos?nocache=true#Razones-de-no-enviar-GTIN).

## Publicar con identificadores

Se realiza de la misma manera en que se postean atributos independientemente de la categoría. Conoce más sobre [publicar un artículo](https://developers.mercadolibre.com.ar/es_ar/publica-productos#Publica-un-articulo).

Para los casos de publicaciones con variaciones, podrás especificar, en cada una de ellas, en su sección de "attributes" sus respectivos identificadores de productos.

Nota:

Para algunas categorías el atributo **GTIN**  es obligatorio, se reconoce con la etiqueta de **"conditional_required": true**  que se especifica en la llamada a **/categories/$CATEGORY_ID/attributes** ..
 Es importante aclarar que, si el ítem que el seller está intentando publicar **pertenece a una marca que ya tiene al menos 30 GTINs publicados** , el atributo pasa del status **no requerido a requerido** .
 En caso de no enviarlo en la llamada a /items/y para la marca sea requerido, [se validará](https://developers.mercadolibre.com.ar/es_ar/validaciones) enviando un mensaje 7810 con **code: item.attribute.missing_conditional_required** , solicitando así la carga del atributo.

```
curl -L -X POST 'https://api.mercadolibre.com/items' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "title": "Bicicleta Mtb Totem By Topmega R29 Producto Test",
   "category_id": "MLA6143",
   "price": 99999,
   "currency_id": "ARS",
   "available_quantity": 2,
   "sale_terms": [
       {
           "id": "WARRANTY_TIME",
           "value_name": "6 meses"
       },
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía de fábrica"
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "condition": "new",
   "pictures": [
       {
           "source": "http://http2.mlstatic.com/D_608172-MLA53351140125_012023-O.jpg"
       },
       {
           "source": "http://http2.mlstatic.com/D_714634-MLA53351124241_012023-O.jpg"
       },
       {
           "source": "http://http2.mlstatic.com/D_878513-MLA53351118304_012023-O.jpg"
       }
   ],
   "attributes": [
       {
           "id": "BICYCLE_FRAME_MATERIALS",
           "value_name": "aluninio"
       },
       {
           "id": "BICYCLE_TYPE",
           "value_name": "Mountain bike"
       },
       {
           "id": "BRAND",
           "value_name": "Totem"
       },
       {
           "id": "FRONT_BRAKE_TYPE",
           "value_name": "Disco mecánico"
       },
       {
           "id": "GENDER",
           "value_name": "Sin género"
       },
       {
           "id": "MODEL",
           "value_name": "Totem"
       },
       {
           "id": "REAR_BRAKE_TYPE",
           "value_name": "Disco mecánico"
       },
       {
           "id": "GTIN",
           "value_name": "7898945080293"
       }
   ]
}'
```

Ejemplo de una publicación con variaciones y con GTIN:

```
curl -L -X POST 'https://api.mercadolibre.com/items' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "title": "Bicicleta Mtb Totem By Topmega R29 Producto Test Variaciones",
   "category_id": "MLA6143",
   "price": 99999,
   "currency_id": "ARS",
   "available_quantity": 2,
   "sale_terms": [
       {
           "id": "WARRANTY_TIME",
           "value_name": "6 meses"
       },
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía de fábrica"
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "condition": "new",
   "pictures": [
       {
           "source": "http://http2.mlstatic.com/D_608172-MLA53351140125_012023-O.jpg"
       },
       {
           "source": "http://http2.mlstatic.com/D_714634-MLA53351124241_012023-O.jpg"
       },
       {
           "source": "http://http2.mlstatic.com/D_878513-MLA53351118304_012023-O.jpg"
       }
   ],
   "attributes": [
       {
           "id": "BICYCLE_FRAME_MATERIALS",
           "value_name": "aluninio"
       },
       {
           "id": "BICYCLE_TYPE",
           "value_name": "Mountain bike"
       },
       {
           "id": "BRAND",
           "value_name": "Totem"
       },
       {
           "id": "FRONT_BRAKE_TYPE",
           "value_name": "Disco mecánico"
       },
       {
           "id": "GENDER",
           "value_name": "Sin género"
       },
       {
           "id": "MODEL",
           "value_name": "Totem"
       },
       {
           "id": "REAR_BRAKE_TYPE",
           "value_name": "Disco mecánico"
       }
   ],
   "variations": [
       {
           "price": 99999,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "value_name": "Gris"
               },
               {
                   "id": "FRAME_SIZE",
                   "value_name": "M"
               }
           ],
           "available_quantity": 2,
           "picture_ids": [
               "811782-MLA53283867805_012023"
           ],
           "attributes": [
               {
                   "id": "MAIN_COLOR",
                   "value_name": "Gris"
               },
               {
                   "id": "GTIN",
                   "value_name": "7898945080293"
               }
           ]
       }
   ]
}'
```

## Agregar identificadores

En caso de no enviarlo en el llamado a /items/ [se validará](https://developers.mercadolibre.com.ar/es_ar/validaciones?nocache=true) enviando un mensaje 7810 con **code: item.attribute.missing_conditional_required** , solicitando asi la corrección del atributo.

Ejemplo de una publicación sin variaciones, adicionando el campo GTIN:

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA1363353921' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "attributes": [
       {
           "id": "GTIN",
           "value_name": "7898945080293"
       }
   ]
}'
```

Ejemplo de una publicación con variaciones, adicionando el campo GTIN, se debe enviar la lista completa de variaciones que se desea permanezcan (indicando el ID de cada variación):

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA1378022956' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "variations": [
       {
           "id": 177163823616,
           "attributes": [
               {
                   "id": "GTIN",
                   "value_name": "7898945080293"
               }
           ]
       }
   ]
}'
```

Si la publicación ya posee el atributo GTIN a nivel atributos principales, no podrás volver a especificarlo a nivel variante. En ese caso, primero debes borrarlo para luego, especificarlo a nivel variación.

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA1363353921' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "attributes": [
       {
           "id": "GTIN",
           "value_name": null
       }
   ]
}'
```

## Razones de no enviar GTIN

En algunas categorías el atributo GTIN está marcado como **conditional_required** , en caso de no enviarlo se permite adicionar la razón. Para eso creamos el atributo **EMPTY_GTIN_REASON** .

El atributo **EMPTY_GTIN_REASON**  es requerido condicionalmente **conditional_required** : true y **solo será permitido**  enviar en casos de que no tengan GTIN cargado en marcas de estos dominios. **Recuerdas siempre priorizar el envío del GTIN** .

Este nuevo atributo te permitirá cargar de una lista de razones previamente disponibles en la ficha técnica, la razón por la cual tu publicación no tiene GTIN, realizando el llamado a **/categories/$CATEGORY_ID/attributes** :

```
{
    "id": "EMPTY_GTIN_REASON",
    "name": "Motivo de GTIN vacío",
    "tags": {
      "conditional_required": true
    },
    "hierarchy": "ITEM",
    "relevance": 1,
    "value_type": "list",
    "values": [
      {
        "id": "17055158",
        "name": "Artesanal"
      },
      {
        "id": "17055159",
        "name": "Kit"
      },
      {
        "id": "17055160",
        "name": "No registrado"
      },
      {
        "id": "17055161",
        "name": "Otro"
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  }
```

Lista de valores permitidos:

- Artesanal: el artículo es una artesanía, confección propia. Kit: el artículo es un conjunto de artículos o un kit. No registrado: es un artículo que aún no está registrado. Otro: existe otra razón (diferente de Artesanal, Kit y No registrado) que impide que se cargue el atributo de GTIN.

Ejemplo de la validación cuando **no se está enviando el GTIN y se requiere enviarlo** :

```
"message": "Validation error",
"error": "validation_error",
"status": 400,
"cause": [
{
"department": "supply",
"cause_id": 7810,
"type": "error",
"code": "item.attribute.missing_conditional_required",
"references": [
"item.attributes"
],
"message": "The attributes [GTIN] are required for category [MLB11172]. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes."
}
]
}
```

Ejemplo de la validación cuando no se está enviando el GTIN y se requiere especificar una razón:

```
{
   "message": "Validation error",
   "error": "validation_error",
   "status": 400,
   "cause": [
       {
           "department": "supply",
           "cause_id": 7810,
           "type": "error",
           "code": "item.attribute.missing_conditional_required",
           "references": [
               "item.attributes"
           ],
           "message": "The attributes [EMPTY_GTIN_REASON] are required for category [MLA455058]. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes."
       }
   ]
}
```

## Consultar identificadores en publicaciones

Para obtener estos datos, deberás hacer un GET al API de /items/ adicionando al llamado ?include_attributes=all para obtener el detalle completo del item.

Ejemplo de la llamada:

```
curl -L -X GET 'https://api.mercadolibre.com/items/$ITEM_ID?include_attributes=all' -H 'Authorization: Bearer Bearer $ACCESS_TOKEN'
```

Ejemplo de la respuesta:

```

{
   "id": "MLA1378022956",
   "site_id": "MLA",
   "title": "Bicicleta Mtb Totem By Topmega R29 Producto Test Variaciones",
   "subtitle": null,
   "seller_id": 1108966308,
   "category_id": "MLA6143",
   "official_store_id": null,
   "price": 99999,
   "base_price": 99999,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 2,
   "available_quantity": 2,
   "sold_quantity": 0,
   "sale_terms": [
       {
           "id": "WARRANTY_TIME",
           "name": "Tiempo de garantía",
           "value_id": null,
           "value_name": "6 meses",
           "value_struct": {
               "number": 6,
               "unit": "meses"
           },
           "values": [
               {
                   "id": null,
                   "name": "6 meses",
                   "struct": {
                       "number": 6,
                       "unit": "meses"
                   }
               }
           ],
           "value_type": "number_unit"
       },
       {
           "id": "WARRANTY_TYPE",
           "name": "Tipo de garantía",
           "value_id": "2230279",
           "value_name": "Garantía de fábrica",
           "value_struct": null,
           "values": [
               {
                   "id": "2230279",
                   "name": "Garantía de fábrica",
                   "struct": null
               }
           ],
           "value_type": "list"
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2023-03-22T16:00:07.138Z",
   "stop_time": "2043-03-17T04:00:00.000Z",
   "end_time": "2043-03-17T04:00:00.000Z",
   "expiration_time": "2023-06-10T16:00:07.234Z",
   "condition": "new",
   "permalink": "https://articulo.mercadolibre.com.ar/MLA-1378022956-bicicleta-mtb-totem-by-topmega-r29-producto-test-variaciones-_JM",
   "thumbnail_id": "811782-MLA53283867805_012023",
   "thumbnail": "http://http2.mlstatic.com/D_811782-MLA53283867805_012023-I.jpg",
   "secure_thumbnail": "https://http2.mlstatic.com/D_811782-MLA53283867805_012023-I.jpg",
   "pictures": [
       {
           "id": "867579-MLA54548045653_032023",
           "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "size": "500x500",
           "max_size": "500x500",
           "quality": ""
       },
       {
           "id": "799020-MLA54548045651_032023",
           "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "size": "500x500",
           "max_size": "500x500",
           "quality": ""
       },
       {
           "id": "644762-MLA54548045655_032023",
           "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
           "size": "500x500",
           "max_size": "500x500",
           "quality": ""
       },
       {
           "id": "811782-MLA53283867805_012023",
           "url": "http://http2.mlstatic.com/D_811782-MLA53283867805_012023-O.jpg",
           "secure_url": "https://http2.mlstatic.com/D_811782-MLA53283867805_012023-O.jpg",
           "size": "500x329",
           "max_size": "1080x711",
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
       "comment": "10 Referencia: Cerca al parque",
       "address_line": "av petit thouars 12",
       "zip_code": "3730",
       "city": {
           "name": "Charata"
       },
       "state": {
           "id": "AR-H",
           "name": "Chaco"
       },
       "country": {
           "id": "AR",
           "name": "Argentina"
       },
       "search_location": {
           "neighborhood": {
               "id": "TUxBQkNIQTk4Mzha",
               "name": "Charata"
           },
           "city": {
               "id": "TUxBQ0NIQTMzNjQw",
               "name": "Chacabuco"
           },
           "state": {
               "id": "TUxBUENIQW8xMTNhOA",
               "name": "Chaco"
           }
       },
       "latitude": -27.2179902,
       "longitude": -61.18736169999999,
       "id": 1277144929
   },
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -27.2179902,
       "longitude": -61.18736169999999
   },
   "coverage_areas": [],
   "attributes": [
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "value_id": "2230284",
           "value_name": "Nuevo",
           "value_struct": null,
           "values": [
               {
                   "id": "2230284",
                   "name": "Nuevo",
                   "struct": null
               }
           ],
           "attribute_group_id": "",
           "attribute_group_name": "",
           "value_type": "list"
       },
       {
           "id": "BICYCLE_FRAME_MATERIALS",
           "name": "Materiales del cuadro de la bicicleta",
           "value_id": null,
           "value_name": "aluninio",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "aluninio",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       },
       {
           "id": "BICYCLE_TYPE",
           "name": "Tipo de bicicleta",
           "value_id": "240445",
           "value_name": "Mountain bike",
           "value_struct": null,
           "values": [
               {
                   "id": "240445",
                   "name": "Mountain bike",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       },
       {
           "id": "BRAND",
           "name": "Marca",
           "value_id": null,
           "value_name": "Totem",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "Totem",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       },
       {
           "id": "FRONT_BRAKE_TYPE",
           "name": "Tipo de freno delantero",
           "value_id": "8117600",
           "value_name": "Disco mecánico",
           "value_struct": null,
           "values": [
               {
                   "id": "8117600",
                   "name": "Disco mecánico",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       },
       {
           "id": "GENDER",
           "name": "Género",
           "value_id": "110461",
           "value_name": "Sin género",
           "value_struct": null,
           "values": [
               {
                   "id": "110461",
                   "name": "Sin género",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "list"
       },
       {
           "id": "MODEL",
           "name": "Modelo",
           "value_id": null,
           "value_name": "Totem",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "Totem",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       },
       {
           "id": "REAR_BRAKE_TYPE",
           "name": "Tipo de freno trasero",
           "value_id": "6440294",
           "value_name": "Disco mecánico",
           "value_struct": null,
           "values": [
               {
                   "id": "6440294",
                   "name": "Disco mecánico",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros",
           "value_type": "string"
       }
   ],
   "warnings": [],
   "listing_source": "",
   "variations": [
       {
           "id": 177163823616,
           "price": 99999,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "name": "Color",
                   "value_id": "283165",
                   "value_name": "Gris",
                   "value_struct": null,
                   "values": [
                       {
                           "id": "283165",
                           "name": "Gris",
                           "struct": null
                       }
                   ],
                   "value_type": "string"
               },
               {
                   "id": "FRAME_SIZE",
                   "name": "Tamaño del cuadro",
                   "value_id": "454143",
                   "value_name": "M",
                   "value_struct": null,
                   "values": [
                       {
                           "id": "454143",
                           "name": "M",
                           "struct": null
                       }
                   ],
                   "value_type": "string"
               }
           ],
           "available_quantity": 2,
           "sold_quantity": 0,
           "sale_terms": [],
           "picture_ids": [
               "811782-MLA53283867805_012023"
           ],
           "seller_custom_field": null,
           "catalog_product_id": null,
           "attributes": [
               {
                   "id": "MAIN_COLOR",
                   "name": "Color principal",
                   "value_id": "2450294",
                   "value_name": "Gris",
                   "value_struct": null,
                   "values": [
                       {
                           "id": "2450294",
                           "name": "Gris",
                           "struct": null
                       }
                   ],
                   "value_type": "list"
               },
               {
                   "id": "GTIN",
                   "name": "Código universal de producto",
                   "value_id": null,
                   "value_name": "7898945080293",
                   "value_struct": null,
                   "values": [
                       {
                           "id": null,
                           "name": "7898945080293",
                           "struct": null
                       }
                   ],
                   "value_type": "string"
               }
           ],
           "inventory_id": null,
           "item_relations": []
       }
   ],
   "status": "active",
   "sub_status": [],
   "tags": [
       "good_quality_thumbnail",
       "test_item",
       "immediate_payment"
   ],
   "warranty": "Garantía de fábrica: 6 meses",
   "catalog_product_id": null,
   "domain_id": "MLA-BICYCLES",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2023-03-22T16:00:07.408Z",
   "last_updated": "2023-03-22T16:00:18.722Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": [],
   "channels": [
       "marketplace"
   ]
}
```

## Consideraciones

Nota:

Los ítems publicados que no tengan el GTIN debidamente cargado quedarán moderados/pausados. Para poder ver y gestionar estas moderaciones, te invitamos a [utilizar el recurso documentado en infracciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-moderaciones) .

- No son SKU internos.

- Puedes enviar más de un código identificador para una misma publicación. En ese caso, debes enviar en el atributo GTIN todos los identificadores separados por coma.

- Recuerda verificar en [/attributes](https://developers.mercadolibre.com.ar/es_ar/atributos#Consulta-atributos) si los atributos están marcados con los siguientes tags:  - **required** , el atributo es obligatorio.  - **new_required** , el atributo es obligatorio si la condición de la publicación es nueva.  - **conditional_required** , el atributo es obligatorio siguiendo ciertas condiciones en la publicación.

- La cantidad de caracteres varía por tipo de código: existen de 8, 10, 12, 13 o 14 caracteres. Incluso, un mismo código puede volver a escribirse completándose con ‘0’s al comienzo e igual ser válido.

- Se validan los GTIN enviados y en caso de no ser válidos, no se permitirá realizar el POST. Se puede consultar el detalle de las [validaciones](https://developers.mercadolibre.com.ar/es_ar/validaciones?nocache=true).

**Siguiente:**  [Variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones).
