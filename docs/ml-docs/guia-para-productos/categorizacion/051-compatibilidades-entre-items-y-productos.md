<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos -->
<!-- Sección: Guía para productos > Categorización -->

# Compatibilidades entre ítems y productos de Autopartes

Última actualización 14/07/2026

## Compatibilidades entre ítems y productos de Autopartes

Importante:

- Este recurso está disponible sólo para Argentina, México, Brasil, Uruguay, Chile y Colombia. 
 - A partir de ahora ya esta disponible la gestión de compatibilidades a través del user products

Las compatibilidades permiten asociar los ítems publicados a los productos compatibles del marketplace por ejemplo, si tienes un “Amortiguador Corven Plus” publicado podrás definir atributos como Marca, Modelo, Año y Motor para los cuales este repuesto es compatible. De esta manera, mejoras la calidad de las publicaciones y reduces la cantidad de publicaciones por ítem. 
Para esto, deberás acceder al dump y verificar que el dominio de los ítems y el dominio de los productos sean compatibles. Luego, podrás agregar las compatibilidades de 3 (tres) maneras diferentes y por último, listarlas.
Si la compatibilidad no es la adecuada, podrás eliminar aquellas definidas por los usuarios (vendedores).

## Resumen de cambios del catálogo de compatibilidades

Nota:

A partir del 15/07/2026, para las compatibilidades del catálogo de Mercado Libre, la API permitirá solo lectura resumida (marca y total) y la opción de aplicar o no el 100% de las compatibilidades sugeridas; modificaciones y eliminaciones estarán disponibles únicamente desde la plataforma de Mercado Libre. Para las compatibilidades propias del vendedor no hay cambios y siguen gestionándose completamente vía API (agregar, revisar, modificar y eliminar).

A partir del 15/07/2026, la API de compatibilidades de Autopartes incorporará restricciones en la lectura y escritura de compatibilidades gestionadas por el catálogo de Mercado Libre. Los cambios aplicarán a los endpoints de listado, detalle, eliminación y copia de compatibilidades.

Nota:

Antes del 15/07/2026, el campo `source` retorna siempre **SELLER**  en todas las compatibilidades, independientemente de su origen. La distinción entre **source: SELLER**  y **source: CATALOGO**  en las respuestas estará disponible a partir de esa fecha.

**Importante:**

Estos cambios afectan únicamente a las compatibilidades gestionadas por Mercado Libre. Las compatibilidades creadas por el vendedor no tienen cambios en su comportamiento.

### 1. Nueva distinción en las respuestas: `source: SELLER` vs `source: CATALOGO`

Los endpoints de listado de compatibilidades ahora diferencian su respuesta según el origen de cada compatibilidad:

| **Campo** | **Compatibilidad creada por SELLER** | **Compatibilidad creada por MELI** |
| --- | --- | --- |
| `id` | Valor real | `null` |
| `domain_id` | Valor real | `null` |
| `catalog_product_id` | Valor real | `null` |
| `catalog_product_name` | Nombre completo del vehículo | Solo el nombre de la marca |
| `total` | No aplica | Cantidad de compatibilidades de esa marca |
| `reputation` | Objeto completo | `null` |

**Endpoints afectados:**

- `GET /items/{item_id}/compatibilities`

- `GET /items/{item_id}/compatibilities?extended=true`

- `GET /user-products/{up_id}/compatibilities`

- `GET /user-products/{up_id}/compatibilities?main_domain_id=`

**Ejemplo de respuesta:**

```
{
  "products": [
    {
      "id": "bcbd413f-cd65-0e0f-88c9-5eb4aebb5372",
      "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
      "catalog_product_id": "MLM15847548",
      "catalog_product_name": "Volkswagen Jetta 2010 GLI Manual 5",
      "source": "SELLER",
      "note": "Solo modelos de caja automática"
    },
    {
      "id": null,
      "domain_id": null,
      "catalog_product_id": null,
      "catalog_product_name": "Volkswagen",
      "source": "SELLER",
      "reputation": null,
      "total": 8
    },
    {
      "id": null,
      "domain_id": null,
      "catalog_product_id": null,
      "catalog_product_name": "Audi",
      "source": "SELLER",
      "reputation": null,
      "total": 7
    }
  ]
}
```

### 2. Parámetro `extended=true` ignorado para compatibilidades de catálogo

El parámetro `?extended=true` — que retorna el detalle de notas y restricciones de posición — solo aplica a compatibilidades con **source: SELLER** . Para compatibilidades con **source: CATALOGO** , el parámetro es ignorado y la respuesta sigue el comportamiento restringido descripto en el punto anterior.

### 3. Detalle por ID no disponible para compatibilidades de catálogo

Para el endpoint `GET /items/{item_id}/compatibilities/{compatibility_id}`, las compatibilidades con **source: CATALOGO**  retornan los campos `id` y `catalog_product_id` como `null`. No es posible consultar el detalle individual de una compatibilidad de catálogo a través de su ID.

### 4. Eliminación restringida a compatibilidades del vendedor

Los endpoints `DELETE /items/{item_id}/compatibilities` y `DELETE /items/{item_id}/compatibilities/{compatibility_id}` solo permiten eliminar compatibilidades con **source: SELLER** . Las compatibilidades con **source: CATALOGO**  no pueden eliminarse a través de la API. Su gestión debe realizarse desde Mercado Libre.

### 5. Copiar y pegar no incluirá compatibilidades de catálogo

A partir del 15/07/2026, la operación `POST /user-products/{up_id}/compatibilities/copy-paste` no copiará compatibilidades con **source: CATALOGO** . Solo se copiarán las compatibilidades creadas directamente por el vendedor (**source: SELLER** ). Hasta esa fecha, la operación copia todas las compatibilidades independientemente del origen.

## Verificar compatibilidad entre dominios

Nota:

