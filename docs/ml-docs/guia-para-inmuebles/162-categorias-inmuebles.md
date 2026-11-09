<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Categorías

Última actualización 06/11/2025

## Categorías

### Categories API: descubre el tipo de propiedad y operación que necesitas para publicar

Para publicar tu inmueble correctamente, es fundamental definir tres aspectos clave, que se obtienen a partir de la categoría en la que vas a publicar:

- **Tipo de Propiedad (PROPERTY_TYPE):**  Define el tipo de inmueble que vas a ofrecer. Ejemplos: Casa, departamento, oficina, terreno, etc.

- **Tipo de Operación (OPERATION):**  Indica el tipo de transacción que estás ofreciendo. Ejemplos: Venta, alquiler, alquiler temporal.

- **Subtipo de Operación (OPERATION_SUBTYPE):**  Especifica si la propiedad es nueva o usada.

Para identificar la categoría correcta y los valores permitidos para estos atributos, sigue estos pasos:

## 1. Identifica la categoría de inmuebles por país

Para identificar la categoría a la que pertenece tu publicación, deberás ejecutar los comandos descritos específicos para tu país:

- Argentina (MLA)

- Chile (MLC)

- Uruguay(MLU)

- Colombia (MCO)

- Mexico (MLM)

- Brasil (MLB)

Nota:

Si estás trabajando en Brasil, la categoría de inmuebles se llama **"imoveis"**.****

Para obtener la lista de categorías disponibles para tu país, por ejemplo para Argentina (MLA), puedes ejecutar la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/categories
```

Ejemplo de respuesta:

```
[
    {
        "id": "MLA1747",
        "name": "Accesorios para Vehículos"
    },
    ...

    {
        "id": "MLA1459",
        "name": "Inmuebles"
    },
    ...
]
```

| Parámetro | Tipo | Valores |
| --- | --- | --- |
| `id` | String | Id de la categoría, el cual es usado para publicar |
| `name` | String | Nombre de la categoría. |

## 2. Identifica el tipo de propiedad a publicar

Para identificar el **Tipo de Propiedad (PROPERTY_TYPE)** , utiliza la API de Categorías, partiendo de la categoría de inmuebles que obtuviste previamente.

**Importante:**

Para ejecutar las consultas a la API a partir de este punto, necesitarás el access token que configuraste en los requisitos previos. Si es necesario, consulta la guía de [Autorización](https://developers.mercadolibre.cl/es_ar/autenticacion-y-autorizacion).

**Ejemplo:**  Si la categoría de inmuebles para Argentina es "MLA1459", ejecuta la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1459
```

Nota:

Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Configuración](https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos).

En la respuesta JSON, busca la propiedad **children_categories** . Esta propiedad contiene una lista de subcategorías que representan los diferentes tipos de propiedades disponibles para publicar (ej: Casas, Departamentos, oficinas, etc.).

Una vez que hayas seleccionado el Tipo de Propiedad deseado, **guarda el ID**  de la categoría correspondiente. Lo necesitarás en los siguientes pasos.

Ejemplo de respuesta:

