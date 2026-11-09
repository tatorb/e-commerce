<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen -->
<!-- Sección: Guía para productos > User Products -->

# Stock multi origen

Última actualización 15/05/2026

# Stock Multi Origen

**Importante:**

- Para poder realizar pruebas debes solicitar la ambientación de tus **usuarios de pruebas**  con [⁣este formulario](https://forms.gle/wyZxy1BoUAFRsGeB9). Dichas activaciones serán realizadas los días viernes (cada 15 días).
 - En Brasil (MLB), no es posible crear depósitos en diferentes estados. El seller solo puede crear depósitos en el mismo estado de su CNPJ. 
 - A partir de ahora al consultar la API de /users, los sellers con solo el tag **"warehouse_management"**  pueden gestionar un único depósito. Los sellers con ambos tags, **"warehouse_management"**  y **"multiwarehouse"** , pueden crear y administrar múltiples depósitos. Los sellers ya migrados a multi-origen mantienen el tag "warehouse_management" y reciben el tag adicional "multiwarehouse".

El objetivo de **Stock Multi Origen**  es representar a un vendedor que tiene múltiples ubicaciones o tiendas.

El propósito final, junto con la iniciativa de **Precios por Variación** , es permitir que los productos de un mismo vendedor tengan stock distribuido en sus diversas ubicaciones.

Se introduce el concepto de **seller_warehouse**  para representar a un vendedor que cuenta con más de una tienda o punto de venta. Además, a nivel técnico, los sellers que tienen habilitada esta funcionalidad son identificados con los tags **"warehouse_management"**  y **"multiwarehouse"**  (cuando se puede crear más de un depósito) en la API /users.

Cada vendedor puede configurar múltiples logísticas y asociarlas a diferentes ubicaciones de stock según sus necesidades. Así, un vendedor puede operar simultáneamente con varias modalidades logísticas (por ejemplo, Fulfillment, Cross Docking, Flex), gestionando de forma independiente el inventario correspondiente a cada una. Por ejemplo, un mismo vendedor puede contar con stock de Fulfillment almacenado en los centros de distribución de Mercado Libre y, al mismo tiempo, operar con stock propio en sus depósitos a través de modalidades como Cross Docking, Flex u otras logísticas habilitadas.

El modelo de Multi Origen no es compatible con publicaciones ME1. Los sellers pueden operar simultáneamente con los modelos logísticos ME1 y ME2, manteniendo ítems distintos en cada uno. Para los artículos publicados en ME1, incluso si el seller realiza una distribución de stock entre depósitos, esa información solo se considerará a efectos de registro por depósito. En el momento de la venta, el descuento de la unidad vendida se aplicará en el depósito con la mayor cantidad disponible, pero esto no implica que el envío se realizará desde ese depósito.

En esta documentación, encontrarás información importante para cada uno de los flujos que se verán impactados por esta iniciativa, comenzando por:

- Gestión de vendedores.

- Publicación de ítem con stock multi origen

- Gestión de stock por depósito

## Identificar vendedor Multi-Warehouse

**Nota:**

No todos los vendedores tendrán la funcionalidad activada en su cuenta. La activación de los vendedores será controlada y estará sujeta a criterios definidos por Mercado Libre, como el tipo de logística que operan, las direcciones desde las que despachan, entre otros.

Para identificar que el usuario tiene la funcionalidad activada en su cuenta, utilizaremos los tags **"warehouse_management"**  (experiencia multi origen) y **"multiwarehouse"**  (puede crear más de un depósito) en /users.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/users/$USER_ID -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/users/1008002397 -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "id": 1008002397,
  "nickname": "TETE9326760",
  "registration_date": "2021-10-27T14:48:55.000-04:00",
  "first_name": "Test",
  "last_name": "Test",
  "gender": "",
  "country_id": "MX",
  ...
  "tags": [
    "normal",
    "user_product_seller",
    "warehouse_management",
    "mshops"
  ],
  ...
}
```

## Gestión de depósitos

**Nota:**

La posibilidad de crear ubicaciones para un mismo **seller_id**  únicamente está disponible desde la cuenta de cada vendedor **por medio del panel de Mercado Libre** , en Ventas -> Preferencias de venta -> **Mis depósitos** .

## Búsqueda de depósitos (stores) de un usuario

Para identificar los depósitos creados por cada usuario, debes utilizar el siguiente endpoint:

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/users/$USER_ID/stores/search?tags=stock_location -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/users/1008002397/stores/search?tags=stock_location -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```