- Antes de publicar te recomendamos **validar si la categoría del ítem contiene el atributo categories.required = true** . 

 - Una vez creada la publicación, podrás **identificar los ítems en donde es obligatorio informar compatibilidades con el atributo tag incomplete_compatibilities** . Puedes ver más detalle en [identificar ítems que requieren compatibilizarse](https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos?nocache=true#Identificar-%C3%ADtems-que-requieren-compatibilizarse).

Antes de crear compatibilidades entre ítems y productos, debes verificar que los dominios y catagorías de ítems y productos sean compatibles.

Consultando el siguiente dump, obtienes el listado de dominios y categorías en los cuales puede o necesita informar compatibilidades por site.

Llamada:

```
curl -X GET http://api.mercadolibre.com/catalog/dumps/domains/$SITE_ID/compatibilities
```

Ejemplo llamada:

```
curl -X GET https://api.mercadolibre.com/catalog/dumps/domains/MLB/compatibilities
```

Importante:

A partir de ahora, la respuesta de este endpoint incluye el atributo restrictions_required, el cual indica si es obligatorio informar posiciones para la categoría correspondiente.

Ejemplo respuesta:

```
[
[
   {
       "domain_id": "MLB-VEHICLE_ALTERNATOR_BRACKETS",
       "main": false,
       "compatibilities": [
           {
               "compatible_domain_id": "MLB-CARS_AND_VANS",
               "type": "EXTENSION",
               "categories": [
                   {
                       "id": "MLB439572",
                       "required": true,
                       "note_status": "ENABLED",
                       "restrictions_status": "ENABLED",
                       "universal_status": "DISABLED",
                       "display_new_products_status": "ENABLED",
                       "restrictions_required": false,
                       "enabled_clients": [
                           "SUPPLY"
                       ]
                   }
               ]
           }
       ]
   },
   {
       "domain_id": "MLB-AUTOMOTIVE_WIRE_HARNESSES",
       "main": false,
       "compatibilities": [
           {
               "compatible_domain_id": "MLB-CARS_AND_VANS",
               "type": "EXTENSION",
               "required": false,
               "categories": [
                   {
                       "id": "MLB431130",
                       "required": true,
                       "note_status": "ENABLED",
                       "restrictions_status": "ENABLED",
                       "universal_status": "DISABLED",
                       "display_new_products_status": "ENABLED",
                       "restrictions_required": false,
                       "enabled_clients": [
                           "SUPPLY"
                       ]
                   }
               ]
           }
       ]
   },

    …
}]
```

Los nuevos campos indican:

- **categories** : categorías que admiten la carga de compatibilidades.

- **required** : categorías en las que es obligatorio cargar compatibilidades.

- **type** : tipo de compatibilidad. Solo el tipo EXTENSION admite carga de compatibilidades.

- **note_status y restrictions_status** : indican si la categoría permite informar notas y restricciones de posición.

- **universal_status** : indica si la categoría permite informar compatibilidades universales. **ENABLED** : permite informar compatibilidades universales o **DISABLED** : no permite informar compatibilidades universales.

- **restrictions_required** : indica la obligatoriedad de informar la posición.

## Múltiples publicaciones elegibles con multiget

Obtén más información de [dominios, productos y atributos de autopartes](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes).

## Contar productos de un dominio

Para consultar la cantidad de productos existentes por dominio (familia de producto) que cumplen con determinados atributos y valores puedes realizar el siguiente POST. Esto te permitirá validar, previo a agregar las compatibilidades, la cantidad de productos y evitar errores en la asignación de compatibilidades.
Esto es importante ya que solo se pueden asignar un máximo de 200 productos por llamado.

Nota:

El límite de tráfico por APP_ID es de 100 rpm.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_compatibilities/products_search/count_family_products
{
  "domain_id": "$domainId",
  "attributes": [{
    "id": "$attributeId1",
    "value_id": "$valueId1"
  }, {
    "id": "$attributeId2",
    "value_name": "$valueName2"
  }]
}
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_compatibilities/products_search/count_family_products
{
  "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
  "attributes": [{
      "id": "BRAND",
      "value_name": "Volkswagen"
    },
    {
      "id": "CAR_AND_VAN_MODEL",
      "value_name": "VENTO"
    }
  ]
}
```

Respuesta:

```
{
   "count":141
}
```

## Identificar ítems que requieren compatibilizarse

Con el siguiente recurso a través del tag incomplete_compatibilities puedes identificar los ítems que requieren informar compatibilidades de manera obligatoria para evitar moderaciones.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1417560910
```

Respuesta:

```
{
  "id": "MLA743626587",
  "site_id": "MLA",
  "title": "Paragolpe Trasero Peugeot 307 Linea Nueva 5 Puertas",
  "seller_id": 65711207,
  "category_id": "MLA60954",
  "official_store_id": null,
.
.
.
.

  "tags": [
    "good_quality_picture",
    "brand_verified",
    "loyalty_discount_eligible",
    "good_quality_thumbnail",
    "ahora-paid-by-buyer",
    "incomplete_compatibilities",
    "immediate_payment"
  ],
  "warranty": "CON GARANTIA DEL FABRICANTE",
  "catalog_product_id": null,
  "domain_id": "MLA-VEHICLE_REAR_BUMPERS",
  "parent_item_id": null,
  "deal_ids": [
  ],
  "automatic_relist": false,
  "date_created": "2018-08-17T20:36:54.000Z",
  "last_updated": "2023-12-15T17:18:35.000Z",
  "health": 0.83,
  "catalog_listing": false
}
```

### Filtrar ítems que requieren compatibilizarse

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$SELLER_ID/items/search?tags=incomplete_compatibilities
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$SELLER_ID/items/search?tags=incomplete_compatibilities
```

Respuesta:

```
{
   "seller_id": "1373279576",
   "results": [
       "MLA1417560910",
       "MLA1373565211",
       "MLA1371734513",
       "MLA1396609243"
   ],
   "paging": {
       "limit": 50,
       "offset": 0,
       "total": 4
   },
   "query": null,
.
.
.
.
}
```

## Obtener restricciones de posiciones

Importante:

El campo **combined_values**  proporciona combinaciones predefinidas que facilitan al vendedor la selección de posiciones comunes, mejorando la experiencia de uso de la API.

El objetivo es proporcionar una lista de los valores permitidos para la restricción "POSITION", junto con las combinaciones más frecuentes, con el fin de simplificar el proceso y ayudar al vendedor. Para lograr esto, se añade una lista de combinaciones posibles (**combined_values** ). Esta API es útil para obtener las opciones de posición válidas antes de crear o actualizar productos en el catálogo de vehículos y sus accesorios.

Llamada:

```
curl --location -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/catalog_compatibilities/restrictions/values?main_domain_id=MLA-CARS_AND_VANS&secondary_domain_id=MLA-VEHICLE_ENGINE_MOUNTS'
```

Respuesta:

```
{
  "attributes_values": [
    {
      "attribute_id": "POSITION",
      "values": [
        {
          "value_id": "13373175",
          "value_name": "Conductor",
          "opposite_values": [
            "13373176"
          ]
        },
        {
          "value_id": "13373176",
          "value_name": "Acompañante",
          "opposite_values": [
            "13373175"
          ]
        }
      ],
      "combined_values": [
        {
          "values": [
            {
              "value_id": "13701104",
              "value_name": "Delantera"
            },
            {
              "value_id": "2262158",
              "value_name": "Izquierda"
            },
            {
              "value_id": "4774239",
              "value_name": "Inferior"
            }
          ]
        },
        {
          "values": [
            {
              "value_id": "13701105",
              "value_name": "Trasera"
            },
            {
              "value_id": "2262158",
              "value_name": "Izquierda"
            },
            {
              "value_id": "4774239",
              "value_name": "Inferior"
            }
          ]
        }
      ]
    }
  ]
}
```

## Filtrar ítems con posiciones incompletas

Importante:

Esta funcionalidad permite identificar productos que requieren completar su información de compatibilidad de posiciones antes de ser publicados o actualizados en el catálogo.

Para identificar y filtrar los ítems que tienen posiciones de compatibilidades incompletas, la API permite realizar búsquedas específicas utilizando el tag **incomplete_position_compatibilities** . Esta funcionalidad es útil para detectar productos que requieren completar su información de compatibilidad antes de ser publicados o actualizados en el catálogo.

Llamada:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/1871678972/items/search?tags=incomplete_position_compatibilities'
```

Respuesta:

```
{
  "seller_id": "1871678972",
  "results": [
    "MLB3845403593",
    "MLB3845392401"
  ],
  "paging": {
    "limit": 50,
    "offset": 0,
    "total": 2
  },
  "query": null,
  "orders": [
    {
      "id": "stop_time_asc",
      "name": "Order by stop time ascending"
    }
  ],
  "available_orders": [
    {
      "id": "stop_time_asc",
      "name": "Order by stop time ascending"
    },
    {
      "id": "stop_time_desc",
      "name": "Order by stop time descending"
    },
    {
      "id": "start_time_asc",
      "name": "Order by start time ascending"
    },
    {
      "id": "start_time_desc",
      "name": "Order by start time descending"
    },
    {
      "id": "available_quantity_asc",
      "name": "Order by available quantity ascending"
    },
    {
      "id": "available_quantity_desc",
      "name": "Order by available quantity descending"
    },
    {
      "id": "sold_quantity_asc",
      "name": "Order by sold quantity ascending"
    },
    {
      "id": "sold_quantity_desc",
      "name": "Order by sold quantity descending"
    },
    {
      "id": "price_asc",
      "name": "Order by price ascending"
    },
    {
      "id": "price_desc",
      "name": "Order by price descending"
    },
    {
      "id": "last_updated_desc",
      "name": "Order by lastUpdated descending"
    },
    {
      "id": "last_updated_asc",
      "name": "Order by last updated ascending"
    },
    {
      "id": "total_sold_quantity_asc",
      "name": "Order by total sold quantity ascending"
    },
    {
      "id": {
        "id": "total_sold_quantity_desc",
        "field": "sold_quantity",
        "missing": "_last",
        "order": "desc"
      },
      "name": "Order by total sold quantity descending"
    },
    {
      "id": {
        "id": "inventory_id_asc",
        "field": "inventory_id",
        "missing": "_last",
        "order": "asc"
      },
      "name": "Order by inventory id ascending"
    }
  ]
}
```

Importante:

#### Actualización en la funcionalidad de copiar y pegar compatibilidades

A partir del 1 de septiembre, modificaremos el flujo para copiar y pegar compatibilidades. Ahora, al copiar vehículos, siempre se incluirá la información de posiciones. La opción de copiar solo vehículos ha sido eliminada.

Además, mantenemos la posibilidad de elegir si deseas incluir o no las observaciones (notas) de las compatibilidades. Esto te permitirá tener mayor control sobre la información que migras entre tus publicaciones.

Con esto queremos evitar la doble carga de posiciones (en características y compatibilidades) y datos obsoletos (título y/o descripción indican info defasada).

## Identificar ítems con sugerencias de compatibilidades

Con el siguiente recurso podrás conocer el listado de todos los ítems del vendedor que tienen sugerencias de compatibilidades, es decir que tienen el tag “pending_compatibilities”.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$SELLER_ID/items/search?tags=pending_compatibilities
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1695976736/items/search?tags=pending_compatibilities
```

Respuesta:

```
{
   "seller_id": "1373279576",
   "results": [
      "MLB4462690924"
   ],
   "paging": {
       "limit": 50,
       "offset": 0,
       "total": 4
   },
   "query": null,
.
.
.
.
}
```

Con la siguiente llamada y a través del tag pending_compatibilities que se encuentra en el response, puedes identificar para un ítem en específico si tiene sugerencias de compatibilidades.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB4462690924
```

Respuesta:

```
{
  "id": "MLB4462690924",
  "site_id": "MLB",
  "title": "Pastilha Freio Dianteira Gm Blazer 4.3 V6 Mpfi 1996 À 2003 ",
  "seller_id": 1695976736,
  "category_id": "MLB439261",
  "official_store_id": null,

.
.
.
.
.
  "tags": [
    "pending_compatibilities"
  ],
 "catalog_product_id": "MLB31779615",
  "domain_id": "MLB-VEHICLE_BRAKE_PADS",
  "parent_item_id": null,
  "deal_ids": [
  ],
  "automatic_relist": false,
  "date_created": "2024-02-22T16:51:37.577Z",
  "last_updated": "2024-03-22T20:49:39.772Z",
  "health": 0.75,
  "catalog_listing": false
}
```

Filtrar ítems que tienen compatibilidades sugeridas.

## Obtener la cantidad de sugerencias y reclamos

Con el siguiente recurso podrás conocer la cantidad de sugerencias de compatibilidades y de reclamos que tiene una publicación en específico.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/catalog_domains/$DOMAIN_ID/compatibilities/cards
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d 
{
"item_id": "MLB4462690924",
"product_id": "MLB31779615",
"filters":   ["REPUTATION",   "SUGGESTED"]
}
https://api.mercadolibre.com/catalog_domains/MLB-CARS_AND_VANS/compatibilities/cards
```

### Atributos request

- **item_id** : atributo obligatorio que corresponde al identificador del ítem.

- **product_id** : atributo que corresponde al producto que está asociado al ítem, es opcional, sin embargo se mejora la performance y los tiempos de respuesta cuando dicho atributo es informado.

- **filters** : atributo obligatorio para indicar si se desean obtener la cantidad de reclamos ["REPUTATION"], la cantidad de sugerencias de compatibilidades ["SUGGESTED"] que tiene el ítem; o ambas cosas ["REPUTATION", "SUGGESTED"].

Respuesta:

```
[
   {
       "title": "Tienes 293 vehículos sugeridos pendientes por agregar",
       "subtitle": "Identificamos vehículos compatibles con tu producto que te ayudarán a vender más",
       "filter": "SUGGESTED",
       "quantity": 293
   },
   {
       "title": "Vehículos con reclamos por incompatibilidad",
       "subtitle": "Revisalos y eliminalos para evitar nuevos reclamos.",
       "filter": "REPUTATION",
       "quantity": 1
   }
]
```

**Reputation** : son todas las compatibilidades que están generando reclamos.

**Suggested** : son todos los casos de compatibilidades nuevas sugeridas a sus publicaciones.

Si quieres conocer cómo obtener las compatibilidades sugeridas para cada ítem puedes ver más detalle en [identificar compatibilidades sugeridas](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes#Identificar-compatibilidades-sugeridas).

Si quieres conocer cuáles son las compatibilidades problemáticas que están generando reclamos y afectando la reputación del vendedor seller puedes ver más detalle en [Conocer compatibilidades que generan reclamos](https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos#Conocer-compatibilidades-que-generan-reclamos).

## Agregar compatibilidades

Nota:

- Disponibilizamos todas las funcionalidades de compatibilidades en las publicaciones de autopartes de las categorías [MLA1747](https://api.mercadolibre.com/categories/MLA1747), [MLM1748](https://api.mercadolibre.com/categories/MLM1748), [MLB22693](https://api.mercadolibre.com/categories/MLB22693), [MLU1748](https://api.mercadolibre.com/categories/MLU1748) ,[MLC1748](https://api.mercadolibre.com/categories/MLC1748) y [MCO87919](https://api.mercadolibre.com/categories/MCO87919). 
 
 -En los sites de MLA, MLM, MLB, MLU, MLC y MCO **deberán informar compatibilidades de manera obligatoria en los ítems marcados con el tag incomplete_compabilities**  para evitar que las publicaciones de autopartes sean pausadas.

Para agregar compatibilidades de un ítem con un producto y/o dominio podrás consultar hasta un máximo de 200 productos por llamado (incluidos los definidos en los dominios) y hacerlo de 3 maneras diferentes:

- **Por producto** : para agregar nuevas compatibilidades a un ítem debes enviar las compatibilidades que quieras añadir. No es necesario enviar las existentes para mantener las actuales.

- **Por dominio de producto** : puedes especificar un conjunto de atributos que definen el dominio de productos. Para cada dominio, debes especificar su dominio y para cada atributo, un value conformado por id y/o name.

- **Por producto y dominio** : puedes agergar compatibilidades a un ítem publicado de otro producto y una dominio de productos, es decir, te permite agregar de manera conjunta las 2 primeras.

Nota:

El límite de tráfico por APP_ID es de 100 RPM (request por minuto).

## Valores posibles para una restricción de posición

Al agregar una compatibilidad también podrás indicar la restricción de posición de la misma, con la siguiente llamada podrás conocer los valores posibles para informarla.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_compatibilities/restrictions/values?main_domain_id=MLA-CARS_AND_VANS&secondary_domain_id=MLA-VEHICLE_SHOCK_ABSORBERS
```

Respuesta:

```
{
      "attributes_values": [   
          {
               "attribute_id": "POSITION",
               "values":
                [
                    {
                        "value_id": "23536",
                        "value_name": "Superior",
                    },
                    {
                        "value_id": "23537",
                        "value_name": "Inferior"
                    }
               ]
         }
    ]
}
```

Importante:

**El atributo **creation_source**  ahora es obligatorio en todas las solicitudes de creación de compatibilidades.**

Este atributo indica el origen de las compatibilidades creadas, con los siguientes valores permitidos:

- **ITEM_SUGGESTIONS:**  Compatibilidades generadas por [sugerencias](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes#:~:text=%3A%201%0A%7D-,Identificar%20compatibilidades%20sugeridas,-Para%20poder%20mantener).

- **NEW_VEHICLES:**  Compatibilidades con [vehículos nuevos.](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes#:~:text=%3A%20180%0A%7D-,Identificar%20veh%C3%ADculos%20nuevos,-Para%20poder%20mantener).

- **DEFAULT:**  Valor por defecto cuando no se utiliza un filtro específico.

**Casos afectados:**

- Agregar compatibilidad por producto, dominio o ambos.

- Actualizar compatibilidades.

**Casos no afectados:**

- Copiar y pegar compatibilidades.

- Agregar compatibilidad universal.

### Agregar compatibilidad por producto

Para agregar una compatibilidad a uno o varios productos individuales, puedes [utilizar el product search](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes#Product-search).

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products": [{
       "id": "$PRODUCT_ID",
       "creation_source": "$CREATION_SOURCE",
       "note": "texto",
       "restrictions": [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      },
                      {
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}, 
                                  {"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      }
                    ]
                }]
   }]
}'
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products": [{
       "id": "MLB155254",
         "creation_source": "ITEM_SUGGESTIONS",
       "note": "Modelos posteriores a Mayo de 2018",
       "restrictions": [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "12456","value_name": "Delantero"}]
                      },
                      {
                        "values":[{"value_id": "65432","value_name": "Trasero"}, 
                                  {"value_id": "87675","value_name": "Inferior"}]
                      }
                    ]
                }]
   }]
}
```

Respuesta:

```
{
 "created_compatibilities_count": 72
}
```

También es posible agregar una nota y restricción de posición a más de una compatibilidad, para esto es necesario reemplazar el nodo **products**  por **products_group** , ejemplo:

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products_group": [{
       "ids": ["MLB155254", "MLB155255"],
        "creation_source": "ITEM_SUGGESTIONS"
       "note": "texto",
       "restrictions": [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      },
                      {
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}, 
                                  {"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      }
                    ]
                }]
   }]
}
```