```
{
  "id": "MLA1459",
  "name": "Inmuebles",
  "picture": "https://http2.mlstatic.com/storage/categories-api/images/cc0eed64-9cfb-4b78-9258-6266475f6427.png",
  "permalink": "https://www.mercadolibre.com.ar/c/inmuebles",
  "total_items_in_this_category": 599111,
  "path_from_root": [
    { "id": "MLA1459", "name": "Inmuebles" }
  ],
  "children_categories": [
    { "id": "MLA374730", "name": "Camas Náuticas", "total_items_in_this_category": 224 },
    { "id": "MLA1496", "name": "Campos", "total_items_in_this_category": 5133 },
    { "id": "MLA1466", "name": "Casas", "total_items_in_this_category": 173125 },
    { "id": "MLA50541", "name": "Cocheras", "total_items_in_this_category": 8850 },
    { "id": "MLA392265", "name": "Consultorios", "total_items_in_this_category": 383 },
    { "id": "MLA1472", "name": "Departamentos", "total_items_in_this_category": 221319 },
    { "id": "MLA1475", "name": "Depósitos y Galpones", "total_items_in_this_category": 10606 },
    { "id": "MLA50545", "name": "Fondo de Comercio", "total_items_in_this_category": 2251 },
    { "id": "MLA79242", "name": "Locales", "total_items_in_this_category": 18570 },
    { "id": "MLA50538", "name": "Oficinas", "total_items_in_this_category": 13851 },
    { "id": "MLA1892", "name": "Otros Inmuebles", "total_items_in_this_category": 5336 },
    { "id": "MLA105179", "name": "PH", "total_items_in_this_category": 25918 },
    { "id": "MLA50544", "name": "Parcelas, Nichos y Bóvedas", "total_items_in_this_category": 250 },
    { "id": "MLA50547", "name": "Quintas", "total_items_in_this_category": 5525 },
    { "id": "MLA1493", "name": "Terrenos y Lotes", "total_items_in_this_category": 106149 },
    { "id": "MLA50536", "name": "Tiempo Compartido", "total_items_in_this_category": 253 }
  ],
  "attribute_types": "none",
  "settings": {
    "adult_content": false,
    "buying_allowed": false,
    "buying_modes": ["classified"],
    "catalog_domain": null,
    "coverage_areas": "not_allowed",
    "currencies": ["USD", "ARS"],
    "fragile": false,
    "immediate_payment": "optional",
    "item_conditions": ["not_specified", "new", "used"],
    "items_reviews_allowed": false,
    "listing_allowed": false,
    "max_description_length": 50000,
    "max_pictures_per_item": 30,
    "max_pictures_per_item_var": 6,
    "max_sub_title_length": 70,
    "max_title_length": 200,
    "max_variations_allowed": 100,
    "maximum_price": null,
    "maximum_price_currency": "ARS",
    "minimum_price": 65,
    "minimum_price_currency": "ARS",
    "mirror_category": null,
    "mirror_master_category": null,
    "mirror_slave_categories": [],
    "price": "required",
    "reservation_allowed": "not_allowed",
    "restrictions": [],
    "rounded_address": false,
    "seller_contact": "optional",
    "shipping_options": [],
    "shipping_profile": "not_allowed",
    "show_contact_information": true,
    "simple_shipping": "not_allowed",
    "stock": "required",
    "sub_vertical": "null",
    "subscribable": false,
    "tags": [],
    "vertical": "real_estate",
    "vip_subdomain": "inmueble",
    "buyer_protection_programs": ["delivered", "undelivered"],
    "status": "enabled"
  },
  "channels_settings": [
    { "channel": "proximity", "settings": { "status": "disabled" } },
    { "channel": "mp-merchants", "settings": { "buying_modes": ["buy_it_now"], "immediate_payment": "required", "minimum_price": 0.01, "status": "enabled" } },
    { "channel": "mp-link", "settings": { "buying_modes": ["buy_it_now"], "immediate_payment": "required", "minimum_price": 0.01, "status": "enabled" } }
  ],
  "meta_categ_id": null,
  "attributable": false,
  "date_created": "2018-04-25T08:12:56.000Z"
}
```

| Parámetro | Tipo | Valores |
| --- | --- | --- |
| id | String | Id de la categoría, el cual es usado para publicar |
| name | String | Nombre de la categoría. |
| picture | String | URL de la imagen de la categoría |
| permalink | String | Enlace permanente a la categoría |
| total_items_in_this_category | Integer | Número total de ítems en esta categoría |
| path_from_root | Array | Arreglo de objetos que representan la ruta desde la raíz hasta esta categoría |
| children_categories | Array | Arreglo de objetos que representan subcategorías |
| settings | Object | Objeto que contiene configuraciones para la categoría |
| adult_content | Boolean | Indica si la categoría contiene contenido para adultos |
| buying_modes | Array | Arreglo de Strings que indican los modos de compra permitidos |
| currencies | Array | Arreglo de Strings de monedas permitidas |
| max_description_length | Integer | Longitud máxima permitida para la descripción |
| max_pictures_per_item | Integer | Número máximo de fotos por ítem |
| max_sub_title_length | Integer | Longitud máxima permitida para el subtítulo |
| max_variations_allowed | Integer | Número máximo de variaciones permitidas |
| maximum_price | Integer | Precio máximo permitido |
| maximum_price_currency | String | Moneda del precio máximo |
| minimum_price | Integer | Precio mínimo permitido |
| minimum_price_currency | String | Moneda del precio mínimo |
| price | String | Indica si el precio es "required" u "optional" |
| reservation_allowed | String | Indica si la reservación está "allowed" o "not_allowed" |
| restrictions | Array | Arreglo de restricciones |
| rounded_address | Boolean | Indica si la dirección está redondeada |
| seller_contact | String | Indica si el contacto del vendedor es "required" u "optional" |
| buyer_protection_programs | Array | Programas de protección al comprador |
| status | String | Estado de la categoría |
| channels_settings | Array | Configuración de canales |
| channel | String | Nombre del canal |
| settings | Object | Objeto de configuración para el canal específico |
| buying_modes | Array | Modos de compra permitidos para el canal |
| immediate_payment | String | Indica si el pago inmediato es "required" u "optional" |
| meta_categ_id | Null | Identificador de meta categoría |
| attributable | Boolean | Indica si es atribuible |
| date_created | String | Fecha de creación |

## 3. Identifica el tipo de operación a publicar

