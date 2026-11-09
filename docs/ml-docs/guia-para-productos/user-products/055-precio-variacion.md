<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/precio-variacion -->
<!-- Sección: Guía para productos > User Products -->

# Precio por variación

Última actualización 13/08/2026

## Precio por variación

La iniciativa de Precio por Variación tiene como objetivo proporcionar al vendedor la capacidad de ofrecer diferentes condiciones de venta para las variantes de un mismo producto, lo que le permite aplicar sus estrategias de venta de manera más flexible y escalable.

## Activación de sellers

Importante:

Podrás realizar pruebas al solicitar la ambientación de tus usuarios de TEST con el siguiente [formulario](https://docs.google.com/forms/d/e/1FAIpQLSfC3RVMKKDrTU0vVVOC_TsbidG_ImvKMLggkB3004hrr0eMqw/viewform).

El encendido de sellers al nuevo modelo de User Products se realizará de manera gradual. Durante este proceso, coexistirán dos tipos de vendedores: aquellos que todavía no han migrado y deben continuar utilizando el modelo anterior, y aquellos que ya han sido encendidos al nuevo modelo. Los vendedores que operen bajo el nuevo sistema podrán publicar productos con distintas condiciones de venta para sus variantes. 
 Los vendedores encendidos contarán con el **tag "user_product_seller"**  el cual podrás identificar realizando un llamado al API de users.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{User_id}
```

**Respuesta:**

```

{
    "id": 206946886,
    "nickname": "TETE6838590",
    "registration_date": "2016-02-24T15:18:42.000-04:00",
    "first_name": "Pedro",
    "last_name": "Picapiedras",
    .
    .
    .
    "tags": [
        "normal",
        "test_user",
        "user_info_verified",
        "user_product_seller"
    ]
}
```

**Consideraciones post-encendido:**

El proceso de encendido de un seller al nuevo modelo consiste en activar el tag user_product_seller y posteriormente en realizar un “barrido” de ítems sin variantes a los cuales se les asignará un family_name quedando con la nueva estructura de User Products.

## Estructura de ítems

Una vez que los sellers sean activados al nuevo modelo, la estructura para publicar un ítem cambia, por lo que en caso de que no se realicen las adaptaciones necesarias dentro de la aplicación, **no será posible publicar con el modelo anterior**  ya que se obtendrá un error 400 .

Nota:

Para los integradores que sincronizan ítems, actualizan stock, precio, o resguardan en sus bases de datos información sobre los items deben tener en cuenta la nueva estructura y además recibir notificaciones de cambios por migración de ítems para mantener consistencia de información en sus bases de datos.

La siguiente tabla muestra lo que cambia en la estructura de ítems en el nuevo modelo:

| Estructura de entidad ítem | Modelo Legacy | Nuevo modelo UP |
| --- | --- | --- |
| **title** | El seller informa el atributo | Se crea automáticamente por Meli tras realizar el POST a ítems |
| **family_name** | N/A | Nuevo atributo que es una descripción genérica del ítem, que abarque a los distintos User Products de una misma familia. Se recomienda usar texto genérico y representativo de los ítems. |
| **array variations** | Contenía el detalle de cada variación | Deja de existir este array |
| **user_product_id** | N/A | Se crea automáticamente por MELi tras realizar el POST a ítems. Cuando MEli detecta que el ítem que se está publicando corresponde a un user_product_id previamente creado, lo asociará a este UP, si considera que se trata de un UP no existente, generará un nuevo user_product_id. |

Con el cambio de estructura en los ítems, y considerando que una vez que se active User Products para el vendedor, éste tendrá ítems tanto en el modelo anterior como en el nuevo, es crucial ajustar la experiencia de integración actual. Esto garantizará que, al consultar los ítems del vendedor, ambos modelos coexistan sin problemas.

Recomendamos incluir las siguientes características para los ítems del nuevo modelo de User Products dentro de la aplicación:

- Agrupar ítems por User Product.

- Agrupar User Products por familia.

- Mostrar el family_namey user_product_id de cada ítem.

- Restringir la edición del título del ítem.

- Permitir la edición del family_name del ítem.

- Al consultar un User Product, mostrar los detalles de sus variaciones.

- Permitir establecer diferentes condiciones de venta para cada variación.

Estas mejoras buscan optimizar la experiencia del usuario y facilitar la gestión de ítems bajo el nuevo sistema.

## Lógica de atributos para Família y User Products

Los atributos que pueden variar entre las variantes de un User Product están definidos por Mercado Libre a través de los llamados child PK, y dependen de la categoría o dominio en el que se publica el producto. Es fundamental que todas las variantes tengan completados de manera consistente estos atributos que permiten la variación; de lo contrario, los productos pueden quedar desagrupados fuera de la misma familia. Además, es posible asignar atributos específicos para cada variante, utilizando cualquier atributo que no sea PK (ni parent ni child), lo que permite mayor flexibilidad de información entre variantes. La lista de atributos admitidos para cada categoría y dominio puede consultarse a través de los endpoints presentes en esta [documentación](https://developers.mercadolibre.com.ar/es_ar/atributos).

## Publicar un ítem

A continuación te presentamos algunas consideraciones que debes tener en cuenta al momento de querer publicar un ítem bajo el nuevo modelo de UP. 

**El nuevo campo family_name es un campo requerido que el vendedor deberá completar** , dicho campo será una descripción genérica del ítem, que abarque a los distintos User Products de una misma familia, se recomienda usar texto genérico y representativo de los ítems, por ejemplo: 

Family name: "Apple iPhone 256GB" 
Item_1: "Apple iPhone 256GB Rojo" 
Item_2: "Apple iPhone 256GB Azul"

Nota:

El campo family_name será utilizado para el cálculo del family_id, para más detalle pueden consultar el detalle de Familia en [Conceptos importantes.](https://developers.mercadolibre.com.ar/es_ar/user-products?nocache=true#conceptos-importantes) 
El precio y las condiciones de venta pueden cambiar en cada ítem que se publica, te recomendamos consultar la sección [Precios de productos.](https://developers.mercadolibre.com.ar/es_ar/api-de-precios) 
Actualmente, cada UserProduct admite un máximo de 30 condiciones de venta (items). Intentar asociar más de 30 condiciones de venta a un mismo UP generará un error.

Adicionalmente, **el campo title no debe ser enviado por el vendedor**  ya que Mercado Libre lo completará automáticamente, con la información del ítem específico o del producto. Lo anterior se realiza con el objetivo de tener items más estandarizados, tomando como base el dominio, los atributos, el family_name, entre otros.

A modo de ejemplo, estaremos publicando dos ítems de una misma familia, comparten: family_name, dominio, condición, seller_id y GTIN.
 
Primer ítem, en color azul:

```
curl -X POST https://api.mercadolibre.com/items -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d '{
   "family_name": "Apple iPhone 256GB",
   "category_id": "MLM1055",
   "price": 17616,
   "currency_id": "MXN",
   "available_quantity": 6,
   "sale_terms": [
       {
           "id": "WARRANTY_TIME",
           "value_name": "3 meses"
       },
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía del vendedor"
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_special",
   "condition": "new",
   "pictures": [ … ],
   "attributes": [
       {
           "id": "BRAND",
           "value_name": "Apple"
       },
       {
           "id": "COLOR",
           "value_name": "Azul"
       },
       {
           "id": "GTIN",
           "value_name": "195949034862"
       },
       {
           "id": "RAM",
           "value_name": "6 GB"
       },
       {
           "id": "IS_DUAL_SIM",
           "value_name": "Sí"
       },
       {
           "id": "MODEL",
           "value_name": "iPhone 15"
       },
       {
           "id": "CARRIER",
           "value_name": "Desbloqueado"
       }
   ]
}'
```

Segundo item, en color rojo:

```
curl -X POST https://api.mercadolibre.com/items -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d '{
   "family_name": "Apple iPhone 256GB",
   "category_id": "MLM1055",
   "price": 19800,
   "currency_id": "MXN",
   "available_quantity": 8,
   "sale_terms": [
       {
           "id": "WARRANTY_TIME",
           "value_name": "3 meses"
       },
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía del vendedor"
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_special",
   "condition": "new",
   "pictures": [ … ],
   "attributes": [
       {
           "id": "BRAND",
           "value_name": "Apple"
       },
       {
           "id": "COLOR",
           "value_name": "Rojo"
       },
       {
           "id": "GTIN",
           "value_name": "195949034862"
       },
       {
           "id": "RAM",
           "value_name": "6 GB"
       },
       {
           "id": "IS_DUAL_SIM",
           "value_name": "Sí"
       },
       {
           "id": "MODEL",
           "value_name": "iPhone 15"
       },
       {
           "id": "CARRIER",
           "value_name": "Desbloqueado"
       }
   ]
}'
```

Ejemplo de respuesta para la creación de un ítem:

```
{
   "id": "MLM2061397137",
   "site_id": "MLM",
   "title": "Apple iPhone 256GB Rojo",
   "family_name": "Apple iPhone 256GB",
   "seller_id": 1008002397,
   "category_id": "MLM1055",
   "user_product_id": "MLMU367467963",
   "official_store_id": null,
   "price": 19800,
   "base_price": 19800,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "MXN",
   "initial_quantity": 8,
   "available_quantity": 8,
   "sold_quantity": 0,
   "sale_terms": [ …  ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_special",
   "start_time": "2024-05-07T12:57:08.016Z",
   "stop_time": "2044-05-02T04:00:00.000Z",
   "end_time": "2044-05-02T04:00:00.000Z",
   "expiration_time": "2024-07-26T12:57:08.119Z",
   "condition": "new",
   "permalink": "http://articulo.mercadolibre.com.mx/MLM-2061397137-apple-iphone-15-256-gb-rojo-_JM", /*el permalink va a redirigir al UPP del item*/
   "pictures": [ … ],
   "video_id": null,
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "shipping": { … },
   "international_delivery_mode": "none",
   "seller_address": { … },
   "seller_contact": null,
   "location": {},
   "geolocation": { …  },
   "coverage_areas": [],
   "attributes": [
      … 
   ],
   "warnings": [ … ],
   "listing_source": "",
   "variations": [],
   "thumbnail_id": "759471-MLA71782897602_092023",
   "thumbnail": "http://mlm-s1-p.mlstatic.com/759471-MLA71782897602_092023-I.jpg",
   "status": "active",
   "sub_status": [],
   "tags": [ … ],
   "warranty": "Garantía del vendedor: 3 meses",
   "catalog_product_id": null,
   "domain_id": "MLM-CELLPHONES",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [
      "MLM23369",
      "MLM52903"
   ],
   "automatic_relist": false,
   "date_created": "2024-05-07T12:57:08.177Z",
   "last_updated": "2024-05-07T12:57:08.177Z",
   "health": null,
   "catalog_listing": false,
   "item_relations": [],
   "channels": [
       "marketplace"
      
   ]
}
```

## Modificación de items

Para realizar cambios en los ítems existentes, deberás continuar ejecutando un [PUT al recurso /items.](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones) Mercado Libre replicará esta modificación de manera asíncrona en todos los ítems del mismo User Product, siempre y cuando se modifiquen atributos compartidos, los atributos sincronizables a nivel User Products son:

- Name (title del item)

- Family Name (family_name del item)

- Site Id (site_id del item)

- User Id (seller_id del item)

- Domain Id (domain_id del item)

- Catalog Product Id (catalog_product_id del item)

- Family Id (propio del user_product)

- Date Created (propio del user_product)

- Last Updated (propio del user_product)

- Attributes (atributos del item + attributes_combination en caso de que el user product se genere a partir de una variación del ítem)

- Pictures (pictures del item)

- Thumbnail (thumbnail del item)

- Tags (propio del user_product)

Es importante recordar que en el nuevo modelo no se permitirá la creación de variaciones mediante un llamada POST o PUT en el recurso de ítems.

## Editor de familia

Además de modificar el `family_name`, también es posible aplicar cambios que impacten en todos los miembros de una misma familia de manera simultánea, manteniendo el `family_id`. Esto permite actualizar atributos compartidos como el nombre de la familia, el dominio y los atributos de la familia (incluyendo child PKs y atributos custom), garantizando que todas las variantes del User Product permanezcan unidas.

Los atributos que se consideran de la familia son:

- **Name**  — nombre de la familia (`family_name`)

- **Domain ID**  — dominio al que pertenece la familia

- **Attributes Parent PK**  — atributos padre que definen la familia (enviados mediante `value_id` para evitar diferencias por idioma)

Solo se permite modificar child PKs y atributos custom. Es obligatorio enviar los nuevos atributos en **todos**  los miembros de la familia.

**Llamada:**

```
curl -X POST https://api.mercadolibre.com/user-products-families/{family_id}/tasks \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "common_content": {
    "family_name": "family name",
    "domain_id": "MLA-FLASK",
    "attributes": [
      {
        "id": "BRAND",
        "values": [{ "id": "999", "name": "Stanley" }]
      },
      {
        "id": "MODEL",
        "values": [{ "id": null, "name": null }]
      }
    ]
  },
  "user_products": [
    {
      "id": "MLAU1234",
      "attributes": [
        { "id": "HANDLE_MODEL", "values": [{ "id": "123123", "name": "Plastico" }] },
        { "name": "my custom attribute", "values": [{ "name": "custom" }] },
        { "id": "SOME_ATTRIBUTE", "values": [{ "id": null, "name": null }] },
        { "name": "my other custom attribute", "values": [{ "name": null }] }
      ]
    },
    {
      "id": "MLAU999",
      "attributes": [
        { "id": "HANDLE_MODEL", "values": [{ "id": "98766", "name": "Metal" }] },
        { "name": "my custom attribute", "values": [{ "name": "custom" }] },
        { "id": "SOME_ATTRIBUTE", "values": [{ "id": null, "name": null }] },
        { "name": "my other custom attribute", "values": [{ "name": null }] }
      ]
    }
  ]
}'
```

Nota:

Los atributos enviados en `common_content` se aplican a todos los UPs de la familia. Los atributos enviados dentro de cada objeto en `user_products` son específicos para ese UP en particular. No se puede enviar el mismo atributo en ambos niveles simultáneamente. Es obligatorio incluir **todos**  los `user_products` existentes en la familia en el array `user_products` del request; de lo contrario, la tarea retornará un error.

**Respuesta:**

```
{
  "task_id": "mlm_86e58b8d-78a3-43e6-a1e3-c1ffef6ea772",
  "status": "pending",
  "date_created": "2026-04-01T19:56:09.949+0000"
}
```

La tarea se procesa de manera **asíncrona** . Para consultar el resultado de la tarea, utiliza el siguiente recurso:

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/tasks/{task_id}
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "task_id": "mlm_86e58b8d-78a3-43e6-a1e3-c1ffef6ea772",
  "status": "processing",
  "user-products": [
    {
      "id": "MLAU1234",
      "status": "succeeded",
      "processed_date": "2026-04-01T19:56:10.000+0000",
      "last_updated": "2026-04-01T19:56:10.000+0000",
      "reasons": null
    },
    {
      "id": "MLAU999",
      "status": "pending",
      "processed_date": "2026-04-01T19:56:10.000+0000",
      "last_updated": "2026-04-01T19:56:10.000+0000",
      "reasons": null
    },
    {
      "id": "MLAU888",
      "status": "failed",
      "processed_date": "2026-04-01T19:56:10.000+0000",
      "last_updated": "2026-04-01T19:56:10.000+0000",
      "reasons": [
        {
          "code": "some.error",
          "message": "descriptive message",
          "type": "error",
          "cause_id": 15,
          "department": "some department"
        }
      ]
    }
  ],
  "date_created": "2026-04-01T19:56:09.949+0000",
  "last_updated": "2026-04-01T19:56:10.706+0000"
}
```

