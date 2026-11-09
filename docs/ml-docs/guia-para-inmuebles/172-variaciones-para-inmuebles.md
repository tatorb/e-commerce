<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Variaciones

Última actualización 09/11/2025

## Variaciones

En Mercado Libre, una publicación de inmueble puede tener variaciones, es decir, la misma publicación se presenta con opciones diferentes en atributos como área útil, número de habitaciones o baños. Esto permite al vendedor mostrar una unidad en construcción o por construir con diversas alternativas, llamadas variaciones. Cada variación detalla una posible unidad a construir, incluyendo sus características, planos y otros detalles.

Estas variaciones se presentan únicamente para categorías y países específicos, para Argentina es **Emprendimientos (MLA401806)** , al igual que para **Uruguay (MLU455673)** , para Chile es la categoría de **Proyectos (MLC157523)** , para México es la categoría de **Emprendimientos (MLM170376)** .

Al realizar la consulta de estas categorías, por ejemplo para Argentina, con el siguiente comando curl:

```
curl --location 'https://api.mercadolibre.com/categories/MLA401806' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | String | No | Token generado en el punto 4.3 de la guía |
| CATEGORY_ID | String | No | Id de la categoría a consultar |

En la respuesta obtenida, encontrarás el atributo de ‘attribute_types’, con el valor de ‘variations’, quiere decir que en esta categoría vas a poder publicar con variaciones de los inmuebles.

Ejemplo de respuesta:

```
{
    "id": "MLA401806",
    "name": "Emprendimientos",
       "path_from_root": [
        {
            "id": "MLA1459",
            "name": "Inmuebles"
        },
        {
            "id": "MLA1472",
            "name": "Departamentos"
        },
        {
            "id": "MLA1474",
            "name": "Venta"
        },
        {
            "id": "MLA401806",
            "name": "Emprendimientos"
        }
    ],
    "children_categories": [],
    "attribute_types": "variations"
    ...
}
```

Si deseas conocer más sobre categorías, puedes consultar la sección de [categorías](https://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles).

## Publica inmuebles con variaciones

Para publicar inmuebles con variaciones con tu usuario de test debes tener en cuenta lo siguiente:

**1. Privilegios y paquetes de Desarrollo:**  Es necesario contar con algunos privilegios y tener un paquete de desarrollo, para lo cual, debes enviar el [formulario de soporte](https://forms.gle/gYLGrHurCNA1NoP87), seleccionando la opción de “Privilegios y paquete de desarrollo”, enviando el id de tu usuario para solicitar que se le asignen estos para este tipo de publicaciones.

Importante:

- Las publicaciones de inmuebles con variaciones solo se encuentran disponibles para los países de:  Argentina (MLA) Chile (MLC) México (MLM) Uruguay (MLU)

- Al activar ese tipo de paquete para un usuario, este paquete le permite realizar una sola publicación de este tipo, además no podrá contratar paquetes de publicación convencionales. Consulta la [guía de paquetes de proyectos](https://developers.mercadolibre.com.ar/es_ar/paquetes-y-permisos-para-proyectos-desarrollos-o-emprendimientos-inmobiliarios).

**2.Consulta de atributos con variaciones:**  Para publicaciones con variaciones, es imprescindible utilizar la [guía de atributos](https://developers.mercadolibre.com.ar/es_ar/atributos-inmuebles) y la [guía de localizar inmuebles](https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles). Esta guía detalla los parámetros necesarios y las variaciones aplicables a la categoría de tu publicación.

Por ejemplo, si se busca crear una publicación en Argentina (MLA) para Departamentos en venta dentro de la categoría de emprendimientos, se emplearía la categoría MLA401806. Para verificar los atributos necesarios, se utilizará el siguiente comando.

```
curl --location 'https://api.mercadolibre.com/categories/MLA401806/attributes' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Obtenemos una respuesta que incluye los atributos obligatorios y aquellos que permiten variaciones. Estos atributos se identifican por la propiedad "allow_variations": true, la cual indica cuáles atributos pueden tener variaciones, no olvides también los atributos obligatorios.

```
{
  "id": "BEDROOMS",
  "name": "Dormitorios",
  "tags": {
    "allow_variations": true,
    "required": true,
    "catalog_listing_required": true
  },
  "hierarchy": "ITEM",
  "relevance": 1,
  "value_type": "number",
  "value_max_length": 18,
  "attribute_group_id": "MAIN_CHARACTERISTICS_OF_MODEL",
  "attribute_group_name": "Características principales del modelo"
},
{
  "id": "FULL_BATHROOMS",
  "name": "Baños",
  "tags": {
    "allow_variations": true,
    "required": true,
    "catalog_listing_required": true
  },
  "hierarchy": "ITEM",
  "relevance": 1,
  "value_type": "number",
  "value_max_length": 18,
  "attribute_group_id": "MAIN_CHARACTERISTICS_OF_MODEL",
  "attribute_group_name": "Características principales del modelo"
}
```

Identificados los atributos obligatorios y con variaciones para tu publicación, arma el JSON. Incluye los atributos que varían en el arreglo attribute_combinations, y los atributos comunes en el arreglo attributes. Sigue el ejemplo a continuación.