### Agregar compatibilidad por dominio

Para agregar compatibilidades definidas por los atributos que determinan un dominio, [conoce los dominios y atributos de autopartes](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes#Atributos-por-dominos).

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products_families": [{
       "domain_id": "$DOMAIN_ID",
    "creation_source": "$CREATION_SOURCE",
       "attributes": [{
               "id": "$ATTRIBUTE_ID",
               "value_id": "$VALUE_ID"
           },
           {
               "id": "$ATTRIBUTE_ID",
               "value_id": "$VALUE_ID"
           },
       ],
     "note": "Texto",
     "restrictions":
                [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      },
                      {
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}, 
                                  {"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      }
                    ]
                }]
}
```

Ejemplo (excepto MLM):

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA794706391/compatibilities
{
   "products_families": [{
       "domain_id": "MLA-CARS_AND_VANS",
       "creation_source": "ITEM_SUGGESTIONS",
       "attributes": [{
               "id": "BRAND",
               "value_id": "60249"
           },
           {
               "id": "YEAR",
               "value_name": "2010"
           },
       ],
     "note": "Solamente para vehículos de fabricación Europea",
     "restrictions":
                [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "12456","value_name": "Delantero"}]
                      },
                      {
                        "values":[{"value_id": "65432","value_name": "Trasero"}, 
                                  {"value_id": "87675","value_name": "Inferior"}]
                      }
                    ]

                }]
}
```