**Códigos de status de respuesta — POST:**

| Código | Descripción |
| --- | --- |
| 202 | Tarea creada exitosamente (procesamiento asíncrono) |
| 400 | Bad Request: el cuerpo de la solicitud no tiene el formato esperado, falta algún campo requerido, o algún `user_product_id` indicado no pertenece a la familia |
| 401 | Unauthorized: el token de autorización es inválido o no fue proporcionado |
| 404 | Not Found: no se encontró la familia correspondiente al `family_id` indicado |

**Códigos de status de respuesta — GET:**

| Código | Descripción |
| --- | --- |
| 200 | OK |
| 404 | Task not found |

**Códigos de error en la respuesta de la tarea:**

Los errores se informan dentro del campo `reasons`, tanto a nivel familia como a nivel UP individual:

| cause_id | code | Descripción |
| --- | --- | --- |
| 31 | `fields.to_update.missing` | No se enviaron cambios a modificar |
| 32 | `common_content.family_name.null` | El campo `family_name` no puede ser null (es opcional) |
| 33 | `common_content.domain_id.null` | El campo `domain_id` no puede ser null (es opcional) |
| 34 | `common_content.attributes.null` | El campo `attributes` em `common_content` no puede ser null (es opcional, ya que se pueden enviar los atributos directamente por UP) |
| 35 | `user_products.null` | El array `user_products` no puede ser null ni vacío |
| 36 | `user_products.id.null` | El campo `id` de los `user_products` no puede ser null |
| 37 | `user_products.attributes.null` | Los atributos de los `user_products` no pueden ser null (es opcional) |
| 38 | `user_products.incomplete` | No se enviaron todos los user_products pertenecientes a la familia |
| 39 | `user_products.family_not_exist` | No se encontró la familia |
| 40 | `user_products.attribute_id.missing` | No se envía el `attribute_id` |
| 41 | `user_products.attribute_name.missing` | No se envía el `attribute_name` |
| 42 | `user_products.attribute_values.missing` | No se envían los values de un atributo (o se envía como null o array vacío) |
| 43 | `user_products.attribute_value_id.missing` | No se envía el `value_id` del atributo |
| 44 | `user_products.attribute_value_name.missing` | No se envía el `value_name` del atributo |
| 45 | `user_products.duplicated_attribute` | Se envía al menos 2 veces el mismo atributo bajo un mismo UP |
| 46 | `user_products.update.failed` | Error inesperado — se puede analizar el mensaje para identificar la causa |
| 47 | `user_products.miss_match_attribute` | Se intenta agregar o eliminar un child_pk o custom_attribute pero no se envía para todos los UPs. Como este cambio afecta la configuración de la familia, es obligatorio enviarlo en todos los miembros. Nota: si se trata de modificar el valor de un atributo existente para un solo UP, no es obligatorio enviarlo para el resto. |
| 48 | `user_products.duplicated_attribute.by_common_content_and_by_user_product` | Se envía el mismo atributo tanto en `common_content` como por UP |
| 51 | `user_products.attributes.number_unit` | El tipo de unidad en el `value_name` de un atributo no es correcto |
| 55 | `family_id.collision` | Al actualizar el UP, su configuración resultante corresponde a otra familia. Como este recurso busca mantener el `family_id`, no se procede con el cambio en ese UP. |