{
    "paging": {
        "limit": 50,
        "total": 2
    },
    "results": [
        {
            "id": "100",
            "user_id": "200",
            "description": "my store",
            "status": "active",
            "location": {
                "address_id": 501,
                "address_line": "Calle 31 Pte 260",
                "street_name": "Calle 31 Pte",
                "street_number": 260,
                "latitude": 21.1637963,
                "longitude": -86.8737132,
                "city": "Cancún/Benito Juárez",
                "state": "Quintana Roo",
                "country": "Mexico",
                "zip_code": "77518"
            },
            "tags": [
                "stock_location"
            ],
            "network_node_id": "123451",
            "services": {
                "stock_location": [
                    "cross_docking",
                    "xd_drop_off"
                ]
            }
        },
        {
            "id": "101",
            "user_id": "200",
            "description": "my store 2",
            "status": "active",
            "location": {
                "address_id": 502,
                "address_line": "Calle 30 Pte 300",
                "street_name": "Calle 30 Pte",
                "street_number": 300,
                "latitude": 21.1637963,
                "longitude": -86.8737132,
                "city": "Cancún/Benito Juárez",
                "state": "Quintana Roo",
                "country": "Mexico",
                "zip_code": "77518"
            },
            "tags": [
                "stock_location"
            ],
            "network_node_id": "571615",
            "services": {
                "stock_location": [
                    "drop_off",
                    "self_service"
                ]
            }
        }
    ]
}
```

## Creación de ítems Multi-Warehouse

La nueva estructura del Item, con su User Product y los Stocks Locations estará en el siguiente formato:

En donde el User Product agrupará todos los items que coincidan, basado en las reglas de UP, pero ahora también tendrá la entidad **Stock_Location**  para agrupar el stock de los items, pudiendo identificar la cantidad disponible en cada depósito (store).

Para la creación de nuevos ítems con stock asignado a los depósitos, tanto tradicionales como de catálogo en los vendedores con el tag "warehouse_management", debes utilizar el siguiente recurso:

**Nota:**

Utiliza la documentación de publicar un producto para conocer la estructura completa de publicar un Item.

**Llamada:**

```
curl POST --'https://api.mercadolibre.com/items/multiwarehouse' -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
    {
        "title": "Item Lata de tomate ",
        "category_id": "MLB455668",
        "price": 1000,
        "listing_type_id": "gold_special",
        "currency_id": "ARS",
        ...
        "channels": [
            "marketplace"
        ],
        "stock_locations": [
       {
        "store_id": "123456",
          "network_node_id": "123451",
          "quantity": 10
       }
       ...
    ] 
    }
```

**Respuesta:**

```
{
    "id": "MLM2198240631",
    "site_id": "MLM",
    "title": "Item Lata De Tomate",
    "seller_id": 123456789,
    "category_id": "MLM191212",
    "user_product_id": "MLMU123456789",
    "price": 1000,
    "base_price": 1000,
    ...
    "channels": [
        "marketplace"
    ],
    "stock_locations": [
        {
            "store_id": "123456",
            "quantity": 10,
            "network_node_id": "MXP123451"
        }
    ]
 } 
    