```
{
  "listing_type_id": "gold_premium",
  "title": "Item de prueba de variations",
  "available_quantity": 4,
  "category_id": "MLA157523",
  "currency_id": "CLP",
  "condition": "new",
  "site_id": "MLA",
  "price": 100000000,
  "location": {
    "address_line": "H-20, La Estrella, O'Higgins",
    "zip_code": "",
    "neighborhood": { "id": "", "name": "" },
    "city": { "id": "TUxDQ0xBWmE0Y2Zm", "name": "Buenos aires" },
    "state": { "id": "TUxDUE9IUzFjODg", "name": "Libertador B. O'Higgins" },
    "country": { "id": "AR", "name": "Argentina" },
    "latitude": -34.2065985,
    "longitude": -71.6742634
  },
  "attributes": [
    { "id": "POSSESSION_STATUS", "value_id": "242414" },
    { "id": "PROPERTY_CODE", "value_name": "COD123456" },
    { "id": "MODEL_NAME", "value_name": "Modelo XYZ" },
    { "id": "DEVELOPMENT_NAME", "value_name": "Desarrollo ABC" },
    { "id": "COVERED_AREA", "value_name": "60 m2" },
    { "id": "UNIT_NAME", "value_name": "Unidad 101" },
    { "id": "BALCONY_AREA", "value_name": "5 m2" },
    { "id": "UNIT_FLOOR", "value_name": "3" },
    { "id": "FACING", "value_name": "N" }
  ],
  "variations": [
    {
      "attribute_combinations": [
        { "id": "TOTAL_AREA", "value_name": "60 m²" },
        { "id": "PARKING_LOTS", "value_name": "1" },
        { "id": "BEDROOMS", "value_name": "3" },
        { "id": "FULL_BATHROOMS", "value_name": "1" }
      ],
      "price": 100000000,
      "available_quantity": 4,
      "sold_quantity": 0
    },
    {
      "attribute_combinations": [
        { "id": "TOTAL_AREA", "value_name": "80 m²" },
        { "id": "PARKING_LOTS", "value_name": "2" },
        { "id": "BEDROOMS", "value_name": "4" },
        { "id": "FULL_BATHROOMS", "value_name": "3" }
      ],
      "price": 105000000,
      "available_quantity": 10,
      "sold_quantity": 0
    }
  ]
}
```

Recibirás una respuesta similar como si hubieras publicado un ítem, puedes consultarla en la guía de [publica Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble), pero en este caso la respuesta la recibirás con algunos parámetros específicos para variaciones que se explican a continuación:

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| variations | Array | Presenta un ID, además del id de publicación, para cada variación publicada, además de toda la información publicada para esta variación en específico |
| id | String | Identificador único para la variación |
| attribute_combinations | String | Atributos más detallados y relacionados a proyecto/unidad |

## Errores comunes al publicar con variaciones.

Existen algunos errores comunes al momento de publicar un inmueble con variaciones, aquí te presentamos los más comunes:

**1. Omisión de atributos obligatorios:**  Dada la diversidad de atributos disponibles para la publicación, es fácil omitir algún valor obligatorio. No obstante, la API cuenta con validaciones para identificar los campos faltantes. Ante una petición incorrecta, la respuesta arrojará un **error 400 - Bad request** . En el campo message, se listarán los atributos requeridos no proporcionados.

```
{
  "message": "Validation error",
  "error": "validation_error",
  "status": 400,
  "cause": [
    {
      "department": "items",
      "cause_id": 147,
      "type": "error",
      "code": "item.attributes.missing_required",
      "references": [ "item.attributes", "item.variations.attribute_combinations" ],
      "message": "The attributes [POSSESSION_STATUS, PROPERTY_CODE, MODEL_NAME, DEVELOPMENT_NAME, COVERED_AREA, UNIT_NAME, BALCONY_AREA, UNIT_FLOOR, FACING] are required for category MLC157523 and channel marketplace. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes."
    }
  ]
}
```

Para solventarlo, agrega los atributos mencionados en la respuesta en el cuerpo de tu llamada.

**2. Atributos mal ubicados en el JSON:**  Es posible que se incluyan atributos que no son válidos para una variante específica o en una sección incorrecta del JSON. Esto resultará en un error de la API, el cual proporcionará una retroalimentación detallada.

```
{
  "message": "Validation error",
  "error": "validation_error",
  "status": 400,
  "cause": [
    {
      "department": "items",
      "cause_id": 161,
      "type": "error",
      "code": "item.variations.variation_attributes.invalid",
      "references": [ "item.variations", "item.category_id" ],
      "message": "Attributes [POSSESSION_STATUS] are invalid in variation attributes for category MLC157523 and channels [marketplace]. Check that they exist and have the tag variation_attribute."
    }
  ]
}
```

Para solucionar esto, consulta el recurso de /attributes. Ahí podrás verificar si un atributo específico tiene el tag "allow_variations": true, lo cual indicaría si debe incluirse en el parámetro attribute_combinations o si es un atributo general de la publicación.