## Agregar variante (UP) a una familia

Este endpoint permite crear una nueva variante dentro de una familia de User Products ya existente, sin modificar el `family_id`. Los datos de la familia (`domain_id`, `family_name` y los atributos **PARENT_PK** ) se toman automáticamente de la familia; el integrador solo debe enviar los **CHILD_PKs**  de variación, las imágenes y, opcionalmente, los `main_features`.

**Llamada:**

```
curl -X POST https://api.mercadolibre.com/user-products-families/{family_id}/user-products \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "attributes": [
    { "id": "COLOR", "values": [{ "id": null, "name": "Laranja" }] },
    { "id": "SIZE",  "values": [{ "id": null, "name": "G" }] }
  ],
  "pictures": [
    { "id": "759471-MLA71782897602_092023" }
  ],
  "main_features": [
    { "origin": "seller", "description": "Material respirável" },
    { "origin": "seller", "description": "Proteção UV" }
  ]
}'
```

### Campos del request

| **Campo** | **Requerido** | **Descripción** |
| --- | --- | --- |
| `attributes` | Sí | Array con los CHILD_PKs de variación (ej. COLOR, SIZE). Todos los CHILD_PKs definidos en la familia son obligatorios. No se permite enviar PARENT_PKs ni `domain_id`. |
| `pictures` | Sí | Al menos una imagen es requerida. |
| `main_features` | No | Lista de características destacadas. El campo `origin` debe enviarse en minúscula (`"seller"`). |

