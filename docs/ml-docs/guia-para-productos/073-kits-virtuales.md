<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/kits-virtuales -->
<!-- Sección: Guía para productos -->

# Kits virtuales

Última actualización 17/09/2026

## Kits virtuales

Crea ofertas irresistibles y vende más con los Kits Virtuales. 
 
 Esta funcionalidad te permite agrupar varios de tus productos en una sola publicacion para ofrecer una experiencia de compra superadora y potenciar tus ventas. La gran ventaja es que su inventario es "virtual": el stock se calcula automáticamente en tiempo real basándose en la disponibilidad de sus componentes individuales, sin que tengas que armar paquetes por adelantado.
 
 En esta guía, te mostraremos el paso a paso para buscar y seleccionar los productos elegibles, publicar tu primer kit, modificarlo y gestionar sus ventas. 
 
¡Prepárate para llevar tus publicaciones al siguiente nivel!.

# Consideraciones especiales

Presentamos algunas consideraciones que debes tener en cuenta al momento de querer publicar un **ítem kit**  bajo el nuevo modelo de [User Products](https://developers.mercadolibre.com.ar/es_ar/user-products).

- El ítem kit es **inmutable** , no va a poder modificar su configuración de acuerdo a los **productos que lo componen**  y en qué cantidades, pero **sí podrían modificarse sus condiciones de venta** .

- Cada kit estará compuesto por un máximo de 6 productos y mínimo de 2. Y tendrá como límite de cantidad para cada producto dentro del kit un máximo de 10.

- El stock de un ítem kit se va a calcular con base en el stock de los productos que lo componen y la cantidad configurada de cada uno de ellos dentro del kit.  Ejemplo: Para el “Kit Fernet + 2 Cocas”, si tenemos 4 fernets y 4 cocas, solo vamos a poder armar 2 kits, por lo tanto, el stock del kit va a ser 2.

- Los user products de los componentes van a tener la marca `“kit_component”`.

- No se va a permitir crear user products duplicados (kits con los mismos componentes y cantidades de cada uno).

- El producto componente principal va a ser el primero en la lista de componentes del user product.

- No vamos a permitir crear user products kits con atributo `“item_condition” != “new”.`

- Los kits podrán ser **monocanal** . Por el momento solo disponible para marketplace.

- Los ítems kits de full **NO**  van a tener `“inventory_id”`.

- Para obtener el precio de venta actual del ítem kit, debes utilizar el recurso de [/sale_price](https://developers.mercadolibre.com.ar/es_ar/api-de-precios).

Nota:

Partners no certificados: Para realizar pruebas te pedimos que cargues tu usuario test en el siguiente [formulario](https://forms.gle/H5QQegpdZQUmYNV26). para que lo habilitemos para la creación de kits virtuales.

## Buscador de productos componentes

Antes de poder crear un kit, necesitas seleccionar qué productos lo compondrán. 
 Esta herramienta de búsqueda te permite encontrar y validar los productos de tu inventario que son elegibles para formar parte de un kit. A medida que agregas productos, el buscador aplicará filtros de elegibilidad para asegurar que solo veas opciones compatibles, facilitando así el proceso de armado

**Llamada:**

```
curl -L -X POST \
https://api.mercadolibre.com/users/$SELLER_ID/kits/components/search?searchText=$STRING&limit=2 \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

1. **Búsqueda del Producto Principal.**  Comienza buscando el primer producto que será el potencial componente principal de tu kit. La búsqueda inicial se realiza sin filtros de compatibilidad.

2. 

3. **Selección y Búsqueda de Componentes Adicionales.**  Una vez que seleccionas el producto principal, puedes agregar el filtro de elegibilidad `"ONLY_ELIGIBLE"`. Esto significa que en las búsquedas posteriores solo verás productos que sean compatibles con los que ya has añadido al kit.

4. 

5. **Agrega Todos los Componentes.**  Continúa buscando y agregando productos hasta que tu kit esté completo. Recuerda que un kit puede tener entre 2 y 6 productos diferentes.

6. 

7. **Publica tu Kit.**  Una vez que hayas agregado todos los componentes, podrás proceder a la publicación final del kit.

**Llamada:**

```
curl -L -X POST \
'https://api.mercadolibre.com/users/$SELLER_ID/kits/components/search?searchText=$STRING&limit=2' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Request body**  - Búsqueda **sin productos agregados**

Solo necesitas indicar el canal activo, que por ahora es marketplace.

```
{
  "active_channels": [
    "marketplace"
  ]
}
```

**Request body**  - Búsqueda con un **componente principal elegido**  y con una lista de **componentes agregados** ; además pidiendo **solo productos elegibles**

Debes incluir el ID del producto principal `(main_product_id)`, una lista con los IDs de los productos ya añadidos `(added_products)` y el filtro de elegibilidad para asegurar la compatibilidad `"filters": ["ONLY_ELIGIBLE"]`.

```
{
  "main_product_id": "MLAU3044953709",
  "added_products": [
    "MLAU2926276084",
    "MLAU408338970",
    "MLAU3044953709",
    "MLAU3053532482",
    "MLAU1272626713"
  ],
  "active_channels": [
    "marketplace"
  ],
  "search_filters": {
      "only_eligible": "ONLY_ELIGIBLE",
      "family_id": null
   }

}
```

## Filtros disponibles

Para ofrecer mayor flexibilidad en los resultados de búsqueda, están disponibles los siguientes filtros que deben enviarse dentro de la propiedad **search_filters** .

**Only eligible:**  Este filtro garantiza que todos los resultados sean elegibles, excluyendo los productos que no pueden formar parte del kit (aquellos cuya propiedad **type**  tiene el valor **available** ).

Ejemplo:

```
{
  "search_filters": {
    "only_eligible": "ONLY_ELIGIBLE"
  }
}
```

**Family ID:**  Este filtro permite restringir la búsqueda a un family ID específico, devolviendo todos los productos que pertenecen a la familia del UP.

Ejemplo:

```
{
  "search_filters": {
    "family_id": 515477844859253
  }
}
```

**Combinación de filtros:** Los filtros pueden combinarse entre sí. Por ejemplo, es posible obtener únicamente los productos elegibles de una familia específica o enviarlos de forma individual.

Ejemplo:

```
{
  "search_filters": {
    "only_eligible": "ONLY_ELIGIBLE",
    "family_id": 515477844859253
  }
}
```

**Respuesta:**

```
{
  "paging": {
    "search_after_hash": null
  },
  "search_text": "cel",
  "result_state": "AVAILABLE",
  "products": [
    {
      "id": "MLAU1272335441", //UP no disponible - "type": "non_available"
      "title": "Celular Google Pixel 8 Pro 256 Gb  Negro 12 Gb Ram Azul Oscuro",
      "type": "non_available",
      "thumbnail": {
        "secure_url": "https://http2.mlstatic.com/D_617565-MLA81954291020_022025-O.jpg",
        "id": "617565-MLA81954291020_022025"
      },
      "product_ids": [
        {
          "id": "MLA1912685920",
          "type": null
        }
      ],
      "category_name": "Celulares",
      "stock": {
        "title": "Mercado Envíos",
        "locations": [
          {
            "type": "selling_address",
            "quantity": 8,
            "value": "En tu depósito hay: 8 unidades"
          }
        ]
      },
      "reasons": [
        {
          "id": "IS_NOT_NEW",
          "message": "No puedes vender este producto en kit porque es usado o reacondicionado."
        }
      ]
    },
    {
      "id": "MLAU1272626713", //UP disponible -  "type": "available"
      "title": "Samsung Galaxy S23+ 8gb + 512gb Liberado Rosa Color Rosa",
      "type": "available",
      "thumbnail": {
        "secure_url": "https://http2.mlstatic.com/D_612324-MLA80821630841_112024-O.jpg",
        "id": "612324-MLA80821630841_112024"
      },
      "product_ids": [
        {
          "id": "MLA1450811023",
          "type": null
        }
      ],
      "category_name": "Celulares",
      "stock": {
        "title": "Mercado Envíos",
        "locations": [
          {
            "type": "selling_address",
            "quantity": 1,
            "value": "En tu depósito hay: 1 unidad"
          }
        ]
      },
      "reasons": []
    },
    {...},
    {...},
    {...},
    {...}
]
}
```

La respuesta de la API te informará si un producto es apto o no para ser incluido en el kit:

- **Productos Disponibles:**  Un producto con `"type": "available"` en la respuesta significa que es elegible y puede ser añadido a tu kit sin problemas.

- **Productos No Disponibles:**  Si un producto aparece como `"type": "non_available"`, no podrás seleccionarlo. La razón se especificará en el campo reasons.

**Respuesta:**

```
{
  "paging": {
    "search_after_hash": null
  },
  "search_text": "PRUEBA_SIN_RESULTADOS",
  "result_state": "EMPTY",
  "products": []
}
```

## Crear Kit virtual

Una vez que has seleccionado todos los productos componentes usando el buscador, estás listo para publicar un Kit. Este proceso consiste en agrupar los productos seleccionados `(user_product_id)` en una nueva publicación única.

**Llamada:**

```
curl -L -X POST https://api.mercadolibre.com/items/kits \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer Bearer $ACCESS_TOKEN \
-d '{
  "family_name": "KIT lapiz y acondicionador prueba",
  "channels": [
    "marketplace"
  ],
  "thumbnail": {
    "id": "981862-MLA82943132528_032025",
    "secure_url": "https://http2.mlstatic.com/D_707148-MLC54405569361_032023-O.jpg"
  },
  "price": 30,
  "currency_id": "BRL",
  "listing_type_id": "gold_special",
  "official_store_id": null,
  "bundle": {
    "type": "kit",
    "components": [
      {
        "type": "user_product",
        "user_product_id": "MLB03108136853",
        "quantity": 2,
        "automatic_price": null
      },
      {
        "type": "user_product",
        "user_product_id": "MLB03293311857",
        "quantity": 1,
        "automatic_price": null
      }
    ]
  }
}'
```

## Estructura de bundle

El campo `bundle` es el nodo principal que define cómo está estructurado un kit de productos. Es decir, es donde se describe qué productos lo componen, en qué cantidades y cómo se va a definir su precio.

- `type`: Indica que el objeto representa un **conjunto de productos agrupados**  (un kit), y no un producto individual.

- `components`: Es una **lista de productos**  que componen el kit. Cada producto dentro de esta lista tiene 3 datos clave:  `user_product_id`: Es el **ID único**  del producto componente. `quantity`: Define **cuántas unidades**  de ese producto se incluyen en el kit. (Límite: **máximo 10 unidades por producto** .) `automatic_price`: Determina **cómo se calcula el precio**  del kit.  Si el campo es:  `null`: el **precio se carga manualmente** . agregando el campo `discount`. **Importante:**  si se configura el descuento, debe ser el **mismo para todos los componentes**  del kit.

Nota:

Para sellers de MLA con condición fiscal de Responsable Inscriptos, los valores [IVA (VALUE_ADDED_TAX) e Impuestos Internos (IMPORT_DUTY)](https://developers.mercadolibre.com.ar/es_ar/atributos#:~:text=env%C3%ADo%20al%20cat%C3%A1logo.-,Atributos%20obligatorios,-Importante%3A) serán heredados directamente de los ítems componentes.

## Body - Sin sincronización de precios

Para crear un kit sin sincronización de precios, deberán enviar el campo `automatic_price` = `null`.

```
{
   "family_name": "Kit Aventura: 1 Motosserra Elétrica 2200W 16 Pol + 1 Canivete Retrátil Preto/Madeira",
   "channels": [
       "marketplace"
   ],
  "thumbnail": {
       "id": "981862-MLA82943132520_032025"
   },
   "price": 2001,
   "currency_id": "BRL",
   "official_store_id": null,
   "listing_type_id": "gold_pro",
   "bundle": {
       "type": "kit",
       "components": [
           {
               "type": "user_product",
               "user_product_id": "MLBU3256534109",
               "quantity": 1,
               "automatic_price": null
           },
           {
               "type": "user_product",
               "user_product_id": "MLBU3235954953",
               "quantity": 1,
        	  "automatic_price": null
           }
       ]
   }
}
```

## Body - Sincronización de precios

Para sincronizar el precio del kit con el precio de sus componentes (UP), incluí en cada componente `automatic_price` con el campo `discount`.

Debe ser el mismo valor de `discount` en todos los componentes del kit. **No se admiten descuentos distintos por UP**  y `discount` se envía como decimal entre 0 y 1 (por ejemplo, `0.30` = 30%).

Al sincronizar, se toma el precio vigente de cada UP y se aplica el descuento definido para calcular el precio del kit. Por eso el campo `price` no es necesario enviarlo.

```
{
  "family_name": "Kit Aventura: 1 Motosserra Elétrica 2200W 16 Pol + 1 Canivete Retrátil Preto/Madeira",
  "channels": [
    "marketplace"
  ],
  "thumbnail": {
    "id": "981862-MLA82943132528_032025",
    "secure_url": "https://http2.mlstatic.com/D_707148-MLC54405569361_032023-O.jpg"
  },
  "currency_id": "BRL",
  "official_store_id": null,
  "listing_type_id": "gold_pro",
  "bundle": {
    "type": "kit",
    "components": [
      {
        "type": "user_product",
        "user_product_id": "MLBU32565354109",
        "quantity": 1,
        "automatic_price": { "discount": 0.30 }
      },
      {
        "type": "user_product",
        "user_product_id": "MLBU3235954953",
        "quantity": 2,
        "automatic_price": { "discount": 0.30 }
      }
    ]
  }
}
```

## Respuesta creación kit exitosa

```

{
  "id":"MLB5519759426",
  "site_id":"MLB",
  "title":"Kit Aventura: 1 Motosserra Elétrica 2200w 16 Pol + 1 Canivete Retrátil Preto/madeira",
  "subtitle":null,
  "seller_id":655590662,
  "category_id":"MLB269947",
  "user_product_id":"MLBU3297286069",
  "official_store_id":null,
  "price":2001,
  "base_price":2001,
  "original_price":null,
  "inventory_id":null,
  "currency_id":"BRL",
  "initial_quantity":96,
  "available_quantity":96,
  "sold_quantity":0,
  "sale_terms":[
    
  ],
  "buying_mode":"buy_it_now",
  "listing_type_id":"gold_pro",
  "historical_start_time":"2025-07-24T21:10:45.627Z",
  "family_name":"Kit Aventura: 1 Motosserra Elétrica 2200w 16 Pol + 1 Canivete Retrátil Preto/madeira",
  "family_id":5086163669878745,
  "start_time":"2025-07-24T21:10:45.627Z",
  "stop_time":"2045-07-19T04:00:00.000Z",
  "end_time":"2045-07-19T04:00:00.000Z",
  "expiration_time":"2025-10-12T21:10:45.704Z",
  "condition":"new",
  "permalink":"http://produto.mercadolivre.com.br/MLB-5519759426-kit-aventura-1-motosserra-eletrica-2200w-16-pol-1-canivete-retratil-pretomadeira-_JM",
  "pictures":[
     {
        "id":"981862-MLA82943132520_032025",
        "url":"http://mla-s1-p.mlstatic.com/981862-MLA82943132520_032025-O.jpg",
        "secure_url":"https://mla-s1-p.mlstatic.com/981862-MLA82943132520_032025-O.jpg",
        "size":"500x461",
        "max_size":"1065x984",
        "quality":""
     },
     {
        "id":"800684-MLU71335801005_082023",
        "url":"http://mlu-s2-p.mlstatic.com/800684-MLU71335801005_082023-O.jpg",
        "secure_url":"https://mlu-s2-p.mlstatic.com/800684-MLU71335801005_082023-O.jpg",
        "size":"500x489",
        "max_size":"1200x1174",
        "quality":""
     },
     {
        "id":"784795-MLU73420522013_122023",
        "url":"http://mlu-s1-p.mlstatic.com/784795-MLU73420522013_122023-O.jpg",
        "secure_url":"https://mlu-s1-p.mlstatic.com/784795-MLU73420522013_122023-O.jpg",
        "size":"500x412",
        "max_size":"1200x989",
        "quality":""
     }
  ],
  "video_id":null,
  "descriptions":[
  ],
  "accepts_mercadopago":true,
  "non_mercado_pago_payment_methods":[
    
  ],
  "shipping":{
     "mode":"me2",
     "local_pick_up":false,
     "free_shipping":true,
     "methods":[  
     ],
     "dimensions":null,
     "tags":[
        "mandatory_free_shipping"
     ],
     "logistic_type":"cross_docking",
     "store_pick_up":false
  },
  "international_delivery_mode":"none",
  "seller_address":{
     "id":1480628396,
     "comment":"",
     "address_line":"Grito de gloria 620",
     "zip_code":"01405001",
     "city":{
        "id":"BR-SP-44",
        "name":"São Paulo"
     },
     "state":{
        "id":"BR-SP",
        "name":"São Paulo"
     },
     "country":{
        "id":"BR",
        "name":"Brasil"
     },
     "latitude":-23.5587498,
     "longitude":-46.6341625,
     "search_location":{
        "neighborhood":{
           "id":"TUxCQkpBUm0xaTF2",
           "name":"Jardim Paulista"
        },
        "city":{
           "id":"TUxCQ1NQLTkxMjE",
           "name":"São Paulo Zona Sul"
        },
        "state":{
           "id":"TUxCUFNBT085N2E4",
           "name":"São Paulo"
        }
     }
  },
  "seller_contact":null,
  "location":{
    
  },
  "geolocation":{
     "latitude":-23.5587498,
     "longitude":-46.6341625
  },
  "coverage_areas":[
    
  ],
  "attributes":[],
  "warnings":[],
  "listing_source":"",
  "variations":[
    
  ],
  "thumbnail_id":"981862-MLA82943132520_032025",
  "thumbnail":"http://mlb-s1-p.mlstatic.com/981862-MLA82943132520_032025-I.jpg",
  "secure_thumbnail":"https://mlb-s1-p.mlstatic.com/981862-MLA82943132520_032025-I.jpg",
  "status":"active",
  "sub_status":[
    
  ],
  "tags":[
     "bundle",
     "cart_eligible",
     "good_quality_thumbnail",
     "immediate_payment",
     "kvs_primary",
     "test_item",
     "user_product_listing"
  ],
  "warranty":null,
  "catalog_product_id":null,
  "domain_id":"MLB-ELECTRIC_CHAINSAWS",
  "seller_custom_field":null,
  "parent_item_id":null,
  "differential_pricing":null,
  "deal_ids":[
    
  ],
  "automatic_relist":false,
  "date_created":"2025-07-24T21:10:46.275Z",
  "last_updated":"2025-07-24T21:10:46.957Z",
  "total_listing_fee":null,
  "health":null,
  "catalog_listing":false,
  "item_relations":[
    
  ],
  "channels":[
     "marketplace"
  ],
  "bundle":{
     "type":"kit",
     "components":[
        {
           "type":"user_product",
           "user_product_id":"MLBU3256534109",
           "quantity":1
        },
        {
           "type":"user_product",
           "user_product_id":"MLBU3235954953",
           "quantity":1
        }
     ]
  }
}
```

# Identificar un ítem Kit

Nota:

Podrás diferenciar/identificar un kit a través del campo `bundle.type`: `"kit"`. El user product además tendrá un nodo `bundle.components` donde se encuentran los user products que componen el kit.

**Consideraciones adicionales y aclaraciones:**

- **Componente principal:**  El primer producto listado en el arreglo components es considerado el componente principal del kit. El `domain_id` del kit se hereda de este primer producto.

- **Inmutabilidad:**  Una vez identificado como kit, su composición (productos y cantidades dentro del nodo `bundle`) es inmutable. No podrás modificar esta estructura después de la publicación.

- **Tags:**  Además del nodo `bundle`, un ítem kit incluirá el tag `"bundle"` en su lista de tags, lo cual es otro indicador útil.

**Llamada:**

```
curl -X GET \
https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```

{
    "site_id": "MLA",
    "user_id": 678394720,
    "domain_id": "MLA-FERNET", -- Dominio del producto principal
    "catalog_product_id": null,
    "family_id": 5896969823350698505,
    "date_created": "2023-09-27T17:32:49.571+0000",
    "last_updated": "2024-02-08T15:54:33.846+0000",
    "id": "MLAU13654585",
    "name": "Kit Fernet + 2 Cocas",
    "attributes": [
        ....
    ],
    "pictures": [
    ],
    "thumbnail": {
        "secure_url": "https://http2.mlstatic.com/D_745037-MLC71731586739_092023-O.jpg",
        "id": "745037-MLA71731586739_092023"
    },
    "tags": ["bundle"],
    "bundle": {
          "type": "kit",
	     "components": [
            {
              "type": "user_product",
              "user_product_id": "MLAU654321" 
 	 	 "quantity": 1           
      	     },
            {
              "type": "user_product",
              "user_product_id": "MLAU654321"
 	  	 "quantity": 2                       
     }
        ]
    }
}
```

- Para identificar que un ítem es un kit, se debe chequear que contenga el tag `"bundle"` y también el `bundle.type` = `"kit"`.

- Para identificar que un user product es parte componente de un kit, se debe chequear que contenga el tag `"kit_component"`.

- Para identificar que un ítem es parte componente de un kit, se debe chequear también que contenga el tag `"kit_component"`.

- Si el ítem consultado **NO**  es un kit, simplemente no encontrarás el nodo `bundle` en la respuesta de la API.

## Obtener en qué Kits está asociado un UP

Si necesitas saber si uno de tus productos ya forma parte de algún kit, este recurso te permite consultarlo fácilmente. 

 Mantener un control sobre qué productos has incluido en kits es fundamental para gestionar tu inventario y tus estrategias de venta. Por ejemplo, si planeas pausar la venta de un producto, es importante saber si esto afectará el stock de alguno de tus kits activos. 
 Podrás consultar los Kits en que un UP componente está asociado en su momento. 

 Nota: Este recurso solo aplica para consultar los KITs en los cuales está presente ese UP. No aplica para Multibultos.

La consulta se realiza utilizando el `user_product_id` del producto componente, no el `item_id` de una publicación ni el `user_product_id` del kit.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/bundles \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' 
```

**Respuesta:**

```
{
  "user_product_id": "MLAU123456",
  "bundles": [
    "MLAU6788181",
    "MLAU6667788"
  ],
  "last_updated": "2024-09-13T12:16:00.000Z"
}
```

Recibirás un código `200` OK y un JSON que contiene el `user_product_id` consultado y la lista `bundles` con los `user_product_id` de cada kit en el que participa.

Si ese User Product no está asociado a ningún kit, el response será status code `404`:

```
{
  "error": "not_found",
  "message": "UserProductComponent not found: MLAU30701731699",
  "status": 404
}
```

Si se supera la cuota permitida para el `client.id`, el response será status code `429`:

```
{
  "error": "too_many_requests",
  "message": "client.id over quota",
  "status": 429
}
```

## Modificar Kit

Una vez que has publicado un kit, su configuración principal se vuelve inmutable. Esto significa que no podrás modificar los productos que lo componen ni sus cantidades. Esta regla asegura la consistencia de la oferta para los compradores y simplifica la gestión del stock. 

 Sin embargo, sí puedes modificar las condiciones de venta del kit, como el título, el precio (si es manual), la descripción o la imagen principal. A continuación, te explicamos en detalle qué puedes cambiar y qué no

## Campos modificables del Kit

| Campo en el Kit | Modificable por el seller | Aclaraciones |
| --- | --- | --- |
| Composición del kit (productos y cantidades) | No | Es la característica principal del kit y no se puede alterar. Si intentas modificar el nodo `bundle`, recibirás un error `400 Bad Request` con el mensaje: `"Updating the bundle node is not allowed"`. |
| Título (`family_name`) | Sí | Podrás modificar el (`family_name`) a través del siguiente [recurso](https://developers.mercadolibre.com.ar/es_ar/precio-variacion#:~:text=recurso%20de%20%C3%ADtems.-,Modificar%20familia,-Podr%C3%A1s%20modificar%20el), teniendo en cuenta que sólo podrá ser modificado si aún no tienen ventas. |
| Canales (`channels`) | No | Los kits solo están disponibles para `"marketplace"` y este campo no puede modificarse. |
| Precio (`price`) | Sí | Solo puedes modificar el precio si **no**  tiene configuración de precio `automatic_price` (sincronización con descuentos). Si lo cambias manualmente, se aplicará; si está configurado para sincronizarse, cualquier cambio manual será sobrescrito. |
| Stock (`quantity` / `available_quantity`) | No | Se calcula y sincroniza automáticamente en base a la disponibilidad de los componentes. No se gestiona manualmente. |
| Tipo de publicación (`listing_type_id`) | Sí | Puedes cambiarlo (ej.: de Clásica a Premium) siempre que todos los componentes lo permitan. |
| Métodos de envío (`shipping_method`) | No | Se hereda de los productos componentes y no se puede cambiar. |
| Dominio/Categoría (`domain_id`) | No | Se hereda del producto componente principal (el primero en la lista) y no se puede cambiar. |
| Descripción | Sí | Puedes editarla para añadir más detalles o mejorar la información para los compradores. |
| Imagen principal (`thumbnail`) | Sí | Puedes actualizar la imagen principal del kit para mejorar su atractivo visual. |

## Modificación de atributos actualizables

En el caso de que se intente modificar la configuración del kit (por ejemplo, el nodo `bundle`), vamos a retornar el siguiente error:

**Respuesta:**

```
{
  "message": "Updating the bundle node is not allowed",
  "error": "bad_request",
  "status": 400,
  "cause": []
}
```

Para modificar los campos permitidos, debes realizar una llamada `PUT` al endpoint de `items`, especificando el `item_id` del kit y los campos que deseas cambiar (por ejemplo, `"price"`).

**Llamada:**

```
curl -L -X PUT https://api.mercadolibre.com/items/$ITEM_ID \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{"price": 4000}'
```

## Consultar precio de venta del Kit

Para gestionar tus ventas y finanzas de manera efectiva, necesitas entender no solo el precio final que paga el comprador, sino también cómo se distribuye ese valor entre cada uno de los productos que componen el kit. 

 Para obtener esta información detallada, debes utilizar el recurso /sale_price. Este endpoint te proporcionará un desglose completo del precio del kit, incluyendo el valor asignado a cada componente, el precio de venta individual de esos componentes y el impacto de posibles promociones

Para un kit, el recurso `/sale_price` trae mayor información para tu consulta. Se incluye dentro del campo `bundle`.

**Llamada:**

```
curl -L -X GET https://api.mercadolibre.com/items/$ITEM_ID/sale_price?context=channel_marketplace \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

sin promoción aplicada

```
{
  "price_id": "13",
  "amount": 114,
  "regular_amount": 250,
  "currency_id": "BRL",
  "reference_date": "2025-09-17T14:44:19Z",
  "metadata": {},
  "bundle": {
    "components": [
      {
        "user_product_id": "MLBU3397414253",
        "item_id": "MLB4189262175",
        "component_price": 100,
        "quantity": 1,
        "unit_amount": 45.60,
        "total_amount": 45.60
      },
      {
        "user_product_id": "MLBU3438878324",
        "item_id": "MLB4189327103",
        "component_price": 50,
        "quantity": 3,
        "unit_amount": 22.80,
        "total_amount": 68.40
      }
    ],
    "total_components_amount": 250
  }
}
```

con promoción aplicada

```

{
    "price_id": "16",
    "amount": 108.3,
    "regular_amount": 250,
    "currency_id": "BRL",
    "reference_date": "2025-09-17T14:48:44Z",
    "metadata": {
        "campaign_id": "C-MLB2306095",
        "promotion_id": "OFFER-MLB5663868532-11961753068",
        "promotion_type": "custom"
    },
    "bundle": {
        "components": [
            {
                "user_product_id": "MLBU3397414253",
                "item_id": "MLB4189262175",
                "component_price": 100,
                "quantity": 1,
                "unit_amount": 43.32,
                "total_amount": 43.32
            },
            {
                "user_product_id": "MLBU3403878324",
                "item_id": "MLB4189327103",
                "component_price": 50,
                "quantity": 3,
                "unit_amount": 21.66,
                "total_amount": 64.98
            }
        ],
        "total_components_amount": 250
    }
}
```

Si el kit está en una campaña promocional, el campo `amount` reflejará el precio con descuento y el `metadata` de la respuesta incluirá los detalles de la promoción (`campaign_id`, `promotion_id`, `promotion_type`).

## Campos de respuesta

- `amount`: Precio final del kit que paga el comprador. Puede incluir descuentos de promociones.

- `regular_amount`: Precio original del kit sin descuentos (precio tachado). Corresponde a la suma de los precios individuales de los componentes.

- `bundle.components`: Lista que detalla la distribución del precio para cada producto del kit.

- `component_price`: Precio de venta individual del componente, como si se vendiera por separado (incluye promociones propias del ítem).

- `unit_amount`: Valor proporcional asignado a una unidad de este componente dentro del precio final del kit. Se calcula como un porcentaje de `amount`.

- `total_amount`: Valor total asignado a todas las unidades de este componente en el kit (`unit_amount` × `quantity`).

- `total_components_amount`: Suma de los precios de venta individuales de todos los componentes (`component_price` × `quantity`). Puede diferir de `amount` si el vendedor fijó un precio manual del kit.

## Modificación del precio automático de un ítem Kit

Para modificar la automatización de precios de un kit, usá el endpoint de `bundle/prices_configuration`.

**Llamada:**

```
curl -L -X PUT https://api.mercadolibre.com/items/$ITEM_ID/bundle/prices_configuration \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{}'
```

**Body ejemplo:**

```
{
  "bundle": {
    "components": [
      {
        "type": "user_product",
        "user_product_id": "MLAU654321",
        "automatic_price": {
          "discount": 0.30
        }
      },
      {
        "type": "user_product",
        "user_product_id": "MLAU654321",
        "automatic_price": {
          "discount": 0.30
        }
      }
    ]
  }
}
```

**Respuesta:**

```
{
    "id": "MLA12345",
    "prices": [
        {
            "id": "1",
            "type": "standard",
            "amount": 50000,
            "regular_amount": null,
            "currency_id": "ARS",
            "last_updated": "2025-02-17T20:12:11Z",
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
        "display_currency": "ARS"
    },
    "payment_method_prices": [],
    "reference_prices": [],
    "purchase_discounts": [],
    "last_price_id": 1,
    "version": 4,
    "bundle": {
        "components": [
            {
                "type": "user_product",
                "user_product_id": "MLAU654321",
                "quantity": 1,
                "automatic_price": {
                    "discount": 0.30
                }
            },
            {
                "type": "user_product",
                "user_product_id": "MLAU654321",
                "quantity": 2,
                "automatic_price": {
                    "discount": 0.30
                }
            }
        ],
        "total_components_amount": null
    }
}
```

## Obtener configuración de precio de un ítem Kit

Para consultar la configuración del precio de un ítem kit podrás utilizar el siguiente recurso.

**Llamada:**

```
curl -L -X GET https://api.mercadolibre.com/items/$ITEM_ID/bundle/prices_configuration \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
"bundle": {
"components": [
                {
       		"type": "user_product", 
       		"user_product_id": "MLAU654321", 
                "quantity": 1
                },
                {
       		"type": "user_product",
       		"user_product_id": "MLAU654321", 
 	        "quantity": 2
               }
        	     ] // este ítem no tiene precio automático
      }
}
```

Para casos como este, donde el item no tiene precio automatico, el campo `automatic_price` no sera devuelto.

## Obtener detalle de venta

Cuando vendes un kit, el sistema no genera una única orden de venta. En su lugar, se crea una orden individual por cada producto componente que forma parte del kit. Todas estas órdenes están vinculadas entre sí, permitiéndote tener un control detallado del inventario y de los ingresos por cada producto. Las ventas de kits se van a ver reflejadas en una order por cada componente del kit.

**Llamada:**

```
curl -L -X GET https://api.mercadolibre.com/orders/$ORDER_ID \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
    "order_items":
    [
        {
            "item": {
                "id": "MLA333", //id del ítem componente 
		   "user_product_id": "MLA1245", //user_product_id del componente
                "title": "Coca",
                "category_id": "MLA111",
                "seller_custom_field": null,
                "warranty": "Sin garantía",
                "condition": "new",
                "seller_sku": null,
                "net_weight": null
            },
            "quantity": 6,
           "unit_price": 100,//precio del ítem componente
            "full_unit_price": 100,
            "currency_id": "ARS",
            "sale_fee": 35,
            "bundle": {	
                "parent_item": {
                    "id": "MLA666667", //item_id del kit
		       "user_product_id": "MLA8907" //user_product_id del kit
                },
                "components": null
            },
           ...
        }
           "listing_type_id": "gold_special", //listing_type_id del item kit
          "element_id": 1,    ],
          "tags":
                 [
                  "pack_order",
                  "delivered",
                  "paid",
                  "bundle_component"
               ]
}
```

## Recuperar desde una order, sus ordenes relacionadas

Si ya tienes la order_id de uno de los ítems componentes que conforman un kit, puedes utilizar el recurso /bundle para obtener todas las órdenes relacionadas, es decir, las correspondientes a los demás componentes que forman parte de la misma venta del kit.

**Llamada:**

```
curl -L -X GET https://api.mercadolibre.com/orders/$ORDER_ID/bundle \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
    "bundles": [
        {
            "pack_id": 2000009088803387,
            "shipment_id": 45452435654,
            "main_orders": [],
            "addons_orders": [],
            "kit_orders": [
                {
                    "order_id": 2000012907378394,
                    "item_id": "MLB4189327103",
                    "variation_id": null,
                    "pack_id": 2000009088803387,
                    "shipment_id": 45452435654,
                    "parent_item_id": "MLB5663868532"
                },
                {
                    "order_id": 2000012907380228,
                    "item_id": "MLB4189262175",
                    "variation_id": null,
                    "pack_id": 2000009088803387,
                    "shipment_id": 45452435654,
                    "parent_item_id": "MLB5663868532"
                }
            ]
        }
    ]
}
```

## Consultar Stock calculado del Kit

Una de las mayores ventajas de los kits es que no necesitas gestionar su stock manualmente. El sistema lo calcula y sincroniza de forma automática, asegurando que nunca vendas un kit si no tienes suficientes componentes para armarlo. 

 El stock disponible de tu kit se basa siempre en el stock de los productos que lo componen y la cantidad que se necesita de cada uno. Esto significa que el componente con la menor disponibilidad relativa será el que limite la cantidad de kits que puedes vender

**Ejemplos:**

El siguiente caso corresponde a un kit compuesto por 1 Fernet y 2 Cocas, utilizado para analizar cómo se combinan los componentes y sus ubicaciones logísticas en el cálculo de disponibilidad.

| **Fernet** | **Coca** | **Kit** |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `selling_address` | `meli_facility`  `"network_node_id": "A"` | `seller_warehouse`  `"network_node_id": "X"` | `selling_address` | `meli_facility`  `"network_node_id": "B"` | `seller_warehouse`  `"network_node_id": "Y"` | `selling_address` | `meli_facility`  `"network_node_id": null` | `seller_warehouse`  `"network_node_id": null` |
| 4 | 4 | (no existe) | 4 | 4 | (no existe) | 2 | 2 | (no existe) |
| 2 | 0 | (no existe) | 2 | 4 | (no existe) | 1 | 0 | (no existe) |
| 3 | (no existe) | (no existe) | 6 | (no existe) | (no existe) | 3 | (no lo creamos) | (no existe) |
| 2 | (no existe) | (no existe) | 4 | 2 | (no existe) | 2 | (no lo creamos) | 0 |
| (no existe) | (no existe) | 2 | (no existe) | (no existe) | 2 | (no lo creamos) | (no lo creamos) | 1 |
| (no existe) | 4 | 5 | (no existe) | 8 | 6 | (no lo creamos) | 4 | 3 |
| (no existe) | 4 | 5 | (no existe) | (no existe) | 4 | (no lo creamos) | 0 | 2 |

Nota:

Este stock representa la cantidad total de kits que pueden armarse en base a la cantidad de sus componentes que lo conforman y sin tener en cuenta la ubicación de los mismos. Si este stock pasa a ser 0, el ítem kit se pausa.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

Ejemplo producto en Full + depósito del seller

```
{
    "locations":
    [
 {
            "type": "meli_facility", //fulfillment
            "quantity": 2
        },
        {
            "type": "selling_address", //flex ó logistica base
            "quantity": 2
        }
    ],
    "user_id": 655555555,
    "id": "MLBU3333333333"
}
```

Si el stock del ítem kit pasa a ser 0, el ítem kit se pausa. En estos casos se ve un `sub_status` = `"out_of_stock"`. No hay nada particular por kits en este caso: es el comportamiento normal cuando un ítem se queda sin stock.

Para stock de UPs componentes te recomendamos revisar la documentación [gestión de stock](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido#:~:text=x%2Dversion.-,Gestionar%20stock,-La%20gesti%C3%B3n%20y).