**3. Valor de atributo incorrecto:**  Al intentar establecer los atributos mediante el endpoint de /attributes, se deben usar los valores permitidos que se muestran en el recurso. Si se envían valores incorrectos o no autorizados, la API enviará una respuesta indicando el error detectado.

```
{
  "message": "Validation error",
  "error": "validation_error",
  "status": 400,
  "cause": [
    {
      "department": "structured-data",
      "cause_id": 3510,
      "type": "error",
      "code": "invalid.item.attribute.values",
      "references": [ "item.name" ],
      "message": "Attribute [FACING] is not valid, item values [(null:NORTE)]"
    }
  ]
}
```

**4. Quota no disponible:**  Al solicitar la activación de un paquete de desarrollo para proyectos inmobiliarios que permite publicar inmuebles con variaciones, se debe tener en cuenta que dicho paquete habilita la publicación una sola vez. Esto significa que una vez que se logre publicar un inmueble con variaciones, no será posible repetirlo hasta que se active nuevamente el paquete. En caso de intentar publicar una vez consumido el paquete, se recibirá un mensaje como el siguiente.

```
{
  "message": "Not available quota",
  "error": "bad_request",
  "status": 400,
  "cause": []
}
```

## Consulta tu publicación con variaciones

Puedes consultar las variaciones de tu ítem haciendo el siguiente llamado:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/$ITEM_ID?attributes=variations
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba” |
| ITEM_ID | String | No | Item id obtenido como respuesta al publicar el inmueble |

Recibirás un json con las variaciones de tu publicación:

```
{
  "variations": [
    {
      "item_relations": [],
      "id": 18377456123,
      "attribute_combinations": [
        {
          "value_name": "1",
          "values": [{ "id": null, "name": "1", "struct": null }],
          "value_type": "number",
          "id": "FULL_BATHROOMS",
          "name": "Baños",
          "value_id": null
        },
        {
          "values": [{ "struct": null, "id": null, "name": "3" }],
          "value_type": "number",
          "id": "BEDROOMS",
          "name": "Dormitorios",
          "value_id": null,
          "value_name": "3"
        },
        {
          "id": "PARKING_LOTS",
          "name": "Estacionamientos",
          "value_id": null,
          "value_name": "1",
          "values": [{ "id": null, "name": "1", "struct": null }],
          "value_type": "number"
        },
        {
          "values": [{
            "id": null,
            "name": "60 m²",
            "struct": { "number": 60, "unit": "m²" }
          }],
          "value_type": "number_unit",
          "id": "TOTAL_AREA",
          "name": "Superficie total",
          "value_id": null,
          "value_name": "60 m²"
        }
      ],
      "available_quantity": 4,
      "sold_quantity": 0,
      "seller_custom_field": null,
      "user_product_id": "MLCU3231182496",
      "price": 100000000,
      "sale_terms": [],
      "picture_ids": [],
      "catalog_product_id": null,
      "inventory_id": null
    }
  ]
}
```

La mayoría de atributos corresponden a como si hubieras efectuado una publicación convencional, los puedes consultar en la guía de [Publica Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble), los demás te los contamos a continuación:

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| item_relations | Array | Lista de relaciones de artículos |
| id | Número | Identificador único para la variación. |
| attribute_combinations | Array | Atributos detallados relacionados con el proyecto/unidad (ej., dormitorios, baños). |
| value_name | String | Nombre del valor para un atributo |
| values | Array | Lista de detalles de valor, incluyendo nombre y estructura. |
| value_type | String | Tipo de valor (ej., "number", "number_unit"). |
| id | String | Identificador para un atributo (ej., "FULL_BATHROOMS"). |
| name | String | Nombre de un atributo (ej., "Baños"). |
| value_id | Null | Identificador para un valor específico |
| available_quantity | Número | Número de artículos disponibles para la venta. |
| sold_quantity | Número | Número de artículos ya vendidos. |
| seller_custom_field | Null | Campo personalizado para el vendedor |
| user_product_id | String | Identificador de producto del usuario. |
| price | Número | Precio del artículo. |
| sale_terms | Array | Términos de venta para el artículo |
| picture_ids | Array | Identificadores de imágenes del artículo |
| catalog_product_id | Null | Identificador para el producto en el catálogo |
| inventory_id | Null | Identificador para el artículo en el inventario |

Si deseas consultar una variación en específico, deberás consultar tu item y hacer uso del recurso /variations agregando el id de la variación que deseas consultar, de la siguiente manera:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/$ITEM_ID/variations/$Variation_id
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Token generado. |
| ITEM_ID | String | No | Item id obtenido como respuesta al publicar el inmueble |
| Variation_id | Number | No | id de la variación a consultar |

Recibirás una respuesta tal como la descrita anteriormente, solo que con la variación específica que consultaste.

### Lecturas recomendadas

- [Actualiza las variaciones de tu inmueble.](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles)

- [Desarrollos inmobiliarios](https://developers.mercadolibre.com.ar/es_ar/desarrollos-inmobiliarios)

- [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles)

## Actualizaciones de versión

Esta sección resume el historial de cambios de la guía/API.

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