**Respuesta (201 Created):**

```
{
  "id": "MLBU4382473956",
  "name": "Boné Esportivo Dry Fit Laranja G",
  "family_name": "Boné Esportivo Dry Fit",
  "site_id": "MLB",
  "user_id": 3550453798,
  "domain_id": "MLB-HATS_AND_CAPS",
  "attributes": [
    { "id": "ITEM_CONDITION", "name": "Condição do item", "values": [{ "id": "2230284", "name": "Novo" }] },
    { "id": "MODEL",          "name": "Modelo",           "values": [{ "id": null, "name": "Dry Fit" }] },
    { "id": "BRAND",          "name": "Marca",            "values": [{ "id": null, "name": "Genérico" }] },
    { "id": "COLOR",          "name": "Cor",              "values": [{ "id": null, "name": "Laranja" }] },
    { "id": "SIZE",           "name": "Tamanho",          "values": [{ "id": null, "name": "G" }] }
  ],
  "pictures": [
    { "id": "759471-MLA71782897602_092023", "secure_url": "https://http2.mlstatic.com/D_759471-MLA71782897602_092023-O.jpg" }
  ],
  "thumbnail": {
    "id": "759471-MLA71782897602_092023",
    "secure_url": "https://http2.mlstatic.com/D_759471-MLA71782897602_092023-O.jpg"
  },
  "family_id": 1034108706118545,
  "tags": ["test", "primary"],
  "main_features": [
    { "description": "Material respirável", "origin": "seller" },
    { "description": "Proteção uv",         "origin": "seller" }
  ],
  "date_created": "2026-07-21T23:33:45.746+0000",
  "last_updated": "2026-07-21T23:33:45.746+0000"
}
```

**Códigos de status de respuesta:**

| Código | Descripción |
| --- | --- |
| 201 | Variante creada exitosamente dentro de la familia |
| 400 | Bad Request: campo requerido faltante, atributo PARENT_PK enviado, CHILD_PK de la familia faltante, campo no permitido (`domain_id`, `family_name`) o valor inválido en `main_features` |
| 401 | Unauthorized: token de autorización inválido o no proporcionado |
| 404 | Not Found: no se encontró la familia con el `family_id` indicado |

## Actualizar variante de Familia (UP)

Este endpoint permite actualizar, agregar o eliminar atributos **CHILD_PK**  o custom de las variantes (User Products) pertenecientes a una familia. La operación es **asíncrona** : el sistema genera una tarea con un `task_id` que puede consultarse para conocer el resultado final.

Nota:

Es obligatorio incluir **todos**  los User Products existentes en la familia en el array `user_products` del request; de lo contrario, la tarea retornará el error `user_products.incomplete` (cause_id 38). Además, el campo `name` es obligatorio en cada objeto del array `attributes`.

**Llamada:**

```
curl -X PUT https://api.mercadolibre.com/user-products-families/{family_id}/user-products \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "user_products": [
    {
      "id": "MLBU1234",
      "attributes": [
        { "id": "COLOR", "name": "Cor",     "values": [{ "id": null, "name": "Azul Marinho" }] },
        { "id": "SIZE",  "name": "Tamanho", "values": [{ "id": null, "name": "M" }] }
      ]
    },
    {
      "id": "MLBU5678",
      "attributes": [
        { "id": "COLOR", "name": "Cor",     "values": [{ "id": null, "name": "Laranja" }] },
        { "id": "SIZE",  "name": "Tamanho", "values": [{ "id": null, "name": "G" }] }
      ]
    }
  ]
}'
```

### Consideraciones del request