```

**Códigos de Estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 201 | OK | Item creado | - |
| 400 | the fields [stock_locations] are required for requested call | Campo stock_locations no encontrado en la requisición | Incluir al menos una de las tiendas del vendedor para crear el ítem |
| 400 | store does not belong to seller: 000 | El id de la tienda no pertenece al dicho usuario | Revisar las tiendas del vendedor |
| 400 | store not found: 000 | El id de la tienda no existe | Revisar las tiendas del vendedor |
| 400 | the fields [available_quantity] are invalid for requested call | El campo available_quantity no es permitido para este usuario | Una vez que el usuario tiene la etiqueta warehouse_management, ya no se puede publicar con available_quantity, debe incluir stock_locations |

**Consideraciones:**

- Tanto el **store_id**  como el **network_node_id** , van a estar en el response de la búsqueda por las tiendas del vendedor.

- Luego de la publicación, no será más posible encontrar **stock_location**  en la petición de Item, sino que debe empezar a utilizar el recurso de consulta de stock de **user_product** .

- Debes guardar el **user_product_id**  de la respuesta que será utilizado más adelante para la gestión de stock.

## Consultar detalle de stock depósitos (User Products)

Para consultar el stock de los depósitos el siguiente endpoint indicando el **user_product_id**  del Ítem creado.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/user-products/MLMU123456789/stock -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
    "locations": [
        {
            "type": "seller_warehouse",
            "network_node_id": "123451",
            "store_id": "9876543",
            "quantity": 15
        },
        {
            "type": "seller_warehouse",
            "network_node_id": "571615",
            "store_id": "9876553",
            "quantity": 25
        }
    ],
    "user_id": 1234,
    "id": "MLMU123456789"
 }
 
 
```

## Gestión de stock por ubicación

**Nota:**

En el paso anterior, al consultar el stock, se retornará el header "x-version", el cual tendrá un valor entero (tipo long) que representará la versión actual de stock. Este header debe ser enviado al realizar un PUT en /stock/. Si no se envía, retornará un error 400 bad request.

Para modificar el stock de cada depósito, deberás tener previamente el user_product_id, el store_id y el network_node_id.

El siguiente PUT cambiará el stock actual de cada depósito (store). En caso que el store tenga stock 0, se asignará la cantidad del PUT.

**Llamada:**

```
>curl -X PUT https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock/type/seller_warehouse -H 'x-version: $HEADER' -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X PUT https://api.mercadolibre.com/user-products/MLMU123456789/stock/type/seller_warehouse -H 'x-version: 1' -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d '
    {
    "locations": [
       {
        "store_id": "123456",
        "network_node_id": "MXP123451", 
          "quantity": 10
       },
       { 
        "store_id": "123457",
          "network_node_id": "MXP571615",
          "quantity": 5
       },
       { 
        "store_id": "123458",
          "network_node_id": "MXP725258",
          "quantity": 20
       }
    ]
    }
```

**Respuesta:**

```
{
    "user_id": 123456789,
    "product_release_date": null,
    "id": "MLMU123456789",
    "locations": [
        {
            "store_id": "123456",
            "network_node_id": "MXP123451",
            "type": "seller_warehouse",
            "quantity": 10
        },
        {
            "store_id": "123457",
            "network_node_id": "MXP571615",
            "type": "seller_warehouse",
            "quantity": 5
        },
        {
            "store_id": "123458",
            "network_node_id": "MXP725258",
            "type": "seller_warehouse",
            "quantity": 20
        }
    ]
 }
 
```

**Códigos de Estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 | OK | Actualización exitosa | - |
| 400 | Missing X-Version header | Header “x-version” no informado | Debes informar el Header “x-version” |
| 400 | seller with a single warehouse cannot update stock across multiple network nodes | El seller tiene configuración de depósito único y el request contiene más de un network_node_id distinto, ya sea dentro del mismo request o en combinación con las ubicaciones existentes en stock. | Verificar que todas las ubicaciones del request usen el mismo network_node_id. Un seller con depósito único solo puede operar sobre un nodo de red a la vez. |
| 409 | Version mismatch | El header “x-version” informado es incorrecto | Haz un GET en /user-product para obtener el header “x-version” actualizado |
| 400 | store does not belong to seller: 000 | El id de la store no pertenece al dicho usuario | Revisar las stores del vendedor |
| 400 | store not found: 000 | El id de la store no existe | Revisar las stores del vendedor |
| 400 | store is not configured to be a stock location | El store no está configurado para multiorigen | Indique que el vendedor revise el dicho store por el panel de Mercado Libre |
| 400 | store cannot be null or empty | Campo store no informado | Incluir al menos una de las stores del vendedor para actualizar stock del UP |

**Nota:**

Para la pos-venta, consulte la documentación de Orders y/o de Envíos para conocer pedidos con stores por el campo **"node_id"** .

**Nota:**

Para la pos-venta, consulte la documentación de Orders y/o de Envíos para conocer pedidos con stores por el campo **"node_id"** .

Próxima documentación: [Stock distribuído](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido)