Para identificar el **Tipo de Operación (OPERATION)** , utiliza nuevamente la API de Categorías **/categories/${ID}** . Reemplaza el ID por el de la categoría del Tipo de Propiedad que obtuviste en el paso anterior en la petición.

**Ejemplo:**  Si seleccionaste la categoría "Casas" en Argentina (ej: "MLA1466"), utiliza la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1466
```

Nota:

Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Configuración](https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos).

En la respuesta JSON, busca nuevamente la propiedad **children_categories** . Dentro de esta propiedad, encontrarás los diferentes tipos de operaciones disponibles (ej: Arriendo, Venta, etc.).

**Guarda el ID de la categoría**  correspondiente al tipo de operación que deseas para el siguiente paso.

Ejemplo de respuesta:

```
{
  "id": "MLA1466",
  "name": "Casas",
  "picture": "https://http2.mlstatic.com/storage/categories-api/images/25ef57e2-fff4-446b-8c1e-b6bb8a76efc3.png",
  "permalink": null,
  "total_items_in_this_category": 173881,
  "path_from_root": [
    { "id": "MLA1459", "name": "Inmuebles" },
    { "id": "MLA1466", "name": "Casas" }
  ],
  "children_categories": [
    { "id": "MLA1467", "name": "Alquiler", "total_items_in_this_category": 5299 },
    { "id": "MLA50278", "name": "Alquiler Temporario", "total_items_in_this_category": 15676 },
    { "id": "MLA1468", "name": "Venta", "total_items_in_this_category": 152906 }
  ],
  "attribute_types": "none",
  "settings": { ... },
  "channels_settings": [ ... ],
  "meta_categ_id": null,
  "attributable": false,
  "date_created": "2018-04-25T08:12:56.000Z"
}
```

Los atributos de esta respuesta son similares a la respuesta anterior.

## 4. Identifica si el inmueble es nuevo o usado (subtipo de operación)

Para identificar el **Subtipo de Operación (OPERATION_SUBTYPE)** , utiliza nuevamente la API de Categorías. Reemplaza el ID de la categoría del Tipo de Operación que obtuviste en el paso anterior en la petición

**Ejemplo:**  Si seleccionaste la categoría "Venta" en Argentina (ej: "MLA1468"), ejecuta la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1468
```

Nota:

Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Configuración](https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos).

En la respuesta JSON, busca la propiedad **children_categories**  nuevamente. Dentro de esta propiedad, encontrarás los diferentes subtipos de operación disponibles para publicar (ej: Propiedades usadas, Proyectos, etc.).

**Guarda el ID**  de la categoría correspondiente al Subtipo de Operación que deseas. Este será el ID final que utilizarás para publicar el inmueble, ya que representa la categoría más específica.

Ejemplo de respuesta:

```
{
  "id": "MLA1468",
  "name": "Venta",
  "picture": null,
  "permalink": null,
  "total_items_in_this_category": 152906,
  "path_from_root": [
    { "id": "MLA1459", "name": "Inmuebles" },
    { "id": "MLA1466", "name": "Casas" },
    { "id": "MLA1468", "name": "Venta" }
  ],
  "children_categories": [
    { "id": "MLA401805", "name": "Emprendimientos", "total_items_in_this_category": 124 },
    { "id": "MLA401685", "name": "Propiedades Individuales", "total_items_in_this_category": 152081 }
  ],
  "attribute_types": "none",
  "settings": { ... },
  "channels_settings": [ ... ],
  "meta_categ_id": null,
  "attributable": false,
  "date_created": "2018-04-25T08:12:56.000Z"
}
```

Los atributos de esta respuesta son similares a las respuestas anterior.

## 5. Selección de categoría

**Importante:**

Si en la respuesta de la API la propiedad **children_categories**  no contiene información (es decir, retorna un array vacío `[]`), significa que la categoría que estás consultando actualmente es la categoría final que debes utilizar para publicar el inmueble. Por ejemplo, si no hubiera **children_categories**  al consultar "MLC5628", entonces usarás "MLC5628" para publicar.

En este ejemplo, publicaremos una propiedad usada, seleccionada a partir de la respuesta anterior. Por lo tanto, la categoría final que utilizaremos para publicar el inmueble será "MLC157520", asumiendo que este ID corresponde a "Propiedades Usadas" dentro de la categoría de "Venta" de "Casas" en Chile.

Este identificador deberá incluirse en el campo `category_id` del cuerpo de la petición que se enviará para publicar el inmueble. Listo, ya identificaste la categoría donde se publicará tu inmueble.

### Siguientes Pasos

Para realizar la publicación, también será necesario identificar otros atributos requeridos y opcionales. Así que vamos a la sección de [atributos.](https://developers.mercadolibre.com.ar/es_ar/atributos-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