| **Tipo** | **Detalle** |
| --- | --- |
| No permitido | Enviar atributos `PARENT_PK`, `family_name`, `domain_id` ni `ITEM_CONDITION` — retorna error 400 |
| Obligatorio | Incluir **todos**  los User Products de la familia en el array `user_products` |
| Obligatorio | El campo `name` debe enviarse en cada objeto del array `attributes` |

**Respuesta (202 Accepted):**

```
{
  "task_id": "mlb_86e58b8d-78a3-43e6-a1e3-c1ffef6ea772",
  "status": "pending",
  "date_created": "2026-08-13T20:00:00.000+0000"
}
```

La tarea se procesa de manera **asíncrona** . Para consultar el resultado, utiliza el siguiente recurso:

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/tasks/{task_id} \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "task_id": "mlb_86e58b8d-78a3-43e6-a1e3-c1ffef6ea772",
  "status": "finished",
  "user-products": [
    {
      "id": "MLBU1234",
      "status": "succeeded",
      "processed_date": "2026-08-13T20:00:05.000+0000",
      "last_updated": "2026-08-13T20:00:05.000+0000",
      "reasons": null
    },
    {
      "id": "MLBU5678",
      "status": "succeeded",
      "processed_date": "2026-08-13T20:00:05.000+0000",
      "last_updated": "2026-08-13T20:00:05.000+0000",
      "reasons": null
    }
  ],
  "date_created": "2026-08-13T20:00:00.000+0000",
  "last_updated": "2026-08-13T20:00:05.000+0000"
}
```

**Códigos de status de respuesta:**

| Código | Descripción |
| --- | --- |
| 202 | Tarea creada exitosamente (procesamiento asíncrono) |
| 400 | Bad Request: se enviaron atributos `PARENT_PK`, `family_name`, `domain_id` o `ITEM_CONDITION`, o faltan campos requeridos |
| 401 | Unauthorized: token de autorización inválido o no proporcionado |
| 404 | Not Found: no se encontró la familia con el `family_id` indicado |

## Actualizar Familia

Este endpoint permite actualizar los datos comunes a todos los User Products de una familia: el `family_name`, el `domain_id` y los atributos de tipo **PARENT_PK**  (incluyendo `ITEM_CONDITION`). La actualización del documento de familia se realiza de forma **online**  (inmediata), y posteriormente los User Products se actualizan de manera **asíncrona** .

Nota:

Este recurso no es compatible con familias que contienen User Products del tipo KIT.

**Llamada:**

```
curl -X PUT https://api.mercadolibre.com/user-products-families/{family_id} \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "family_name": "Boné Esportivo Dry Fit Actualizado",
  "attributes": [
    {
      "id": "ITEM_CONDITION",
      "values": [{ "id": "2230284" }]
    },
    {
      "id": "MODEL",
      "values": [{}]
    }
  ]
}'
```

### Campos del request

| **Campo** | **Requerido** | **Descripción** |
| --- | --- | --- |
| `family_name` | No | Nuevo nombre de la familia. No puede enviarse como null ni vacío. |
| `domain_id` | No | Nuevo domain ID de la familia. No puede enviarse como null. |
| `attributes` | No | Array de atributos `PARENT_PK` o `ITEM_CONDITION` a actualizar. No se permiten atributos custom. |

Semántica de `values`:

El comportamiento del campo `values` varía según lo que se envíe: si está ausente, no se modifica el atributo; si es `null`, `[]`, `[{}]` o `[{"id":null,"name":null}]`, el atributo se elimina; si contiene un valor, el atributo se actualiza. **Atención:**  `ITEM_CONDITION` no puede eliminarse — si se envía con valores vacíos, la request es rechazada.

**Respuesta (201 Created):**

```
{
  "family_id": 1034108706118545,
  "family_name": "Boné Esportivo Dry Fit Actualizado",
  "site_id": "MLB",
  "user_id": 3550453798,
  "domain_id": "MLB-HATS_AND_CAPS",
  "attributes": [
    {
      "id": "BRAND",
      "name": "Marca",
      "values": [{ "id": null, "name": "Genérico" }],
      "hierarchy": "PARENT_PK"
    },
    {
      "id": "ITEM_CONDITION",
      "name": "Condição do item",
      "values": [{ "id": "2230284", "name": "Novo" }],
      "hierarchy": "PARENT_PK"
    }
  ],
  "child_attributes_ids": ["COLOR", "SIZE"],
  "custom_attributes_names": [],
  "date_created": "2026-07-21T22:00:00.000+0000",
  "last_updated": "2026-08-13T20:05:00.000+0000"
}
```

**Códigos de status de respuesta:**

| Código | Descripción |
| --- | --- |
| 201 | Familia actualizada exitosamente |
| 400 | Bad Request: payload sin campos a actualizar, `family_name` nulo o vacío, atributo custom en el payload, `ITEM_CONDITION` con valores vacíos, atributos duplicados o `family_id` no indicado |
| 403 | Forbidden: el `caller_id` no coincide con el `user_id` de la familia |
| 404 | Not Found: familia inexistente o sin User Products asociados |
| 409 | Conflict: familia bloqueada, o el nuevo hash ya está mapeado a otra familia |

## Obtener Familia

Permite obtener la entidad Familia con la información común a todos los User Products: `family_name`, `domain_id`, atributos **PARENT_PK** , `child_attributes_ids` y `custom_attributes_names`.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/{family_id} \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/1034108706118545 \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "family_id": 1034108706118545,
  "family_name": "Boné Esportivo Dry Fit",
  "user_id": 3550453798,
  "domain_id": "MLB-HATS_AND_CAPS",
  "attributes": [
    {
      "id": "BRAND",
      "name": "Marca",
      "values": [{ "id": null, "name": "Genérico" }],
      "hierarchy": "PARENT_PK"
    },
    {
      "id": "MODEL",
      "name": "Modelo",
      "values": [{ "id": null, "name": "Dry Fit" }],
      "hierarchy": "PARENT_PK"
    },
    {
      "id": "ITEM_CONDITION",
      "name": "Condição do item",
      "values": [{ "id": "2230284", "name": "Novo" }],
      "hierarchy": "PARENT_PK"
    }
  ],
  "child_attributes_ids": ["COLOR", "SIZE"],
  "custom_attributes_names": []
}
```