Respuesta:

```
{
 "created_compatibilities_count": 23
}
```

Ejemplo MLM:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities
{
   "products_families": [{
           "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
       "creation_source": "ITEM_SUGGESTIONS"
           "attributes": [{
                   "id": "DRIVE_TYPE",
                   "value_id": "8182649"
                  
               },
               {
                   "id": "CAR_AND_VAN_BODY_TYPE",
                   "value_id": "8183109"
                  
               },
               {
                   "id": "YEAR",
                   "value_name": "2010"
                  
               }
           ],
     "note": "Solamente para vehículos de fabricación Europea",
     "restrictions":
                [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "12456","value_name": "Delantero"}]
                      },
                      {
                        "values":[{"value_id": "65432","value_name": "Trasero"}, 
                                  {"value_id": "87675","value_name": "Inferior"}]
                      }
                    ]
       }
   ]
}
```

Respuesta:

```
{
 "created_compatibilities_count": 23
}
```

### Agregar por producto y dominio de productos

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products": [{
       id": "$PRODUCTIID",
        "creation_source": "$CREATION_SOURCE",
       "note": "texto",
       "restrictions": [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      },
                      {
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}, 
                                  {"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      }
                    ]
   }],
   "products_families": [{
       "domain_id": "$DOMAIN_ID",
       "attributes": [{
               "id": "ATTRIBUTE_ID",
               "value_id": "$VALUE_ID"
           },
           {
               "id": "ATTRIBUTE_ID",
               "value_id": "$VALUE_ID"
           },
       ],
     "note": "Texto",
     "restrictions":
                [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      },
                      {
                        "values":[{"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}, 
                                  {"value_id": "$VALUE_ID","value_name": "$VALUE_NAME"}]
                      }
                    ]
                }]
}
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities
{
   "products": [{
       "id": "MLB155254",
     "creation_source": "ITEM_SUGGESTIONS",
       "note": "Modelos posteriores a Mayo de 2018",
       "restrictions": []
   }],
   "products_families": [{
       "domain_id": "MLB-CARS_AND_VANS",
       "attributes": [{
               "id": "BRAND",
               "value_id": "60249"
           },
           {
               "id": "YEAR",
               "value_name": "2010"
           },
       ],
     "note": "Solamente para vehículos de fabricación Europea",
     "restrictions":
                [{
                    "attribute_id": "POSITION",
                    "attribute_values":
                    [{
                        "values":[{"value_id": "12456","value_name": "Delantero"}]
                      },
                      {
                        "values":[{"value_id": "65432","value_name": "Trasero"}, 
                                  {"value_id": "87675","value_name": "Inferior"}]
                      }
                    ]
                }]
}
```

En el campo **note**  permitimos hasta 500 caracteres y el texto es moderado.

Respuesta:

```
{
 "created_compatibilities_count": 23
}
```

### Agregar por user products

Para crear las compatibilidades asociadas al UP el campo **domain_id**  en el body es requerido y debe enviarse siempre por fuera de las listas de **products_families**  y **products** .

Ejemplo:

```
curl --location 'https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities' \
--header 'Content-Type: application/json' \
--data '{ 
    "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
    "category_id": "MLM12344"
    "products": [
        {
            "id": "MLM15870230",
            "note": "nota sobre la compats",
            "restrictions": [
                {
                    "attribute_id": "POSITION",
                    "attribute_values": [
                        {
                            "values": [
                                {
                                    "value_id": "13701104",
                                    "value_name": "Delantero"
                                },
                                {
                                    "value_id": "2262158",
                                    "value_name": "Izquierdo"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    "products_families": [
        {
     "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
            "attributes": [
                {
                    "id": "BRAND",
                    "value_id": "60249"
                },
                {
                    "id": "YEAR",
                    "value_name": "2010"
                },
                {
                    "id": "CAR_AND_VAN_MODEL",
                    "value_id": "8240568"
                },
                {
                    "id": "CAR_AND_VAN_SUBMODEL",
                    "value_id": "8238217"
                }
            ]
        }
    ]
}
```

Respuesta:

```
{
 "created_compatibilities_count": 23
}
```

### Posibles errores

**400** : validaciones de consistencia:

- Los campos obligatorios están incompletos.

- El formato de los ids es incorrecto.

- Se encontraron y/o especificaron más de 200 productos para los dominios de productos.

- Se especificaron más de 10 dominios de productos.

- Los productos y/o dominios no pertenecen al mismo site que el ítem.

- Los productos deben ser todos hijos.

- El dominio del ítem es compatible con los dominios de los productos especificados y/o con los dominios especificados en los dominos de productos especificadas.

- No puede haber más de 4 posiciones configuradas en una restricción de posición.

- Cada restricción puede tener máximo 4 ids.

- Los ids deben pertenecer al conjunto cerrado de ids definidos.

- La combinación de valores debe ser única, es decir no puede haber dos listas de ids iguales dentro de una restricción.

- La categoría del ítem debe tener habilitadas las notas y restricciones.

- La nota no puede superar los 500 caracteres.

**403** :token inválido o falta de permisos sobre el ítem.

**404** :o existe el ítem, los productos o los dominios especificados.

## Copiar y pegar compatibilidades

**Importante:**

A partir del 15/07/2026, las compatibilidades creadas por el catálogo de Mercado Libre (**source: CATALOGO** ) no podrán copiarse a través de la API. Solo se copiarán las compatibilidades creadas directamente por el vendedor (**source: SELLER** ). Hasta esa fecha, la operación copia todas las compatibilidades independientemente del origen.

El primer paso para copiar las compatibilidades es obtener una lista de los ítems activos que cuenten con compatibilidades configuradas. Para ello, es necesario comenzar obteniendo todos los ítems activos del vendedor mediante la siguiente consulta:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/users/$USER_ID/items/search?status=active&has_compatibilities=true'
```

Todos los items deben conter el atributo "HAS_COMPATIBILITIES".

Para obtener el listado de ítems con la cantidad de compatibilidades, notas y posiciones, realice la siguiente llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/compatibilities_summary
{
   "domain_id": "$domainId",
   "items": [
       "$item_id",
       "item_id",
       "item_id"
   ]
}
'
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN 'https://api.mercadolibre.com/items/compatibilities_summary' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
   "domain_id": "MLB-CARS_AND_VANS",
   "items": [
       "MLB4816242302",
       "MLB3845318745",
       "MLB3845318797"
   ]
}
```

Respuesta:

```
[
   {
       "item_id": "MLB4816242302",
       "item_title": "Pastilha Dianteira Anuncio De Teste 2",
       "compatibilities_count": 1001,
       "compatibilities_claims_count": 0,
       "notes_count": 65,
       "restrictions_count": 64
   },
   {
       "item_id": "MLB3845318797",
       "item_title": "Pastilha Dianteira Anuncio De Teste",
       "compatibilities_count": 400,
       "compatibilities_claims_count": 0,
       "notes_count": 64,
       "restrictions_count": 64
   },
   {
       "item_id": "MLB3845318745",
       "item_title": "Pastilha Dianteira Anuncio De Teste",
       "compatibilities_count": 200,
       "compatibilities_claims_count": 0,
       "notes_count": 64,
       "restrictions_count": 64
   }
]
```

