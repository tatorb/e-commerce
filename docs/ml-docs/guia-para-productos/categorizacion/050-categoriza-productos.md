<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/categoriza-productos -->
<!-- Sección: Guía para productos > Categorización -->

# Categorización de productos

Última actualización 30/12/2025

## Categorización de productos

Las categorías son un conjunto jerárquico de grupos donde enumeramos los artículos de naturaleza similar y denominamos Árbol de Categorías. Antes de publicar un producto, utiliza el predictor de categorías para predecir, de la mejor manera, en qué categoría deberías publicarlo. 
 Además, podrás explorar la estructura de categorías y elegir en cuál deseas publicar [descargando la jerarquía completa de categorías con ID](https://developers.mercadolibre.com.ar/es_ar/descarga-de-categorias) y nombres cortos desde nuestra API.

## Predictor de categorías

Te permite aumentar la precisión de la predicción que realices, mira nuestro webinar sobre Predictor de categorías:

Realiza una llamada GET para predecir un artículo por vez y así, podrás reconocer la categoría con los atributos que debes cargar para que la publicación tenga calidad. Ten en cuenta que la respuesta estará compuesta de un listado de predicciones a partir del título provisto, siendo la primera la de mayor probabilidad.

## Parámetros obligatorios

**site_id** : es el sitio en el que realizas la publicación.
 **q** : es el título del artículo a predecir y debe estar completamente en el idioma del sitio (español o portugués).

## Parámetros opcionales

**limit** : por defecto, el límite será de 4 con un máximo de 8, por lo que podrías definir un limit entre 1 a 8. 
 **target** : puede estar compuesto por core (Producto) o classified (Clasificados) dependiendo la vertical en el que estés publicando.

Nota:

Recomendamos el uso del parámetro "limit=3" para que el seller pueda tener más opciones de categorías al usar el predictor, así como tenemos en la experiencia del front en Mercado Libre.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/domain_discovery/search?q=$Q
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=celular%20iphone
```

Respuesta:

```
[
  {
    "domain_id": "MLA-CELLPHONES",
    "domain_name": "Celulares",
    "category_id": "MLA1055",
    "category_name": "Celulares y Smartphones",
    "attributes": [
      {
        "id": "BRAND",
        "value_id": "9344",
        "value_name": "Apple"
      },
      {
        "id": "LINE",
        "value_id": "58993",
        "value_name": "iPhone"
      },
      {
        "id": "MODEL",
        "value_id": "14608",
        "value_name": "iPhone"
      }
    ]
  }
] 
```

## Campos de respuesta

**domain_id** : es el ID del dominio que predices para el artículo. 
 **domain_name** : es el nombre del dominio que predices.
 **category_id** : es el ID de la categoría que predices para el articulo. 
 **category_name** : es el nombre de la categoría que predices.
 **attributes** : Listado de atributos para la categoría que se predijo.

## Convertir de Domínio a Categoría

El rercuso `domain` ofrece la estructura de dominio de un país en particular, en este caso, Argentina.

Llamadaspan>

```
curl -X GET https://api.mercadolibre.com/catalog_domains/DOMAIN_ID/categories
```

Ejemplo:

```
curl -X GET https://api.mercadolibre.com/catalog_domains/MLA-CELLPHONES/categories
```

Respuesta:

```

[{"id":"MLA1055","name":"Celulares y Smartphones"}]
```

## Categorías por site

El recurso /sites puede ofrecerte la estructura de categorías para un país en particular, en este caso Argentina.

Llanmada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/categories
```

Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/categories
```

Respuesta:

```
[
  {
    "id": "MLA5725",
    "name": "Accesorios para Vehículos"
  },
  {
    "id": "MLA1512",
    "name": "Agro"
  },
  {
    "id": "MLA1403",
    "name": "Alimentos y Bebidas"
  },
  {
    "id": "MLA1071",
    "name": "Animales y Mascotas"
  },
  {
    "id": "MLA1367",
    "name": "Antigüedades y Colecciones"
  },
  {
    "id": "MLA1368",
    "name": "Arte, Librería y Mercería"
  },
  {
    "id": "MLA1743",
    "name": "Autos, Motos y Otros"
  },
  {
    "id": "MLA1384",
    "name": "Bebés"
  },
  {
    "id": "MLA1246",
    "name": "Belleza y Cuidado Personal"
  },
  {
    "id": "MLA1039",
    "name": "Cámaras y Accesorios"
  },
  {
    "id": "MLA1051",
    "name": "Celulares y Teléfonos"
  },
  {
    "id": "MLA1648",
    "name": "Computación"
  },
  {
    "id": "MLA1144",
    "name": "Consolas y Videojuegos"
  },
  {
    "id": "MLA1500",
    "name": "Construcción"
  },
  {
    "id": "MLA1276",
    "name": "Deportes y Fitness"
  },
  {
    "id": "MLA5726",
    "name": "Electrodomésticos y Aires Ac."
  },
  {
    "id": "MLA1000",
    "name": "Electrónica, Audio y Video"
  },
  {
    "id": "MLA2547",
    "name": "Entradas para Eventos"
  },
  {
    "id": "MLA407134",
    "name": "Herramientas"
  },
  {
    "id": "MLA1574",
    "name": "Hogar, Muebles y Jardín"
  },
  {
    "id": "MLA1499",
    "name": "Industrias y Oficinas"
  },
  {
    "id": "MLA1459",
    "name": "Inmuebles"
  },
  {
    "id": "MLA1182",
    "name": "Instrumentos Musicales"
  },
  {
    "id": "MLA3937",
    "name": "Joyas y Relojes"
  },
  {
    "id": "MLA1132",
    "name": "Juegos y Juguetes"
  },
  {
    "id": "MLA3025",
    "name": "Libros, Revistas y Comics"
  },
  {
    "id": "MLA1168",
    "name": "Música, Películas y Series"
  },
  {
    "id": "MLA1430",
    "name": "Ropa y Accesorios"
  },
  {
    "id": "MLA409431",
    "name": "Salud y Equipamiento Médico"
  },
  {
    "id": "MLA1540",
    "name": "Servicios"
  },
  {
    "id": "MLA9304",
    "name": "Souvenirs, Cotillón y Fiestas"
  },
  {
    "id": "MLA1953",
    "name": "Otras categorías"
  }
]
```

## Detalle de una categoría

Importante:

A partir del 14 de diciembre de 2022, el máximo de variaciones permitidas (**max_variations_allowed** ) por categoría a 100. Excepto, categorías de Moda, Accesorios para celulares y Autopartes tendrán un límite de 250. Además, todas las variaciones existentes podrán ser editadas.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA3530
```

Respuesta:

```
{
  "id": "MLA3530",
  "name": "Otros",
  "picture": "http://resources.mlstatic.com/category/images/985c3a8d-ea5b-4266-a0cf-a3dc51f6e12f.png",
  "permalink": null,
  "total_items_in_this_category": 180778,
  "path_from_root": [
    {
      "id": "MLA1953",
      "name": "Otras categorías"
    },
    {
      "id": "MLA3530",
      "name": "Otros"
    }
  ],
  "children_categories": [
  ],
  "attribute_types": "attributes",
  "settings": {
    "adult_content": false,
    "buying_allowed": true,
    "buying_modes": [
      "buy_it_now",
      "auction"
    ],
    "catalog_domain": "MLA-UNCLASSIFIED_PRODUCTS",
    "coverage_areas": "not_allowed",
    "currencies": [
      "ARS"
    ],
    "fragile": false,
    "immediate_payment": "required",
    "item_conditions": [
      "new",
      "not_specified",
      "used"
    ],
    "items_reviews_allowed": false,
    "listing_allowed": true,
    "max_description_length": 50000,
    "max_pictures_per_item": 12,
    "max_pictures_per_item_var": 10,
    "max_sub_title_length": 70,
    "max_title_length": 60,
    "max_variations_allowed": 100,
    "maximum_price": null,
    "maximum_price_currency": "ARS",
    "minimum_price": 99,
    "minimum_price_currency": "ARS",
    "mirror_category": null,
    "mirror_master_category": null,
    "mirror_slave_categories": [
    ],
    "price": "required",
    "reservation_allowed": "not_allowed",
    "restrictions": [
    ],
    "rounded_address": false,
    "seller_contact": "not_allowed",
    "shipping_modes": null,
    "shipping_options": [
      "custom",
      "carrier"
    ],
    "shipping_profile": "optional",
    "show_contact_information": false,
    "simple_shipping": "optional",
    "stock": "required",
    "sub_vertical": "other",
    "subscribable": false,
    "tags": [
      "others"
    ],
    "vertical": "other",
    "vip_subdomain": "articulo",
    "buyer_protection_programs": [
      "delivered",
      "undelivered"
    ],
    "status": "enabled"
  },
  "channels_settings": [
    {
      "channel": "private",
      "settings": {
        "minimum_price": null,
        "price": "optional",
        "status": "enabled",
        "stock": "optional"
      }
    },
    {
      "channel": "proximity",
      "settings": {
        "status": "disabled"
      }
    },
    {
      "channel": "mp-merchants",
      "settings": {
        "buying_modes": [
          "buy_it_now"
        ],
        "immediate_payment": "required",
        "minimum_price": 1,
        "status": "enabled"
      }
    }
  ],
  "meta_categ_id": null,
  "attributable": false,
  "date_created": "2018-04-25T08:12:56.000Z"
}
```

Nota:

En caso de superar el máximo permitido de variaciones, recibirás un error 400 “Variations should not exceed max size of 100”.

## Path from root

Cuando estás en una categoría, puedes conocer el path from root de la categoría seleccionada. Observa cómo MercadoLibre utiliza esta ruta para mostrar la categoría del artículo:

## Descargar categorías

Por último, y en caso de no poder utilizar el Predictor de categorías, podrás [descargar el árbol de categorías](https://developers.mercadolibre.com.ar/es_ar/descarga-de-categorias).

**Siguiente:**  [Publica productos](https://developers.mercadolibre.com.ar/es_ar/publica-productos).