**Códigos de status de respuesta:**

| Código | Descripción |
| --- | --- |
| 200 | OK |
| 404 | Not Found: no existe la familia asociada al `family_id` indicado |

## Obtener variantes de Familia

Permite obtener la lista de User Products (variantes) asociados a una familia específica, identificada por su `family_id`.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/{family_id}/user-products \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/user-products-families/1034108706118545/user-products \
  -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "family_id": 1034108706118545,
  "user_products_ids": [
    "MLBU1234",
    "MLBU5678",
    "MLBU9012"
  ]
}
```

Nota:

Este endpoint es especialmente útil antes de ejecutar un **PUT Actualizar variante de Familia** , ya que te permite conocer todos los `user_products_ids` que deben incluirse obligatoriamente en el request.

**Códigos de status de respuesta:**

| Código | Descripción |
| --- | --- |
| 200 | OK |
| 404 | Not Found: no existe ninguna asociación para el `family_id` indicado |

## Consideraciones

**¿Qué sucede si el vendedor modifica el campo family_name?**  
Si se modifica el family_name asociado a un ítem, se recalcula el campo título del ítem y adicionalmente la modificación se replicará al User Product, lo que disparará dos posibles acciones:

- El recálculo del family_id que hará que dicho User Product se traslade a otra familia de ser necesario.

- Se replicará el nuevo family_name en todas las condiciones de venta (ítems) asociadas al User Product.

**¿Qué sucede si alguien intenta modificar el campo title del ítem?**  
Se dispara un error de tipo bad request.

- El recálculo del family_id que hará que dicho User Product se traslade a otra familia de ser necesario.

- Se replicará el nuevo family_name en todas las condiciones de venta (ítems) asociadas al User Product.

**¿Un ítem puede cambiar de familia?**  
Modificar los atributos de los ítems pueden hacer que salgan de la familia, por ejemplo, al cambiar marca, modelo, etc.

**¿El user_product_id del item puede cambiar?**  
No es un campo editable. En caso de que cambien los atributos del item, tal y como el family_name, el user_product_id continúa siendo el mismo. Solo actualizarán los atributos editados de todas las condiciones de venta conectadas a este mismu User Products.

**¿Cómo convivirá el nuevo y viejo mundo?**  
Será posible identificar los ítems bajo el nuevo modelo de User Products, a través del tag "user_product_listing"

**¿Cómo convivirá UP y catálogo?**

- Item no tiene variaciones y es (catalog_listing = true): El flujo de catálogo no se ve impactado, por lo que se crea la PDP con el catalog_product_id, para más detalle consulta [publicaciones en catalogo.](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo)

- Item no tiene variaciones y es (catalog_listing = false): Se crea la UPP (User Products Page) con el item_id y user_product_id.

## Consultar un User Product

Importante:

Ya es posible consultar el detalle de un User Product utilizando tu user test de MLA que hayas solicitado ambientar a través del [formulario](https://docs.google.com/forms/d/e/1FAIpQLSfC3RVMKKDrTU0vVVOC_TsbidG_ImvKMLggkB3004hrr0eMqw/viewform).

Podrás obtener el detalle de un User Prodcut por medio del siguiente llamado:

```
curl -X GET https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo consultando un UP específico:

```
curl -X GET https://api.mercadolibre.com/user-products/MLBU22012 -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
   "id": "MLBU22012",
   "name": "iPhone 14 Pro Max",
   "user_id": 1295303699,
   "domain_id": "MLB-CELLPHONES",
   "attributes": [
       {
           "id": "BRAND",
           "name": "Marca",
           "values": [
               {
                   "id": "123",
                   "name": "Apple",
                   "struct": null
               }
           ]
       },
       {
           "id": "MODEL",
           "name": "Modelo",
           "values": [
               {
                   "id": "123",
                   "name": "iPhone 14 Pro Max",
                   "struct": null
               }
           ]
       },
       {
           "id": "INTERNAL_MEMORY",
           "name": "Internal Memory",
           "values": [
               {
                   "id": "123",
                   "name": "10 GB",
                   "struct": {
                       "number": 10.0,
                       "unit": "GB"
                   }
               }
           ]
       },
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "values": [
               {
                   "id": "2230284",
                   "name": "Nuevo",
                   "struct": null
               }
           ]
       }
   ],
   "pictures": [
       {
           "id": "856054-MLB49741387485_042022",
           "secure_url": "https://http2.mlstatic.com/D_856054-MLA49741387485_042022-O.jpg"
       },
       {
           "id": "793512-MLB51622915557_092022",
           "secure_url": "https://http2.mlstatic.com/D_793512-MLA51622915557_092022-O.jpg"
       }
   ],
   "thumbnail": {
       "id": "856054-MLA49741387485_042022",
       "secure_url": "https://http2.mlstatic.com/D_856054-MLA49741387485_042022-O.jpg"
   },
   "catalog_product_id": "MLB19615318",
   "family_id": 18446744000000000615, /*Familia del UP*/
   "tags": [
       "test"
   ],
   "date_created": "2023-02-13T02:46:20.528+0000",
   "last_updated": "2023-02-13T02:46:20.528+0000"
}
```

## Notificaciones de familias

Notificaremos al vendedor cuando una familia sea alterada, esto se debe a que un User Product experimenta un cambio en alguno de los atributos comprometidos en el cálculo de la familia, lo que provoca que el producto migre a otra familia.

El mensaje de notificación contendrá la clave `family_id` con el ID de la familia afectada. 

 En caso de que la familia haya sido modificada, se enviará el mensaje con el ID de la nueva familia de destino. Si se crea una nueva familia (como resultado de la creación de un User Product), se incluirá el ID de la nueva familia en la notificación. Por último, si se elimina la familia original debido a que el User Product ha migrado a otra familia, se enviará el ID de la familia anterior en la notificación.

**Ejemplo:**