Nota:

- El límite de la cantidad de ítems a recibir será de 10 ítems.
 - El campo “compatibilities_count” contara todas las compatibilidades que tiene el ítem incluyendo las que tienen claims.

Para copiar las compatibilidades de un ítem para un ítem sin compatibilidades cargadas, haga esta llamada:

Nota:

En los dos métodos de POST y PUT se agrega un nuevo campo tipo objeto **“item_to_copy”** , que indicará que va a copiar las compatibilidades del ítem especificado y tomará en cuenta si debe o no copiar las notas y restricciones mediante el campo **“extended_information”** . 
 Los campos: **products, products_families, products_group y universal** , no estarán como requeridos para estos casos que se quieran crear o editar ítems mediante el copiar y pegar.

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN 'https://api.mercadolibre.com/items/$ITEM_ID/compatibilities' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
   "item_to_copy": {
       "item_id": "$ITEM_ID",
       "extended_information": true
   }
}'
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/items/MLB3863097751/compatibilities' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
   "item_to_copy": {
       "item_id": "MLB4816242302",
       "extended_information": true
   }
}'
```

Respuesta:

```
200 OK
```

Para copiar las compatibilidades de un ítem para un ítem que ya tiene compatibilidades cargadas, haga esta llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN 'https://api.mercadolibre.com/items/$ITEM_ID/compatibilities' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
 "create": {
   "item_to_copy": {
     "item_id": "$ITEM_ID",
     "extended_information": true
   }
 }
}
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/items/MLB3863034063/compatibilities' \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
 "create": {
   "item_to_copy": {
     "item_id": "MLB4816242302",
     "extended_information": true
   }
 }
}
'
```

Respuesta:

```
{
   "create": {
       "products": [
           {
               "id": "MLB7864691",
               "note": "frente",
               "restrictions": [
                   {
                       "attribute_id": "POSITION",
                       "attribute_code": 1,
                       "attribute_values": [
                           {
                               "values": [
                                   {
                                       "value_id": "13701104",
                                       "value_code": 5
                                   }
                               ]
                           }
                       ]
                   }
               ]
           },
                          
.
.
.
       "universal": false,
       "item_to_copy": {
           "item_id": "MLB4816242302",
           "extended_information": true
       }
   }
}
```

### Copiar y pegar compatibilidades por User Products

Para copiar compatibilidades para un user product se debe indicar el origen de las compatibilidades (ya sea desde un ítem o un user product) y, opcionalmente, si se desea copiar también las notas y restricciones, se debe utilizar el campo `"extended_information"`.

Reglas para los campos:

- Si se desea copiar desde un **User Product** , deben completar el campo `"user_product_id"` con el ID correspondiente y enviar el campo `"item_id"` como `null`.

- Si se desea copiar desde un **ítem** , deben completar el campo `"item_id"` y enviar `"user_product_id"` como `null`.

**Importante:**  No se deben completar ambos campos al mismo tiempo. Solo uno debe tener valor y el otro debe ser `null`.

Ejemplo copiar compatibilidades de un user product a un user product :

```
curl --location curl -X POST \
'https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities/copy-paste' \
  -H 'content-type: application/json' \
  -d '{
       "domain_id": "MLB-CARS_AND_VANS",
       "category_id": "MLB12344",
       "user_product_id": "MLBU1552549",
       "extended_information": true
}
```

Ejemplo copiar compatibilidades de un item a un user product:

```
curl --location curl -X POST \
'https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities/copy-paste' \
  -H 'content-type: application/json' \
  -d '{
       "domain_id": "MLB-CARS_AND_VANS",
       "category_id": "MLB12344",
       "item_id": "MLB1552432",
       "extended_information": true
}
```

Respuesta:

```
200 OK
```

### Consideraciones

En la publicación de destino, hay dos escenarios:

- **Sin compatibilidades** : Copia todas las compatibilidades de la publicación de origen. **Con compatibilidades** : Realiza un cruce entre las dos publicaciones y copia solo los vehículos de la publicación de origen que aún no están en la de destino.

No se copiarán compatibilidades que tengan reclamos, es decir, se excluyen en el proceso de guardar.

Notas y Posiciones: El servicio del POST, PUT para crear compatibilidades recibirá la opción de copiar solo la compatibilidad o la compatibilidad más las notas y restricciones.

Si el ítem de origen supera las 6K compatibilidades, se generará una excepción de límite al publicar/modificar. En las modificaciones, se debe considerar la intersección de compatibilidades entre los ítems. Por ejemplo, si el ítem de origen tiene 5K y el ítem destino 2K, y 1K son compatibilidades comunes, solo se copiarán 4K del ítem de origen al ítem destino.

En los servicios PUT y POST, se guardarán de forma síncrona hasta 200 compatibilidades, mientras que el resto se creará de forma asíncrona para evitar problemas de rendimiento. Esto puede generar demoras en ver todas las compatibilidades creadas, por lo que se debe notificar al seller sobre esta posibilidad.

## Agregar una compatibilidad universal

Nota:

En este momento, esta funcionalidad no está disponible en producción.