```

{​
"_id": "2e4f6253-ebcc-421d-9d0b-97f80290ac5d",
"topic": "user-products-families",
"resource": "/sites/$SITE_ID/user-products-families/$FAMILY_ID",
"user_id": 123456789,
"application_id": 213123389095511,
"sent": "2024-07-11T18:43:50.793Z",
"attempts": 1,
"received": "2024-07-11T18:43:50.699Z"
}
```

## Consultar los User Products de una familia

Podrás obtener los User Products asociados a una familia en particular, por medio del siguiente llamado.

```
curl -X GET https://api.mercadolibre.com/sites/$SITE_ID/user-products-families/$FAMILY_ID -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo del recurso para una familia y un site en específico:

```
curl -X GET https://api.mercadolibre.com/sites/MLA/user-products-families/9871232123 -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
   "user_products_ids": [
       "MLAU1234",
       "MLAU1235",
       "MLAU1236"
   ],
   "family_id": 9871232123,
   "site_id": "MLA",
   "user_id": 1234
}
```

## Búsqueda de items por User Product

Podrás hacer el search de ítems utilizando un filtro el campo user_product_id.

```
curl -X GET https://api.mercadolibre.com/users/$SELLER_ID/items/search?user_product_id=$USER_PRODUCT_ID -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo para un UP específico:

```
curl -X GET https://api.mercadolibre.com/users/1234/items/search?user_product_id=MLBU206642488 -H 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
   "seller_id": "1234",
   "results": [
       "MLB664681522",
       "MLB664648534",
       "MLB664648532",
       "MLB664635674"
   ],
   "paging": {
       "limit": 50,
       "offset": 0,
       "total": 4
   },
   "query": null,
   "orders": [
       … 
   ],
   "available_orders": [
      …
   ]
}
```

## Agregar condición de venta a un User Product

Una vez que tienes un User Product creado, puedes agregarle una condición de venta (ítem_id). Esto permite publicar el producto en el marketplace con precio, tipo de publicación y configuración de envío específicos.

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/items
```

### Campos permitidos

| Campo | Requerido | Descripción |
| --- | --- | --- |
| price | Sí | Precio del producto |
| category_id | Sí | ID de la categoría del sitio |
| currency_id | Sí | Moneda (ARS, MXN, BRL, etc.) |
| buying_mode | Sí | Modo de compra (buy_it_now) |
| listing_type_id | Sí | Tipo de publicación (gold_special, gold_pro, etc.) |
| shipping | No | Configuración de envío |
| channels | No | Canal de venta (marketplace) |
| tags | No | Tags adicionales |
| sale_terms | Condicional* | Términos de venta (garantía, etc.) |
| catalog_listing | No | Si es publicación de catálogo (true/false) |
| catalog_product_id | Condicional** | ID del producto de catálogo |
| official_store_id | No | ID de la tienda oficial |

**(*)**  Si el User Product tiene el atributo ITEM_CONDITION con valor "reacondicionado", deberás especificar WARRANTY_TYPE y WARRANTY_TIME en sale_terms.

**(**)**  Solo debe enviarse si catalog_listing es true.

### Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/MLMU3691277914/items -d '{
    "price": 45000,
    "category_id": "MLM37525",
    "currency_id": "MXN",
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special"
}'
```

**Respuesta (201 Created):**

```
{
    "id": "MLM2631229629",
    "site_id": "MLM",
    "title": "Boneco Funko The Office",
    "seller_id": 2378338310,
    "category_id": "MLM37525",
    "user_product_id": "MLMU3691277914",
    "price": 45000,
    "base_price": 45000,
    "currency_id": "MXN",
    "initial_quantity": 10,
    "available_quantity": 10,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "family_name": "Boneco Funko The Office",
    "family_id": 4260899048783356,
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.mx/MLM-2631229629-boneco-funko-the-office-_JM",
    "status": "active",
    "attributes": [...],
    "pictures": [...],
    "shipping": {
        "mode": "me2",
        "free_shipping": true,
        "logistic_type": "xd_drop_off",
        "tags": [
            "mandatory_free_shipping",
            "self_service_in"
        ]
    },
    "tags": [
        "cart_eligible",
        "immediate_payment",
        "test_item"
    ],
    "date_created": "2025-12-18T23:04:18.314Z",
    "last_updated": "2025-12-18T23:04:18.314Z"
}
```

### Ejemplo con catálogo

```
{
    "price": 45000,
    "catalog_listing": true,
    "category_id": "MLA8618",
    "currency_id": "ARS",
    "catalog_product_id": "MLA36975305",
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special"
}
```

### Ejemplo enviando todos los campos

```
{
    "shipping": {
        "free_shipping": true
    },
    "price": 45000,
    "catalog_listing": true,
    "channels": ["marketplace"],
    "tags": ["3x_campaign"],
    "category_id": "MLA8618",
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "value_id": "2230279",
            "value_name": "Garantía de fábrica"
        },
        {
            "id": "WARRANTY_TIME",
            "value_name": "12 meses"
        }
    ],
    "currency_id": "ARS",
    "catalog_product_id": "MLA36975305",
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "official_store_id": 134
}
```

### Campos heredados del User Product

Los siguientes campos se obtienen automáticamente del User Product y **NO deben enviarse**  en el body:

- **available_quantity** : Se asigna según el stock del User Product.

- **attributes** : Se heredan del User Product (o del catalog_product_id si catalog_listing=true).

- **pictures** : Se heredan del User Product (o del catalog_product_id si catalog_listing=true).

- **domain_id** : Se asigna el dominio del User Product.

- **family_name** : Se asigna el family_name del User Product.

- **title** : Se genera automáticamente a partir del family_name y atributos.

Nota:

El recurso responde con la misma estructura que el POST a /items. En caso de éxito, retornará un HTTP status code 201 (CREATED).

## Elegibilidad de los ítems - UPTIN

Importante:

Si deseas probar el flujo de migración (UPtin), te aconsejamos que, antes de solicitar la activación de tu usuario de prueba (TEST) mediante el [(formulario)](https://docs.google.com/forms/d/e/1FAIpQLSfC3RVMKKDrTU0vVVOC_TsbidG_ImvKMLggkB3004hrr0eMqw/viewform), generes algunos ítems de prueba utilizando el modelo anterior.

Los vendedores van a poder migrar sus ítems al nuevo modelo de precio por variación, por lo que introducimos el concepto de UPtin para referirnos al proceso de migrar un ítem que se encuentra en el modelo anterior hacia el nuevo modelo de publicación de user products.

**Consideraciones de elegibilidad:**

- Un ítem sólo será elegible para UPtin si:

- El atributo "user_product_id" del ítem orginal es diferente de nulo.

- No es un User Products duplicado, es decir, ya tenga un mismo User products creado para la misma variación.

- El ítem original es multivariante (ítems sin array de variations no son elegibles).

Para consultar la elegibilidad de los ítems antiguos para el nuevo formato de User Products, deberás utilizar el siguiente recurso.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/items/$ITEM_ORIGINAL/user_product_listings/validate -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/items/MLA12345678/user_product_listings/validate -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
  "is_valid": true/false,
  "cause": [
        {
            "code": 0000,
            "message": "Item xxxx is not allowed to migrate.",
            "reference": "item.xxx"
        },...
    ]
}
```

Los atributos indican:

- **is_valid** : true, indica que el ítem es candidato a realizar UPtin. Y false para casos donde no sin candidatos.

## Migración de ítems

La migración consistirá en crear un nuevo ítem por cada variación que contiene el ítem original, este proceso se realizará de manera asíncrona, por lo que mientras concluye la migración, el item original permanecerá activo y el seller seguirá vendiendo con dicho ítem hasta tanto se creen y activen todos los ítems de las variaciones originales.

Una vez concluída la migración, el ítem original será cerrado (status = “closed”) y tendrá el tag **variations_migration_source**  y los nuevos se aplicará el tag **variations_migration_uptin** , que servirá de indicador de que el ítem fue cerrado, o creado, por la migración. Para los tags enviaremos una notificación en el tópico de ítems en cada caso (items nuevos y item cerrado).

Importante:

Ítems recién migrados pasan por actualizaciones asíncronas del histórico visitas, ventas, opiniones sobre el producto, etc. Con lo cuál se recomienda al seller esperar algunos minutos para ver todo actualizado.

Para ejecutar el UPtin deberás utilizar el siguiente recurso, indican el ítem a migrar en el body request (deberás realizar una petición por cada ítem a migrar).

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLM/items/user_product_listings
{
"item_id": "MLM1234"
}
```

**Códigos de status de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 | OK | Petición exitosa y la migración se comenzará a realizar de manera asíncrona |  |

## Status migración

Para que puedas conocer el status de migración de cada ítem, sus variantes y los nuevos ítems creados, será posible realizarlo a través del siguiente recurso.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/items/$ITEM_ORIGINAL/migration_live_listing? -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/items/MLA123456/migration_live_listing? -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
   "item_id": "MLA123456",
   "migration_completed": null, 
   "activation_completed": null, 
   "date_created": "2024-07-30T16:22:53Z",
   "last_updated": "2024-07-30T16:22:53Z",
   "new_items": [
       {
           "new_item_id": "MLA789012",
           "variation_id": 45674567,
           "migration_status": "pending | created"
       },
       {
           "new_item_id": "MLA789022",
           "variation_id": 987654,
           "migration_status": "pending | created"
       }
   ]
}
```

**Códigos de status de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 | OK | Petición exitosa y la migración se comenzará a realizar de manera asíncrona |  |
| 404 | Error | No fue posible realizar la migración | - |

**Consideraciones:**

- **migration_completed:**  timestamp indica cuando se terminaron de **crear** todos los items hijos, luego se procede con activarlos.

- **activation_completed:**  timestamp que se setea cuando el ítem ha sido completamente migrado al nuevo esquema, es decir, todos los ítems nuevos han sido **activados**  y el ítem padre ha sido **cerrado.**

- **date_created:**  timestamp que contiene la fecha en la que comenzó el proceso de migración.

El atributo migration_completed es un timestamp que se setea cuando el ítem ha sido completamente migrado al nuevo esquema. Esta fecha indica que todos los assets de todas las variaciones se han actualizado en los nuevos ítems generados de la familia.

**No será posible realizar cambios en el ítem mientras esté en proceso de migración; recibirás un error 404.**

## Flujo de migración

Ten en cuenta el siguiente flujo que aplica para los ítems que son candidatos a migrar, es decir, ítems con array de variations y con el tag user_product_listing".

- Cuando comienza el proceso de **UPtin** , el ítem con variaciones se mantiene en status **“active”** .

- Se le agregan 2 tags de migración **“variations_migration_pending”**  y **“variations_migration_source”** .

- Por cada variación se va a crear un ítem nuevo con la configuración de la variación.

- Los nuevos ítems contarán con **family_name**  para ser agrupados por familia.

- Cada ítem nuevo se crea con status **“paused”**  y también se le agregan 2 tags de migración **“variations_migration_pending”**  y **“variations_migration_uptin”** .

- Por cada ítem que se cree se va a disparar una novedad en el **tópico**  de notificaciones de ítems.

- Cuando la migración de todos los ítems se finaliza, entonces:  Se quita el tag **“variations_migration_pending”**  del ítem antiguo quedando solamente el tag **“variations_migration_source”** . Se quita el tag **“variations_migration_pending”**  de los ítems nuevos que se crearon quedando solamente el tag **“variations_migration_uptin”** . Se activan los ítems nuevos. Se cierra el ítem viejo (status=closed).

**Detalle de los tags:**

- **variations_migration_source** : el ítem que tiene este tag fue origen del proceso de upt-in. Es un ítem con variaciones que se va a cerrar al finalizar el proceso de upt-in mediante el cual se crea un ítem nuevo por cada variación.

- **variations_migration_uptin** : el ítem que tiene este tag es resultado de un proceso de upt-in. Proviene de un ítem con variaciones que pasó por el proceso de upt-in.

- **variations_migration_pending** : se agrega tanto al ítem original como a los nuevos ítem-variación mientras se migran los assets del ítem original a los nuevos. Este tag será removido cuando finalice el proceso de upt-in.

**Siguiente** : [Stock Distribuido](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido).