Con el objetivo de mejorar la calidad de las publicaciones de autopartes de las categorías de accesorios para autos y camionetas ([MLA6520](https://api.mercadolibre.com/categories/MLA6520), [MLM5320](https://api.mercadolibre.com/categories/MLM5320), [MLU1747](https://api.mercadolibre.com/categories/MLU1747), [MLB1747](https://api.mercadolibre.com/categories/MLB1747)) se podrán informar **compatibilidades universales**  para indicar que un ítem es compatible con cualquier producto.

Para indicar que un ítem es compatible con cualquier producto, dentro de la petición, se cuenta con el campo **universal** , el cual deberá ser informado en **true** . Lo anterior indica que este ítem es universal (por lo tanto no se le debe de agregar compatibilidades dado que es compatible con todos los productos dentro del mismo dominio).

Al indicar una compatibilidad universal, no es posible especificar **productos ni familias** . En caso de que se envíen ambos campos se obtendrá un error.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
{
   "products": [],
   "products_families": [],
   "products_group": [],
   "universal": true
}
```

Ejemplo:

```
curl -X PUT -H ' https://api.mercadolibre.com/items/MLM12456789/compatibilities
{
   "products": [],
   "products_families": [],
   "products_group": [],
   "universal": true,
}
```

Respuesta:

```
{
 "created_compatibilities_count": 1
}
```

### Posibles errores al asignar compatibilidades universales

**400** : validaciones de consistencia:

En caso de que se envíen productos y familias al mismo tiempo que se informa una compatibilidad universal, se obtendrá:

- Message: "Invalid arguments for specific request. Please check details to satisfy validations". Details: "at least one of products, products_groups, products_families or universal must be specified, if universal no products can be specified".

En el caso que se tenga alguna compatibilidad en el ítem registrada anteriormente y se intenta volver universal, se obtendrá:

- Message: Item has compatibilities and these must be removed before setting it as universal.

Cuando se intenta generar un ítem universal pero la categoria no esta habilitada para esta experiencia, se obtendrá:

- Message: There is no configured compatibility for the category $CATEGORY_ID

Si el ítem anteriormente es universal y se intenta cargar alguna compatibilidad, se obtendrá:

- Message: Item has universal setting and must be removed before creating compatibilities.

**403** : token inválido o falta de permisos sobre el ítem.

**404** : no existe el ítem.

## Actualizar compatibilidades

Con este método es posible crear, actualizar y eliminar las compatibilidades, notas y restricciones de un ítem, utilizando la misma estructura de datos que la creación de compatibilidades. Esta acción puede ser hecha para una o múltiples compatibilidades.

Para estos casos, solo es necesario enviar el **creation_source**  dentro del **create**

Importante:

- Este PUT es diferente de los otros utilizados para ítems, en este caso, la información no se sobrescribe. Es necesario especificar claramente la acción deseada: crear (create), modificar (update) o eliminar (delete). 
 - Los ejemplos a continuación incluyen "create", "update" y "delete". No es necesario especificar todas las acciones juntas, también se pueden indicar por separado. 
 - Para este método solo se puede indicar 200 productos por llamada.

Llamada:

```

curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/items/$ITEM_ID/compatibilities
```

Nota:

Al borrar compatibilidades, puedes optar por hacerlo a través de un listado de productos (products) o por familias de productos (products_families). Ambas opciones están disponibles en el ejemplo a continuación para que puedas elegir la que mejor se ajuste a tus necesidades y veas cómo enviar los datos correctamente.

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d 
'{
   "create": {
       "products": [
           {
               "id": "MLB22015088",
    "creation_source": "NEW_VEHICLES"
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60249"
                   },
                   {
                       "id": "MODEL",
                       "value_name": "Gol"
                   },
                   {
                       "id": "YEAR",
                       "value_name": "2023"
                   }
               ]
           }
       ]
   },
   "delete": {
       "products": [
           {
               "id": "MLB22015074"
           },
           {
               "id": "MLB7427549"
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60249"
                   },
                   {
                       "id": "MODEL",
                       "value_id": "62109"
                   },
                   {
                       "id": "YEAR",
                       "value_name": "2023"
                   }
               ]
           }
       ]
   }
}
```

Respuesta:

```
{
   "create": {
       "products": [
           {
               "id": "MLB22015088"
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60249"
                   },
                   {
                       "id": "MODEL",
                       "value_name": "Gol"
                   },
                   {
                       "id": "YEAR",
                       "value_name": "2023"
                   }
               ]
           }
       ],
       "universal": false
   },
   "delete": {
       "products": [
           {
               "id": "MLB22015074"
           },
           {
               "id": "MLB7427549"
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60249"
                   },
                   {
                       "id": "MODEL",
                       "value_id": "62109"
                   },
                   {
                       "id": "YEAR",
                       "value_name": "2023"
                   }
               ]
           }
       ],
       "universal": false
   }
}
```

Ejemplo para crear y actualizar compatibilidades con notas y/o restricciones:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d 
'{
   "create": {
       "products": [
           {
               "id": "MLB28049481",
               "note": "nota para teste",
               "restrictions": []
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60395"
                   },
                   {
                       "id": "MODEL",
                       "value_ids": [
                           "389577",
                           "16696"
                       ]
                   }
               ]
           }
       ]
   },
   "update": {
       "products": [
           {
               "id": "MLB22567898",
               "note": "nota para teste 10",
               "restrictions": [
                   {
                       "attribute_id": "POSITION",
                       "attribute_values": [
                           {
                               "values": [
                                   {
                                       "value_id": "13701104",
                                       "value_name": "Dianteira"
                                   }
                               ]
                           }
                       ]
                   }
               ]
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "67781"
                   },
                   {
                       "id": "MODEL",
                       "value_name": "ARGO"
                   }
               ],
               "note": "somente as versões de freios traseiros",
               "restrictions": [
                   {
                       "attribute_id": "POSITION",
                       "attribute_values": [
                           {
                               "values": [
                                   {
                                       "value_id": "13701104",
                                       "value_name": "Dianteira"
                                   }
                               ]
                           }
                       ]
                   }
               ]
           }
       ]
   }
}
```

Respuesta:

```
{
   "create": {
       "products": [
           {
               "id": "MLB28049481",
               "note": "nota para teste",
               "restrictions": []
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "60395"
                   },
                   {
                       "id": "MODEL",
                       "value_ids": [
                           "389577",
                           "16696"
                       ]
                   }
               ]
           }
       ],
       "universal": false
   },
   "update": {
       "products": [
           {
               "id": "MLB22567898",
               "note": "nota para teste 10",
               "restrictions": [
                   {
                       "attribute_id": "POSITION",
                       "attribute_code": 1,
                       "attribute_values": [
                           {
                               "values": [
                                   {
                                       "value_id": "13701104",
                                       "value_name": "Dianteira",
                                       "value_code": 5
                                   }
                               ]
                           }
                       ]
                   }
               ]
           }
       ],
       "products_families": [
           {
               "domain_id": "MLB-CARS_AND_VANS",
               "attributes": [
                   {
                       "id": "BRAND",
                       "value_id": "67781"
                   },
                   {
                       "id": "MODEL",
                       "value_name": "ARGO"
                   }
               ],
               "note": "somente as versões de freios traseiros",
               "restrictions": [
                   {
                       "attribute_id": "POSITION",
                       "attribute_code": 1,
                       "attribute_values": [
                           {
                               "values": [
                                   {
                                       "value_id": "13701104",
                                       "value_name": "Dianteira",
                                       "value_code": 5
                                   }
                               ]
                           }
                       ]
                   }
               ]
           }
       ],
       "universal": false
   }
}
```

Nota:

En el caso de que se quiera borrar las notas y/o restricciones se debe enviar en la sección 'update' con note: "" o restrictions: []

### Actualizar compatibilidades por user products

Este servicio permite crear o eliminar las compatibilidades de un **user product**  y también actualizar las notas y/o restricciones de las mismas.

Al igual que en la creación, el campo `domain_id` pasa a ser requerido, y debe ser enviado siempre por fuera de las listas de `products_families` y `products`.

```
curl --location --request PUT 'https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities' \
--header 'Content-Type: application/json' \
--data '{
    "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
    "category_id": "MLM12344",
    "create": {
        "products": [
            {
                "id": "MLM15861466",
                "note": "Nota producto creado individual desde upd compatibilidad 21/08",
                "restrictions": [
                    {
                        "attribute_id": "POSITION",
                        "attribute_values": [
                            {
                                "values": [
                                    {
                                        "value_id": "13701104",
                                        "value_name": "Dianteiro"
                                    }
                                ]
                            },
                            {
                                "values": [
                                    {
                                        "value_id": "13373176",
                                        "value_name": "Passageiro"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    "update": {
        "products": [
            {
                "id": "MLM15871318",
                "note": "Nota individual compatibilidad actualizada 21/08 por product",
                "restrictions": [
                    {
                        "attribute_id": "POSITION",
                        "attribute_values": [
                            {
                                "values": [
                                    {
                                        "value_id": "13701104",
                                        "value_name": "Dianteiro"
                                    }
                                ]
                            },
                            {
                                "values": [
                                    {
                                        "value_id": "13373176",
                                        "value_name": "Passageiro"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        "products_families": [
            {
                "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES",
                "attributes": [
                    {
                        "id": "BRAND",
                        "value_name": "CHEVROLET"
                    },
                    {
                        "id": "YEAR",
                        "value_name": "2017"
                    }
                ],
                "note": "Nota familiar actualizada 21/08 por family upd",
                "restrictions": [
                    {
                        "attribute_id": "POSITION",
                        "attribute_values": [
                            {
                                "values": [
                                    {
                                        "value_id": "13701104",
                                        "value_name": "Dianteiro"
                                    }
                                ]
                            },
                            {
                                "values": [
                                    {
                                        "value_id": "13373176",
                                        "value_name": "Passageiro"
                                    },
                                    {
                                        "value_id": "2262158",
                                        "value_name": "Esquerdo"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    "delete": {
        "products": [
            {
                "id": "MLM15847272"
            }
        ]
    }
}
```

### Posibles errores

**400**  - Validaciones de consistencia:

- Completitud de los campos obligatorios.

- Correctitud en el formato de los ids.

- Productos y/o dominios pertenecen al mismo site que el item.

- Dominio del item es compatible con los dominios de los productos especificados.

- Se ha excedido el máximo de 200 productos para una sola solicitud.

- **403** : token inválido o falta de permisos sobre el ítem.

- **404** : No existe el item o alguno de los productos.

- 

- Modificar o eliminar notas y restricciones de posición

- Para modificar o eliminar una nota y restricción de posición, ejecuta un PUT en el recurso de informar compatibilidades cambiando la información que necesitas en el campo **update** . Para borrar una o ambas, basta enviar el campo **note**  y/o el array **restrictions**  vacíos, como en el ejemplo que se muestra a continuación, donde se eliminan ambos campos.

- 

- Ejemplo:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities { "update": { "products": [{ "id": "MLB155254", "note": "", "restrictions":[] } ] } }`

- Identificar ítems compatibilizados

- Con el siguiente recurso puedes puedes identificar que un ítem ya está compatibilizado a través del **atributo id = “HAS_COMPATIBILITIES”** . En caso de que este atributo no se observe en la salida de la llamada quiere decir que el ítem no cuenta con compatibilidades informadas.

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1417560910`

- Respuesta:

- `{ "id": "MLA1417560910", "site_id": "MLA", "title": "Interruptor Columna (palanca) Tamatel 15104 - No Ofertar", "seller_id": 1373279576, "category_id": "MLA435058", . . . . "attributes": [ { "id": "HAS_COMPATIBILITIES", "name": "Tiene compatibilidades", "value_id": "242085", "value_name": "Sí", "values": [], "value_type": "boolean" }, {}, {} ], . . . }`

- Listar compatibilidades

- Con este recurso, puedes listar todas las compatibilidades para un ítem particular.

- Obtener todas compatibilidades de un ítem

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities?extended=true`

- Atributos:

- Extended: cuando el valor es “true” devolverá el detalle de las notas y posiciones.  **Nota:**  El parámetro `extended=true` es ignorado para compatibilidades de catálogo (**source: CATALOGO** ). Solo aplica a compatibilidades creadas por el vendedor (**source: SELLER** ).

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities?extended=true`

- **Importante:**    A partir de esta actualización, la respuesta diferencia según el origen de la compatibilidad:   - **source: SELLER**  — Compatibilidades creadas por el vendedor. Se retornan con todos los campos completos (id, domain_id, catalog_product_id, etc.).   - **source: CATALOGO**  — Compatibilidades del catálogo de Mercado Libre. Los campos **id** , **domain_id**  y **catalog_product_id**  no serán retornados (null). Solo se retorna el nombre de la marca (`catalog_product_name`) y el total agrupado (`total`).

- Respuesta:

- `{ “products”: [ { “id”: “bcbd413f-cd65-0e0f-88c9-5eb4aebb5372”, “domain_id”: “MLM-CARS_AND_VANS_FOR_COMPATIBILITIES”, “catalog_product_id”: “MLM15847548”, “catalog_product_name”: “Volkswagen Jetta 2010 GLI Manual 5”, “source”: “SELLER”, “note”: “Solo modelos de caja automática” }, { “id”: “58bd413f-cd65-a719-9570-2ca8f2b528af”, “domain_id”: “MLM-CARS_AND_VANS_FOR_COMPATIBILITIES”, “catalog_product_id”: “MLM15847546”, “catalog_product_name”: “Volkswagen Jetta 2010 GLI Automática 6”, “source”: “SELLER”, “note”: “Modelos posteriores a Junio 2010”, “restrictions”: [{ “attribute_id”: “POSITION”, “attribute_values”: [{ “values”:[{“value_id”: “12456”,”value_name”: “Delantero”}] },{ “values”:[{“value_id”: “65432”,”value_name”: “Trasero”}, {“value_id”: “87675”,”value_name”: “Inferior”}] }] }], “reputation”: { “level”: “RED” } }, { “id”: null, “domain_id”: null, “catalog_product_id”: null, “catalog_product_name”: “Volkswagen”, “source”: “CATALOGO”, “reputation”: null, “total”: 8 }, { “id”: null, “domain_id”: null, “catalog_product_id”: null, “catalog_product_name”: “Audi”, “source”: “CATALOGO”, “reputation”: null, “total”: 7 } ] }`

- Las entradas con campos `id` / `domain_id` / `catalog_product_id` en null representan las compatibilidades del catálogo de Mercado Libre. El campo `total` indica la cantidad de vehículos de esa marca. A partir del 15/07/2026, estas entradas retornarán `source: “CATALOGO”` en lugar de `source: “SELLER”`.

- Listar compatibilidades de un User products

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/&USER_PRODUCT_ID/compatibilities?main_domain_id=MLM-CARS_AND_VANS_FOR_COMPATIBILITIES&extended=true`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities?main_domain_id=MLM-CARS_AND_VANS_FOR_COMPATIBILITIES&extended=true`

- Nota:   - En caso que la compatibilidad no tenga reclamos por incompatibilidad, el objeto reputation no se mostrará en la respuesta.  - Sólo se compatibilizan reclamos cuyo reason_id sea PDD9575 o PDD9967.

- Campos de respuesta

- **products** : array con todos los vehículos (compatibilidades) informadas por el vendedor.

- ID: Id de la compatibilidad. domain_id: dominio del producto principal. catalog_product_id: Id del producto del dominio principal. catalog_product_name: nombre del producto del dominio principal. source: flujo de origen de la compatibilidad. note: especificación de condiciones de la compatibilidad entre el item y el producto principal. restrictions: restricciones de compatibilidad entre item y producto principal (Ej. Posición de instalación de la pieza). reputation: color y total de vehículos que generaron reclamos. level: tomará el valor de RED para las compatibilidades con alta cantidad de reclamos por incompatibilidad. **source** : indica el origen de la compatibilidad. Los valores posibles son:  **SELLER** : compatibilidad creada directamente por el vendedor. Todos los campos del producto (id, domain_id, catalog_product_id) son retornados con su valor real. **CATALOGO** : compatibilidad gestionada por el catálogo de Mercado Libre. Los campos `id`, `domain_id` y `catalog_product_id` se retornan como `null`. El campo `catalog_product_name` retorna solo el nombre de la marca. El campo `total` indica la cantidad de compatibilidades de esa marca en el catálogo. Este valor estará disponible a partir del 15/07/2026; hasta esa fecha, todas las compatibilidades retornan **SELLER** .   **catalog_compatibilities_count** : cantidad de compatibilidades del catálogo de Mercado Libre, es decir, estas últimas compatibilidades no estarán listadas debido a limitantes en licencias de propiedad intelectual.       Nota:   Si una compatibilidad cargada por el vendedor ya está disponible en el catálogo de Mercado Libre, no se mostrará en el campo products de la respuesta debido a /Responsabilidad de Licencias.    Obtener compatibilidades de un ítem universal En el caso de que el ítem esté configurado como universal, en la respuesta se agrega un campo adicional llamado **universal**  que contiene una lista de dominios principales con los cuales es compatible el ítem. Ejemplo respuesta: `{ "universal": { “domain_ids”: [“MLM_CARS_AND_VANS_FOR_COMPATIBILITIES”] } }` Obtener una compatibilidad particular de un ítem mediante su id     **Importante:**    Para compatibilidades de catálogo (**source: CATALOGO** ), los campos `id` y `catalog_product_id` serán retornados como `null`. No es posible acceder al detalle individual de una compatibilidad de catálogo por ID.    Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities/$COMPATIBILITY_ID` Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities/$COMPATIBILITY_ID` Respuesta (compatibilidad SELLER): `{ "id": "bcbd413f-cd65-0e0f-88c9-5eb4aebb5372", "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES", "catalog_product_id": "MLM15847548", "catalog_product_name": "Volkswagen Jetta 2010 GLI Manual 5", "note": "Solo para versiones con frenos a disco en las ruedas traseras", "note_status": "PENDING", "restrictions": [{ "attribute_id": "POSITION", "attribute_values": [{ "values":[{"value_id": "12456","value_name": "Delantero"}] }] }], "reputation": { "level": "RED" } }` Respuesta: `{ "id": null, "domain_id": null, "catalog_product_id": null, "catalog_product_name": "Volkswagen", "source": "SELLER", "restrictions": null, "reputation": { "level": "GREEN" } }` Las notas solo figuran en el front del ítem en los status **APPROVED**  o **CHECKED** . Un error 404 significa que el ítem o la compatibilidad no existen.    Obtener la nota de una compatibilidad Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities/$COMPATIBILITY_ID/note` Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM12456789/compatibilities/bcbd413f-cd65-0e0f-88c9-5eb4aebb5372/note` Respuesta: `{ "note": "Solo para versiones con frenos a disco en las ruedas traseras" }`   Eliminar compatibilidades En caso de haber asociado una compatibilidad incorrecta con el ítem, podrás eliminarla siempre que haya sido realizada por el vendedor.     **Importante:**    Solo es posible eliminar compatibilidades creadas por el vendedor (**source: SELLER** ). Las compatibilidades del catálogo de Mercado Libre (**source: CATALOGO** ) no pueden eliminarse a través de la API. La gestión de este tipo de compatibilidades debe realizarse desde Mercado Libre.      Eliminar una compatibilidad específica para el ítem indicado Llamada: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities/$COMPATIBILITY_ID` Ejemplo: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities/4cb9af35-8e9b-ebfd-9e7f-2245ac363d10` La respuesta será un http 200.  Eliminar compatibilidades para un ítem Llamada: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities` Ejemplo: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities` Respuesta: `{ "deleted_compatibilities": [ "d0ba2aeb-7409-0037-7b23-0b91266fd00e", "72ba233d-16d8-218b-4062-7a97dab166c8" ] }` Eliminar compatibilidades para un dominio de un ítem Llamada: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/compatibilities { "products_families": [{ "domain_id": "$domain_id", "attributes": [{ "id": "$attribute_id1", "values":[{ "id": "$value_id1", "name": "$value_name1" }] },{ "id": "$attribute_id2", "values":[{ "id": "$value_id1", "name": "$value_name1" }] }] }] }` Ejemplo: `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM794706391/compatibilities { "products_families": [{ "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES", "attributes": [{ "id": "DRIVE_TYPE", "value_id": "8182649" }, { "id": "CAR_AND_VAN_BODY_TYPE", "value_id": "8183109" }, { "id": "YEAR", "value_name": "2010" }] }] }` Respuesta: `{ "deleted_compatibilities": [ "d0ba2aeb-7409-0037-7b23-0b91266fd00e", "72ba233d-16d8-218b-4062-7a97dab166c8" ] }` Eliminar compatibilidades de un user products Para eliminar compatibilidades de un User Product a partir de una familia de atributos. Se requiere el main_domain_id y domain_id bajo la lista "products_families". Ejemplo: `curl --location --request DELETE 'https://api.mercadolibre.com/user-products/MLMU427597763/compatibilities' \ --header 'Content-Type: application/json' \ --data '{ "main_domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES", "products_families": [ { "domain_id": "MLM-CARS_AND_VANS_FOR_COMPATIBILITIES", "attributes": [ { "id": "BRAND", "value_name": "CHEVROLET" }, { "id": "YEAR", "value_name": "2017" } ] } ] }` Respuesta: `{ "deleted_compatibilities": [ "d0ba2aeb-7410-0042-8c57-1c82377fe11f" ] }` Posibles errores **400** : formato incorrecto / más de 200 productos para el dominio especificado / más de 10 dominios especificados.  **403** : token inválido o falta de permisos sobre el ítem.  **404** : el ítem o la compatibilidad no existen.  Cómo informar excepciones En casos de autopartes en que la categoría exige la información de compatibilidades, pero no encuentra ningún vehículo, modelo o versión disponible en el catálogo. Estos ítems hacen parte del flujo de excepciones y para informarlos disponibilizamos el siguiente recurso.   Llamada: `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$item_id/compatibilities/exception { "comment": “texto libre con máximo 255 caracteres” }` Ejemplo: `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB12345678/compatibilities/exception { "comment": “texto libre con máximo 255 caracteres” [Requerido] }` Respuesta: `200 OK` Cómo informar excepciones para User products Llamada: `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/compatibilities/exception { "comment": “texto libre con máximo 255 caracteres” }` Ejemplo: `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/MLU1443000156/compatibilities/exception { "comment": “texto libre con máximo 255 caracteres” [Requerido] }` Respuesta: `200 OK` Posibles errores **400** : el ítem está cerrado o inactivo.  **400** : el ítem tiene compatibilidades existentes.  **400** : la categoría del ítem no tiene compatibilidades.  **400** : el ítem tiene una excepción de compatibilidad existente.  **400** : se requiere comentario.  Consultar si un ítem tiene excepción Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$item_id/compatibilities/exception` Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB12345678/compatibilities/exception` Respuesta: `{ "has_exception": true/false }` Consultar si un user product tiene excepción Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/compatibilities/exception` Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/MLAU2339836140/compatibilities/exception` Respuesta: `{ "has_exception": true/false }` - Devuelve true sólo cuando el ítem no tienen ninguna compatibilidad cargada y se informó una excepción.   - Devuelve false siempre que el ítem tiene por lo menos un vehículo informado como compatible (independientemente de si se informó excepción o no).  Conocer compatibilidades que generan reclamos  Con la finalidad de que puedas corregir compatibilidades mal indicadas, con el siguiente endpoint puedes identificar el auto que eligió el comprador desde el momento en que se genera un reclamo por incompatibilidad.  Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/compats-snapshots/orders/$ORDER_ID` Ejemplos: Órden con reclamo donde el comprador seleccionó diferentes filtros durante la compra del producto y se confirmó que el producto seleccionado **"Sí era compatible"**  con el ítem (compatibility_status.compatibility = CONFIRMED).  Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/compats-snapshots/orders/2000006372967416` Respuesta: `{ "item_id": "MLM2187940074", "product_id": "MLM15879678", "seller_id": "61597650", "user_selection": { "label_values": [ { "label": "Marca", "value_name": "Jeep", "values": [ { "attribute_id": "BRAND", "value_id": "60395" } ] }, { "label": "Modelo", "value_name": "Grand Cherokee", "values": [ { "attribute_id": "CAR_AND_VAN_MODEL", "value_id": "8236932" } ] }, { "label": "Año", "value_name": "1998", "values": [ { "attribute_id": "YEAR", "value_id": "60500" } ] }, { "label": "Versión", "value_name": "Limited - SUV 4 Puertas", "values": [ { "attribute_id": "CAR_AND_VAN_SUBMODEL", "value_id": "8238101" }, { "attribute_id": "CAR_AND_VAN_BODY_TYPE", "value_id": "8183114" }, { "attribute_id": "BODY_DOORS_NUMBER", "value_id": "8239302" } ] }, { "label": "Mecánica", "value_name": "5.2L V8 Gasolina Aspirado Caja Automática 4 Marchas - Tracción RWD", "values": [ { "attribute_id": "CAR_AND_VAN_ENGINE", "value_id": "8753511" }, { "attribute_id": "ASPIRATION", "value_id": "8183201" }, { "attribute_id": "TRANSMISSION_CONTROL_TYPE", "value_id": "8183158" }, { "attribute_id": "TRANSMISSION_SPEEDS_NUMBER", "value_id": "8239312" }, { "attribute_id": "DRIVE_TYPE", "value_id": "8182651" } ] } ] }, "compatibility_status": { "compatibility": "CONFIRMED", "compatibility_id": "bec40b54-c7de-1ad2-a7e2-00a5e34376a4" }, "compatibility_deleted": true, "date_created": "2023-08-31T20:08:41Z", "date_updated": "2023-08-31T22:37:39Z" }` Órden con reclamo donde el comprador no seleccionó algún vehículo durante la compra del producto.  Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/compats-snapshots/orders/2000006372967424` Respuesta: `{ "item_id": "MLM2038068352", "seller_id": "186880296", "compatibility_status": { "compatibility": "NO_USER_SELECTION", "note": "We don't have the compatibility information for this order. The user made the order without completing the widget. ", "restrictions": [] }, "date_created": "2023-08-23T12:30:57Z" }` Órden con reclamo donde previo a la compra se confirmó al compradorque el producto seleccionado **"No era compatible"**  con el ítem (compatibility_status.compatibility = INCOMPATIBLE).  Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/compats-snapshots/orders/2000006372967684` Respuesta: `{ "item_id": "MLM693204319", "seller_id": "56493851", "compatibility_status": { "compatibility": "INCOMPATIBLE" }, "compatibility_deleted": true, "date_created": "2023-08-25T14:45:48Z" }` Los campos indican:  **compatibility_id** : identificador de la compatibilidad seleccionada durante la compra. **product_id** : id del vehículo seleccionado previo a la compra. **user_selection** : detalle de los filtros seleccionados por el comprador al momento de la compra.   **compatibility_status.compatibility** :   CONFIRMED: indica que se confirmó al comprador que el vehículo seleccionado era compatible con el ítem comprado.   INCOMPATIBLE: indica que se confirmó al comprador que el vehículo seleccionado no era compatible con el ítem comprado.    **compatibility_deleted:** :   “true” indica que la compatibilidad para el vehículo seleccionado por el comprador ya fue borrada por el ítem al momento de realizar la consulta.       Nota:   A partir del 19 de febrero para obtener el detalle de reclamos por incompatibilidad [consulta el endpoint GET /v1/claims/search?reason_id=$reason_id](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-reclamos#Busqueda-de-reclamos) e identifica el atributo **"reason_id": "PDD9967"**  o **reason_id: “PDD9575”** .       Posibles errores:    Error_code Mensaje del error Descripción     400 Compatibility snapshot for order with id $ORDER_ID not found. La orden no es válida.    401 Invalid access token. Access Token inválido.    403 The compatibility snapshot can only be retrieved for orders with claims. La orden no tiene claim asociado.   403 Caller must be the seller of the item. Se está intentando consultar la orden de un seller que no corresponde al del Access Token proporcionado.         Importante:   Para mantener actualizadas las compatibilidades puedes conocer los vehiculos que se agregaron al catálogo [realizando un get al recurso /catalog_compatibilities/products_search/new?categoryId=$CATEGORY_ID](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes?nocache=true#Obtener-los-productos-nuevos-del-cat%C3%A1logo).      **Siguiente** : [Referencias de dominios, productos y atributos para Autopartes](https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes).
